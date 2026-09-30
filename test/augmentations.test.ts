/**
 * Tests 40K — Augmentations (document d'adaptation, section Augmentations).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { augmentationStatus, augmentationEffects } from "../src/data/augmentations.ts";

const aug = (name: string, system: Record<string, any> = {}) => ({ name, system });

test("40K — *VOL* augmentations maximum ; l'esthétique ne compte pas ; la Cyberchape double le maximum", () => {
  assert.deepEqual(augmentationStatus(3, [aug("Bras bionique"), aug("Oeil bionique")]), { count: 2, max: 3, over: 0 });
  assert.equal(augmentationStatus(2, [aug("Bras bionique"), aug("Oeil bionique"), aug("Respirateur")]).over, 1);
  assert.equal(augmentationStatus(1, [aug("Augmentation esthétique"), aug("Augmentation esthétique"), aug("Bras bionique")]).over, 0);
  assert.equal(augmentationStatus(2, [aug("Cyberchape"), aug("Bras bionique"), aug("Oeil bionique"), aug("Respirateur"), aug("Vox implanté")]).over, 0);
  assert.equal(augmentationStatus(2, [aug("Viscères augmentées", { quantity: 3 })]).count, 3, "chaque installation compte");
  assert.equal(augmentationStatus(3, [aug("Bras bionique", { installed: false })]).count, 0, "non installée : ne compte pas");
});

test("40K — Augmentation esthétique : +5 % SOC chacune, +20 % maximum", () => {
  assert.equal(augmentationEffects([aug("Augmentation esthétique")]).chars.soc, 5);
  assert.equal(augmentationEffects([aug("Augmentation esthétique", { quantity: 3 })]).chars.soc, 15);
  assert.equal(augmentationEffects([aug("Augmentation esthétique", { quantity: 9 })]).chars.soc, 20);
});

test("40K — Bras bionique : FOR +10 % par bras (2 maximum)", () => {
  assert.equal(augmentationEffects([aug("Bras bionique")]).chars.for, 10);
  assert.equal(augmentationEffects([aug("Bras bionique", { quantity: 2 })]).chars.for, 20);
  assert.equal(augmentationEffects([aug("Bras bionique"), aug("Bras bionique")]).chars.for, 20, "deux objets = deux bras");
  assert.equal(augmentationEffects([aug("Bras bionique", { quantity: 5 })]).chars.for, 20);
});

test("40K — Jambe cybernétique : MOU +20 % seulement si les deux jambes sont équipées", () => {
  assert.equal(augmentationEffects([aug("Jambe cybernétique")]).chars.mou, undefined);
  assert.equal(augmentationEffects([aug("Jambe cybernétique", { quantity: 2 })]).chars.mou, 20);
});

test("40K — Organes bioniques : END +20 % ; Viscères augmentées : +2 PV par installation (5 max)", () => {
  assert.equal(augmentationEffects([aug("Organes bioniques")]).chars.end, 20);
  assert.equal(augmentationEffects([aug("Viscères augmentées", { quantity: 2 })]).pv, 4);
  assert.equal(augmentationEffects([aug("Viscères augmentées", { quantity: 9 })]).pv, 10);
});

test("40K — Armure subdermique : Protection +1 ; Tendons +10 % (tests de FOR) ; Implant cortical +10 % (tests de CNS)", () => {
  assert.equal(augmentationEffects([aug("Armure subdermique")]).protection, 1);
  assert.equal(augmentationEffects([aug("Tendons renforcés")]).tests.for, 10);
  assert.equal(augmentationEffects([aug("Implant cortical")]).tests.cns, 10);
});

test("aucune augmentation : aucun effet", () => {
  assert.deepEqual(augmentationEffects([]), { chars: {}, pv: 0, protection: 0, tests: {} });
});

test("compendium — les augmentations du document d'adaptation portent les noms attendus par les règles", () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "packs", "_source", "augmentations");
  const names = readdirSync(dir).map(f => JSON.parse(readFileSync(join(dir, f), "utf-8"))).filter(d => d.type === "augmentation").map(d => d.name);
  for (const n of ["Augmentation esthétique", "Bras bionique", "Jambe cybernétique", "Organes bioniques", "Viscères augmentées",
    "Armure subdermique", "Tendons renforcés", "Implant cortical", "Cyberchape"]) {
    assert.ok(names.includes(n), `augmentation « ${n} » absente du compendium`);
  }
});
