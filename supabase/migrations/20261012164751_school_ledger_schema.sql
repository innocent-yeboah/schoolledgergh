-- SchoolLedger GH schema and row level security.
--
-- Apply this to a NEW Supabase project. Do not run it against the live
-- production database: it does not migrate the old single-file app's columns,
-- and this change set never connects to production.
-- If the old tables already exist, CREATE TABLE fails and stops before any
-- data is rewritten. There are no DROP or DELETE statements in this file.
--
-- Access model:
--   * authenticated school admins can read and write only their own school
--   * the anon key has no policies and no table grants
--   * platform-wide reads use the server secret key, which bypasses RLS
--   * a student's balance is not stored; student_fee_status derives it from payments
--   * SMS provider keys are not columns on schools
--   * message_log.status = 'sent' can be inserted only by the server roles

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.freeze_admin_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if current_user not in ('postgres', 'supabase_admin', 'service_role') then
      new.is_platform_admin := false;
    end if;
  elsif tg_op = 'UPDATE' then
    if current_user not in ('postgres', 'supabase_admin', 'service_role') then
      new.is_platform_admin := old.is_platform_admin;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.reject_overpayment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  fee numeric;
  already numeric;
begin
  if new.student_id is null then
    raise exception 'A payment must belong to a student';
  end if;

  select s.term_fee
    into fee
  from public.students s
  where s.id = new.student_id;

  if fee is null then
    raise exception 'Student not found';
  end if;

  select coalesce(sum(p.amount), 0)
    into already
  from public.payments p
  where p.student_id = new.student_id;

  if already + new.amount > fee + 0.001 then
    raise exception 'Payment exceeds the outstanding balance';
  end if;

  return new;
end;
$$;

create or replace function private.guard_message_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'sent' and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'A message can be marked sent only by the server after the provider accepts it';
  end if;
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.freeze_admin_flag() from public, anon, authenticated;
revoke all on function private.reject_overpayment() from public, anon, authenticated;
revoke all on function private.guard_message_status() from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default pg_catalog.now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  admin_name text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  motto text not null default '',
  term text not null,
  academic_year text not null,
  feeding_fee numeric(12, 2) not null default 15,
  class_fees jsonb not null default '{}'::jsonb,
  tpl_payment text not null default '',
  tpl_reminder text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint schools_name_len check (char_length(btrim(name)) between 1 and 160),
  constraint schools_term_len check (char_length(btrim(term)) between 1 and 40),
  constraint schools_year_len check (char_length(btrim(academic_year)) between 1 and 32),
  constraint schools_feeding_fee_nonnegative check (feeding_fee >= 0)
);

comment on table public.schools is
  'One school per login. SMS provider secrets are not stored in this table.';

create table public.students (
  id text primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  class_name text not null,
  gender text not null default '',
  parent_name text not null,
  parent_phone text not null,
  parent_email text not null default '',
  term_fee numeric(12, 2) not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint students_name check (
    char_length(btrim(first_name)) > 0 and char_length(btrim(last_name)) > 0
  ),
  constraint students_term_fee_nonnegative check (term_fee >= 0)
);

comment on table public.students is
  'Enrolment only. Amount paid and balance are derived from public.payments.';

create table public.payments (
  id text primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id text references public.students (id) on delete set null,
  student_name text not null,
  class_name text not null,
  amount numeric(12, 2) not null,
  method text not null,
  paid_on date not null,
  txn_id text not null,
  notes text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  constraint payments_amount_positive check (amount > 0),
  constraint payments_txn_unique unique (school_id, txn_id)
);

comment on table public.payments is
  'Append-only fee ledger. Current balances are the sum of these rows.';

create table public.feeding_marks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id text not null references public.students (id) on delete cascade,
  feed_date date not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint feeding_once unique (student_id, feed_date)
);

create table public.message_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null,
  message_type text not null,
  recipient text not null default '',
  student_label text not null default '',
  txn_id text not null default '',
  status text not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint message_log_channel check (channel in ('whatsapp', 'sms', 'email')),
  constraint message_log_status check (status in ('opened', 'sent', 'failed'))
);

create index students_user_id_idx on public.students (user_id);
create index students_school_id_idx on public.students (school_id);
create index payments_user_id_idx on public.payments (user_id);
create index payments_student_id_idx on public.payments (student_id);
create index payments_school_paid_idx on public.payments (school_id, paid_on desc);
create index feeding_user_date_idx on public.feeding_marks (user_id, feed_date);
create index message_log_user_created_idx on public.message_log (user_id, created_at desc);

create trigger profiles_freeze_admin
  before insert or update on public.profiles
  for each row execute function private.freeze_admin_flag();

create trigger schools_touch_updated_at
  before update on public.schools
  for each row execute function private.touch_updated_at();

create trigger students_touch_updated_at
  before update on public.students
  for each row execute function private.touch_updated_at();

create trigger payments_reject_overpayment
  before insert on public.payments
  for each row execute function private.reject_overpayment();

create trigger message_log_guard_status
  before insert on public.message_log
  for each row execute function private.guard_message_status();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create view public.student_fee_status
with (security_invoker = true) as
select
  s.id,
  s.school_id,
  s.user_id,
  s.first_name,
  s.last_name,
  s.class_name,
  s.gender,
  s.parent_name,
  s.parent_phone,
  s.parent_email,
  s.term_fee,
  coalesce(pay.amount_paid, 0)::numeric(12, 2) as amount_paid,
  (s.term_fee - coalesce(pay.amount_paid, 0))::numeric(12, 2) as balance,
  case
    when coalesce(pay.amount_paid, 0) <= 0 then 'owing'
    when coalesce(pay.amount_paid, 0) + 0.001 < s.term_fee then 'partial'
    else 'paid'
  end as fee_status
from public.students s
left join (
  select p.student_id, sum(p.amount) as amount_paid
  from public.payments p
  group by p.student_id
) pay on pay.student_id = s.id;

comment on view public.student_fee_status is
  'Per-student fee position. security_invoker keeps the underlying RLS in force.';

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.students enable row level security;
alter table public.payments enable row level security;
alter table public.feeding_marks enable row level security;
alter table public.message_log enable row level security;

alter table public.profiles force row level security;
alter table public.schools force row level security;
alter table public.students force row level security;
alter table public.payments force row level security;
alter table public.feeding_marks force row level security;
alter table public.message_log force row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.schools from anon, authenticated;
revoke all on table public.students from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.feeding_marks from anon, authenticated;
revoke all on table public.message_log from anon, authenticated;
revoke all on table public.student_fee_status from anon, authenticated, public;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.schools to authenticated;
grant select, insert, update, delete on table public.students to authenticated;
grant select, insert on table public.payments to authenticated;
grant select, insert on table public.feeding_marks to authenticated;
grant select, insert on table public.message_log to authenticated;
grant select on table public.student_fee_status to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.schools to service_role;
grant all on table public.students to service_role;
grant all on table public.payments to service_role;
grant all on table public.feeding_marks to service_role;
grant all on table public.message_log to service_role;
grant select on table public.student_fee_status to service_role;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy schools_select_own on public.schools
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy schools_insert_own on public.schools
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy schools_update_own on public.schools
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy students_select_own on public.students
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.schools s
      where s.id = students.school_id and s.user_id = (select auth.uid())
    )
  );

create policy students_insert_own on public.students
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.schools s
      where s.id = school_id and s.user_id = (select auth.uid())
    )
  );

create policy students_update_own on public.students
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.schools s
      where s.id = school_id and s.user_id = (select auth.uid())
    )
  );

create policy students_delete_own on public.students
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy payments_select_own on public.payments
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.schools s
      where s.id = payments.school_id and s.user_id = (select auth.uid())
    )
  );

create policy payments_insert_own on public.payments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.students st
      where st.id = student_id
        and st.school_id = school_id
        and st.user_id = (select auth.uid())
    )
  );

create policy feeding_select_own on public.feeding_marks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy feeding_insert_own on public.feeding_marks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.students st
      where st.id = student_id
        and st.school_id = school_id
        and st.user_id = (select auth.uid())
    )
  );

create policy messages_select_own on public.message_log
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy messages_insert_own on public.message_log
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.schools s
      where s.id = school_id and s.user_id = (select auth.uid())
    )
  );
