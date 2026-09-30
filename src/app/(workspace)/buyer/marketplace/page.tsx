import { redirect } from "next/navigation";

/** The marketplace is public; buyers browse the same pages everyone sees. */
export default function BuyerMarketplaceRedirect() {
  redirect("/marketplace");
}
