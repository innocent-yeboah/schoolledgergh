"use client";

import { useState, type FormEvent } from "react";
import { GyeNyame, KenteTexture, LineIcon, WhatsAppIcon, iconPath } from "@/components/login-art";
import { resetPasswordFieldErrors } from "@/lib/auth/password-reset";
import { supportWhatsApp } from "@/lib/supabase/env";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-900";

const control =
  "min-h-12 w-full rounded-xl border border-forest-900/15 bg-white pl-11 text-base text-ink-900 outline-none placeholder:text-ink-400 " +
  focusRing;

const primaryButton =
  "inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-base font-semibold text-white transition-colors hover:bg-forest-800 disabled:cursor-not-allowed disabled:bg-forest-800 disabled:text-white " +
  focusRing;

type FieldErrors = { password?: string; confirm?: string };

export function ResetPasswordScreen({
  error,
  pending,
  disabled = false,
  onSubmit,
}: {
  error: string;
  pending: boolean;
  disabled?: boolean;
  onSubmit: (password: string) => void;
}) {
  const year = new Date().getFullYear();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors = resetPasswordFieldErrors(password, confirm);
    setFieldErrors(errors);
    if (errors.password || errors.confirm) return;
    onSubmit(password);
  }

  return (
    <main className="min-h-dvh bg-[#f4f1ea] text-ink-900 lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] lg:overflow-hidden">
      <section className="sl-enter relative overflow-hidden bg-[#07421F] text-white lg:h-dvh">
        <KenteTexture />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_0%,rgba(201,162,39,0.16),transparent_42%)]" aria-hidden="true" />
        <div className="relative flex flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 sm:px-8 lg:h-full lg:justify-between lg:px-12 lg:pt-12 lg:pb-12 xl:px-16">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 font-display text-lg text-white ring-1 ring-[#C9A227]/80">
                  SL
                </span>
                <span>
                  <p className="font-display text-xl leading-none text-white">SchoolLedger GH</p>
                  <p className="mt-1 text-[11px] font-semibold tracking-[0.16em] text-[#C9A227] uppercase">School fees for Ghana</p>
                </span>
              </div>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 ring-1 ring-[#C9A227]/40 lg:hidden">
                <GyeNyame className="h-9 w-9 text-[#C9A227]" />
              </span>
            </div>
            <h1 className="mt-5 max-w-xl font-display text-[1.7rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl lg:mt-10 lg:text-[2.7rem] lg:leading-[1.12]">
              Choose a new password for your school.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#e7f2eb] lg:text-base">
              Use at least 8 characters. After it saves, you return to your school.
            </p>
          </div>
          <div className="mt-6 hidden border-t border-white/15 pt-4 lg:mt-0 lg:block lg:max-w-lg">
            <p className="flex items-center gap-2 text-sm font-medium text-white">
              <LineIcon d={iconPath.pin} className="h-4 w-4 text-[#C9A227]" />
              Built in Accra for Ghanaian schools
            </p>
            <p className="mt-2 flex items-start gap-2 text-sm leading-snug text-[#d7e8dc]">
              <LineIcon d={iconPath.shield} className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A227]" />
              Bank-grade encryption · Your school&apos;s data stays private
            </p>
          </div>
          <GyeNyame className="pointer-events-none absolute top-64 right-12 hidden h-28 w-28 text-[#C9A227] xl:block" />
        </div>
      </section>

      <section className="sl-enter sl-enter-late relative z-10 -mt-3 flex flex-col rounded-t-[1.75rem] bg-[#f4f1ea] px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:mt-0 lg:h-dvh lg:justify-center lg:overflow-y-auto lg:rounded-none lg:px-10 lg:py-10 xl:px-14">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="rounded-2xl border border-[#07421F]/10 bg-white shadow-[0_24px_60px_-32px_rgba(7,66,31,0.55)]">
            <div className="h-1 rounded-t-2xl bg-gradient-to-r from-[#07421F] via-[#C9A227] to-[#07421F]" aria-hidden="true" />
            <div className="p-4 sm:p-7">
              {error ? (
                <p id="form-error" tabIndex={-1} role="alert" className="mb-4 rounded-xl border border-clay-700/20 bg-clay-100 px-3 py-2.5 text-sm text-clay-700 outline-none">
                  {error}
                </p>
              ) : null}
              <form onSubmit={handleSubmit} noValidate aria-busy={pending || disabled}>
                <h2 className="font-display text-2xl font-semibold text-ink-900">Set a new password</h2>
                <p className="mt-2 mb-5 text-sm leading-relaxed text-ink-700">
                  Enter it twice. It must be at least 8 characters.
                </p>
                <PasswordField
                  id="new-password"
                  label="New password"
                  autoComplete="new-password"
                  value={password}
                  shown={showPassword}
                  error={fieldErrors.password}
                  hint={fieldErrors.password ? undefined : "At least 8 characters."}
                  toggleLabel={showPassword ? "Hide new password" : "Show new password"}
                  onToggle={() => setShowPassword((current) => !current)}
                  onChange={(value) => {
                    setPassword(value);
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                  }}
                />
                <PasswordField
                  id="confirm-password"
                  label="Confirm password"
                  autoComplete="new-password"
                  value={confirm}
                  shown={showConfirm}
                  error={fieldErrors.confirm}
                  toggleLabel={showConfirm ? "Hide password confirmation" : "Show password confirmation"}
                  onToggle={() => setShowConfirm((current) => !current)}
                  onChange={(value) => {
                    setConfirm(value);
                    setFieldErrors((current) => ({ ...current, confirm: undefined }));
                  }}
                />
                <button type="submit" className={primaryButton} disabled={pending || disabled}>
                  {pending ? <Spinner /> : null}
                  {pending ? "Saving…" : "Save new password"}
                </button>
              </form>
            </div>
          </div>
          <a className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#07421F]/15 bg-white px-4 text-sm font-semibold text-[#07421F] shadow-sm ${focusRing}`} href={`https://wa.me/${supportWhatsApp()}`} target="_blank" rel="noreferrer noopener">
            <WhatsAppIcon />
            Need help? WhatsApp support
            <span className="sr-only">, opens in a new tab</span>
          </a>
          <footer className="mt-5 text-center text-sm text-ink-700">
            <p>© {year} SchoolLedger GH</p>
          </footer>
        </div>
      </section>
    </main>
  );
}

function PasswordField({
  id,
  label,
  value,
  shown,
  error,
  hint,
  toggleLabel,
  autoComplete,
  onToggle,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  shown: boolean;
  error?: string;
  hint?: string;
  toggleLabel: string;
  autoComplete: string;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-900">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#07421F]">
          <LineIcon d={iconPath.lock} />
        </span>
        <input
          id={id}
          name={id}
          type={shown ? "text" : "password"}
          minLength={8}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${control} pr-12`}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className={`absolute inset-y-1 right-1 flex w-11 cursor-pointer items-center justify-center rounded-lg text-[#07421F] ${focusRing}`}
          aria-pressed={shown}
          aria-controls={id}
          aria-label={toggleLabel}
          onClick={onToggle}
        >
          <LineIcon d={shown ? iconPath.eyeOff : iconPath.eye} />
        </button>
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-clay-700">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="mt-1.5 text-sm text-ink-700">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none" aria-hidden="true" />;
}
