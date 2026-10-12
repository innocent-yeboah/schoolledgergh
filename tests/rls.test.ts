import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

const preamble = `
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant anon to current_user;
grant authenticated to current_user;
grant service_role to current_user;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;

describe("school ledger RLS", () => {
  it("isolates schools, derives balances, and blocks anon and forged sent logs", async () => {
    const db = new PGlite();
    const migration = readFileSync(new URL("../supabase/migrations/20261012164751_school_ledger_schema.sql", import.meta.url), "utf8");
    await db.exec(preamble);
    await db.exec(migration);

    const paid = await db.query<{ count: string }>(
      "select count(*)::text as count from information_schema.columns where table_schema = 'public' and table_name = 'students' and column_name = 'paid'",
    );
    expect(paid.rows[0].count).toBe("0");
    const secret = await db.query<{ count: string }>(
      "select count(*)::text as count from information_schema.columns where table_schema = 'public' and table_name = 'schools' and (column_name ilike '%key%' or column_name = 'sms_config')",
    );
    expect(secret.rows[0].count).toBe("0");

    const policies = await db.query<{ roles: string }>("select roles::text as roles from pg_policies where schemaname = 'public'");
    expect(policies.rows.length).toBeGreaterThan(0);
    for (const policy of policies.rows) {
      expect(policy.roles).not.toContain("anon");
      expect(policy.roles).not.toBe("{public}");
    }

    await db.exec(`
      insert into auth.users (id, email, raw_user_meta_data) values
        ('${USER_A}', 'a@school.test', '{"full_name":"Ama"}'),
        ('${USER_B}', 'b@school.test', '{"full_name":"Kojo"}');
    `);

    const schoolA = await asUser(db, USER_A, async () => {
      const inserted = await db.query<{ id: string }>(
        `insert into public.schools (user_id, name, term, academic_year)
         values ('${USER_A}', 'Ama School', 'Term 1', '2026/2027') returning id`,
      );
      const schoolId = inserted.rows[0].id;
      await db.exec(`
        insert into public.students (id, school_id, user_id, first_name, last_name, class_name, parent_name, parent_phone, term_fee)
        values ('S1', '${schoolId}', '${USER_A}', 'Kojo', 'Mensah', 'Basic 4', 'Akua', '0244000000', 400);
        insert into public.payments (id, school_id, user_id, student_id, student_name, class_name, amount, method, paid_on, txn_id)
        values ('P1', '${schoolId}', '${USER_A}', 'S1', 'Kojo Mensah', 'Basic 4', 150, 'Cash', '2026-10-01', 'SL-1');
      `);
      return schoolId;
    });

    await asUser(db, USER_A, async () => {
      const status = await db.query<{ amount_paid: string; balance: string; fee_status: string }>(
        "select amount_paid::text, balance::text, fee_status from public.student_fee_status where id = 'S1'",
      );
      expect(status.rows[0]).toEqual({ amount_paid: "150.00", balance: "250.00", fee_status: "partial" });
      await db.exec(`
        insert into public.payments (id, school_id, user_id, student_id, student_name, class_name, amount, method, paid_on, txn_id)
        values ('P2', '${schoolA}', '${USER_A}', 'S1', 'Kojo Mensah', 'Basic 4', 250, 'Cash', '2026-10-02', 'SL-2');
      `);
      const settled = await db.query<{ balance: string; fee_status: string }>(
        "select balance::text, fee_status from public.student_fee_status where id = 'S1'",
      );
      expect(settled.rows[0]).toEqual({ balance: "0.00", fee_status: "paid" });
      await expect(
        db.exec(`
          insert into public.payments (id, school_id, user_id, student_id, student_name, class_name, amount, method, paid_on, txn_id)
          values ('P3', '${schoolA}', '${USER_A}', 'S1', 'Kojo Mensah', 'Basic 4', 1, 'Cash', '2026-10-03', 'SL-3');
        `),
      ).rejects.toThrow(/outstanding balance/);
      await db.exec(`
        insert into public.message_log (school_id, user_id, channel, message_type, recipient, status)
        values ('${schoolA}', '${USER_A}', 'whatsapp', 'reminder', 'Akua', 'opened');
      `);
      await expect(
        db.exec(`
          insert into public.message_log (school_id, user_id, channel, message_type, recipient, status)
          values ('${schoolA}', '${USER_A}', 'sms', 'sms', 'Akua', 'sent');
        `),
      ).rejects.toThrow(/marked sent only by the server/);
    });

    await asUser(db, USER_B, async () => {
      const schools = await db.query("select id from public.schools");
      const students = await db.query("select id from public.students");
      const payments = await db.query("select id from public.payments");
      expect(schools.rows).toEqual([]);
      expect(students.rows).toEqual([]);
      expect(payments.rows).toEqual([]);
      await expect(
        db.exec(`
          insert into public.students (id, school_id, user_id, first_name, last_name, class_name, parent_name, parent_phone, term_fee)
          values ('S2', '${schoolA}', '${USER_B}', 'Esi', 'Boateng', 'KG 1', 'Kwame', '0555000000', 300);
        `),
      ).rejects.toThrow();
    });

    await db.exec("reset role");
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
    await db.exec("set role anon");
    await expect(db.query("select * from public.schools")).rejects.toThrow();
    await db.exec("reset role");

    await asUser(db, USER_A, async () => {
      await db.exec(`update public.profiles set is_platform_admin = true where id = '${USER_A}'`);
      const flag = await db.query<{ is_platform_admin: boolean }>(`select is_platform_admin from public.profiles where id = '${USER_A}'`);
      expect(flag.rows[0].is_platform_admin).toBe(false);
    });

    await db.close();
  });
});

async function asUser<T>(db: PGlite, userId: string, run: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`);
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}
