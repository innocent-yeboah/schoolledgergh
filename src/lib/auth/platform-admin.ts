import "server-only";
import { resolvePlatformAdmin } from "@/lib/auth/platform-role";
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
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const decision = await resolvePlatformAdmin({ email: "", userId: "" });
      return { signedIn: false, admin: false, serviceConfigured: decision.serviceConfigured, email: "", userId: "" };
    }
    const email = data.user.email?.toLowerCase() ?? "";
    const decision = await resolvePlatformAdmin({ email, userId: data.user.id });
    return {
      signedIn: true,
      admin: decision.admin,
      serviceConfigured: decision.serviceConfigured,
      email,
      userId: data.user.id,
      error: decision.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth is not configured.";
    const decision = await resolvePlatformAdmin({ email: "", userId: "" });
    return {
      signedIn: false,
      admin: false,
      serviceConfigured: decision.serviceConfigured,
      email: "",
      userId: "",
      error: message,
    };
  }
}
