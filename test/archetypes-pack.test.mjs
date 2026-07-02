/**
 * Tests RAW — Archétypes (Livre Premier, p. 37-48) contre les données du
 * compendium packs/_source/archetypes.
 *
 * Référence : pages détaillées 40-47 (autoritaires en cas de divergence avec
 * la table récapitulative p. 38-39).
 * Correspondance 40k : HAB→tec, MAG→psy.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "packs", "_source", "archetypes");

/** Table de référence transcrite du livre (pages détaillées 40-47).
 *  mods : modificateurs fixes ; choices : liste de {chars, value} (ordre libre).
 *  fixed/choicesTraits/count : vices & vertus ; talents : les 5 talents accessibles. */
const RAW = {
  "Aigle":   { mods: { vol: 5 }, choices: [[["cns", "per"], 5]],
               fixed: ["orgueilleux"], traits: ["envieux", "travailleur", "sobre", "prudent", "loyal"], count: 1 },
  "Âne":     { mods: { end: 5, vol: 5 }, choices: [[["tec", "sur"], 5], [["cns", "mou"], -5]],
               fixed: ["humble"], traits: ["travailleur", "chaste", "prudent", "clement", "loyal"], count: 1 },
  "Cerf":    { mods: { soc: 5, vol: 5 }, choices: [[["sur", "mou"], 5], [["dis", "tir"], -5]],
               fixed: ["loyal"], traits: ["orgueilleux", "bienveillant", "clement", "genereux", "valeureux"], count: 1 },
  "Chat":    { mods: { dis: 5, per: 5, mou: 5 }, choices: [[["for", "vol"], -5]],
               fixed: [], traits: ["cruel", "envieux", "lache", "paresseux", "prudent", "trompeur"], count: 2 },
  "Chien":   { mods: { end: 5, per: 5, soc: 5 }, choices: [[["dis", "tec"], -5]],
               fixed: [], traits: ["bienveillant", "genereux", "gourmand", "clement", "loyal", "valeureux"], count: 2 },
  "Coq":     { mods: { com: 5, soc: 5 }, choices: [[["dis", "tec"], -5]],
               fixed: [], traits: ["orgueilleux", "colerique", "luxurieux", "envieux", "loyal", "valeureux"], count: 2 },
  "Corbeau": { mods: { cns: 5, vol: 5, soc: -5 }, choices: [[["dis", "sur"], 5]],
               fixed: [], traits: ["cruel", "humble", "chaste", "sobre", "prudent", "envieux"], count: 2 },
  "Fourmi":  { mods: { tec: 5, vol: 5 }, choices: [[["cns", "dis"], 5], [["per", "soc"], -5]],
               fixed: ["travailleur"], traits: ["avare", "humble", "chaste", "sobre", "prudent"], count: 1 },
  "Hibou":   { mods: { cns: 10, com: -5 }, choices: [[["tec", "per"], 5], [["soc", "vol"], 5]],
               fixed: ["travailleur"], traits: ["orgueilleux", "chaste", "prudent", "envieux", "loyal"], count: 1 },
  "Hyène":   { mods: { com: 5 }, choices: [[["dis", "mou"], 5], [["for", "vol"], -5]],
               fixed: ["cruel"], traits: ["colerique", "envieux", "lache", "humble", "trompeur"], count: 1 },
  "Lapin":   { mods: { dis: 5, mou: 5, per: 5, soc: 10, com: -5, for: -5 }, choices: [],
               fixed: [], traits: ["bienveillant", "lache", "prudent", "luxurieux", "clement", "humble"], count: 2 },
  "Lion":    { mods: { com: 5, for: 5, soc: 5, dis: -5 }, choices: [[["cns", "tec"], -5]],
               fixed: ["orgueilleux"], traits: ["paresseux", "luxurieux", "colerique", "loyal", "valeureux"], count: 1 },
  "Loup":    { mods: { com: 5, soc: -5 }, choices: [[["per", "sur"], 5]],
               fixed: ["colerique"], traits: ["cruel", "sobre", "loyal", "envieux", "valeureux"], count: 1 },
  "Mouton":  { mods: { tec: 5, per: 5, soc: 5, vol: -5 }, choices: [],
               fixed: ["humble"], traits: ["travailleur", "prudent", "lache", "clement", "chaste"], count: 1 },
  "Ours":    { mods: { for: 5, end: 5 }, choices: [[["per", "sur"], 5], [["cns", "dis"], -5]],
               fixed: [], traits: ["gourmand", "colerique", "bienveillant", "clement", "loyal", "valeureux"], count: 2 },
  "Paon":    { mods: { soc: 10, for: -5 }, choices: [[["cns", "per"], 5]],
               fixed: [], traits: ["envieux", "orgueilleux", "paresseux", "luxurieux", "lache", "trompeur"], count: 2 },
  "Porc":    { mods: { for: 5, end: 5, soc: 5 }, choices: [[["mou", "cns"], -5]],
               fixed: ["gourmand"], traits: ["colerique", "genereux", "luxurieux", "bienveillant", "paresseux"], count: 1 },
  "Rat":     { mods: { dis: 5, for: -5 }, choices: [[["cns", "vol"], 5], [["end", "sur"], 5]],
               fixed: [], traits: ["avare", "cruel", "envieux", "prudent", "chaste", "trompeur"], count: 2 },
  "Renard":  { mods: { mou: 5, soc: 5 }, choices: [[["dis", "tec"], 5], [["end", "for"], -5]],
               fixed: ["trompeur"], traits: ["paresseux", "gourmand", "prudent", "envieux", "lache"], count: 1 },
  "Serpent": { mods: { cns: 5, soc: 5, vol: 5 }, choices: [[["mou", "per"], -5]],
               fixed: [], traits: ["trompeur", "cruel", "envieux", "prudent", "travailleur", "sobre"], count: 2 },
  "Singe":   { mods: { mou: 10, soc: 5, vol: -5 }, choices: [],
               fixed: [], traits: ["genereux", "paresseux", "lache", "bienveillant", "clement", "trompeur"], count: 2 },
  "Souris":  { mods: { dis: 10, tec: 5, mou: 5, soc: 5, com: -5, for: -5 }, choices: [],
               fixed: ["bienveillant"], traits: ["lache", "genereux", "humble", "clement", "loyal"], count: 1 },
  "Taureau": { mods: { com: 5, end: 5, for: 5, dis: -5 }, choices: [[["cns", "tec"], -5]],
               fixed: [], traits: ["orgueilleux", "colerique", "luxurieux", "gourmand", "clement", "valeureux"], count: 2 },
  "Vautour": { mods: { per: 5, vol: 5 }, choices: [[["cns", "end"], 5], [["mou", "soc"], -5]],
               fixed: [], traits: ["avare", "humble", "sobre", "prudent", "cruel", "trompeur"], count: 2 }
};

/** Talents accessibles par archétype (p. 40-47) — noms Livre Premier. */
const RAW_TALENTS = {
  "Aigle":   ["Confiance en soi", "Dévoué serviteur", "Esprit de compétition", "Résilience", "Sommeil léger"],
  "Âne":     ["Calme", "Compagnon animal", "Distraction", "Guérison rapide", "Second souffle"],
  "Cerf":    ["Dévoué serviteur", "Inspiration", "Instinct de survie", "Sain d'esprit", "Sauvegarde"],
  "Chat":    ["Agile", "Dévoué serviteur", "Fascination", "Insaisissable", "Pattes de chat"],
  "Chien":   ["Festoyeur", "Gardien", "Inspiration", "Second souffle", "Sixième sens"],
  "Coq":     ["Esprit de compétition", "Panache", "Provocation", "Riposte", "Vivacité"],
  "Corbeau": ["Calme", "Distraction", "Doué (VOL)", "Nyctalopie", "Sauvegarde"],
  "Fourmi":  ["Prudent", "Sain d'esprit", "Sommeil léger", "Travail d'équipe", "Vivacité"],
  "Hibou":   ["Calme", "Inoffensif", "Mémoire sans faille", "Polyglotte", "Sain d'esprit"],
  "Hyène":   ["Coup en traître", "Nyctalopie", "Suivre l'exemple", "Surnombre", "Vivacité"],
  "Lapin":   ["Chance insolente", "Inoffensif", "Insaisissable", "Réflexes éclairs", "Vivacité"],
  "Lion":    ["Confiance en soi", "Dévoué serviteur", "Fascination", "Festoyeur", "Second souffle"],
  "Loup":    ["Instinct de survie", "Sauvagerie", "Sauvegarde", "Sixième sens", "Vivacité"],
  "Mouton":  ["Inoffensif", "Prudent", "Sain d'esprit", "Sauvegarde", "Suivre l'exemple"],
  "Ours":    ["Bagarre", "Brute", "Cri de guerre", "Gardien", "Sauvagerie"],
  "Paon":    ["Dévoué serviteur", "Doué (SOC)", "Fascination", "Panache", "Provocation"],
  "Porc":    ["Brute", "Distraction", "Doué (END)", "Festoyeur", "Guérison rapide"],
  "Rat":     ["Coup en traître", "Doué (DIS)", "Esquive", "Nyctalopie", "Vivacité"],
  "Renard":  ["Agile", "Chance insolente", "Esquive", "Mensonge éhonté", "Sauvegarde"],
  "Serpent": ["Calme", "Coup en traître", "Fascination", "Mensonge éhonté", "Résilience"],
  "Singe":   ["Agile", "Coup acrobatique", "Distraction", "Insaisissable", "Spectacle"],
  "Souris":  ["Chance insolente", "Esquive", "Insaisissable", "Réflexes éclairs", "Vivacité"],
  "Taureau": ["Brute", "Coups puissants", "Confiance en soi", "Festoyeur", "Second souffle"],
  "Vautour": ["Calme", "Chance insolente", "Distraction", "Provocation", "Sauvegarde"]
};

function loadPack() {
  const out = {};
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith(".json")) continue;
    const d = JSON.parse(readFileSync(join(DIR, f), "utf-8"));
    if (d.type === "archetype") out[d.name] = d.system;
  }
  return out;
}
const pack = loadPack();

const nonZero = (o = {}) => Object.fromEntries(Object.entries(o).filter(([, v]) => Number(v)));
const normChoices = (arr = []) => arr.map(c => [[...c.chars].sort(), Number(c.value)])
  .sort((a, b) => a[0].join().localeCompare(b[0].join()) || a[1] - b[1]);

test("p.37-47 — les 24 archétypes du livre sont présents dans le compendium", () => {
  const missing = Object.keys(RAW).filter(n => !pack[n]);
  const extra = Object.keys(pack).filter(n => !RAW[n]);
  assert.deepEqual(missing, [], `absents du pack : ${missing}`);
  assert.deepEqual(extra, [], `inconnus du livre : ${extra}`);
});

for (const [name, ref] of Object.entries(RAW)) {
  test(`p.40-47 ${name} — modificateurs de compétences conformes`, () => {
    const sys = pack[name];
    assert.ok(sys, `${name} absent du pack`);
    assert.deepEqual(nonZero(sys.modifiers), nonZero(ref.mods), `${name} : modificateurs fixes`);
    assert.deepEqual(normChoices(sys.modChoices), normChoices(ref.choices.map(([chars, value]) => ({ chars, value }))),
      `${name} : choix « X ou Y »`);
  });

  test(`p.40-47 ${name} — vices & vertus conformes (fixes + choix)`, () => {
    const sys = pack[name];
    assert.deepEqual([...(sys.traitsFixed ?? [])].sort(), [...ref.fixed].sort(), `${name} : traits d'office`);
    assert.deepEqual([...(sys.traitsChoices ?? [])].sort(), [...ref.traits].sort(), `${name} : traits au choix`);
    assert.equal(sys.traitsChoiceCount ?? 0, ref.count, `${name} : nombre de choix`);
  });
}

test("p.37 — équilibrage : chaque archétype fournit un bonus global NET de +10 (COM double)", () => {
  for (const [name, sys] of Object.entries(pack)) {
    let net = 0;
    for (const [k, v] of Object.entries(sys.modifiers ?? {})) {
      net += (Number(v) || 0) * (k === "com" ? 2 : 1);
    }
    for (const c of sys.modChoices ?? []) {
      // Le choix porte toujours sur des compétences au même « poids » sauf si COM
      // figure dans la liste — le livre n'utilise jamais COM dans un choix.
      assert.ok(!c.chars.includes("com"), `${name} : COM ne figure jamais dans un choix (poids double ambigu)`);
      net += Number(c.value) || 0;
    }
    assert.equal(net, 10, `${name} : bonus global net = +10 (obtenu ${net})`);
  }
});

test("p.50 — chaque archétype accorde exactement deux « +1 » de vices/vertus", () => {
  for (const [name, sys] of Object.entries(pack)) {
    const granted = (sys.traitsFixed?.length ?? 0) + (sys.traitsChoiceCount ?? 0);
    assert.equal(granted, 2, `${name} : ${granted} « +1 » au lieu de 2`);
  }
});

test("p.38/40-47 — 5 talents accessibles par archétype, conformes au livre", () => {
  const ap = s => s.replace(/[’']/g, "'");   // apostrophe droite vs typographique
  for (const [name, ref] of Object.entries(RAW_TALENTS)) {
    const sys = pack[name];
    assert.ok(sys, `${name} absent du pack`);
    assert.equal((sys.talents ?? []).length, 5, `${name} : 5 talents accessibles`);
    assert.deepEqual([...sys.talents].map(ap).sort(), [...ref].map(ap).sort(), `${name} : liste des talents`);
  }
});
