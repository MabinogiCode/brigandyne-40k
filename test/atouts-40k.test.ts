/**
 * Conformité 40K — Atouts : spécialités (standard +10/+20, martiales +5, occultes +5)
 * et talents propres à l'adaptation (document « Warhammer 40.000 : Brigandyne »).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIGANDYNE } from "../src/config/config.ts";
import { section, tables, dataRows, loadPack, norm } from "./helpers/doc.ts";

const specialties = loadPack("specialties").docs.filter(d => d.type === "specialty");
const talents = loadPack("talents").docs.filter(d => d.type === "talent");

const BLOCKS: Array<[RegExp, RegExp, string]> = [
  [/^### Spécialité \[\+10\/\+20\]/m, /^### Spécialité martiale/m, "standard"],
  [/^### Spécialité martiale/m, /^### Spécialité occulte/m, "martiale"],
  [/^### Spécialité occulte/m, /^## Talents/m, "occulte"]
];

test("40K Atouts — chaque spécialité du document : type, bonus, caractéristique et effet", () => {
  let checked = 0;
  for (const [a, b, type] of BLOCKS) {
    const rows = tables(section(a, b)).flatMap(dataRows);
    for (const [label, effect] of rows) {
      const m = label.match(/^(.*?)\s*\+(\d+)$/);
      assert.ok(m, `ligne illisible : ${label}`);
      const name = m![1].trim(), bonus = parseInt(m![2], 10);
      const hits = specialties.filter(s => norm(s.name) === norm(name));
      assert.equal(hits.length, 1, `spécialité « ${name} » : ${hits.length} entrée(s)`);
      const s = hits[0].system;
      assert.equal(s.specialtyType, type, `${name} : type`);
      assert.equal(s.bonus, bonus, `${name} : bonus`);
      assert.ok(BRIGANDYNE.characteristics[s.characteristic], `${name} : caractéristique liée (« ${s.characteristic} »)`);
      assert.equal(norm(s.effect), norm(effect), `${name} : effet`);
      checked++;
    }
  }
  assert.equal(checked, 21, "8 standard + 7 martiales + 6 occultes");
});

test("40K Atouts — caractéristique testée par chaque spécialité 40K (tir, TEC, CNS, VOL, PSY)", () => {
  const expected: Record<string, string> = {
    "Astrogation": "cns", "Xeno-Connaissances": "cns", "Pilotage terrestre": "tec", "Pilotage aérien": "tec", "Pilotage spatial": "tec",
    "Informatique": "tec", "Technomaîtrise": "tec", "Résistance au Warp": "vol", "Vraie Foi": "vol", "Assaut": "tir",
    "Arme de poing": "tir", "Arme lourde": "tir", "Fusil": "tir", "Fusil de précision": "tir", "Artillerie": "tir", "Explosifs": "tir",
    "Biomancie": "psy", "Divination": "psy", "Pyromancie": "psy", "Télékinésie": "psy", "Télépathie": "psy"
  };
  for (const [name, key] of Object.entries(expected)) {
    assert.equal(specialties.find(s => norm(s.name) === norm(name))?.system.characteristic, key, name);
  }
});

test("40K Atouts — talents Esprit de la Machine et Véhicule fétiche (1×/scène)", () => {
  for (const name of ["Esprit de la Machine", "Véhicule fétiche"]) {
    const t = talents.find(t => norm(t.name) === norm(name));
    assert.ok(t, `talent « ${name} » absent`);
    assert.equal(t.system.usage, "scene", `${name} : 1×/scène`);
  }
  const esprit = talents.find(t => norm(t.name) === "esprit de la machine")!;
  assert.match(esprit.system.effect, /remplacer un test de TEC, de TIR ou de COM par un test de VOL/);
  const vehicule = talents.find(t => norm(t.name) === "véhicule fétiche")!;
  assert.match(vehicule.system.effect, /inverser les chiffres/);
});
