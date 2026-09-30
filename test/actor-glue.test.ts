/**
 * Tests de la « colle » BrigActor (jets, dégâts, pouvoirs, Foi, Corruption, Folie,
 * séquelles, chargeurs) sur un simulacre de Foundry — voir test/helpers/foundry-mock.ts.
 * Ils complètent les tests de règles pures : ici on vérifie l'enchaînement réel.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installFoundryMock, resetMock, log, registry, targets, flags, characterSystem, queueD100, cardData, diceQueue } from "./helpers/foundry-mock.ts";

installFoundryMock();
const { BrigActor } = await import("../src/documents/actor.ts");

beforeEach(() => resetMock());

const NO_DIALOG = { skipDialog: true };
const armorItem = (name: string, system: Record<string, any>) => ({ name, type: "armor", system: { equipped: true, qualities: [], ...system } });
const weaponItem = (name: string, system: Record<string, any>) => ({ name, type: "weapon", system: { equipped: true, qualities: [], damageBase: "flat", damageMod: 4, damageType: "physique", ...system } });
const hero = (over: Record<string, any> = {}, chars: Record<string, number> = {}, items: any[] = []) =>
  new (BrigActor as any)({ name: "Héros", type: "character", system: characterSystem(over, chars), items });
const lastCard = (path: string) => log.chat.map(cardData).filter(c => c?.path.includes(path)).pop()?.data;

/* ------------------------------------------------------------------ */
/* Équipement porté                                                    */
/* ------------------------------------------------------------------ */

test("prepareDerivedData — protection, Initiative, décupleur et compteur d'augmentations", () => {
  const a = hero({}, { vol: 30 }, [
    armorItem("Énergétique", { protection: 6, coverage: "complete", initiativeMod: -1, mouMod: -5, qualities: [{ key: "decupleur" }] }),
    armorItem("Bouclier", { protection: 1, coverage: "bonus", initiativeMod: -1, qualities: [{ key: "couvert", value: 1 }] }),
    { name: "Bras bionique", type: "augmentation", system: {} }
  ]);
  a.system.protection = { base: 0, mod: 0 };
  a.system.initiative = { base: null, mod: 0, value: 5 };
  a.prepareDerivedData();
  assert.equal(a.system.protection.value, 7);
  assert.equal(a.system.initiative.value, 3);
  assert.equal(a.system._gear.decupleur, true);
  assert.equal(a.system._gear.cover, 1);
  assert.deepEqual(a.system.augmentations, { count: 1, max: 3, over: 0 });
});

test("tests de caractéristique — pénalité d'armure au MOU, Décupleur à la FOR, augmentation au test de FOR", async () => {
  const a = hero({}, {}, [armorItem("Plates", { protection: 5, coverage: "complete", mouMod: -10, qualities: [{ key: "decupleur" }] })]);
  a.system.protection = { base: 0, mod: 0 }; a.system.initiative = { base: null, mod: 0, value: 0 };
  a.system.augmentationFx = { tests: { for: 10 } };
  a.prepareDerivedData();
  queueD100(50);
  const mou = await a.rollCharacteristic("mou", NO_DIALOG);
  assert.deepEqual(mou.data.modifiers.map((m: any) => m.value), [-10]);
  queueD100(50);
  const force = await a.rollCharacteristic("for", NO_DIALOG);
  assert.deepEqual(force.data.modifiers.map((m: any) => m.value).sort(), [10, 10], "Décupleur +10 et Tendons +10");
});

/* ------------------------------------------------------------------ */
/* Dégâts                                                              */
/* ------------------------------------------------------------------ */

test("applyDamage — armure et dégâts minimums (8 − 1 = 7 ; 3 vs armure 6 = 1)", async () => {
  const a = hero({ role: "secondRole", protection: { base: 0, mod: 0, value: 1 } });
  assert.equal(await a.applyDamage(8, { minDamage: 1 }), 7);
  assert.equal(a.system.pv.value, 13);
  a.system.protection.value = 6;
  assert.equal(await a.applyDamage(3, { minDamage: 1 }), 1);
});

test("applyDamage — blessure grave d'un premier rôle (≥ moitié des PV) tire une séquelle ; un second rôle non", async () => {
  const boss = hero({ role: "secondRole" });
  await boss.applyDamage(15, { minDamage: 1 });
  assert.equal(lastCard("sequela-card"), undefined, "second rôle : pas de séquelle");

  const pj = hero();                              // 20 PV → seuil 10
  await pj.applyDamage(9, { minDamage: 1 });
  assert.equal(lastCard("sequela-card"), undefined, "9 < 10 : blessure légère");
  diceQueue.push(11);                             // d100 de la table des séquelles
  await pj.applyDamage(10, { minDamage: 1 });
  const card = lastCard("sequela-card");
  assert.equal(card.name, "Souvenir enlaidissant");
  assert.equal(card.roll, 11);
  assert.equal(card.armorHit, true, "11 est un doublé : l'armure est abîmée");
  const msg = log.chat.find((m: any) => m.flags?.["brigandyne-40k"]?.sequela);
  assert.ok(msg, "la carte porte les données d'application");
});

test("applyDamage — 0 PV : carte « hors de combat » (et non plus une blessure tirée au hasard)", async () => {
  const pj = hero({ pv: { value: 4, max: 20, bonus: 0, lost: 0 } });
  await pj.applyDamage(6, { minDamage: 1 });
  assert.equal(pj.system.pv.value, 0);
  const notice = lastCard("notice-card");
  assert.ok(notice.title.includes("BRIG.Defeat.title"));
});

test("applyDamage — échelle : Résistance ÷2 des véhicules, vaisseaux immunisés, arme de véhicule ×2 sur un humain", async () => {
  const tank = new (BrigActor as any)({ name: "Blindé", type: "vehicle", system: { vehicleType: "terrestre", resistance: true, pv: { value: 30, max: 30 }, protection: { value: 2 } } });
  assert.equal(await tank.applyDamage(10, { weapon: { scale: "human", family: "bolt" }, minDamage: 1 }), 3, "10 ÷2 = 5, − 2");
  assert.equal(await tank.applyDamage(10, { weapon: { scale: "human", family: "other" }, minDamage: 1 }), 8, "plasma : plein tarif");

  const ship = new (BrigActor as any)({ name: "Croiseur", type: "vehicle", system: { vehicleType: "spatial", resistance: true, pv: { value: 40, max: 40 }, protection: { value: 5 } } });
  assert.equal(await ship.applyDamage(30, { weapon: { scale: "human", family: "laser" }, minDamage: 1 }), 0);
  assert.equal(ship.system.pv.value, 40);
  assert.equal(await ship.applyDamage(12, { weapon: { scale: "ship", family: "other" }, minDamage: 1 }), 7);

  const soldat = hero({ role: "secondRole", protection: { base: 0, mod: 0, value: 1 } });
  assert.equal(await soldat.applyDamage(5, { weapon: { scale: "vehicle", family: "other" }, minDamage: 1 }), 9, "5 ×2 = 10, − 1");
});

test("applyDamage — Destruction : la meilleure armure perd 1 point ; dégâts pairs de feu : Enflammé", async () => {
  const a = hero({ role: "secondRole", protection: { base: 0, mod: 0, value: 4 } }, {}, [
    armorItem("Carapace", { protection: 4, coverage: "complete" }), armorItem("Casque", { protection: 1, coverage: "bonus" })
  ]);
  await a.applyDamage(8, { minDamage: 1, armorWear: 1, damageType: "feu" });
  assert.equal(a.items.find((i: any) => i.name === "Carapace").system.protection, 3);
  assert.equal(a.items.find((i: any) => i.name === "Casque").system.protection, 1);
  assert.deepEqual(a.system._statuses, ["enflamme"], "total 8 pair → Enflammé");
  await a.applyDamage(7, { minDamage: 1, damageType: "feu" });
  assert.deepEqual(a.system._statuses, ["enflamme"], "total 7 impair → rien de plus");
});

/* ------------------------------------------------------------------ */
/* Armes à distance                                                    */
/* ------------------------------------------------------------------ */

const rifle = () => weaponItem("Fusil laser", { weaponType: "ranged", range: 100, magazine: 80, currentAmmo: 80, qualities: [{ key: "automatique" }, { key: "precis" }] });

test("tir — coup par coup : 1 munition ; Précis donne 1 Avantage", async () => {
  const a = hero({}, { tir: 40 }, [rifle()]);
  const gun = a.items[0];
  queueD100(30);
  const t = await a.rollWeaponAttack(gun, NO_DIALOG);
  assert.equal(gun.system.currentAmmo, 79);
  assert.equal(t.data.advantage, 1);
  assert.equal(t.data.disadvantage, 0);
  assert.equal(t.data.damage.fireMode, "single");
});

test("tir — semi-auto : 2 munitions et 1 Désavantage ; rafale : moitié du chargeur, 1 Désavantage, dégâts ×2 (fireMode transmis)", async () => {
  const a = hero({}, { tir: 40 }, [rifle()]);
  const gun = a.items[0];
  queueD100(30);
  const semi = await a.rollWeaponAttack(gun, { dialog: { fireMode: "semi" } });
  assert.equal(gun.system.currentAmmo, 78);
  assert.equal(semi.data.disadvantage, 1);
  queueD100(30);
  const burst = await a.rollWeaponAttack(gun, { dialog: { fireMode: "burst" } });
  assert.equal(gun.system.currentAmmo, 78 - 40);
  assert.equal(burst.data.disadvantage, 1);
  assert.equal(burst.data.damage.fireMode, "burst");
});

test("tir — visée : 1 Avantage (2 avec un Viseur)", async () => {
  const plain = hero({}, {}, [weaponItem("Pistolet", { weaponType: "ranged", magazine: 12, currentAmmo: 12 })]);
  queueD100(30);
  assert.equal((await plain.rollWeaponAttack(plain.items[0], { dialog: { aimed: true } })).data.advantage, 1);
  const scoped = hero({}, {}, [weaponItem("Fusil de précision", { weaponType: "ranged", magazine: 4, currentAmmo: 4, qualities: [{ key: "viseur" }] })]);
  queueD100(30);
  assert.equal((await scoped.rollWeaponAttack(scoped.items[0], { dialog: { aimed: true } })).data.advantage, 2);
});

test("tir — chargeur vide : avertissement et aucun jet ; les PNJ tirent sans compter", async () => {
  const a = hero({}, {}, [weaponItem("Pistolet", { weaponType: "ranged", magazine: 12, currentAmmo: 0 })]);
  assert.equal(await a.rollWeaponAttack(a.items[0], NO_DIALOG), null);
  assert.equal(log.warn.length, 1);
  assert.equal(log.chat.length, 0);
  const pnj = new (BrigActor as any)({ name: "Ganger", type: "npc", system: characterSystem({ role: "secondRole" }), items: [weaponItem("Pistolet", { weaponType: "ranged", magazine: 12, currentAmmo: 0 })] });
  queueD100(30);
  assert.ok(await pnj.rollWeaponAttack(pnj.items[0], NO_DIALOG), "PNJ : tir autorisé");
});

test("tir — Couvert du bouclier de la cible : 1 Désavantage, sauf arme qui ignore les boucliers", async () => {
  const shooter = hero({}, { tir: 40 }, [weaponItem("Pistolet", { weaponType: "ranged", magazine: 12, currentAmmo: 12 }), weaponItem("Bolter", { weaponType: "ranged", magazine: 16, currentAmmo: 16, qualities: [{ key: "ignoreBoucliers" }] })]);
  const target = hero({}, {}, [armorItem("Bouclier", { protection: 1, coverage: "bonus", qualities: [{ key: "couvert", value: 1 }] })]);
  target.system.protection = { base: 0, mod: 0 }; target.system.initiative = { base: null, mod: 0, value: 0 };
  target.prepareDerivedData();
  targets.add({ actor: target });
  queueD100(30);
  assert.equal((await shooter.rollWeaponAttack(shooter.items[0], NO_DIALOG)).data.disadvantage, 1);
  queueD100(30);
  assert.equal((await shooter.rollWeaponAttack(shooter.items[1], NO_DIALOG)).data.disadvantage, 0);
});

test("tir — arme Lourde : Désavantage si FOR < 50", async () => {
  const weak = hero({}, { for: 40 }, [weaponItem("Bolter", { weaponType: "ranged", magazine: 16, currentAmmo: 16, qualities: [{ key: "lourde" }] })]);
  queueD100(30);
  assert.equal((await weak.rollWeaponAttack(weak.items[0], NO_DIALOG)).data.disadvantage, 1);
  const strong = hero({}, { for: 60 }, [weaponItem("Bolter", { weaponType: "ranged", magazine: 16, currentAmmo: 16, qualities: [{ key: "lourde" }] })]);
  queueD100(30);
  assert.equal((await strong.rollWeaponAttack(strong.items[0], NO_DIALOG)).data.disadvantage, 0);
});

test("mêlée Risquée : un doublé fait encaisser son *FOR* au porteur", async () => {
  const a = hero({ role: "secondRole" }, { for: 45 }, [weaponItem("Fléau", { weaponType: "melee", damageBase: "for", damageMod: 1, qualities: [{ key: "risquee" }] })]);
  queueD100(44);                                     // doublé
  await a.rollWeaponAttack(a.items[0], NO_DIALOG);
  assert.equal(a.system.pv.value, 16, "−4 (FOR 45 → bonus 4)");
  a.system.pv.value = 20;
  queueD100(43);
  await a.rollWeaponAttack(a.items[0], NO_DIALOG);
  assert.equal(a.system.pv.value, 20, "pas de doublé, pas de blessure");
});

test("chargeur — recharger : munitions perdues en combat, conservées hors combat", async () => {
  const a = hero({}, {}, [weaponItem("Pistolet", { weaponType: "ranged", magazine: 12, currentAmmo: 5, qualities: [{ key: "chargement", value: 2 }] })]);
  await a.reloadWeapon(a.items[0]);
  assert.equal(a.items[0].system.currentAmmo, 12);
  let card = lastCard("notice-card");
  assert.ok(!card.lines.some((l: string) => l.includes("reloadLost")), "hors combat : rien de perdu");
  assert.ok(card.lines.some((l: string) => l.includes('"turns":2')), "Chargement (2) : 2 tours");
  a.items[0].system.currentAmmo = 5;
  flags.combatStarted = true;
  await a.reloadWeapon(a.items[0]);
  card = lastCard("notice-card");
  assert.ok(card.lines.some((l: string) => l.includes("reloadLost")), "en combat : munitions restantes perdues");
});

/* ------------------------------------------------------------------ */
/* Pouvoirs psychiques                                                 */
/* ------------------------------------------------------------------ */

const power = (system: Record<string, any> = {}) => ({ name: "Pouvoir", type: "psychicPower", system: { discipline: "generique", isMinor: false, difficulty: 0, resistance: "", damage: "", damageType: "psychique", effect: "<p>Effet</p>", ...system } });

test("pouvoir mineur : réussite automatique, compteur des mineurs, PV −2 au-delà de la limite", async () => {
  const a = hero({}, { psy: 40 }, [power({ isMinor: true })]);
  const p = a.items[0];
  const t = await a.rollPower(p, NO_DIALOG);
  assert.equal(t, null, "aucun test");
  assert.equal(a.system.dailyUse.minors, 1);
  assert.equal(a.system.dailyUse.powers, 0, "compteur des pouvoirs intact");
  assert.equal(log.chat.length, 1);
  a.system.dailyUse.minors = 2;                       // limite (2) atteinte
  await a.rollPower(p, NO_DIALOG);
  assert.equal(a.system.pv.value, 18);
});

test("pouvoir : compteur des pouvoirs, dépassement −4 PV, difficulté de la cible (MODO) prise si plus dure", async () => {
  const a = hero({}, { psy: 60 }, [power({ resistance: "MOU", difficulty: 0 })]);
  const cible = hero({}, { mou: 70 });                // MODO −20
  targets.add({ actor: cible });
  queueD100(20);
  const t = await a.rollPower(a.items[0], NO_DIALOG);
  assert.deepEqual(t.data.modifiers.map((m: any) => m.value), [-20]);
  assert.equal(a.system.dailyUse.powers, 1);
  a.system.dailyUse.powers = 2;
  queueD100(20);
  await a.rollPower(a.items[0], NO_DIALOG);
  assert.equal(a.system.pv.value, 16);
});

test("pouvoir — échec critique : Péril du Warp et −1 SF ; échec majeur : Phénomène psychique", async () => {
  const a = hero({}, { psy: 40 }, [power()]);
  queueD100(90);                                      // échec critique
  diceQueue.push(80);                                 // d100 du Péril : « Déflagration cataclysmique »
  await a.rollPower(a.items[0], NO_DIALOG);
  assert.equal(a.system.sf.value, 19);
  assert.ok(lastCard("warp-card").title.includes("Péril"));
  const b = hero({}, { psy: 40 }, [power()]);
  queueD100(95);                                      // échec majeur
  diceQueue.push(10);
  await b.rollPower(b.items[0], NO_DIALOG);
  assert.equal(b.system.sf.value, 20, "échec majeur : pas de perte de SF automatique");
  assert.ok(lastCard("warp-card").title.includes("Phénomène"));
});

test("Forcer le Warp : une seule fois par jour", async () => {
  const a = hero();
  diceQueue.push(10);
  assert.equal(await a.forceWarp("phenomenon"), true);
  assert.equal(await a.forceWarp("peril"), false);
  assert.equal(log.warn.length, 1);
});

/* ------------------------------------------------------------------ */
/* Vraie Foi                                                           */
/* ------------------------------------------------------------------ */

const act = (system: Record<string, any> = {}) => ({ name: "Bénédiction", type: "faithAct", system: { isMiracle: false, difficulty: 10, damage: "", ...system } });

test("Vraie Foi — refusée sans Vertu adéquate, autorisée avec Loyal ou la case « Vraie Foi »", async () => {
  const sceptique = hero({}, { vol: 50 }, [act()]);
  assert.equal(await sceptique.rollFaith(sceptique.items[0], NO_DIALOG), null);
  assert.equal(log.warn.length, 1);
  const loyal = hero({}, { vol: 50 }, [act(), { name: "Loyal", type: "trait", system: { traitType: "vertu", rating: 1 } }]);
  queueD100(20);
  assert.ok(await loyal.rollFaith(loyal.items[0], NO_DIALOG));
  const devot = hero({ faith: { devoted: true, actsPerDay: 1 } }, { vol: 50 }, [act()]);
  queueD100(20);
  assert.ok(await devot.rollFaith(devot.items[0], NO_DIALOG));
});

test("Vraie Foi — au-delà de la limite −20 % ; E+ : l'Empereur est sourd RU heures", async () => {
  const a = hero({ faith: { devoted: true, actsPerDay: 1 }, dailyUse: { powers: 0, minors: 0, faith: 1, forced: false } }, { vol: 50 }, [act()]);
  queueD100(95);                                      // échec majeur, RU 5
  const t = await a.rollFaith(a.items[0], NO_DIALOG);
  assert.ok(t.data.modifiers.some((m: any) => m.value === -20));
  assert.equal(a.system.dailyUse.faith, 2);
  const deaf = lastCard("notice-card");
  assert.ok(deaf.title.includes("deafTitle"));
  assert.ok(deaf.lines.some((l: string) => l.includes('"hours":5')));
});

/* ------------------------------------------------------------------ */
/* Corruption, Folie, Destin                                           */
/* ------------------------------------------------------------------ */

test("Corruption — 1 Désavantage par niveau de Vice du dieu ; échec : perte de SF = seuil (+1 sur un E+)", async () => {
  const a = hero({ corruption: { value: 0, threshold: 5 } }, { vol: 40 }, [{ name: "Colérique", type: "trait", system: { traitType: "vice", rating: 1 } }]);
  queueD100(63);                                      // échec mineur
  const t = await a.rollCorruption({ god: "khorne", source: "0", characteristic: "vol" }, NO_DIALOG);
  assert.equal(t.data.disadvantage, 1);
  assert.equal(a.system.sf.value, 15, "−5");
  queueD100(95);                                      // échec majeur (cible 30 avec le Désavantage)
  await a.rollCorruption({ god: "khorne", source: "0", characteristic: "vol" }, NO_DIALOG);
  assert.equal(a.system.sf.value, 9, "−6");
  queueD100(10);
  await a.rollCorruption({ god: "nurgle", source: "0", characteristic: "vol" }, NO_DIALOG);
  assert.equal(a.system.sf.value, 9, "réussite : aucune perte");
});

test("Corruption — Paria : +10 % pour résister", async () => {
  const p = hero({ speciesName: "Paria", corruption: { value: 0, threshold: 5 } }, { vol: 40 });
  queueD100(10);
  const t = await p.rollCorruption({ god: "", source: "-10", characteristic: "vol" }, NO_DIALOG);
  assert.deepEqual(t.data.modifiers.map((m: any) => m.value).sort((x: number, y: number) => x - y), [-10, 10]);
});

test("SF à 0 : crise de folie — perte DÉFINITIVE = quart du SF de base d'origine, constante (18 → 4, 4, 4…), personnage fou sous l'Instabilité", async () => {
  const a = hero({ sf: { value: 3, max: 20, bonus: 0, lost: 0, base: 20 } });
  await a.loseSangFroid(3);
  assert.equal(a.system.sf.value, 0);
  assert.equal(a.system.sf.lost, 5);
  const first = lastCard("notice-card");
  assert.ok(first.title.includes("Madness.title"));
  assert.ok(!first.lines.some((l: string) => l.includes("Madness.mad")), "limite 15 : pas fou");

  // 4e crise : SF de base 20, déjà 15 perdus (limite 5) → limite 0 < Instabilité 5 → fou
  const b = hero({ sf: { value: 1, max: 5, bonus: 0, lost: 15, base: 20 } });
  await b.loseSangFroid(1);
  assert.equal(b.system.sf.lost, 20, "la perte reste 5 : l'Instabilité ne rétrécit pas avec le SF max");
  assert.ok(lastCard("notice-card").lines.some((l: string) => l.includes("Madness.mad")));
});

test("Test de Folie — échec majeur : −4 SF", async () => {
  const a = hero({}, { vol: 30 });
  queueD100(95);
  await a.rollMadness(NO_DIALOG);
  assert.equal(a.system.sf.value, 16);
});

test("Corruption — SF vide : choix crise de folie ou mutation (D10 pair = Grâce)", async () => {
  const { DialogV2 } = (globalThis as any).foundry.applications.api;
  const a = hero({ sf: { value: 2, max: 20, bonus: 0, lost: 0, base: 20 }, corruption: { value: 0, threshold: 5 } }, { vol: 30 });
  const original = DialogV2.wait;
  DialogV2.wait = async () => "mutation";
  diceQueue.length = 0;
  queueD100(90);                                      // échec critique
  diceQueue.push(4);                                  // D10 = 4 → Grâce
  await a.rollCorruption({ god: "", source: "0", characteristic: "vol" }, NO_DIALOG);
  DialogV2.wait = original;
  assert.equal(a.system.sf.value, 0);
  assert.equal(a.system.sf.lost, 0, "la mutation remplace la crise de folie");
  assert.ok(lastCard("notice-card").lines.some((l: string) => l.includes("BRIG.Corruption.grace")));
});

test("Destin définitif : −1 au score courant ET de départ, PV à 1 ; impossible à 0", async () => {
  const a = hero();
  assert.equal(await a.spendDestinPermanent(), true);
  assert.deepEqual([a.system.destin.value, a.system.destin.max, a.system.pv.value], [2, 2, 1]);
  const b = hero({ destin: { value: 0, max: 3 } });
  assert.equal(await b.spendDestinPermanent(), false);
  assert.equal(b.system.destin.max, 3);
});

test("SF dépensé : 2 SF = 1 Avantage (une fois) ; refusé sans assez de SF", async () => {
  const a = hero({ sf: { value: 10, max: 20, bonus: 0, lost: 0, base: 20 } });
  queueD100(30);
  const t = await a.rollCharacteristic("tec", { dialog: { spendSf: true } });
  assert.equal(t.data.advantage, 1);
  assert.equal(a.system.sf.value, 8);
  const pauvre = hero({ sf: { value: 1, max: 20, bonus: 0, lost: 0, base: 20 } });
  queueD100(30);
  const u = await pauvre.rollCharacteristic("tec", { dialog: { spendSf: true } });
  assert.equal(u.data.advantage, 0);
  assert.equal(log.warn.length, 1);
});

/* ------------------------------------------------------------------ */
/* Séquelles                                                           */
/* ------------------------------------------------------------------ */

test("applySequela — Œil crevé : TIR, TEC et PER −5 % définitifs, trace sur la fiche", async () => {
  const a = hero({}, { tir: 40, tec: 35, per: 30 });
  await a.applySequela(0);
  assert.equal(a.system.characteristics.tir.value, 35);
  assert.equal(a.system.characteristics.tec.value, 30);
  assert.equal(a.system.characteristics.per.value, 25);
  assert.equal(a.items.filter((i: any) => i.type === "criticalInjury").length, 1);
  assert.equal(a.items[0].system.roll, "01-05");
});

test("applySequela — choix du joueur (COM ou VOL), Douleurs chroniques : −2 PV max définitifs, doublé : armure −1", async () => {
  const a = hero({}, { com: 40, vol: 50 }, [armorItem("Carapace", { protection: 4, coverage: "complete" })]);
  await a.applySequela(10, ["vol"], false);
  assert.equal(a.system.characteristics.vol.value, 45);
  assert.equal(a.system.characteristics.com.value, 40);
  await a.applySequela(9, [], true);
  assert.equal(a.system.pv.lost, 2);
  assert.equal(a.items.find((i: any) => i.name === "Carapace").system.protection, 3);
});

test("registre du simulacre — les objets créés sont retrouvables par UUID (sanity)", () => {
  const a = hero({}, {}, [armorItem("X", { protection: 1 })]);
  assert.equal(registry.get(a.uuid), a);
});
