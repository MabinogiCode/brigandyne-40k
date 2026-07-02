/**
 * Tests RAW — Carrières (Livre Premier, p. 55-57, 110, 150) contre les données
 * du compendium packs/_source/careers.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "packs", "_source", "careers");

function loadPack() {
  const out = [];
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith(".json")) continue;
    const d = JSON.parse(readFileSync(join(DIR, f), "utf-8"));
    if (d.type === "career") out.push(d);
  }
  return out;
}
const careers = loadPack();

test("le compendium des carrières n'est pas vide", () => {
  assert.ok(careers.length > 0);
});

test("p.150 — profil de progression : 0 à 6 cases par compétence", () => {
  for (const c of careers) {
    for (const [k, v] of Object.entries(c.system.advances ?? {})) {
      const n = Number(v) || 0;
      assert.ok(n >= 0 && n <= 6, `${c.name} : ${k} = ${n} cases (attendu 0-6)`);
    }
  }
});

test("p.124 — chaque carrière a un niveau de vie valide", () => {
  const valid = ["miserable", "pauvre", "ordinaire", "aise", "riche", "royal"];
  for (const c of careers) {
    assert.ok(valid.includes(c.system.lifestyle),
      `${c.name} : niveau de vie « ${c.system.lifestyle} » inconnu`);
  }
});

test("p.110/115 — RAW : 10 spécialités et 10 talents par carrière", () => {
  for (const c of careers) {
    assert.equal((c.system.specialties ?? []).length, 10, `${c.name} : 10 spécialités`);
    assert.equal((c.system.talents ?? []).length, 10, `${c.name} : 10 talents`);
  }
});

test("intégrité — chaque atout de carrière résout dans les compendiums (« X ou Y » par moitié)", () => {
  const specDir = join(dirname(fileURLToPath(import.meta.url)), "..", "packs", "_source", "specialties");
  const talDir = join(dirname(fileURLToPath(import.meta.url)), "..", "packs", "_source", "talents");
  const names = dir => new Set(readdirSync(dir).filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(readFileSync(join(dir, f), "utf-8")))
    .filter(d => ["specialty", "talent"].includes(d.type)).map(d => d.name));
  const specs = names(specDir);
  const tals = names(talDir);
  for (const c of careers) {
    for (const n of c.system.specialties ?? []) {
      for (const half of n.split(" ou ")) {
        assert.ok(specs.has(half), `${c.name} : spécialité inconnue « ${half} » (entrée « ${n} »)`);
      }
    }
    for (const n of c.system.talents ?? []) {
      for (const half of n.split(" ou ")) {
        assert.ok(tals.has(half), `${c.name} : talent inconnu « ${half} » (entrée « ${n} »)`);
      }
    }
  }
});

test("intégrité — les talents accessibles des archétypes résolvent dans le compendium", () => {
  const talDir = join(dirname(fileURLToPath(import.meta.url)), "..", "packs", "_source", "talents");
  const tals = new Set(readdirSync(talDir).filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(readFileSync(join(talDir, f), "utf-8")))
    .filter(d => d.type === "talent").map(d => d.name));
  const arcDir = join(dirname(fileURLToPath(import.meta.url)), "..", "packs", "_source", "archetypes");
  for (const f of readdirSync(arcDir).filter(f => f.endsWith(".json"))) {
    const d = JSON.parse(readFileSync(join(arcDir, f), "utf-8"));
    if (d.type !== "archetype") continue;
    for (const n of d.system.talents ?? []) {
      assert.ok(tals.has(n), `${d.name} : talent accessible inconnu « ${n} »`);
    }
  }
});
