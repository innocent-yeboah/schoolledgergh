-- Paystack checkout links for one student balance.
-- Apply to a NEW project after the school ledger schema. Do not run this on
-- the original production database.
--
-- The browser may insert a pending link for its own school. Only the server
-- roles can mark a link paid, and only the webhook does that after Paystack
-- verifies the charge. No Paystack secret is stored in this table.

create or replace function private.guard_payment_link_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'paid' and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'A Paystack link can be marked paid only by the server after the charge is verified';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_payment_link_status() from public, anon, authenticated;

create table public.payment_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id text not null references public.students (id) on delete cascade,
  reference text not null,
  amount numeric(12, 2) not null,
  authorization_url text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default pg_catalog.now(),
  constraint payment_links_reference_unique unique (reference),
  constraint payment_links_amount_positive check (amount > 0),
  constraint payment_links_status check (status in ('pending', 'paid')),
  constraint payment_links_reference_shape check (reference ~ '^[A-Za-z0-9._=-]+$')
);

comment on table public.payment_links is
  'Pending Paystack mobile-money checkouts. Secrets are not stored here.';

create index payment_links_student_idx on public.payment_links (student_id, status);

create trigger payment_links_guard_status
  before insert or update on public.payment_links
  for each row execute function private.guard_payment_link_status();

alter table public.payment_links enable row level security;
alter table public.payment_links force row level security;

revoke all on table public.payment_links from anon, authenticated;
grant select, insert on table public.payment_links to authenticated;
grant all on table public.payment_links to service_role;

create policy payment_links_select_own on public.payment_links
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.schools s
      where s.id = payment_links.school_id and s.user_id = (select auth.uid())
    )
  );

create policy payment_links_insert_own on public.payment_links
  for insert to authenticated
  with check (
    status = 'pending'
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.students st
      where st.id = student_id
        and st.school_id = school_id
        and st.user_id = (select auth.uid())
    )
  );
