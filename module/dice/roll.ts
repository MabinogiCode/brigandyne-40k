import { BRIGANDYNE } from "../config/config.js";

/** Clés de degré de réussite. */
export type DegreeKey = "critSuccess" | "majorSuccess" | "minorSuccess" | "minorFailure" | "majorFailure" | "critFailure";

/** Résultat d'un test d100. */
export interface TestResult {
  total: number;
  tens: number;
  units: number;
  ru: number;
  target: number;
  success: boolean;
  degree: DegreeKey;
  degreeLabel: string;
  css: string;
  tier: number;
  margin: number;
  isCrit: boolean;
  isFumble: boolean;
  net: number;
}

/** Un modificateur de test (étiquette + valeur numérique). */
export interface TestModifier {
  label: string;
  value: number;
}

/** Données de configuration d'un test. */
export interface TestData {
  actorUuid: string | null;
  itemUuid: string | null;
  label: string;
  flavor: string;
  characteristic: string | null;
  base: number;
  modifiers: TestModifier[];
  advantage: number;
  disadvantage: number;
  rollType: "test" | "attack" | "power" | "faith" | "resist";
  damage: { base: string; mod: number; type: string; weaponUuid?: string; tactic?: string; isMelee?: boolean } | null;
  targetActorUuid: string | null;
  rerolled: boolean;
  whisper: boolean;
}

/**
 * Détermine le degré de réussite d'un jet d100 sous caractéristique.
 * - Réussite (résultat ≤ cible) :
 *     unités == 0                        → critique
 *     résultat ≤ 09 ET cible ≥ 20        → majeure   (pas de majeure si < 20 %)
 *     sinon                              → mineure
 * - Échec (résultat > cible) :
 *     unités == 0                        → critique
 *     résultat ≥ 91 ET cible < 80        → majeur    (pas de majeur si ≥ 80 %)
 *     sinon                              → mineur
 */
export function degreeOf(total: number, target: number): DegreeKey {
  const units = total % 10;            // 100 % 10 = 0
  const success = target > 0 && total <= target && total !== 100;
  if (success) {
    if (units === 0) return "critSuccess";
    if (total <= 9 && target >= 20) return "majorSuccess";   // exception « médiocrité »
    return "minorSuccess";
  } else {
    if (units === 0) return "critFailure";
    if (total >= 91 && target < 80) return "majorFailure";   // exception « excellence »
    return "minorFailure";
  }
}

/** Cap RAW : on ne cumule jamais plus de 3 Avantages ou Désavantages. */
const MAX_NET = 3;

/** Coût en Sang-froid d'une relance (6 sur un échec critique, 4 sinon) — RAW p.142. */
export function rerollCostFor(degree: DegreeKey): number { return degree === "critFailure" ? 6 : 4; }

/**
 * Un test d100 du système Brigandyne 40K.
 */
export class BrigTest {
  data: TestData;
  result: TestResult | null;
  rolls: Roll[];

  constructor(data: Partial<TestData> = {}) {
    this.data = foundry.utils.mergeObject({
      actorUuid: null,
      itemUuid: null,
      label: "",
      flavor: "",
      characteristic: null,
      base: 0,
      modifiers: [],
      advantage: 0,
      disadvantage: 0,
      rollType: "test",
      damage: null,
      targetActorUuid: null,
      rerolled: false,
      whisper: false
    }, data) as TestData;
    this.result = null;
    this.rolls = [];
  }

  /** Solde Avantage − Désavantage, borné à ±3 (RAW). */
  get net(): number {
    const raw = (this.data.advantage || 0) - (this.data.disadvantage || 0);
    return Math.max(-MAX_NET, Math.min(MAX_NET, raw));
  }

  /** Cible effective : base + modificateurs + Avantage/Désavantage (±10 chacun, RAW). */
  get effectiveTarget(): number {
    const mods = (this.data.modifiers || []).reduce((s, m) => s + (Number(m.value) || 0), 0);
    return Math.max(0, Math.round(this.data.base + mods + this.net * 10));
  }

  /** Exécute le jet (un seul d100, lu en dizaine + unité). */
  async roll(): Promise<TestResult> {
    const tensRoll = await new Roll(`1d10`).evaluate();
    const unitsRoll = await new Roll(`1d10`).evaluate();
    this.rolls = [tensRoll, unitsRoll];

    const tens = tensRoll.total % 10;            // 10 → 0
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
      degreeLabel: def.label,
      css: def.css,
      tier: def.tier,
      margin: def.success ? (target - total) : (total - target),
      isCrit: degree === "critSuccess",
      isFumble: degree === "critFailure",
      net: this.net
    };
    return this.result;
  }

  /** Construit et poste la carte de chat. */
  async toMessage({ rollMode }: { rollMode?: string } = {}): Promise<ChatMessage | undefined> {
    const { renderTemplate } = foundry.applications.handlebars;
    if (!this.result) await this.roll();
    const actor = this.data.actorUuid ? await fromUuid(this.data.actorUuid) : null;

    const rerollCost = rerollCostFor(this.result!.degree);
    const canReroll = !this.data.rerolled && !!actor && ((actor as any).system?.sf?.value ?? 0) >= rerollCost;

    const modifiers = (this.data.modifiers || []).filter(m => Number(m.value)).map(m => ({ ...m }));
    if (this.net) modifiers.push({
      label: this.net > 0 ? game.i18n.localize("BRIG.Dialog.advantage") : game.i18n.localize("BRIG.Dialog.disadvantage"),
      value: this.net * 10
    });

    const isMeleeAttack = this.data.rollType === "attack" && !!this.data.targetActorUuid && this.data.damage?.isMelee;

    const templateData = {
      data: this.data,
      result: this.result,
      actor,
      modifiers,
      hasDamage: this.data.rollType === "attack" || !!this.data.damage,
      canReroll, rerollCost,
      canRiposte: isMeleeAttack && !this.result!.success,
      degrees: BRIGANDYNE.degrees
    };
    const content = await renderTemplate("systems/brigandyne-40k/templates/chat/test-card.hbs", templateData);

    const pool = foundry.dice.terms.PoolTerm.fromRolls(this.rolls);
    const combined = Roll.fromTerms([pool]);

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: actor as any }),
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
    ChatMessage.applyMode(messageData, mode as any);
    return ChatMessage.create(messageData);
  }
}

/** Raccourci : crée, lance et poste un test. */
export async function rollTest(data: Partial<TestData>): Promise<BrigTest> {
  const test = new BrigTest(data);
  await test.roll();
  await test.toMessage();
  return test;
}
