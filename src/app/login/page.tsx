"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PwaRegister } from "@/components/pwa";
import { Button, Field, TextInput } from "@/components/ui";
import { suggestedAcademicPeriod } from "@/lib/academic";
import { demoModeEnabled, savePendingSchool, writeAppMode } from "@/lib/mode";
import { createClient } from "@/lib/supabase/client";
import { publicSupabaseConfig, supportWhatsApp } from "@/lib/supabase/env";

export default function LoginPage() {
  const router = useRouter();
  const configured = Boolean(publicSupabaseConfig());
  const demoEnabled = demoModeEnabled();
  const suggested = useMemo(() => suggestedAcademicPeriod(new Date()), []);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [register, setRegister] = useState({
    school: "",
    name: "",
    phone: "",
    email: "",
    password: "",
    term: suggested.term,
    year: suggested.academicYear,
  });

  async function enterDemo(kind: "school" | "admin") {
    writeAppMode(kind);
    router.push(kind === "admin" ? "/admin" : "/app");
    router.refresh();
  }

  return (
    <main className="min-h-dvh bg-[linear-gradient(160deg,#030d06,#07421f_55%,#0a5c2e)] px-4 py-8 text-ink-900">
      <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-900 text-2xl text-white">SL</div>
          <h1 className="font-display text-3xl font-semibold">SchoolLedger GH</h1>
          <p className="mt-1 font-mono text-[11px] tracking-widest text-ink-400 uppercase">School fees for Ghana</p>
        </div>
        <div className="mb-4 grid grid-cols-2 rounded-xl bg-mint-50 p-1">
          <button type="button" className={`min-h-12 rounded-lg font-semibold ${tab === "login" ? "bg-white shadow" : "text-ink-400"}`} onClick={() => setTab("login")}>Sign in</button>
          <button type="button" className={`min-h-12 rounded-lg font-semibold ${tab === "register" ? "bg-white shadow" : "text-ink-400"}`} onClick={() => setTab("register")}>Register school</button>
        </div>
        {error ? <p className="mb-3 rounded-xl bg-clay-100 px-3 py-3 text-sm text-clay-700" role="alert">{error}</p> : null}
        {notice ? <p className="mb-3 rounded-xl bg-mint-100 px-3 py-3 text-sm text-forest-900">{notice}</p> : null}
        {!configured && demoEnabled ? <p className="mb-3 rounded-xl bg-gold-100 px-3 py-3 text-sm">Live sign-in needs Supabase environment variables. Demo mode works without them.</p> : null}
        {!configured && !demoEnabled ? <p className="mb-3 rounded-xl bg-gold-100 px-3 py-3 text-sm">Live sign-in needs Supabase environment variables.</p> : null}
        {tab === "login" ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              setPending(true);
              try {
                if (!login.email || !login.password) throw new Error("Enter your email and password.");
                const supabase = createClient();
                const { error: signError } = await supabase.auth.signInWithPassword(login);
                if (signError) throw new Error(friendlyAuth(signError.message));
                writeAppMode(null);
                const response = await fetch("/api/admin/me");
                const body = (await response.json()) as { admin?: boolean };
                router.push(body.admin ? "/admin" : "/app");
                router.refresh();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Sign in failed.");
              } finally {
                setPending(false);
              }
            }}
          >
            <Field label="Email"><TextInput type="email" autoComplete="email" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} /></Field>
            <Field label="Password"><TextInput type="password" autoComplete="current-password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></Field>
            <Button type="submit" className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
          </form>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              setNotice("");
              setPending(true);
              try {
                if (!register.school || !register.name || !register.email || !register.password) {
                  throw new Error("School name, your name, email, and password are required.");
                }
                if (register.password.length < 6) throw new Error("Password must be at least 6 characters.");
                if (!register.term.trim() || !register.year.trim()) throw new Error("Enter the term and academic year.");
                const supabase = createClient();
                const { data, error: signError } = await supabase.auth.signUp({
                  email: register.email,
                  password: register.password,
                  options: { data: { full_name: register.name, phone: register.phone } },
                });
                if (signError) throw new Error(signError.message);
                const pendingSchool = {
                  name: register.school,
                  adminName: register.name,
                  phone: register.phone,
                  email: register.email,
                  term: register.term,
                  academicYear: register.year,
                };
                if (!data.session) {
                  savePendingSchool(pendingSchool);
                  setNotice("Check your email to confirm the account, then sign in. Your school details stay on this device until then.");
                  return;
                }
                const { error: insertError } = await supabase.from("schools").insert({
                  user_id: data.user?.id,
                  name: pendingSchool.name,
                  admin_name: pendingSchool.adminName,
                  phone: pendingSchool.phone,
                  email: pendingSchool.email,
                  term: pendingSchool.term,
                  academic_year: pendingSchool.academicYear,
                  class_fees: {},
                });
                if (insertError) {
                  savePendingSchool(pendingSchool);
                  throw new Error(`The account was created, but the school was not saved: ${insertError.message}`);
                }
                writeAppMode(null);
                router.push("/app");
                router.refresh();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Registration failed.");
              } finally {
                setPending(false);
              }
            }}
          >
            <Field label="School name"><TextInput value={register.school} onChange={(event) => setRegister({ ...register, school: event.target.value })} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Your name"><TextInput value={register.name} onChange={(event) => setRegister({ ...register, name: event.target.value })} /></Field>
              <Field label="Phone"><TextInput value={register.phone} onChange={(event) => setRegister({ ...register, phone: event.target.value })} /></Field>
            </div>
            <Field label="Email"><TextInput type="email" value={register.email} onChange={(event) => setRegister({ ...register, email: event.target.value })} /></Field>
            <Field label="Password"><TextInput type="password" value={register.password} onChange={(event) => setRegister({ ...register, password: event.target.value })} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Term">
                <select className="min-h-12 w-full rounded-xl border border-mint-200 px-3" value={register.term} onChange={(event) => setRegister({ ...register, term: event.target.value })}>
                  <option>Term 1</option>
                  <option>Term 2</option>
                  <option>Term 3</option>
                </select>
              </Field>
              <Field label="Academic year"><TextInput value={register.year} onChange={(event) => setRegister({ ...register, year: event.target.value })} /></Field>
            </div>
            <Button type="submit" className="w-full" disabled={pending}>{pending ? "Creating…" : "Create school account"}</Button>
          </form>
        )}
        {demoEnabled ? (
          <div className="mt-4 grid gap-2">
            <Button type="button" variant="ghost" onClick={() => enterDemo("school")}>Try the school demo</Button>
            <Button type="button" variant="ghost" onClick={() => enterDemo("admin")}>Try the admin demo</Button>
          </div>
        ) : null}
        <p className="mt-4 text-center text-sm text-ink-400">
          Need help? <a className="font-semibold text-forest-800" href={`https://wa.me/${supportWhatsApp()}`}>WhatsApp support</a>
        </p>
        <div className="mt-3 flex justify-center"><PwaRegister /></div>
      </div>
    </main>
  );
}

function friendlyAuth(message: string): string {
  if (message.includes("Invalid login credentials")) return "Incorrect email or password.";
  if (message.includes("Email not confirmed")) return "Confirm your email before signing in.";
  if (message.toLowerCase().includes("rate limit")) return "Too many attempts. Wait a few minutes and try again.";
  return message;
}
