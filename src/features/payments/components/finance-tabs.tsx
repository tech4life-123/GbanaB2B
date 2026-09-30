import { FilterTabs } from "@/features/commerce/components/order-bits";

export function FinanceTabs({ active }: { active: "overview" | "payments" | "payouts" }) {
  return (
    <FilterTabs
      label="Finance sections"
      active={active}
      tabs={[
        { key: "overview", label: "Overview", href: "/admin/finance" },
        { key: "payments", label: "Payments", href: "/admin/finance/payments" },
        { key: "payouts", label: "Payouts & refunds", href: "/admin/finance/payouts" },
      ]}
    />
  );
}
