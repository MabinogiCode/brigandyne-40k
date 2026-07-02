import { test } from "node:test";
import assert from "node:assert/strict";
import { degreeOf, rerollCostFor } from "../src/dice/roll.ts";
import { vitality, sangFroid, bonusOf, vitalityMinor, speciesResourceBonus, initiative, instability, applyArchetype } from "../src/data/derive.ts";

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

test("initiative — *COM* + *MOU* + *PER*", () => {
  assert.equal(initiative({ com: 42, mou: 40, per: 33 }), 11);   // 4 + 4 + 3
  assert.equal(initiative({ com: 9, mou: 9, per: 9 }), 0);       // dizaines = 0
});

test("instability — Sang-froid / 4", () => {
  assert.equal(instability(17), 4);
  assert.equal(instability(25), 6);
});

test("personnage complet — attributs secondaires dérivés", () => {
  // Profil de référence (Balthazar, Livre Premier)
  const c = { com: 42, cns: 31, dis: 30, end: 37, for: 37, tec: 35, psy: 0,
              mou: 40, per: 33, soc: 35, sur: 30, tir: 50, vol: 38 };
  const pv = vitality(c);                 // 7 + 7 + 3
  const sf = sangFroid(c);                // 7 + 6 + 4
  assert.equal(pv, 17, "PV (Vitalité)");
  assert.equal(sf, 17, "SF (Sang-froid)");
  assert.equal(initiative(c), 11, "Initiative");
  assert.equal(instability(sf), 4, "Seuil d'instabilité");
});

test("personnage Squat — bonus d'espèce PV+1/SF+1", () => {
  const c = { com: 30, cns: 25, dis: 25, end: 35, for: 30, tec: 30, psy: 0,
              mou: 20, per: 20, soc: 20, sur: 20, tir: 20, vol: 35 };
  const sb = speciesResourceBonus(["nyctalopie", "sfPlus1", "pvPlus1"]);
  // PV = FOR/5 + END/5 + *VOL* + 1 = 6 + 7 + 3 + 1
  assert.equal(vitality(c, sb.pv), 17);
  // SF = VOL/5 + CNS/5 + *COM* + 1 = 7 + 5 + 3 + 1
  assert.equal(sangFroid(c, sb.sf), 16);
});

test("applyArchetype — modificateurs fixes + choix « ou »", () => {
  const base = { com: 25, cns: 31, dis: 25, end: 25, for: 25, tec: 25, psy: 0,
                 mou: 25, per: 33, soc: 25, sur: 25, tir: 25, vol: 38 };
  // Aigle : fixe {vol:+5}, choix [{[cns,per], +5}]
  const aigleMods = { vol: 5 };
  const aigleChoices = [{ chars: ["cns", "per"], value: 5 }];

  // Sans sélection → 1re option (cns)
  const d1 = applyArchetype(base, aigleMods, aigleChoices, []);
  assert.equal(d1.cns, 36);
  assert.equal(d1.per, 33);
  assert.equal(d1.vol, 43);

  // Sélection explicite → per
  const d2 = applyArchetype(base, aigleMods, aigleChoices, ["per"]);
  assert.equal(d2.cns, 31);
  assert.equal(d2.per, 38);
  assert.equal(d2.vol, 43);

  // Sélection invalide → repli sur la 1re option
  const d3 = applyArchetype(base, aigleMods, aigleChoices, ["zzz"]);
  assert.equal(d3.cns, 36);
});

test("applyArchetype — Âne (malus en choix) + chaîne jusqu'aux PV", () => {
  const base = { com: 30, cns: 30, dis: 30, end: 30, for: 30, tec: 30, psy: 0,
                 mou: 30, per: 30, soc: 30, sur: 30, tir: 30, vol: 30 };
  // Âne : fixe {end:+5, vol:+5}, choix [{[tec,sur],+5}, {[cns,mou],-5}]
  const mods = { end: 5, vol: 5 };
  const choices = [{ chars: ["tec", "sur"], value: 5 }, { chars: ["cns", "mou"], value: -5 }];
  const t = applyArchetype(base, mods, choices, ["sur", "mou"]);
  assert.equal(t.end, 35);
  assert.equal(t.vol, 35);
  assert.equal(t.sur, 35);
  assert.equal(t.mou, 25);
  assert.equal(t.cns, 30);   // non choisi pour le malus
  // PV après archétype : FOR/5 + END/5 + *VOL* = 6 + 7 + 3
  assert.equal(vitality(t), 16);
});
