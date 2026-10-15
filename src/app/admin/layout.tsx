import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AdminProvider } from "@/context/admin";
import { decideRedirect } from "@/lib/auth/redirect";
import { platformAccess } from "@/lib/auth/platform-admin";
import { activeDemoCookie } from "@/lib/mode";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [access, cookieStore] = await Promise.all([platformAccess(), cookies()]);
  const demo = activeDemoCookie(cookieStore.get("slgh_mode")?.value);
  const redirectTo = decideRedirect({
    pathname: "/admin",
    demo,
    signedIn: access.signedIn,
    supabaseConfigured: true,
    admin: access.admin,
  });
  if (redirectTo) redirect(redirectTo);

  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
