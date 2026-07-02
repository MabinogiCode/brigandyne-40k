/**
 * Tests RAW — Équipement de départ (Livre Premier p. 26/57 + document
 * d'adaptation « Warhammer 40.000 : Brigandyne », Possessions de départ).
 * R30 : équipement de BASE du groupe de carrières + équipement ADDITIONNEL
 * de la carrière.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BRIGANDYNE } from "../src/config/config.ts";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "packs", "_source", "careers");
const careers = readdirSync(DIR).filter(f => f.endsWith(".json"))
  .map(f => JSON.parse(readFileSync(join(DIR, f), "utf-8")))
  .filter(d => d.type === "career");

test("p.26/57 — les groupes documentés ont un équipement de base non vide", () => {
  const documented = ["administratum", "arbites", "mechanicus", "ministorum",
    "militarum", "assassinorum", "psykana", "nobles", "pegre"];
  for (const key of documented) {
    const html = BRIGANDYNE.factionBaseEquipment[key];
    assert.ok(html && html.replace(/<[^>]+>/g, "").trim().length > 10,
      `équipement de base manquant ou vide pour « ${key} »`);
  }
});

test("adaptation 40k — signatures des possessions de départ (docx)", () => {
  const E = BRIGANDYNE.factionBaseEquipment;
  assert.match(E.militarum, /Plaques d’identification/);
  assert.match(E.militarum, /Couteau de combat/);
  assert.match(E.arbites, /Uniforme de l’Adeptus Arbites/);
  assert.match(E.arbites, /Matraque/);
  assert.match(E.administratum, /Bure d’adepte/);
  assert.match(E.ministorum, /Symbole sacré/);
  assert.match(E.mechanicus, /Outils de mécanique/);
  assert.match(E.assassinorum, /Combinaison moulante/);
  assert.match(E.psykana, /Psyconduit/);
  assert.match(E.nobles, /Vêtements riches/);
  assert.match(E.pegre, /Armure primitive/);
});

test("chaque carrière a un équipement additionnel renseigné (« - » = aucun, explicite)", () => {
  for (const c of careers) {
    const txt = (c.system.startingEquipment ?? "").replace(/<[^>]+>/g, "").trim();
    assert.ok(txt.length > 0, `${c.name} : équipement additionnel absent`);
  }
});

test("p.26/57 — chaque carrière a un équipement de BASE effectif (carrière ou faction)", () => {
  for (const c of careers) {
    const own = (c.system.baseEquipment ?? "").replace(/<[^>]+>/g, "").trim();
    const faction = (BRIGANDYNE.factionBaseEquipment[c.system.faction] ?? "").replace(/<[^>]+>/g, "").trim();
    assert.ok(own.length > 0 || faction.length > 0,
      `${c.name} (${c.system.faction}) : aucun équipement de base`);
  }
});

test("les carrières féodales portent l'équipement de leur groupe Livre Premier", () => {
  for (const c of careers.filter(c => c.system.faction === "feodal")) {
    const own = (c.system.baseEquipment ?? "").replace(/<[^>]+>/g, "").trim();
    assert.ok(own.length > 10, `${c.name} : baseEquipment (groupe fantasy) absent`);
  }
});

test("chaque faction de carrière est déclarée dans BRIGANDYNE.factions", () => {
  for (const c of careers) {
    assert.ok(BRIGANDYNE.factions[c.system.faction],
      `${c.name} : faction « ${c.system.faction} » inconnue de la config`);
  }
});
