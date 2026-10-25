# Skyttestatistik

Webbapp för familjens skytteresultat: inmatning per serie (serietotal eller skott för skott) och statistik per skytt och gren.

- **App:** https://lunkster.github.io/skytte/ – statisk webbapp på GitHub Pages, inga beroenden
- **Databas:** schemat `skytte` i Supabase-projektet `tht` (eu-north-1, ref `nlvgisjssbjethumvgdz`) – helt åtskilt från golfens tabeller
- **Dokumentation:** Obsidian `Projekt/Skyttestatistik/` – projektdokument, krav, önskelista

## Struktur

| Sökväg | Innehåll |
| --- | --- |
| `index.html`, `app.js` | Sidan, router, inloggning, grunddata |
| `mata.js` | Mata in och ändra serier |
| `serier.js` | Alla serier per tillfälle |
| `statistik.js` | Statistiksidan: topplista, guldserier, utveckling och statistik som kräver skott |
| `statistikA.js` | Form, kvällens skytt, säsongsmål, rekordtidslinje, jämnhet, serienummer, träningsmängd, grenarna jämförda |
| `lib.js` | Supabase-anrop (schema `skytte`), inloggning, tolkning av skott |
| `supabase/` | Schema, vyer och behörighet som numrerade SQL-filer |
| `migrering/migrera.py` | Engångsflytt från Google-arket (CSV) |
| `docs/datamodell.md` | ER-diagram och vyer |
| `tests/` | Webbläsartester med Supabase-attrapp |

## Principer
- Standard-Postgres, ingen logik som bara finns i Supabase → lätt att flytta till eget projekt.
- Summa och stjärnor räknas ur skotten i vyerna, lagras aldrig. Serier som matats in som total har `total` och `stjarnor`.
- Grenar och guldnivåer är data – en ny gren kräver ingen ny kod.
- Allt kräver inloggning med familjekontot (roll `skytte` i `app_metadata`), ingen anonym läsning.
