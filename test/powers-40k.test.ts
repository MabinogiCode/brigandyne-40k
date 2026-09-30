/**
 * Conformité 40K — Pouvoirs psychiques, Actes de Foi, Phénomènes psychiques et
 * Périls du Warp, espèces (document d'adaptation « Warhammer 40.000 : Brigandyne »).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIGANDYNE } from "../src/config/config.ts";
import { PHENOMENA, PERILS } from "../src/data/warp-tables.ts";
import { section, tables, loadPack, norm, num } from "./helpers/doc.ts";

interface Card { name: string; difficulty: number; duration: string; range: string; resistance: string; rPlus: string; effect: string }

/** Cartes « Difficulté / Durée / Portée / Résistance / R+ / effet » d'un texte (tableaux à 1 ou 2 colonnes). */
function parseCards(text: string): Card[] {
  const out: Card[] = [];
  for (const t of tables(text)) {
    if (t.length < 4 || !/^Difficulté/i.test(t[1][0] ?? "")) continue;
    for (let c = 0; c < t[0].length; c++) {
      const diff = t[1][c] ?? "", res = t[2][c] ?? "";
      const g = (re: RegExp, s: string) => (s.match(re)?.[1] ?? "").trim();
      out.push({
        name: t[0][c],
        difficulty: parseInt(g(/Difficulté\s*:\s*([+\-−–]?\s*\d+)/i, diff).replace(/[−–]/g, "-").replace(/\s/g, ""), 10) || 0,
        duration: g(/Durée\s*:\s*([^/]+)/i, diff),
        range: g(/Portée\s*:\s*([^/]+)/i, diff),
        resistance: g(/Résistance\s*:\s*([^/]+)/i, res),
        rPlus: g(/R\+\s*:\s*(.+)$/i, res),
        effect: t[3][c] ?? ""
      });
    }
  }
  return out;
}

const POWERS = section(/^## Pouvoirs et Domaines/m, /^## Dangers psychiques/m);
const cards = parseCards(POWERS);
const packPowers = loadPack("psychic-powers").docs.filter(d => d.type === "psychicPower");

/* ------------------------------------------------------------------ */
/* Pouvoirs psychiques                                                 */
/* ------------------------------------------------------------------ */

test("40K Pouvoirs — chaque carte du document : difficulté, durée, portée, résistance, R+", () => {
  assert.ok(cards.length >= 60, `cartes lues : ${cards.length}`);
  const byName = new Map<string, any[]>();
  for (const p of packPowers) byName.set(norm(p.name), [...(byName.get(norm(p.name)) ?? []), p]);
  for (const c of cards) {
    const hits = (byName.get(norm(c.name)) ?? []).filter(p => !p.system.isMinor);
    assert.ok(hits.length >= 1, `pouvoir « ${c.name} » absent du compendium`);
    const p = hits[0].system;
    assert.equal(p.difficulty, c.difficulty, `${c.name} : difficulté`);
    assert.equal(norm(p.duration), norm(c.duration), `${c.name} : durée`);
    assert.equal(norm(p.range), norm(c.range.replace(/M0yenne/i, "Moyenne").replace(/Courtes/i, "Courte")), `${c.name} : portée`);
    assert.equal(norm(p.resistance), norm(c.resistance), `${c.name} : résistance`);
    assert.equal(norm(p.rPlus), norm(c.rPlus), `${c.name} : R+`);
  }
});

test("40K Pouvoirs — durées et portées n'emploient que les valeurs du système (pas de faute de frappe)", () => {
  const ranges = new Set(["contact", "courte", "moyenne", "longue", "extrême", "extreme", "spécial", "-"]);
  for (const p of packPowers.filter(p => !p.system.isMinor)) {
    assert.ok(ranges.has(norm(p.system.range)), `${p.name} : portée « ${p.system.range} » inconnue`);
  }
});

test("40K Pouvoirs — les 6 domaines existent (génériques, Biomancie, Divination, Pyromancie, Télékinésie, Télépathie)", () => {
  assert.deepEqual(Object.keys(BRIGANDYNE.psychicDisciplines),
    ["generique", "biomancie", "divination", "pyromancie", "telekinesie", "telepathie"]);
  for (const disc of Object.keys(BRIGANDYNE.psychicDisciplines)) {
    assert.ok(packPowers.some(p => p.system.discipline === disc && !p.system.isMinor), `domaine ${disc} sans pouvoir`);
    assert.ok(packPowers.some(p => p.system.discipline === disc && p.system.isMinor), `domaine ${disc} sans pouvoir mineur`);
  }
});

test("40K Pouvoirs mineurs — noms du document présents et marqués mineurs, par domaine", () => {
  // Les pouvoirs mineurs sont listés dans un tableau « Pouvoirs mineurs » par domaine : « Nom : effet  Nom : effet … ».
  const heads: Array<[RegExp, string]> = [
    [/^#### Pouvoirs génériques/m, "generique"], [/^#### Biomancie/m, "biomancie"], [/^#### Divination/m, "divination"],
    [/^#### Pyromancie/m, "pyromancie"], [/^#### Télékinésie/m, "telekinesie"], [/^#### Télépathie/m, "telepathie"]
  ];
  for (const [re, disc] of heads) {
    const sec = section(re, /^#{2,4} /m);
    const lines = sec.split("\n");
    const at = lines.findIndex(l => l.trim() === "| Pouvoirs mineurs |");
    const blob = (lines[at + 2] ?? "").trim().replace(/^\|/, "").replace(/\|$/, "").trim();
    // les entrées du tableau sont séparées par deux espaces : « Nom : effet  Nom : effet »
    const names = blob.split(/(?<=[.!?…)])\s{2,}(?=[A-ZÉÈÀÂÎÔ][^:.]{1,40}\s:\s)/).map(p => p.split(" : ")[0].trim());
    assert.ok(names.length >= 5, `${disc} : ${names.length} pouvoirs mineurs lus`);
    for (const n of names) {
      // Certains tours figurent dans plusieurs domaines du document (Désagrément, Main spectrale…) : une seule fiche dans le compendium.
      const hit = packPowers.find(p => norm(p.name) === norm(n) && p.system.isMinor);
      assert.ok(hit, `pouvoir mineur « ${n} » (${disc}) absent ou non marqué mineur`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* Actes de Foi                                                        */
/* ------------------------------------------------------------------ */

test("40K Vraie Foi — chaque Acte de Foi : difficulté, durée, portée, résistance, R+, Miracle", () => {
  const sec = section(/^#### Liste des Actes de Foi/m, /^# WIP/m);
  const acts = parseCards(sec);
  assert.equal(acts.length, 8, "8 Actes de Foi dans le document");
  const pack = loadPack("faith-acts").docs.filter(d => d.type === "faithAct");
  const key = (s: string) => norm(s.replace(/\(Miracle\)/i, "")).replace(/-/g, " ");
  for (const a of acts) {
    const p = pack.find(d => key(d.name) === key(a.name));
    assert.ok(p, `Acte de Foi « ${a.name} » absent`);
    assert.equal(p.system.difficulty, a.difficulty, `${a.name} : difficulté`);
    assert.equal(norm(p.system.duration), norm(a.duration), `${a.name} : durée`);
    assert.equal(norm(p.system.range), norm(a.range), `${a.name} : portée`);
    assert.equal(norm(p.system.resistance), norm(a.resistance), `${a.name} : résistance`);
    assert.equal(norm(p.system.rPlus), norm(a.rPlus), `${a.name} : R+`);
    assert.equal(!!p.system.isMiracle, /\(Miracle\)/i.test(a.name), `${a.name} : Miracle`);
  }
});

/* ------------------------------------------------------------------ */
/* Phénomènes psychiques & Périls du Warp                              */
/* ------------------------------------------------------------------ */

function parseWarpTable(text: string): Array<{ min: number; max: number; name: string; effect: string }> {
  return tables(text).flatMap(t => t.slice(1)).filter(r => /^\d/.test(r[0])).map(r => {
    const m = r[0].match(/(\d+)\s*(?:[–\-]\s*(\d+)|et \+)?/)!;
    const min = parseInt(m[1], 10);
    const max = m[2] ? parseInt(m[2], 10) : /et \+/.test(r[0]) ? 100 : min;
    const [name, ...rest] = r[1].split(" : ");
    return { min, max, name: name.trim(), effect: rest.join(" : ") };
  });
}

test("40K Phénomènes psychiques — 25 lignes, bornes et noms du document", () => {
  const rows = parseWarpTable(section(/^### Phénomènes psychiques/m, /^### Périls du Warp/m));
  assert.equal(rows.length, PHENOMENA.length);
  rows.forEach((r, i) => {
    const [min, max, name] = PHENOMENA[i] as [number, number, string, string];
    assert.deepEqual([min, max, norm(name)], [r.min, r.max, norm(r.name)], `ligne ${i + 1} (${r.name})`);
  });
});

test("40K Périls du Warp — 18 lignes, bornes et noms du document", () => {
  const rows = parseWarpTable(section(/^### Périls du Warp/m, /^## La Vraie Foi/m));
  assert.equal(rows.length, PERILS.length);
  rows.forEach((r, i) => {
    const [min, max, name] = PERILS[i] as [number, number, string, string];
    assert.deepEqual([min, max, norm(name)], [r.min, r.max, norm(r.name)], `ligne ${i + 1} (${r.name})`);
  });
});

test("40K — les tables Phénomènes/Périls couvrent 1 à 100 sans trou", () => {
  for (const table of [PHENOMENA, PERILS]) {
    let expected = 1;
    for (const [min, max] of table as Array<[number, number]>) {
      assert.equal(min, expected);
      expected = max + 1;
    }
    assert.equal(expected, 101);
  }
});

/* ------------------------------------------------------------------ */
/* Espèces                                                             */
/* ------------------------------------------------------------------ */

test("40K Espèces — caractéristiques, plafonds et Destin (config ET compendium)", () => {
  const sec = section(/^### Paria/m, /^### Spécialités/m);
  const tabs = tables(sec).filter(t => t[0].length >= 4 && /^(|Humain|Mutant)$/.test(t[0][0] ?? "") && t[0][1]);
  assert.equal(tabs.length, 2, "deux tableaux d'espèces");
  const keyOf: Record<string, string> = { Combat: "com", Connaissance: "cns", Discrétion: "dis", Endurance: "end", Force: "for", Technique: "tec",
    Psychisme: "psy", Mouvement: "mou", Perception: "per", Sociabilité: "soc", Survie: "sur", Tir: "tir", Volonté: "vol" };
  const speciesKey: Record<string, string> = { Humain: "humain", Squat: "squat", Ratling: "ratling", Ogryn: "ogryn", Mutant: "mutant", Aeldari: "aeldari", Paria: "paria" };
  const packSpecies = loadPack("species").docs.filter(d => d.type === "species");
  for (const t of tabs) {
    for (let c = 1; c < t[0].length; c++) {
      const label = t[0][c];
      const conf = (BRIGANDYNE.species as any)[speciesKey[label]];
      const pack = packSpecies.find(d => norm(d.name) === norm(label));
      assert.ok(conf && pack, `espèce ${label}`);
      for (const row of t.slice(1)) {
        const k = keyOf[row[0]];
        if (k) {
          const v = row[c];
          const expected = v === "X" ? null : num(v);
          assert.equal(conf.base[k], expected, `${label} ${row[0]} (config)`);
          assert.equal(pack.system.base[k], expected ?? pack.system.base[k], `${label} ${row[0]} (compendium)`);
        }
        if (row[0] === "Destin") {
          assert.equal(conf.destin, num(row[c]), `${label} : Destin (config)`);
          assert.equal(pack.system.destin, num(row[c]), `${label} : Destin (compendium)`);
        }
        if (row[0] === "Limitations" && row[c] !== "-") {
          for (const m of row[c].matchAll(/([A-Z]{3})\s+(\d+)/g)) {
            assert.equal(conf.limits[m[1].toLowerCase()], parseInt(m[2], 10), `${label} : plafond ${m[1]} (config)`);
            assert.equal(pack.system.limits[m[1].toLowerCase()], parseInt(m[2], 10), `${label} : plafond ${m[1]} (compendium)`);
          }
        }
      }
    }
  }
});

test("40K Espèces — bonus spéciaux : Squat SF+1 PV+1 ; Ogryn PV+2 ; Paria sans PSY (Gêne du Paria)", () => {
  const S = BRIGANDYNE.species as any;
  assert.deepEqual([...S.squat.special].sort(), ["nyctalopie", "pvPlus1", "sfPlus1"]);
  assert.ok(S.ogryn.special.includes("pvPlus2"));
  assert.ok(S.paria.special.includes("geneParia"));
  assert.equal(S.paria.noPsy, true);
  assert.ok(S.aeldari.special.includes("nyctalopie"));
  assert.ok(S.mutant.special.includes("mutations"));
});

/* ------------------------------------------------------------------ */
/* Dégâts des pouvoirs                                                 */
/* ------------------------------------------------------------------ */

test("40K Pouvoirs — pouvoirs à dégâts directs : formule et type (le type psychique ignore les armures)", () => {
  const expected: Record<string, [string, string]> = {
    "Bioéclair": ["RU+PSY", "electrique"],       // « RU+*PSY* dégâts électriques »
    "Holocauste": ["RU+PSY", "feu"],              // « RU+*PSY* dégâts de feu »
    "Lame psychique": ["RU+PSY", "physique"],
    "Télékinésie": ["RU+PSY", "physique"],
    "Choc psychique": ["RU", "psychique"],        // « RU dégâts psychiques »
    "Projectile de feu": ["RU+6", "feu"],         // « RU+6 dégâts de feu »
    "Projectile de force": ["RU+2", "physique"],
    "Écrasement psychique": ["RU+8", "physique"],
    "Poussée": ["PSY", "physique"]
  };
  for (const [name, [dmg, type]] of Object.entries(expected)) {
    const p = packPowers.find(p => norm(p.name) === norm(name) && !p.system.isMinor);
    assert.ok(p, name);
    assert.equal(p.system.damage, dmg, `${name} : formule`);
    assert.equal(p.system.damageType, type, `${name} : type de dégâts`);
  }
});

test("40K Pouvoirs mineurs — autant de fiches que de noms distincts dans le document (32)", () => {
  const minors = packPowers.filter(p => p.system.isMinor);
  assert.equal(minors.length, 32);
  assert.equal(new Set(minors.map(p => norm(p.name))).size, 32, "pas de doublon");
});
