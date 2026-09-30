import { BRIGANDYNE } from "../config/config.ts";
import { BrigTest } from "../dice/roll.ts";
import { promptTest } from "../apps/test-dialog.ts";
import { postWarpResult } from "../data/warp-tables.ts";
import {
  summarizeGear, isSevereWound, resolveDamage, evenDamageEffect, scaleEffect, targetKind, armorToWear, aimMalus,
  defensiveAdvantages, fireModes, fireModeEffect, ammoCost, canFire, reloadOutcome, rangeDisadvantage, aimAdvantage,
  heavyDisadvantage, coverDisadvantage, qualityValue, isDouble
} from "../data/combat-rules.ts";
import {
  psyDailyLimits, psyOverflowCost, resistanceModifier, isAutomaticCast, parseResistanceKey, pariaDisadvantage,
  PARIA_WARP_BONUS, corruptionViceLevels, corruptionSfLoss, mutationKind, madnessSfLoss, madnessPermanentLoss, isMad,
  permanentDestinSpend, canChannelFaith, faithPrayerTurns, FAITH_OVERLIMIT_MALUS
} from "../data/warp-rules.ts";
import { augmentationStatus } from "../data/augmentations.ts";
import { SEQUELAE, sequelaFor } from "../data/sequelae.ts";

const { renderTemplate } = foundry.applications.handlebars;

const L = (key: string, data?: Record<string, any>) => data ? game.i18n.format(key, data) : game.i18n.localize(key);
const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Échappe un nom avant de l'insérer dans une carte de chat (titres et lignes en HTML brut). */
const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, c => HTML_ESCAPES[c]);

/**
 * Document Acteur du système.
 */
export class BrigActor extends Actor {

  /* -------------------------------------------- */
  /*  Préparation des données                     */
  /* -------------------------------------------- */
  prepareDerivedData() {
    const gear = summarizeGear(Array.from(this.items) as any);
    super.prepareDerivedData();   // déclenche system.prepareDerivedData() (calcule base+mod)
    // On finalise ici (après le modèle) pour garantir la prise en compte des armures.
    const augFx = this.system.augmentationFx;
    if (this.system.protection) {
      this.system.protection.fromArmor = gear.protection + (augFx?.protection ?? 0);
      this.system.protection.value = (this.system.protection.base ?? 0) + (this.system.protection.mod ?? 0) + this.system.protection.fromArmor;
    }
    if (this.system.initiative) this.system.initiative.value += gear.initMod;
    this.system._gear = gear;
    this._prepareEncumbrance();
    this._prepareAugmentations();
  }

  _prepareEncumbrance() {
    let total = 0;
    for (const item of this.items) {
      const w = item.system?.totalWeight ?? ((item.system?.weight ?? 0) * (item.system?.quantity ?? 1));
      total += w || 0;
    }
    this.system.encumbrance = { value: Math.round(total * 10) / 10 };
  }

  /** « Un personnage ne peut recevoir que *VOL* augmentations » (40K) : compteur affiché sur la fiche. */
  _prepareAugmentations() {
    const c = this.system.characteristics;
    if (!c?.vol) return;
    const augs = Array.from(this.items).filter((i: any) => i.type === "augmentation");
    this.system.augmentations = augmentationStatus(c.vol.bonus, augs as any);
  }

  getRollData() {
    const data = { ...super.getRollData() };
    if (this.system.characteristics) {
      for (const [k, c] of Object.entries(this.system.characteristics) as Array<[string, any]>) {
        data[k] = c.total;
        data[`${k}b`] = c.bonus;
      }
    }
    data.initiative = this.system.initiative?.value ?? 0;
    return data;
  }

  /** Porte le gène du Paria (« Gêne du Paria », 40K) ? */
  hasGeneParia(): boolean {
    return /paria/i.test(this.system?.speciesName ?? "") || /paria/i.test(this.system?.species ?? "")
      || Array.from(this.items).some((i: any) => i.type === "species" && i.system?.special?.includes?.("geneParia"));
  }

  /** Distance (unités de la scène, ici des mètres) entre un de nos jetons et un autre jeton, ou null. */
  _distanceTo(otherToken): number | null {
    try {
      const mine = this.getActiveTokens?.()?.[0] ?? canvas?.tokens?.controlled?.find(t => t.actor === this);
      if (!mine || !otherToken || !canvas?.grid) return null;
      const d = canvas.grid.measurePath([mine.center, otherToken.center])?.distance;
      return Number.isFinite(d) ? d : null;
    } catch { return null; }
  }

  /** Nombre de Parias à portée « Moyenne » sur la scène active (Gêne du Paria : un Psyker proche subit 1 Désavantage). */
  _nearbyParias(): number {
    let n = 0;
    for (const t of canvas?.tokens?.placeables ?? []) {
      if (!t.actor || t.actor === this || !t.actor.hasGeneParia?.()) continue;
      const d = this._distanceTo(t);
      if (d != null && d <= BRIGANDYNE.mechanics.pariaRange) n++;
    }
    return n;
  }

  /** Modificateurs automatiques d'un test de caractéristique : armure, casque, Décupleur, augmentations. */
  _characteristicTestMods(charKey: string): Array<{ label: string; value: number }> {
    const mods: Array<{ label: string; value: number }> = [];
    const gear = this.system._gear;
    if (gear) {
      if (charKey === "mou" && gear.mouMod) mods.push({ label: L("BRIG.Mod.armor"), value: gear.mouMod });
      if (charKey === "per" && gear.perMod) mods.push({ label: L("BRIG.Mod.helmet"), value: gear.perMod });
      if ((charKey === "for" || charKey === "end") && gear.decupleur) mods.push({ label: L("BRIG.Mod.decupleur"), value: 10 });
    }
    const aug = this.system.augmentationFx?.tests?.[charKey];
    if (aug) mods.push({ label: L("BRIG.Mod.augmentation"), value: aug });
    return mods;
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
      modifiers: this._characteristicTestMods(charKey),
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
      modifiers: [{ label: item.name, value: item.system.bonus ?? 0 }, ...this._characteristicTestMods(charKey)],
      itemUuid: item.uuid,
      rollType: "test"
    }, options);
  }

  /** Attaque avec une arme. */
  async rollWeaponAttack(item, options: Record<string, any> = {}) {
    if (item.type !== "weapon") return;
    const s = item.system;
    const charKey = s.rollChar;
    const char = this.system.characteristics?.[charKey];
    const modifiers: Array<{ label: string; value: number }> = [];
    let advantage = 0, disadvantage = 0;

    if (s.hasQuality?.("precis")) advantage += 1;
    disadvantage += heavyDisadvantage(s.qualities, this.system.characteristics?.for?.total ?? 0);

    // Cible ciblée : MODO (mêlée), Couvert et portée (tir)
    const targetToken = Array.from(game.user.targets)[0] as any;
    const target = targetToken?.actor;
    if (target && s.isMelee && target.system?.characteristics?.com) {
      const modo = BRIGANDYNE.mechanics.modoCenter - target.system.characteristics.com.total;
      modifiers.push({ label: `MODO (${target.name})`, value: modo });
    }
    if (target && s.isRanged) {
      disadvantage += coverDisadvantage(target.system?._gear?.cover ?? 0, s.qualities);
      disadvantage += rangeDisadvantage(this._distanceTo(targetToken), s.range);
    }

    const testData = {
      label: item.name,
      flavor: `${game.i18n.localize(BRIGANDYNE.characteristics[charKey].label)} · ${item.name}`,
      characteristic: charKey,
      base: char?.total ?? 0,
      modifiers,
      advantage, disadvantage,
      itemUuid: item.uuid,
      rollType: "attack",
      tactics: true,                         // propose les tactiques de combat dans le dialogue
      fireModes: s.isRanged ? fireModes(s.qualities) : [],
      canAim: !!s.isRanged,
      damage: {
        base: s.damageBase,
        mod: s.damageMod,
        type: s.damageType,
        forBonus: this.system.characteristics?.for?.bonus ?? 0,
        isMelee: !!s.isMelee,
        weaponUuid: item.uuid
      },
      targetActorUuid: target?.uuid ?? null
    };

    const cfg = await this._configureTest(testData, options);
    if (!cfg) return null;

    // Mode de tir, visée et chargeur (40K, Armes à distance)
    if (s.isRanged) {
      const mode = cfg.dialog.fireMode || "single";
      const fx = fireModeEffect(mode);
      cfg.disadvantage += fx.disadvantage;
      cfg.damage.fireMode = mode;
      if (cfg.dialog.aimed) cfg.advantage += aimAdvantage(s.hasQuality?.("viseur"));
      // Le suivi des munitions ne concerne que les personnages (les PNJ tirent sans compter).
      if (this.type === "character" && s.magazine > 0) {
        if (!canFire(mode, s.magazine, s.currentAmmo)) {
          ui.notifications?.warn(L("BRIG.Warn.emptyMagazine", { name: item.name }));
          return null;
        }
        const cost = ammoCost(mode, s.magazine, s.currentAmmo);
        await item.update({ "system.currentAmmo": s.currentAmmo - cost });
      }
    }

    const test = await this._runTest(cfg);

    // Arme Risquée : sur un doublé, le porteur encaisse son *FOR* en dégâts (p.183)
    if (s.isMelee && s.hasQuality?.("risquee") && test.result && isDouble(test.result.total)) {
      const self = this.system.characteristics?.for?.bonus ?? 0;
      const dealt = await this.applyDamage(self, { minDamage: 1 });
      await this._notice({ icon: "fa-triangle-exclamation", peril: true, title: L("BRIG.Weapon.riskyTitle", { name: esc(item.name) }),
        lines: [L("BRIG.Weapon.riskyLine", { name: esc(this.name), dmg: dealt ?? self })] });
    }
    return test;
  }

  /** Recharge une arme à distance (40K, Chargeurs). */
  async reloadWeapon(item) {
    const s = item.system;
    if (item.type !== "weapon" || !(s.magazine > 0)) return;
    const inCombat = !!game.combat?.started;
    const { loaded, lost } = reloadOutcome(s.currentAmmo, s.magazine, inCombat);
    await item.update({ "system.currentAmmo": loaded });
    const turns = Number(qualityValue(s.qualities, "chargement")) || 1;
    await this._notice({
      icon: "fa-rotate", title: L("BRIG.Weapon.reloadTitle", { name: esc(this.name) }),
      lines: [
        L("BRIG.Weapon.reloadLine", { weapon: esc(item.name), loaded, magazine: s.magazine, turns }),
        ...(lost ? [L("BRIG.Weapon.reloadLost", { lost })] : [])
      ]
    });
  }

  /** Manifester un pouvoir psychique (test de PSY). */
  async rollPower(item, options: Record<string, any> = {}) {
    if (item.type !== "psychicPower") return;
    const s = item.system;
    const isMinor = !!s.isMinor;
    const char = this.system.characteristics?.psy;
    const limits = this.system.psy?.limits ?? psyDailyLimits(char?.bonus ?? 0);
    const usedKey = isMinor ? "minors" : "powers";
    const used = this.system.dailyUse?.[usedKey] ?? 0;
    const overflow = used >= (isMinor ? limits.minor : limits.power);

    // Gêne du Paria : 1 Désavantage à tout Psyker proche d'un Paria (40K)
    const parias = this._nearbyParias();
    const pariaDis = pariaDisadvantage(parias);

    // Difficulté du pouvoir, ou MODO de la cible si plus difficile (p.213)
    let difficulty = s.difficulty ?? 0;
    const resKey = parseResistanceKey(s.resistance);
    const targets = Array.from(game.user.targets).map((t: any) => t.actor).filter(a => a?.system?.characteristics);
    if (resKey && targets.length) {
      const scores = targets.map(a => a.system.characteristics[resKey]?.total).filter(n => n != null);
      difficulty = resistanceModifier(difficulty, scores, BRIGANDYNE.mechanics.modoCenter);
    }
    const modifiers = difficulty ? [{ label: L("BRIG.Difficulty.label"), value: difficulty }] : [];

    let test: any = null;
    if (isAutomaticCast(isMinor) && !pariaDis && !options.forceTest) {
      // Pouvoir mineur = tour de magie : aucun test (p.208)
      await this._notice({ icon: "fa-hand-sparkles", title: esc(item.name), lines: [L("BRIG.Power.minorAuto"), s.effect].filter(Boolean) });
    } else {
      test = await this._performTest({
        label: item.name,
        flavor: `${game.i18n.localize("BRIG.Char.psy.long")} · ${item.name}`,
        characteristic: "psy",
        base: char?.total ?? 0,
        modifiers,
        disadvantage: pariaDis,
        itemUuid: item.uuid,
        rollType: "power",
        damage: s.damage ? { raw: s.damage, type: s.damageType, psyBonus: char?.bonus ?? 0 } : null
      }, options);
      if (!test) return null;   // annulé
    }

    // Comptabilise l'usage ; dépasser la limite coûte des PV, que le pouvoir réussisse ou non (p.209)
    const updates: Record<string, any> = { [`system.dailyUse.${usedKey}`]: used + 1 };
    if (overflow) {
      const cost = psyOverflowCost(isMinor);
      updates["system.pv.value"] = Math.max(0, (this.system.pv?.value ?? 0) - cost);
      ui.notifications?.warn(game.i18n.format("BRIG.Warn.psyOverflow", { cost }));
    }
    await this.update(updates);

    if (test?.result) {
      // Échec majeur → Phénomène psychique (complication mineure) ; échec critique → Péril du Warp (majeure) + 1 SF perdu (p.212)
      if (test.result.degree === "critFailure") {
        await postWarpResult(this, "peril");
        await this.loseSangFroid(1, { source: "warp" });
      } else if (test.result.degree === "majorFailure") await postWarpResult(this, "phenomenon");
    }
    return test;
  }

  /** « Forcer le Warp » : le pouvoir fonctionne quand même, au prix d'une complication (1×/jour, p.211-213). */
  async forceWarp(kind: "phenomenon" | "peril") {
    if (this.system.dailyUse?.forced) {
      ui.notifications?.warn(L("BRIG.Power.forcedUsed"));
      return false;
    }
    await this.update({ "system.dailyUse.forced": true });
    await postWarpResult(this, kind);
    return true;
  }

  /** Manifester un Acte de Foi (test de VOL). */
  async rollFaith(item, options = {}) {
    if (item.type !== "faithAct") return;
    const traits = Array.from(this.items).filter((i: any) => i.type === "trait");
    if (this.type === "character" && !(this.system.faith?.devoted || canChannelFaith(traits as any))) {
      ui.notifications?.warn(L("BRIG.Faith.notEligible", { name: this.name }));
      return null;
    }
    const char = this.system.characteristics?.vol;
    const modifiers = item.system.difficulty ? [{ label: game.i18n.localize("BRIG.Difficulty.label"), value: item.system.difficulty }] : [];

    // Au-delà de VOL/2 Actes par jour : malus de −20 % (40K)
    const perDay = this.system.faith?.actsPerDay ?? 0;
    const used = this.system.dailyUse?.faith ?? 0;
    if (used >= perDay) modifiers.push({ label: game.i18n.localize("BRIG.Faith.overLimit"), value: FAITH_OVERLIMIT_MALUS });

    const turns = faithPrayerTurns(!!item.system.isMiracle);
    const test = await this._performTest({
      label: item.name,
      flavor: `${game.i18n.localize("BRIG.Char.vol.long")} · ${item.name} — ${L("BRIG.Faith.prayer", { turns })}`,
      characteristic: "vol",
      base: char?.total ?? 0,
      modifiers,
      itemUuid: item.uuid,
      rollType: "faith",
      damage: item.system.damage ? { raw: item.system.damage, type: item.system.damageType, volBonus: char?.bonus ?? 0 } : null
    }, options);
    if (!test) return null;
    await this.update({ "system.dailyUse.faith": used + 1 });
    // E+ : l'Empereur-Dieu devient sourd aux prières pendant RU heures (40K)
    if (!test.result.success && test.result.tier <= -2) {
      await this._notice({ icon: "fa-ear-deaf", peril: true, title: L("BRIG.Faith.deafTitle", { name: esc(this.name) }),
        lines: [L("BRIG.Faith.deafLine", { hours: test.result.ru })] });
    }
    return test;
  }

  /**
   * Configure un test : ouvre le dialogue (sauf raccourci) et fusionne ses choix.
   * Renvoie null si annulé.
   */
  async _configureTest(testData: any, { skipDialog = false, event, dialog }: { skipDialog?: boolean; event?: any; dialog?: Record<string, any> } = {}) {
    const fastKey = event?.shiftKey || event?.ctrlKey;
    let dialogResult: Record<string, any> | null = { difficulty: 0, situational: 0, advantage: 0, disadvantage: 0, tactic: "", spendSf: false, fireMode: "", aimed: false, ...(dialog ?? {}) };
    if (!skipDialog && !fastKey && !dialog) {
      dialogResult = await promptTest({ actor: this, testData });
      if (dialogResult === null) return null;     // annulé
    }
    const modifiers = [...(testData.modifiers || [])];
    if (dialogResult.difficulty) modifiers.push({ label: game.i18n.localize("BRIG.Difficulty.label"), value: dialogResult.difficulty });
    if (dialogResult.situational) modifiers.push({ label: game.i18n.localize("BRIG.Test.situational"), value: dialogResult.situational });

    let advantage = (testData.advantage || 0) + (dialogResult.advantage || 0);
    let disadvantage = (testData.disadvantage || 0) + (dialogResult.disadvantage || 0);
    const damage = testData.damage ? { ...testData.damage } : null;

    // Bon stress : 2 SF = 1 Avantage avant le test (p.142) — une seule fois
    if (dialogResult.spendSf) {
      if (await this.spendSangFroid(BRIGANDYNE.mechanics.sfForAdvantage)) advantage += 1;
    }

    // Tactique de combat : ajuste Avantage/Désavantage, modificateur et règle de dégâts (p.180).
    const tactic = dialogResult.tactic && BRIGANDYNE.combatTactics[dialogResult.tactic];
    if (tactic) {
      advantage += tactic.adv || 0;
      disadvantage += tactic.dis || 0;
      if (dialogResult.tactic === "surLaDefensive" && this.system._gear?.cover > 0) advantage += defensiveAdvantages(true) - defensiveAdvantages(false);
      let malus = tactic.malus || 0;
      if (dialogResult.tactic === "viser" && testData.targetActorUuid) {
        const target = await fromUuid(testData.targetActorUuid);
        const armors = Array.from(target?.items ?? []).filter((i: any) => i.type === "armor")
          .map((i: any) => ({ coverage: i.system.coverage, equipped: i.system.equipped }));
        malus = aimMalus(armors) || malus;
      }
      if (malus) modifiers.push({ label: game.i18n.localize(tactic.label), value: malus });
      if (damage) damage.tactic = dialogResult.tactic;
    }

    return { testData, dialog: dialogResult, modifiers, advantage, disadvantage, damage };
  }

  /** Lance et poste un test préparé par `_configureTest`. */
  async _runTest(cfg: any) {
    const test = new BrigTest({
      ...cfg.testData, damage: cfg.damage,
      actorUuid: this.uuid,
      modifiers: cfg.modifiers, advantage: cfg.advantage, disadvantage: cfg.disadvantage
    });
    await test.toMessage();
    return test;
  }

  /** Coeur commun : ouvre le dialogue (sauf raccourci) puis lance le test. */
  async _performTest(testData: any, options: { skipDialog?: boolean; event?: any; dialog?: Record<string, any> } = {}) {
    const cfg = await this._configureTest(testData, options);
    if (!cfg) return null;
    return this._runTest(cfg);
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
   * @param {object}  opts.weapon        { scale, family } de l'arme (échelle humaine/véhicule/vaisseau, 40K)
   * @param {string}  opts.damageType    type de dégâts (effet des totaux pairs, p.135)
   * @param {number}  opts.armorWear     points d'armure détruits (Destruction, acide)
   */
  async applyDamage(amount, opts: Record<string, any> = {}) {
    const { ignoreArmor = false, ap = 0, halveArmor = false, minDamage = 0, weapon = null, damageType = "physique", armorWear = 0 } = opts;
    const pv = this.system.pv;
    if (!pv) return;

    // Échelle : Résistance des véhicules (÷2), vaisseaux immunisés, armes de véhicule ×2 sur cibles humaines (40K)
    const kind = targetKind(this.type, this.system.vehicleType);
    const eff = this.type === "vehicle" && this.system.resistance === false
      ? { immune: false, halve: false, double: false }          // résistance désactivée sur la fiche : dégâts normaux
      : scaleEffect(weapon?.scale ?? "human", weapon?.family ?? "other", kind);
    if (eff.immune) {
      ui.notifications?.info(game.i18n.localize("BRIG.Vehicle.resisted"));
      return 0;
    }

    const { applied } = resolveDamage({
      amount: eff.double ? amount * 2 : amount,
      protection: this.system.protection?.value ?? 0,
      ignoreArmor, ap, halveArmor, minDamage, halveDamage: eff.halve
    });
    const newVal = Math.max(0, pv.value - applied);
    const wasUp = pv.value > 0;
    await this.update({ "system.pv.value": newVal });

    if (armorWear > 0) await this._wearArmor(armorWear);
    const evenEffects = Object.fromEntries(Object.entries(BRIGANDYNE.damageTypes).map(([k, d]: [string, any]) => [k, d.evenEffect]));
    const status = evenDamageEffect(damageType, amount, evenEffects);
    if (status) await this._setStatus(status);

    if (this.type !== "vehicle") {
      // Blessure grave : une seule passe d'armes ≥ moitié des PV → séquelle (premiers rôles, p.196)
      if (this.system.role === "premierRole" && isSevereWound(applied, this.system.pv.max)) await this.drawSequela();
      if (wasUp && newVal === 0) await this._postDefeat();
    }
    return applied;
  }

  /** Active un état (Enflammé, Sonné…) sans casser le calcul de dégâts si l'API diffère. */
  async _setStatus(statusId: string) {
    try { await this.toggleStatusEffect(statusId, { active: true }); } catch (e) { console.warn("brigandyne-40k | statut", statusId, e); }
  }

  /** Détruit des points de protection : la meilleure armure de corps équipée (Destruction, acide). */
  async _wearArmor(points = 1) {
    const armors = Array.from(this.items).filter((i: any) => i.type === "armor")
      .map((i: any) => ({ item: i, protection: i.system.protection ?? 0, coverage: i.system.coverage, equipped: !!i.system.equipped }));
    const pick = armorToWear(armors);
    if (!pick) return;
    const value = Math.max(0, pick.protection - points);
    await pick.item.update({ "system.protection": value });
    ui.notifications?.info(L("BRIG.Warn.armorWorn", { name: pick.item.name, value }));
  }

  /** Carte d'information générique. */
  async _notice({ icon = "fa-circle-info", title = "", lines = [], peril = false, flags = null, buttons = [] }: Record<string, any>) {
    const content = await renderTemplate("systems/brigandyne-40k/templates/chat/notice-card.hbs", { icon, title, lines, peril, buttons });
    const data: Record<string, any> = { speaker: ChatMessage.getSpeaker({ actor: this }), content };
    if (flags) data.flags = { "brigandyne-40k": flags };
    return ChatMessage.create(data);
  }

  /* -------------------------------------------- */
  /*  Blessures graves, défaite, Destin, folie     */
  /* -------------------------------------------- */

  /** Tire une séquelle (d100, p.197) après une blessure grave ; l'effet s'applique via le bouton de la carte. */
  async drawSequela() {
    const r = await new Roll("1d100").evaluate();
    const s = sequelaFor(r.total);
    const armorHit = isDouble(r.total);      // doublé sur les dés : l'armure est abîmée (−1 de Protection, p.196)
    const needsChoice = s.penalties.some(p => p.chars.length > 1);
    const content = await renderTemplate("systems/brigandyne-40k/templates/chat/sequela-card.hbs", {
      actorName: this.name, roll: r.total, name: s.name, location: s.location, effect: s.effect, armorHit, needsChoice
    });
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }), content, rolls: [r], sound: CONFIG.sounds.dice,
      flags: { "brigandyne-40k": { sequela: { actorUuid: this.uuid, index: SEQUELAE.indexOf(s), armorHit } } }
    });
  }

  /** Applique une séquelle : pertes de compétence/PV définitives, trace sur la fiche, armure abîmée. */
  async applySequela(index: number, choices: string[] = [], armorHit = false) {
    const s = SEQUELAE[index];
    if (!s) return;
    const updates: Record<string, any> = {};
    s.penalties.forEach((p, i) => {
      const key = p.chars.length > 1 && p.chars.includes(choices[i]) ? choices[i] : p.chars[0];
      const cur = this.system.characteristics?.[key]?.value ?? 0;
      updates[`system.characteristics.${key}.value`] = Math.max(0, cur + p.value);
    });
    if (s.pvLost) updates["system.pv.lost"] = (this.system.pv?.lost ?? 0) + s.pvLost;
    if (Object.keys(updates).length) await this.update(updates);
    const pad = (n: number) => String(n).padStart(2, "0");
    await this.createEmbeddedDocuments("Item", [{
      name: s.name, type: "criticalInjury",
      system: { roll: `${pad(s.min)}-${s.max === 100 ? "00" : pad(s.max)}`, location: s.location, severity: 1, effect: `<p>${s.effect}</p>`, description: `<p>${s.effect}</p>` }
    }]);
    if (armorHit) await this._wearArmor(1);
  }

  /** 0 PV : vaincu et hors-jeu ; le MJ tranche (p.167). */
  async _postDefeat() {
    const endBonus = this.system.characteristics?.end?.bonus ?? 0;
    await this._notice({
      icon: "fa-skull", peril: true, title: L("BRIG.Defeat.title", { name: esc(this.name) }),
      lines: [L("BRIG.Defeat.dying", { rounds: endBonus }), L("BRIG.Defeat.other"), L("BRIG.Defeat.destin")]
    });
  }

  /**
   * Éviter la mort en dépensant DÉFINITIVEMENT 1 point de Destin (p.147) : le
   * personnage agonise à 1 PV et ne peut plus agir jusqu'à la prochaine scène.
   */
  async spendDestinPermanent() {
    const d = this.system.destin;
    const r = permanentDestinSpend(d?.value ?? 0, d?.max ?? 0);
    if (!r.ok) {
      ui.notifications?.warn(L("BRIG.Warn.noDestinSurvive"));
      return false;
    }
    await this.update({ "system.destin.value": r.value, "system.destin.max": r.max, "system.pv.value": 1 });
    await this._notice({ icon: "fa-star", title: L("BRIG.Destin.survivedTitle", { name: esc(this.name) }), lines: [L("BRIG.Destin.survivedLine", { max: r.max })] });
    return true;
  }

  /** Perd du Sang-froid ; tomber à 0 déclenche une crise de folie (p.174). */
  async loseSangFroid(amount = 0, { source = "" }: { source?: string } = {}) {
    const sf = this.system.sf;
    if (!sf || amount <= 0) return;
    const before = sf.value;
    const after = Math.max(0, before - amount);
    await this.update({ "system.sf.value": after });
    if (before > 0 && after === 0) await this._onSfDepleted(source);
  }

  /** SF à 0 : crise de folie ; si la Corruption en est la cause, le joueur peut y substituer une mutation (40K). */
  async _onSfDepleted(source = "") {
    if (source === "corruption") {
      const DialogV2 = foundry.applications.api.DialogV2;
      const choice = await DialogV2.wait({
        window: { title: L("BRIG.Corruption.depletedTitle"), icon: "fa-solid fa-skull" },
        content: `<p>${L("BRIG.Corruption.depleted")}</p>`,
        buttons: [
          { action: "madness", label: L("BRIG.Corruption.madness"), default: true },
          { action: "mutation", label: L("BRIG.Corruption.mutation") }
        ],
        rejectClose: false
      }).catch(() => "madness");
      if (choice === "mutation") {
        const r = await new Roll("1d10").evaluate();
        const kind = mutationKind(r.total);
        await this._notice({
          icon: "fa-dna", peril: true, title: L("BRIG.Corruption.mutationTitle", { name: esc(this.name) }),
          lines: [L("BRIG.Corruption.mutationLine", { roll: r.total, kind: L(kind === "grace" ? "BRIG.Corruption.grace" : "BRIG.Corruption.fardeau") })]
        });
        return;
      }
    }
    await this.madnessCrisis();
  }

  /** Crise de folie : perte définitive de SF égale à l'Instabilité (p.176). */
  async madnessCrisis() {
    const sf = this.system.sf;
    if (!sf) return;
    // L'Instabilité est le quart du SF de BASE d'origine (avant toute perte définitive) : 18 → 4 à chaque crise (p.176).
    const original = sf.base ?? (sf.max + (sf.lost ?? 0));
    const loss = madnessPermanentLoss(original);
    const limit = Math.max(0, sf.max - loss);
    if (loss > 0) await this.update({ "system.sf.lost": (sf.lost ?? 0) + loss });
    const lines = [L("BRIG.Madness.crisis", { loss, base: limit }), L("BRIG.Madness.control")];
    if (isMad(limit, loss)) lines.push(L("BRIG.Madness.mad"));
    await this._notice({ icon: "fa-brain", peril: true, title: L("BRIG.Madness.title", { name: esc(this.name) }), lines });
  }

  /** Test de Folie (VOL) : −2/−4/−6 SF selon l'échec (p.143). */
  async rollMadness(options = {}) {
    const vol = this.system.characteristics?.vol;
    if (!vol) return null;
    const test = await this._performTest({
      label: L("BRIG.Madness.test"), flavor: L("BRIG.Char.vol.long"),
      characteristic: "vol", base: vol.total, rollType: "resist"
    }, options);
    if (!test) return null;
    const loss = madnessSfLoss(test.result.tier);
    if (loss) {
      ui.notifications?.warn(L("BRIG.Madness.lost", { loss }));
      await this.loseSangFroid(loss, { source: "madness" });
    }
    return test;
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

  /** Dépense un point de Destin (coup de pouce, p.146). */
  async spendDestin() {
    const d = this.system.destin;
    if (!d || d.value <= 0) {
      ui.notifications?.warn(game.i18n.localize("BRIG.Warn.noDestin"));
      return false;
    }
    await this.update({ "system.destin.value": d.value - 1 });
    return true;
  }

  /** Dépense des points de Sang-froid (relances, Avantage…) ; tomber à 0 déclenche une crise de folie. */
  async spendSangFroid(amount = 0) {
    const sf = this.system.sf;
    if (!sf || sf.value < amount) {
      ui.notifications?.warn(game.i18n.format("BRIG.Warn.noSf", { cost: amount }));
      return false;
    }
    await this.loseSangFroid(amount, { source: "spend" });
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
      "system.dailyUse.minors": 0,
      "system.dailyUse.faith": 0,
      "system.dailyUse.forced": false
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
  async rollCorruption({ god = "", source = "0", characteristic = "vol" } = {}, options: Record<string, any> = {}) {
    const char = this.system.characteristics?.[characteristic] ?? this.system.characteristics?.vol;
    const modifiers: Array<{ label: string; value: number }> = Number(source)
      ? [{ label: game.i18n.localize("BRIG.Corruption.source"), value: Number(source) }] : [];
    // Gêne du Paria : +10 % pour résister aux effets du Warp (40K)
    if (this.hasGeneParia()) modifiers.push({ label: L("BRIG.Mod.paria"), value: PARIA_WARP_BONUS });

    // Désavantage par niveau de Vice lié au dieu invoqué (40K, Effets secondaires)
    const traits = Array.from(this.items).filter((i: any) => i.type === "trait");
    const viceLevels = god && BRIGANDYNE.chaosGods[god] ? corruptionViceLevels(BRIGANDYNE.chaosGods[god].vices, traits as any) : 0;

    const test = await this._performTest({
      label: game.i18n.localize("BRIG.Corruption.test"),
      flavor: god ? game.i18n.localize(BRIGANDYNE.chaosGods[god].label) : "",
      characteristic, base: char?.total ?? 0,
      modifiers, disadvantage: viceLevels,
      rollType: "resist"
    }, options);
    if (!test) return null;

    // Échec → perte de SF = Seuil d'instabilité ; E+ → +1.
    const loss = corruptionSfLoss(this.system.corruption?.threshold ?? 0, test.result.success ? 1 : test.result.tier);
    if (loss > 0) {
      ui.notifications?.warn(game.i18n.format("BRIG.Corruption.lost", { loss }));
      await this.loseSangFroid(loss, { source: "corruption" });
    }
    return test;
  }
}
