-- KORONA: schemat bazy (GDD sekcja 7) + RLS + indeksy + sprzątanie pokoi.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 16),
  favorite_skin text check (favorite_skin in ('rycerz', 'lucznik', 'lotrzyk', 'kaplan', 'inzynier')),
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  -- 5 znaków, bez 0/O/1/I
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  max_players int not null default 6 check (max_players between 2 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms (id) on delete set null,
  host_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz,
  ended_at timestamptz,
  winner_id uuid references auth.users (id) on delete set null
);

create table if not exists public.match_results (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score int not null default 0 check (score between 0 and 10000),
  crown_seconds int not null default 0 check (crown_seconds >= 0),
  last_hits int not null default 0 check (last_hits >= 0),
  boss_kills int not null default 0 check (boss_kills >= 0),
  skin text check (skin in ('rycerz', 'lucznik', 'lotrzyk', 'kaplan', 'inzynier')),
  dnf boolean not null default false,
  primary key (match_id, user_id)
);

create index if not exists rooms_status_created_idx on public.rooms (status, created_at);
create index if not exists rooms_owner_idx on public.rooms (owner_id);
create index if not exists matches_room_idx on public.matches (room_id);
create index if not exists matches_host_idx on public.matches (host_id);
create index if not exists matches_winner_idx on public.matches (winner_id);
create index if not exists match_results_user_idx on public.match_results (user_id);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.matches enable row level security;
alter table public.match_results enable row level security;

-- profiles: każdy zalogowany czyta, edytuje tylko własny wiersz
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- rooms: zalogowani czytają i tworzą, aktualizuje/usuwa tylko właściciel
create policy rooms_select on public.rooms for select to authenticated using (true);
create policy rooms_insert on public.rooms for insert to authenticated with check (owner_id = (select auth.uid()));
create policy rooms_update on public.rooms for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy rooms_delete on public.rooms for delete to authenticated using (owner_id = (select auth.uid()));

-- matches: insert tylko jako host meczu
create policy matches_select on public.matches for select to authenticated using (true);
create policy matches_insert on public.matches for insert to authenticated with check (host_id = (select auth.uid()));

-- match_results: insert tylko gdy auth.uid() = matches.host_id
create policy match_results_select on public.match_results for select to authenticated using (true);
create policy match_results_insert on public.match_results for insert to authenticated
  with check (exists (select 1 from public.matches m where m.id = match_id and m.host_id = (select auth.uid())));

-- Sprzątanie: pokoje w lobby starsze niż 2 h
create or replace function public.cleanup_stale_rooms() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.rooms
   where (status = 'lobby' and created_at < now() - interval '2 hours')
      or (status <> 'lobby' and updated_at < now() - interval '24 hours');
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.cleanup_stale_rooms() from public, anon, authenticated;
