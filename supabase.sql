-- MT Studios: pitches table.
-- Run once in Supabase → SQL Editor → New query → paste → Run.

create table if not exists public.pitches (
  ref         text primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  status      text not null default 'new' check (status in ('new', 'reviewing', 'accepted', 'rejected')),
  name        text not null,
  studio      text not null,
  email       text not null,
  link        text not null,
  stage       text not null,
  ccu         text,
  needs       text[] not null default '{}',
  msg         text,
  note        text
);

create index if not exists pitches_created_at_idx on public.pitches (created_at desc);

-- Lock the table down: with RLS on and no policies, the public "anon" key can't
-- read or write anything. The site's server uses the secret key, which bypasses RLS.
alter table public.pitches enable row level security;

-- ---------------------------------------------------------------------------
-- MT Studios: portfolio games (managed in /admin → Games) and live player history.
-- Safe to re-run.

create table if not exists public.games (
  universe_id  bigint primary key,
  place_id     bigint,
  slug         text not null,
  name         text not null default '',
  studio       text not null default '',
  acquired_on  date,                       -- when MT bought the game (private)
  note         text,                       -- private admin note
  featured     boolean not null default false,
  hidden       boolean not null default false,
  position     integer not null default 0,
  added_at     timestamptz not null default now(),
  stats        jsonb,                      -- cached Roblox stats (players, visits, thumbnails…)
  stats_at     timestamptz
);
alter table public.games enable row level security;

-- The portfolio games (imported from mtstudios.xyz); names and stats fill in automatically.
insert into public.games (universe_id, slug, position) values
  (10770806914, '10770806914', 0),
  (10772159183, '10772159183', 1),
  (10764173782, '10764173782', 2),
  (10774597123, '10774597123', 3),
  (10499079217, '10499079217', 4),
  (10773748361, '10773748361', 5),
  (10769660609, '10769660609', 6),
  (10772655444, '10772655444', 7),
  (2177157737, '2177157737', 8),
  (10768637423, '10768637423', 9),
  (10769433835, '10769433835', 10),
  (10764393451, '10764393451', 11),
  (10772808476, '10772808476', 12),
  (10099509236, '10099509236', 13),
  (10437881316, '10437881316', 14),
  (10772757640, '10772757640', 15)
on conflict (universe_id) do nothing;

create table if not exists public.ccu_samples (
  t      timestamptz primary key default now(),
  total  integer not null
);
alter table public.ccu_samples enable row level security;
