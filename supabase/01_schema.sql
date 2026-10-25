-- 01: Schema skytte – familjens skytteresultat (2026-10-25)
--
-- Ligger som eget schema i Supabase-projektet tht (gratisplanen tillåter två aktiva projekt).
-- Helt åtskilt från golfen: egna tabeller, eget konto, egna regler.
-- Allt kräver inloggning med familjekontot (roll 'skytte' i app_metadata). Ingen anonym läsning.
-- Härledda värden (summa, stjärnor från skott) lagras aldrig – se 02_vyer.sql.

create schema if not exists skytte;

-- Rollen följer med i inloggningens JWT
create or replace function skytte.ar_familj() returns boolean
  language sql stable set search_path = ''
  as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'roll', '') = 'skytte' $$;

create table skytte.skytt (
  id        smallint generated always as identity primary key,
  namn      text not null unique,
  aktiv     boolean not null default true,
  ordning   smallint not null default 0
);

-- Gren: antal skott, poängskala och stjärngräns styr inmatning och beräkning
create table skytte.gren (
  id           smallint generated always as identity primary key,
  kod          text not null unique,              -- t.ex. lg10, sg50
  namn         text not null,
  antal_skott  smallint not null check (antal_skott between 1 and 60),
  decimaler    boolean not null,                  -- true: 0,0–10,9 · false: heltal 0–10 (+ fullträff)
  fulltraff    numeric(3,1),                      -- värdet som betyder fullträff vid heltal, t.ex. 10,1
  stjarna_fran numeric(3,1) not null,             -- skott >= detta ger en stjärna
  aktiv        boolean not null default true,
  ordning      smallint not null default 0
);

create table skytte.guldniva (
  gren_id   smallint not null references skytte.gren on delete cascade,
  grans     numeric(4,1) not null,                -- serie med minst detta värde (>=, som Looker-rapporten)
  namn      text not null,
  primary key (gren_id, grans)
);

-- En serie. Antingen total + stjärnor (serietotal) eller rader i skott (enskilda skott).
create table skytte.serie (
  id        integer generated always as identity primary key,
  skytt_id  smallint not null references skytte.skytt,
  gren_id   smallint not null references skytte.gren,
  datum     date not null,
  nr        smallint not null check (nr between 1 and 99),
  total     numeric(4,1) check (total >= 0),
  stjarnor  smallint check (stjarnor >= 0),
  skapad    timestamptz not null default now(),
  unique (skytt_id, gren_id, datum, nr)
);
create index on skytte.serie (datum);

create table skytte.skott (
  serie_id  integer not null references skytte.serie on delete cascade,
  nr        smallint not null check (nr between 1 and 60),
  varde     numeric(3,1) not null check (varde between 0 and 10.9),
  primary key (serie_id, nr)
);

-- Kommentar per tillfälle och skytt
create table skytte.kommentar (
  skytt_id  smallint not null references skytte.skytt,
  datum     date not null,
  text      text not null check (length(text) between 1 and 2000),
  primary key (skytt_id, datum)
);

-- Kontroll av skottvärden mot grenen (heltal eller fullträff vid heltalsgren, inte fler skott än grenen har)
create or replace function skytte.kontrollera_skott() returns trigger
  language plpgsql set search_path = ''
  as $$
declare g record;
begin
  select gr.* into g from skytte.serie s join skytte.gren gr on gr.id = s.gren_id where s.id = new.serie_id;
  if new.nr > g.antal_skott then
    raise exception 'Grenen % har bara % skott per serie', g.namn, g.antal_skott;
  end if;
  if not g.decimaler and new.varde <> trunc(new.varde) and new.varde is distinct from g.fulltraff then
    raise exception 'Grenen % har heltal (fullträff = %)', g.namn, g.fulltraff;
  end if;
  if not g.decimaler and new.varde > 10 and new.varde is distinct from g.fulltraff then
    raise exception 'Högsta värde i % är 10 eller fullträff', g.namn;
  end if;
  return new;
end $$;
create trigger skott_kontroll before insert or update on skytte.skott
  for each row execute function skytte.kontrollera_skott();

-- Behörighet: bara familjekontot, ingenting för anon
revoke all on schema skytte from public, anon;
grant usage on schema skytte to authenticated;
grant select, insert, update, delete on all tables in schema skytte to authenticated;
grant execute on function skytte.ar_familj() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['skytt','gren','guldniva','serie','skott','kommentar'] loop
    execute format('alter table skytte.%I enable row level security', t);
    execute format('create policy "familjen läser" on skytte.%I for select to authenticated using ((select skytte.ar_familj()))', t);
    execute format('create policy "familjen skriver" on skytte.%I for insert to authenticated with check ((select skytte.ar_familj()))', t);
    execute format('create policy "familjen ändrar" on skytte.%I for update to authenticated using ((select skytte.ar_familj())) with check ((select skytte.ar_familj()))', t);
    execute format('create policy "familjen raderar" on skytte.%I for delete to authenticated using ((select skytte.ar_familj()))', t);
  end loop;
end $$;

-- Grunddata
insert into skytte.skytt (namn, ordning) values ('Henrik', 1), ('Carin', 2), ('Tuva', 3), ('Vide', 4);
insert into skytte.gren (kod, namn, antal_skott, decimaler, fulltraff, stjarna_fran, ordning) values
  ('lg10', 'Luftgevär 10 m',    10, true,  null, 10.2, 1),
  ('sg50', 'Salongsgevär 50 m',  5, false, 10.1, 10.1, 2);
insert into skytte.guldniva (gren_id, grans, namn)
  select id, g, n from skytte.gren, (values (97.0, 'GULD'), (101.0, 'GULD ☆'), (103.0, 'GULD ☆☆'), (105.0, 'GULD ☆☆☆')) v(g, n)
  where kod = 'lg10';
