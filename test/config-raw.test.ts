/**
 * Tests RAW — Configuration du système contre le Livre Premier.
 * Système de jeu (p. 128-134), niveaux de vie (p. 141/145), vices & vertus
 * (p. 48-50), portées (p. 167), tactiques (p. 180-181), expérience (p. 150-151).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIGANDYNE } from "../src/config/config.ts";

/* ------------------------------------------------------------------ */
/* Système de jeu                                                     */
/* ------------------------------------------------------------------ */

test("p.130 — échelle des difficultés : +40 à −40 par pas de 10", () => {
  const vals = Object.keys(BRIGANDYNE.difficulties).map(Number).sort((a, b) => a - b);
  assert.deepEqual(vals, [-40, -30, -20, -10, 0, 10, 20, 30, 40]);
});

test("p.133 — MODO = 50 − compétence adverse", () => {
  assert.equal(BRIGANDYNE.mechanics.modoCenter, 50);
  const modo = (comp) => BRIGANDYNE.mechanics.modoCenter - comp;
  assert.equal(modo(20), 30, "gobelin chétif FOR 20 → +30 (exemple RAW)");
  assert.equal(modo(65), -15, "marchand SOC 65 → −15 (exemple RAW)");
  assert.equal(modo(50), 0, "adversaires de même niveau → 50 %");
});

test("p.142 — bon stress : 1 Avantage = 2 SF ; bonus = +10 %", () => {
  assert.equal(BRIGANDYNE.mechanics.sfForAdvantage, 2);
  assert.equal(BRIGANDYNE.mechanics.sfBonusPercent, 10);
});

test("p.211 — sacrifier des PV : +1 % par PV", () => {
  assert.equal(BRIGANDYNE.mechanics.pvForBonus, 1);
});

/* ------------------------------------------------------------------ */
/* Vices & vertus (p. 48-50)                                          */
/* ------------------------------------------------------------------ */

test("p.48 — dix vices et dix vertus", () => {
  assert.equal(Object.keys(BRIGANDYNE.vices).length, 10);
  assert.equal(Object.keys(BRIGANDYNE.virtues).length, 10);
});

test("p.50 — effet miroir : chaque vice a sa vertu opposée (bijection)", () => {
  const mirrors = BRIGANDYNE.traitMirrors;
  assert.deepEqual(Object.keys(mirrors).sort(), Object.keys(BRIGANDYNE.vices).sort(),
    "chaque vice a un miroir");
  assert.deepEqual(Object.values(mirrors).sort(), Object.keys(BRIGANDYNE.virtues).sort(),
    "chaque vertu est le miroir d'exactement un vice");
  // Paires exactes du livre (p. 48)
  assert.equal(mirrors.avare, "genereux");
  assert.equal(mirrors.colerique, "prudent");
  assert.equal(mirrors.cruel, "clement");
  assert.equal(mirrors.envieux, "bienveillant");
  assert.equal(mirrors.gourmand, "sobre");
  assert.equal(mirrors.lache, "valeureux");
  assert.equal(mirrors.luxurieux, "chaste");
  assert.equal(mirrors.orgueilleux, "humble");
  assert.equal(mirrors.paresseux, "travailleur");
  assert.equal(mirrors.trompeur, "loyal");
});

/* ------------------------------------------------------------------ */
/* Niveaux de vie (p. 141 repos PV, p. 145 repos SF)                  */
/* ------------------------------------------------------------------ */

test("p.141/145 — régénération PV et SF par niveau de vie", () => {
  const L = BRIGANDYNE.lifestyles;
  assert.deepEqual(Object.keys(L), ["miserable", "pauvre", "ordinaire", "aise", "riche", "royal"],
    "six niveaux de vie");
  // PV (p. 141) : 1/sem · 1/2 nuits · 1/nuit · 2/nuit · 2/nuit · 2/nuit
  assert.equal(L.miserable.pv, "1/sem");
  assert.equal(L.pauvre.pv, "1/2j");
  assert.equal(L.ordinaire.pv, "1/j");
  assert.equal(L.aise.pv, "2/j");
  assert.equal(L.riche.pv, "2/j");
  assert.equal(L.royal.pv, "2/j");
  // SF (p. 145) : +1/sem · +1/2 nuits · +1/nuit · +1/nuit · +2/nuit · +2/nuit
  assert.equal(L.miserable.sf, "1/sem");
  assert.equal(L.pauvre.sf, "1/2j");
  assert.equal(L.ordinaire.sf, "1/j");
  assert.equal(L.aise.sf, "1/j");
  assert.equal(L.riche.sf, "2/j");
  assert.equal(L.royal.sf, "2/j");
});

/* ------------------------------------------------------------------ */
/* Portées (p. 167)                                                   */
/* ------------------------------------------------------------------ */

test("p.167 — cinq portées : 1 / 5 / 20 / 50 / 100 m", () => {
  const R = BRIGANDYNE.ranges;
  assert.equal(R.contact.m, 1);
  assert.equal(R.courte.m, 5);
  assert.equal(R.moyenne.m, 20);
  assert.equal(R.longue.m, 50);
  assert.equal(R.extreme.m, 100);
});

/* ------------------------------------------------------------------ */
/* Tactiques de combat (p. 180-181)                                   */
/* ------------------------------------------------------------------ */

test("p.180-181 — tactiques : Av/Dés et règles de dégâts conformes", () => {
  const T = BRIGANDYNE.combatTactics;
  assert.deepEqual({ adv: T.efficace.adv, dis: T.efficace.dis, dmg: T.efficace.dmg },
    { adv: 0, dis: 0, dmg: "normal" }, "Efficace : test normal");
  assert.deepEqual({ adv: T.enForce.adv, dis: T.enForce.dis, dmg: T.enForce.dmg },
    { adv: 0, dis: 1, dmg: "plusFor" }, "En force : 1 Désavantage, +*FOR* dégâts");
  assert.deepEqual({ adv: T.enFinesse.adv, dis: T.enFinesse.dis, dmg: T.enFinesse.dmg },
    { adv: 1, dis: 0, dmg: "half" }, "En finesse : 1 Avantage, dégâts ÷2");
  assert.deepEqual({ adv: T.surLaDefensive.adv, dmg: T.surLaDefensive.dmg },
    { adv: 2, dmg: "none" }, "Sur la défensive : 2 Avantages, aucun dégât");
  assert.equal(T.viser.dmg, "ignoreArmor", "Viser : ignore l'armure");
  assert.ok(T.viser.malus <= -5, "Viser : malus d'au moins −5");
});

/* ------------------------------------------------------------------ */
/* Expérience (p. 150-151)                                            */
/* ------------------------------------------------------------------ */

test("p.150 — coût de progression par palier : 100/150/200/250/300/350", () => {
  const cost = BRIGANDYNE.charAdvanceCost;
  assert.equal(cost(36), 100, "≤ 50 : 100 PX (exemple RAW : 31→36)");
  assert.equal(cost(50), 100);
  assert.equal(cost(52), 150, "51-60 : 150 PX (exemple RAW : 47→52)");
  assert.equal(cost(60), 150);
  assert.equal(cost(61), 200);
  assert.equal(cost(70), 200);
  assert.equal(cost(71), 250);
  assert.equal(cost(80), 250);
  assert.equal(cost(81), 300);
  assert.equal(cost(90), 300);
  assert.equal(cost(91), 350);
  assert.equal(cost(100), 350);
});

test("p.150-151 — une case = +5 %, six cases max, hors profil/carrière = +50 PX", () => {
  const A = BRIGANDYNE.advancement;
  assert.equal(A.charStep, 5, "une amélioration = +5 %");
  assert.equal(A.maxBoxes, 6, "6 cases de progression par compétence");
  assert.equal(A.charOffProfileExtra, 50, "hors profil : +50 PX");
  assert.equal(A.specialtyCost, 100, "spécialité de carrière : 100 PX");
  assert.equal(A.talentCost, 100, "talent de carrière : 100 PX");
});
