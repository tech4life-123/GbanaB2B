import { RoleWorkspace } from "@/features/workspace/role-workspace";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleWorkspace role="admin">{children}</RoleWorkspace>;
}
