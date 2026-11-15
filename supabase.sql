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
