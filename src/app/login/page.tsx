"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { GyeNyame, KenteTexture, LineIcon, WhatsAppIcon, iconPath } from "@/components/login-art";
import { PwaRegister } from "@/components/pwa";
import { suggestedAcademicPeriod } from "@/lib/academic";
import { friendlyAuth, sendPasswordReset } from "@/lib/auth/password-reset";
import { demoModeEnabled, savePendingSchool, writeAppMode } from "@/lib/mode";
import { createClient } from "@/lib/supabase/client";
import { publicSupabaseConfig, supportWhatsApp } from "@/lib/supabase/env";

type Tab = "login" | "register";
type View = "auth" | "forgot";
type FieldErrors = Record<string, string>;

const BENEFITS = [
  {
    title: "Mobile Money and Paystack payments",
    detail: "MTN MoMo, Telecel Cash, and AirtelTigo Money",
    icon: iconPath.phone,
  },
  {
    title: "Automatic SMS reminders to parents",
    detail: "A text when a balance is still open",
    icon: iconPath.message,
  },
  {
    title: "Real-time balances in GH₵",
    detail: "Paid and owing, updated as payments land",
    icon: iconPath.coins,
  },
  {
    title: "Receipts for every payment",
    detail: "Cash, MoMo, and bank transfers, each with a record",
    icon: iconPath.receipt,
  },
] as const;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-900";

const control =
  "min-h-12 w-full rounded-xl border border-forest-900/15 bg-white pl-11 text-base text-ink-900 outline-none placeholder:text-ink-400 " + focusRing;

const primaryButton =
  "inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-base font-semibold text-white transition-colors hover:bg-forest-800 disabled:cursor-not-allowed disabled:bg-forest-800 disabled:text-white " +
  focusRing;

const secondaryButton =
  "inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-forest-900/15 bg-white px-4 text-sm font-semibold text-forest-900 shadow-sm transition-colors hover:bg-mint-50 " +
  focusRing;

export default function LoginPage() {
  const router = useRouter();
  const configured = Boolean(publicSupabaseConfig());
  const demoEnabled = demoModeEnabled();
  const suggested = useMemo(() => suggestedAcademicPeriod(new Date()), []);
  const year = new Date().getFullYear();
  const [tab, setTab] = useState<Tab>("login");
  const [view, setView] = useState<View>("auth");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [resetEmail, setResetEmail] = useState("");
  const [register, setRegister] = useState({
    school: "",
    name: "",
    phone: "",
    email: "",
    password: "",
    term: suggested.term,
    year: suggested.academicYear,
  });
  const loginTabRef = useRef<HTMLButtonElement>(null);
  const registerTabRef = useRef<HTMLButtonElement>(null);
  const focusId = useRef<string | null>(null);

  useEffect(() => {
    if (!focusId.current) return;
    const node = document.getElementById(focusId.current);
    focusId.current = null;
    node?.focus();
  }, [error, fieldErrors, notice, view, tab]);

  function focusSoon(id: string) {
    focusId.current = id;
  }

  function clearStatus() {
    setError("");
    setNotice("");
    setFieldErrors({});
  }

  function chooseTab(next: Tab) {
    setTab(next);
    setView("auth");
    clearStatus();
  }

  function onTabListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const order: Tab[] = ["login", "register"];
    const index = order.indexOf(tab);
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = Math.min(index + 1, order.length - 1);
    else if (event.key === "ArrowLeft") nextIndex = Math.max(index - 1, 0);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = order.length - 1;
    else return;
    event.preventDefault();
    const next = order[nextIndex];
    chooseTab(next);
    (next === "login" ? loginTabRef : registerTabRef).current?.focus();
  }

  async function enterDemo(kind: "school" | "admin") {
    writeAppMode(kind);
    router.push(kind === "admin" ? "/admin" : "/app");
    router.refresh();
  }

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    clearStatus();
    const email = login.email.trim();
    const errors = loginFieldErrors(email, login.password);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusSoon(errors.email ? "login-email" : "login-password");
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({ email, password: login.password });
      if (signError) throw new Error(friendlyAuth(signError.message));
      writeAppMode(null);
      const response = await fetch("/api/admin/me");
      const body = (await response.json()) as { admin?: boolean };
      router.push(body.admin ? "/admin" : "/app");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? friendlyAuth(caught.message) : "Sign in failed.");
      focusSoon("form-error");
    } finally {
      setPending(false);
    }
  }

  async function onRegister(event: FormEvent) {
    event.preventDefault();
    clearStatus();
    const errors = registerFieldErrors(register);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusSoon(firstRegisterErrorId(errors));
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const { data, error: signError } = await supabase.auth.signUp({
        email: register.email.trim(),
        password: register.password,
        options: { data: { full_name: register.name, phone: register.phone } },
      });
      if (signError) throw new Error(signError.message);
      const pendingSchool = {
        name: register.school,
        adminName: register.name,
        phone: register.phone,
        email: register.email.trim(),
        term: register.term,
        academicYear: register.year,
      };
      if (!data.session) {
        savePendingSchool(pendingSchool);
        setNotice("Check your email to confirm the account, then sign in. Your school details stay on this device until then.");
        focusSoon("form-notice");
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
      focusSoon("form-error");
    } finally {
      setPending(false);
    }
  }

  async function onForgot(event: FormEvent) {
    event.preventDefault();
    clearStatus();
    const email = resetEmail.trim();
    if (!email) {
      setFieldErrors({ email: "Enter your email." });
      focusSoon("reset-email");
      return;
    }
    if (!emailLooksValid(email)) {
      setFieldErrors({ email: "Enter a valid email address." });
      focusSoon("reset-email");
      return;
    }
    setPending(true);
    try {
      await sendPasswordReset(email, window.location.origin);
      setNotice("Check your email for a reset link. Open it on this device. It brings you back to SchoolLedger.");
      focusSoon("form-notice");
    } catch (caught) {
      setError(caught instanceof Error ? friendlyAuth(caught.message) : "Could not send the reset email.");
      focusSoon("form-error");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#f4f1ea] text-ink-900 lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] lg:overflow-hidden">
      <section className="sl-enter relative overflow-hidden bg-forest-900 text-white lg:h-dvh">
        <KenteTexture />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_0%,rgba(201,162,39,0.16),transparent_42%)]" aria-hidden="true" />
        <div className="relative flex flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 sm:px-8 lg:h-full lg:justify-between lg:px-12 lg:pt-12 lg:pb-12 xl:px-16">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 font-display text-lg text-white ring-1 ring-gold-500/80">
                  SL
                </span>
                <span>
                  <p className="font-display text-xl leading-none text-white">SchoolLedger GH</p>
                  <p className="mt-1 text-[11px] font-semibold tracking-[0.16em] text-gold-500 uppercase">School fees for Ghana</p>
                </span>
              </div>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 ring-1 ring-gold-500/40 lg:hidden">
                <GyeNyame className="h-9 w-9 text-gold-500" />
              </span>
            </div>
            <h1 className="mt-5 max-w-xl font-display text-[1.7rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl lg:mt-10 lg:text-[2.7rem] lg:leading-[1.12]">
              School fees, collected and tracked, <span className="whitespace-nowrap">without the stress.</span>
            </h1>
            <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-[#e7f2eb] lg:block lg:text-base">
              Parents pay with Mobile Money. The office sees every cedi as it lands.
            </p>
            <p className="mt-3 text-sm font-medium text-gold-500 lg:hidden">MTN MoMo, Telecel Cash, and AirtelTigo Money</p>
          </div>

          <div className="mt-6 lg:mt-0">
            <ul className="hidden max-w-lg grid-cols-1 gap-4 lg:grid">
              {BENEFITS.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-500 ring-1 ring-gold-500/40">
                    <LineIcon d={item.icon} className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm leading-snug font-semibold text-white">{item.title}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-[#d7e8dc]">{item.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-white/15 pt-4 lg:mt-8 lg:max-w-lg">
              <p className="flex items-center gap-2 text-sm font-medium text-white">
                <LineIcon d={iconPath.pin} className="h-4 w-4 text-gold-500" />
                Built in Accra for Ghanaian schools
              </p>
              <p className="mt-2 flex items-start gap-2 text-sm leading-snug text-[#d7e8dc]">
                <LineIcon d={iconPath.shield} className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                {"Bank-grade encryption · Your school's data stays private"}
              </p>
            </div>
          </div>
          <GyeNyame className="pointer-events-none absolute top-64 right-12 hidden h-28 w-28 text-gold-500 xl:block" />
        </div>
      </section>

      <section className="sl-enter sl-enter-late relative z-10 -mt-3 flex flex-col rounded-t-[1.75rem] bg-[#f4f1ea] px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:mt-0 lg:h-dvh lg:justify-center lg:overflow-y-auto lg:rounded-none lg:px-10 lg:py-10 xl:px-14">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="rounded-2xl border border-forest-900/10 bg-white shadow-[0_24px_60px_-32px_rgba(7,66,31,0.55)]">
            <div className="h-1 rounded-t-2xl bg-gradient-to-r from-forest-900 via-gold-500 to-forest-900" aria-hidden="true" />
            <div className="p-4 sm:p-7">
              {error ? (
                <p id="form-error" tabIndex={-1} role="alert" className="mb-4 rounded-xl border border-clay-700/20 bg-clay-100 px-3 py-2.5 text-sm text-clay-700 outline-none">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p id="form-notice" tabIndex={-1} role="status" className="mb-4 rounded-xl border border-forest-900/10 bg-mint-100 px-3 py-2.5 text-sm text-forest-900 outline-none">
                  {notice}
                </p>
              ) : null}
              {!configured && demoEnabled ? (
                <p className="mb-4 rounded-xl border border-[#e6d3a1] bg-gold-100 px-3 py-2.5 text-sm leading-relaxed text-ink-900" role="status">
                  Live sign-in needs Supabase environment variables. Demo mode works without them.
                </p>
              ) : null}
              {!configured && !demoEnabled ? (
                <p className="mb-4 rounded-xl border border-[#e6d3a1] bg-gold-100 px-3 py-2.5 text-sm leading-relaxed text-ink-900" role="status">
                  Live sign-in needs Supabase environment variables.
                </p>
              ) : null}

              {view === "forgot" ? (
                <form onSubmit={onForgot} noValidate aria-busy={pending}>
                  <h2 className="font-display text-2xl font-semibold text-ink-900">Reset your password</h2>
                  <p className="mt-2 mb-5 text-sm leading-relaxed text-ink-700">
                    Enter the email on the school account. We will send a link that returns here.
                  </p>
                  <TextField
                    id="reset-email"
                    label="Email"
                    type="email"
                    icon={iconPath.mail}
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={resetEmail}
                    error={fieldErrors.email}
                    onChange={(event) => {
                      setResetEmail(event.target.value);
                      setFieldErrors((current) => ({ ...current, email: "" }));
                    }}
                  />
                  <button type="submit" className={primaryButton} disabled={pending}>
                    {pending ? <Spinner /> : null}
                    {pending ? "Sending…" : "Send reset link"}
                  </button>
                  <button
                    type="button"
                    className={`mt-3 ${secondaryButton}`}
                    onClick={() => {
                      setView("auth");
                      clearStatus();
                    }}
                  >
                    Back to sign in
                  </button>
                </form>
              ) : (
                <>
                  <div
                    role="tablist"
                    aria-label="Account"
                    className="relative mb-4 grid grid-cols-2 rounded-xl bg-mint-50 p-1 ring-1 ring-forest-900/10"
                    onKeyDown={onTabListKeyDown}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm ring-1 ring-forest-900/5 transition-transform duration-200 ease-out motion-reduce:transition-none"
                      style={{ transform: tab === "register" ? "translateX(100%)" : "translateX(0)" }}
                    />
                    <button
                      ref={loginTabRef}
                      id="tab-login"
                      type="button"
                      role="tab"
                      aria-selected={tab === "login"}
                      aria-controls="panel-login"
                      tabIndex={tab === "login" ? 0 : -1}
                      className={`relative z-10 min-h-11 cursor-pointer rounded-lg text-sm font-semibold ${tab === "login" ? "text-forest-900" : "text-ink-700"} ${focusRing}`}
                      onClick={() => chooseTab("login")}
                    >
                      Sign in
                    </button>
                    <button
                      ref={registerTabRef}
                      id="tab-register"
                      type="button"
                      role="tab"
                      aria-selected={tab === "register"}
                      aria-controls="panel-register"
                      tabIndex={tab === "register" ? 0 : -1}
                      className={`relative z-10 min-h-11 cursor-pointer rounded-lg text-sm font-semibold ${tab === "register" ? "text-forest-900" : "text-ink-700"} ${focusRing}`}
                      onClick={() => chooseTab("register")}
                    >
                      Register school
                    </button>
                  </div>

                  {tab === "login" ? (
                    <form id="panel-login" role="tabpanel" aria-labelledby="tab-login" onSubmit={onLogin} noValidate aria-busy={pending}>
                      <TextField
                        id="login-email"
                        label="Email"
                        type="email"
                        icon={iconPath.mail}
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        name="email"
                        value={login.email}
                        error={fieldErrors.email}
                        onChange={(event) => {
                          setLogin({ ...login, email: event.target.value });
                          setFieldErrors((current) => ({ ...current, email: "" }));
                        }}
                      />
                      <TextField
                        id="login-password"
                        label="Password"
                        type={showLoginPassword ? "text" : "password"}
                        icon={iconPath.lock}
                        autoComplete="current-password"
                        name="password"
                        value={login.password}
                        error={fieldErrors.password}
                        trailing={
                          <PasswordToggle
                            shown={showLoginPassword}
                            controls="login-password"
                            onClick={() => setShowLoginPassword((current) => !current)}
                          />
                        }
                        onChange={(event) => {
                          setLogin({ ...login, password: event.target.value });
                          setFieldErrors((current) => ({ ...current, password: "" }));
                        }}
                      />
                      <div className="-mt-1 mb-2 flex justify-end">
                        <a
                          href="#forgot-password"
                          className={`inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-forest-900 underline-offset-4 hover:underline ${focusRing}`}
                          onClick={(event) => {
                            event.preventDefault();
                            setResetEmail(login.email);
                            setView("forgot");
                            clearStatus();
                          }}
                        >
                          Forgot password?
                        </a>
                      </div>
                      <button type="submit" className={primaryButton} disabled={pending}>
                        {pending ? <Spinner /> : null}
                        {pending ? "Signing in…" : "Sign in"}
                      </button>
                    </form>
                  ) : (
                    <form id="panel-register" role="tabpanel" aria-labelledby="tab-register" onSubmit={onRegister} noValidate aria-busy={pending}>
                      <TextField
                        id="register-school"
                        label="School name"
                        icon={iconPath.school}
                        autoComplete="organization"
                        name="organization"
                        value={register.school}
                        error={fieldErrors.school}
                        onChange={(event) => {
                          setRegister({ ...register, school: event.target.value });
                          setFieldErrors((current) => ({ ...current, school: "" }));
                        }}
                      />
                      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                        <TextField
                          id="register-name"
                          label="Your name"
                          icon={iconPath.user}
                          autoComplete="name"
                          name="name"
                          value={register.name}
                          error={fieldErrors.name}
                          onChange={(event) => {
                            setRegister({ ...register, name: event.target.value });
                            setFieldErrors((current) => ({ ...current, name: "" }));
                          }}
                        />
                        <TextField
                          id="register-phone"
                          label="Phone"
                          type="tel"
                          icon={iconPath.phone}
                          autoComplete="tel"
                          inputMode="tel"
                          name="tel"
                          value={register.phone}
                          error={fieldErrors.phone}
                          onChange={(event) => setRegister({ ...register, phone: event.target.value })}
                        />
                      </div>
                      <TextField
                        id="register-email"
                        label="Email"
                        type="email"
                        icon={iconPath.mail}
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        name="email"
                        value={register.email}
                        error={fieldErrors.email}
                        onChange={(event) => {
                          setRegister({ ...register, email: event.target.value });
                          setFieldErrors((current) => ({ ...current, email: "" }));
                        }}
                      />
                      <TextField
                        id="register-password"
                        label="Password"
                        type={showRegisterPassword ? "text" : "password"}
                        icon={iconPath.lock}
                        autoComplete="new-password"
                        name="new-password"
                        value={register.password}
                        error={fieldErrors.password}
                        trailing={
                          <PasswordToggle
                            shown={showRegisterPassword}
                            controls="register-password"
                            onClick={() => setShowRegisterPassword((current) => !current)}
                          />
                        }
                        onChange={(event) => {
                          setRegister({ ...register, password: event.target.value });
                          setFieldErrors((current) => ({ ...current, password: "" }));
                        }}
                      />
                      <div className="grid grid-cols-2 gap-x-3">
                        <SelectField
                          id="register-term"
                          label="Term"
                          icon={iconPath.calendar}
                          value={register.term}
                          error={fieldErrors.term}
                          onChange={(event) => setRegister({ ...register, term: event.target.value })}
                        >
                          <option>Term 1</option>
                          <option>Term 2</option>
                          <option>Term 3</option>
                        </SelectField>
                        <TextField
                          id="register-year"
                          label="Academic year"
                          icon={iconPath.calendar}
                          autoComplete="off"
                          value={register.year}
                          error={fieldErrors.year}
                          onChange={(event) => {
                            setRegister({ ...register, year: event.target.value });
                            setFieldErrors((current) => ({ ...current, year: "" }));
                          }}
                        />
                      </div>
                      <button type="submit" className={primaryButton} disabled={pending}>
                        {pending ? <Spinner /> : null}
                        {pending ? "Creating…" : "Create school account"}
                      </button>
                    </form>
                  )}
                </>
              )}

              {demoEnabled && view === "auth" ? (
                <div className="mt-4 grid gap-2 border-t border-forest-900/10 pt-4">
                  <button type="button" className={secondaryButton} onClick={() => enterDemo("school")}>
                    Try the school demo
                  </button>
                  <button type="button" className={secondaryButton} onClick={() => enterDemo("admin")}>
                    Try the admin demo
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <a className={`mt-4 ${secondaryButton}`} href={`https://wa.me/${supportWhatsApp()}`} target="_blank" rel="noreferrer noopener">
            <WhatsAppIcon />
            Need help? WhatsApp support
            <span className="sr-only">, opens in a new tab</span>
          </a>
          <ul className="mt-6 grid gap-2.5 lg:hidden">
            {BENEFITS.map((item) => (
              <li key={item.title} className="flex items-center gap-3 rounded-2xl border border-forest-900/10 bg-white px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-100 text-forest-900">
                  <LineIcon d={item.icon} className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-ink-900">{item.title}</span>
              </li>
            ))}
          </ul>
          <footer className="mt-5 text-center text-sm text-ink-700">
            <p>© {year} SchoolLedger GH</p>
            <p className="mt-1 flex items-center justify-center gap-3">
              <a href="#" className={`rounded-sm font-semibold text-forest-900 underline-offset-4 hover:underline ${focusRing}`}>
                Privacy
              </a>
              <span aria-hidden="true">·</span>
              <a href="#" className={`rounded-sm font-semibold text-forest-900 underline-offset-4 hover:underline ${focusRing}`}>
                Terms
              </a>
            </p>
          </footer>
          <div className="mt-3 flex justify-center">
            <PwaRegister />
          </div>
        </div>
      </section>
    </main>
  );
}

function loginFieldErrors(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email) errors.email = "Enter your email.";
  else if (!emailLooksValid(email)) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

function registerFieldErrors(register: { school: string; name: string; email: string; password: string; term: string; year: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!register.school.trim()) errors.school = "Enter the school name.";
  if (!register.name.trim()) errors.name = "Enter your name.";
  if (!register.email.trim()) errors.email = "Enter your email.";
  else if (!emailLooksValid(register.email)) errors.email = "Enter a valid email address.";
  if (!register.password) errors.password = "Enter a password.";
  else if (register.password.length < 6) errors.password = "Password must be at least 6 characters.";
  if (!register.term.trim()) errors.term = "Enter the term.";
  if (!register.year.trim()) errors.year = "Enter the academic year.";
  return errors;
}

function firstRegisterErrorId(errors: FieldErrors): string {
  const order = [
    ["school", "register-school"],
    ["name", "register-name"],
    ["email", "register-email"],
    ["password", "register-password"],
    ["term", "register-term"],
    ["year", "register-year"],
  ] as const;
  for (const [key, id] of order) {
    if (errors[key]) return id;
  }
  return "register-school";
}

function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none" aria-hidden="true" />;
}

function PasswordToggle({ shown, controls, onClick }: { shown: boolean; controls: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`absolute inset-y-1 right-1 flex w-11 cursor-pointer items-center justify-center rounded-lg text-forest-900 ${focusRing}`}
      aria-pressed={shown}
      aria-controls={controls}
      aria-label={shown ? "Hide password" : "Show password"}
      onClick={onClick}
    >
      <LineIcon d={shown ? iconPath.eyeOff : iconPath.eye} />
    </button>
  );
}

function TextField({
  id,
  label,
  error,
  icon,
  trailing,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  icon: string;
  trailing?: ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-900">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-forest-800">
          <LineIcon d={icon} />
        </span>
        <input
          {...props}
          id={id}
          required={props.required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${control} ${trailing ? "pr-12" : "pr-3"} ${className ?? ""}`}
        />
        {trailing}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-clay-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  error,
  icon,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: string; error?: string; icon: string; children: ReactNode }) {
  const errorId = `${id}-error`;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-900">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-forest-800">
          <LineIcon d={icon} />
        </span>
        <select
          {...props}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${control} appearance-none pr-10`}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-forest-800">
          <LineIcon d={iconPath.chevron} className="h-4 w-4" />
        </span>
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-clay-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
