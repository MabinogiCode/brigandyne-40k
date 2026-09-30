/**
 * Tests RAW — Règles de combat (Livre Premier p.157-167, 180-197) et
 * adaptation 40K (Armes, Armures, Combat, Véhicules).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isDouble, woundThreshold, isSevereWound, resolveDamage, evenDamageEffect,
  weaponFamily, weaponScale, targetKind, scaleEffect, rammingDamage, chaseStep, undermannedDisadvantage,
  fireModes, fireModeEffect, ammoCost, canFire, reloadOutcome, rangeDisadvantage, aimAdvantage,
  heavyDisadvantage, overheats, armorWear, summarizeGear, coverDisadvantage, armorToWear, aimMalus,
  defensiveAdvantages, qualityValue, hasQuality
} from "../src/data/combat-rules.ts";

const armor = (system: Record<string, any>) => ({ type: "armor", system: { equipped: true, qualities: [], ...system } });
const weapon = (system: Record<string, any>) => ({ type: "weapon", system: { equipped: true, qualities: [], ...system } });

/* ------------------------------------------------------------------ */
/* Doublés, blessures graves (p.162, p.196)                            */
/* ------------------------------------------------------------------ */

test("p.162 — doublé : 11, 22 … 99 ; jamais 00/100 ni les autres nombres", () => {
  for (const d of [11, 22, 33, 44, 55, 66, 77, 88, 99]) assert.equal(isDouble(d), true, String(d));
  for (const n of [1, 10, 12, 21, 50, 90, 98, 100]) assert.equal(isDouble(n), false, String(n));
});

test("p.196 — seuil de blessure grave = moitié de la Vitalité (exemples RAW : 17 → 8, 22 → 11)", () => {
  assert.equal(woundThreshold(17), 8);
  assert.equal(woundThreshold(22), 11);
});

test("p.196 — blessure grave : PV perdus en UNE passe d'armes ≥ seuil (Anton 12 ≥ 11 ; Balthazar 7, 4, 3 < 8)", () => {
  assert.equal(isSevereWound(12, 22), true, "Anton perd 12 PV d'un coup");
  assert.equal(isSevereWound(11, 22), true, "« égal ou supérieur »");
  for (const lost of [7, 4, 3]) assert.equal(isSevereWound(lost, 17), false, `Balthazar perd ${lost}`);
  assert.equal(isSevereWound(0, 17), false, "aucune perte de PV, aucune séquelle");
});

/* ------------------------------------------------------------------ */
/* Dégâts (p.161, p.188, 40K)                                          */
/* ------------------------------------------------------------------ */

test("p.161 — dégâts = arme + RU − protection ; exemple Rose : 8 dégâts, gilet de cuir 1 → 7", () => {
  assert.equal(resolveDamage({ amount: 8, protection: 1, minDamage: 1 }).applied, 7);
});

test("p.161 — dégâts minimums de 1 point même si l'armure absorbe tout", () => {
  assert.equal(resolveDamage({ amount: 3, protection: 6, minDamage: 1 }).applied, 1);
  assert.equal(resolveDamage({ amount: 0, protection: 0, minDamage: 1 }).applied, 0, "pas de blessure, pas de minimum");
});

test("40K — Perce-armure (X) ignore X points d'armure", () => {
  assert.equal(resolveDamage({ amount: 10, protection: 6, ap: 2 }).applied, 6);
  assert.equal(resolveDamage({ amount: 10, protection: 6, ap: 4 }).applied, 8);
  assert.equal(resolveDamage({ amount: 10, protection: 2, ap: 4 }).applied, 10, "jamais d'armure négative");
});

test("p.188 — Armure /2 : protection divisée par deux, arrondi inférieur", () => {
  assert.equal(resolveDamage({ amount: 10, protection: 5, halveArmor: true }).protection, 2);
});

test("Livre Second p.115 — Résistance : dégâts ÷2 (arrondi inférieur) avant armure", () => {
  assert.equal(resolveDamage({ amount: 9, protection: 2, halveDamage: true }).applied, 2);   // 4 − 2
});

test("p.135 — dégâts pairs : feu/froid/électrique/psychique déclenchent leur effet, impairs non", () => {
  const eff = { feu: "enflamme", froid: "ralenti", electrique: "sonne", psychique: "confus" };
  assert.equal(evenDamageEffect("feu", 8, eff), "enflamme");
  assert.equal(evenDamageEffect("feu", 7, eff), null);
  assert.equal(evenDamageEffect("physique", 8, eff), null);
  assert.equal(evenDamageEffect("psychique", 4, eff), "confus");
});

/* ------------------------------------------------------------------ */
/* Échelle humaine / véhicule / vaisseau (40K, Véhicules)              */
/* ------------------------------------------------------------------ */

test("40K — famille d'arme d'après la munition : solide, Bolt, laser, autre", () => {
  assert.equal(weaponFamily("Balle M"), "solid");
  assert.equal(weaponFamily("Cartouche"), "solid");
  assert.equal(weaponFamily("Aiguilles P"), "solid");
  assert.equal(weaponFamily("Bolt L"), "bolt");
  assert.equal(weaponFamily("Cellule P"), "laser");
  assert.equal(weaponFamily("Flasque M"), "other");
  assert.equal(weaponFamily(""), "other");
});

test("40K — Résistance des véhicules : armes solides, Bolt et laser ÷2 ; plasma/fusion/feu à plein", () => {
  const v = targetKind("vehicle", "terrestre");
  assert.equal(scaleEffect("human", "solid", v).halve, true);
  assert.equal(scaleEffect("human", "bolt", v).halve, true);
  assert.equal(scaleEffect("human", "laser", v).halve, true);
  assert.equal(scaleEffect("human", "other", v).halve, false);
  assert.equal(scaleEffect("human", "other", v).immune, false);
});

test("40K — les vaisseaux sont immunisés aux armes à échelle humaine, pas aux armes de vaisseau", () => {
  const ship = targetKind("vehicle", "spatial");
  assert.equal(scaleEffect("human", "solid", ship).immune, true);
  assert.equal(scaleEffect("human", "other", ship).immune, true);
  assert.equal(scaleEffect("ship", "other", ship).immune, false);
});

test("40K — arme de véhicule/vaisseau : dégâts doublés sur une cible à taille humaine", () => {
  assert.equal(scaleEffect("vehicle", "other", "human").double, true);
  assert.equal(scaleEffect("ship", "other", "human").double, true);
  assert.equal(scaleEffect("vehicle", "other", "vehicle").double, false);
  assert.equal(scaleEffect("human", "solid", "human").double, false);
});

test("40K — échelle d'une arme : groupe du compendium ou qualité Anti-véhicule", () => {
  assert.equal(weaponScale("ship"), "ship");
  assert.equal(weaponScale("vehicle"), "vehicle");
  assert.equal(weaponScale("", true), "vehicle");
  assert.equal(weaponScale("xeno"), "human");
});

test("40K Contact — percuter : RU + Taille, doublé contre une cible à taille humaine", () => {
  assert.equal(rammingDamage(6, 3, false), 9);
  assert.equal(rammingDamage(6, 3, true), 18);
});

test("40K Course-poursuite — l'écart varie de RU + Vitesse (minimum 1) ; exemple : moto RU 7 + 3 = 10 m", () => {
  assert.equal(chaseStep(7, 3), 10);
  assert.equal(chaseStep(1, -3), 1, "minimum 1");
});

test("40K Manœuvres — un seul pilote pour un véhicule qui en exige plus : 1 Désavantage", () => {
  assert.equal(undermannedDisadvantage(2, 1), 1);
  assert.equal(undermannedDisadvantage(1, 1), 0);
});

/* ------------------------------------------------------------------ */
/* Armes à distance (40K)                                              */
/* ------------------------------------------------------------------ */

test("40K — Automatique : coup par coup, semi-auto ou rafale ; Semi-automatique : coup par coup ou semi-auto", () => {
  assert.deepEqual(fireModes([{ key: "automatique" }]), ["single", "semi", "burst"]);
  assert.deepEqual(fireModes([{ key: "semiAutomatique" }]), ["single", "semi"]);
  assert.deepEqual(fireModes([{ key: "lourde" }]), ["single"]);
});

test("40K — Semi-auto : 1 Désavantage ; Rafale : 1 Désavantage et dégâts doublés", () => {
  assert.deepEqual(fireModeEffect("semi"), { disadvantage: 1, damageMultiplier: 1 });
  assert.deepEqual(fireModeEffect("burst"), { disadvantage: 1, damageMultiplier: 2 });
  assert.deepEqual(fireModeEffect("single"), { disadvantage: 0, damageMultiplier: 1 });
});

test("40K — munitions : 1 coup, 2 en semi-auto, la moitié du chargeur en rafale (jamais plus que le reste)", () => {
  assert.equal(ammoCost("single", 30, 30), 1);
  assert.equal(ammoCost("semi", 30, 30), 2);
  assert.equal(ammoCost("burst", 30, 30), 15);
  assert.equal(ammoCost("burst", 80, 80), 40);
  assert.equal(ammoCost("burst", 30, 7), 7, "rafale limitée au chargeur restant");
});

test("40K — tir impossible si le chargeur ne couvre pas le coût ; armes sans chargeur suivi toujours utilisables", () => {
  assert.equal(canFire("single", 12, 0), false);
  assert.equal(canFire("semi", 12, 1), false);
  assert.equal(canFire("semi", 12, 2), true);
  assert.equal(canFire("burst", 30, 1), true);
  assert.equal(canFire("single", 0, 0), true, "grenade / arme de véhicule");
});

test("40K Chargeurs — en combat les munitions restantes sont perdues ; hors combat non", () => {
  assert.deepEqual(reloadOutcome(5, 12, true), { loaded: 12, lost: 5 });
  assert.deepEqual(reloadOutcome(5, 12, false), { loaded: 12, lost: 0 });
});

test("40K — au-delà de la portée effective : 1 Désavantage", () => {
  assert.equal(rangeDisadvantage(21, 20), 1);
  assert.equal(rangeDisadvantage(20, 20), 0);
  assert.equal(rangeDisadvantage(null, 20), 0, "distance inconnue");
});

test("40K — Viser : 1 Avantage, 2 avec un Viseur", () => {
  assert.equal(aimAdvantage(false), 1);
  assert.equal(aimAdvantage(true), 2);
});

test("40K — Lourde : Désavantage si FOR < 50", () => {
  const q = [{ key: "lourde" }];
  assert.equal(heavyDisadvantage(q, 49), 1);
  assert.equal(heavyDisadvantage(q, 50), 0);
  assert.equal(heavyDisadvantage([], 10), 0);
});

test("40K — Surchauffe : E+ (échec majeur ou critique) seulement", () => {
  const q = [{ key: "surchauffe" }];
  assert.equal(overheats(q, -1), false);
  assert.equal(overheats(q, -2), true);
  assert.equal(overheats(q, -3), true);
  assert.equal(overheats([], -3), false);
});

test("40K / p.135 — Destruction et dégâts acides détruisent 1 point d'armure", () => {
  assert.equal(armorWear([{ key: "destruction" }], "physique"), 1);
  assert.equal(armorWear([], "acide"), 1);
  assert.equal(armorWear([], "physique"), 0);
});

/* ------------------------------------------------------------------ */
/* Armures (p.192, 40K Armures)                                        */
/* ------------------------------------------------------------------ */

test("p.192 — exemple RAW : cuirasse 3 + casque 1 + bouclier 2 = 6", () => {
  const g = summarizeGear([armor({ protection: 3, coverage: "partielle" }), armor({ protection: 1, coverage: "bonus" }), armor({ protection: 2, coverage: "bonus" })]);
  assert.equal(g.protection, 6);
});

test("p.192 — les armures de corps ne s'empilent pas (la meilleure compte)", () => {
  const g = summarizeGear([armor({ protection: 3, coverage: "complete" }), armor({ protection: 5, coverage: "complete" })]);
  assert.equal(g.protection, 5);
});

test("40K — Synthéderme « 4/+2 » : 4 seul, +2 sous une armure (idem Combinaison composite « 2/+1 »)", () => {
  const synth = armor({ protection: 4, coverage: "complete", underBonus: 2 });
  const combi = armor({ protection: 2, coverage: "complete", underBonus: 1 });
  const carapace = armor({ protection: 4, coverage: "complete" });
  assert.equal(summarizeGear([synth]).protection, 4);
  assert.equal(summarizeGear([combi]).protection, 2);
  assert.equal(summarizeGear([carapace, synth]).protection, 6);
  assert.equal(summarizeGear([carapace, combi]).protection, 5);
});

test("40K — Init (−x) : les armures s'additionnent ; MOU −x % et PER −x % aussi", () => {
  const g = summarizeGear([
    armor({ protection: 6, coverage: "complete", initiativeMod: -1, mouMod: -5 }),
    armor({ protection: 2, coverage: "bonus", initiativeMod: -2, mouMod: -10 }),
    armor({ protection: 1, coverage: "bonus", perMod: -5 })
  ]);
  assert.equal(g.initMod, -3);
  assert.equal(g.mouMod, -15);
  assert.equal(g.perMod, -5);
});

test("40K — arme encombrante (Initiative −x) : seule la plus lourde des armes équipées compte", () => {
  const g = summarizeGear([
    weapon({ qualities: [{ key: "initiative", value: -1 }] }),
    weapon({ qualities: [{ key: "initiative", value: -2 }] }),
    { type: "weapon", system: { equipped: false, qualities: [{ key: "initiative", value: -9 }] } }
  ]);
  assert.equal(g.initMod, -2);
});

test("40K — Décupleur (armure énergétique) et Couvert (bouclier) sont détectés sur l'équipement porté", () => {
  const g = summarizeGear([
    armor({ protection: 6, coverage: "complete", qualities: [{ key: "decupleur" }] }),
    armor({ protection: 2, coverage: "bonus", qualities: [{ key: "couvert", value: 2 }] })
  ]);
  assert.equal(g.decupleur, true);
  assert.equal(g.cover, 2);
  assert.equal(summarizeGear([armor({ protection: 3, coverage: "complete" })]).decupleur, false);
});

test("40K — Couvert (X) : X Désavantages au tireur, sauf arme qui ignore les boucliers", () => {
  assert.equal(coverDisadvantage(2, []), 2);
  assert.equal(coverDisadvantage(2, [{ key: "ignoreBoucliers" }]), 0);
  assert.equal(coverDisadvantage(0, []), 0);
});

test("40K — armure détruite : la meilleure armure de corps équipée, sinon un bonus", () => {
  const a = { id: "a", protection: 3, coverage: "complete", equipped: true };
  const b = { id: "b", protection: 5, coverage: "complete", equipped: true };
  const s = { id: "s", protection: 2, coverage: "bonus", equipped: true };
  assert.equal(armorToWear([a, b, s])?.id, "b");
  assert.equal(armorToWear([s])?.id, "s");
  assert.equal(armorToWear([{ ...a, equipped: false }]), null);
});

test("p.180 — Viser : partielle −5, complète −10, casque et bouclier −5 chacun (max −20)", () => {
  assert.equal(aimMalus([{ coverage: "partielle", equipped: true }]), -5);
  assert.equal(aimMalus([{ coverage: "complete", equipped: true }]), -10);
  assert.equal(aimMalus([{ coverage: "complete", equipped: true }, { coverage: "bonus", equipped: true }, { coverage: "bonus", equipped: true }]), -20);
  assert.equal(aimMalus([]), 0);
});

test("p.180 — Sur la défensive : 2 Avantages, 3 avec un bouclier", () => {
  assert.equal(defensiveAdvantages(false), 2);
  assert.equal(defensiveAdvantages(true), 3);
});

test("qualités : rang et présence", () => {
  const q = [{ key: "perceArmure", value: 2 }, { key: "destruction", value: null }];
  assert.equal(qualityValue(q, "perceArmure"), 2);
  assert.equal(qualityValue(q, "destruction"), true);
  assert.equal(qualityValue(q, "lourde"), null);
  assert.equal(hasQuality(q, "destruction"), true);
});
