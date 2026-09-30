"use server";

import { z } from "zod";
import { getViewer, requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { clip, redact } from "@/lib/ai/redact";
import { adminSystem, buyerSystem, disputeSystem, freightSystem, sellerSystem, untrusted } from "@/lib/ai/prompts";
import {
  adminBriefingSchema,
  buyerPlanSchema,
  disputeSummarySchema,
  freightTipsSchema,
  listingDraftSchema,
  type AdminBriefing,
  type BuyerPlan,
  type DisputeSummary,
  type FreightTips,
  type ListingDraft,
} from "@/lib/ai/schemas";
import { carrierClassFor, kgToGrams } from "@/lib/logistics/units";
import { COUNTIES } from "@/features/marketplace/constants";
import { listCategories, searchListings, type Listing } from "@/features/marketplace/queries";
import { getDispute } from "@/features/disputes/queries";
import { getAiStatus, runAssistant, type AiRun } from "./run";
import { parseListingQuery } from "@/features/marketplace/search-params";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid reference.");
const MIN_INPUT = 10;

function validateText(raw: string, max: number, label: string): ActionResult<never> | string {
  const clean = clip(raw, max + 1);
  if (clean.length < MIN_INPUT) return fail("VALIDATION", `Tell the assistant a little more about ${label}.`);
  if (clean.length > max) return fail("VALIDATION", `Please keep this under ${max.toLocaleString("en-US")} characters.`);
  return clean;
}

/* --------------------------------------------------------------- buyer */

export interface BuyerAssistResult {
  plan: BuyerPlan;
  /** Real listings from the live catalogue, one group per suggested search. */
  groups: { query: string; total: number; items: Listing[] }[];
}

export async function askBuyerAssistant(input: { need: string; currency: string }): Promise<ActionResult<AiRun<BuyerAssistResult>>> {
  await requireRole("buyer");
  const status = await getAiStatus();
  const text = validateText(input.need, status.maxInputChars, "what you need to buy");
  if (typeof text !== "string") return text;
  const currency = input.currency === "LRD" ? "LRD" : "USD";

  const res = await runAssistant({
    assistant: "buyer",
    system: buyerSystem(),
    user: untrusted("buyer_need", redact(text)),
    schema: buyerPlanSchema,
  });
  if (!res.ok) return res;

  // The model only proposes search phrases; the products come from the catalogue.
  const groups = await Promise.all(
    res.data.value.searches.map(async (q) => {
      const query = parseListingQuery({ q, currency, stock: "1" });
      const found = await searchListings(query);
      return { query: q, total: found.total, items: found.items.slice(0, 4) };
    }),
  );
  return ok({ value: { plan: res.data.value, groups }, remaining: res.data.remaining });
}

/* -------------------------------------------------------------- seller */

export interface ListingDraftResult {
  draft: ListingDraft;
  category: { id: string; name: string } | null;
}

export async function draftListing(input: { notes: string }): Promise<ActionResult<AiRun<ListingDraftResult>>> {
  await requireRole("seller");
  const status = await getAiStatus();
  const text = validateText(input.notes, status.maxInputChars, "the product");
  if (typeof text !== "string") return text;

  const categories = await listCategories();
  const res = await runAssistant({
    assistant: "seller",
    system: sellerSystem(categories.map((c) => ({ slug: c.slug, name: c.name }))),
    user: untrusted("seller_notes", redact(text)),
    schema: listingDraftSchema,
    maxTokens: 1200,
  });
  if (!res.ok) return res;

  // Only accept a category that really exists; never trust the model's slug.
  const match = categories.find((c) => c.slug === res.data.value.category_slug);
  return ok({ value: { draft: res.data.value, category: match ? { id: match.id, name: match.name } : null }, remaining: res.data.remaining });
}

/* ------------------------------------------------------------- freight */

export interface FreightAdviceResult {
  /** Deterministic: derived from the weight with the platform's own bands. */
  carrierClass: "Small" | "Medium" | "Large";
  totalKg: number;
  tips: FreightTips;
}

const freightSchema = z.object({
  goods: z.string().trim().min(3, "Say what you're shipping.").max(400),
  weight_kg: z.string().trim(),
  packages: z.coerce.number().int().min(1, "At least one package.").max(10000),
  from: z.enum(COUNTIES, { error: "Choose the pickup county." }),
  to: z.enum(COUNTIES, { error: "Choose the delivery county." }),
  fragile: z.boolean(),
});

export async function adviseFreight(input: { goods: string; weight_kg: string; packages: string; from: string; to: string; fragile: boolean }): Promise<ActionResult<AiRun<FreightAdviceResult>>> {
  const viewer = await getViewer();
  if (!viewer) return fail("UNAUTHENTICATED", "Your session ended. Sign in again.");
  if (!viewer.roles.includes("buyer") && !viewer.roles.includes("seller")) return fail("FORBIDDEN", "Freight advice is for buyers and sellers.");

  const parsed = freightSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Check the details and try again.");
  const grams = kgToGrams(parsed.data.weight_kg);
  if (!grams) return fail("VALIDATION", "Enter the total weight in kilograms, like 450.");

  const v = parsed.data;
  const totalKg = grams / 1000;
  const facts = [
    `Goods: ${untrusted("goods", redact(v.goods))}`,
    `Total weight: ${totalKg} kg in ${v.packages} package(s). Fragile: ${v.fragile ? "yes" : "no"}.`,
    `Route: ${v.from} County to ${v.to} County. Vehicle class needed (computed by the platform): ${carrierClassFor(grams)}.`,
  ].join("\n");

  const res = await runAssistant({ assistant: "freight", system: freightSystem(), user: facts, schema: freightTipsSchema });
  if (!res.ok) return res;
  return ok({ value: { carrierClass: carrierClassFor(grams), totalKg, tips: res.data.value }, remaining: res.data.remaining });
}

/* --------------------------------------------------------------- admin */

export interface AdminOverviewResult {
  briefing: AdminBriefing;
}

export async function adminBriefing(input: { days: number }): Promise<ActionResult<AiRun<AdminOverviewResult>>> {
  await requireRole("admin");
  const days = Math.min(Math.max(Math.trunc(Number(input.days)) || 30, 1), 180);
  const db = await createSupabaseServerClient();
  if (!db) return fail("NOT_CONFIGURED", "The service isn't configured.");
  // Aggregates only: the function returns counts and totals, never names or contact details.
  const snap = await db.rpc("admin_marketplace_snapshot", { p_days: days });
  if (snap.error) return fail("INTERNAL", "We couldn't read the marketplace numbers.");

  const res = await runAssistant({
    assistant: "admin",
    system: adminSystem(),
    user: `Marketplace snapshot for the last ${days} days (server-computed JSON; money in minor units):\n${JSON.stringify(snap.data)}`,
    schema: adminBriefingSchema,
  });
  if (!res.ok) return res;
  return ok({ value: { briefing: res.data.value }, remaining: res.data.remaining });
}

export interface DisputeSummaryResult {
  summary: DisputeSummary;
}

export async function summarizeDispute(disputeId: string): Promise<ActionResult<AiRun<DisputeSummaryResult>>> {
  await requireRole("admin");
  const id = uuid.safeParse(disputeId);
  if (!id.success) return fail("VALIDATION", "That dispute couldn't be found.");
  const status = await getAiStatus();
  const detail = await getDispute(id.data);
  if (!detail) return fail("NOT_FOUND", "That dispute couldn't be found.");

  const d = detail.dispute;
  const thread = detail.messages.map((m) => `[${m.author_role}] ${m.body}`).join("\n");
  const facts = [
    `Kind: ${d.kind}. Status: ${d.status}. Opened by: ${d.opened_by_role}.`,
    detail.order ? `Order status: ${detail.order.status}. Goods ${detail.order.subtotal_minor} and freight ${detail.order.freight_minor} (${detail.order.currency} minor units).` : "",
    d.requested_refund_minor ? `Buyer asked for a refund of ${d.requested_refund_minor} minor units.` : "",
    `Evidence files attached: ${detail.evidence.length} (you cannot see their contents; say so).`,
    `Opening description:\n${untrusted("description", redact(clip(d.description, 2000)))}`,
    `Conversation:\n${untrusted("thread", redact(clip(thread, Math.max(status.maxInputChars, 2000))))}`,
  ].filter(Boolean).join("\n");

  const res = await runAssistant({ assistant: "dispute_summary", system: disputeSystem(), user: facts, schema: disputeSummarySchema, maxTokens: 1100 });
  if (!res.ok) return res;
  return ok({ value: { summary: res.data.value }, remaining: res.data.remaining });
}
