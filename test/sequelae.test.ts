/**
 * Tests RAW — Séquelles & blessures graves (Livre Premier p.196-197).
 * La table est un d100 sur 11 lignes ; les pertes sont définitives.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SEQUELAE, sequelaFor } from "../src/data/sequelae.ts";

test("p.197 — la table couvre 01-100 sans trou ni chevauchement", () => {
  let expected = 1;
  for (const s of SEQUELAE) {
    assert.equal(s.min, expected, `${s.name} commence à ${expected}`);
    assert.ok(s.max >= s.min);
    expected = s.max + 1;
  }
  assert.equal(expected, 101, "la dernière ligne finit à 100");
});

test("p.197 — 11 lignes et bornes exactes du livre", () => {
  assert.equal(SEQUELAE.length, 11);
  const bounds = SEQUELAE.map(s => `${s.min}-${s.max}`);
  assert.deepEqual(bounds, ["1-5", "6-10", "11-20", "21-30", "31-45", "46-55", "56-65", "66-75", "76-85", "86-95", "96-100"]);
});

test("p.197 — exemple RAW : 11 = Souvenir enlaidissant, SOC −5 %", () => {
  const s = sequelaFor(11);
  assert.equal(s.name, "Souvenir enlaidissant");
  assert.deepEqual(s.penalties, [{ chars: ["soc"], value: -5 }]);
});

test("p.197 — Œil crevé (01-05) : TIR, HAB (→ TEC) et PER −5 % imposés", () => {
  const s = sequelaFor(3);
  assert.equal(s.name, "Œil crevé");
  assert.deepEqual(s.penalties.map(p => p.chars.join()), ["tir", "tec", "per"]);
  assert.ok(s.penalties.every(p => p.value === -5));
});

test("p.197 — Choc au crâne (21-30) : CNS −5 %", () => {
  assert.deepEqual(sequelaFor(25).penalties, [{ chars: ["cns"], value: -5 }]);
});

test("p.197 — blessures à choix du joueur : MOU/DIS, TEC/TIR, FOR/END, COM/VOL (−5 %)", () => {
  assert.deepEqual(sequelaFor(60).penalties, [{ chars: ["mou", "dis"], value: -5 }]);
  assert.deepEqual(sequelaFor(70).penalties, [{ chars: ["tec", "tir"], value: -5 }]);
  assert.deepEqual(sequelaFor(80).penalties, [{ chars: ["for", "end"], value: -5 }]);
  assert.deepEqual(sequelaFor(98).penalties, [{ chars: ["com", "vol"], value: -5 }]);
});

test("p.197 — Douleurs chroniques (86-95) : perte définitive de 2 PV", () => {
  assert.equal(sequelaFor(90).pvLost, 2);
  assert.equal(sequelaFor(86).name, "Douleurs chroniques");
  assert.equal(sequelaFor(95).name, "Douleurs chroniques");
});

test("p.197 — Belle cicatrice, Oreille et Infection n'ôtent aucun point de compétence", () => {
  for (const roll of [8, 40, 50]) assert.deepEqual(sequelaFor(roll).penalties, []);
});

test("bornes du d100 : 1 et 100 sont couverts, valeurs hors bornes ramenées", () => {
  assert.equal(sequelaFor(1).name, "Œil crevé");
  assert.equal(sequelaFor(100).name, "Blessure traumatisante");
  assert.equal(sequelaFor(0).name, "Œil crevé");
  assert.equal(sequelaFor(101).name, "Blessure traumatisante");
});
