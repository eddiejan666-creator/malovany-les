# Malovaný les: poznámky k projektu

Hra pro sedmiletou dceru majitele (Vendulka, 1. třída). Majitel není programátor; komunikuj česky, věcně, tykej.

## Zadání, které platí
- Grafika: malba tahy štětce ve stylu dema Oil paint (patch.gg/blendi/oil-paint), ale vlastní lehčí implementace, která běží na PC i tabletu.
- Texty ve hře: jen VELKÁ TISKACÍ písmena, krátké věty, bez předčítání hlasem. Dcera ráda čte.
- Úkoly pro 1. až 3. třídu: fyzika, příroda, počítání, čtení a slova.
- Volný les + jednoduchý příběh + deník badatelky, čtyři roční období.

## Soubory
- `index.html`: stránka, styly, HUD, panel s textem, deník, zavaděč skriptů (three.js z CDN, záloha lokální `three.min.js`).
- `paint.js`: pomocné funkce a ručně malované textury (tah štětce, dlaždice země, kůra, voda).
- `world.js`: scéna. Vrstvy tahů (`DabLayer`) s barvou a velikostí pro každé období, stromy, země (shader s paletou podle období a maskou světla a stínu), postavy, zvířata, čtyři místa (`PLACES`), počasí, `paintSeason(a,b,t)`.
- `game.js`: pravidla. Chůze a kamera, dialogy (`say`, `ask`, `quiz`), osm úkolů (`TASKS`), odemykání období, deník, ukládání do localStorage.

Skripty jsou klasické (ne moduly) a sdílejí globální proměnné v pořadí paint, world, game.

## Konvence
- Index období: 0 JARO, 1 LÉTO, 2 PODZIM, 3 ZIMA. Pořadí odemykání `ORDER=[2,3,0,1]`.
- Každý úkol je `async` funkce; odchod z úkolu ji ruší přes `cancelFlow()`.
- Nový úkol: funkce `tNeco`, záznam v `TASKS` (období, místo, text do deníku), případně rekvizity ve `world.js` a jejich viditelnost v `refreshProps()`.

## Testování
- `window.__les` zpřístupňuje stav (`st`, `TASKS`, `runTask`, `changeSeason`, `correct`).
- `window.__fast = 10` zrychlí čas hry, hodí se pro automatický průchod.
- Adresa s `#vse` odemkne všechna období.
- Ověřeno automaticky v headless Chrome: všech osm úkolů včetně špatných odpovědí, odemčení zimy, rozložení 1024x768.
- Neověřeno na skutečném zařízení: plynulost na PC a tabletu, ovládání prstem.

## Známé slabiny a nápady
- Tahy jsou ploché, chybí plastická barva, vržené stíny postav a slunce v mlze; smrky působí prkenně.
- Obtížnost je jedna (počítání do 10, slova o 3 až 5 písmenech); chybí volba pro 2. a 3. třídu.
- Osm úkolů je málo na delší hraní.
- Postup se nepřenáší mezi zařízeními.
