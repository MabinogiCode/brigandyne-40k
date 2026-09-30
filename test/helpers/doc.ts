/**
 * Utilitaires de test : lecture du document d'adaptation « Warhammer 40.000 :
 * Brigandyne » (tools/source/01_brigandyne_40k.md, extrait du .docx) et des
 * compendiums (packs/_source). Parseur volontairement INDÉPENDANT de l'importeur.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DOC = readFileSync(join(ROOT, "tools", "source", "01_brigandyne_40k.md"), "utf-8");

/** Texte du document entre deux repères (le 1er repère inclus, le 2nd exclu). */
export function section(start: RegExp, end?: RegExp): string {
  const a = DOC.search(start);
  if (a < 0) throw new Error("section introuvable : " + start);
  const head = DOC.slice(a).match(start)![0].length;
  const b = end ? DOC.slice(a + head).search(end) : -1;
  return b < 0 ? DOC.slice(a) : DOC.slice(a, a + head + b);
}

/** Normalise un nom : apostrophes/espaces/casse (le docx mêle ’ et ', double espaces…). */
export const norm = (s: string): string =>
  String(s ?? "").replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

const clean = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Tables markdown d'un texte : liste de tables, chacune = lignes de cellules (séparateurs retirés). */
export function tables(text: string): string[][][] {
  const out: string[][][] = [];
  let cur: string[][] | null = null;
  for (const line of text.split("\n")) {
    if (line.trim().startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map(clean);
      (cur ??= []).push(cells);
    } else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out.map(rows => rows.filter(r => !r.every(c => /^-+$/.test(c) || c === "")));
}

/** Ligne de catégorie d'un tableau (toutes les cellules identiques : « Armes laser | Armes laser | … »). */
export const isCategoryRow = (cells: string[]): boolean => cells.length >= 2 && cells.every(c => c === cells[0]) && cells[0] !== "";

/** Lignes de données d'un tableau (sans en-tête ni lignes de catégorie). */
export function dataRows(table: string[][]): string[][] {
  return table.slice(1).filter(r => !isCategoryRow(r) && r[0]);
}

/** Documents JSON d'un compendium ; les dossiers (clé `!folders!`) sont séparés. */
export function loadPack(pack: string): { docs: any[]; folders: Record<string, string> } {
  const dir = join(ROOT, "packs", "_source", pack);
  const all = readdirSync(dir).filter(f => f.endsWith(".json")).map(f => JSON.parse(readFileSync(join(dir, f), "utf-8")));
  const folders: Record<string, string> = {};
  for (const d of all) if (String(d._key ?? "").startsWith("!folders!")) folders[d._id] = d.name;
  return { docs: all.filter(d => !String(d._key ?? "").startsWith("!folders!")), folders };
}

/** Nombre d'un texte du document : « +3 » → 3, « -5% » → -5, « - » → 0, « 12 (2) » → 12, « 1.500 » → 1500. */
export function num(s: string): number {
  const t = clean(s).replace(/\./g, "");
  const m = t.match(/[+\-−–]?\s*\d+/);
  return m ? parseInt(m[0].replace(/[−–]/g, "-").replace(/\s/g, ""), 10) : 0;
}

/** Dégâts d'une arme : « *FOR*-1 » → {for, -1} ; « +5 » → {flat, 5} ; « (+2) » → {flat, 2}. */
export function damage(s: string): { base: "for" | "flat"; mod: number } {
  const t = clean(s).replace(/\*/g, "");
  if (/FOR/i.test(t)) {
    const m = t.match(/FOR\s*([+\-−–]\s*\d+)/i);
    return { base: "for", mod: m ? parseInt(m[1].replace(/[−–]/g, "-").replace(/\s/g, ""), 10) : 0 };
  }
  return { base: "flat", mod: num(t) };
}

/** « Perce-armure (2) » → « perceArmure(2) » : jetons du texte « Spécial » → clés de qualités du système. */
const QUALITY_TOKENS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^perce[- ]?armure\s*\((\d+)\)/i, m => `perceArmure(${m[1]})`],
  [/^destruction/i, () => "destruction"],
  [/^ignore\s+(les\s+)?boucliers?/i, () => "ignoreBoucliers"],
  [/^ignore\s+les\s+armures/i, () => "ignoreArmures"],
  [/^semi[- ]?automatique/i, () => "semiAutomatique"],
  [/^automatique/i, () => "automatique"],
  [/^chargement\s*\((\d+)\)/i, m => `chargement(${m[1]})`],
  [/^lourde/i, () => "lourde"],
  [/^pr[ée]cis/i, () => "precis"],
  [/^souffle\s*\((\d+)\)/i, m => `souffle(${m[1]})`],
  [/^surchauffe/i, () => "surchauffe"],
  [/^rayon\s*\((\d+)\)/i, m => `rayon(${m[1]})`],
  [/^poison/i, () => "poison"],
  [/^viseur/i, () => "viseur"],
  [/^espace/i, () => "espace"],
  [/^choc/i, () => "choc"],
  [/^charge$/i, () => "charge"],
  [/^saisie/i, () => "saisie"],
  [/^tron[cç]onneuse/i, () => "tronconneuse"],
  [/^corps[- ]?à[- ]?corps/i, () => "corpsACorps"],
  [/^[ée]lectrique/i, () => "electrique"],
  [/^risqu[ée]e/i, () => "risquee"],
  [/^force$/i, () => "force"],
  [/^d[ée]g[âa]ts temporaires/i, () => "degatsTemporaires"],
  [/^initiative\s*([–\-−]\s*\d+)/i, m => `initiative(${parseInt(m[1].replace(/[–−]/g, "-").replace(/\s/g, ""), 10)})`],
  [/^point faible|^poing faible/i, () => "pointFaible"],
  [/^couvert\s*\((\d+)\)/i, m => `couvert(${m[1]})`],
  [/^d[ée]cupleur/i, () => "decupleur"]
];

/** Clés « qualité(rang) » d'un texte « Spécial » ; les jetons non reconnus sont renvoyés à part. */
export function qualitiesOf(special: string): { keys: string[]; unknown: string[] } {
  const keys: string[] = [], unknown: string[] = [];
  const parts = clean(special).replace(/\s+(Initiative)/g, ", $1").split(/,/).map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    let hit = false;
    for (const [re, mk] of QUALITY_TOKENS) {
      const m = part.match(re);
      if (m) { keys.push(mk(m)); hit = true; break; }
    }
    if (!hit) unknown.push(part);
  }
  return { keys: keys.sort(), unknown };
}

/** Clés « qualité(rang) » d'un objet du compendium. */
export const packQualities = (doc: any): string[] =>
  (doc.system.qualities ?? []).map((q: any) => q.value != null ? `${q.key}(${q.value})` : q.key).sort();
