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
  return writePack("weapons", docs);
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
  return writePack("armor", docs);
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
            system: { discipline, isMinor: true, difficulty: 0, effect: `<p>${mp.effect}</p>`, source: "L1" } });
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
            system: { discipline, isMinor: false, ...meta, damage: detectDamage(effect), effect: `<p>${effect}</p>`, source: "L1" } });
        }
      }
    }
  }
  return writePack("psychic-powers", docs);
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
        system: { isMiracle, ...meta, damage: detectDamage(effect), effect: `<p>${effect}</p>`, source: "L1" } });
    }
  }
  return writePack("faith-acts", docs);
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
  const docs = [];
  for (const [key, sp] of Object.entries(SP)) {
    const base = {}; KEYS.forEach((k, i) => base[k] = sp.base[i]);
    const limits = {}; KEYS.forEach(k => limits[k] = sp.limits?.[k] ?? null);
    docs.push({ _id: makeId("species", key), name: LABEL[key], type: "species", img: "icons/svg/mystery-man.svg",
      system: { base, limits, destin: sp.destin, special: sp.special, noPsy: !!sp.noPsy, source: "L1" } });
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
    for (const [re, f] of FACTION_BY_HEADING) if (re.test(head)) faction = f;
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
  return writePack("careers", docs);
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
        system: { usage: /1x\/S|scène/i.test(name) ? "scene" : "permanent", effect: `<p>${clean(r[1])}</p>`, source: "L1" } });
    }
  }
  // Stubs collectés depuis les carrières
  for (const n of specialtyNames) if (n.length > 1) specs.push({ _id: makeId("spec", n), name: n, type: "specialty", img: "icons/svg/upgrade.svg", system: { specialtyType: "standard", bonus: 10, source: "Carrière" } });
  for (const n of talentNames) if (n.length > 1) talents.push({ _id: makeId("talent", n), name: n, type: "talent", img: "icons/svg/aura.svg", system: { usage: "permanent", source: "Carrière" } });
  writePack("specialties", specs);
  writePack("talents", talents);
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
    for (const [re, f] of FACT) if (re.test(head)) faction = f;
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
      const chars = {};
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
  vehicles: importVehicles()
};
importAtouts();
console.log("Terminé.");
