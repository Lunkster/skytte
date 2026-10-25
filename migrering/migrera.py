#!/usr/bin/env python3
"""Engångsmigrering från Google-arket (Luftgevärsloggen, export som CSV) till schema skytte.

Användning: python3 migrera.py ~/Dokument/Claude/Skytte/data/luftgevarsloggen_2026-10-25.csv > ut/migrering.sql
Alla rader blir luftgevär 10 m, inmatade som serietotal. Tidstämpeln blir `skapad`.
Kör den genererade SQL:en i Supabase (SQL Editor eller execute_sql). Personuppgifter → ut/ (inte i git).
"""
import csv, sys

rader = list(csv.DictReader(open(sys.argv[1], encoding='utf-8')))
vals = []
for r in rader:
    namn = r['Person'].strip().replace("'", "''")
    ts = r['Tidstämpel'].replace('.', ':')          # 2026-03-17 21.08.28 → 21:08:28
    poang = float(r['Poäng för serie (10 skott)'].replace(',', '.'))
    vals.append(f"('{namn}', '{r['Datum']}', {int(r['Serie för dagen'])}, {poang:.1f}, "
                f"{int(r['Antal stjärnor (*) i serien'])}, '{ts} Europe/Stockholm')")
print('-- Genererad av migrera.py –', len(vals), 'serier')
print('insert into skytte.serie (skytt_id, gren_id, datum, nr, total, stjarnor, skapad)')
print("select s.id, (select id from skytte.gren where kod = 'lg10'), v.datum::date, v.nr, v.total, v.stjarnor, v.skapad::timestamptz")
print('from (values')
print(',\n'.join('  ' + v for v in vals))
print(') v(namn, datum, nr, total, stjarnor, skapad)')
print('join skytte.skytt s on s.namn = v.namn;')
