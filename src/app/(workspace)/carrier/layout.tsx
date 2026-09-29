import { RoleWorkspace } from "@/features/workspace/role-workspace";

export default function CarrierLayout({ children }: { children: React.ReactNode }) {
  return <RoleWorkspace role="carrier">{children}</RoleWorkspace>;
}
