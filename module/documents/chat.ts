import { BRIGANDYNE } from "../config/config.js";
import { BrigTest, rerollCostFor } from "../dice/roll.js";
import { CHARACTERISTIC_KEYS } from "../data/fields.js";

const { renderTemplate } = foundry.applications.handlebars;
const { DialogV2 } = foundry.applications.api;

/** Branche les écouteurs sur les cartes de chat. */
export function registerChatListeners() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    html.querySelectorAll("[data-action='damage']").forEach(b =>
      b.addEventListener("click", () => onApplyDamage(message)));
    html.querySelectorAll("[data-action='reroll']").forEach(b =>
      b.addEventListener("click", () => onReroll(message, b)));
    html.querySelectorAll("[data-action='riposte']").forEach(b =>
      b.addEventListener("click", () => onRiposte(message, b)));
    html.querySelectorAll("[data-action='oppose']").forEach(b =>
      b.addEventListener("click", () => onOppose(message)));
  });
}

/** Dialogue : choisir la caractéristique d'opposition. */
async function pickCharacteristic(defaultKey) {
  const opts = CHARACTERISTIC_KEYS.map(k =>
    `<option value="${k}" ${k === defaultKey ? "selected" : ""}>${game.i18n.localize(BRIGANDYNE.characteristics[k].label)}</option>`).join("");
  return DialogV2.prompt({
    window: { title: game.i18n.localize("BRIG.Oppose.title"), icon: "fa-solid fa-people-arrows" },
    content: `<form class="brigandyne-40k"><div class="form-group"><label>${game.i18n.localize("BRIG.Oppose.resistWith")}</label><select name="c">${opts}</select></div></form>`,
    ok: { label: game.i18n.localize("BRIG.Dialog.roll"), callback: (e, b) => b.form.c.value }, rejectClose: false
  }).catch(() => null);
}

/** Jet opposé : l'utilisateur oppose son acteur au résultat de la carte. */
async function onOppose(message) {
  const flags = message.flags?.["brigandyne-40k"]; if (!flags) return;
  const orig = flags.result, origTest = flags.test;
  const actor = game.user.character || canvas.tokens?.controlled?.[0]?.actor || [...game.user.targets][0]?.actor;
  if (!actor?.system?.characteristics) return ui.notifications?.warn(game.i18n.localize("BRIG.Warn.noOpposer"));
  const key = await pickCharacteristic(origTest.characteristic);
  if (!key) return;
  const char = actor.system.characteristics[key];
  const test = new BrigTest({
    actorUuid: actor.uuid, label: game.i18n.localize("BRIG.Oppose.defense"), flavor: actor.name,
    characteristic: key, base: char.total, rollType: "resist"
  });
  await test.roll(); await test.toMessage();

  const a = orig, d = test.result;
  let winner;
  if (a.success && !d.success) winner = "att";
  else if (!a.success && d.success) winner = "def";
  else if (a.success && d.success) winner = a.tier !== d.tier ? (a.tier > d.tier ? "att" : "def") : (a.margin >= d.margin ? "att" : "def");
  else winner = "none";

  const content = await renderTemplate("systems/brigandyne-40k/templates/chat/oppose-card.hbs", {
    attacker: origTest.label || game.i18n.localize("BRIG.Oppose.attacker"), defender: actor.name,
    attRoll: a.total, attDeg: game.i18n.localize(BRIGANDYNE.degrees[a.degree].label),
    defRoll: d.total, defDeg: game.i18n.localize(BRIGANDYNE.degrees[d.degree].label),
    winner, winnerName: winner === "att" ? (origTest.label || game.i18n.localize("BRIG.Oppose.attacker")) : winner === "def" ? actor.name : null
  });
  ChatMessage.create({ speaker: message.speaker, content });
}

/** Lance un d10 explosif (le « 0 explosif » d'une réussite critique). */
async function explodeD10() {
  let total = 10, last = 10, guard = 0;
  while (last === 10 && guard < 10) {
    const r = await new Roll("1d10").evaluate();
    last = r.total === 10 ? 10 : r.total;   // 10 explose encore
    if (last === 10) total += 10; else total += last;
    guard++;
  }
  return total;
}

/**
 * Évalue une expression arithmétique simple (+ - * / parenthèses) en toute sécurité.
 * Parseur à descente récursive — aucune exécution de code arbitraire.
 */
function safeArith(expr) {
  const tokens = String(expr).match(/\d+(?:\.\d+)?|[+\-*/()]/g);
  if (!tokens) return NaN;
  let i = 0;
  const peek = () => tokens[i];
  const eat = t => { if (tokens[i] === t) { i++; return true; } return false; };
  function parseExpr() {            // + et -
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") { const op = tokens[i++]; const r = parseTerm(); v = op === "+" ? v + r : v - r; }
    return v;
  }
  function parseTerm() {            // * et /
    let v = parseFactor();
    while (peek() === "*" || peek() === "/") { const op = tokens[i++]; const r = parseFactor(); v = op === "*" ? v * r : (r === 0 ? 0 : v / r); }
    return v;
  }
  function parseFactor() {          // nombre, parenthèses, unaire -
    if (eat("(")) { const v = parseExpr(); eat(")"); return v; }
    if (eat("-")) return -parseFactor();
    if (eat("+")) return parseFactor();
    const n = Number(tokens[i++]);
    return Number.isFinite(n) ? n : NaN;
  }
  const out = parseExpr();
  return Number.isFinite(out) ? out : NaN;
}

/** Remplace RU/FOR/PSY/VOL dans une formule de dégâts de pouvoir, puis évalue sans risque. */
function resolveRawDamage(raw, ctx) {
  const expr = String(raw).toUpperCase()
    .replace(/RU/g, ctx.ru ?? 0).replace(/PSY/g, ctx.psyBonus ?? 0)
    .replace(/VOL/g, ctx.volBonus ?? 0).replace(/FOR/g, ctx.forBonus ?? 0);
  const v = safeArith(expr);
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : (ctx.ru ?? 0);
}

async function onApplyDamage(message) {
  const flags = message.flags?.["brigandyne-40k"];
  if (!flags) return;
  const { test, result } = flags;
  if (!result?.success) {
    ui.notifications?.info(game.i18n.localize("BRIG.Chat.noDamageOnFail"));
    return;
  }

  // RU effectif (réussite critique = 0 explosif)
  let ru = result.ru;
  if (result.degree === "critSuccess") ru = await explodeD10();

  const dmg = test.damage || {};
  let total, ap = 0, ignoreArmor = false, halveArmor = false, vehicleScale = false;
  const dtype = dmg.type || "physique";
  const typeDef = BRIGANDYNE.damageTypes[dtype];
  if (typeDef?.ignoreArmor) ignoreArmor = true;

  if (dmg.raw) {
    total = resolveRawDamage(dmg.raw, { ru, psyBonus: dmg.psyBonus, volBonus: dmg.volBonus, forBonus: dmg.forBonus });
  } else {
    const bonus = dmg.base === "for" ? (dmg.forBonus ?? 0) + (dmg.mod ?? 0) : (dmg.mod ?? 0);
    total = ru + bonus;
    const item = dmg.weaponUuid ? await fromUuid(dmg.weaponUuid) : null;
    if (item?.system?.qualityValue) {
      const v = item.system.qualityValue("perceArmure");
      if (typeof v === "number") ap = v;
      if (item.system.hasQuality?.("ignoreArmures")) ignoreArmor = true;
      if (item.system.hasQuality?.("armureMoitie")) halveArmor = true;     // armes à feu : armure ÷2
      if (item.system.hasQuality?.("antiVehicule")) vehicleScale = true;   // touche les blindages résistants
    }
  }

  // Tactique de combat (mêlée) : ajuste les dégâts.
  switch (dmg.tactic) {
    case "enForce": total += (dmg.forBonus ?? 0); break;              // +*FOR* une seconde fois
    case "enFinesse": total = Math.max(1, Math.floor(total / 2)); break;
    case "viser": ignoreArmor = true; break;
    case "surLaDefensive": total = 0; break;
  }

  // Cibles : tokens ciblés, sinon tokens contrôlés
  let targets = [...game.user.targets].map(t => t.actor).filter(Boolean);
  if (!targets.length) targets = canvas.tokens?.controlled?.map(t => t.actor).filter(Boolean) ?? [];

  const rows = [];
  for (const actor of targets) {
    const applied = await actor.applyDamage(total, { ignoreArmor, ap, halveArmor, vehicleScale, minDamage: 1 });
    let prot = "—";
    if (!ignoreArmor) { let p = actor.system.protection?.value ?? 0; if (halveArmor) p = Math.floor(p / 2); prot = Math.max(0, p - ap); }
    rows.push({ name: actor.name, raw: total, applied, prot });
  }

  const content = await renderTemplate("systems/brigandyne-40k/templates/chat/damage-card.hbs", {
    label: test.label, total, type: game.i18n.localize(typeDef?.label ?? dtype), ap, ignoreArmor, rows,
    hasTargets: rows.length > 0
  });
  ChatMessage.create({ speaker: message.speaker, content });
}

/** Relance un test en dépensant du Sang-froid (4, ou 6 sur un échec critique — RAW). */
async function onReroll(message, button) {
  const flags = message.flags?.["brigandyne-40k"];
  if (!flags) return;
  const actor = flags.test.actorUuid ? await fromUuid(flags.test.actorUuid) : null;
  if (!actor) return;
  if (!actor.isOwner) return ui.notifications?.warn(game.i18n.localize("BRIG.Warn.notOwner"));
  const cost = rerollCostFor(flags.result.degree);
  const ok = await actor.spendSangFroid(cost);
  if (!ok) return;
  button.disabled = true;
  const test = new BrigTest({ ...flags.test, rerolled: true });
  await test.toMessage();
}

/** Riposte : sur une attaque de mêlée ratée, l'adversaire (la cible) blesse l'attaquant (effet miroir). */
async function onRiposte(message, button) {
  const flags = message.flags?.["brigandyne-40k"];
  if (!flags) return;
  const { test, result } = flags;
  const attacker = test.actorUuid ? await fromUuid(test.actorUuid) : null;
  const target = test.targetActorUuid ? await fromUuid(test.targetActorUuid) : null;
  if (!attacker || !target) return ui.notifications?.warn(game.i18n.localize("BRIG.Warn.noRiposte"));
  button.disabled = true;

  // Arme de la cible : arme de mêlée équipée, sinon mains nues.
  const weapon = target.items.find(i => i.type === "weapon" && i.system.isMelee && i.system.equipped)
    || target.items.find(i => i.type === "weapon" && i.system.isMelee);
  const forBonus = target.system.characteristics?.for?.bonus ?? 0;
  const wMod = weapon ? (weapon.system.damageMod ?? 0) : -3;       // mains nues : *FOR*-3

  // Effet miroir : le RU du jet de l'attaquant sert aux dégâts de la cible ;
  // un échec critique de l'attaquant = coup critique de la cible (10 + dé explosif).
  let ru = result.ru;
  if (result.degree === "critFailure") ru = await explodeD10();
  let total = Math.max(0, ru + forBonus + wMod);

  let ap = 0, ignoreArmor = false;
  if (weapon?.system?.qualityValue) {
    const v = weapon.system.qualityValue("perceArmure");
    if (typeof v === "number") ap = v;
    if (weapon.system.hasQuality?.("ignoreArmures")) ignoreArmor = true;
  }
  const applied = await attacker.applyDamage(total, { ap, ignoreArmor, minDamage: 1 });

  const content = await renderTemplate("systems/brigandyne-40k/templates/chat/damage-card.hbs", {
    label: game.i18n.format("BRIG.Riposte.label", { name: target.name }),
    total, type: game.i18n.localize("BRIG.Damage.physique"), ap, ignoreArmor,
    rows: [{ name: attacker.name, raw: total, applied, prot: ignoreArmor ? "—" : Math.max(0, (attacker.system.protection?.value ?? 0) - ap) }],
    hasTargets: true
  });
  ChatMessage.create({ speaker: message.speaker, content });
}
