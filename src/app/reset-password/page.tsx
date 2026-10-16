"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ResetPasswordScreen } from "@/components/reset-password-screen";
import { friendlyAuth, hasAuthSession, PASSWORD_UPDATED_NOTICE, updatePassword } from "@/lib/auth/password-reset";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const signedIn = await hasAuthSession();
      if (cancelled) return;
      if (!signedIn) {
        router.replace("/login");
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
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
