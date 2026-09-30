/**
 * Génère le compendium « Blessures graves » (packs/_source/critical-injuries) depuis
 * la table des séquelles du Livre Premier p.197 (src/data/sequelae.ts, source de
 * vérité du tirage d100 et testée dans test/sequelae.test.ts).
 *
 *   node tools/import-sequelae.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEQUELAE } from "../src/data/sequelae.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "packs", "_source", "critical-injuries");

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function makeId(prefix: string, name: string): string {
  const base = (prefix + ":" + name).normalize("NFKD");
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < base.length; i++) {
    h1 = ((h1 << 5) + h1 + base.charCodeAt(i)) >>> 0;
    h2 = ((h2 << 5) + h2 + base.charCodeAt(base.length - 1 - i)) >>> 0;
  }
  const s = [h1, h2, (h1 ^ h2) >>> 0, (h1 + h2) >>> 0].map(c => c.toString(36)).join("") + "0000000000000000";
  let id = "";
  for (let i = 0; i < 16; i++) id += ID_CHARS[s.charCodeAt(i) % ID_CHARS.length];
  return id;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const pad = (n: number) => String(n).padStart(2, "0");
for (const s of SEQUELAE) {
  const _id = makeId("sequela", s.name);
  const effect = `<p>${s.effect}</p>`;
  const doc = {
    _id, name: s.name, type: "criticalInjury", img: "icons/svg/blood.svg",
    system: {
      roll: `${pad(s.min)}-${s.max === 100 ? "00" : pad(s.max)}`, location: s.location, severity: 1, condition: "",
      effect, description: effect, source: "Livre Premier p.197"
    }
  };
  fs.writeFileSync(path.join(OUT, `${pad(s.min)}_${s.name.replace(/[^a-zA-Z0-9À-ÿ]+/g, "_").slice(0, 40)}_${_id}.json`), JSON.stringify(doc, null, 2), "utf8");
}
console.log(`critical-injuries : ${SEQUELAE.length} séquelles → packs/_source/critical-injuries`);
