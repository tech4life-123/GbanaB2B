import { RoleWorkspace } from "@/features/workspace/role-workspace";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <RoleWorkspace role="seller">{children}</RoleWorkspace>;
}
