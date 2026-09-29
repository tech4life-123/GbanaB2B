import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseEnvLenient } from "@/config/env";

describe("parseEnvLenient", () => {
  it("keeps valid values, drops blank and invalid ones without leaking them", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = parseEnvLenient(
      { A: z.url(), B: z.url(), C: z.string().min(20), D: z.string() },
      { A: "https://ok.example.com", B: "your-mtn-url-here", C: "", D: undefined },
      "test",
    );
    expect(out).toEqual({ A: "https://ok.example.com" });
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).not.toContain("your-mtn-url-here");
    warn.mockRestore();
  });
});
