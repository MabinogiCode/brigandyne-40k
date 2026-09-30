/**
 * Conformité 40K — Bestiaire (document « Warhammer 40.000 : Brigandyne : Rencontres »).
 * Profil de chaque créature : COM/TIR, Initiative, Protection, PV et compétences listées.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRIGANDYNE } from "../src/config/config.ts";
import { ROOT, loadPack, norm } from "./helpers/doc.ts";

const md = readFileSync(join(ROOT, "tools", "source", "03_rencontres.md"), "utf-8").split("\n");
const cells = (l: string) => l.split("|").slice(1, -1).map(c => c.trim());

interface Profile { name: string; com?: number; tir?: number; init?: number; prot?: number; pv?: number; skills: Record<string, number> }

/** Blocs « | Nom | Nom | … | » suivis de leurs lignes COM/TIR, Dégâts, Spécial, Compétences. */
function parseCreatures(): Profile[] {
  const out: Profile[] = [];
  for (let i = 0; i < md.length - 2; i++) {
    const head = cells(md[i]);
    if (head.length < 5 || head[0] === "Nom" || !head.every(c => c === head[0]) || !/^\| -/.test(md[i + 1])) continue;
    // Erreur de copier-coller du document : le 2e bloc « Horreur Rose de Tzeentch » (Feu bleu, Magie (2)) est l'Horreur Bleue.
    const name = head[0] === "Horreur Rose de Tzeentch" && out.some(c => c.name === head[0]) ? "Horreur Bleue de Tzeentch" : head[0];
    const p: Profile = { name, skills: {} };
    for (let j = i + 2; j < md.length && md[j].startsWith("|"); j++) {
      const c = cells(md[j]);
      const first = c[0];
      let m: RegExpMatchArray | null;
      if ((m = first.match(/^COM\s+(\d+)(?:\/[+\-−–]?\d+)?\s+TIR\s+(\d+)/))) { p.com = +m[1]; p.tir = +m[2]; }
      else if ((m = first.match(/^COM\s+(\d+)/))) p.com = +m[1];
      if ((m = (c.find(x => /^Init\s+\d+/.test(x)) ?? "").match(/^Init\s+(\d+)/))) p.init = +m[1];
      if ((m = (c.find(x => /^Prot\s+\d+/.test(x)) ?? "").match(/^Prot\s+(\d+)/))) p.prot = +m[1];
      if ((m = (c.find(x => /^PV\s+\d+/.test(x)) ?? "").match(/^PV\s+(\d+)/))) p.pv = +m[1];
      if (first === "Compétences") for (const s of c[1].matchAll(/([A-Z]{3})\s+(\d+)/g)) if (s[1].toLowerCase() in BRIGANDYNE.characteristics) p.skills[s[1].toLowerCase()] = +s[2];
    }
    out.push(p);
  }
  return out;
}

const creatures = parseCreatures();
const pack = loadPack("bestiary").docs.filter(d => d.type === "npc");

test("40K Bestiaire — les 17 créatures du document sont lues", () => {
  assert.ok(creatures.length >= 17, `créatures lues : ${creatures.length}`);
});

test("40K Bestiaire — chaque créature du document existe dans le compendium", () => {
  const names = new Set(pack.map(d => norm(d.name)));
  for (const c of creatures) assert.ok(names.has(norm(c.name)), `créature « ${c.name} » absente du compendium`);
});

test("40K Bestiaire — COM, TIR, Initiative, Protection, PV et compétences conformes au document", () => {
  for (const c of creatures) {
    const d = pack.find(d => norm(d.name) === norm(c.name));
    if (!d) continue;
    const s = d.system;
    if (c.com != null) assert.equal(s.characteristics.com.value, c.com, `${c.name} : COM`);
    if (c.tir != null) assert.equal(s.characteristics.tir.value, c.tir, `${c.name} : TIR`);
    if (c.init != null) assert.equal(s.initiative.base, c.init, `${c.name} : Initiative`);
    if (c.prot != null) assert.equal(s.protection.base, c.prot, `${c.name} : Protection`);
    if (c.pv != null) { assert.equal(s.pv.max, c.pv, `${c.name} : PV max`); assert.equal(s.pv.value, c.pv, `${c.name} : PV`); }
    for (const [k, v] of Object.entries(c.skills)) assert.equal(s.characteristics[k].value, v, `${c.name} : ${k.toUpperCase()}`);
  }
});
