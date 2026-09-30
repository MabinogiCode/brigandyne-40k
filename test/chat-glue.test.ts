/**
 * Tests de la « colle » des cartes de chat (dégâts, Surchauffe, séquelles, Forcer le Warp)
 * sur le simulacre de Foundry — voir test/helpers/foundry-mock.ts.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installFoundryMock, resetMock, log, targets, characterSystem, cardData, diceQueue } from "./helpers/foundry-mock.ts";

installFoundryMock();
const { BrigActor } = await import("../src/documents/actor.ts");
const { onApplyDamage, onOverheat, onApplySequela, onForceWarp } = await import("../src/documents/chat.ts");

beforeEach(() => resetMock());

const armorItem = (name: string, system: Record<string, any>) => ({ name, type: "armor", system: { equipped: true, qualities: [], ...system } });
const weaponItem = (name: string, system: Record<string, any>) => ({ name, type: "weapon", system: { equipped: true, qualities: [], damageBase: "flat", damageMod: 4, damageType: "physique", ...system } });
const npc = (protection: number, over: Record<string, any> = {}, chars: Record<string, number> = {}, items: any[] = []) =>
  new (BrigActor as any)({ name: "Cible", type: "npc", system: characterSystem({ role: "secondRole", protection: { base: 0, mod: 0, value: protection }, pv: { value: 40, max: 40, bonus: 0, lost: 0 }, ...over }, chars), items });
const character = (system: Record<string, any> = {}, chars: Record<string, number> = {}, items: any[] = []) =>
  new (BrigActor as any)({ name: "Tireur", type: "character", system: characterSystem(system, chars), items });

/** Message de test : jet réussi de RU `ru` avec les dégâts `damage` (arme `weapon`). */
function message(shooter: any, weapon: any, damage: Record<string, any>, { degree = "minorSuccess", ru = 5, success = true }: Record<string, any> = {}) {
  return {
    speaker: {},
    flags: { "brigandyne-40k": {
      test: { label: "Attaque", actorUuid: shooter.uuid, damage: { type: "physique", weaponUuid: weapon?.uuid, ...damage } },
      result: { success, degree, ru, total: 10 + ru, tier: success ? 1 : -1 }
    } }
  };
}
const damageCard = () => log.chat.map(cardData).filter(c => c?.path.includes("damage-card")).pop()!.data;

test("dégâts — Bolter (+6, Perce-armure 2) sur armure 4 : RU 5 + 6 = 11 − (4 − 2) = 9", async () => {
  const shooter = character({}, {}, [weaponItem("Bolter", { weaponType: "ranged", damageMod: 6, ammoType: "Bolt M", qualities: [{ key: "perceArmure", value: 2 }] })]);
  const cible = npc(4);
  targets.add({ actor: cible });
  await onApplyDamage(message(shooter, shooter.items[0], { base: "flat", mod: 6 }));
  assert.equal(cible.system.pv.value, 31);
  const card = damageCard();
  assert.equal(card.total, 11);
  assert.equal(card.ap, 2);
  assert.equal(card.rows[0].applied, 9);
  assert.equal(card.rows[0].prot, 2);
});

test("dégâts — Rafale : dégâts totaux doublés (RU 5 + 3 = 8 → 16)", async () => {
  const shooter = character({}, {}, [weaponItem("Fusil d'assaut", { weaponType: "ranged", damageMod: 3, ammoType: "Balle M" })]);
  const cible = npc(0);
  targets.add({ actor: cible });
  await onApplyDamage(message(shooter, shooter.items[0], { base: "flat", mod: 3, fireMode: "burst" }));
  assert.equal(damageCard().total, 16);
  assert.equal(cible.system.pv.value, 24);
});

test("dégâts — Décupleur : +1 aux dégâts de mêlée (armure énergétique)", async () => {
  const shooter = character({}, { for: 50 }, [
    armorItem("Énergétique", { protection: 6, coverage: "complete", qualities: [{ key: "decupleur" }] }),
    weaponItem("Épée", { weaponType: "melee", damageBase: "for", damageMod: 0 })
  ]);
  shooter.system.protection = { base: 0, mod: 0 };
  shooter.system.initiative = { base: null, mod: 0, value: 0 };
  shooter.prepareDerivedData();
  const cible = npc(0);
  targets.add({ actor: cible });
  await onApplyDamage(message(shooter, shooter.items[1], { base: "for", mod: 0, forBonus: 5, isMelee: true }));
  assert.equal(damageCard().total, 5 + 5 + 1, "RU 5 + FOR 5 + Décupleur 1");
});

test("dégâts — arme de véhicule sur un humain ×2 ; blindé : Résistance ÷2 (arme Bolt) ; vaisseau immunisé", async () => {
  const blinde = new (BrigActor as any)({ name: "Blindé", type: "vehicle", system: { vehicleType: "terrestre", pv: { value: 40, max: 40 }, protection: { value: 0 } },
    items: [weaponItem("Canon lourd", { weaponType: "ranged", group: "vehicle", damageMod: 8, ammoType: "" })] });
  const humain = npc(1);
  targets.add({ actor: humain });
  await onApplyDamage(message(blinde, blinde.items[0], { base: "flat", mod: 8 }));
  assert.equal(damageCard().rows[0].applied, (5 + 8) * 2 - 1);
  assert.equal(damageCard().rows[0].note, "×2 (taille humaine)");

  targets.clear();
  const bolter = character({}, {}, [weaponItem("Bolter", { weaponType: "ranged", damageMod: 6, ammoType: "Bolt M" })]);
  const tank = new (BrigActor as any)({ name: "Char", type: "vehicle", system: { vehicleType: "terrestre", resistance: true, pv: { value: 40, max: 40 }, protection: { value: 2 } } });
  targets.add({ actor: tank });
  await onApplyDamage(message(bolter, bolter.items[0], { base: "flat", mod: 6 }));
  assert.equal(damageCard().rows[0].applied, Math.floor(11 / 2) - 2);
  assert.equal(damageCard().rows[0].note, "Résistance ÷2");

  targets.clear();
  const ship = new (BrigActor as any)({ name: "Croiseur", type: "vehicle", system: { vehicleType: "spatial", resistance: true, pv: { value: 40, max: 40 }, protection: { value: 5 } } });
  targets.add({ actor: ship });
  await onApplyDamage(message(bolter, bolter.items[0], { base: "flat", mod: 6 }));
  assert.equal(damageCard().rows[0].applied, 0);
  assert.equal(ship.system.pv.value, 40);
});

test("dégâts — arme à Destruction : l'armure de la cible perd 1 point", async () => {
  const shooter = character({}, {}, [weaponItem("Lance-plasma", { weaponType: "ranged", damageMod: 8, ammoType: "Flasque M", qualities: [{ key: "destruction" }, { key: "surchauffe" }] })]);
  const cible = npc(3, {}, {}, [armorItem("Carapace", { protection: 3, coverage: "complete" })]);
  targets.add({ actor: cible });
  await onApplyDamage(message(shooter, shooter.items[0], { base: "flat", mod: 8 }));
  assert.equal(cible.items[0].system.protection, 2);
});

test("dégâts — réussite critique : le dé des unités explose (10 + relance)", async () => {
  const shooter = character({}, {}, [weaponItem("Pistolet", { weaponType: "ranged", damageMod: 3 })]);
  const cible = npc(0);
  targets.add({ actor: cible });
  diceQueue.push(10, 6);                            // 10 explose (+10), puis 6
  await onApplyDamage(message(shooter, shooter.items[0], { base: "flat", mod: 3 }, { degree: "critSuccess", ru: 0 }));
  assert.equal(damageCard().total, 10 + 10 + 6 + 3);
});

test("dégâts — échec du test : aucun dégât", async () => {
  const shooter = character({}, {}, [weaponItem("Pistolet", { weaponType: "ranged" })]);
  const cible = npc(0);
  targets.add({ actor: cible });
  await onApplyDamage(message(shooter, shooter.items[0], { base: "flat", mod: 3 }, { success: false, degree: "minorFailure" }));
  assert.equal(cible.system.pv.value, 40);
  assert.equal(log.info.length, 1);
});

test("dégâts — feu : total pair (10) → Enflammé ; armure appliquée normalement", async () => {
  const shooter = character({}, {}, [weaponItem("Lance-flamme", { weaponType: "ranged", damageMod: 5, damageType: "feu", ammoType: "Réservoir M" })]);
  const cible = npc(2);
  targets.add({ actor: cible });
  await onApplyDamage(message(shooter, shooter.items[0], { base: "flat", mod: 5, type: "feu" }, { ru: 5 }));
  assert.deepEqual(cible.system._statuses, ["enflamme"]);
  assert.equal(cible.system.pv.value, 40 - 8);
});

test("Surchauffe — le tireur subit les dégâts de l'arme sans le RU", async () => {
  const shooter = character({ protection: { base: 0, mod: 0, value: 2 } }, {}, [weaponItem("Pistolet plasma", { weaponType: "ranged", damageMod: 6, qualities: [{ key: "surchauffe" }] })]);
  const button = { disabled: false };
  await onOverheat(message(shooter, shooter.items[0], { base: "flat", mod: 6 }, { success: false, degree: "majorFailure" }), button);
  assert.equal(button.disabled, true);
  assert.equal(shooter.system.pv.value, 20 - 4, "6 − armure 2");
});

test("Séquelle — le bouton applique la perte définitive (pas de choix requis : Souvenir enlaidissant)", async () => {
  const a = character({}, { soc: 40 });
  const button = { disabled: false };
  await onApplySequela({ flags: { "brigandyne-40k": { sequela: { actorUuid: a.uuid, index: 2, armorHit: false } } } }, button);
  assert.equal(a.system.characteristics.soc.value, 35);
  assert.equal(button.disabled, true);
});

test("Séquelle — blessure à choix : le joueur choisit ; annuler n'applique rien", async () => {
  const { DialogV2 } = (globalThis as any).foundry.applications.api;
  const a = character({}, { for: 40, end: 40 });
  const msg = { flags: { "brigandyne-40k": { sequela: { actorUuid: a.uuid, index: 8, armorHit: false } } } };
  const original = DialogV2.prompt;
  DialogV2.prompt = async () => null;
  const cancelled = { disabled: false };
  await onApplySequela(msg, cancelled);
  assert.equal(a.system.characteristics.for.value, 40);
  assert.equal(cancelled.disabled, false);
  DialogV2.prompt = async () => "end";
  await onApplySequela(msg, { disabled: false });
  DialogV2.prompt = original;
  assert.equal(a.system.characteristics.end.value, 35);
  assert.equal(a.system.characteristics.for.value, 40);
});

test("Forcer le Warp — déclenche la complication (Phénomène) et marque l'usage du jour", async () => {
  const a = character();
  diceQueue.push(10);
  const button = { disabled: false, dataset: { kind: "phenomenon" } };
  await onForceWarp({ flags: { "brigandyne-40k": { test: { actorUuid: a.uuid } } } }, button);
  assert.equal(a.system.dailyUse.forced, true);
  assert.equal(button.disabled, true);
  assert.ok(cardData(log.chat[log.chat.length - 1])!.data.title.includes("Phénomène"));
});
