-- 02: Beräkningsvyer (2026-10-25)
-- Summa och stjärnor räknas ur skotten när de finns, annars används inmatad total.
-- security_invoker: vyerna följer tabellernas regler (bara familjekontot ser något).

create or replace view skytte.v_serie with (security_invoker = true) as
select s.id, s.datum, s.nr, s.skytt_id, sk.namn as skytt, s.gren_id, g.kod as gren_kod, g.namn as gren,
       case when count(x.nr) > 0 then 'skott' else 'total' end as inmatning,
       coalesce(sum(x.varde), s.total) as poang,
       case when count(x.nr) > 0 then count(*) filter (where x.varde >= g.stjarna_fran) else s.stjarnor end::int as stjarnor,
       count(x.nr)::int as antal_skott,
       g.antal_skott as skott_per_serie,
       (count(x.nr) > 0 and count(x.nr) < g.antal_skott) as ofullstandig,
       coalesce(array_agg(x.varde order by x.nr) filter (where x.nr is not null), '{}') as skott,
       s.skapad
from skytte.serie s
join skytte.skytt sk on sk.id = s.skytt_id
join skytte.gren g on g.id = s.gren_id
left join skytte.skott x on x.serie_id = s.id
group by s.id, sk.namn, g.id;

-- Ett tillfälle = skytt + gren + datum
create or replace view skytte.v_dag with (security_invoker = true) as
select v.datum, v.skytt_id, v.skytt, v.gren_id, v.gren_kod, v.gren,
       count(*)::int as serier,
       round(avg(v.poang), 2) as snitt,
       max(v.poang) as basta,
       min(v.poang) as samsta,
       sum(v.stjarnor)::int as stjarnor,
       k.text as kommentar
from skytte.v_serie v
left join skytte.kommentar k on k.skytt_id = v.skytt_id and k.datum = v.datum
group by v.datum, v.skytt_id, v.skytt, v.gren_id, v.gren_kod, v.gren, k.text;

grant select on skytte.v_serie, skytte.v_dag to authenticated;
