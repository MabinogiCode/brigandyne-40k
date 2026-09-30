/**
 * Tests RAW — Magie/Pouvoirs psychiques (Livre Premier p.208-214), Sang-froid
 * et Folie (p.142-147, 174-177), Destin (p.146-147) et adaptation 40K
 * (Corruption, Mutations, Pouvoirs, Vraie Foi, Augmentations).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIGANDYNE } from "../src/config/config.ts";
import {
  normalizeTraitKey, parseResistanceKey, psyDailyLimits, psyOverflowCost, resistanceModifier, isAutomaticCast,
  pariaDisadvantage, PARIA_WARP_BONUS, disciplineCount, CORRUPTION_SOURCES, corruptionViceLevels, corruptionSfLoss,
  mutationKind, madnessSfLoss, madnessPermanentLoss, isMad, permanentDestinSpend, FAITH_VIRTUES, canChannelFaith,
  faithActsPerDay, faithPrayerTurns, FAITH_OVERLIMIT_MALUS
} from "../src/data/warp-rules.ts";

const trait = (name: string, traitType: string, rating: number) => ({ name, system: { traitType, rating } });

/* ------------------------------------------------------------------ */
/* Pouvoirs psychiques                                                 */
/* ------------------------------------------------------------------ */

test("p.209 + 40K — limites journalières : *PSY* pouvoirs ET *PSY* pouvoirs mineurs, compteurs distincts", () => {
  assert.deepEqual(psyDailyLimits(4), { minor: 4, power: 4 });   // exemple RAW Silas : 40 en MAG → 4 + 4
  assert.deepEqual(psyDailyLimits(0), { minor: 0, power: 0 });
});

test("p.209 — dépasser la limite : 2 PV pour un pouvoir mineur, 4 pour un pouvoir", () => {
  assert.equal(psyOverflowCost(true), 2);
  assert.equal(psyOverflowCost(false), 4);
});

test("p.208 — un pouvoir mineur (tour de magie) réussit automatiquement", () => {
  assert.equal(isAutomaticCast(true), true);
  assert.equal(isAutomaticCast(false), false);
});

test("p.213 — Résistance : difficulté du sort OU MODO, le plus difficile (exemples RAW : garde MOU 35 → 0 ; félin MOU 70 → −20)", () => {
  assert.equal(resistanceModifier(0, [35]), 0);       // MODO +15 → on garde la difficulté 0
  assert.equal(resistanceModifier(0, [70]), -20);     // MODO −20 plus difficile
  assert.equal(resistanceModifier(-10, [70]), -20);
  assert.equal(resistanceModifier(-30, [70]), -30);
  assert.equal(resistanceModifier(10, []), 10, "sans cible : difficulté seule");
});

test("p.213 — plusieurs cibles : on prend la Résistance la plus haute", () => {
  assert.equal(resistanceModifier(0, [35, 70, 50]), -20);
});

test("40K — Résistance du pouvoir lue depuis « MOU », « VOL », « - »", () => {
  assert.equal(parseResistanceKey("MOU"), "mou");
  assert.equal(parseResistanceKey(" vol "), "vol");
  assert.equal(parseResistanceKey("-"), null);
  assert.equal(parseResistanceKey(""), null);
});

test("40K — Gêne du Paria : 1 Désavantage aux Psykers proches ; +10 % pour résister au Warp", () => {
  assert.equal(pariaDisadvantage(1), 1);
  assert.equal(pariaDisadvantage(3), 1, "les Parias ne cumulent pas les Désavantages");
  assert.equal(pariaDisadvantage(0), 0);
  assert.equal(PARIA_WARP_BONUS, 10);
});

test("40K — disciplines connues selon PSY : 01-49 → 1 … 100 → 5", () => {
  const t = BRIGANDYNE.psyDisciplineThresholds;
  assert.equal(disciplineCount(0, t), 1);
  assert.equal(disciplineCount(49, t), 1);
  assert.equal(disciplineCount(50, t), 2);
  assert.equal(disciplineCount(69, t), 2);
  assert.equal(disciplineCount(70, t), 3);
  assert.equal(disciplineCount(89, t), 3);
  assert.equal(disciplineCount(90, t), 4);
  assert.equal(disciplineCount(99, t), 4);
  assert.equal(disciplineCount(100, t), 5);
});

/* ------------------------------------------------------------------ */
/* Corruption & mutations (40K)                                        */
/* ------------------------------------------------------------------ */

test("40K — sources de corruption : mineure +10, médiane 0, majeure −10", () => {
  assert.deepEqual(CORRUPTION_SOURCES, { minor: 10, median: 0, major: -10 });
});

test("40K — Vices des dieux sombres (Khorne, Slaanesh, Nurgle, Tzeentch)", () => {
  const G = BRIGANDYNE.chaosGods;
  assert.deepEqual(G.khorne.vices, ["colerique", "cruel", "orgueilleux", "avare"]);
  assert.deepEqual(G.slaanesh.vices, ["gourmand", "luxurieux", "avare", "orgueilleux"]);
  assert.deepEqual(G.nurgle.vices, ["paresseux", "lache", "gourmand", "envieux"]);
  assert.deepEqual(G.tzeentch.vices, ["trompeur", "envieux", "orgueilleux", "lache"]);
});

test("40K — noms de vices/vertus normalisés (accents, casse, suffixes)", () => {
  assert.equal(normalizeTraitKey("Colérique"), "colerique");
  assert.equal(normalizeTraitKey("Lâche"), "lache");
  assert.equal(normalizeTraitKey("Colérique +1"), "colerique");
  assert.equal(normalizeTraitKey("  Généreux (2) "), "genereux");
});

test("40K — 1 Désavantage par niveau de Vice lié au dieu (exemple : Colérique +1 face à Khorne)", () => {
  const khorne = BRIGANDYNE.chaosGods.khorne.vices;
  assert.equal(corruptionViceLevels(khorne, [trait("Colérique", "vice", 1)]), 1);
  assert.equal(corruptionViceLevels(khorne, [trait("Colérique", "vice", 2), trait("Cruel", "vice", 1)]), 3);
  assert.equal(corruptionViceLevels(khorne, [trait("Gourmand", "vice", 3)]), 0, "Gourmand n'est pas un vice de Khorne");
  assert.equal(corruptionViceLevels(khorne, [trait("Loyal", "vertu", 2)]), 0, "une vertu ne compte pas");
});

test("40K — les traits du compendium/de l'assistant (nom = libellé localisé) sont reconnus pour chaque dieu", () => {
  for (const [god, def] of Object.entries(BRIGANDYNE.chaosGods) as Array<[string, any]>) {
    for (const key of def.vices) {
      const label = { colerique: "Colérique", cruel: "Cruel", orgueilleux: "Orgueilleux", avare: "Avare", gourmand: "Gourmand",
        luxurieux: "Luxurieux", paresseux: "Paresseux", lache: "Lâche", envieux: "Envieux", trompeur: "Trompeur" }[key];
      assert.equal(corruptionViceLevels(def.vices, [trait(label, "vice", 1)]), 1, `${god} / ${key}`);
    }
  }
});

test("40K — Corruption : SF perdu = Seuil d'instabilité, +1 sur un E+ ; rien sur une réussite", () => {
  assert.equal(corruptionSfLoss(4, -1), 4, "échec mineur");
  assert.equal(corruptionSfLoss(4, -2), 5, "échec majeur (E+)");
  assert.equal(corruptionSfLoss(4, -3), 5, "échec critique (E+)");
  assert.equal(corruptionSfLoss(4, 2), 0, "réussite");
});

test("40K — mutation : D10 pair → Grâce, impair → Fardeau", () => {
  for (const n of [2, 4, 6, 8, 10]) assert.equal(mutationKind(n), "grace", String(n));
  for (const n of [1, 3, 5, 7, 9]) assert.equal(mutationKind(n), "fardeau", String(n));
});

/* ------------------------------------------------------------------ */
/* Folie (p.143, 174-177)                                              */
/* ------------------------------------------------------------------ */

test("p.143 — test de Folie raté : −2 SF (mineur), −4 (majeur), −6 (critique) ; exemple RAW : échec majeur = −4", () => {
  assert.equal(madnessSfLoss(-1), 2);
  assert.equal(madnessSfLoss(-2), 4);
  assert.equal(madnessSfLoss(-3), 6);
  assert.equal(madnessSfLoss(1), 0);
});

test("p.176 — crise de folie : perte définitive = Instabilité (exemple RAW : SF 18 → 4, limite 14 ; 25 → 6 ; 14 → 3)", () => {
  assert.equal(madnessPermanentLoss(18), 4);
  assert.equal(madnessPermanentLoss(25), 6);
  assert.equal(madnessPermanentLoss(14), 3);
});

test("p.176 — personnage fou : SF définitif sous son Instabilité", () => {
  assert.equal(isMad(3, 4), true);
  assert.equal(isMad(4, 4), false);
});

/* ------------------------------------------------------------------ */
/* Destin (p.147)                                                      */
/* ------------------------------------------------------------------ */

test("p.147 — éviter la mort : −1 Destin courant ET de départ ; impossible à 0", () => {
  assert.deepEqual(permanentDestinSpend(3, 3), { ok: true, value: 2, max: 2 });
  assert.deepEqual(permanentDestinSpend(1, 3), { ok: true, value: 0, max: 2 });
  assert.deepEqual(permanentDestinSpend(0, 3), { ok: false, value: 0, max: 3 });
});

/* ------------------------------------------------------------------ */
/* Vraie Foi (40K)                                                     */
/* ------------------------------------------------------------------ */

test("40K — Vraie Foi : Généreux, Bienveillant, Valeureux, Chaste ou Loyal, ou Colérique +2", () => {
  assert.deepEqual(FAITH_VIRTUES, ["genereux", "bienveillant", "valeureux", "chaste", "loyal"]);
  for (const v of ["Généreux", "Bienveillant", "Valeureux", "Chaste", "Loyal"]) {
    assert.equal(canChannelFaith([trait(v, "vertu", 1)]), true, v);
  }
  assert.equal(canChannelFaith([trait("Colérique", "vice", 2)]), true);
  assert.equal(canChannelFaith([trait("Colérique", "vice", 1)]), false, "Colérique +1 ne suffit pas");
  assert.equal(canChannelFaith([trait("Prudent", "vertu", 2)]), false, "Prudent n'ouvre pas la Foi");
  assert.equal(canChannelFaith([trait("Loyal", "vertu", 0)]), false);
  assert.equal(canChannelFaith([]), false);
});

test("40K — Actes de Foi : *VOL*/2 par jour ; −20 % au-delà ; 2 tours de prière, 3 pour un Miracle", () => {
  assert.equal(faithActsPerDay(3), 1);
  assert.equal(faithActsPerDay(4), 2);
  assert.equal(faithActsPerDay(0), 0);
  assert.equal(FAITH_OVERLIMIT_MALUS, -20);
  assert.equal(faithPrayerTurns(false), 2);
  assert.equal(faithPrayerTurns(true), 3);
});

/* ------------------------------------------------------------------ */
/* Apprentissage des pouvoirs (Magie p.216-218 adapté au Psychisme)    */
/* ------------------------------------------------------------------ */

import { startingPowerAllowance, canLearnPower, powerXpCost, powerLearning, psyconduitBonus, pvSacrifice } from "../src/data/warp-rules.ts";

test("p.216 — pouvoirs de départ : *CNS* mineurs + *CNS* pouvoirs (exemple Silas : CNS 43 → 4 + 4)", () => {
  assert.deepEqual(startingPowerAllowance(4), { minor: 4, power: 4 });
  assert.deepEqual(startingPowerAllowance(0), { minor: 0, power: 0 });
});

test("p.216 — un pouvoir exige 40 % de chances de le lancer (PSY + difficulté) ; les mineurs sont libres", () => {
  assert.equal(canLearnPower(40, 0, false), true);
  assert.equal(canLearnPower(39, 0, false), false);
  assert.equal(canLearnPower(20, 20, false), true, "exemple RAW : 20 % en MAG → difficulté +20 seulement");
  assert.equal(canLearnPower(20, 10, false), false);
  assert.equal(canLearnPower(50, -10, false), true);
  assert.equal(canLearnPower(5, -30, true), true, "tour de magie : aucun test");
});

test("p.217 — coût : mineur 50 PX, pouvoir 100 PX, +50 PX hors de ses disciplines", () => {
  assert.equal(powerXpCost(true, false), 50);
  assert.equal(powerXpCost(false, false), 100);
  assert.equal(powerXpCost(false, true), 150);
  assert.equal(powerXpCost(true, true), 100);
});

test("40K + p.216 — disciplines : Génériques toujours connues ; nombre de disciplines spécialisées borné par le PSY", () => {
  const t = BRIGANDYNE.psyDisciplineThresholds;
  const base = { psy: 45, difficulty: 0, isMinor: false, thresholds: t };
  // PSY 45 → 1 discipline
  assert.deepEqual(powerLearning({ ...base, discipline: "generique", known: [] }), { ok: true, reason: "", outOfDomain: false, cost: 100 });
  assert.equal(powerLearning({ ...base, discipline: "pyromancie", known: [] }).outOfDomain, false, "1re discipline : dans le domaine");
  assert.equal(powerLearning({ ...base, discipline: "pyromancie", known: ["pyromancie"] }).outOfDomain, false, "déjà connue");
  const second = powerLearning({ ...base, discipline: "telepathie", known: ["pyromancie"] });
  assert.equal(second.outOfDomain, true, "2e discipline avec PSY 45 : exception d'histoire");
  assert.equal(second.cost, 150);
  // PSY 50 → 2 disciplines
  assert.equal(powerLearning({ ...base, psy: 50, discipline: "telepathie", known: ["pyromancie"] }).outOfDomain, false);
});

test("40K — un PSY trop faible refuse le pouvoir (moins de 40 %)", () => {
  const r = powerLearning({ psy: 25, difficulty: 0, isMinor: false, discipline: "generique", known: [], thresholds: BRIGANDYNE.psyDisciplineThresholds });
  assert.deepEqual([r.ok, r.reason], [false, "psyTooLow"]);
});

test("40K Outils — Psyconduit : riche +5 %, relique +10 % (le meilleur possédé), base sans bonus", () => {
  assert.equal(psyconduitBonus([{ name: "Psyconduit" }]), 0);
  assert.equal(psyconduitBonus([{ name: "Psyconduit, riche" }]), 5);
  assert.equal(psyconduitBonus([{ name: "Psyconduit, riche" }, { name: "Psyconduit, relique" }]), 10);
  assert.equal(psyconduitBonus([{ name: "Épée" }]), 0);
});

test("p.211 — sacrifier des PV : +1 % par PV, jamais sous 1 PV", () => {
  assert.deepEqual(pvSacrifice(5, 20), { pv: 5, bonus: 5 });     // exemple RAW : 5 PV → +5 %
  assert.deepEqual(pvSacrifice(30, 12), { pv: 11, bonus: 11 });
  assert.deepEqual(pvSacrifice(3, 1), { pv: 0, bonus: 0 });
  assert.deepEqual(pvSacrifice(-4, 10), { pv: 0, bonus: 0 });
});
