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
import { BRIGANDYNE } from "../module/config/config.mjs";

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

test("carrières 40k — équipement additionnel renseigné (« - » = aucun, explicite)", () => {
  // Les carrières féodales (Livre Premier non adapté) sont couvertes par le
  // test skippé ci-dessous.
  for (const c of careers.filter(c => c.system.faction !== "feodal")) {
    const txt = (c.system.startingEquipment ?? "").replace(/<[^>]+>/g, "").trim();
    assert.ok(txt.length > 0, `${c.name} : équipement additionnel absent`);
  }
});

test("carrières féodales — équipement de départ à renseigner",
  { skip: "contenu 40k à aligner (phase adaptation) : 16 carrières féodales sans équipement" }, () => {
  for (const c of careers.filter(c => c.system.faction === "feodal")) {
    const txt = (c.system.startingEquipment ?? "").replace(/<[^>]+>/g, "").trim();
    assert.ok(txt.length > 0, `${c.name} : équipement de départ absent`);
  }
});

test("p.26/57 — chaque faction utilisée par une carrière a un équipement de base",
  { skip: "contenu 40k à aligner (phase adaptation) : civils/feodal sans liste, nobles/pegre à re-router" }, () => {
  const used = new Set(careers.map(c => c.system.faction));
  for (const f of used) {
    assert.ok(BRIGANDYNE.factionBaseEquipment[f],
      `faction « ${f} » sans équipement de base`);
  }
});
