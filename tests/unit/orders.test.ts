import { describe, expect, it } from "vitest";
import { feeFor, priceLine, summarizeCart, type CartLineInput } from "@/lib/orders/cart";
import {
  availableActions,
  buyerCancelWindowOpen,
  canTransition,
  orderMachine,
  ORDER_STATUS,
  reasonRequired,
  stageIndex,
  type OrderActor,
  type OrderStatus,
} from "@/lib/orders/state";

describe("order state machine (mirror of transition_order)", () => {
  // The complete Phase 3 allow-list, exactly as the database enforces it.
  const allowed: [OrderStatus, OrderStatus, OrderActor[]][] = [
    ["pending_seller", "confirmed", ["seller"]],
    ["pending_seller", "cancelled", ["buyer", "seller", "admin"]],
    ["confirmed", "fulfilling", ["seller"]],
    ["confirmed", "cancelled", ["buyer", "seller", "admin"]],
    ["fulfilling", "ready_for_freight", ["seller"]],
    ["fulfilling", "cancelled", ["seller", "admin"]],
    ["ready_for_freight", "cancelled", ["seller", "admin"]],
    ["freight_requested", "cancelled", ["seller", "admin"]],
    ["carrier_selected", "cancelled", ["seller", "admin"]],
  ];
  const actors: OrderActor[] = ["buyer", "seller", "admin"];

  it("allows exactly the database's transitions per actor", () => {
    for (const from of orderMachine.states) {
      for (const to of orderMachine.states) {
        for (const actor of actors) {
          const expected = allowed.some(([f, t, a]) => f === from && t === to && a.includes(actor));
          expect(canTransition(from, to, actor), `${from}→${to} as ${actor}`).toBe(expected);
        }
      }
    }
  });

  it("has labels for every status and terminal states with no exits", () => {
    for (const s of orderMachine.states) expect(ORDER_STATUS[s].label).toBeTruthy();
    expect(orderMachine.isTerminal("cancelled")).toBe(true);
    expect(orderMachine.isTerminal("completed")).toBe(true);
    expect(orderMachine.isTerminal("pending_seller")).toBe(false);
  });

  it("requires a reason when sellers or admins cancel", () => {
    expect(reasonRequired("cancelled", "seller")).toBe(true);
    expect(reasonRequired("cancelled", "admin")).toBe(true);
    expect(reasonRequired("cancelled", "buyer")).toBe(false);
    expect(reasonRequired("confirmed", "seller")).toBe(false);
  });

  it("lists forward actions first and cancel last", () => {
    const seller = availableActions("pending_seller", "seller");
    expect(seller.map((a) => a.to)).toEqual(["confirmed", "cancelled"]);
    expect(seller[1]).toMatchObject({ needsReason: true, variant: "danger" });
    expect(availableActions("pending_seller", "buyer").map((a) => a.to)).toEqual(["cancelled"]);
    expect(availableActions("ready_for_freight", "buyer")).toEqual([]);
    expect(availableActions("pending_seller", "admin").map((a) => a.to)).toEqual(["cancelled"]);
  });

  it("hides buyer cancel on confirmed orders once the window closes", () => {
    const placedAt = "2026-09-30T10:00:00Z";
    const inside = new Date("2026-09-30T10:59:00Z");
    const outside = new Date("2026-09-30T11:01:00Z");
    expect(buyerCancelWindowOpen(placedAt, 60, inside)).toBe(true);
    expect(buyerCancelWindowOpen(placedAt, 60, outside)).toBe(false);
    expect(availableActions("confirmed", "buyer", { placedAt, cancelWindowMinutes: 60, now: inside })).toHaveLength(1);
    expect(availableActions("confirmed", "buyer", { placedAt, cancelWindowMinutes: 60, now: outside })).toHaveLength(0);
    // Pending orders stay cancellable by the buyer regardless of time.
    expect(availableActions("pending_seller", "buyer", { placedAt, cancelWindowMinutes: 60, now: outside })).toHaveLength(1);
  });

  it("maps statuses onto tracker stages", () => {
    expect(stageIndex("pending_seller")).toBe(0);
    expect(stageIndex("confirmed")).toBe(1);
    expect(stageIndex("ready_for_freight")).toBe(2);
    expect(stageIndex("cancelled")).toBe(-1);
  });
});

describe("platform fee rounding (ADR 0010)", () => {
  it("rounds half up like public.fee_for", () => {
    expect(feeFor(99, 250)).toBe(2); // 2.475
    expect(feeFor(100, 250)).toBe(3); // 2.5
    expect(feeFor(101, 250)).toBe(3); // 2.525
    expect(feeFor(156000, 250)).toBe(3900);
    expect(feeFor(0, 250)).toBe(0);
  });
});

describe("cart summary", () => {
  const seller = (id: string, name: string) => ({ id, name, slug: id, county: "Montserrado", town: "Monrovia", verified: false });
  const product = (over: Partial<NonNullable<CartLineInput["product"]>> = {}): NonNullable<CartLineInput["product"]> => ({
    id: "p1",
    slug: "rice",
    title: "Rice",
    unitLabel: "bag",
    moq: 10,
    available: 200,
    currency: "USD",
    unitWeightG: 25000,
    coverPath: null,
    seller: seller("s1", "Ada"),
    tiers: [
      { minQty: 10, maxQty: 49, unitPriceMinor: 2450 },
      { minQty: 50, maxQty: null, unitPriceMinor: 2300 },
    ],
    ...over,
  });

  it("prices a line at its tier and suggests the next tier", () => {
    const l = priceLine({ id: "c1", quantity: 20, product: product() });
    expect(l).toMatchObject({ unitPriceMinor: 2450, lineTotalMinor: 49000, weightG: 500000, issue: null, nextTier: { minQty: 50, unitPriceMinor: 2300 } });
    expect(priceLine({ id: "c1", quantity: 60, product: product() }).nextTier).toBeNull();
  });

  it("flags MOQ, stock and unavailable lines", () => {
    expect(priceLine({ id: "c", quantity: 5, product: product() }).issue).toBe("below_moq");
    expect(priceLine({ id: "c", quantity: 500, product: product() }).issue).toBe("over_stock");
    expect(priceLine({ id: "c", quantity: 10, product: null }).issue).toBe("unavailable");
  });

  it("groups by seller and currency and never mixes currencies", () => {
    const s = summarizeCart([
      { id: "a", quantity: 20, product: product() },
      { id: "b", quantity: 10, product: product({ id: "p2", title: "Oil", tiers: [{ minQty: 10, maxQty: null, unitPriceMinor: 3000 }] }) },
      { id: "c", quantity: 20, product: product({ id: "p3", title: "Cement", currency: "LRD", seller: seller("s2", "Ben"), moq: 20, tiers: [{ minQty: 20, maxQty: null, unitPriceMinor: 185000 }] }) },
      { id: "d", quantity: 1, product: null },
    ]);
    expect(s.groups.map((g) => [g.seller.name, g.currency, g.lines.length])).toEqual([
      ["Ada", "USD", 2],
      ["Ben", "LRD", 1],
    ]);
    expect(s.groups[0].lines.map((l) => l.product!.title)).toEqual(["Oil", "Rice"]);
    expect(s.groups[0].subtotalMinor).toBe(49000 + 30000);
    expect(s.totals).toEqual([
      { currency: "USD", subtotalMinor: 79000 },
      { currency: "LRD", subtotalMinor: 3700000 },
    ]);
    expect(s.unavailable).toHaveLength(1);
    expect(s.hasIssues).toBe(true);
  });
});
