import { BRIGANDYNE } from "../config/config.mjs";
import { BrigTest } from "../dice/roll.mjs";

const { renderTemplate } = foundry.applications.handlebars;

/** Branche les écouteurs sur les cartes de chat. */
export function registerChatListeners() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    html.querySelectorAll("[data-action='damage']").forEach(b =>
      b.addEventListener("click", () => onApplyDamage(message)));
    html.querySelectorAll("[data-action='destin-reroll']").forEach(b =>
      b.addEventListener("click", () => onDestinReroll(message, b)));
  });
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

/** Remplace RU/FOR/PSY/VOL dans une formule de dégâts de pouvoir. */
function resolveRawDamage(raw, ctx) {
  let expr = String(raw).toUpperCase();
  expr = expr.replace(/RU/g, ctx.ru).replace(/PSY/g, ctx.psyBonus ?? 0)
    .replace(/VOL/g, ctx.volBonus ?? 0).replace(/FOR/g, ctx.forBonus ?? 0);
  try { return Math.max(0, Math.round(Function(`"use strict";return (${expr})`)())); }
  catch { return ctx.ru; }
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
  let total, ap = 0, ignoreArmor = false;
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
    }
  }

  // Cibles : tokens ciblés, sinon tokens contrôlés
  let targets = [...game.user.targets].map(t => t.actor).filter(Boolean);
  if (!targets.length) targets = canvas.tokens?.controlled?.map(t => t.actor).filter(Boolean) ?? [];

  const rows = [];
  for (const actor of targets) {
    const applied = await actor.applyDamage(total, { ignoreArmor, ap });
    rows.push({ name: actor.name, raw: total, applied, prot: ignoreArmor ? "—" : Math.max(0, (actor.system.protection?.value ?? 0) - ap) });
  }

  const content = await renderTemplate("systems/brigandyne-40k/templates/chat/damage-card.hbs", {
    label: test.label, total, type: game.i18n.localize(typeDef?.label ?? dtype), ap, ignoreArmor, rows,
    hasTargets: rows.length > 0
  });
  ChatMessage.create({ speaker: message.speaker, content });
}

async function onDestinReroll(message, button) {
  const flags = message.flags?.["brigandyne-40k"];
  if (!flags) return;
  const actor = flags.test.actorUuid ? await fromUuid(flags.test.actorUuid) : null;
  if (!actor) return;
  if (!actor.isOwner) return ui.notifications?.warn(game.i18n.localize("BRIG.Warn.notOwner"));
  const ok = await actor.spendDestin();
  if (!ok) return;
  button.disabled = true;
  const test = new BrigTest(flags.test);
  await test.toMessage();
}
