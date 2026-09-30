import type { Database } from "@/lib/db/types";
import type { ProviderPaymentStatus } from "./types";

type DbStatus = Database["public"]["Enums"]["payment_status"];

/** Provider vocabulary → our payment_status enum. */
export function toDbStatus(status: ProviderPaymentStatus): Exclude<DbStatus, "initiated"> {
  switch (status) {
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    case "EXPIRED":
      return "expired";
    default:
      return "pending";
  }
}
