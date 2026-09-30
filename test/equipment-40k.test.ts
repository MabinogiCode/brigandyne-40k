/**
 * Conformité 40K — Équipement & prix (nourriture, logement, vêtements, objets, survie, outils,
 * technologie, drogues, services), améliorations d'armes/armures.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { section, tables, dataRows, loadPack, norm, num } from "./helpers/doc.ts";

const { docs, folders } = loadPack("equipment");
const items = docs.filter(d => d.type === "equipment");
const priceOf = (name: string, category?: string) => {
  const hits = items.filter(d => norm(d.name) === norm(name) && (!category || folders[d.folder] === category));
  assert.equal(hits.length, 1, `« ${name} » : ${hits.length} entrée(s)`);
  return hits[0].system.price;
};

const LISTS = ["Nourriture et boissons", "Logement", "Vêtements", "Objets divers", "Survie", "Outils", "Technologie", "Drogues et substances", "Services, salaire moyen par jour"];

test("40K Équipement — chaque ligne « nom <tab> prix » du document est un objet du compendium au bon prix", () => {
  let lines = 0;
  for (const title of LISTS) {
    const sec = section(new RegExp(`^### ${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"), /\n#{1,3} /);
    for (const raw of sec.split("\n").slice(1)) {
      const m = raw.match(/^(.*?)\t+\s*(?:\(([^)]*)\)\s*\t+\s*)?([\d.]+)(\/nuit)?\s*$/);
      if (!m) continue;
      let name = m[1].replace(/\s+/g, " ").trim();
      name = (name.match(/^(.*?)\s+:\s+/)?.[1] ?? name).replace(/\s*\((?:Injecteur|Drogue)[^)]*\)$/, "").trim();
      const category = title === "Services, salaire moyen par jour" ? "Services (salaire par jour)" : title;
      assert.equal(priceOf(name, category), num(m[3]), `${name} : prix`);
      lines++;
    }
  }
  assert.equal(lines, 97, "97 lignes de prix dans le document (+ 10 améliorations = 107 objets)");
});

test("40K Équipement — améliorations d'armes et d'armure du tableau", () => {
  const rows = tables(section(/^### Améliorations/m, /\n## /)).flatMap(dataRows);
  const names = rows.map(r => r[0]);
  assert.ok(names.length >= 9);
  for (const [name, effect, , price] of rows) {
    const hit = items.find(d => norm(d.name) === norm(name) && /^Amélioration/.test(folders[d.folder] ?? ""));
    assert.ok(hit, `amélioration « ${name} » absente`);
    assert.equal(hit.system.price, num(price), `${name} : prix`);
    assert.ok(norm(hit.system.effect).startsWith(norm(effect).slice(0, 40)), `${name} : effet`);
  }
});

test("40K Équipement — effets des drogues du tableau « Effets des drogues/substances »", () => {
  const rows = tables(section(/^## Effets des drogues\/substances/m, /\n# /)).flatMap(dataRows);
  assert.equal(rows.length, 6);
  for (const [name, effect] of rows) {
    const hit = items.find(d => norm(d.name) === norm(name) && folders[d.folder] === "Drogues et substances");
    assert.ok(hit, `drogue « ${name} » absente`);
    assert.ok(norm(hit.system.effect).includes(norm(effect).slice(0, 40)), `${name} : effet`);
  }
});
