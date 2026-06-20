import { test } from "node:test";
import assert from "node:assert/strict";
import { degreeOf, rerollCostFor } from "../module/dice/roll.js";
import { vitality, sangFroid, bonusOf, vitalityMinor, speciesResourceBonus } from "../module/data/derive.js";

test("degreeOf — réussites", () => {
  assert.equal(degreeOf(50, 50), "critSuccess");   // RU 0 sous la cible
  assert.equal(degreeOf(10, 50), "critSuccess");
  assert.equal(degreeOf(5, 50), "majorSuccess");   // 01-09, cible ≥ 20
  assert.equal(degreeOf(23, 50), "minorSuccess");
  assert.equal(degreeOf(50, 50), "critSuccess");
});

test("degreeOf — exception « médiocrité » (< 20 % → pas de majeure)", () => {
  assert.equal(degreeOf(5, 15), "minorSuccess");   // réussite mais cible < 20
  assert.equal(degreeOf(10, 15), "critSuccess");   // le critique reste possible
});

test("degreeOf — échecs", () => {
  assert.equal(degreeOf(100, 50), "critFailure");  // 00 = 100, RU 0
  assert.equal(degreeOf(90, 50), "critFailure");   // RU 0 au-dessus de la cible
  assert.equal(degreeOf(95, 50), "majorFailure");  // 91-99, cible < 80
  assert.equal(degreeOf(73, 50), "minorFailure");
});

test("degreeOf — exception « excellence » (≥ 80 % → pas de majeur)", () => {
  assert.equal(degreeOf(95, 85), "minorFailure");  // échec mais cible ≥ 80
  assert.equal(degreeOf(90, 85), "critFailure");   // le critique reste possible
});

test("degreeOf — cible 0 échoue toujours", () => {
  assert.equal(degreeOf(1, 0), "minorFailure");
  assert.equal(degreeOf(10, 0), "critFailure");
});

test("rerollCostFor — 6 sur échec critique, 4 sinon", () => {
  assert.equal(rerollCostFor("critFailure"), 6);
  assert.equal(rerollCostFor("minorFailure"), 4);
  assert.equal(rerollCostFor("minorSuccess"), 4);
});

test("bonusOf — chiffre des dizaines", () => {
  assert.equal(bonusOf(45), 4);
  assert.equal(bonusOf(50), 5);
  assert.equal(bonusOf(9), 0);
});

test("vitality / sangFroid — exemples du livre (Balthazar : 17 / 17)", () => {
  assert.equal(vitality({ for: 37, end: 37, vol: 38 }), 17);   // 7 + 7 + 3
  assert.equal(sangFroid({ vol: 38, cns: 31, com: 42 }), 17);  // 7 + 6 + 4
});

test("vitality — bonus d'espèce additionnel", () => {
  assert.equal(vitality({ for: 37, end: 37, vol: 38 }, 2), 19);
  assert.equal(vitalityMinor({ for: 50, end: 40 }), 14);       // PNJ mineur : FOR/5 + END/10
});

test("speciesResourceBonus — pvPlus2 + sfPlus1", () => {
  assert.deepEqual(speciesResourceBonus(["pvPlus2", "sfPlus1"]), { pv: 2, sf: 1 });
  assert.deepEqual(speciesResourceBonus(["pvPlus1"]), { pv: 1, sf: 0 });
});
