-- Real-position tracking for the upcoming "Mi portafolio" section.
-- Users log positions manually; the app never connects to brokers.
-- (Applied to project gizolckceepstsgfqtsl on 2026-07-20.)

create table if not exists positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  shares numeric,                    -- either shares…
  invested_usd numeric,              -- …or a dollar amount at buy time
  buy_price numeric,                 -- price per share at purchase
  bought_at date not null default current_date,
  note text,
  closed_at date,
  close_price numeric,
  created_at timestamptz default now()
);

create index if not exists positions_user_idx on positions (user_id, closed_at);

alter table positions enable row level security;

create policy "own positions select" on positions for select using (auth.uid() = user_id);
create policy "own positions insert" on positions for insert with check (auth.uid() = user_id);
create policy "own positions update" on positions for update using (auth.uid() = user_id);
create policy "own positions delete" on positions for delete using (auth.uid() = user_id);
