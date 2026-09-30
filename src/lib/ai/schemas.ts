import { z } from "zod";

const short = (n: number) => z.string().trim().min(1).max(n);

/** Buyer assistant: search ideas only. Products shown to the buyer come from the real catalogue, never from here. */
export const buyerPlanSchema = z.object({
  summary: short(400),
  searches: z.array(short(60)).min(1).max(4),
  quantity_notes: z.array(short(240)).max(4).default([]),
  questions_for_seller: z.array(short(200)).max(4).default([]),
});
export type BuyerPlan = z.infer<typeof buyerPlanSchema>;

export const listingDraftSchema = z.object({
  title: short(120),
  description: short(1500),
  category_slug: z.string().trim().max(80).nullable().default(null),
  specs: z.array(z.object({ label: short(60), value: short(120) })).max(8).default([]),
  tips: z.array(short(200)).max(4).default([]),
});
export type ListingDraft = z.infer<typeof listingDraftSchema>;

export const freightTipsSchema = z.object({
  tips: z.array(short(240)).min(1).max(6),
  watch_outs: z.array(short(240)).max(4).default([]),
});
export type FreightTips = z.infer<typeof freightTipsSchema>;

export const adminBriefingSchema = z.object({
  headline: short(240),
  highlights: z.array(short(300)).min(1).max(6),
  attention: z.array(short(300)).max(6).default([]),
});
export type AdminBriefing = z.infer<typeof adminBriefingSchema>;

export const disputeSummarySchema = z.object({
  summary: short(900),
  claimed: short(400),
  evidence_notes: z.array(short(240)).max(6).default([]),
  points_to_consider: z.array(short(300)).max(6).default([]),
  missing_information: z.array(short(240)).max(5).default([]),
});
export type DisputeSummary = z.infer<typeof disputeSummarySchema>;
