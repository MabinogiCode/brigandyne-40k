import { BRIGANDYNE } from "../config/config.mjs";

const { renderTemplate } = foundry.applications.handlebars;

/**
 * Détermine le degré de réussite d'un jet d100 sous caractéristique.
 * - Réussite (résultat ≤ cible) :
 *     unités == 0           → critique
 *     résultat ≤ 09         → majeure
 *     sinon                 → mineure
 * - Échec (résultat > cible) :
 *     unités == 0           → critique
 *     résultat ≥ 91         → majeur
 *     sinon                 → mineur
 * @returns {string} clé de BRIGANDYNE.degrees
 */
export function degreeOf(total, target) {
  const units = total % 10;            // 100 % 10 = 0
  const success = target > 0 && total <= target && total !== 100;
  if (success) {
    if (units === 0) return "critSuccess";
    if (total <= 9) return "majorSuccess";
    return "minorSuccess";
  } else {
    if (units === 0) return "critFailure";
    if (total >= 91) return "majorFailure";
    return "minorFailure";
  }
}

/**
 * Un test d100 du système Brigandyne 40K.
 */
export class BrigTest {
  constructor(data = {}) {
    this.data = foundry.utils.mergeObject({
      actorUuid: null,
      itemUuid: null,
      label: "",
      flavor: "",
      characteristic: null,     // clé de caractéristique (affichage)
      base: 0,                  // valeur de base (%)
      modifiers: [],            // [{ label, value }]
      advantage: 0,
      disadvantage: 0,
      rollType: "test",         // test | attack | power | faith | resist
      damage: null,             // { base:"for"|"flat", mod, type, weaponUuid }
      targetActorUuid: null,
      whisper: false
    }, data);
    this.result = null;
    this.rolls = [];
  }

  get net() { return (this.data.advantage || 0) - (this.data.disadvantage || 0); }

  get effectiveTarget() {
    const mods = (this.data.modifiers || []).reduce((s, m) => s + (Number(m.value) || 0), 0);
    return Math.max(0, Math.round(this.data.base + mods));
  }

  /** Exécute les jets de dés. */
  async roll() {
    const net = this.net;
    const nTens = 1 + Math.abs(net);
    const tensRoll = await new Roll(`${nTens}d10`).evaluate();
    const unitsRoll = await new Roll(`1d10`).evaluate();
    this.rolls = [tensRoll, unitsRoll];

    // Valeurs 0-9 (10 → 0)
    const tensVals = tensRoll.dice[0].results.map(r => r.result % 10);
    let chosenIdx = 0;
    if (net > 0) chosenIdx = tensVals.indexOf(Math.min(...tensVals));        // Avantage : meilleure (plus basse) dizaine
    else if (net < 0) chosenIdx = tensVals.indexOf(Math.max(...tensVals));   // Désavantage : pire dizaine
    // Marque les dés non retenus comme écartés
    tensRoll.dice[0].results.forEach((r, i) => { r.discarded = i !== chosenIdx; r.active = i === chosenIdx; });

    const tens = tensVals[chosenIdx];
    const units = unitsRoll.total % 10;          // RU (dé d'unité)
    let total = tens * 10 + units;
    if (total === 0) total = 100;                // 00 = 100

    const target = this.effectiveTarget;
    const degree = degreeOf(total, target);
    const def = BRIGANDYNE.degrees[degree];

    this.result = {
      total, tens, units, ru: units,
      target,
      success: def.success,
      degree,
      degreeLabel: BRIGANDYNE.degrees[degree].label,
      css: def.css,
      tier: def.tier,
      margin: def.success ? (target - total) : (total - target),
      isCrit: degree === "critSuccess",
      isFumble: degree === "critFailure",
      tensVals, chosenIdx,
      net,
      advantage: this.data.advantage,
      disadvantage: this.data.disadvantage
    };
    return this.result;
  }

  /** Construit et poste la carte de chat. */
  async toMessage({ rollMode } = {}) {
    if (!this.result) await this.roll();
    const actor = this.data.actorUuid ? await fromUuid(this.data.actorUuid) : null;

    const templateData = {
      data: this.data,
      result: this.result,
      actor,
      modifiers: (this.data.modifiers || []).filter(m => Number(m.value)),
      hasDamage: this.data.rollType === "attack" || !!this.data.damage,
      canReroll: !!actor && (actor.system?.destin?.value > 0),
      degrees: BRIGANDYNE.degrees
    };
    const content = await renderTemplate("systems/brigandyne-40k/templates/chat/test-card.hbs", templateData);

    // Combine les dés pour l'affichage 3D et l'historique
    const pool = foundry.dice.terms.PoolTerm.fromRolls(this.rolls);
    const combined = Roll.fromTerms([pool]);

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: this.data.flavor || this.data.label,
      content,
      rolls: [combined],
      sound: CONFIG.sounds.dice,
      flags: {
        "brigandyne-40k": {
          test: this.data,
          result: this.result
        }
      }
    };
    const mode = rollMode || game.settings.get("core", "rollMode");
    ChatMessage.applyMode(messageData, mode);
    return ChatMessage.create(messageData);
  }
}

/** Raccourci : crée, lance et poste un test. */
export async function rollTest(data) {
  const test = new BrigTest(data);
  await test.roll();
  await test.toMessage();
  return test;
}
