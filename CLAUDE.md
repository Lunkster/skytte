# Instruktioner för Claude – Skyttestatistik

- Läs först Obsidian `Projekt/Skyttestatistik/Skyttestatistik - Projektdokument.md` (tågordning, logg) och `Skyttestatistik - Krav.md`.
- Följ skillen `obsidian-projekt`: logga i projektdokumentet, temporära filer i `~/Dokument/Claude/Skytte/`, aldrig i Obsidian.
- Databasen är schemat `skytte` i Supabase-projektet `tht` (`nlvgisjssbjethumvgdz`) – rör aldrig golfens tabeller i `public`.
- Schemaändringar: ny numrerad fil i `supabase/` + `apply_migration` (namn `skytte_NN_...`). Kör `get_advisors` efteråt. Uppdatera `docs/datamodell.md` och kopian i Obsidian.
- Lagra aldrig härledda värden – lägg logiken i vyerna.
- Anrop mot PostgREST kräver headern `Accept-Profile: skytte` (läsning) och `Content-Profile: skytte` (skrivning) – se `lib.js`.
- Versionsnummer i `index.html` (`?v=`) och i importerna ändras vid varje release.
- Inga personuppgifter, exporter eller nycklar (utom publishable key) i repot – `migrering/ut/` är ignorerad.
- Testa med `tests/` (attrapp, rör aldrig databasen) före commit.
