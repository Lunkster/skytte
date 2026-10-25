# Tester

Webbläsartest med Playwright. Supabase ersätts av en attrapp i minnet (`attrapp.mjs`, påhittade skyttar), så testerna rör aldrig den riktiga databasen.

```bash
cd ~/Dokument/Claude/Skytte/kod/skytte/tests
npm init -y >/dev/null && npm i -D playwright && npx playwright install chromium   # en gång
cd .. && python3 -m http.server 8766 &                                           # appen på localhost:8766
cd tests && node flode.mjs && node komplettera.mjs && node statistik-skott.mjs
```

`flode.mjs` går igenom inloggning, serietotal, skott för skott (10 m med tangentbord, 50 m med knappsats), kommentar, krock på serienummer, ändra, ta bort, serielistan och statistiken i mobilbredd. Skärmbilder sparas som `f*.png`. `komplettera.mjs` provar att komplettera serier inmatade som total med skott: filtret *Bara serier utan skott*, jämförelse mot den gamla totalen, varning vid avvikelse och *Spara och nästa utan skott*.

`statistik-skott.mjs` provar statistiken som kräver skott: snitt per skottnummer, tappade poäng och svitar (även över seriegränsen).

Alla avslutar med `fel: 0` när allt är grönt.
