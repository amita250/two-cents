-- =============================================================================
-- TwoCents — initial schema
-- Couples, profiles, payment methods, categories, expenses, invites.
-- Every design decision referenced here (D-xxx) is explained in docs/decisions.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- A couple is the "group" that owns all shared data. (D-003, D-004)
create table public.couples (
  id               uuid primary key default gen_random_uuid(),
  name             text not null default 'Our home'
                   check (length(trim(name)) between 1 and 50),
  default_currency char(3) not null default 'ILS'
                   check (default_currency ~ '^[A-Z]{3}$'),
  created_at       timestamptz not null default now()
);

-- One profile per authenticated user. Created automatically on sign-up.
-- A user belongs to at most one couple; a couple has at most two users. (D-004)
create table public.profiles (
  id                        uuid primary key references auth.users (id) on delete cascade,
  couple_id                 uuid references public.couples (id) on delete set null,
  display_name              text not null check (length(trim(display_name)) between 1 and 50),
  default_payment_method_id uuid,  -- FK added below, after payment_methods exists (D-010)
  created_at                timestamptz not null default now(),
  -- Lets other tables reference (profile, couple) together, so the database
  -- itself guarantees a row never points at a profile from another couple. (D-005)
  unique (id, couple_id)
);

-- "Who paid" is derived from the payment method's owner. (D-006)
-- owner_id null = a shared method (joint account / joint card).
create table public.payment_methods (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples (id) on delete cascade,
  owner_id    uuid,
  kind        text not null
              check (kind in ('credit_card', 'debit_card', 'cash', 'bank_transfer', 'other')),
  label       text not null check (length(trim(label)) between 1 and 50),
  is_archived boolean not null default false,  -- archived, never deleted (D-009)
  created_at  timestamptz not null default now(),
  unique (id, couple_id),
  foreign key (owner_id, couple_id) references public.profiles (id, couple_id)
);

alter table public.profiles
  add constraint profiles_default_payment_method_fk
  foreign key (default_payment_method_id, couple_id)
  references public.payment_methods (id, couple_id);

-- Each couple has its own editable category list, seeded with defaults. (D-011)
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 30),
  is_archived boolean not null default false,  -- (D-009)
  created_at  timestamptz not null default now(),
  unique (couple_id, name),
  unique (id, couple_id)
);

create table public.expenses (
  id                uuid primary key default gen_random_uuid(),
  couple_id         uuid not null references public.couples (id) on delete cascade,
  created_by        uuid not null,
  category_id       uuid not null,
  payment_method_id uuid not null,
  title             text check (title is null or length(title) <= 100),
  -- Money is exact decimal, never floating point. (D-007)
  amount            numeric(12, 2) not null check (amount > 0),
  currency          char(3) not null check (currency ~ '^[A-Z]{3}$'),
  -- Snapshot of the rate on the day of entry, so history never "moves". (D-008)
  exchange_rate     numeric(18, 8) not null default 1 check (exchange_rate > 0),
  amount_in_default numeric(12, 2) not null,  -- always computed by trigger
  -- The day the money was spent, separate from when it was recorded. (D-012)
  expense_date      date not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (created_by, couple_id)        references public.profiles (id, couple_id),
  foreign key (category_id, couple_id)       references public.categories (id, couple_id),
  foreign key (payment_method_id, couple_id) references public.payment_methods (id, couple_id)
);

create index expenses_couple_date_idx on public.expenses (couple_id, expense_date desc);

-- Single-use, time-limited invite codes for the second partner. (D-013)
create table public.couple_invites (
  code       text primary key,
  couple_id  uuid not null references public.couples (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  used_by    uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Helper: the current user's couple
-- security definer so RLS policies can call it without recursing into the
-- profiles policy. search_path is pinned to avoid search-path hijacking.
-- -----------------------------------------------------------------------------
create function public.my_couple_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select couple_id from public.profiles where id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Create a profile automatically when someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1),
      'Me'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Defense in depth: a couple can never hold more than two profiles,
-- no matter which code path tries to add one. (D-004)
create function public.enforce_couple_size()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.couple_id is not null
     and new.couple_id is distinct from old.couple_id
     and (select count(*) from public.profiles where couple_id = new.couple_id) >= 2 then
    raise exception 'couple is full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_couple_size
  before update of couple_id on public.profiles
  for each row execute function public.enforce_couple_size();

-- Expenses: the server, not the client, decides who created the row, which
-- couple it belongs to, and the converted amount. (D-005, D-008)
create function public.prepare_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_default_currency char(3);
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.couple_id  := public.my_couple_id();
    if new.couple_id is null then
      raise exception 'user is not part of a couple' using errcode = 'P0001';
    end if;
  else
    -- ownership and couple are immutable after creation
    new.created_by := old.created_by;
    new.couple_id  := old.couple_id;
    new.created_at := old.created_at;
  end if;

  select default_currency into v_default_currency
  from public.couples where id = new.couple_id;

  if new.currency = v_default_currency then
    new.exchange_rate := 1;
  end if;

  new.amount_in_default := round(new.amount * new.exchange_rate, 2);
  new.updated_at := now();
  return new;
end;
$$;

create trigger expenses_prepare
  before insert or update on public.expenses
  for each row execute function public.prepare_expense();

-- -----------------------------------------------------------------------------
-- Functions the app calls (RPC). Couple membership changes ONLY through these.
-- -----------------------------------------------------------------------------

-- Default categories for a new couple (Hebrew UI). (D-011)
create function public.seed_default_categories(p_couple_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (couple_id, name)
  select p_couple_id, unnest(array[
    'סופר', 'אוכל בחוץ', 'תחבורה ציבורית', 'דלק וחניה', 'דיור',
    'חשבונות', 'בריאות', 'בילויים', 'קניות', 'מנויים', 'מתנות', 'אחר'
  ])
$$;

-- Creates a couple for the caller, seeds categories and a cash payment method.
create function public.create_couple(p_name text default 'Our home',
                                     p_default_currency char(3) default 'ILS')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_couple_id uuid;
  v_cash_id   uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if public.my_couple_id() is not null then
    raise exception 'user is already part of a couple' using errcode = 'P0001';
  end if;

  insert into public.couples (name, default_currency)
  values (p_name, upper(p_default_currency))
  returning id into v_couple_id;

  update public.profiles set couple_id = v_couple_id where id = v_uid;

  perform public.seed_default_categories(v_couple_id);

  insert into public.payment_methods (couple_id, owner_id, kind, label)
  values (v_couple_id, v_uid, 'cash', 'מזומן')
  returning id into v_cash_id;

  update public.profiles set default_payment_method_id = v_cash_id where id = v_uid;

  return v_couple_id;
end;
$$;

-- Creates a fresh invite code (and invalidates older unused ones). (D-013)
create function public.create_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_couple_id uuid := public.my_couple_id();
  v_code      text;
begin
  if v_couple_id is null then
    raise exception 'user is not part of a couple' using errcode = 'P0001';
  end if;
  if (select count(*) from public.profiles where couple_id = v_couple_id) >= 2 then
    raise exception 'couple is full' using errcode = 'P0001';
  end if;

  -- only one live invite per couple
  update public.couple_invites
     set expires_at = now()
   where couple_id = v_couple_id and used_at is null and expires_at > now();

  -- 12 URL-safe chars = 72 bits of randomness: not guessable
  v_code := translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_');

  insert into public.couple_invites (code, couple_id, created_by, expires_at)
  values (v_code, v_couple_id, v_uid, now() + interval '48 hours');

  return v_code;
end;
$$;

-- Joins the caller to the inviting couple. One generic error for any bad code,
-- so the response never reveals whether a code exists. (D-013)
create function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_invite public.couple_invites;
  v_cash_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if public.my_couple_id() is not null then
    raise exception 'user is already part of a couple' using errcode = 'P0001';
  end if;

  select * into v_invite
  from public.couple_invites
  where code = p_code
  for update;  -- two people racing for the same code: only one wins

  if v_invite.code is null
     or v_invite.used_at is not null
     or v_invite.expires_at <= now() then
    raise exception 'invalid or expired invite' using errcode = 'P0001';
  end if;

  perform 1 from public.couples where id = v_invite.couple_id for update;

  update public.profiles set couple_id = v_invite.couple_id where id = v_uid;
  -- (enforce_couple_size raises 'couple is full' if needed)

  update public.couple_invites
     set used_at = now(), used_by = v_uid
   where code = v_invite.code;

  insert into public.payment_methods (couple_id, owner_id, kind, label)
  values (v_invite.couple_id, v_uid, 'cash', 'מזומן')
  returning id into v_cash_id;

  update public.profiles set default_payment_method_id = v_cash_id where id = v_uid;

  return v_invite.couple_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security (D-005)
-- Rule of thumb: you can SEE everything in your couple; you can CHANGE only
-- what is yours. Anything not explicitly allowed is denied.
-- -----------------------------------------------------------------------------
alter table public.couples         enable row level security;
alter table public.profiles        enable row level security;
alter table public.payment_methods enable row level security;
alter table public.categories      enable row level security;
alter table public.expenses        enable row level security;
alter table public.couple_invites  enable row level security;

-- couples: read & rename/change currency your own couple. Created only via RPC.
create policy couples_select on public.couples
  for select to authenticated using (id = public.my_couple_id());
create policy couples_update on public.couples
  for update to authenticated
  using (id = public.my_couple_id()) with check (id = public.my_couple_id());

-- profiles: see yourself and your partner; edit only your own display fields.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or couple_id = public.my_couple_id());
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- payment methods: see all in couple; add/edit your own or shared ones.
create policy payment_methods_select on public.payment_methods
  for select to authenticated using (couple_id = public.my_couple_id());
create policy payment_methods_insert on public.payment_methods
  for insert to authenticated
  with check (couple_id = public.my_couple_id()
              and (owner_id is null or owner_id = auth.uid()));
create policy payment_methods_update on public.payment_methods
  for update to authenticated
  using (couple_id = public.my_couple_id() and (owner_id is null or owner_id = auth.uid()))
  with check (couple_id = public.my_couple_id() and (owner_id is null or owner_id = auth.uid()));

-- categories: shared list, both partners manage it.
create policy categories_select on public.categories
  for select to authenticated using (couple_id = public.my_couple_id());
create policy categories_insert on public.categories
  for insert to authenticated with check (couple_id = public.my_couple_id());
create policy categories_update on public.categories
  for update to authenticated
  using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());

-- expenses: everyone in the couple reads; only the creator edits/deletes. (D-014)
create policy expenses_select on public.expenses
  for select to authenticated using (couple_id = public.my_couple_id());
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (couple_id = public.my_couple_id() and created_by = auth.uid());
create policy expenses_update on public.expenses
  for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy expenses_delete on public.expenses
  for delete to authenticated using (created_by = auth.uid());

-- invites: visible to your couple (to show "invite pending"); written only via RPC.
create policy couple_invites_select on public.couple_invites
  for select to authenticated using (couple_id = public.my_couple_id());

-- -----------------------------------------------------------------------------
-- Privileges: least privilege on top of RLS
-- -----------------------------------------------------------------------------
revoke all on public.couples, public.profiles, public.payment_methods,
              public.categories, public.expenses, public.couple_invites
  from anon, authenticated;

grant select, update (name, default_currency)             on public.couples         to authenticated;
grant select, update (display_name, default_payment_method_id) on public.profiles   to authenticated;
grant select, insert (couple_id, owner_id, kind, label),
              update (kind, label, is_archived)           on public.payment_methods to authenticated;
grant select, insert (couple_id, name),
              update (name, is_archived)                  on public.categories      to authenticated;
grant select, insert, update, delete                      on public.expenses        to authenticated;
grant select                                              on public.couple_invites  to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.create_couple(text, char)  to authenticated;
grant execute on function public.create_invite()            to authenticated;
grant execute on function public.accept_invite(text)        to authenticated;
grant execute on function public.my_couple_id()             to authenticated;
