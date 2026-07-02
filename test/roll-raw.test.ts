/**
 * Tests RAW — Moteur de test d100 (Livre Premier, p. 128-133, 142).
 * BrigTest est instanciable hors Foundry moyennant un shim minimal de
 * foundry.utils.mergeObject (utilisé par le constructeur uniquement).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

(globalThis as any).foundry ??= {};
(globalThis as any).foundry.utils ??= {};
(globalThis as any).foundry.utils.mergeObject ??= (base: object, patch: object) => ({ ...base, ...patch });

const { BrigTest, degreeOf } = await import("../src/dice/roll.ts");

test("p.131 — cumul max de TROIS Avantages ou Désavantages (net)", () => {
  // Exemple RAW : 5 Désavantages + 1 Avantage = 3 Désavantages
  assert.equal(new BrigTest({ advantage: 1, disadvantage: 5 }).net, -3);
  assert.equal(new BrigTest({ advantage: 5, disadvantage: 0 }).net, 3);
  assert.equal(new BrigTest({ advantage: 2, disadvantage: 1 }).net, 1, "1 Av annule 1 Dés");
});

test("p.131 — 1 Avantage = +10, 1 Désavantage = −10 sur la cible", () => {
  const t = new BrigTest({ base: 38, advantage: 2, disadvantage: 0 });
  assert.equal(t.effectiveTarget, 58, "exemple RAW (Silas) : 38 + 2 Avantages = 58");
  const d = new BrigTest({ base: 45, advantage: 0, disadvantage: 1 });
  assert.equal(d.effectiveTarget, 35, "exemple RAW (chef malandrin) : 45 − 10 = 35");
});

test("cible jamais négative", () => {
  assert.equal(new BrigTest({ base: 10, disadvantage: 3 }).effectiveTarget, 0);
});

test("p.130-132 — grille complète des degrés sur cas limites", () => {
  // 00 = 100 → toujours échec critique, même à 99 % de réussite
  assert.equal(degreeOf(100, 99), "critFailure");
  // RU 0 en réussite → critique quel que soit le score
  assert.equal(degreeOf(20, 20), "critSuccess");
  assert.equal(degreeOf(70, 85), "critSuccess");
  // 01-09 : majeure seulement si cible ≥ 20 (médiocrité, p. 130)
  assert.equal(degreeOf(9, 20), "majorSuccess");
  assert.equal(degreeOf(9, 19), "minorSuccess");
  assert.equal(degreeOf(1, 15), "minorSuccess");
  // 91-99 : échec majeur seulement si cible < 80 (excellence, p. 132)
  assert.equal(degreeOf(99, 79), "majorFailure");
  assert.equal(degreeOf(99, 80), "minorFailure");
  // Réussites/échecs simples
  assert.equal(degreeOf(38, 58), "minorSuccess");
  assert.equal(degreeOf(78, 53), "minorFailure");
});
