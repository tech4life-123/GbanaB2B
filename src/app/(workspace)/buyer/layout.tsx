import { RoleWorkspace } from "@/features/workspace/role-workspace";

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return <RoleWorkspace role="buyer">{children}</RoleWorkspace>;
}
