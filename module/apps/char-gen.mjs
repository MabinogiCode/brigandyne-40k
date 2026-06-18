import { BRIGANDYNE } from "../config/config.mjs";
import { CHARACTERISTIC_KEYS } from "../data/fields.mjs";
import { vitality, sangFroid, speciesResourceBonus } from "../data/derive.mjs";
import { SYSTEM_ID } from "../brigandyne40k.mjs";
import { BLANK_LOCK, getChargenLock, setChargenLock, requestUnlock } from "./chargen-lock.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DialogV2 } = foundry.applications.api;

const PACK = {
  species: "brigandyne-40k.species",
  careers: "brigandyne-40k.careers",
  specialties: "brigandyne-40k.specialties",
  talents: "brigandyne-40k.talents"
};
const DETAIL_KEYS = ["age", "height", "weight", "eyes", "hair", "gender", "homeworld", "motivation"];
const KEYS12 = CHARACTERISTIC_KEYS.filter(k => k !== "psy");
const POINTS_TOTAL = 120;

/**
 * Assistant (wizard) de création de personnage.
 * Étapes : Identité → Caractéristiques → Détails → Récapitulatif.
 * Caractéristiques : méthode A (tirage 2D10 + assignation) ou B (répartir 120 pts),
 * + prélèvement vers PSY (max 10/comp, COM compte double).
 */
export class BrigCharGen extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
    this.isGM = game.user.isGM;
    // Les verrous (1 perso/joueur, méthode, dés) ne s'appliquent qu'à la création
    // par un joueur — jamais au MJ ni à l'édition d'un acteur existant.
    this.locksApply = !this.actor && !this.isGM;
    this.lock = this.locksApply ? getChargenLock() : foundry.utils.deepClone(BLANK_LOCK);

    this.steps = ["identity", "characteristics", "details", "summary"];
    this.step = Number.isInteger(this.lock.step) ? this.lock.step : 0;
    this.draft = {
      name: this.lock.draft?.name ?? this.actor?.name ?? game.i18n.localize("BRIG.CharGen.defaultName"),
      speciesId: this.lock.draft?.speciesId ?? null,
      careerId: this.lock.draft?.careerId ?? null,
      role: this.lock.draft?.role ?? this.actor?.system?.role ?? "premierRole",
      chars: {}, details: { ...(this.actor?.system?.details ?? {}), ...(this.lock.draft?.details ?? {}) }
    };
    this.gen = { method: null, rolled: [], dropped: null, pool: [], assign: {}, points: {}, psyDraw: {} };
    this._seedFromLock();
    this._userHook = null;
    this._baseMap = {};
  }

  /** (Re)initialise l'état de génération à partir du verrou persité. */
  _seedFromLock() {
    const l = this.lock ?? {};
    // Méthode : null = pas encore choisie (cartes affichées). Aucun pré-choix, pour que
    // le premier clic soit toujours réactif (MJ comme joueur).
    this.gen.method = l.method ?? null;
    this.gen.rolledOnce = !!l.rolledOnce;
    this.gen.pool = Array.isArray(l.pool) ? [...l.pool] : [];
    this.gen.assign = { ...(l.assign ?? {}) };
    this.gen.points = { ...(l.points ?? {}) };
    this.gen.psyDraw = { ...(l.psyDraw ?? {}) };
    this.gen.rolled = this.gen.pool.length === 12 ? this.gen.pool.map(v => ({ v, dropped: false })) : [];
    this.gen.dropped = l.dropped ?? null;
  }

  /** Sauvegarde l'avancement (et donc les verrous) sur le User. No-op hors verrouillage.
   *  Suppose que l'état DOM courant a déjà été capturé (via `_capture`). */
  async _persist() {
    if (!this.locksApply) return;
    this.lock = await setChargenLock(game.user, {
      method: this.gen.method,
      rolledOnce: this.gen.rolledOnce,
      pool: this.gen.pool.length === 12 ? [...this.gen.pool] : null,
      dropped: this.gen.dropped,
      assign: this.gen.assign, points: this.gen.points, psyDraw: this.gen.psyDraw,
      draft: { name: this.draft.name, speciesId: this.draft.speciesId, careerId: this.draft.careerId, role: this.draft.role, details: this.draft.details },
      step: this.step
    });
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["brigandyne-40k", "char-gen", "wizard"],
    position: { width: 880, height: 640 },
    window: { title: "BRIG.CharGen.title", icon: "fa-solid fa-wand-magic-sparkles" },
    actions: {
      wizNext: BrigCharGen.#onNext,
      wizPrev: BrigCharGen.#onPrev,
      wizCancel: BrigCharGen.#onCancel,
      wizFinish: BrigCharGen.#onFinish,
      wizGoto: BrigCharGen.#onGoto,
      genMethod: BrigCharGen.#onGenMethod,
      genMethodReset: BrigCharGen.#onGenMethodReset,
      genRoll: BrigCharGen.#onGenRoll,
      wizRequestNew: BrigCharGen.#onRequestNew,
      wizRequestMethod: BrigCharGen.#onRequestMethod,
      wizRequestReroll: BrigCharGen.#onRequestReroll
    }
  };

  static PARTS = { body: { template: "systems/brigandyne-40k/templates/apps/char-gen.hbs" } };

  get stepId() { return this.steps[this.step]; }

  async _packDoc(packKey, id) {
    if (!id) return null;
    const p = game.packs.get(packKey); if (!p) return null;
    await p.getIndex();
    return p.getDocument(id);
  }

  /** Base d'une caractéristique (espèce). */
  _base(k) { return this._baseMap[k] ?? (k === "psy" ? 0 : 25); }

  /** Calcule les totaux finaux des caractéristiques selon la méthode choisie. */
  _genTotals() {
    const t = {};
    for (const k of CHARACTERISTIC_KEYS) t[k] = this._base(k);
    if (this.gen.method === "roll") {
      for (const [k, idx] of Object.entries(this.gen.assign)) {
        if (this.gen.pool[idx] != null) t[k] = this._base(k) + this.gen.pool[idx];
      }
    } else {
      for (const k of KEYS12) t[k] = this._base(k) + (Number(this.gen.points[k]) || 0);
    }
    // Prélèvement vers PSY (COM compte double)
    let psy = this._base("psy");
    for (const [k, d] of Object.entries(this.gen.psyDraw)) {
      const draw = Math.clamp(Number(d) || 0, 0, 10);
      if (!draw) continue;
      t[k] = Math.max(0, t[k] - draw);
      psy += (k === "com" ? draw * 2 : draw);
    }
    t.psy = psy;
    // Plafond de PSY à la création (RAW : score de Magie/Psychisme max 50% à la création)
    if (!this.actor) t.psy = Math.min(t.psy, BRIGANDYNE.mechanics.maxCharCreation);
    for (const k of CHARACTERISTIC_KEYS) t[k] = Math.clamp(Math.round(t[k]), 0, 100);
    return t;
  }

  /**
   * PV et SF de départ (RAW Brigandyne 2e) :
   *   PV (Vitalité)  = FOR/5 + END/5 + bonus VOL (+ bonus d'espèce PV)
   *   SF (Sang-froid)= VOL/5 + CNS/5 + bonus COM (+ bonus d'espèce SF)
   * @param {object} totals   caractéristiques finales
   * @param {string[]} special clés de spécificités d'espèce (pvPlus1, pvPlus2, sfPlus1…)
   */
  _derivePvSf(totals, special = []) {
    const sb = speciesResourceBonus(special);
    return {
      pv: vitality(totals, sb.pv), sf: sangFroid(totals, sb.sf),
      pvBonus: sb.pv, sfBonus: sb.sf
    };
  }

  _pointsUsed() { return KEYS12.reduce((s, k) => s + (Number(this.gen.points[k]) || 0), 0); }

  _genValid() {
    if (!this.gen.method) return false;
    if (this.gen.method === "roll") {
      if (this.gen.pool.length !== 12) return false;
      const used = KEYS12.map(k => this.gen.assign[k]).filter(v => v != null);
      return used.length === 12 && new Set(used).size === 12;
    }
    return this._pointsUsed() <= POINTS_TOTAL && KEYS12.every(k => (Number(this.gen.points[k]) || 0) <= 20);
  }

  async _prepareContext() {
    const sp = game.packs.get(PACK.species); await sp?.getIndex();
    const ca = game.packs.get(PACK.careers); await ca?.getIndex({ fields: ["system.faction"] });
    const species = sp ? sp.index.contents.map(e => ({ id: e._id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name)) : [];

    const careerGroups = [];
    if (ca) {
      const byFaction = {};
      for (const e of ca.index) (byFaction[e.system?.faction || "civils"] ??= []).push({ id: e._id, name: e.name });
      const pushGroup = (key, label) => {
        if (byFaction[key]?.length) { careerGroups.push({ key, label, careers: byFaction[key].sort((a, b) => a.name.localeCompare(b.name)) }); delete byFaction[key]; }
      };
      for (const [key, label] of Object.entries(BRIGANDYNE.factions)) pushGroup(key, game.i18n.localize(label));
      for (const key of Object.keys(byFaction)) pushGroup(key, key);
    }

    const speciesDoc = await this._packDoc(PACK.species, this.draft.speciesId);
    const careerDoc = await this._packDoc(PACK.careers, this.draft.careerId);

    this._baseMap = {};
    for (const k of CHARACTERISTIC_KEYS) this._baseMap[k] = speciesDoc?.system.base?.[k] ?? (k === "psy" ? 0 : 25);

    const totals = this._genTotals();
    // Infobulle par compétence : « Nom — explication » (pour les néophytes)
    const charTip = k => `${game.i18n.localize(BRIGANDYNE.characteristics[k].label)} — ${game.i18n.localize(`BRIG.Char.${k}.desc`)}`;
    const chars = CHARACTERISTIC_KEYS.map(k => ({
      key: k, abbr: BRIGANDYNE.characteristics[k].abbrev, label: BRIGANDYNE.characteristics[k].label, tip: charTip(k),
      base: this._base(k), value: totals[k], bonus: Math.floor(totals[k] / 10)
    }));
    const { pv, sf } = this._derivePvSf(totals, speciesDoc?.system?.special ?? []);

    // Données de génération (étape caractéristiques)
    const usedIdx = new Set(Object.values(this.gen.assign).filter(v => v != null));
    const genRows = KEYS12.map(k => ({
      key: k, abbr: BRIGANDYNE.characteristics[k].abbrev, tip: charTip(k), base: this._base(k), total: totals[k],
      assignedIdx: this.gen.assign[k] ?? "", point: this.gen.points[k] ?? 0, psyDraw: this.gen.psyDraw[k] ?? 0,
      options: this.gen.pool.map((v, i) => ({ i, v, used: usedIdx.has(i) && this.gen.assign[k] !== i }))
    }));
    // Bandeau des dés tirés : grise les valeurs déjà assignées (index = position dans le pool)
    let _pp = 0;
    const rolledDisplay = this.gen.rolled.map(r => r.dropped
      ? { v: r.v, dropped: true, used: false }
      : { v: r.v, dropped: false, used: usedIdx.has(_pp++) });

    // État de verrouillage (création par un joueur uniquement)
    const blocked = this.locksApply && getChargenLock().complete;
    const methodLabel = this.gen.method
      ? game.i18n.localize(this.gen.method === "roll" ? "BRIG.CharGen.method.roll" : "BRIG.CharGen.method.points")
      : "";

    // Enrichissement descriptif (rendre la création accessible aux néophytes)
    const lore = BRIGANDYNE.speciesLore?.[speciesDoc?.name] ?? null;
    const speciesTraits = (speciesDoc?.system.special ?? []).map(t => game.i18n.localize(BRIGANDYNE.speciesTraits[t] ?? t));
    const speciesLimits = [];
    if (speciesDoc) for (const k of CHARACTERISTIC_KEYS) {
      const lim = speciesDoc.system.limits?.[k];
      if (lim != null) speciesLimits.push(`${game.i18n.localize(BRIGANDYNE.characteristics[k].abbrev)} ${lim}`);
    }
    const stripHtml = s => (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    let specialtiesInfo = [], talentsInfo = [];
    if (careerDoc) {
      const specPack = game.packs.get(PACK.specialties); await specPack?.getIndex({ fields: ["system.effect"] });
      const talPack = game.packs.get(PACK.talents); await talPack?.getIndex({ fields: ["system.effect"] });
      const tipOf = (pack, n) => stripHtml(pack?.index.find(i => i.name === n)?.system?.effect);
      specialtiesInfo = (careerDoc.system.specialties ?? []).map(n => ({ name: n, tip: tipOf(specPack, n) }));
      talentsInfo = (careerDoc.system.talents ?? []).map(n => ({ name: n, tip: tipOf(talPack, n) }));
    }

    return {
      speciesDesc: lore?.desc, speciesLifespan: lore?.lifespan, speciesSize: lore?.size, speciesTraits, speciesLimits,
      careerDesc: careerDoc?.system.description, careerQuote: careerDoc?.system.quote,
      specialtiesInfo, talentsInfo,
      locksApply: this.locksApply, blocked,
      methodChosen: !!this.gen.method, methodLocked: this.locksApply && !!this.gen.method,
      showMethodTabs: !this.locksApply, rollLocked: this.locksApply && this.gen.rolledOnce, methodLabel,
      noPacks: !species.length || !careerGroups.length,
      stages: this.steps.map((id, i) => ({ id, i, active: i === this.step, done: i < this.step, label: game.i18n.localize(`BRIG.CharGen.step.${id}`) })),
      stepId: this.stepId, first: this.step === 0, last: this.step === this.steps.length - 1, editMode: !!this.actor,
      draft: this.draft, species, careerGroups, roles: BRIGANDYNE.roles,
      speciesName: speciesDoc?.name, destin: speciesDoc?.system.destin,
      careerName: careerDoc?.name, lifestyle: careerDoc ? game.i18n.localize(BRIGANDYNE.lifestyles[careerDoc.system.lifestyle]?.label ?? "") : "",
      specialties: careerDoc?.system.specialties ?? [], talents: careerDoc?.system.talents ?? [],
      chars, pv, sf, details: this.draft.details, detailKeys: DETAIL_KEYS,
      gen: {
        method: this.gen.method, rolled: this.gen.rolled, rolledDisplay, dropped: this.gen.dropped, hasPool: this.gen.pool.length === 12,
        rows: genRows, psyBase: this._base("psy"), psyTotal: totals.psy, psyCap: BRIGANDYNE.mechanics.maxCharCreation,
        pointsTotal: POINTS_TOTAL, pointsUsed: this._pointsUsed(), pointsRemaining: POINTS_TOTAL - this._pointsUsed(),
        valid: this._genValid(),
        // Récap MJ : somme des dés conservés (méthode aléatoire) et total des compétences
        diceSum: this.gen.pool.reduce((s, v) => s + (Number(v) || 0), 0),
        charTotal: CHARACTERISTIC_KEYS.reduce((s, k) => s + (Number(totals[k]) || 0), 0)
      }
    };
  }

  _onRender() {
    const el = this.element;
    el.querySelectorAll("[data-refresh]").forEach(s => s.addEventListener("change", () => { this._capture(); this._persist(); this.render(); }));
    el.querySelectorAll("[name^='points.'],[name^='psyDraw.']").forEach(i => i.addEventListener("input", () => this._refreshTotals()));
    // Assignation des dés : handler dédié (échange, source de vérité = this.gen.assign)
    el.querySelectorAll('select[name^="assign."]').forEach(s => s.addEventListener("change", () => this._onAssign(s)));

    // Réagir en direct à un déverrouillage du MJ (modif. du flag de ce joueur)
    if (this.locksApply && this._userHook === null) {
      this._userHook = Hooks.on("updateUser", (user, changes) => {
        if (user.id !== game.user.id) return;
        if (!foundry.utils.hasProperty(changes, `flags.${SYSTEM_ID}.chargen`)) return;
        this.lock = getChargenLock();
        this._seedFromLock();
        this.render();
      });
    }
  }

  _onClose(options) {
    if (this._userHook !== null) { Hooks.off("updateUser", this._userHook); this._userHook = null; }
    return super._onClose(options);
  }

  /** Mise à jour live des totaux/compteurs sans re-render (pour les saisies numériques). */
  _refreshTotals() {
    this._captureGen();
    const t = this._genTotals();
    const el = this.element;
    for (const k of CHARACTERISTIC_KEYS) { const s = el.querySelector(`[data-total="${k}"]`); if (s) s.textContent = t[k]; }
    const rem = el.querySelector("[data-points-remaining]"); if (rem) rem.textContent = POINTS_TOTAL - this._pointsUsed();
  }

  /** Capture points & prélèvements PSY depuis le DOM. (L'assignation des dés est gérée par _onAssign.) */
  _captureGen() {
    const el = this.element; if (!el) return;
    for (const k of KEYS12) {
      const pt = el.querySelector(`[name="points.${k}"]`);
      if (pt) this.gen.points[k] = Math.clamp(Number(pt.value) || 0, 0, 20);
      const pd = el.querySelector(`[name="psyDraw.${k}"]`);
      if (pd) this.gen.psyDraw[k] = Math.clamp(Number(pd.value) || 0, 0, 10);
    }
    this.draft.chars = this._genTotals();
  }

  /** Assigne un dé (par index) à une caractéristique, avec échange si le dé est déjà pris ailleurs. */
  _onAssign(sel) {
    this._captureGen();                                  // fige points/PSY courants (sans toucher à assign)
    const key = sel.name.slice("assign.".length);
    const val = sel.value === "" ? null : Number(sel.value);
    const prev = this.gen.assign[key] ?? null;
    if (val == null) {
      delete this.gen.assign[key];
    } else {
      // Le dé est-il déjà attribué à une autre caractéristique ? → échange.
      for (const k of KEYS12) {
        if (k !== key && this.gen.assign[k] === val) {
          if (prev != null) this.gen.assign[k] = prev;   // l'autre récupère l'ancien dé de `key`
          else delete this.gen.assign[k];                // sinon il est libéré
        }
      }
      this.gen.assign[key] = val;
    }
    this._persist();
    this.render();
  }

  _capture() {
    const el = this.element; if (!el) return;
    const get = n => el.querySelector(`[name="${n}"]`);
    if (this.stepId === "identity") {
      if (get("name")) this.draft.name = get("name").value;
      if (get("speciesId")) this.draft.speciesId = get("speciesId").value || null;
      if (get("careerId")) this.draft.careerId = get("careerId").value || null;
      if (get("role")) this.draft.role = get("role").value;
    } else if (this.stepId === "characteristics") {
      this._captureGen();
    } else if (this.stepId === "details") {
      for (const d of DETAIL_KEYS) { const i = get(`details.${d}`); if (i) this.draft.details[d] = i.value; }
    }
  }

  static async #onNext() { this._capture(); if (this.step < this.steps.length - 1) this.step++; await this._persist(); this.render(); }
  static async #onPrev() { this._capture(); if (this.step > 0) this.step--; await this._persist(); this.render(); }
  static async #onGoto(event, target) { this._capture(); this.step = Number(target.dataset.i) || 0; await this._persist(); this.render(); }
  static #onCancel() { this.close(); }
  static async #onFinish() { this._capture(); await this._commit(); this.close(); }

  /** Choix de méthode. Pour un joueur, le choix est définitif (verrouillé). */
  static async #onGenMethod(event, target) {
    this._capture();
    const method = target.dataset.method;
    // MJ / édition : changement libre, sans verrou.
    if (!this.locksApply) { this.gen.method = method; this.render(); return; }
    // Joueur : confirmation, puis verrouillage.
    const label = game.i18n.localize(method === "roll" ? "BRIG.CharGen.method.roll" : "BRIG.CharGen.method.points");
    const ok = await DialogV2.confirm({
      window: { title: game.i18n.localize("BRIG.CharGen.method.confirmTitle"), icon: "fa-solid fa-lock" },
      content: `<p>${game.i18n.format("BRIG.CharGen.method.confirmBody", { method: label })}</p>`,
      rejectClose: false
    }).catch(() => false);
    if (!ok) return;
    this.gen.method = method;
    await this._persist();
    this.render();
  }

  /** MJ / édition : revenir au choix de méthode (réinitialise les données de tirage). */
  static #onGenMethodReset() {
    if (this.locksApply) return;             // sécurité : verrou joueur intact
    this._capture();
    this.gen.method = null;
    this.gen.rolled = []; this.gen.pool = []; this.gen.assign = {}; this.gen.rolledOnce = false; this.gen.dropped = null;
    this.render();
  }

  static async #onGenRoll() {
    this._capture();
    // Verrou : pas de relance pour un joueur ayant déjà jeté ses dés.
    if (this.locksApply && this.gen.rolledOnce) {
      ui.notifications?.warn(game.i18n.localize("BRIG.CharGen.lock.alreadyRolled"));
      return;
    }
    const roll = await new Roll("26d10").evaluate();
    const faces = roll.dice[0].results.map(r => r.result);
    const sums = [];
    for (let i = 0; i < 13; i++) sums.push(faces[2 * i] + faces[2 * i + 1]);
    const minVal = Math.min(...sums);
    const dropIdx = sums.indexOf(minVal);
    this.gen.method = "roll";
    this.gen.rolled = sums.map((v, i) => ({ v, dropped: i === dropIdx }));
    this.gen.dropped = minVal;
    this.gen.pool = sums.filter((_, i) => i !== dropIdx);
    this.gen.assign = {};
    this.gen.rolledOnce = true;
    await this._persist();
    this.render();
  }

  /* ----- Demandes de déverrouillage au MJ ----- */
  static #onRequestNew() { requestUnlock("new"); }
  static #onRequestMethod() { requestUnlock("method"); }
  static #onRequestReroll() { requestUnlock("reroll"); }

  /** Construit et crée (ou met à jour) le personnage. */
  async _commit() {
    const speciesDoc = await this._packDoc(PACK.species, this.draft.speciesId);
    const careerDoc = await this._packDoc(PACK.careers, this.draft.careerId);
    // S'assurer que les bases d'espèce sont connues même sans rendu préalable
    this._baseMap = {};
    for (const k of CHARACTERISTIC_KEYS) this._baseMap[k] = speciesDoc?.system.base?.[k] ?? (k === "psy" ? 0 : 25);
    const totals = this._genTotals();

    const characteristics = {};
    for (const k of CHARACTERISTIC_KEYS) characteristics[k] = { value: totals[k], mod: 0, advances: 0 };
    // Le bonus d'espèce est stocké dans `.bonus` ; PV/SF max sont re-dérivés en continu par le DataModel.
    const { pv, sf, pvBonus, sfBonus } = this._derivePvSf(totals, speciesDoc?.system?.special ?? []);

    const system = {
      characteristics, role: this.draft.role,
      speciesName: speciesDoc?.name ?? "", species: speciesDoc?.name ?? "",
      careerName: careerDoc?.name ?? "", lifestyle: careerDoc?.system.lifestyle ?? "ordinaire",
      destin: { value: speciesDoc?.system.destin ?? 2, max: speciesDoc?.system.destin ?? 2 },
      pv: { value: pv, max: pv, bonus: pvBonus }, sf: { value: sf, max: sf, bonus: sfBonus },
      details: this.draft.details
    };

    const items = [];
    if (careerDoc) {
      items.push(careerDoc.toObject());
      const specPack = game.packs.get(PACK.specialties); await specPack?.getIndex();
      const talPack = game.packs.get(PACK.talents); await talPack?.getIndex();
      for (const name of (careerDoc.system.specialties ?? [])) {
        const e = specPack?.index.find(i => i.name === name);
        items.push(e ? (await specPack.getDocument(e._id)).toObject() : { name, type: "specialty" });
      }
      for (const name of (careerDoc.system.talents ?? [])) {
        const e = talPack?.index.find(i => i.name === name);
        items.push(e ? (await talPack.getDocument(e._id)).toObject() : { name, type: "talent" });
      }
    }

    if (this.actor) {
      await this.actor.update({ name: this.draft.name, system });
      if (items.length) await this.actor.createEmbeddedDocuments("Item", items);
      ui.notifications?.info(game.i18n.format("BRIG.CharGen.done", { name: this.actor.name }));
      this.actor.sheet?.render(true);
      return;
    }

    const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };
    const actor = await Actor.create({ name: this.draft.name, type: "character", ownership, system, items });
    if (actor) {
      await game.user.update({ character: actor.id });
      // Verrou « 1 perso/joueur » : on mémorise que ce joueur a terminé sa création.
      if (this.locksApply) await setChargenLock(game.user, { complete: true, actorId: actor.id });
      ui.notifications?.info(game.i18n.format("BRIG.CharGen.created", { name: actor.name }));
      actor.sheet?.render(true);
    }
  }
}
