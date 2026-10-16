"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ResetPasswordScreen } from "@/components/reset-password-screen";
import { friendlyAuth, hasAuthSession, PASSWORD_UPDATED_NOTICE, updatePassword } from "@/lib/auth/password-reset";
import { establishRecoverySession, parseAuthHash, parseRecoverySearch, urlWithoutRecoveryParams } from "@/lib/auth/recovery-link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    let unsubscribe = () => {};

    function goLogin(expired: boolean) {
      if (cancelled || settled) return;
      settled = true;
      router.replace(expired ? "/login?error=link_expired" : "/login");
    }

    function markReady() {
      if (cancelled || settled) return;
      settled = true;
      setReady(true);
    }

    const hash = window.location.hash;
    const search = window.location.search;
    const hashState = parseAuthHash(hash);
    const query = parseRecoverySearch(search);
    const clearRecoveryUrl = () => {
      window.history.replaceState(window.history.state, "", urlWithoutRecoveryParams(window.location.href));
    };

    if (hashState.kind === "error" || query.error !== null || query.errorDescription !== null) {
      clearRecoveryUrl();
      goLogin(true);
      return () => {
        cancelled = true;
      };
    }

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      goLogin(false);
      return () => {
        cancelled = true;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") markReady();
    });
    unsubscribe = () => data.subscription.unsubscribe();

    void (async () => {
      try {
        const result = await establishRecoverySession({
          hash,
          search,
          auth: supabase.auth,
          clearHash: clearRecoveryUrl,
        });
        if (!cancelled) clearRecoveryUrl();
        if (cancelled || settled) return;
        if (result === "ready") {
          markReady();
          return;
        }
        if (result === "expired") {
          goLogin(true);
          return;
        }
        const signedIn = await hasAuthSession();
        if (cancelled || settled) return;
        if (signedIn) markReady();
        else goLogin(false);
      } catch {
        goLogin(true);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]);

  async function onSubmit(password: string) {
    setError("");
    setPending(true);
    try {
      await updatePassword(password);
      router.push(`/app?notice=${PASSWORD_UPDATED_NOTICE}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? friendlyAuth(caught.message) : "Could not update the password.");
    } finally {
      setPending(false);
    }
  }

  return <ResetPasswordScreen error={error} pending={pending} disabled={!ready} onSubmit={onSubmit} />;
}
