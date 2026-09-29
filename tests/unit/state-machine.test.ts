import { describe, expect, it } from "vitest";
import { defineStateMachine, InvalidTransitionError } from "@/lib/state-machine";

const escrow = defineStateMachine({
  name: "escrow",
  initial: "PENDING",
  transitions: {
    PENDING: ["FUNDED", "CANCELLED"],
    FUNDED: ["RELEASED", "REFUNDED"],
    RELEASED: [],
    REFUNDED: [],
    CANCELLED: [],
  },
});

describe("defineStateMachine", () => {
  it("allows declared transitions only", () => {
    expect(escrow.can("PENDING", "FUNDED")).toBe(true);
    expect(escrow.can("PENDING", "RELEASED")).toBe(false);
  });
  it("never lets a released escrow be released again", () => {
    expect(() => escrow.assertTransition("RELEASED", "RELEASED")).toThrow(InvalidTransitionError);
  });
  it("derives terminal states", () => {
    expect([...escrow.terminal].sort()).toEqual(["CANCELLED", "REFUNDED", "RELEASED"]);
  });
  it("rejects transitions to undeclared states at definition time", () => {
    expect(() =>
      defineStateMachine({ name: "bad", initial: "A", transitions: { A: ["B" as "A"] } as never }),
    ).toThrow(/undeclared/);
  });
});
