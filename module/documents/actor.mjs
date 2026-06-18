import { BRIGANDYNE } from "../config/config.mjs";
import { BrigTest } from "../dice/roll.mjs";
import { promptTest } from "../apps/test-dialog.mjs";
import { postWarpResult } from "../data/warp-tables.mjs";

const { renderTemplate } = foundry.applications.handlebars;

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
      tactics: true,                         // propose les tactiques de combat dans le dialogue
      damage: {
        base: item.system.damageBase,
        mod: item.system.damageMod,
        type: item.system.damageType,
        forBonus: this.system.characteristics?.for?.bonus ?? 0,
        isMelee: !!item.system.isMelee,
        weaponUuid: item.uuid
      },
      targetActorUuid: target?.uuid ?? null
    }, options);
  }

  /** Manifester un pouvoir psychique (test de PSY). */
  async rollPower(item, options = {}) {
    if (item.type !== "psychicPower") return;
    const char = this.system.characteristics?.psy;
    const modifiers = item.system.difficulty ? [{ label: game.i18n.localize("BRIG.Difficulty.label"), value: item.system.difficulty }] : [];

    // Dépassement de la limite journalière : *PSY* pouvoirs/jour, au-delà → coût en PV (RAW Magie).
    const perDay = this.system.psy?.powersPerDay ?? 0;
    const used = this.system.dailyUse?.powers ?? 0;
    const overflow = used >= perDay;

    const test = await this._performTest({
      label: item.name,
      flavor: `${game.i18n.localize("BRIG.Char.psy.long")} · ${item.name}`,
      characteristic: "psy",
      base: char?.total ?? 0,
      modifiers,
      itemUuid: item.uuid,
      rollType: "power",
      damage: item.system.damage ? { raw: item.system.damage, type: item.system.damageType, psyBonus: char?.bonus ?? 0 } : null
    }, options);
    if (!test) return null;   // annulé

    // Comptabilise l'usage ; applique le coût de dépassement (PV).
    const updates = { "system.dailyUse.powers": used + 1 };
    if (overflow) {
      const cost = item.system.isMinor ? 2 : 4;       // tour : 2 PV ; sortilège : 4 PV
      updates["system.pv.value"] = Math.max(0, (this.system.pv?.value ?? 0) - cost);
      ui.notifications?.warn(game.i18n.format("BRIG.Warn.psyOverflow", { cost }));
    }
    await this.update(updates);

    // Échec majeur → Phénomène psychique ; échec critique → Péril du Warp
    if (test.result?.degree === "critFailure") await postWarpResult(this, "peril");
    else if (test.result?.degree === "majorFailure") await postWarpResult(this, "phenomenon");
    return test;
  }

  /** Manifester un Acte de Foi (test de VOL). */
  async rollFaith(item, options = {}) {
    if (item.type !== "faithAct") return;
    const char = this.system.characteristics?.vol;
    const modifiers = item.system.difficulty ? [{ label: game.i18n.localize("BRIG.Difficulty.label"), value: item.system.difficulty }] : [];

    // Au-delà de VOL/2 Actes par jour : malus de -20 % (RAW 40K).
    const perDay = this.system.faith?.actsPerDay ?? 0;
    const used = this.system.dailyUse?.faith ?? 0;
    if (used >= perDay) modifiers.push({ label: game.i18n.localize("BRIG.Faith.overLimit"), value: -20 });

    const test = await this._performTest({
      label: item.name,
      flavor: `${game.i18n.localize("BRIG.Char.vol.long")} · ${item.name}`,
      characteristic: "vol",
      base: char?.total ?? 0,
      modifiers,
      itemUuid: item.uuid,
      rollType: "faith",
      damage: item.system.damage ? { raw: item.system.damage, type: item.system.damageType, volBonus: char?.bonus ?? 0 } : null
    }, options);
    if (test) await this.update({ "system.dailyUse.faith": used + 1 });
    return test;
  }

  /** Coeur commun : ouvre le dialogue (sauf raccourci) puis lance le test. */
  async _performTest(testData, { skipDialog = false, event } = {}) {
    const fastKey = event?.shiftKey || event?.ctrlKey;
    let dialogResult = { difficulty: 0, situational: 0, advantage: 0, disadvantage: 0, tactic: "" };
    if (!skipDialog && !fastKey) {
      dialogResult = await promptTest({ actor: this, testData });
      if (dialogResult === null) return null;     // annulé
    }
    const modifiers = [...(testData.modifiers || [])];
    if (dialogResult.difficulty) modifiers.push({ label: game.i18n.localize("BRIG.Difficulty.label"), value: dialogResult.difficulty });
    if (dialogResult.situational) modifiers.push({ label: game.i18n.localize("BRIG.Test.situational"), value: dialogResult.situational });

    let advantage = (testData.advantage || 0) + (dialogResult.advantage || 0);
    let disadvantage = (testData.disadvantage || 0) + (dialogResult.disadvantage || 0);
    const damage = testData.damage ? { ...testData.damage } : null;

    // Tactique de combat : ajuste Avantage/Désavantage, modificateur et règle de dégâts.
    const tactic = dialogResult.tactic && BRIGANDYNE.combatTactics[dialogResult.tactic];
    if (tactic) {
      advantage += tactic.adv || 0;
      disadvantage += tactic.dis || 0;
      if (tactic.malus) modifiers.push({ label: game.i18n.localize(tactic.label), value: tactic.malus });
      if (damage) damage.tactic = dialogResult.tactic;
    }

    const test = new BrigTest({
      ...testData, damage,
      actorUuid: this.uuid,
      modifiers, advantage, disadvantage
    });
    await test.toMessage();
    return test;
  }

  /* -------------------------------------------- */
  /*  Application des dégâts / ressources          */
  /* -------------------------------------------- */

  /** Applique des dégâts en tenant compte de la protection.
   * @param {object} opts
   * @param {boolean} opts.ignoreArmor   ignore totalement l'armure
   * @param {number}  opts.ap            perce-armure (réduit la protection)
   * @param {boolean} opts.halveArmor    armure divisée par deux (armes à feu, RAW)
   * @param {number}  opts.minDamage     plancher de dégâts si l'attaque blesse (RAW : 1)
   * @param {boolean} opts.vehicleScale  l'arme est à échelle véhicule (perce les blindages résistants)
   */
  async applyDamage(amount, { ignoreArmor = false, ap = 0, halveArmor = false, minDamage = 0, vehicleScale = false } = {}) {
    // Résistance des véhicules : immunisés aux armes à échelle humaine (RAW 40K).
    if (this.type === "vehicle" && this.system.resistance && !vehicleScale && !ignoreArmor) {
      ui.notifications?.info(game.i18n.localize("BRIG.Vehicle.resisted"));
      return 0;
    }
    let prot = ignoreArmor ? 0 : (this.system.protection?.value ?? 0);
    if (!ignoreArmor && halveArmor) prot = Math.floor(prot / 2);
    if (!ignoreArmor) prot = Math.max(0, prot - ap);

    let dmg = Math.max(0, amount - prot);
    if (minDamage && amount > 0) dmg = Math.max(minDamage, dmg);   // dégâts minimums sur une blessure
    const pv = this.system.pv;
    if (!pv) return;
    const newVal = Math.max(0, pv.value - dmg);
    const wasUp = pv.value > 0;
    await this.update({ "system.pv.value": newVal });
    if (wasUp && newVal === 0 && this.type !== "vehicle") await this.drawCriticalInjury();
    return dmg;
  }

  /** Tire une blessure grave du compendium (déclenché à 0 PV). */
  async drawCriticalInjury() {
    const pack = game.packs.get("brigandyne-40k.critical-injuries");
    if (!pack) return;
    await pack.getIndex();
    const list = pack.index.contents;
    if (!list.length) return;
    const pick = list[Math.floor(Math.random() * list.length)];
    const doc = await pack.getDocument(pick._id);
    const content = await renderTemplate("systems/brigandyne-40k/templates/chat/critical-card.hbs", {
      actorName: this.name, name: doc.name, location: doc.system.location, effect: doc.system.effect
    });
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this }), content });
  }

  /** Nombre de cases de progression accessibles pour `key` selon la carrière. */
  careerProfile(key) {
    const career = this.items.find(i => i.type === "career");
    return career?.system?.advances?.[key] ?? 0;
  }

  /** Améliore une caractéristique de +5% en dépensant de l'XP.
   *  Respecte le profil de progression de la carrière : au-delà des cases prévues,
   *  l'augmentation est « hors-profil » (+50 PX). Plafond : 6 cases (+30, RAW). */
  async advanceCharacteristic(key) {
    const c = this.system.characteristics?.[key];
    if (!c || !this.system.xp) return;
    const advances = c.advances ?? 0;
    const charLabel = game.i18n.localize(BRIGANDYNE.characteristics[key].abbrev);
    if (advances >= BRIGANDYNE.advancement.maxBoxes) {
      return ui.notifications?.warn(game.i18n.format("BRIG.Warn.maxAdvance", { char: charLabel }));
    }
    const step = BRIGANDYNE.advancement.charStep;
    const newValue = Math.min(100, c.value + step);
    if (newValue === c.value) return;
    const offProfile = advances >= this.careerProfile(key);
    let cost = BRIGANDYNE.charAdvanceCost(newValue);
    if (offProfile) cost += BRIGANDYNE.advancement.charOffProfileExtra ?? 0;
    if ((this.system.xp.available ?? 0) < cost) {
      return ui.notifications?.warn(game.i18n.format("BRIG.Warn.noXp", { cost }));
    }
    await this.update({
      [`system.characteristics.${key}.value`]: newValue,
      [`system.characteristics.${key}.advances`]: advances + 1,
      "system.xp.spent": (this.system.xp.spent ?? 0) + cost
    });
    ui.notifications?.info(game.i18n.format(offProfile ? "BRIG.Info.advancedOff" : "BRIG.Info.advanced", { char: charLabel, cost }));
  }

  /** Annule la dernière amélioration d'une caractéristique (rembourse l'XP). */
  async refundCharacteristic(key) {
    const c = this.system.characteristics?.[key];
    if (!c || !this.system.xp || (c.advances ?? 0) <= 0) return;
    const advances = c.advances ?? 0;
    const step = BRIGANDYNE.advancement.charStep;
    const wasOffProfile = (advances - 1) >= this.careerProfile(key);   // la case retirée était-elle hors-profil ?
    let refund = BRIGANDYNE.charAdvanceCost(c.value);                  // coût payé pour atteindre la valeur actuelle
    if (wasOffProfile) refund += BRIGANDYNE.advancement.charOffProfileExtra ?? 0;
    await this.update({
      [`system.characteristics.${key}.value`]: Math.max(0, c.value - step),
      [`system.characteristics.${key}.advances`]: advances - 1,
      "system.xp.spent": Math.max(0, (this.system.xp.spent ?? 0) - refund)
    });
  }

  /** Apprend une spécialité ou un talent depuis le compendium, contre de l'XP.
   *  Hors profil de carrière : +50 PX (RAW p.150). */
  async learnAtout(kind) {
    if (!this.system.xp) return;
    const isTalent = kind === "talent";
    const packKey = isTalent ? "brigandyne-40k.talents" : "brigandyne-40k.specialties";
    const baseCost = isTalent ? BRIGANDYNE.advancement.talentCost : BRIGANDYNE.advancement.specialtyCost;
    const offExtra = BRIGANDYNE.advancement.atoutOffCareerExtra ?? 50;   // +50 PX hors-carrière
    const pack = game.packs.get(packKey);
    if (!pack) return ui.notifications?.warn("Compendium introuvable.");
    await pack.getIndex();

    // Liste des atouts proposés par la carrière (pour distinguer carrière / hors-carrière).
    const career = this.items.find(i => i.type === "career");
    const careerList = new Set((isTalent ? career?.system?.talents : career?.system?.specialties) ?? []);

    const options = pack.index.contents.sort((a, b) => a.name.localeCompare(b.name))
      .map(e => `<option value="${e._id}">${careerList.has(e.name) ? "★ " : ""}${e.name}</option>`).join("");
    const content = `<form class="brigandyne-40k">
      <p>Coût : <strong>${baseCost} XP</strong> (carrière) · <strong>${baseCost + offExtra} XP</strong> (hors-carrière, ★ = de carrière)<br>
      Disponible : <strong>${this.system.xp.available} XP</strong></p>
      <div class="form-group"><label>${isTalent ? "Talent" : "Spécialité"}</label>
      <select name="pick">${options}</select></div></form>`;
    const id = await foundry.applications.api.DialogV2.prompt({
      window: { title: isTalent ? "Apprendre un talent" : "Apprendre une spécialité", icon: "fa-solid fa-graduation-cap" },
      content, ok: { label: "Apprendre", callback: (ev, btn) => btn.form.pick.value }, rejectClose: false
    }).catch(() => null);
    if (!id) return;
    const doc = await pack.getDocument(id);
    const cost = baseCost + (careerList.has(doc.name) ? 0 : offExtra);
    if ((this.system.xp.available ?? 0) < cost) return ui.notifications?.warn(game.i18n.format("BRIG.Warn.noXp", { cost }));
    await this.createEmbeddedDocuments("Item", [doc.toObject()]);
    await this.update({ "system.xp.spent": (this.system.xp.spent ?? 0) + cost });
    ui.notifications?.info(game.i18n.format("BRIG.Info.learned", { name: doc.name, cost }));
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

  /** Dépense des points de Sang-froid (relances, etc.). */
  async spendSangFroid(amount = 0) {
    const sf = this.system.sf;
    if (!sf || sf.value < amount) {
      ui.notifications?.warn(game.i18n.format("BRIG.Warn.noSf", { cost: amount }));
      return false;
    }
    await this.update({ "system.sf.value": sf.value - amount });
    return true;
  }

  /** Taux de régénération PV/SF par nuit selon le niveau de vie. */
  _restRates() {
    const ls = BRIGANDYNE.lifestyles[this.system.lifestyle] ?? BRIGANDYNE.lifestyles.ordinaire;
    const parse = s => {
      const m = /^(\d+)\/(\d*)(j|sem)$/.exec(s ?? "");
      if (!m) return 0;
      const n = Number(m[1]);
      if (m[3] === "sem") return n / 7;
      return n / (Number(m[2]) || 1);     // "1/j" → 1 ; "1/2j" → 0.5
    };
    return { pv: parse(ls.pv), sf: parse(ls.sf) };
  }

  /** Repos de N nuits : régénère PV/SF selon le niveau de vie et réinitialise les usages du jour. */
  async rest(nights = 1) {
    const r = this._restRates();
    const pv = this.system.pv, sf = this.system.sf;
    const gainedPv = Math.floor(r.pv * nights);
    const gainedSf = Math.floor(r.sf * nights);
    await this.update({
      "system.pv.value": Math.min(pv.max, pv.value + gainedPv),
      "system.sf.value": Math.min(sf.max, sf.value + gainedSf),
      "system.dailyUse.powers": 0,
      "system.dailyUse.faith": 0
    });
    ui.notifications?.info(game.i18n.format("BRIG.Info.rested", { nights, pv: gainedPv, sf: gainedSf }));
  }

  /** Fin de scénario : une semaine de repos + Destin rechargé à son maximum. */
  async endScenario() {
    await this.rest(7);
    const d = this.system.destin;
    if (d) await this.update({ "system.destin.value": d.max });
    ui.notifications?.info(game.i18n.localize("BRIG.Info.scenarioEnd"));
  }

  /** Jet de salaire hebdomadaire selon le niveau de vie (Trônes Gelt). */
  async rollSalary() {
    const lsKey = this.system.lifestyle ?? "ordinaire";
    const ls = BRIGANDYNE.lifestyles[lsKey] ?? BRIGANDYNE.lifestyles.ordinaire;
    const test = new BrigTest({
      actorUuid: this.uuid,
      label: game.i18n.localize("BRIG.Salary.label"),
      flavor: game.i18n.localize(ls.label),
      characteristic: "soc", base: 50, rollType: "test"
    });
    await test.roll();
    await test.toMessage();
    const pay = ls.salary?.[test.result.degree] ?? 0;
    const newGelt = (this.system.wealth?.gelt ?? 0) + pay;
    await this.update({ "system.wealth.gelt": newGelt });
    const content = await renderTemplate("systems/brigandyne-40k/templates/chat/item-card.hbs", {
      item: { name: game.i18n.localize("BRIG.Salary.label"), img: "icons/commodities/currency/coins-stitched-pouch-brown.webp" },
      system: { effect: game.i18n.format("BRIG.Salary.earned", { amount: pay }) }
    });
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this }), content });
  }

  /** Test de résistance à la Corruption du Chaos (VOL ou FOR, au choix). */
  async rollCorruption({ god = "", source = "0", characteristic = "vol" } = {}) {
    const char = this.system.characteristics?.[characteristic] ?? this.system.characteristics?.vol;
    const modifiers = Number(source) ? [{ label: game.i18n.localize("BRIG.Corruption.source"), value: Number(source) }] : [];

    // Désavantage par niveau de Vice lié au dieu invoqué (RAW 40K).
    let viceLevels = 0;
    if (god && BRIGANDYNE.chaosGods[god]) {
      const godVices = new Set(BRIGANDYNE.chaosGods[god].vices);
      for (const it of this.items) {
        if (it.type === "trait" && it.system.traitType === "vice" && godVices.has(it.system.god)) {
          viceLevels += Math.max(0, it.system.rating ?? 0);
        }
      }
    }

    const test = await this._performTest({
      label: game.i18n.localize("BRIG.Corruption.test"),
      flavor: god ? game.i18n.localize(BRIGANDYNE.chaosGods[god].label) : "",
      characteristic, base: char?.total ?? 0,
      modifiers, disadvantage: viceLevels,
      rollType: "resist"
    });
    if (!test) return null;

    // Échec → perte de SF = Seuil d'instabilité ; E+ → +1.
    if (!test.result.success) {
      const tier = test.result.tier;          // -1 mineur, -2 majeur, -3 critique
      const loss = (this.system.corruption?.threshold ?? 0) + (tier <= -2 ? 1 : 0);
      const sf = this.system.sf;
      await this.update({ "system.sf.value": Math.max(0, sf.value - loss) });
      ui.notifications?.warn(game.i18n.format("BRIG.Corruption.lost", { loss }));
    }
    return test;
  }
}
