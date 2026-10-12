import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PlatformAccess = {
  signedIn: boolean;
  admin: boolean;
  serviceConfigured: boolean;
  email: string;
  userId: string;
  error?: string;
};

export async function platformAccess(): Promise<PlatformAccess> {
  const serviceConfigured = Boolean(createServiceClient());
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { signedIn: false, admin: false, serviceConfigured, email: "", userId: "" };
    }
    const email = data.user.email?.toLowerCase() ?? "";
    const allow = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (allow.includes(email)) {
      return { signedIn: true, admin: true, serviceConfigured, email, userId: data.user.id };
    }
    const service = createServiceClient();
    if (!service) {
      return { signedIn: true, admin: false, serviceConfigured: false, email, userId: data.user.id };
    }
    const profile = await service.from("profiles").select("is_platform_admin").eq("id", data.user.id).maybeSingle();
    if (profile.error) {
      return { signedIn: true, admin: false, serviceConfigured: true, email, userId: data.user.id, error: profile.error.message };
    }
    return {
      signedIn: true,
      admin: Boolean(profile.data?.is_platform_admin),
      serviceConfigured: true,
      email,
      userId: data.user.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth is not configured.";
    return { signedIn: false, admin: false, serviceConfigured, email: "", userId: "", error: message };
  }
}
