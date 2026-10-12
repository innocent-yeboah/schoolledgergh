"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { assertAcademicPeriod } from "@/lib/academic";
import { readLastLedgerCache, writeLedgerCache } from "@/lib/data/cache";
import { LiveLedger } from "@/lib/data/live";
import { DemoLedger } from "@/lib/demo/store";
import { buildStudentViews } from "@/lib/domain";
import { errorMessage, isNetworkError } from "@/lib/format";
import { readAppMode, writeAppMode } from "@/lib/mode";
import { createClient } from "@/lib/supabase/client";
import { publicSupabaseConfig } from "@/lib/supabase/env";
import type { LedgerSnapshot, NewMessageInput, NewPaymentInput, NewSchoolInput, NewStudentInput, PaymentRecord, SchoolProfile } from "@/lib/types";

type Notice = { type: "ok" | "err"; text: string };

type LedgerContextValue = {
  ready: boolean;
  mode: "demo" | "live";
  usingCache: boolean;
  offline: boolean;
  notice: Notice | null;
  dismissNotice: () => void;
  report: (text: string, type?: Notice["type"]) => void;
  school: SchoolProfile | null;
  students: ReturnType<typeof buildStudentViews>;
  payments: LedgerSnapshot["payments"];
  feeding: LedgerSnapshot["feeding"];
  messages: LedgerSnapshot["messages"];
  refresh: () => Promise<void>;
  createSchool: (input: NewSchoolInput) => Promise<void>;
  saveSchool: (patch: Partial<SchoolProfile>) => Promise<void>;
  addStudent: (input: NewStudentInput) => Promise<void>;
  removeStudent: (id: string) => Promise<void>;
  recordPayment: (input: NewPaymentInput) => Promise<PaymentRecord>;
  markFeeding: (studentId: string, date: string) => Promise<void>;
  markAllFeeding: (date: string) => Promise<void>;
  logMessage: (input: NewMessageInput) => Promise<void>;
  resetDemo: () => void;
  signOut: () => Promise<void>;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

const emptySnapshot: LedgerSnapshot = { school: null, students: [], payments: [], feeding: [], messages: [] };

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const demoRef = useRef<DemoLedger | null>(null);
  const liveRef = useRef<LiveLedger | null>(null);
  const [mode, setMode] = useState<"demo" | "live">("live");
  const [snapshot, setSnapshot] = useState<LedgerSnapshot>(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const notify = useCallback((text: string, type: Notice["type"] = "ok") => {
    setNotice({ type, text });
  }, []);

  useEffect(() => {
    if (notice?.type !== "ok") return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const applyLive = useCallback(async (live: LiveLedger) => {
    const loaded = await live.load();
    setSnapshot(loaded.snapshot);
    writeLedgerCache(loaded.userId, loaded.snapshot);
    setUsingCache(false);
    setLoadError(null);
  }, []);

  const refresh = useCallback(async () => {
    const appMode = readAppMode();
    const session = await liveSession();
    if (appMode === "demo-school" && !session) {
      const demo = demoRef.current ?? new DemoLedger();
      demoRef.current = demo;
      setMode("demo");
      setSnapshot(demo.load());
      setUsingCache(false);
      setLoadError(null);
      setReady(true);
      return;
    }
    setMode("live");
    const live = liveRef.current ?? new LiveLedger();
    liveRef.current = live;
    try {
      await applyLive(live);
    } catch (error) {
      const cached = readLastLedgerCache();
      if (cached && (isNetworkError(error) || (typeof navigator !== "undefined" && !navigator.onLine))) {
        setSnapshot(cached.snapshot);
        setUsingCache(true);
        setLoadError(null);
        notify("You are offline. Showing the last copy saved on this device. Changes will not be stored until you reconnect.", "err");
      } else {
        setLoadError(errorMessage(error));
        notify(errorMessage(error), "err");
      }
    } finally {
      setReady(true);
    }
  }, [applyLive, notify]);

  useEffect(() => {
    // Load the ledger once the refresh callback is ready. State updates live inside refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    void refresh();
  }, [refresh]);

  function assertWritable() {
    if (mode === "live" && typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("You are offline. This change was not saved.");
    }
  }

  async function afterDemo(message: string) {
    const demo = demoRef.current;
    if (!demo) return;
    setSnapshot(demo.load());
    notify(message);
  }

  async function afterLive(message: string) {
    const live = liveRef.current;
    if (!live) return;
    try {
      await applyLive(live);
      notify(message);
    } catch (error) {
      notify(`Saved, but the screen could not refresh: ${errorMessage(error)}`, "err");
    }
  }

  const value = useMemo<LedgerContextValue>(() => {
    const students = buildStudentViews(snapshot.students, snapshot.payments);
    return {
      ready,
      mode,
      usingCache,
      offline,
      notice,
      dismissNotice: () => setNotice(null),
      report: notify,
      school: snapshot.school,
      students,
      payments: snapshot.payments,
      feeding: snapshot.feeding,
      messages: snapshot.messages,
      refresh,
      async createSchool(input) {
        assertWritable();
        assertAcademicPeriod(input.term, input.academicYear);
        if (!input.name.trim()) throw new Error("School name is required.");
        try {
          if (mode === "demo") {
            demoRef.current?.createSchool(input);
            await afterDemo("School saved on this device.");
            return;
          }
          await liveRef.current?.createSchool(input);
          await afterLive("School saved.");
        } catch (error) {
          notify(errorMessage(error), "err");
          throw error;
        }
      },
      async saveSchool(patch) {
        if (!snapshot.school) throw new Error("Create the school first.");
        const next = { ...snapshot.school, ...patch };
        assertWritable();
        assertAcademicPeriod(next.term, next.academicYear);
        try {
          if (mode === "demo") {
            demoRef.current?.saveSchool(next);
            await afterDemo("Settings saved on this device.");
            return;
          }
          await liveRef.current?.saveSchool(next);
          await afterLive("Settings saved.");
        } catch (error) {
          notify(errorMessage(error), "err");
          throw error;
        }
      },
      async addStudent(input) {
        if (!snapshot.school) throw new Error("Create the school first.");
        assertWritable();
        try {
          if (mode === "demo") {
            demoRef.current?.addStudent(input);
            await afterDemo("Student added.");
            return;
          }
          await liveRef.current?.addStudent(snapshot.school, input);
          await afterLive("Student added.");
        } catch (error) {
          notify(errorMessage(error), "err");
          throw error;
        }
      },
      async removeStudent(id) {
        if (!snapshot.school) throw new Error("Create the school first.");
        assertWritable();
        try {
          if (mode === "demo") {
            demoRef.current?.removeStudent(id);
            await afterDemo("Student removed. Their payment history is kept.");
            return;
          }
          await liveRef.current?.removeStudent(snapshot.school, id);
          await afterLive("Student removed. Their payment history is kept.");
        } catch (error) {
          notify(errorMessage(error), "err");
          throw error;
        }
      },
      async recordPayment(input) {
        if (!snapshot.school) throw new Error("Create the school first.");
        assertWritable();
        try {
          const payment =
            mode === "demo"
              ? demoRef.current!.recordPayment(input)
              : await liveRef.current!.recordPayment(snapshot.school, snapshot.students, snapshot.payments, input);
          if (mode === "demo") await afterDemo("Payment recorded.");
          else await afterLive("Payment recorded.");
          return payment;
        } catch (error) {
          notify(errorMessage(error), "err");
          throw error;
        }
      },
      async markFeeding(studentId, date) {
        if (!snapshot.school) throw new Error("Create the school first.");
        assertWritable();
        try {
          const result =
            mode === "demo"
              ? demoRef.current!.markFeeding(studentId, date)
              : await liveRef.current!.markFeeding(snapshot.school, studentId, date);
          if (mode === "demo") setSnapshot(demoRef.current!.load());
          else await applyLive(liveRef.current!);
          notify(result === "already" ? "Already marked for that day." : "Feeding fee marked.");
        } catch (error) {
          notify(errorMessage(error), "err");
          throw error;
        }
      },
      async markAllFeeding(date) {
        if (!snapshot.school) throw new Error("Create the school first.");
        assertWritable();
        try {
          if (mode === "demo") {
            const result = demoRef.current!.markAllFeeding(date);
            setSnapshot(demoRef.current!.load());
            notify(`Marked ${result.marked} students. ${result.already} were already marked.`);
            return;
          }
          let marked = 0;
          let already = 0;
          const errors: string[] = [];
          for (const student of snapshot.students) {
            try {
              const result = await liveRef.current!.markFeeding(snapshot.school, student.id, date);
              if (result === "marked") marked += 1;
              else already += 1;
            } catch (error) {
              errors.push(errorMessage(error));
            }
          }
          await applyLive(liveRef.current!);
          if (errors.length) {
            notify(`Marked ${marked}. ${errors[0]}`, "err");
            return;
          }
          notify(`Marked ${marked} students. ${already} were already marked.`);
        } catch (error) {
          notify(errorMessage(error), "err");
          throw error;
        }
      },
      async logMessage(input) {
        if (!snapshot.school) throw new Error("Create the school first.");
        assertWritable();
        try {
          if (mode === "demo") {
            demoRef.current?.logMessage(input);
            setSnapshot(demoRef.current!.load());
            return;
          }
          await liveRef.current?.logMessage(snapshot.school, input);
          await applyLive(liveRef.current!);
        } catch (error) {
          notify(errorMessage(error), "err");
          throw error;
        }
      },
      resetDemo() {
        if (mode !== "demo") return;
        demoRef.current?.reset();
        setSnapshot(demoRef.current?.load() ?? emptySnapshot);
        notify("Demo data reset on this device.");
      },
      async signOut() {
        writeAppMode(null);
        if (mode === "live" && publicSupabaseConfig()) {
          const { error } = await createClient().auth.signOut();
          if (error) {
            notify(error.message, "err");
            return;
          }
        }
        router.push("/login");
        router.refresh();
      },
    };
    // The callbacks close over the latest snapshot on each render via useMemo deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyLive, mode, notice, offline, ready, refresh, router, snapshot, usingCache, notify]);

  return (
    <LedgerContext.Provider value={value}>
      {ready && loadError && !snapshot.school ? <LoadFailure message={loadError} onRetry={() => void refresh()} /> : children}
    </LedgerContext.Provider>
  );
}

function LoadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="font-display text-3xl font-semibold">The school could not be loaded</h1>
      <p className="text-ink-700">{message}</p>
      <button type="button" className="min-h-12 rounded-xl bg-forest-800 px-4 font-semibold text-white" onClick={onRetry}>
        Try again
      </button>
    </main>
  );
}

async function liveSession(): Promise<boolean> {
  if (!publicSupabaseConfig()) return false;
  try {
    const { data } = await createClient().auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

export function useLedger(): LedgerContextValue {
  const value = useContext(LedgerContext);
  if (!value) throw new Error("useLedger must be used inside the school app.");
  return value;
}
