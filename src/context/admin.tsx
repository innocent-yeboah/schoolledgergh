"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { suggestedAcademicPeriod } from "@/lib/academic";
import { readAppMode, writeAppMode } from "@/lib/mode";
import { createClient } from "@/lib/supabase/client";
import { publicSupabaseConfig } from "@/lib/supabase/env";
import type { AdminSchool } from "@/lib/types";

type AdminMode = "loading" | "demo" | "live" | "denied" | "unconfigured";

type NewAdminSchool = {
  name: string;
  adminName: string;
  phone: string;
  email: string;
  password: string;
  address: string;
  term: string;
  academicYear: string;
};

type AdminContextValue = {
  mode: AdminMode;
  schools: AdminSchool[];
  error: string | null;
  notice: string | null;
  dismiss: () => void;
  createSchool: (input: NewAdminSchool) => Promise<void>;
  deleteSchool: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);
const DEMO_KEY = "slgh.demo.admin.v1";

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mode, setMode] = useState<AdminMode>("loading");
  const [schools, setSchools] = useState<AdminSchool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const demo = readAppMode() === "demo-admin";
    fetch("/api/admin/me")
      .then(async (response) => {
        if (response.status === 401) {
          if (demo) {
            setSchools(readDemo());
            setMode("demo");
            return;
          }
          setMode("denied");
          setError("Sign in with a platform admin account.");
          return;
        }
        const body = (await response.json()) as { admin?: boolean; serviceConfigured?: boolean; error?: string };
        if (!body.admin) {
          setMode("denied");
          setError(body.error || "This account is not a platform admin.");
          return;
        }
        if (!body.serviceConfigured) {
          setMode("unconfigured");
          setError("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY on the server. School lists are not loaded with the public anon key.");
          return;
        }
        const list = await fetch("/api/admin/schools");
        const payload = (await list.json()) as { schools?: AdminSchool[]; error?: string };
        if (!list.ok) {
          setMode("unconfigured");
          setError(payload.error || "Schools could not be loaded.");
          return;
        }
        setSchools(payload.schools ?? []);
        setMode("live");
      })
      .catch(() => {
        if (demo) {
          setSchools(readDemo());
          setMode("demo");
          return;
        }
        setMode("denied");
        setError("The admin service could not be reached.");
      });
  }, []);

  const value: AdminContextValue = {
    mode,
    schools,
    error,
    notice,
    dismiss: () => {
      setError(null);
      setNotice(null);
    },
    async createSchool(input) {
      if (!input.name.trim() || !input.email.trim() || !input.term.trim() || !input.academicYear.trim()) {
        setError("School name, email, term, and academic year are required.");
        return;
      }
      if (input.password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (mode === "demo") {
        const next = [
          ...schools,
          {
            id: `demo-${Date.now()}`,
            userId: `demo-${Date.now()}`,
            name: input.name.trim(),
            adminName: input.adminName.trim(),
            phone: input.phone.trim(),
            email: input.email.trim(),
            address: input.address.trim(),
            term: input.term.trim(),
            academicYear: input.academicYear.trim(),
            studentCount: 0,
            feesCollected: 0,
            createdAt: new Date().toISOString(),
          },
        ];
        setSchools(next);
        localStorage.setItem(DEMO_KEY, JSON.stringify(next));
        setNotice(`${input.name.trim()} was added to the demo on this device. No login was created.`);
        return;
      }
      const response = await fetch("/api/admin/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "The school was not created.");
        return;
      }
      const list = await fetch("/api/admin/schools");
      const body = (await list.json()) as { schools?: AdminSchool[]; error?: string };
      if (!list.ok) {
        setError(body.error || "The school was created, but the list could not be refreshed.");
        return;
      }
      setSchools(body.schools ?? []);
      setNotice(`${input.name.trim()} was created. Share the password you typed with that school admin.`);
    },
    async deleteSchool(id) {
      if (mode === "demo") {
        const next = schools.filter((school) => school.id !== id);
        setSchools(next);
        localStorage.setItem(DEMO_KEY, JSON.stringify(next));
        setNotice("Demo school removed from this device.");
        return;
      }
      const response = await fetch(`/api/admin/schools/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string; name?: string };
      if (!response.ok) {
        setError(payload.error || "The school was not deleted.");
        return;
      }
      setSchools((current) => current.filter((school) => school.id !== id));
      setNotice(`${payload.name || "School"} was deleted.`);
    },
    async signOut() {
      writeAppMode(null);
      if (publicSupabaseConfig()) {
        try {
          await createClient().auth.signOut();
        } catch {
          // Demo sign-out only needs the cookie cleared.
        }
      }
      router.push("/login");
      router.refresh();
    },
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside the admin app.");
  return value;
}

function readDemo(): AdminSchool[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdminSchool[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Fall through to a fresh demo list.
  }
  const period = suggestedAcademicPeriod(new Date());
  const schools: AdminSchool[] = [
    {
      id: "demo-bright",
      userId: "demo-bright-user",
      name: "Bright Future Academy",
      adminName: "Adwoa Mensah",
      phone: "0244123456",
      email: "admin@brightfuture.edu.gh",
      address: "East Legon, Accra",
      term: period.term,
      academicYear: period.academicYear,
      studentCount: 6,
      feesCollected: 950,
      createdAt: new Date().toISOString(),
    },
    {
      id: "demo-harbour",
      userId: "demo-harbour-user",
      name: "Harbour View School",
      adminName: "Kwesi Annan",
      phone: "0209988776",
      email: "admin@harbourview.edu.gh",
      address: "Takoradi",
      term: period.term,
      academicYear: period.academicYear,
      studentCount: 80,
      feesCollected: 21000,
      createdAt: new Date().toISOString(),
    },
  ];
  localStorage.setItem(DEMO_KEY, JSON.stringify(schools));
  return schools;
}
