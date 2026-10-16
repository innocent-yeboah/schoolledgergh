import { isAllowlistedAdmin } from "@/lib/auth/admin-allowlist";
import { createServiceClient } from "@/lib/supabase/service";

export type PlatformAdminDecision = {
  admin: boolean;
  serviceConfigured: boolean;
  error?: string;
};

export async function resolvePlatformAdmin(input: {
  email: string;
  userId: string;
}): Promise<PlatformAdminDecision> {
  const service = createServiceClient();
  const serviceConfigured = Boolean(service);
  if (isAllowlistedAdmin(input.email)) return { admin: true, serviceConfigured };
  if (!service || !input.userId) return { admin: false, serviceConfigured };
  try {
    const profile = await service.from("profiles").select("is_platform_admin").eq("id", input.userId).maybeSingle();
    if (profile.error) {
      return { admin: false, serviceConfigured: true, error: profile.error.message };
    }
    return { admin: Boolean(profile.data?.is_platform_admin), serviceConfigured: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The admin role could not be checked.";
    return { admin: false, serviceConfigured: true, error: message };
  }
}
