-- Sillage private circle v1
-- Local journal stays on-device; circle is an optional cloud layer.
-- Coffre / private days are NEVER stored or shared here.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables (structure first; policies after all relations exist)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'member')),
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (circle_id, user_id)
);

create index circle_members_user_id_idx on public.circle_members (user_id);

create table public.circle_invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days'),
  max_uses int not null default 5 check (max_uses > 0 and max_uses <= 20),
  use_count int not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint circle_invites_uses_ok check (use_count <= max_uses)
);

create index circle_invites_token_idx on public.circle_invites (token);
create index circle_invites_circle_id_idx on public.circle_invites (circle_id);

-- Opt-in Ensemble feed snapshots (never coffre / private days).
create table public.shared_days (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  -- Local day id (YYYY-MM-DD); snapshot is independent of the device store.
  local_day_id text not null check (local_day_id ~ '^\d{4}-\d{2}-\d{2}$'),
  title text not null default '',
  story_excerpt text not null default '',
  mood text,
  location text,
  -- Photo URLs or Supabase Storage paths (signed URLs later).
  photo_urls text[] not null default '{}',
  shared_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (circle_id, author_id, local_day_id)
);

create index shared_days_circle_shared_at_idx
  on public.shared_days (circle_id, shared_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger circles_set_updated_at
  before update on public.circles
  for each row execute function public.set_updated_at();

-- True if the current auth user is a member of the given circle.
create or replace function public.is_circle_member(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.circle_members m
    where m.circle_id = p_circle_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_circle_member(uuid) from public;
grant execute on function public.is_circle_member(uuid) to authenticated;

-- Cap membership at 5 (app also treats 2 as the practical minimum).
create or replace function public.enforce_circle_member_cap()
returns trigger
language plpgsql
as $$
declare
  member_count int;
begin
  select count(*) into member_count
  from public.circle_members
  where circle_id = new.circle_id;

  if member_count >= 5 then
    raise exception 'circle_full: max 5 members';
  end if;
  return new;
end;
$$;

create trigger circle_members_cap
  before insert on public.circle_members
  for each row execute function public.enforce_circle_member_cap();

-- Sparse profile on signup (Google name / avatar when present).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security — members only see their circles / shares
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_invites enable row level security;
alter table public.shared_days enable row level security;

-- profiles
create policy "profiles_select_own_or_circle_peers"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.circle_members me
      join public.circle_members peer on peer.circle_id = me.circle_id
      where me.user_id = auth.uid()
        and peer.user_id = profiles.id
    )
  );

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- circles
create policy "circles_select_member"
  on public.circles for select to authenticated
  using (public.is_circle_member(id));

create policy "circles_insert_authenticated"
  on public.circles for insert to authenticated
  with check (created_by = auth.uid());

create policy "circles_update_creator"
  on public.circles for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "circles_delete_creator"
  on public.circles for delete to authenticated
  using (created_by = auth.uid());

-- circle_members
create policy "circle_members_select_same_circle"
  on public.circle_members for select to authenticated
  using (public.is_circle_member(circle_id));

-- Self-join as owner on create; later joins go through invite acceptance (also self-insert).
create policy "circle_members_insert_self"
  on public.circle_members for insert to authenticated
  with check (user_id = auth.uid());

create policy "circle_members_delete_self_or_owner"
  on public.circle_members for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.circle_members m
      where m.circle_id = circle_members.circle_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- circle_invites (members manage; live token visible for accept flow)
create policy "circle_invites_select_member"
  on public.circle_invites for select to authenticated
  using (public.is_circle_member(circle_id));

create policy "circle_invites_select_live_for_accept"
  on public.circle_invites for select to authenticated
  using (
    revoked_at is null
    and expires_at > timezone('utc', now())
    and use_count < max_uses
  );

create policy "circle_invites_insert_owner"
  on public.circle_invites for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.circle_members m
      where m.circle_id = circle_invites.circle_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

create policy "circle_invites_update_owner"
  on public.circle_invites for update to authenticated
  using (
    exists (
      select 1 from public.circle_members m
      where m.circle_id = circle_invites.circle_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.circle_members m
      where m.circle_id = circle_invites.circle_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- shared_days
create policy "shared_days_select_member"
  on public.shared_days for select to authenticated
  using (public.is_circle_member(circle_id));

create policy "shared_days_insert_author_member"
  on public.shared_days for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_circle_member(circle_id)
  );

create policy "shared_days_update_author"
  on public.shared_days for update to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and public.is_circle_member(circle_id)
  );

create policy "shared_days_delete_author_or_owner"
  on public.shared_days for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.circle_members m
      where m.circle_id = shared_days.circle_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- Operator notes:
-- 1. Run in Supabase SQL editor (or `supabase db push`).
-- 2. Enable Google in Authentication → Providers.
-- 3. Redirect URL: https://followlapinblanc7-cell.github.io/Sillage/
-- 4. Never insert coffre/private days into shared_days (client rule).
