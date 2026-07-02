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

test("p.110 — le tirage des atouts exige au moins 2 spécialités et 2 talents par carrière", () => {
  // Minimum pour que le tirage 2D10 « choix entre deux » fonctionne.
  for (const c of careers) {
    assert.ok((c.system.specialties ?? []).length >= 2,
      `${c.name} : ${c.system.specialties?.length ?? 0} spécialité(s), tirage impossible`);
    assert.ok((c.system.talents ?? []).length >= 2,
      `${c.name} : ${c.system.talents?.length ?? 0} talent(s), tirage impossible`);
  }
});

test("p.110/115 — RAW : 10 spécialités et 10 talents par carrière", { skip: "contenu 40k à aligner (phase adaptation)" }, () => {
  for (const c of careers) {
    assert.equal((c.system.specialties ?? []).length, 10, `${c.name} : 10 spécialités`);
    assert.equal((c.system.talents ?? []).length, 10, `${c.name} : 10 talents`);
  }
});
