import { ShieldHalf, Store, Truck, Warehouse } from "lucide-react";
import type { Role } from "@/lib/auth/roles";

const ICONS = { buyer: Store, seller: Warehouse, carrier: Truck, admin: ShieldHalf } as const;

export function RoleIcon({ role, className }: { role: Role; className?: string }) {
  const Icon = ICONS[role];
  return <Icon className={className} aria-hidden="true" />;
}
