/**
 * Cohérence des données du Psyker : les noms du compendium correspondent aux règles automatiques
 * (bonus de spécialité par discipline, Psyconduit) et la création est possible.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIGANDYNE } from "../src/config/config.ts";
import { normalizeTraitKey, psyconduitBonus, startingPowerAllowance, canLearnPower } from "../src/data/warp-rules.ts";
import { loadPack } from "./helpers/doc.ts";

const specialties = loadPack("specialties").docs.filter(d => d.type === "specialty");
const powers = loadPack("psychic-powers").docs.filter(d => d.type === "psychicPower");
const equipment = loadPack("equipment").docs.filter(d => d.type === "equipment");

test("chaque discipline spécialisée a sa spécialité +5 dont le nom normalisé est la clé de discipline (bonus automatique aux pouvoirs)", () => {
  for (const disc of Object.keys(BRIGANDYNE.psychicDisciplines).filter(d => d !== "generique")) {
    const spec = specialties.find(s => normalizeTraitKey(s.name) === disc);
    assert.ok(spec, `spécialité de la discipline « ${disc} » absente`);
    assert.equal(spec.system.specialtyType, "occulte");
    assert.equal(spec.system.bonus, 5);
  }
});

test("Psyconduit : objet de base sans bonus, riche +5 %, relique +10 % dans le compendium Équipement", () => {
  const byName = (n: string) => equipment.find(e => e.name === n);
  assert.ok(byName("Psyconduit"), "Psyconduit de base (possession de départ des Psykers)");
  assert.equal(psyconduitBonus([byName("Psyconduit")]), 0);
  assert.equal(psyconduitBonus([byName("Psyconduit, riche")]), 5);
  assert.equal(psyconduitBonus([byName("Psyconduit, relique")]), 10);
});

test("chaque pouvoir du compendium a une discipline connue du système", () => {
  for (const p of powers) assert.ok(BRIGANDYNE.psychicDisciplines[p.system.discipline], `${p.name} : discipline « ${p.system.discipline} »`);
});

test("un Psyker créé avec PSY 40+ peut apprendre des pouvoirs de difficulté 0 ; avec PSY 20 seulement les +20 et les mineurs", () => {
  const nonMinor = powers.filter(p => !p.system.isMinor);
  assert.ok(nonMinor.some(p => canLearnPower(40, p.system.difficulty, false)));
  const at20 = nonMinor.filter(p => canLearnPower(20, p.system.difficulty, false));
  assert.ok(at20.length > 0 && at20.every(p => p.system.difficulty >= 20), "PSY 20 : uniquement les pouvoirs à +20 (p.216)");
  assert.equal(powers.filter(p => p.system.isMinor).every(p => canLearnPower(0, p.system.difficulty, true)), true);
  assert.deepEqual(startingPowerAllowance(3), { minor: 3, power: 3 });
});
