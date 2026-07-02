/**
 * Importeur de contenu : transforme les .md extraits des .docx d'adaptation
 * en sources JSON de compendiums (packs/_source/<pack>/*.json).
 *
 *   node tools/import-content.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(__dirname, "source");
const OUT = path.join(ROOT, "packs", "_source");

const DOC1 = fs.readFileSync(path.join(SRC, "01_brigandyne_40k.md"), "utf8");
const DOC_XENO = fs.readFileSync(path.join(SRC, "02_armurerie_xeno.md"), "utf8");
const DOC_BEST = fs.readFileSync(path.join(SRC, "03_rencontres.md"), "utf8");
// Descriptions d'atouts extraites du Livre Premier (tools/extract_atouts.py) — optionnel
let ATOUTS = { specialties: {}, talentLines: [] };
try { ATOUTS = JSON.parse(fs.readFileSync(path.join(SRC, "pdf", "atouts.json"), "utf8")); }
catch { console.warn("  (atouts.json absent : lancez `python tools/extract_atouts.py` pour les descriptions du Livre I)"); }

/** Reconstruit les descriptions de talents en segmentant les lignes du Livre I sur les noms connus. */
function livre1TalentDescs(names) {
  const set = new Set(names);
  const out = {}; let cur = null;
  for (const raw of ATOUTS.talentLines ?? []) {
    const line = (raw ?? "").trim();
    if (set.has(line)) { cur = line; out[cur] = ""; }
    else if (cur) out[cur] = out[cur].endsWith("-") ? out[cur].slice(0, -1) + line : (out[cur] ? out[cur] + " " : "") + line;
  }
  return out;
}
const baseAtout = n => n.replace(/\s*[([].*$/, "").trim();

/* ------------------------------------------------------------------ */
/*  Utilitaires                                                        */
/* ------------------------------------------------------------------ */
const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function makeId(prefix, name) {
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
const clean = s => (s ?? "").replace(/\s+/g, " ").trim();
const sectionBetween = (doc, startRe, endRe) => {
  const a = doc.search(startRe); if (a < 0) return "";
  const rest = doc.slice(a);
  const b = endRe ? rest.slice(1).search(endRe) : -1;
  return b < 0 ? rest : rest.slice(0, b + 1);
};
function tablesIn(text) {
  // Renvoie la liste des tables (chacune = tableau de lignes-cellules), en
  // gardant l'ordre. Une table = lignes consécutives commençant par "|".
  const out = [];
  let cur = null;
  for (const line of text.split("\n")) {
    if (line.trim().startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map(c => c.trim());
      (cur ??= []).push(cells);
    } else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  // retire la ligne séparatrice "---"
  return out.map(rows => rows.filter(r => !r.every(c => /^-+$/.test(c) || c === "")));
}
const isCategoryRow = cells => cells.length >= 2 && cells.every(c => c === cells[0]) && cells[0] !== "";

function writePack(name, docs) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const d of docs) {
    const safe = clean(d.name).replace(/[^a-zA-Z0-9À-ÿ]+/g, "_").slice(0, 40);
    fs.writeFileSync(path.join(dir, `${safe}_${d._id}.json`), JSON.stringify(d, null, 2), "utf8");
  }
  console.log(`  ${name}: ${docs.length}`);
  return docs.length;
}

function appendPack(name, docs) {
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const d of docs) {
    const safe = clean(d.name).replace(/[^a-zA-Z0-9À-ÿ]+/g, "_").slice(0, 40);
    fs.writeFileSync(path.join(dir, `${safe}_${d._id}.json`), JSON.stringify(d, null, 2), "utf8");
  }
  console.log(`  ${name}: +${docs.length} (ajout)`);
}

/* ------------------------------------------------------------------ */
/*  Dossiers de compendium (sous-catégories)                           */
/* ------------------------------------------------------------------ */
function folderId(pack, key) { return makeId("folder", pack + ":" + key); }
/** Crée les documents-dossiers d'un pack. defs = [{key,name,color?}]. */
function makeFolderDocs(pack, docType, defs) {
  return defs.map((d, i) => {
    const _id = folderId(pack, d.key);
    return { _id, _key: `!folders!${_id}`, name: d.name, type: docType, sorting: "a", color: d.color ?? null, folder: null, sort: (i + 1) * 100, flags: {} };
  });
}
/** Affecte chaque doc à un dossier via une fonction de clé. */
function assignFolder(docs, pack, keyOf) {
  for (const d of docs) { const k = keyOf(d); if (k != null && k !== "") d.folder = folderId(pack, String(k)); }
}
const FACTION_LABEL = { administratum: "Adeptus Administratum", arbites: "Adeptus Arbites", mechanicus: "Adeptus Mechanicus", ministorum: "Adeptus Ministorum", militarum: "Astra Militarum", feodal: "Mondes féodaux", civils: "Civils", assassinorum: "Officio Assassinorum", psykana: "Adeptus Astra Telepathica", inquisition: "Inquisition", xenos: "Xenos", chaos: "Chaos" };

const parseSignedPct = s => { const m = clean(s).match(/([+-]?\d+)/); return m ? parseInt(m[1]) : 0; };
const parsePrice = s => { const m = clean(s).match(/([\d.]+)/); return m ? parseInt(m[1].replace(/\./g, "")) : 0; };
function parsePlaces(s) {
  const m = clean(s).match(/([\d.]+)\s*(?:\((\d+)\))?/);
  return { places: m ? parseInt(m[1].replace(/\./g, "")) : 0, pilotsMin: m && m[2] ? parseInt(m[2]) : 1 };
}

/* ------------------------------------------------------------------ */
/*  VÉHICULES (+ armements véhicule/vaisseau)                          */
/* ------------------------------------------------------------------ */
function importVehicles() {
  const vehicles = [], vweapons = [];
  const section = sectionBetween(DOC1, /## Liste de véhicules/, /# Combat/);
  let vtype = "terrestre";
  for (const part of section.split(/^###?#?\s+/m)) {
    const head = clean(part.split("\n")[0]);
    if (/terrestres/i.test(head)) vtype = "terrestre";
    else if (/volants/i.test(head)) vtype = "volant";
    else if (/spatiaux|Vaisseaux/i.test(head)) vtype = "spatial";
    for (const rows of tablesIn(part)) {
      const h0 = clean(rows[0][0]);
      if (/^Véhicule$/i.test(h0)) {
        for (const r of rows.slice(1)) {
          if (isCategoryRow(r) || !clean(r[0])) continue;
          const pl = parsePlaces(r[5]);
          const struct = parseInt(clean(r[7])) || 10;
          vehicles.push({
            _id: makeId("vehicle", r[0] + vtype), name: clean(r[0]), type: "vehicle", img: "icons/svg/cannon.svg",
            system: {
              vehicleType: vtype, size: parseInt(clean(r[1])) || 2, maneuver: parseSignedPct(r[2]), speed: parseSignedPct(r[3]),
              places: pl.places, pilotsMin: pl.pilotsMin, pv: { value: struct, max: struct, bonus: 0 },
              protection: { base: parseInt(clean(r[6])) || 0, mod: 0 }, resistance: true, price: parsePrice(r[8]),
              specialText: clean(r[4]), biography: ""
            }
          });
        }
      } else if (/^Arme$/i.test(h0)) {
        const isShip = vtype === "spatial";
        for (const r of rows.slice(1)) {
          if (isCategoryRow(r) || !clean(r[0])) continue;
          let dmg, charges, range, special, price;
          if (r.length >= 7) { dmg = r[2]; charges = r[3]; range = r[4]; special = r[5]; price = r[6]; }
          else { dmg = r[2]; charges = null; range = r[3]; special = r[4]; price = r[5]; }
          const q = parseQualities(special);
          vweapons.push({
            _id: makeId("vweapon", r[0] + vtype), name: clean(r[0]), type: "weapon", img: "icons/svg/cannon.svg",
            system: {
              weaponType: "ranged", group: isShip ? "ship" : "vehicle", damageBase: "flat", damageMod: parseDamage(dmg).mod,
              range: parseInt(clean(range)) || 0, magazine: charges ? (parseInt(clean(charges)) || 0) : 0, ammoType: "",
              price: parsePrice(price), qualities: q.qualities, specialText: q.leftover, source: isShip ? "Vaisseau" : "Véhicule"
            }
          });
        }
      }
    }
  }
  assignFolder(vweapons, "weapons", d => d.system.group);   // dossiers "vehicle" / "ship"
  writePack("vehicles", vehicles);
  appendPack("weapons", vweapons);
  return vehicles.length;
}

/* ------------------------------------------------------------------ */
/*  Dégâts & qualités                                                  */
/* ------------------------------------------------------------------ */
function parseDamage(str) {
  const s = clean(str).replace(/\*/g, "");
  if (/FOR/i.test(s)) {
    const m = s.match(/FOR\s*([+-]\s*\d+)/i);
    return { base: "for", mod: m ? parseInt(m[1].replace(/\s/g, "")) : 0 };
  }
  const m = s.match(/([+-]?\d+)/);
  return { base: "flat", mod: m ? parseInt(m[1]) : 0 };
}

const QMAP = [
  [/perce[- ]?armure\s*\((\d+)\)/i, "perceArmure", true],
  [/destruction/i, "destruction"],
  [/ignore\s+bouclier/i, "ignoreBoucliers"],
  [/ignore\s+(les\s+)?armures|ignore\s+les\s+résistances/i, "ignoreArmures"],
  [/semi[- ]?automatique/i, "semiAutomatique"],
  [/automatique/i, "automatique"],
  [/chargement\s*\((\d+)\)/i, "chargement", true],
  [/lourde/i, "lourde"],
  [/précis|precis/i, "precis"],
  [/souffle\s*\((\d+)\)/i, "souffle", true],
  [/surchauffe/i, "surchauffe"],
  [/rayon\s*\((\d+)\)/i, "rayon", true],
  [/poison/i, "poison"],
  [/viseur/i, "viseur"],
  [/maniable\s*\+?(\d+)?/i, "maniable", true],
  [/espace/i, "espace"],
  [/choc/i, "choc"],
  [/charge/i, "charge"],
  [/saisie/i, "saisie"],
  [/tronçonneuse|tronconneuse/i, "tronconneuse"],
  [/corps[- ]?à[- ]?corps/i, "corpsACorps"],
  [/électrique|electrique/i, "electrique"],
  [/risquée|risquee/i, "risquee"],
  [/force\b/i, "force"],
  [/dégâts temporaires|degats temporaires/i, "degatsTemporaires"],
  [/initiative\s*([–-]\s*\d+)/i, "initiative", true]
];
function parseQualities(special) {
  const qualities = []; const leftover = [];
  for (let part of clean(special).split(/,|;/)) {
    part = part.trim(); if (!part || part === "Divers") continue;
    let matched = false;
    for (const [re, key, hasVal] of QMAP) {
      const m = part.match(re);
      if (m) {
        let value = null;
        if (hasVal && m[1]) value = parseInt(String(m[1]).replace(/[–\s]/g, m[1].includes("–") ? "-" : ""));
        if (key === "initiative" && m[1]) value = parseInt(m[1].replace(/[–\s]/g, "-"));
        qualities.push({ key, value: Number.isNaN(value) ? null : value });
        matched = true; break;
      }
    }
    if (!matched) leftover.push(part);
  }
  return { qualities, leftover: leftover.join(", ") };
}

/* ------------------------------------------------------------------ */
/*  ARMES                                                              */
/* ------------------------------------------------------------------ */
function importWeapons() {
  const docs = [];
  const add = (name, dmg, opts) => {
    if (!name || /^Divers$/i.test(name)) return;
    const id = makeId("weapon", name + (opts.faction || ""));
    docs.push({
      _id: id, name: clean(name), type: "weapon", img: "icons/svg/sword.svg",
      system: {
        weaponType: opts.weaponType, group: opts.group || "", damageBase: dmg.base, damageMod: dmg.mod,
        reach: opts.reach || "C", hands: opts.hands || 1, range: opts.range ?? 20,
        magazine: opts.magazine ?? 0, ammoType: opts.ammoType || "", price: opts.price ?? 0,
        qualities: opts.qualities || [], specialText: opts.leftover || "", source: opts.source || ""
      }
    });
  };

  // Mêlée principale
  let group = "";
  for (const rows of tablesIn(sectionBetween(DOC1, /## Armes de mêlée/, /## Armes à distance/))) {
    if (!rows.length || !/Arme/i.test(rows[0][0]) && rows[0].length < 4) continue;
    for (const r of rows.slice(1)) {
      if (isCategoryRow(r)) { group = clean(r[0]).toLowerCase(); continue; }
      const [name, dmg, reach, hands, special, price] = r;
      if (!name) continue;
      const q = parseQualities(special);
      add(name, parseDamage(dmg), { weaponType: "melee", reach: clean(reach), hands: parseInt(hands) || 1, price: parseInt(price) || 0, ...q, source: "L1" });
    }
  }
  // Distance principale
  for (const rows of tablesIn(sectionBetween(DOC1, /## Armes à distance/, /## Armures/))) {
    if (!rows.length) continue;
    for (const r of rows.slice(1)) {
      if (isCategoryRow(r)) continue;
      const [name, dmg, range, mag, special, ammo, price] = r;
      if (!name || /Arme$/i.test(name)) continue;
      const q = parseQualities(special);
      add(name, parseDamage(dmg), { weaponType: "ranged", range: parseInt(range) || 0, magazine: parseInt(mag) || 0, ammoType: clean(ammo), price: parseInt(price) || 0, ...q, source: "L1" });
    }
  }
  // Armurerie Xéno (par faction)
  let faction = "";
  for (const block of DOC_XENO.split(/^# /m)) {
    const fLine = block.split("\n")[0];
    if (/Peaux-vertes|Necron|Aeldari|T.au|Tau/i.test(fLine)) faction = clean(fLine);
    let mode = "";
    for (const seg of block.split(/^## /m)) {
      if (/Armes de mêlée/i.test(seg)) mode = "melee";
      else if (/Armes à distance/i.test(seg)) mode = "ranged";
      else continue;
      for (const rows of tablesIn(seg)) {
        for (const r of rows.slice(1)) {
          const name = r[0];
          if (!name || /^Arme$/i.test(name)) continue;
          const q = parseQualities(mode === "melee" ? r[4] : r[4]);
          if (mode === "melee") add(name, parseDamage(r[1]), { weaponType: "melee", group: "xeno", reach: clean(r[2]), hands: parseInt(r[3]) || 1, ...q, faction, source: "Xéno" });
          else add(name, parseDamage(r[1]), { weaponType: "ranged", group: "xeno", range: parseInt(r[2]) || 0, magazine: parseInt(r[3]) || 0, ammoType: clean(r[5]), ...q, faction, source: "Xéno" });
        }
      }
    }
  }
  assignFolder(docs, "weapons", d => d.system.weaponType);
  const WF = [{ key: "melee", name: "Armes de mêlée" }, { key: "ranged", name: "Armes à distance" }, { key: "vehicle", name: "Armes de véhicule" }, { key: "ship", name: "Armes de vaisseau" }, { key: "fantasy", name: "Armes médiévales (féodal)" }];
  return writePack("weapons", [...makeFolderDocs("weapons", "Item", WF), ...docs]);
}

/* ------------------------------------------------------------------ */
/*  ARMURES                                                            */
/* ------------------------------------------------------------------ */
function importArmor() {
  const docs = [];
  const coverMap = { partielle: "partielle", complète: "complete", complete: "complete", bonus: "bonus" };
  for (const rows of tablesIn(sectionBetween(DOC1, /## Armures/, /### Spécificités des armures/))) {
    for (const r of rows.slice(1)) {
      const [name, prot, notes, special, price] = r;
      if (!name || isCategoryRow(r)) continue;
      const n = clean(notes).toLowerCase();
      let coverage = "complete";
      for (const k of Object.keys(coverMap)) if (n.includes(k)) coverage = coverMap[k];
      const protM = clean(prot).match(/(\d+)/);
      const initM = clean(special).match(/init[^-–]*([–-]\s*\d+)/i);
      const mouM = clean(special).match(/MOU\s*([–-]\s*\d+)/i);
      const q = parseQualities(special.replace(/init[^,]*/i, "").replace(/MOU[^,]*/i, ""));
      docs.push({
        _id: makeId("armor", name), name: clean(name), type: "armor", img: "icons/svg/shield.svg",
        system: {
          protection: protM ? parseInt(protM[1]) : 1, coverage,
          initiativeMod: initM ? parseInt(initM[1].replace(/[–\s]/g, "-")) : 0,
          mouMod: mouM ? parseInt(mouM[1].replace(/[–\s]/g, "-")) : 0,
          longToDon: /longue à mettre/i.test(special), qualities: q.qualities, specialText: q.leftover,
          price: parseInt(price) || 0, source: "L1"
        }
      });
    }
  }
  assignFolder(docs, "armor", d => d.system.coverage);
  const AF = [{ key: "partielle", name: "Armures partielles" }, { key: "complete", name: "Armures complètes" }, { key: "bonus", name: "Boucliers & casques" }];
  return writePack("armor", [...makeFolderDocs("armor", "Item", AF), ...docs]);
}

/* ------------------------------------------------------------------ */
/*  MUNITIONS                                                          */
/* ------------------------------------------------------------------ */
function importAmmo() {
  const docs = [];
  for (const rows of tablesIn(sectionBetween(DOC1, /### Munitions/, /### Améliorations/))) {
    for (const r of rows.slice(1)) {
      const [name, effect, price] = r;
      if (!name || isCategoryRow(r)) continue;
      docs.push({
        _id: makeId("ammo", name), name: clean(name), type: "ammunition", img: "icons/svg/target.svg",
        system: { ammoType: clean(name), effect: clean(effect), price: parseInt(price) || 0, source: "L1" }
      });
    }
  }
  return writePack("ammunition", docs);
}

/* ------------------------------------------------------------------ */
/*  POUVOIRS PSY & ACTES DE FOI                                        */
/* ------------------------------------------------------------------ */
const DISC_BY_HEADING = {
  "Pouvoirs génériques": "generique", "Biomancie": "biomancie", "Divination": "divination",
  "Pyromancie": "pyromancie", "Télékinésie": "telekinesie", "Télépathie": "telepathie"
};
function parsePowerMeta(diffLine, resLine) {
  const g = (re, s) => { const m = (s || "").match(re); return m ? clean(m[1]) : ""; };
  return {
    difficulty: parseInt((g(/Difficulté\s*:\s*([+-]?\d+)/i, diffLine) || "0")) || 0,
    duration: g(/Durée\s*:\s*([^\/]+)/i, diffLine),
    range: g(/Portée\s*:\s*([^\/]+)/i, diffLine),
    resistance: g(/Résistance\s*:\s*([^\/]+)/i, resLine),
    rPlus: g(/R\+\s*:\s*(.+)$/i, resLine)
  };
}
function detectDamage(effect) {
  const m = clean(effect).match(/RU\s*\+\s*\*?(PSY|VOL|FOR)\*?/i);
  return m ? `RU+${m[1].toUpperCase()}` : "";
}
function splitMinors(blob) {
  const out = [];
  const parts = clean(blob).split(/\s{2,}(?=[A-ZÀ-Ÿ][\wÀ-ÿ'’ -]{1,32}\s*:)/);
  for (const p of parts) {
    const m = p.match(/^([^:]{2,40})\s*:\s*(.+)$/);
    if (m) out.push({ name: clean(m[1]), effect: clean(m[2]) });
  }
  return out;
}
function importPowers() {
  const docs = [];
  const section = sectionBetween(DOC1, /## Pouvoirs et Domaines/, /## Dangers psychiques/);
  let discipline = "generique";
  for (const part of section.split(/^####\s+/m)) {
    const head = clean(part.split("\n")[0]);
    if (DISC_BY_HEADING[head]) discipline = DISC_BY_HEADING[head];
    for (const rows of tablesIn(part)) {
      const header = rows[0];
      // table à 3 colonnes = vue d'ensemble des disciplines -> ignorer
      if (header.length >= 3) continue;
      // bloc "Pouvoirs mineurs"
      if (header.length === 1 && /Pouvoirs mineurs/i.test(header[0])) {
        if (rows[1]) for (const mp of splitMinors(rows[1][0])) {
          docs.push({ _id: makeId("power", mp.name + discipline), name: mp.name, type: "psychicPower", img: "icons/svg/explosion.svg",
            system: { discipline, isMinor: true, difficulty: 0, effect: `<p>${mp.effect}</p>`, description: `<p>${mp.effect}</p>`, source: "L1" } });
        }
        continue;
      }
      // table de détail à 2 colonnes
      if (header.length === 2 && rows.length >= 4) {
        for (let c = 0; c < 2; c++) {
          const name = clean(header[c]);
          if (!name || /Pouvoirs mineurs|Difficulté/i.test(name)) continue;
          const meta = parsePowerMeta(rows[1][c], rows[2][c]);
          const effect = clean(rows[3][c]);
          if (!effect) continue;
          docs.push({ _id: makeId("power", name + discipline), name, type: "psychicPower", img: "icons/svg/explosion.svg",
            system: { discipline, isMinor: false, ...meta, damage: detectDamage(effect), effect: `<p>${effect}</p>`, description: `<p>${effect}</p>`, source: "L1" } });
        }
      }
    }
  }
  const DISC = [["generique", "Pouvoirs génériques"], ["biomancie", "Biomancie"], ["divination", "Divination"], ["pyromancie", "Pyromancie"], ["telekinesie", "Télékinésie"], ["telepathie", "Télépathie"]];
  assignFolder(docs, "psychic-powers", d => d.system.discipline);
  return writePack("psychic-powers", [...makeFolderDocs("psychic-powers", "Item", DISC.map(([key, name]) => ({ key, name }))), ...docs]);
}
function importFaith() {
  const docs = [];
  const section = sectionBetween(DOC1, /### Actes de Foi/, /# WIP/);
  for (const rows of tablesIn(section)) {
    const header = rows[0];
    if (header.length !== 2 || rows.length < 4) continue;
    for (let c = 0; c < 2; c++) {
      const raw = clean(header[c]);
      if (!raw || /Actes de Foi|Difficulté/i.test(raw)) continue;
      const isMiracle = /miracle/i.test(raw);
      const name = raw.replace(/\s*\(Miracle\)/i, "");
      const meta = parsePowerMeta(rows[1][c], rows[2][c]);
      const effect = clean(rows[3][c]);
      docs.push({ _id: makeId("faith", name), name, type: "faithAct", img: "icons/svg/angel.svg",
        system: { isMiracle, ...meta, damage: detectDamage(effect), effect: `<p>${effect}</p>`, description: `<p>${effect}</p>`, source: "L1" } });
    }
  }
  assignFolder(docs, "faith-acts", d => d.system.isMiracle ? "miracle" : "acte");
  return writePack("faith-acts", [...makeFolderDocs("faith-acts", "Item", [{ key: "acte", name: "Actes de Foi" }, { key: "miracle", name: "Miracles" }]), ...docs]);
}

/* ------------------------------------------------------------------ */
/*  ESPÈCES                                                            */
/* ------------------------------------------------------------------ */
function importSpecies() {
  const SP = {
    humain: { base: [25,25,25,25,25,25,0,25,25,25,25,25,25], destin: 3, special: [] },
    squat: { base: [30,25,25,30,25,30,0,20,20,20,20,20,30], destin: 2, special: ["nyctalopie","sfPlus1","pvPlus1"], limits: { mou: 60 } },
    ratling: { base: [25,20,30,20,15,30,0,30,30,20,25,30,25], destin: 3, special: [], limits: { com: 75, for: 45 } },
    ogryn: { base: [35,10,10,40,50,15,0,20,20,15,30,25,30], destin: 1, special: ["pvPlus2","resMaladies"], limits: { cns: 30, soc: 50 } },
    mutant: { base: [25,25,25,30,25,25,0,25,25,15,25,25,30], destin: 2, special: ["mutations"], limits: { soc: 50 } },
    aeldari: { base: [25,25,25,20,20,25,10,30,25,25,20,30,20], destin: 2, special: ["nyctalopie"], limits: { for: 60 } },
    paria: { base: [25,25,25,25,25,25,0,25,25,15,25,25,35], destin: 1, special: ["geneParia"], noPsy: true }
  };
  const KEYS = ["com","cns","dis","end","for","tec","psy","mou","per","soc","sur","tir","vol"];
  const LABEL = { humain:"Humain", squat:"Squat", ratling:"Ratling", ogryn:"Ogryn", mutant:"Mutant", aeldari:"Aeldari", paria:"Paria" };
  const LORE = {
    humain: { d: "L'espèce majoritaire de l'Imperium, répandue sur d'innombrables mondes et adaptée à tous les environnements. Adaptables et tenaces, mais avides de pouvoir et de conquête.", life: "≈ 60 ans", size: "~1m70, 65 kg (H) / 1m60, 50 kg (F)" },
    squat: { d: "Abhumains ayant évolué sur des mondes à forte gravité : trapus et petits. Vaillants, opiniâtres, d'une constitution robuste et ingénieurs hors pair.", life: "≈ 100 ans", size: "~1m50, 70 kg (H) / 1m40, 60 kg (F)" },
    ratling: { d: "Petits Abhumains des Militarum Auxilla. Grossiers et sans-gêne, mais tireurs d'élite inégalés et survivants tenaces des pires zones de combat.", life: "≈ 60 ans", size: "~1m30, 50 kg (H) / 1m25, 45 kg (F)" },
    ogryn: { d: "Souche d'Abhumains colossaux, simples d'esprit mais d'une force légendaire. Leurs armes (fusils ripeurs, mantelets) sont conçues pour résister à leur maladresse.", life: "≈ 60 ans", size: "~2m50, 120 kg (H) / 2m30, 100 kg (F)" },
    mutant: { d: "Humains marqués par une déviance génétique stable. Tolérés mais considérés comme les plus impies des Abhumains, rejetés et relégués aux places les plus basses.", life: "≈ 60 ans", size: "~1m70, 65 kg (H) / 1m60, 50 kg (F)" },
    aeldari: { d: "Xenos élancés et gracieux, aux traits fins et aux mouvements surhumains. Rares dans l'Imperium, où on les considère au mieux comme des parias, au pire comme des ennemis.", life: "≈ 900 ans", size: "~1m70, 60 kg (H) / 1m60, 50 kg (F)" },
    paria: { d: "Êtres rarissimes nés sans écho dans le Warp (le Gène du Paria). Leur présence désoriente et terrifie les Psykers proches, mais glace aussi les âmes alentour.", life: "≈ 60 ans", size: "~1m70, 65 kg (H) / 1m60, 50 kg (F)" }
  };
  const docs = [];
  for (const [key, sp] of Object.entries(SP) as Array<[string, any]>) {
    const base: Record<string, number> = {}; KEYS.forEach((k, i) => base[k] = sp.base[i]);
    const limits: Record<string, number | null> = {}; KEYS.forEach(k => limits[k] = sp.limits?.[k] ?? null);
    const lore = LORE[key] ?? {};
    docs.push({ _id: makeId("species", key), name: LABEL[key], type: "species", img: "icons/svg/mystery-man.svg",
      system: { base, limits, destin: sp.destin, special: sp.special, noPsy: !!sp.noPsy, description: lore.d ? `<p>${lore.d}</p>` : "", lifespan: lore.life ?? "", sizeNote: lore.size ?? "", source: "L1" } });
  }
  return writePack("species", docs);
}

/* ------------------------------------------------------------------ */
/*  CARRIÈRES (+ collecte talents/spécialités)                          */
/* ------------------------------------------------------------------ */
const FACTION_BY_HEADING = [
  [/Administratum/i, "administratum"], [/Arbites/i, "arbites"], [/Mechanicus/i, "mechanicus"],
  [/Ministorum|Sororitas/i, "ministorum"], [/Astra Militarum/i, "militarum"],
  [/Assassinorum/i, "assassinorum"], [/Psykana/i, "psykana"], [/Civils|institutions/i, "civils"]
];
const talentNames = new Set(), specialtyNames = new Set();
function importCareers() {
  const docs = [];
  const KEYS1 = ["com","cns","dis","end","for","tec","psy"];
  const KEYS2 = ["mou","per","soc","sur","tir","vol"];
  const section = sectionBetween(DOC1, /# Carrières/, /# Atouts/);
  let faction = "civils";
  for (const part of section.split(/^##+\s+/m)) {
    const head = clean(part.split("\n")[0]);
    for (const [re, f] of FACTION_BY_HEADING as Array<[RegExp, string]>) if (re.test(head)) faction = f;
    for (const rows of tablesIn(part)) {
      if (rows.length < 10 || rows[0].length < 14) continue;
      const findRow = (label) => rows.find(r => new RegExp("^" + label, "i").test(clean(r[0])));
      for (const [cStart, cMid] of [[0, 1], [8, 9]]) {
        const name = clean(rows[0][cStart]);
        if (!name || name === "Niveau de vie" || /^COM$/.test(name)) continue;
        const advances = {};
        const charHdr = rows.find(r => /^COM$/i.test(clean(r[0])));
        const charValRow = charHdr ? rows[rows.indexOf(charHdr) + 1] : null;
        const mouHdr = rows.find(r => /^MOU$/i.test(clean(r[0])));
        const mouValRow = mouHdr ? rows[rows.indexOf(mouHdr) + 1] : null;
        if (charValRow) KEYS1.forEach((k, i) => advances[k] = parseInt(charValRow[cStart + i]) || 0);
        if (mouValRow) KEYS2.forEach((k, i) => advances[k] = parseInt(mouValRow[cStart + i]) || 0);
        const lifeRow = findRow("Niveau de vie");
        const specRow = findRow("Spécialités");
        const talRow = findRow("Talents");
        const eqRow = findRow("Equipements");
        const quote = clean(rows[1]?.[cStart] || "").replace(/^"|"$/g, "");
        const desc = clean(rows[2]?.[cStart] || "");
        const lifestyleTxt = clean(lifeRow?.[cStart + 2] || "ordinaire").toLowerCase();
        const lsMap = { misérable:"miserable", pauvre:"pauvre", ordinaire:"ordinaire", aisé:"aise", riche:"riche", royal:"royal" };
        let lifestyle = "ordinaire"; for (const k of Object.keys(lsMap)) if (lifestyleTxt.includes(k)) lifestyle = lsMap[k];
        const splitList = s => clean(s).split(/,| ou /).map(x => x.trim()).filter(x => x && x.length > 1 && !/^Spécialités$|^Talents$/i.test(x));
        const specs = splitList(specRow?.[cStart + 2] || "");
        const tals = splitList(talRow?.[cStart + 2] || "");
        specs.forEach(s => specialtyNames.add(s));
        tals.forEach(t => talentNames.add(t));
        docs.push({ _id: makeId("career", name + faction), name, type: "career", img: "icons/svg/book.svg",
          system: { faction, quote, advances, lifestyle, specialties: specs, talents: tals,
            startingEquipment: `<p>${clean(eqRow?.[cStart + 2] || "")}</p>`, description: `<p>${desc}</p>`, source: "L1" } });
      }
    }
  }
  assignFolder(docs, "careers", d => d.system.faction);
  const FACTION_ORDER = ["administratum", "arbites", "mechanicus", "ministorum", "militarum", "assassinorum", "psykana", "inquisition", "feodal", "civils", "xenos", "chaos"];
  return writePack("careers", [...makeFolderDocs("careers", "Item", FACTION_ORDER.map(k => ({ key: k, name: FACTION_LABEL[k] }))), ...docs]);
}

/* ------------------------------------------------------------------ */
/*  SPÉCIALITÉS & TALENTS (tables explicites + collectés)              */
/* ------------------------------------------------------------------ */
function importAtouts() {
  const specs = [], talents = [];
  // Spécialités explicites
  const specSection = sectionBetween(DOC1, /## Spécialités \(Warhammer\)/, /## Talents/);
  let stype = "standard";
  for (const part of specSection.split(/^###\s+/m)) {
    const head = clean(part.split("\n")[0]);
    if (/martiale/i.test(head)) stype = "martiale";
    else if (/occulte/i.test(head)) stype = "occulte";
    else if (/Spécialité/i.test(head)) stype = "standard";
    for (const rows of tablesIn(part)) {
      for (const r of rows.slice(1)) {
        const name = clean(r[0]); if (!name || /^Spécialité$/i.test(name)) continue;
        const bonusM = name.match(/([+]\d+)/);
        specialtyNames.delete(name);
        specs.push({ _id: makeId("spec", name), name, type: "specialty", img: "icons/svg/upgrade.svg",
          system: { specialtyType: stype, bonus: bonusM ? parseInt(bonusM[1]) : (stype === "standard" ? 10 : 5), effect: clean(r[1]), description: `<p>${clean(r[1])}</p>`, source: "L1" } });
      }
    }
  }
  // Talents explicites
  for (const rows of tablesIn(sectionBetween(DOC1, /## Talents/, /# Corruption/))) {
    for (const r of rows.slice(1)) {
      const name = clean(r[0]); if (!name || /^Spécialité$/i.test(name)) continue;
      talentNames.delete(name.replace(/\s*\[.*\]/, ""));
      talents.push({ _id: makeId("talent", name), name: name.replace(/\s*\[.*\]/, ""), type: "talent", img: "icons/svg/aura.svg",
        system: { usage: /1x\/S|scène/i.test(name) ? "scene" : "permanent", effect: `<p>${clean(r[1])}</p>`, description: `<p>${clean(r[1])}</p>`, source: "L1" } });
    }
  }
  // Stubs collectés depuis les carrières
  for (const n of specialtyNames as Set<string>) if (n.length > 1) specs.push({ _id: makeId("spec", n), name: n, type: "specialty", img: "icons/svg/upgrade.svg", system: { specialtyType: "standard", bonus: 10, source: "Carrière" } });
  for (const n of talentNames as Set<string>) if (n.length > 1) talents.push({ _id: makeId("talent", n), name: n, type: "talent", img: "icons/svg/aura.svg", system: { usage: "permanent", source: "Carrière" } });
  // Descriptions depuis le Livre Premier pour les atouts collectés des carrières (sans texte)
  const hasDesc = (sys: any) => sys.description && sys.description.replace(/<[^>]+>/g, "").trim().length > 6;
  const tDescs = livre1TalentDescs(talents.map(t => t.name));
  let filledT = 0, filledS = 0;
  for (const t of talents) {
    const d = tDescs[t.name] || tDescs[baseAtout(t.name)];
    if (d && !hasDesc(t.system)) { t.system.effect = `<p>${d}</p>`; t.system.description = `<p>${d}</p>`; filledT++; }
  }
  for (const s of specs) {
    const d = ATOUTS.specialties[s.name] || ATOUTS.specialties[baseAtout(s.name)];
    if (d && !hasDesc(s.system)) { s.system.effect = d; s.system.description = `<p>${d}</p>`; filledS++; }
  }
  console.log(`  (descriptions Livre I : +${filledS} spécialités, +${filledT} talents)`);
  assignFolder(specs, "specialties", d => d.system.specialtyType);
  assignFolder(talents, "talents", d => d.system.usage);
  writePack("specialties", [...makeFolderDocs("specialties", "Item", [{ key: "standard", name: "Standard" }, { key: "martiale", name: "Martiales" }, { key: "occulte", name: "Occultes" }]), ...specs]);
  writePack("talents", [...makeFolderDocs("talents", "Item", [{ key: "permanent", name: "Permanents" }, { key: "scene", name: "1×/scène" }, { key: "jour", name: "1×/jour" }, { key: "combat", name: "Combat" }, { key: "autre", name: "Autres" }]), ...talents]);
}

/* ------------------------------------------------------------------ */
/*  BESTIAIRE                                                          */
/* ------------------------------------------------------------------ */
const ABBR = { COM:"com", CNS:"cns", DIS:"dis", END:"end", FOR:"for", TEC:"tec", HAB:"tec", PSY:"psy", MAG:"psy", MOU:"mou", PER:"per", SOC:"soc", SUR:"sur", TIR:"tir", VOL:"vol" };
function importBestiary() {
  const docs = [];
  let faction = "imperium";
  const FACT = [[/Imperium/i,"imperium"],[/Peaux-vertes/i,"xenos"],[/Chaos/i,"chaos"],[/Necron/i,"xenos"],[/Aeldari/i,"xenos"],[/Tyranide/i,"xenos"],[/T.au/i,"xenos"]];
  for (const part of DOC_BEST.split(/^###\s+/m)) {
    const head = clean(part.split("\n")[0]);
    for (const [re, f] of FACT as Array<[RegExp, string]>) if (re.test(head)) faction = f;
    for (const rows of tablesIn(part)) {
      if (rows.length < 4 || rows[0].length < 5) continue;
      const name = clean(rows[0][0]);
      if (!name || name === "Nom") continue;
      const desc = clean(rows[1]?.[0] || "");
      const statLine = clean((rows[2] || []).join(" "));
      const dmgRow = rows.find(r => /^Dégâts/i.test(clean(r[0])));
      const specRow = rows.find(r => /^Spécial/i.test(clean(r[0])));
      const compRow = rows.find(r => /^Compétences/i.test(clean(r[0])));
      const characteristics = {};
      const chars: Record<string, number> = {};
      const comM = statLine.match(/COM\s*(\d+)/i); if (comM) chars.com = parseInt(comM[1]);
      const tirM = statLine.match(/TIR\s*(\d+)/i); if (tirM) chars.tir = parseInt(tirM[1]);
      for (const m of clean(compRow?.[1] || "").matchAll(/\b([A-Z]{3})\s*(\d+)/g)) {
        const k = ABBR[m[1].toUpperCase()]; if (k) chars[k] = parseInt(m[2]);
      }
      ["com","cns","dis","end","for","tec","psy","mou","per","soc","sur","tir","vol"].forEach(k => {
        characteristics[k] = { value: chars[k] ?? (k === "psy" ? 0 : 25), mod: 0 };
      });
      const initM = statLine.match(/Init\s*(\d+)/i);
      const protM = statLine.match(/Prot\s*(\d+)/i);
      const pvM = statLine.match(/PV\s*(\d+)/i);
      const special = clean(specRow?.[1] || "");
      const fearM = special.match(/PEUR\s*\((\d+)\)/i);
      const pv = pvM ? parseInt(pvM[1]) : 10;
      docs.push({ _id: makeId("npc", name), name, type: "npc", img: "icons/svg/mystery-man.svg",
        system: {
          characteristics, subtitle: desc, faction,
          pv: { value: pv, max: pv, bonus: 0 }, sf: { value: 10, max: 10, bonus: 0 },
          initiative: { base: initM ? parseInt(initM[1]) : null, mod: 0 },
          protection: { base: protM ? parseInt(protM[1]) : 0, mod: 0 },
          fear: fearM ? parseInt(fearM[1]) : 0,
          isSwarm: /nuée/i.test(special),
          attacksText: `<p>${clean(dmgRow?.[1] || "")}</p>`,
          specialAbilities: `<p>${special}</p>`, biography: `<p>${desc}</p>`
        }
      });
    }
  }
  return writePack("bestiary", docs);
}

/* ------------------------------------------------------------------ */
/*  CARRIÈRES DE BASE (mondes féodaux) — saisie manuelle               */
/*  (PDF Livre 1 non extractible : accents perdus dans la police)      */
/* ------------------------------------------------------------------ */
function importBaseCareers() {
  const KEYS = ["com", "cns", "dis", "end", "for", "tec", "psy", "mou", "per", "soc", "sur", "tir", "vol"];
  const ADV = o => { const a = {}; for (const k of KEYS) a[k] = o[k] ?? 0; return a; };
  // [nom, niveauDeVie, advances, spécialités, talents, description]
  const data = [
    ["Soldat", "ordinaire", { com: 3, for: 2, end: 2, tir: 1, vol: 1 }, ["Arme de mêlée (au choix)", "Arme à distance (au choix)", "Courage", "Discipline", "Vigilance"], ["Coups puissants", "Solidité", "Port d'armure", "Riposte"], "Un combattant entraîné au service d'un seigneur ou d'une armée."],
    ["Mercenaire", "ordinaire", { com: 3, for: 2, end: 1, dis: 1, soc: 1 }, ["Arme de mêlée (au choix)", "Intimidation", "Marchandage", "Survie", "Jeu"], ["Coups précis", "Brute", "Sang-froid", "Esquive"], "Une lame à louer, fidèle à la bourse la mieux garnie."],
    ["Garde / Milicien", "ordinaire", { com: 2, for: 2, end: 2, per: 2, vol: 1 }, ["Arme de mêlée (au choix)", "Fouille", "Intimidation", "Vigilance", "Premiers soins"], ["Solidité", "Gardien", "Inspiration"], "Le bras armé de la loi locale, lance et tabard."],
    ["Chevalier", "aise", { com: 4, for: 3, end: 2, vol: 2, soc: 1 }, ["Arme de mêlée (au choix)", "Équitation", "Commandement", "Courage", "Noblesse et politique"], ["Maître d'armes", "Coups puissants", "Inspiration", "Port d'armure"], "Un noble combattant, monté et cuirassé, lié par un serment."],
    ["Écuyer", "ordinaire", { com: 2, for: 1, end: 1, tec: 1, soc: 1 }, ["Arme de mêlée (au choix)", "Équitation", "Soins aux animaux", "Étiquette"], ["Solidité", "Dévoué serviteur"], "Au service d'un chevalier, en attendant l'adoubement."],
    ["Paysan", "pauvre", { for: 2, end: 2, sur: 2, mou: 1 }, ["Milieu naturel", "Soins aux animaux", "Survie", "Athlétisme"], ["Résilience", "Solidité"], "Le dos courbé sur la terre, du lever au coucher du soleil."],
    ["Chasseur", "ordinaire", { tir: 3, per: 2, dis: 2, sur: 2 }, ["Arme à distance (au choix)", "Pistage", "Déplacement silencieux", "Milieu naturel", "Pièges"], ["Tireur d'élite", "Tir précis", "Sixième sens"], "Traqueur silencieux des bois, l'arc toujours tendu."],
    ["Voleur", "pauvre", { dis: 3, tec: 2, mou: 2, per: 1 }, ["Crochetage", "Déplacement silencieux", "Dissimulation d'objet", "Escalade", "Fouille"], ["Insaisissable", "Coup adroit", "Réflexes éclairs"], "Doigts agiles et conscience souple, l'ombre des ruelles."],
    ["Marchand", "aise", { soc: 3, cns: 2, per: 1, vol: 1 }, ["Marchandage", "Estimation", "Commerce", "Persuasion", "Renseignements"], ["Relations", "Panache", "Confiance en soi"], "Caravanes et comptoirs : l'argent ne dort jamais."],
    ["Artisan / Forgeron", "ordinaire", { tec: 3, for: 2, cns: 1, end: 1 }, ["Travail du métal", "Estimation", "Commerce"], ["Esprit de la Machine", "Coup adroit", "Solidité"], "Marteau et enclume, l'acier prend forme sous ses coups."],
    ["Ménestrel", "ordinaire", { soc: 3, mou: 1, per: 1, cns: 1 }, ["Musique et chant", "Persuasion", "Légendes", "Renseignements"], ["Fascination", "Panache", "Musique et chant"], "Conteur, musicien et espion à ses heures."],
    ["Érudit", "aise", { cns: 4, tec: 1, per: 1, vol: 1 }, ["Lettres", "Histoire", "Langue étrangère", "Astrologie", "Légendes"], ["Mémoire sans faille", "Doué (CNS)", "Calme"], "Le nez dans les grimoires, gardien du savoir."],
    ["Rebouteux / Médecin", "ordinaire", { tec: 2, cns: 2, per: 2, soc: 1 }, ["Premiers soins", "Médecine", "Potions et remèdes", "Botanique", "Intuition"], ["Mains blanches", "Guérison rapide", "Calme"], "Sait recoudre une plaie et préparer un remède."],
    ["Noble", "riche", { soc: 3, vol: 2, cns: 1, com: 1 }, ["Étiquette", "Commandement", "Persuasion", "Noblesse et politique", "Équitation"], ["Relations", "Inspiration", "Panache", "Confiance en soi"], "Né dans la soie, habitué à commander."],
    ["Marin", "pauvre", { mou: 2, for: 2, end: 2, tec: 1, sur: 1 }, ["Navigation", "Escalade", "Athlétisme", "Survie", "Jeu"], ["Endurci", "Sang-froid", "Solidité"], "Le pied marin et le couteau facile."],
    ["Éclaireur", "ordinaire", { mou: 2, per: 2, dis: 2, sur: 2, tir: 1 }, ["Pistage", "Orientation", "Déplacement silencieux", "Milieu naturel", "Vigilance"], ["Sixième sens", "Insaisissable", "Instinct de survie"], "Les yeux et les oreilles de la troupe en terrain hostile."]
  ];
  const docs = data.map(([name, lifestyle, adv, specialties, talents, desc]) => ({
    _id: makeId("bcareer", name), name, type: "career", img: "icons/svg/book.svg",
    system: { faction: "feodal", quote: "", advances: ADV(adv), lifestyle, specialties, talents, startingEquipment: "", description: `<p>${desc}</p>`, source: "Brigandyne (adapté)" }
  }));
  assignFolder(docs, "careers", d => d.system.faction);   // dossier "feodal"
  appendPack("careers", docs);
  return docs.length;
}

/* ------------------------------------------------------------------ */
/*  ÉQUIPEMENT FANTASY (Brigandyne médiéval — écran MJ)                */
/* ------------------------------------------------------------------ */
const RANGE_M = { Contact: 1, Courte: 5, Moyenne: 20, Longue: 50, Extrême: 100 };
function importFantasyEquipment() {
  const melee = [
    ["Bagarre", "*FOR*-3", "F", 1, "Saisie, Dégâts temporaires"],
    ["Couteau, poignard", "*FOR*-1", "E", 1, ""],
    ["Dague", "*FOR*-1", "D", 1, ""],
    ["Épée bâtarde", "*FOR*", "B", 1, "Dégâts à 2 mains : FOR+1"],
    ["Épée courte", "*FOR*-1", "C", 1, "Corps-à-corps"],
    ["Épée large, sabre", "*FOR*", "C", 1, ""],
    ["Épée longue", "*FOR*", "B", 1, ""],
    ["Espadon, flamberge", "*FOR*+2", "A", 2, "Espace, Initiative -1"],
    ["Rapière", "*FOR*", "B", 1, "Point faible"],
    ["Gourdin", "*FOR*-2", "C", 1, "Choc"],
    ["Hachette", "*FOR*-1", "D", 1, ""],
    ["Hache, cognée", "*FOR*", "C", 1, ""],
    ["Hache de guerre", "*FOR*+2", "C", 1, "Initiative -1"],
    ["Marteau de guerre", "*FOR*", "C", 1, "Choc, Destruction"],
    ["Masse d'armes", "*FOR*", "C", 1, "Choc, Ignore armures souples"],
    ["Fléau d'armes", "*FOR*+1", "C", 1, "Espace, Ignore boucliers, Initiative -1, Risquée"],
    ["Fouet", "*FOR*-2", "A", 1, "Espace, Dégâts temporaires"],
    ["Fourche", "*FOR*-1", "A", 2, "Charge"],
    ["Hallebarde, bardiche", "*FOR*", "A", 2, "Charge"],
    ["Lance courte", "*FOR*", "A", 2, "Charge"],
    ["Lance longue", "*FOR*", "AA", 2, "Charge"]
  ];
  const ranged = [
    ["Arbalète de poing", "+3", "Moyenne", 1, "Chargement (2)"],
    ["Arbalète", "+5", "Longue", 2, "Chargement (2), Maniable"],
    ["Arbalète lourde", "+6", "Extrême", 2, "Chargement (2), Maniable"],
    ["Arc court", "*FOR*-1", "Moyenne", 2, ""],
    ["Arc", "*FOR*", "Moyenne", 2, ""],
    ["Arc long", "*FOR*", "Longue", 2, ""],
    ["Couteau de lancer", "*FOR*-1", "Courte", 1, ""],
    ["Javelot", "*FOR*", "Moyenne", 1, ""],
    ["Pierre", "*FOR*-2", "Courte", 1, ""],
    ["Arquebuse", "+7", "Moyenne", 2, "Chargement (5)"],
    ["Pistolet à poudre", "+4", "Courte", 1, "Chargement (5)"],
    ["Tromblon", "+3", "Courte", 1, ""],
    ["Fronde", "*FOR*-1", "Moyenne", 1, ""],
    ["Sarbacane", "0", "Courte", 1, "Poison"]
  ];
  const docs = [];
  for (const [name, dmg, reach, hands, special] of melee) {
    const q = parseQualities(special);
    docs.push({ _id: makeId("fweapon", name), name, type: "weapon", img: "icons/svg/sword.svg",
      system: { weaponType: "melee", group: "fantasy", damageBase: parseDamage(dmg).base, damageMod: parseDamage(dmg).mod,
        reach, hands, qualities: q.qualities, specialText: q.leftover, price: 0, source: "Brigandyne" } });
  }
  for (const [name, dmg, range, hands, special] of ranged) {
    const q = parseQualities(special);
    docs.push({ _id: makeId("fweapon", name), name, type: "weapon", img: "icons/svg/thrown.svg",
      system: { weaponType: "ranged", group: "fantasy", damageBase: parseDamage(dmg).base, damageMod: parseDamage(dmg).mod,
        range: RANGE_M[range] ?? 20, magazine: 0, hands, qualities: q.qualities, specialText: q.leftover, price: 0, source: "Brigandyne" } });
  }
  assignFolder(docs, "weapons", () => "fantasy");
  appendPack("weapons", docs);

  const armor = [
    ["Gambison, fourrures", 1, "complete", -1, 0, ""],
    ["Plastron de cuir", 1, "partielle", 0, 0, ""],
    ["Broigne, brigandine", 2, "partielle", -1, 0, ""],
    ["Cotte de plaques", 2, "complete", -2, 0, ""],
    ["Cuirasse", 3, "partielle", -1, 0, ""],
    ["Cotte de mailles, haubert", 3, "complete", -2, -5, ""],
    ["Demi-plaques", 4, "complete", -2, -5, ""],
    ["Armure de plates, harnois", 5, "complete", -3, -5, ""],
    ["Casque (médiéval)", 1, "bonus", 0, -5, "PER -5%"],
    ["Petit bouclier, bocle", 1, "bonus", 0, 0, ""],
    ["Bouclier, écu", 2, "bonus", -1, 0, "Couvert (1)"]
  ];
  const adocs = armor.map(([name, prot, cov, init, mou, special]) => ({
    _id: makeId("farmor", name), name, type: "armor", img: "icons/svg/shield.svg",
    system: { protection: prot, coverage: cov, initiativeMod: init, mouMod: mou, qualities: parseQualities(special).qualities, specialText: parseQualities(special).leftover, price: 0, source: "Brigandyne" }
  }));
  assignFolder(adocs, "armor", d => d.system.coverage);
  appendPack("armor", adocs);
  return docs.length + adocs.length;
}

/* ------------------------------------------------------------------ */
/*  AUGMENTATIONS                                                      */
/* ------------------------------------------------------------------ */
function importAugmentations() {
  const docs = [];
  const section = sectionBetween(DOC1, /# Augmentations/, /# Véhicules et vaisseaux/);
  let augType = "prothese";
  for (const part of section.split(/^##\s+/m)) {
    const head = clean(part.split("\n")[0]);
    if (/Systèmes implantés/i.test(head)) augType = "systeme";
    else if (/Prothèses|organes bioniques/i.test(head)) augType = "prothese";
    for (const rows of tablesIn(part)) {
      if (!rows.length || !/Modèle/i.test(rows[0][0])) continue;
      for (const r of rows.slice(1)) {
        const name = clean(r[0]);
        if (!name) continue;
        docs.push({
          _id: makeId("aug", name), name, type: "augmentation", img: "icons/svg/biohazard.svg",
          system: { augType, location: "", effect: clean(r[1]), description: `<p>${clean(r[1])}</p>`, price: parsePrice(r[2]) || 0, source: "L1" }
        });
      }
    }
  }
  assignFolder(docs, "augmentations", d => d.system.augType);
  return writePack("augmentations", [...makeFolderDocs("augmentations", "Item", [{ key: "prothese", name: "Prothèses & organes bioniques" }, { key: "systeme", name: "Systèmes implantés" }]), ...docs]);
}

/* ------------------------------------------------------------------ */
/*  MUTATIONS & BLESSURES GRAVES (jeux de départ)                      */
/* ------------------------------------------------------------------ */
function importMutations() {
  const data = [
    ["Chair d'acier", "grace", "La peau se durcit en plaques : +1 point de Protection naturelle."],
    ["Regard perçant", "grace", "Yeux mutants : +10% aux tests de PER basés sur la vue."],
    ["Membre atrophié", "grace", "Un bras supplémentaire : 1 Avantage pour saisir ou manipuler."],
    ["Constitution monstrueuse", "grace", "Carrure accrue : +2 PV."],
    ["Sens du prédateur", "grace", "Vision nocturne et odorat aiguisé."],
    ["Glandes adrénales", "grace", "1×/scène, ignorez les malus de blessure pendant RU tours."],
    ["Pustules suintantes", "fardeau", "Odeur pestilentielle : −10% en SOC."],
    ["Tremblements", "fardeau", "1 Désavantage aux tests de TEC minutieux."],
    ["Difformité", "fardeau", "Apparence repoussante : −10% en SOC, +5% en intimidation."],
    ["Appétit corrompu", "fardeau", "Faim dévorante : test de VOL ou céder à une pulsion."],
    ["Os fragiles", "fardeau", "Les dégâts physiques subis sont augmentés de 1."],
    ["Murmures intérieurs", "fardeau", "Voix du Warp : −1 au Sang-Froid maximum."]
  ];
  const docs = data.map(([name, type, eff]) => ({
    _id: makeId("mut", name), name, type: "mutation",
    img: type === "grace" ? "icons/svg/upgrade.svg" : "icons/svg/downgrade.svg",
    system: { mutationType: type, effect: `<p>${eff}</p>`, description: `<p>${eff}</p>`, source: "Exemple" }
  }));
  assignFolder(docs, "mutations", d => d.system.mutationType);
  return writePack("mutations", [...makeFolderDocs("mutations", "Item", [{ key: "grace", name: "Grâces" }, { key: "fardeau", name: "Fardeaux" }]), ...docs]);
}

function importCriticalInjuries() {
  const data = [
    ["Entaille au bras", "Bras", 1, "affaibli", "Le bras saigne : 1 Désavantage avec ce membre jusqu'aux soins."],
    ["Jambe brisée", "Jambe", 2, "ralenti", "Ralenti jusqu'à immobilisation et soins (test de TEC à −10)."],
    ["Commotion", "Tête", 2, "sonne", "Sonné ; 1 Désavantage aux tests mentaux pendant END heures."],
    ["Œil crevé", "Tête", 3, "aveugle", "Perte d'un œil : −10% aux tests basés sur la vue (définitif sans bionique)."],
    ["Hémorragie", "Torse", 2, "ensanglante", "Ensanglanté : −1 PV/tour jusqu'à un test de TEC (premiers soins)."],
    ["Côtes fêlées", "Torse", 1, "essouffle", "Essoufflé ; 1 Désavantage aux efforts soutenus."],
    ["Main mutilée", "Bras", 3, "affaibli", "Doigts perdus : lâche son arme, 2 Désavantages de cette main."],
    ["Traumatisme crânien", "Tête", 3, "confus", "Confus ; perd RU points de SF."]
  ];
  const docs = data.map(([name, loc, sev, cond, eff]) => ({
    _id: makeId("crit", name), name, type: "criticalInjury", img: "icons/svg/blood.svg",
    system: { location: loc, severity: sev, condition: cond, effect: `<p>${eff}</p>`, description: `<p>${eff}</p>`, source: "Exemple" }
  }));
  return writePack("critical-injuries", docs);
}

/* ------------------------------------------------------------------ */
/*  Exécution                                                          */
/* ------------------------------------------------------------------ */
fs.mkdirSync(OUT, { recursive: true });
console.log("Import du contenu Brigandyne 40K :");
const counts = {
  weapons: importWeapons(),
  armor: importArmor(),
  ammunition: importAmmo(),
  species: importSpecies(),
  "psychic-powers": importPowers(),
  "faith-acts": importFaith(),
  careers: importCareers(),
  bestiary: importBestiary(),
  vehicles: importVehicles(),
  augmentations: importAugmentations(),
  mutations: importMutations(),
  "critical-injuries": importCriticalInjuries()
};
importAtouts();
console.log(`  base-careers: +${importBaseCareers()} (mondes féodaux)`);
console.log(`  fantasy: +${importFantasyEquipment()} (armes & armures médiévales)`);
console.log("Terminé.");
