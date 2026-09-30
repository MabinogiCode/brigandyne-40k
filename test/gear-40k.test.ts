/**
 * Conformité 40K — Armes, munitions, armures, véhicules, augmentations
 * (document d'adaptation « Warhammer 40.000 : Brigandyne »).
 *
 * Chaque ligne des tableaux du document est comparée, champ par champ, au
 * compendium correspondant (packs/_source). Un tableau modifié ou un compendium
 * dérivé fait échouer le test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { section, tables, dataRows, loadPack, norm, num, damage, qualitiesOf, packQualities } from "./helpers/doc.ts";

const weapons = loadPack("weapons");
const folderOf = (d: any, packFolders: Record<string, string>) => packFolders[d.folder] ?? "";
const inFolder = (name: string) => weapons.docs.filter(d => d.type === "weapon" && folderOf(d, weapons.folders) === name);

function find(docs: any[], name: string): any {
  const hits = docs.filter(d => norm(d.name) === norm(name));
  assert.equal(hits.length, 1, `« ${name} » : ${hits.length} entrée(s) dans le compendium (1 attendue)`);
  return hits[0];
}

/* ------------------------------------------------------------------ */
/* Armes de mêlée                                                      */
/* ------------------------------------------------------------------ */

test("40K Armes de mêlée — chaque ligne du tableau est fidèlement dans le compendium", () => {
  const sec = section(/^## Armes de mêlée/m, /^### Spécificités des armes de mêlée/m);
  const rows = tables(sec).flatMap(dataRows);
  assert.ok(rows.length >= 35, "le tableau est lu");
  const docs = inFolder("Armes de mêlée");
  for (const [name, dmg, reach, hands, special, price] of rows) {
    const w = find(docs, name).system;
    const d = damage(dmg);
    assert.equal(w.damageBase, d.base, `${name} : base de dégâts`);
    assert.equal(w.damageMod, d.mod, `${name} : modificateur de dégâts`);
    assert.equal(w.reach, reach, `${name} : allonge`);
    assert.equal(w.hands, Math.min(2, Math.max(1, parseInt(hands) || 1)), `${name} : mains`);
    assert.equal(w.price, price === "-" ? 0 : num(price), `${name} : prix`);
    const q = qualitiesOf(special);
    const packQ = packQualities({ system: w });
    assert.deepEqual(packQ, q.keys, `${name} : qualités (${special || "aucune"})`);
  }
});

/* ------------------------------------------------------------------ */
/* Armes à distance                                                    */
/* ------------------------------------------------------------------ */

test("40K Armes à distance — chaque ligne du tableau est fidèlement dans le compendium", () => {
  const sec = section(/^## Armes à distance/m, /^### Spécificités des Armes à distance/m);
  const rows = tables(sec).flatMap(dataRows);
  assert.ok(rows.length >= 30, "le tableau est lu");
  const docs = inFolder("Armes à distance");
  for (const [name, dmg, range, mag, special, ammo, price] of rows) {
    const w = find(docs, name).system;
    assert.equal(w.weaponType, "ranged", `${name} : arme à distance`);
    assert.equal(w.damageMod, damage(dmg).mod, `${name} : dégâts`);
    if (/^\d+$/.test(range)) assert.equal(w.range, num(range), `${name} : portée`);
    assert.equal(w.magazine, /^\d+$/.test(mag) ? num(mag) : 0, `${name} : chargeur`);
    assert.equal(norm(w.ammoType), norm(ammo), `${name} : munition`);
    assert.equal(w.price, num(price), `${name} : prix`);
    const q = qualitiesOf(special);
    const unknownAllowed = q.unknown.filter(u => !/^d[ée]g[âa]ts de feu$/i.test(u) && !/^inflige/i.test(u));
    assert.deepEqual(unknownAllowed, [], `${name} : spécificité inconnue du test — à mapper`);
    assert.deepEqual(packQualities({ system: w }), q.keys, `${name} : qualités (${special || "aucune"})`);
    if (/d[ée]g[âa]ts de feu/i.test(special)) assert.equal(w.damageType, "feu", `${name} : dégâts de feu`);
  }
});

test("40K — le compendium d'armes ne contient ni munitions ni améliorations (importées à tort comme armes)", () => {
  const forbidden = ["Balle P", "Balle M", "Balle L", "Cartouche", "Carreaux", "Cellule P", "Cellule M", "Cellule L",
    "Flasque P", "Flasque M", "Flasque L", "Réservoir P", "Réservoir M", "Réservoir L", "Réservoir à fusion", "Bolt P/M/L",
    "Aiguilles P/L", "Viseur", "Silencieux", "Pointeur laser", "Baïonnette", "Chargeur grande capacité", "ATH",
    "Équilibrée", "Poignée bio-veritor", "Monomoléculaire - Pointe/ en diamantine"];
  const names = new Set(weapons.docs.filter(d => d.type === "weapon").map(d => norm(d.name)));
  for (const f of forbidden) assert.ok(!names.has(norm(f)), `« ${f} » n'est pas une arme`);
});

test("40K — Armurerie xeno : armes des Peaux-vertes, Necrons, Aeldari et T'au présentes avec leurs qualités", () => {
  const xeno = weapons.docs.filter(d => d.system?.group === "xeno" || ["xeno"].includes(d.system?.group));
  const names = xeno.map(d => norm(d.name));
  for (const n of ["Kikoup'", "Gros Kikoup'", "Kikoup' tronçonneur", "Pince énergétique", "Automatik'", "Fling'",
    "Épée d'hyperphase", "Fauchard", "Bâton de lumière (mêlée)", "Écorcheur à fission", "Faucheuse à fission", "Éclateur à fission",
    "Carabine tesla", "Fusil synaptique", "Bâton de lumière (Tir)", "Sabre tronçonneur", "Lame mordante", "Pistolet shuriken",
    "Catapulte shuriken", "Pistolet à impulsion", "Carabine à impulsion", "Fusil à impulsion"]) {
    assert.ok(names.includes(norm(n)), `arme xeno « ${n} » absente`);
  }
  const need = (n: string) => find(xeno, n).system;
  assert.deepEqual(packQualities({ system: need("Gros Kikoup'") }), ["destruction", "initiative(-2)"]);
  assert.equal(need("Automatik'").damageMod, 4);
  assert.equal(need("Fling'").magazine, 20);
  assert.deepEqual(packQualities({ system: need("Carabine à impulsion") }), ["automatique", "perceArmure(2)"]);
  assert.deepEqual(packQualities({ system: need("Fusil synaptique") }), ["ignoreArmures", "lourde"]);
});

/* ------------------------------------------------------------------ */
/* Armes de véhicule et de vaisseau                                    */
/* ------------------------------------------------------------------ */

test("40K Véhicules — armements de véhicule : dégâts, charges, portée, spécial, prix", () => {
  const sec = section(/^#### Armements/m, /^### Vaisseaux spatiaux/m);
  const table = tables(sec).find(t => t[0][0] === "Arme" && t[0].includes("Charges"))!;
  const docs = inFolder("Armes de véhicule");
  const rows = dataRows(table);
  assert.equal(rows.length, docs.length, "autant d'armes de véhicule que de lignes");
  for (const [name, size, dmg, charges, range, special, price] of rows) {
    const w = find(docs, name).system;
    assert.equal(w.damageMod, damage(dmg).mod, `${name} : dégâts`);
    assert.equal(w.magazine, num(charges), `${name} : charges`);
    assert.equal(w.range, num(range), `${name} : portée`);
    assert.equal(w.price, num(price), `${name} : prix`);
    assert.deepEqual(packQualities({ system: w }), qualitiesOf(special).keys, `${name} : qualités`);
    assert.equal(w.group, "vehicle", `${name} : groupe véhicule`);
    void size;
  }
});

test("40K Véhicules — armements de vaisseau : dégâts, portée, spécial, prix", () => {
  const sec = section(/^### Vaisseaux spatiaux/m, /^# Combat/m);
  const table = tables(sec).filter(t => t[0][0] === "Arme").pop()!;
  const docs = inFolder("Armes de vaisseau");
  const rows = dataRows(table);
  assert.equal(rows.length, docs.length, "autant d'armes de vaisseau que de lignes");
  for (const [name, size, dmg, range, special, price] of rows) {
    const w = find(docs, name).system;
    assert.equal(w.damageMod, damage(dmg).mod, `${name} : dégâts`);
    assert.equal(w.range, num(range), `${name} : portée`);
    assert.equal(w.price, num(price), `${name} : prix`);
    assert.deepEqual(packQualities({ system: w }), qualitiesOf(special).keys, `${name} : qualités`);
    assert.equal(w.group, "ship", `${name} : groupe vaisseau`);
    void size;
  }
});

/* ------------------------------------------------------------------ */
/* Munitions                                                           */
/* ------------------------------------------------------------------ */

test("40K Munitions — chaque type du tableau existe avec son prix", () => {
  const { docs } = loadPack("ammunition");
  const sec = section(/^### Munitions/m, /^### Améliorations/m);
  const rows = tables(sec).flatMap(dataRows);
  assert.ok(rows.length >= 15);
  for (const [name, , price] of rows) {
    const a = find(docs, name);
    assert.equal(a.system.price, num(price), `${name} : prix`);
  }
});

/* ------------------------------------------------------------------ */
/* Armures                                                             */
/* ------------------------------------------------------------------ */

test("40K Armures — protection, couverture, Init, MOU, prix et qualités de chaque ligne", () => {
  const { docs } = loadPack("armor");
  const sec = section(/^## Armures/m, /^### Spécificités des armures/m);
  const rows = tables(sec).flatMap(dataRows);
  assert.ok(rows.length >= 18);
  for (const [name, prot, notes, special, price] of rows) {
    const a = find(docs.filter(d => d.type === "armor"), name).system;
    const [main, under] = prot.split("/");
    assert.equal(a.protection, num(main), `${name} : protection`);
    assert.equal(a.underBonus ?? 0, under ? num(under) : 0, `${name} : bonus sous armure (« ${prot} »)`);
    const cover = /bonus/i.test(notes) && !under ? "bonus" : /compl/i.test(notes) ? "complete" : "partielle";
    assert.equal(a.coverage, cover, `${name} : couverture (« ${notes} »)`);
    const init = special.match(/Init\s*[-–−]\s*(\d+)/i);
    assert.equal(a.initiativeMod, init ? -parseInt(init[1], 10) : 0, `${name} : Initiative`);
    const mou = special.match(/MOU\s*[-–−]\s*(\d+)/i);
    assert.equal(a.mouMod, mou ? -parseInt(mou[1], 10) : 0, `${name} : MOU`);
    assert.equal(a.price, num(price), `${name} : prix`);
    const q = qualitiesOf(special.split(",").filter(t => !/^(init|mou|longue|peut se porter)/i.test(t.trim())).join(","));
    assert.deepEqual(packQualities({ system: a }), q.keys, `${name} : qualités (Couvert, Décupleur)`);
  }
});

test("40K Armures — Décupleur et Couvert portés par les qualités structurées", () => {
  const { docs } = loadPack("armor");
  assert.deepEqual(packQualities(find(docs, "Armure énergétique")), ["decupleur"]);
  assert.deepEqual(packQualities(find(docs, "Bouclier")), ["couvert(1)"]);
  assert.deepEqual(packQualities(find(docs, "Bouclier anti-émeute")), ["couvert(2)"]);
});

test("Livre Premier p.192 — armures médiévales : valeurs du tableau", () => {
  const { docs } = loadPack("armor");
  const expected: Record<string, [number, string, number, number, number]> = {
    // nom: [protection, couverture, Init, MOU %, PER %]
    "Gambison, fourrures": [1, "complete", -1, 0, 0],
    "Plastron de cuir": [1, "partielle", 0, 0, 0],
    "Broigne, brigandine": [2, "partielle", -1, 0, 0],
    "Cotte de plaques": [2, "complete", -2, 0, 0],
    "Cuirasse": [3, "partielle", -1, 0, 0],
    "Cotte de mailles, haubert": [3, "complete", -3, -5, 0],
    "Demi-plaques": [4, "complete", -2, -5, 0],
    "Armure de plates, harnois": [5, "complete", -3, -5, 0],
    "Armure de plates alourdie": [6, "complete", -4, -10, 0],
    "Casque (médiéval)": [1, "bonus", 0, 0, -5],
    "Petit bouclier, bocle": [1, "bonus", 0, 0, 0],
    "Bouclier, écu": [2, "bonus", -1, -5, 0]
  };
  for (const [name, [prot, cov, init, mou, per]] of Object.entries(expected)) {
    const a = find(docs, name).system;
    assert.deepEqual([a.protection, a.coverage, a.initiativeMod, a.mouMod, a.perMod ?? 0], [prot, cov, init, mou, per], name);
  }
});

/* ------------------------------------------------------------------ */
/* Véhicules                                                           */
/* ------------------------------------------------------------------ */

test("40K Véhicules — taille, maniabilité, vitesse, places, protection, structure, prix", () => {
  const { docs } = loadPack("vehicles");
  const groups: Array<[RegExp, RegExp, string[]]> = [
    [/^### Véhicules terrestres/m, /^### Véhicules volants/m, ["terrestre"]],
    [/^### Véhicules volants/m, /^#### Armements/m, ["volant"]],
    [/^### Vaisseaux spatiaux/m, /^#### Armements/m, ["spatial"]]
  ];
  let checked = 0;
  for (const [a, b, types] of groups) {
    const sec = section(a, b);
    const table = tables(sec).find(t => t[0][0] === "Véhicule")!;
    for (const [name, size, man, speed, , places, prot, structure, price] of dataRows(table)) {
      const hits = docs.filter(d => norm(d.name) === norm(name) && types.includes(d.system.vehicleType));
      assert.equal(hits.length, 1, `${name} (${types[0]}) : 1 entrée attendue, ${hits.length} trouvée(s)`);
      const v = hits[0].system;
      assert.equal(v.size, num(size), `${name} : taille`);
      assert.equal(v.maneuver, num(man), `${name} : maniabilité`);
      assert.equal(v.speed, num(speed), `${name} : vitesse`);
      assert.equal(v.places, num(places), `${name} : places`);
      const pil = places.match(/\((\d+)\)/);
      assert.equal(v.pilotsMin, pil ? parseInt(pil[1], 10) : 1, `${name} : pilotes minimum`);
      assert.equal(v.protection.base, prot === "-" ? 0 : num(prot), `${name} : protection`);
      assert.equal(v.pv.max, num(structure), `${name} : structure`);
      assert.equal(v.price, num(price), `${name} : prix`);
      checked++;
    }
  }
  assert.equal(checked, docs.length, "chaque véhicule du compendium correspond à une ligne du document");
});

/* ------------------------------------------------------------------ */
/* Augmentations                                                       */
/* ------------------------------------------------------------------ */

test("40K Augmentations — chaque modèle du tableau existe avec son coût", () => {
  const { docs } = loadPack("augmentations");
  const sec = section(/^# Augmentations/m, /^# Véhicules et vaisseaux/m);
  const rows = tables(sec).filter(t => t[0][0] === "Modèle").flatMap(dataRows);
  assert.ok(rows.length >= 19);
  for (const [name, effect, cost] of rows) {
    const a = find(docs, name);
    assert.equal(a.system.price, num(cost), `${name} : coût`);
    assert.ok(norm(a.system.effect).startsWith(norm(effect).slice(0, 40)), `${name} : effet`);
  }
});
