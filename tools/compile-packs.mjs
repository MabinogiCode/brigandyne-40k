/**
 * Compile les sources JSON (packs/_source/<pack>/*.json) en packs LevelDB
 * lisibles par Foundry (packs/<pack>), en écrivant directement les clés
 * au format Foundry : !items!<id> (objets) ou !actors!<id> (acteurs).
 *
 *   npm run pack
 */
import { ClassicLevel } from "classic-level";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "packs", "_source");
const ACTOR_PACKS = new Set(["bestiary", "vehicles"]);

const dirs = fs.readdirSync(SRC).filter(d => fs.statSync(path.join(SRC, d)).isDirectory());
console.log(`Compilation de ${dirs.length} packs :`);

for (const name of dirs) {
  const src = path.join(SRC, name);
  const dest = path.join(ROOT, "packs", name);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  const collection = ACTOR_PACKS.has(name) ? "actors" : "items";
  const db = new ClassicLevel(dest, { keyEncoding: "utf8", valueEncoding: "json" });
  const batch = db.batch();
  let n = 0;
  for (const file of fs.readdirSync(src).filter(f => f.endsWith(".json"))) {
    const doc = JSON.parse(fs.readFileSync(path.join(src, file), "utf8"));
    if (!doc._id) continue;
    delete doc._key;
    batch.put(`!${collection}!${doc._id}`, doc);
    n++;
  }
  await batch.write();
  await db.close();
  console.log(`  ${name}: ${n} documents → packs/${name} (${collection})`);
}
console.log("Compilation terminée.");
