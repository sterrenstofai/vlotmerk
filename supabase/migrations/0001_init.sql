-- Merknaamcheck: tabellen uit de bouwbrief (§7).
--
-- Toegang: een check kan zonder account gestart worden. Daarom schrijft alleen de server
-- (met de geheime sleutel, die RLS omzeilt). Ingelogde gebruikers lezen hun eigen rijen;
-- anonieme bezoekers lezen niets rechtstreeks. Een check zonder eigenaar is alleen te openen
-- via de server, met het geheime token uit de URL. Beoogde merknamen zijn vertrouwelijk.

create table if not exists checks (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  eigenaar uuid references auth.users (id) on delete set null,
  naam text not null check (char_length(naam) between 1 and 80),
  omschrijving text not null check (char_length(omschrijving) <= 1000),
  gebied text not null default 'benelux' check (gebied in ('benelux')),
  status text not null default 'nieuw'
    check (status in ('nieuw', 'gratis_bezig', 'gratis_klaar', 'rapport_bezig', 'rapport_klaar', 'mislukt')),
  gratis_resultaat jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists checks_eigenaar_idx on checks (eigenaar);

-- Ruwe uitvoer per pipeline-stap, zodat een oordeel achteraf te reconstrueren is (§3).
create table if not exists check_steps (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references checks (id) on delete cascade,
  stap smallint not null check (stap between 1 and 7),
  ruwe_uitvoer jsonb not null,
  model text,
  duur_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists check_steps_check_idx on check_steps (check_id, stap);

create table if not exists reports (
  check_id uuid primary key references checks (id) on delete cascade,
  absolute_gronden jsonb not null,
  klassen jsonb not null,
  eindoordeel jsonb not null,
  pdf_pad text,
  created_at timestamptz not null default now()
);

create table if not exists watches (
  id uuid primary key default gen_random_uuid(),
  eigenaar uuid not null references auth.users (id) on delete cascade,
  check_id uuid references checks (id) on delete set null,
  naam text not null,
  klassen smallint[] not null,
  varianten jsonb not null default '[]'::jsonb,
  laatst_gezien jsonb not null default '[]'::jsonb,
  mollie_klant text,
  mollie_abonnement text,
  status text not null default 'wacht_op_betaling'
    check (status in ('wacht_op_betaling', 'actief', 'gepauzeerd', 'gestopt')),
  created_at timestamptz not null default now()
);
create index if not exists watches_eigenaar_idx on watches (eigenaar);

-- Een treffer hoort bij een check of bij een bewaking, nooit bij allebei.
create table if not exists hits (
  id uuid primary key default gen_random_uuid(),
  check_id uuid references checks (id) on delete cascade,
  watch_id uuid references watches (id) on delete cascade,
  bron text not null check (bron in ('boip', 'euipo', 'tmview')),
  merk text not null,
  houder text,
  nummer text not null,
  klassen smallint[] not null default '{}',
  status text not null check (status in ('aangevraagd', 'gepubliceerd', 'ingeschreven', 'vervallen')),
  register_url text,
  scores jsonb,
  risico text check (risico in ('laag', 'middel', 'hoog')),
  uitleg text,
  created_at timestamptz not null default now(),
  check ((check_id is null) <> (watch_id is null))
);
create index if not exists hits_check_idx on hits (check_id);
create index if not exists hits_watch_idx on hits (watch_id);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references checks (id) on delete cascade,
  type text not null check (type in ('rapport', 'depot', 'bewaking')),
  mollie_id text not null unique,
  status text not null default 'open' check (status in ('open', 'paid', 'failed', 'canceled', 'expired')),
  bedrag numeric(10, 2) not null,
  created_at timestamptz not null default now()
);
create index if not exists orders_check_idx on orders (check_id);

create table if not exists filings (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null unique references checks (id) on delete cascade,
  houder jsonb,
  klassen jsonb,
  klassen_bevestigd boolean not null default false,
  route text not null default 'a' check (route in ('a', 'b')),
  status text not null default 'concept' check (status in ('concept', 'klaar', 'ingediend')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists watch_runs (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references watches (id) on delete cascade,
  gestart timestamptz not null default now(),
  klaar timestamptz,
  aantal_zoekopdrachten integer not null default 0,
  kosten numeric(10, 4) not null default 0,
  ok boolean,
  fout text
);
create index if not exists watch_runs_watch_idx on watch_runs (watch_id, gestart desc);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references watches (id) on delete cascade,
  hit_id uuid not null references hits (id) on delete cascade,
  verzonden timestamptz,
  oppositie_deadline date,
  created_at timestamptz not null default now(),
  unique (watch_id, hit_id)
);

-- Zoekresultaten blijven 24 uur geldig; de server ruimt oudere rijen op.
create table if not exists source_cache (
  bron text not null check (bron in ('boip', 'euipo', 'tmview')),
  zoekterm text not null,
  resultaat jsonb not null,
  opgehaald timestamptz not null default now(),
  primary key (bron, zoekterm)
);

alter table checks enable row level security;
alter table check_steps enable row level security;
alter table reports enable row level security;
alter table hits enable row level security;
alter table orders enable row level security;
alter table filings enable row level security;
alter table watches enable row level security;
alter table watch_runs enable row level security;
alter table alerts enable row level security;
alter table source_cache enable row level security;

-- Alleen lezen, alleen eigen rijen. Schrijven doet de server.
-- check_steps en source_cache hebben bewust geen policy: die zijn alleen voor de server.
create policy "eigenaars lezen hun checks" on checks
  for select to authenticated using (eigenaar = auth.uid());

create policy "eigenaars lezen hun rapporten" on reports
  for select to authenticated
  using (exists (select 1 from checks c where c.id = reports.check_id and c.eigenaar = auth.uid()));

create policy "eigenaars lezen hun bewakingen" on watches
  for select to authenticated using (eigenaar = auth.uid());

create policy "eigenaars lezen hun treffers" on hits
  for select to authenticated
  using (
    exists (select 1 from checks c where c.id = hits.check_id and c.eigenaar = auth.uid())
    or exists (select 1 from watches w where w.id = hits.watch_id and w.eigenaar = auth.uid())
  );

create policy "eigenaars lezen hun bestellingen" on orders
  for select to authenticated
  using (exists (select 1 from checks c where c.id = orders.check_id and c.eigenaar = auth.uid()));

create policy "eigenaars lezen hun depotdossiers" on filings
  for select to authenticated
  using (exists (select 1 from checks c where c.id = filings.check_id and c.eigenaar = auth.uid()));

create policy "eigenaars lezen hun bewakingsruns" on watch_runs
  for select to authenticated
  using (exists (select 1 from watches w where w.id = watch_runs.watch_id and w.eigenaar = auth.uid()));

create policy "eigenaars lezen hun meldingen" on alerts
  for select to authenticated
  using (exists (select 1 from watches w where w.id = alerts.watch_id and w.eigenaar = auth.uid()));
