/**
 * Psyker de bout en bout : bonus de spécialité, Psyconduit, PV sacrifiés, apprentissage des pouvoirs
 * (Magie p.211, 216-218 adapté au Psychisme), Flux d'énergie — sur le simulacre de Foundry.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installFoundryMock, resetMock, log, characterSystem, queueD100 } from "./helpers/foundry-mock.ts";

installFoundryMock();
const { BrigActor } = await import("../src/documents/actor.ts");
const { onFluxEnergy } = await import("../src/documents/chat.ts");

beforeEach(() => resetMock());

const NO_DIALOG = { skipDialog: true };
const hero = (over: Record<string, any> = {}, chars: Record<string, number> = {}, items: any[] = []) =>
  new (BrigActor as any)({ name: "Psyker", type: "character", system: characterSystem(over, chars), items });
const power = (system: Record<string, any> = {}) => ({ name: "Pouvoir", type: "psychicPower", system: { discipline: "generique", isMinor: false, difficulty: 0, resistance: "", damage: "", damageType: "psychique", effect: "", ...system } });
const specialty = (name: string, bonus: number) => ({ name, type: "specialty", system: { bonus } });
const act = () => ({ name: "Bénédiction", type: "faithAct", system: { isMiracle: false, difficulty: 0, damage: "" } });

test("pouvoir — spécialité de la discipline (+5) et Psyconduit relique (+10) s'ajoutent au test", async () => {
  const a = hero({}, { psy: 60 }, [power({ discipline: "pyromancie" }), specialty("Pyromancie", 5), { name: "Psyconduit, relique", type: "equipment", system: {} }]);
  queueD100(20);
  const t = await a.rollPower(a.items[0], NO_DIALOG);
  assert.deepEqual(t.data.modifiers.map((m: any) => m.value).sort((x: number, y: number) => x - y), [5, 10]);
  const autre = hero({}, { psy: 60 }, [power({ discipline: "telepathie" }), specialty("Pyromancie", 5)]);
  queueD100(20);
  const u = await autre.rollPower(autre.items[0], NO_DIALOG);
  assert.deepEqual(u.data.modifiers, [], "la spécialité d'une autre discipline ne s'applique pas");
});

test("pouvoir — sacrifier des PV : +1 % par PV, PV déduits avant le test, jamais sous 1 PV", async () => {
  const a = hero({}, { psy: 40 }, [power()]);
  queueD100(30);
  const t = await a.rollPower(a.items[0], { dialog: { pvSacrifice: 5 } });
  assert.equal(t.data.modifiers.reduce((s: number, m: any) => s + m.value, 0), 5);
  assert.equal(a.system.pv.value, 15);
  const faible = hero({ pv: { value: 3, max: 20, bonus: 0, lost: 0 } }, { psy: 40 }, [power()]);
  queueD100(30);
  await faible.rollPower(faible.items[0], { dialog: { pvSacrifice: 10 } });
  assert.equal(faible.system.pv.value, 1, "au plus 2 PV sacrifiés (il en reste 1)");
});

test("Vraie Foi (+5) et Résistance au Warp (+10) : spécialités appliquées aux tests concernés", async () => {
  const p = hero({ faith: { devoted: true, actsPerDay: 2 } }, { vol: 50 }, [act(), specialty("Vraie Foi", 5), specialty("Résistance au Warp", 10)]);
  queueD100(20);
  const f = await p.rollFaith(p.items[0], NO_DIALOG);
  assert.ok(f.data.modifiers.some((m: any) => m.label === "Vraie Foi" && m.value === 5));
  queueD100(20);
  const c = await p.rollCorruption({ god: "", source: "0", characteristic: "vol" }, NO_DIALOG);
  assert.ok(c.data.modifiers.some((m: any) => m.label === "Résistance au Warp" && m.value === 10));
});

test("disciplines connues : déduites des pouvoirs possédés (Génériques exclues), maximum selon le PSY", () => {
  const a = hero({}, { psy: 55 }, [power({ discipline: "generique" }), power({ discipline: "pyromancie" }), power({ discipline: "pyromancie" }), power({ discipline: "telepathie" })]);
  a.system.protection = { base: 0, mod: 0 }; a.system.initiative = { base: null, mod: 0, value: 0 };
  a.system.psy = { limits: { minor: 5, power: 5 } };
  a.prepareDerivedData();
  assert.deepEqual(a.system.psy.disciplines.known.sort(), ["pyromancie", "telepathie"]);
  assert.equal(a.system.psy.disciplines.max, 2, "PSY 55 → 2 disciplines");
});

/* ------------------------------------------------------------------ */
/* Apprentissage                                                       */
/* ------------------------------------------------------------------ */

function mockPowerPack(entries: Array<{ id: string; name: string; discipline: string; isMinor: boolean; difficulty: number }>) {
  (globalThis as any).game.packs.set("brigandyne-40k.psychic-powers", {
    getIndex: async () => ({ contents: entries.map(e => ({ _id: e.id, name: e.name, system: { discipline: e.discipline, isMinor: e.isMinor, difficulty: e.difficulty } })) }),
    getDocument: async (id: string) => {
      const e = entries.find(x => x.id === id)!;
      return { name: e.name, toObject: () => ({ name: e.name, type: "psychicPower", system: { discipline: e.discipline, isMinor: e.isMinor, difficulty: e.difficulty } }) };
    }
  });
}
const psyker = (chars: Record<string, number>, xpTotal = 0) => {
  const a = hero({ xp: { total: xpTotal, spent: 0, available: xpTotal } }, chars);
  return a;
};
const prepare = (a: any) => { a.system.psy = { limits: { minor: 5, power: 5 } }; a._preparePsyker(); };
let lastContent = "";
async function choosing(answer: string | null, run: () => Promise<any>) {
  const { DialogV2 } = (globalThis as any).foundry.applications.api;
  const original = DialogV2.prompt;
  DialogV2.prompt = async (opts: any) => { lastContent = opts.content; return answer; };
  try { return await run(); } finally { DialogV2.prompt = original; }
}

const POOL = [
  { id: "m1", name: "Désagrément", discipline: "generique", isMinor: true, difficulty: 0 },
  { id: "m2", name: "Ruse", discipline: "generique", isMinor: true, difficulty: 0 },
  { id: "p1", name: "Guérison", discipline: "generique", isMinor: false, difficulty: -10 }
];

test("apprendre un pouvoir à la création : gratuit dans la limite de *CNS* mineurs et *CNS* pouvoirs", async () => {
  mockPowerPack(POOL);
  const a = psyker({ psy: 50, cns: 20 });                // *CNS* = 2
  prepare(a);
  await choosing("m1", () => a.learnPower());
  assert.equal(a.items.filter((i: any) => i.type === "psychicPower").length, 1);
  assert.equal(a.system.xp.spent, 0, "gratuit");
  await choosing("p1", () => a.learnPower());
  assert.equal(a.items.length, 2);
  assert.equal(a.system.xp.spent, 0);
  assert.ok(log.info.some((m: string) => m.includes("BRIG.Power.learned")));
});

test("apprendre un pouvoir après la création : 50 PX (mineur) / 100 PX ; refusé sans assez de PX ; MJ : gratuit", async () => {
  mockPowerPack(POOL);
  const a = psyker({ psy: 50, cns: 20 }, 300);
  prepare(a);
  await choosing("m1", () => a.learnPower());
  assert.equal(a.system.xp.spent, 50);
  a.system.xp.available = 250;
  await choosing("p1", () => a.learnPower());
  assert.equal(a.system.xp.spent, 150);

  const pauvre = psyker({ psy: 50 }, 10);
  prepare(pauvre);
  await choosing("p1", () => pauvre.learnPower());
  assert.equal(pauvre.items.length, 0);
  assert.ok(log.warn.some((m: string) => m.includes("BRIG.Warn.noXp")));

  const mj = psyker({ psy: 50, cns: 20 }, 300);
  prepare(mj);
  await choosing("p1", () => mj.learnPower({ asGM: true }));
  assert.equal(mj.items.length, 1);
  assert.equal(mj.system.xp.spent, 0, "attribution gratuite par le MJ");
});

test("apprendre un pouvoir — PSY 0 refusé ; sous 40 % le pouvoir n'est pas proposé ; 2e discipline avec PSY 45 : 100 + 50 PX", async () => {
  mockPowerPack([
    { id: "m1", name: "Désagrément", discipline: "generique", isMinor: true, difficulty: 0 },
    { id: "p1", name: "Projectile de feu", discipline: "pyromancie", isMinor: false, difficulty: 10 },
    { id: "p2", name: "Choc psychique", discipline: "telepathie", isMinor: false, difficulty: 10 }
  ]);
  const zero = psyker({ psy: 0 });
  prepare(zero);
  await zero.learnPower();
  assert.ok(log.warn.some((m: string) => m.includes("BRIG.Power.noPsy")));

  const faible = psyker({ psy: 25 }, 500);               // 25 + 10 < 40
  prepare(faible);
  await choosing("m1", () => faible.learnPower());
  assert.ok(!lastContent.includes("Projectile de feu"), "pouvoir à +10 avec PSY 25 : moins de 40 %");
  assert.ok(lastContent.includes("Désagrément"));

  const a = psyker({ psy: 45 }, 500);                    // 1 seule discipline spécialisée
  a.addItem({ name: "Autre", type: "psychicPower", system: { discipline: "pyromancie", isMinor: false, difficulty: 0 } });
  prepare(a);
  await choosing("p2", () => a.learnPower());
  assert.equal(a.system.xp.spent, 150);
});

const talent = (name: string) => ({ name, type: "talent", system: {} });

test("talents du Psyker — Magie innée : +1 mineur et +1 pouvoir par jour", () => {
  const a = hero({}, { psy: 40 }, [talent("Magie innée")]);
  a.system.protection = { base: 0, mod: 0 }; a.system.initiative = { base: null, mod: 0, value: 0 };
  a.system.psy = { limits: { minor: 4, power: 4 } };
  a.prepareDerivedData();
  assert.deepEqual(a.system.psy.limits, { minor: 5, power: 5 });
});

test("talents du Psyker — Magie sanglante : chaque PV sacrifié rapporte le double", async () => {
  const a = hero({}, { psy: 40 }, [power(), talent("Magie sanglante")]);
  queueD100(30);
  const t = await a.rollPower(a.items[0], { dialog: { pvSacrifice: 5 } });
  assert.equal(t.data.modifiers.reduce((s: number, m: any) => s + m.value, 0), 10);
  assert.equal(a.system.pv.value, 15, "5 PV perdus quand même");
});

test("talents du Psyker — Magie destructrice : +1 aux dégâts de pouvoir", async () => {
  const { onApplyDamage } = await import("../src/documents/chat.ts");
  const { targets } = await import("./helpers/foundry-mock.ts");
  const caster = hero({}, { psy: 50 }, [power({ damage: "RU+PSY" }), talent("Magie destructrice")]);
  const cible = new (BrigActor as any)({ name: "Cible", type: "npc", system: characterSystem({ role: "secondRole", protection: { base: 0, mod: 0, value: 0 }, pv: { value: 40, max: 40, bonus: 0, lost: 0 } }) });
  targets.add({ actor: cible });
  await onApplyDamage({ speaker: {}, flags: { "brigandyne-40k": {
    test: { rollType: "power", actorUuid: caster.uuid, damage: { raw: "RU+PSY", type: "physique", psyBonus: 5 } },
    result: { success: true, degree: "minorSuccess", ru: 4, total: 24, tier: 1 }
  } } });
  assert.equal(cible.system.pv.value, 40 - (4 + 5 + 1));
});

test("Flux d'énergie (R+) : le pouvoir n'est pas décompté", async () => {
  const a = hero({ dailyUse: { powers: 2, minors: 1, faith: 0, forced: false } }, { psy: 40 }, [power({ rPlus: "Flux d'énergie" })]);
  const button = { disabled: false };
  await onFluxEnergy({ flags: { "brigandyne-40k": { test: { actorUuid: a.uuid, itemUuid: a.items[0].uuid } } } }, button);
  assert.equal(a.system.dailyUse.powers, 1);
  assert.equal(button.disabled, true);
  const mineur = hero({ dailyUse: { powers: 2, minors: 1, faith: 0, forced: false } }, {}, [power({ isMinor: true })]);
  await onFluxEnergy({ flags: { "brigandyne-40k": { test: { actorUuid: mineur.uuid, itemUuid: mineur.items[0].uuid } } } }, { disabled: false });
  assert.equal(mineur.system.dailyUse.minors, 0);
});
