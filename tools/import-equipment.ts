/**
 * Génère le compendium « Équipement & améliorations » (packs/_source/equipment)
 * depuis le document d'adaptation « Warhammer 40.000 : Brigandyne »
 * (tools/source/01_brigandyne_40k.md) : listes de prix (nourriture, logement,
 * vêtements, objets, survie, outils, technologie, drogues, services), améliorations
 * d'armes et d'armures, effets des drogues.
 *
 * Script dédié et idempotent : il ne touche qu'à packs/_source/equipment
 * (l'importeur général `import-content.ts` est obsolète, voir son en-tête).
 *
 *   node tools/import-equipment.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOC = fs.readFileSync(path.join(ROOT, "tools", "source", "01_brigandyne_40k.md"), "utf8");
const OUT = path.join(ROOT, "packs", "_source", "equipment");

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/** Identifiant déterministe de 16 caractères (même algorithme que l'importeur général). */
function makeId(prefix: string, name: string): string {
  const base = (prefix + ":" + name).normalize("NFKD");
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < base.length; i++) {
    h1 = ((h1 << 5) + h1 + base.charCodeAt(i)) >>> 0;
    h2 = ((h2 << 5) + h2 + base.charCodeAt(base.length - 1 - i)) >>> 0;
  }
  const s = [h1, h2, (h1 ^ h2) >>> 0, (h1 + h2) >>> 0].map(c => c.toString(36)).join("") + "0000000000000000";
  let id = "";
  for (let i = 0; i < 16; i++) id += ID_CHARS[s.charCodeAt(i) % ID_CHARS.length];
  return id;
}

const clean = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();
const parsePrice = (s: string) => { const m = clean(s).match(/([\d.]+)/); return m ? parseInt(m[1].replace(/\./g, "")) : 0; };

/** Texte d'une section entre deux repères. */
function between(start: RegExp, end: RegExp): string {
  const a = DOC.search(start);
  if (a < 0) throw new Error("section introuvable : " + start);
  const rest = DOC.slice(a + 1);
  const b = rest.search(end);
  return DOC.slice(a, b < 0 ? undefined : a + 1 + b);
}

type Entry = { name: string; category: string; price: number; effect: string; perNight?: boolean };
const entries: Entry[] = [];

/* --- Listes de prix « nom<TAB>prix » -------------------------------------------------- */
const LIST_SECTIONS = ["Nourriture et boissons", "Logement", "Vêtements", "Objets divers", "Survie", "Outils", "Technologie", "Drogues et substances", "Services, salaire moyen par jour"];
for (const title of LIST_SECTIONS) {
  const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = between(new RegExp(`^### ${esc}`, "m"), /\n#{1,3} /);
  for (const raw of block.split("\n").slice(1)) {
    if (!raw.includes("\t")) continue;
    const m = raw.match(/^(.*?)\t+\s*(?:\(([^)]*)\)\s*\t+\s*)?([\d.]+)(\/nuit)?\s*$/);
    if (!m) continue;
    let name = clean(m[1]);
    let effect = "";
    const tag = m[2] ? `(${clean(m[2])})` : "";
    const colon = name.match(/^(.*?)\s+:\s+(.*)$/);
    if (colon) { name = clean(colon[1]); effect = clean(colon[2]); }
    // « Frénézon (Injecteur/Drogue) » : le qualificatif entre parenthèses reste dans la description
    const paren = name.match(/^(.*?)\s*\(((?:Injecteur|Drogue)[^)]*)\)$/);
    if (paren) { name = clean(paren[1]); effect = clean(`(${paren[2]}) ${effect}`); }
    if (tag) effect = clean(`${tag} ${effect}`);
    if (!name) continue;
    entries.push({ name, category: title === "Services, salaire moyen par jour" ? "Services (salaire par jour)" : title, price: parsePrice(m[3]), effect, perNight: !!m[4] });
  }
}

/* --- Effets des drogues (tableau Nom | Effet) ----------------------------------------- */
const drugEffects = new Map<string, string>();
for (const line of between(/^## Effets des drogues\/substances/m, /\n# /).split("\n")) {
  const cells = line.split("|").slice(1, -1).map(clean);
  if (cells.length === 2 && cells[0] && cells[0] !== "Nom" && !/^-+$/.test(cells[0])) drugEffects.set(cells[0], cells[1]);
}
for (const e of entries.filter(e => e.category === "Drogues et substances")) {
  const eff = drugEffects.get(e.name);
  if (eff) e.effect = clean(`${e.effect} ${eff}`);
}

/* --- Améliorations d'armes et d'armures (tableau Amélioration | Effet | Description | Prix) --- */
let category = "";
for (const line of between(/^### Améliorations/m, /\n## /).split("\n")) {
  const cells = line.split("|").slice(1, -1).map(clean);
  if (cells.length < 4 || cells[0] === "Amélioration" || /^-+$/.test(cells[0]) || !cells[0]) continue;
  if (cells.every(c => c === cells[0])) { category = cells[0].replace(/^Amélioration d[’']/, "Amélioration d’"); continue; }
  const [name, effect, description, price] = cells;
  entries.push({ name, category, price: parsePrice(price), effect: clean(`${effect} ${description}`) });
}

/* --- Objet de départ cité par le document mais absent de ses listes de prix --------------- */
// Possession de départ des Psykers (« Psyconduit ») : la version de base n'a pas de bonus ; les versions riche/relique sont dans « Outils ».
entries.push({
  name: "Psyconduit", category: "Outils", price: 0,
  effect: "Relique ou objet courant (sceptre, bâton de pouvoir, osselets sculptés…) qui aide le Psyker à canaliser ses pouvoirs. Sans bonus ; les versions riche (+5 %) et relique (+10 %) en apportent aux tests de PSY."
});

/* --- Écriture ------------------------------------------------------------------------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const folders = [...new Set(entries.map(e => e.category))];
const folderId = (c: string) => makeId("folder", "equipment:" + c);
folders.forEach((c, i) => {
  const _id = folderId(c);
  const doc = { _id, _key: `!folders!${_id}`, name: c, type: "Item", sorting: "a", color: null, folder: null, sort: (i + 1) * 100, flags: {} };
  fs.writeFileSync(path.join(OUT, `_dossier_${i + 1}_${_id}.json`), JSON.stringify(doc, null, 2), "utf8");
});
for (const e of entries) {
  const _id = makeId("equipment", e.category + ":" + e.name);
  const effect = e.perNight ? clean(`${e.effect} (prix par nuit)`) : e.effect;
  const doc = {
    _id, name: e.name, type: "equipment", img: "icons/svg/item-bag.svg",
    system: {
      category: e.category, effect, description: effect ? `<p>${effect}</p>` : "",
      quantity: 1, weight: 0, price: e.price, source: "40K"
    },
    folder: folderId(e.category)
  };
  const safe = e.name.replace(/[^a-zA-Z0-9À-ÿ]+/g, "_").slice(0, 40);
  fs.writeFileSync(path.join(OUT, `${safe}_${_id}.json`), JSON.stringify(doc, null, 2), "utf8");
}
console.log(`equipment : ${entries.length} objets dans ${folders.length} dossiers → packs/_source/equipment`);
