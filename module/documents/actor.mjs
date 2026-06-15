import { BRIGANDYNE } from "../config/config.mjs";
import { BrigTest } from "../dice/roll.mjs";
import { promptTest } from "../apps/test-dialog.mjs";
import { postWarpResult } from "../data/warp-tables.mjs";

/**
 * Document Acteur du système.
 */
export class BrigActor extends Actor {

  /* -------------------------------------------- */
  /*  Préparation des données                     */
  /* -------------------------------------------- */
  prepareDerivedData() {
    const armor = this._computeArmor();
    super.prepareDerivedData();   // déclenche system.prepareDerivedData() (calcule base+mod)
    // On finalise ici (après le modèle) pour garantir la prise en compte des armures.
    if (this.system.protection) {
      this.system.protection.fromArmor = armor.protection;
      this.system.protection.value = (this.system.protection.base ?? 0) + (this.system.protection.mod ?? 0) + armor.protection;
    }
    if (this.system.initiative) this.system.initiative.value += armor.initMod;
    this.system._armorMouMod = armor.mouMod;
    this._prepareEncumbrance();
  }

  /** Somme la protection et les pénalités des armures équipées (sans muter les champs stockés). */
  _computeArmor() {
    let body = 0, bonus = 0, initMod = 0, mouMod = 0;
    for (const item of this.items) {
      if (item.type !== "armor" || !item.system.equipped) continue;
      const p = item.system.protection ?? 0;
      if (item.system.coverage === "bonus") bonus += p;
      else body = Math.max(body, p);          // les armures de corps ne s'empilent pas
      initMod += item.system.initiativeMod ?? 0;
      mouMod += item.system.mouMod ?? 0;
    }
    return { protection: body + bonus, initMod, mouMod };
  }

  _prepareEncumbrance() {
    let total = 0;
    for (const item of this.items) {
      const w = item.system?.totalWeight ?? ((item.system?.weight ?? 0) * (item.system?.quantity ?? 1));
      total += w || 0;
    }
    this.system.encumbrance = { value: Math.round(total * 10) / 10 };
  }

  getRollData() {
    const data = { ...super.getRollData() };
    if (this.system.characteristics) {
      for (const [k, c] of Object.entries(this.system.characteristics)) {
        data[k] = c.total;
        data[`${k}b`] = c.bonus;
      }
    }
    data.initiative = this.system.initiative?.value ?? 0;
    return data;
  }

  /* -------------------------------------------- */
  /*  Jets                                        */
  /* -------------------------------------------- */

  /** Test d'une caractéristique. */
  async rollCharacteristic(charKey, options = {}) {
    const char = this.system.characteristics?.[charKey];
    if (!char) return;
    const label = `${game.i18n.localize(BRIGANDYNE.characteristics[charKey].label)}`;
    return this._performTest({
      label: game.i18n.format("BRIG.Test.of", { name: label }),
      flavor: label,
      characteristic: charKey,
      base: char.total,
      rollType: "test"
    }, options);
  }

  /** Test d'une spécialité (caractéristique + bonus de spécialité). */
  async rollSpecialty(item, options = {}) {
    const charKey = item.system.characteristic || "tec";
    const char = this.system.characteristics?.[charKey];
    const base = char?.total ?? 0;
    return this._performTest({
      label: item.name,
      flavor: `${game.i18n.localize(BRIGANDYNE.characteristics[charKey].label)} · ${item.name}`,
      characteristic: charKey,
      base,
      modifiers: [{ label: item.name, value: item.system.bonus ?? 0 }],
      itemUuid: item.uuid,
      rollType: "test"
    }, options);
  }

  /** Attaque avec une arme. */
  async rollWeaponAttack(item, options = {}) {
    if (item.type !== "weapon") return;
    const charKey = item.system.rollChar;
    const char = this.system.characteristics?.[charKey];
    const modifiers = [];
    let advantage = 0, disadvantage = 0;

    if (item.system.hasQuality?.("precis")) advantage += 1;
    if (item.system.hasQuality?.("lourde") && (this.system.characteristics?.for?.total ?? 0) < 50) disadvantage += 1;

    // MODO de la cible ciblée (mêlée)
    const target = Array.from(game.user.targets)[0]?.actor;
    if (target && item.system.isMelee && target.system?.characteristics?.com) {
      const modo = BRIGANDYNE.mechanics.modoCenter - target.system.characteristics.com.total;
      modifiers.push({ label: `MODO (${target.name})`, value: modo });
    }

    return this._performTest({
      label: item.name,
      flavor: `${game.i18n.localize(BRIGANDYNE.characteristics[charKey].label)} · ${item.name}`,
      characteristic: charKey,
      base: char?.total ?? 0,
      modifiers,
      advantage, disadvantage,
      itemUuid: item.uuid,
      rollType: "attack",
      damage: {
        base: item.system.damageBase,
        mod: item.system.damageMod,
        type: item.system.damageType,
        forBonus: this.system.characteristics?.for?.bonus ?? 0,
        weaponUuid: item.uuid
      },
      targetActorUuid: target?.uuid ?? null
    }, options);
  }

  /** Manifester un pouvoir psychique (test de PSY). */
  async rollPower(item, options = {}) {
    if (item.type !== "psychicPower") return;
    const char = this.system.characteristics?.psy;
    const test = await this._performTest({
      label: item.name,
      flavor: `${game.i18n.localize("BRIG.Char.psy.long")} · ${item.name}`,
      characteristic: "psy",
      base: char?.total ?? 0,
      modifiers: item.system.difficulty ? [{ label: game.i18n.localize("BRIG.Difficulty.label"), value: item.system.difficulty }] : [],
      itemUuid: item.uuid,
      rollType: "power",
      damage: item.system.damage ? { raw: item.system.damage, type: item.system.damageType, psyBonus: char?.bonus ?? 0 } : null
    }, options);
    // Échec majeur → Phénomène psychique ; échec critique → Péril du Warp
    if (test?.result?.degree === "critFailure") await postWarpResult(this, "peril");
    else if (test?.result?.degree === "majorFailure") await postWarpResult(this, "phenomenon");
    return test;
  }

  /** Manifester un Acte de Foi (test de VOL). */
  async rollFaith(item, options = {}) {
    if (item.type !== "faithAct") return;
    const char = this.system.characteristics?.vol;
    return this._performTest({
      label: item.name,
      flavor: `${game.i18n.localize("BRIG.Char.vol.long")} · ${item.name}`,
      characteristic: "vol",
      base: char?.total ?? 0,
      modifiers: item.system.difficulty ? [{ label: game.i18n.localize("BRIG.Difficulty.label"), value: item.system.difficulty }] : [],
      itemUuid: item.uuid,
      rollType: "faith",
      damage: item.system.damage ? { raw: item.system.damage, type: item.system.damageType, volBonus: char?.bonus ?? 0 } : null
    }, options);
  }

  /** Coeur commun : ouvre le dialogue (sauf raccourci) puis lance le test. */
  async _performTest(testData, { skipDialog = false, event } = {}) {
    const fastKey = event?.shiftKey || event?.ctrlKey;
    let dialogResult = { difficulty: 0, situational: 0, advantage: 0, disadvantage: 0 };
    if (!skipDialog && !fastKey) {
      dialogResult = await promptTest({ actor: this, testData });
      if (dialogResult === null) return null;     // annulé
    }
    const modifiers = [...(testData.modifiers || [])];
    if (dialogResult.difficulty) modifiers.push({ label: game.i18n.localize("BRIG.Difficulty.label"), value: dialogResult.difficulty });
    if (dialogResult.situational) modifiers.push({ label: game.i18n.localize("BRIG.Test.situational"), value: dialogResult.situational });

    const test = new BrigTest({
      ...testData,
      actorUuid: this.uuid,
      modifiers,
      advantage: (testData.advantage || 0) + (dialogResult.advantage || 0),
      disadvantage: (testData.disadvantage || 0) + (dialogResult.disadvantage || 0)
    });
    await test.toMessage();
    return test;
  }

  /* -------------------------------------------- */
  /*  Application des dégâts / ressources          */
  /* -------------------------------------------- */

  /** Applique des dégâts en tenant compte de la protection. */
  async applyDamage(amount, { ignoreArmor = false, ap = 0 } = {}) {
    const prot = ignoreArmor ? 0 : Math.max(0, (this.system.protection?.value ?? 0) - ap);
    const dmg = Math.max(0, amount - prot);
    const pv = this.system.pv;
    if (!pv) return;
    const newVal = Math.max(0, pv.value - dmg);
    await this.update({ "system.pv.value": newVal });
    return dmg;
  }

  /** Améliore une caractéristique de +5% en dépensant de l'XP. */
  async advanceCharacteristic(key) {
    const c = this.system.characteristics?.[key];
    if (!c || !this.system.xp) return;
    const step = BRIGANDYNE.advancement.charStep;
    const newValue = Math.min(100, c.value + step);
    if (newValue === c.value) return;
    const cost = BRIGANDYNE.charAdvanceCost(newValue);
    if ((this.system.xp.available ?? 0) < cost) {
      return ui.notifications?.warn(game.i18n.format("BRIG.Warn.noXp", { cost }));
    }
    await this.update({
      [`system.characteristics.${key}.value`]: newValue,
      [`system.characteristics.${key}.advances`]: (c.advances ?? 0) + 1,
      "system.xp.spent": (this.system.xp.spent ?? 0) + cost
    });
    ui.notifications?.info(game.i18n.format("BRIG.Info.advanced", { char: game.i18n.localize(BRIGANDYNE.characteristics[key].abbrev), cost }));
  }

  /** Annule la dernière amélioration d'une caractéristique (rembourse l'XP). */
  async refundCharacteristic(key) {
    const c = this.system.characteristics?.[key];
    if (!c || !this.system.xp || (c.advances ?? 0) <= 0) return;
    const step = BRIGANDYNE.advancement.charStep;
    const refund = BRIGANDYNE.charAdvanceCost(c.value);   // coût payé pour atteindre la valeur actuelle
    await this.update({
      [`system.characteristics.${key}.value`]: Math.max(0, c.value - step),
      [`system.characteristics.${key}.advances`]: (c.advances ?? 0) - 1,
      "system.xp.spent": Math.max(0, (this.system.xp.spent ?? 0) - refund)
    });
  }

  /** Dépense un point de Destin. */
  async spendDestin() {
    const d = this.system.destin;
    if (!d || d.value <= 0) {
      ui.notifications?.warn(game.i18n.localize("BRIG.Warn.noDestin"));
      return false;
    }
    await this.update({ "system.destin.value": d.value - 1 });
    return true;
  }
}
