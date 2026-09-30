/**
 * Filet de sécurité i18n : chaque clé « BRIG.… » citée en littéral dans le code
 * ou les gabarits doit exister dans lang/fr.json (sinon Foundry affiche la clé brute).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const lang = JSON.parse(readFileSync(join(ROOT, "lang", "fr.json"), "utf-8"));

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some(e => f.endsWith(e))) out.push(p);
  }
  return out;
}

const has = (key: string): boolean => {
  let node: any = lang;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object" || !(part in node)) return false;
    node = node[part];
  }
  return typeof node === "string" || typeof node === "object";
};

test("toutes les clés i18n littérales du code et des gabarits existent dans lang/fr.json", () => {
  const files = [...walk(join(ROOT, "src"), [".ts"]), ...walk(join(ROOT, "templates"), [".hbs"])];
  const missing: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    for (const m of text.matchAll(/["'`](BRIG\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)["'`]/g)) {
      if (!has(m[1])) missing.push(`${file.replace(ROOT, "")} : ${m[1]}`);
    }
  }
  assert.deepEqual([...new Set(missing)], [], "clés i18n manquantes");
});
