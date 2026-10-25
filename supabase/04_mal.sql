-- 04: Säsongsmål per skytt och gren (F-36, 2026-10-26)
-- Säsong = startåret: 1 augusti – 31 juli (2026 = säsongen 2026/27).
create table skytte.mal (
  skytt_id  smallint not null references skytte.skytt,
  gren_id   smallint not null references skytte.gren,
  sasong    smallint not null check (sasong between 2000 and 2100),
  snitt     numeric(4,1) not null check (snitt > 0),
  primary key (skytt_id, gren_id, sasong)
);
alter table skytte.mal enable row level security;
grant select, insert, update, delete on skytte.mal to authenticated;
create policy "familjen läser" on skytte.mal for select to authenticated using ((select skytte.ar_familj()));
create policy "familjen skriver" on skytte.mal for insert to authenticated with check ((select skytte.ar_familj()));
create policy "familjen ändrar" on skytte.mal for update to authenticated using ((select skytte.ar_familj())) with check ((select skytte.ar_familj()));
create policy "familjen raderar" on skytte.mal for delete to authenticated using ((select skytte.ar_familj()));
