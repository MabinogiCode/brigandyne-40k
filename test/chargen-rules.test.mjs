/**
 * Tests RAW — Création de personnage (Livre Premier, p. 20-27 & 110-115).
 * Chaque test cite la règle du livre qu'il verrouille.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POINTS_TOTAL, POINTS_MAX_PER_CHAR, PSY_DRAW_MAX, ROLL_COUNT, QUICK_SCORES,
  dropLowest, pointBuyValid, applyPsyTransfer,
  atoutCount, selectableAtouts, drawAtoutOptions
} from "../module/data/chargen-rules.mjs";

/* ------------------------------------------------------------------ */
/* Compétences — méthode A (tirage) et B (points), p. 25              */
/* ------------------------------------------------------------------ */

test("p.25 méthode A — 13 tirages de 2D10, on raye le plus faible", () => {
  assert.equal(ROLL_COUNT, 13);
  // Exemple RAW (Balthazar) : 12,13,15,8,6,12,10,13,4,3,11,17,15 → on raye le 3
  const sums = [12, 13, 15, 8, 6, 12, 10, 13, 4, 3, 11, 17, 15];
  const { pool, dropped } = dropLowest(sums);
  assert.equal(dropped, 3);
  assert.equal(pool.length, 12);
  assert.deepEqual(pool, [12, 13, 15, 8, 6, 12, 10, 13, 4, 11, 17, 15]);
});

test("p.25 méthode A — un seul exemplaire du minimum est rayé (doublons conservés)", () => {
  const { pool, dropped } = dropLowest([5, 5, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
  assert.equal(dropped, 5);
  assert.equal(pool.filter(v => v === 5).length, 1);
});

test("p.25 méthode B — 120 points, de 0 à 20 par compétence", () => {
  assert.equal(POINTS_TOTAL, 120);
  assert.equal(POINTS_MAX_PER_CHAR, 20);
  assert.ok(pointBuyValid([20, 20, 20, 20, 20, 20, 0, 0, 0, 0, 0, 0]));      // exactement 120
  assert.ok(pointBuyValid([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 0])); // 110 ≤ 120
  assert.ok(!pointBuyValid([21, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));          // > 20/comp
  assert.ok(!pointBuyValid([20, 20, 20, 20, 20, 20, 1, 0, 0, 0, 0, 0]));     // 121 > 120
  assert.ok(!pointBuyValid([-5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));          // négatif interdit
});

test("p.21 création rapide — les 12 scores fixes (00 en PSY à part)", () => {
  assert.deepEqual([...QUICK_SCORES].sort((a, b) => a - b),
    [25, 30, 30, 30, 35, 35, 35, 40, 40, 40, 45, 45]);
  assert.equal(QUICK_SCORES.reduce((s, v) => s + v, 0), 430);
});

/* ------------------------------------------------------------------ */
/* Transfert vers PSY (MAGIE), p. 25                                  */
/* ------------------------------------------------------------------ */

test("p.25 PSY — max 10 par compétence, COM compte double", () => {
  assert.equal(PSY_DRAW_MAX, 10);
  // Exemple RAW (Silas) : 10 SUR, 10 END, 5 COM, 5 FOR, 5 HAB → 40 en MAGIE
  const base = { com: 40, cns: 30, dis: 30, end: 35, for: 30, tec: 35, psy: 0,
                 mou: 30, per: 30, soc: 30, sur: 35, tir: 30, vol: 30 };
  const out = applyPsyTransfer(base, { sur: 10, end: 10, com: 5, for: 5, tec: 5 });
  assert.equal(out.psy, 40, "5 COM comptent double (10) + 10 + 10 + 5 + 5");
  assert.equal(out.sur, 25);
  assert.equal(out.end, 25);
  assert.equal(out.com, 35);
});

test("p.25 PSY — prélèvement écrêté à 10, jamais de compétence négative", () => {
  const base = { com: 25, sur: 5, psy: 0 };
  const out = applyPsyTransfer(base, { sur: 15, com: 15 });
  assert.equal(out.sur, 0, "5 - 10 borné à 0");
  assert.equal(out.com, 15, "prélèvement max 10");
  assert.equal(out.psy, 30, "10 (sur, écrêté) + 10×2 (com, écrêté)");
});

test("PSY — plafond de création appliqué si fourni", () => {
  const out = applyPsyTransfer({ com: 50, psy: 0 }, { com: 10 }, 15);
  assert.equal(out.psy, 15);
});

/* ------------------------------------------------------------------ */
/* Atouts de départ, p. 22, 26, 110, 115                              */
/* ------------------------------------------------------------------ */

test("p.26/110 — nombre d'atouts de départ = *CNS* − 1", () => {
  assert.equal(atoutCount(35), 2, "exemple RAW : CNS 35 → 2 atouts");
  assert.equal(atoutCount(30), 2, "exemple RAW (Rose) : CNS 30 → 2 atouts");
  assert.equal(atoutCount(25), 1, "exemple RAW (Daïna) : CNS 25 → 1 atout");
  assert.equal(atoutCount(19), 0, "*CNS* 1 → 0 atout");
  assert.equal(atoutCount(9), 0, "jamais négatif");
  assert.equal(atoutCount(0), 0);
});

test("p.111/115 — un atout ne peut jamais être pris deux fois", () => {
  const entries = [
    { name: "Vigilance", kind: "specialty", specialtyType: "standard" },
    { name: "Calme", kind: "talent" }
  ];
  const rest = selectableAtouts(entries, { owned: ["Vigilance"] });
  assert.deepEqual(rest.map(e => e.name), ["Calme"]);
});

test("p.111 — pas de spécialité occulte si PSY = 0 (choisissable si PSY > 0)", () => {
  const entries = [
    { name: "Télépathie", kind: "specialty", specialtyType: "occulte" },
    { name: "Vigilance", kind: "specialty", specialtyType: "standard" },
    { name: "Doué", kind: "talent" }
  ];
  assert.deepEqual(selectableAtouts(entries, { psy: 0 }).map(e => e.name), ["Vigilance", "Doué"]);
  assert.equal(selectableAtouts(entries, { psy: 35 }).length, 3);
});

test("p.110/115 — tirage 2D10 : toujours DEUX options distinctes (doublé relancé)", () => {
  const pool = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  // rand fixe qui produirait un doublé sans la relance
  const opts = drawAtoutOptions(pool, () => 0.31);
  assert.equal(opts.length, 2);
  assert.notEqual(opts[0], opts[1]);
  // couverture : sur beaucoup de tirages, jamais de doublon, toujours dans le pool
  let seed = 42;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let n = 0; n < 500; n++) {
    const o = drawAtoutOptions(pool, rand);
    assert.equal(o.length, 2);
    assert.notEqual(o[0], o[1]);
    assert.ok(pool.includes(o[0]) && pool.includes(o[1]));
  }
});

test("tirage — pool réduit : 1 option si un seul atout restant, 0 si vide", () => {
  assert.deepEqual(drawAtoutOptions(["Seul"]), ["Seul"]);
  assert.deepEqual(drawAtoutOptions([]), []);
});
