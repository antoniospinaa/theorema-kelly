-- Theorema Kelly — initial schema (PRD §7, used from Phase 2 onward).
-- Phase 1 (MVP) is fully client-side by design and does not touch this database.

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  ticker text unique not null,
  name text
);

create table if not exists daily_prices (
  asset_id uuid references assets(id),
  date date not null,
  close numeric not null,
  primary key (asset_id, date)
);

create table if not exists estimates (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id),
  as_of date not null,
  window_days int not null,          -- 63 / 126 / 252
  mu_annual numeric not null,
  sigma_annual numeric not null,
  created_at timestamptz default now()
);

create index if not exists estimates_asset_asof_idx on estimates (asset_id, as_of);

create table if not exists portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  as_of date not null,
  method text not null,              -- 'kelly' | 'half_kelly' | 'mvo_lambda_x'
  weights jsonb not null,
  inputs jsonb not null,             -- μ, Σ, r used (auditability)
  created_at timestamptz default now()
);

-- Phase 5 (paper trading; requires Supabase Auth).
create table if not exists paper_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  opened_at timestamptz default now(),
  ticker text not null,
  fraction numeric not null,
  thesis text,
  closed_at timestamptz,
  result_pct numeric
);

-- RLS: market data is public-read; paper trades are per-user.
alter table assets enable row level security;
alter table daily_prices enable row level security;
alter table estimates enable row level security;
alter table portfolio_snapshots enable row level security;
alter table paper_trades enable row level security;

create policy "public read assets" on assets for select using (true);
create policy "public read prices" on daily_prices for select using (true);
create policy "public read estimates" on estimates for select using (true);
create policy "public read snapshots" on portfolio_snapshots for select using (true);

create policy "own trades select" on paper_trades for select using (auth.uid() = user_id);
create policy "own trades insert" on paper_trades for insert with check (auth.uid() = user_id);
create policy "own trades update" on paper_trades for update using (auth.uid() = user_id);
create policy "own trades delete" on paper_trades for delete using (auth.uid() = user_id);
