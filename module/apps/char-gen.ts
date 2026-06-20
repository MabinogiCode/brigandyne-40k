import { BRIGANDYNE } from "../config/config.js";
import { CHARACTERISTIC_KEYS } from "../data/fields.js";
import { vitality, sangFroid, speciesResourceBonus } from "../data/derive.js";
import { SYSTEM_ID } from "../brigandyne40k.js";
import { BLANK_LOCK, getChargenLock, setChargenLock, requestUnlock } from "./chargen-lock.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DialogV2 } = foundry.applications.api;

const PACK = {
  species: "brigandyne-40k.species",
  careers: "brigandyne-40k.careers",
  specialties: "brigandyne-40k.specialties",
  talents: "brigandyne-40k.talents",
  archetypes: "brigandyne-40k.archetypes"
};
const DETAIL_KEYS = ["age", "height", "weight", "eyes", "hair", "gender", "homeworld", "motivation"];
const KEYS12 = CHARACTERISTIC_KEYS.filter(k => k !== "psy");
const POINTS_TOTAL = 120;

/** Compendiums d'équipement à parcourir lors de l'attribution automatique. */
const EQUIP_PACKS = [
  "brigandyne-40k.armor",
  "brigandyne-40k.weapons",
  "brigandyne-40k.ammunition",
  "brigandyne-40k.augmentations"
];

/**
 * Assistant (wizard) de création de personnage.
 * Étapes : Identité → Caractéristiques → Archétype & Traits → Détails → Récapitulatif.
 * Caractéristiques : méthode A (tirage 2D10 + assignation) ou B (répartir 120 pts),
 * + prélèvement vers PSY (max 10/comp, COM compte double).
 * Archétype : modifie les caractéristiques ; Vices & Vertus ajoutés comme traits.
 * Atouts : *CNS*-1 tirés au hasard dans le pool carrière (spécialités + talents).
 * Équipement : recherche automatique par nom dans les compendiums.
 */
export class BrigCharGen extends (HandlebarsApplicationMixin(ApplicationV2) as any) {
  declare actor: any;
  declare isGM: boolean;
  declare locksApply: boolean;
  declare lock: any;
  declare steps: string[];
  declare step: number;
  declare draft: Record<string, any>;
  declare gen: Record<string, any>;
  declare _userHook: number | null;
  declare _baseMap: Record<string, number>;
  declare _noPsy: boolean;
  declare _archetypeMods: Record<string, number> | null;

  constructor(options: Record<string, any> = {}) {
    super(options);
    this.actor = options.actor ?? null;
    this.isGM = game.user.isGM;
    this.locksApply = !this.actor && !this.isGM;
    this.lock = this.locksApply ? getChargenLock() : foundry.utils.deepClone(BLANK_LOCK);

    this.steps = ["identity", "characteristics", "traits", "details", "summary"];
    this.step = Number.isInteger(this.lock.step) ? this.lock.step : 0;
    this.draft = {
      name: this.lock.draft?.name ?? this.actor?.name ?? game.i18n.localize("BRIG.CharGen.defaultName"),
      speciesId: this.lock.draft?.speciesId ?? null,
      careerId: this.lock.draft?.careerId ?? null,
      role: this.lock.draft?.role ?? this.actor?.system?.role ?? "premierRole",
      archetypeId: this.lock.draft?.archetypeId ?? null,
      vice: this.lock.draft?.vice ?? null,
      vertu: this.lock.draft?.vertu ?? null,
      chars: {}, details: { ...(this.actor?.system?.details ?? {}), ...(this.lock.draft?.details ?? {}) }
    };
    this.gen = { method: null, rolled: [], dropped: null, pool: [], assign: {}, points: {}, psyDraw: {} };
    this._seedFromLock();
    this._userHook = null;
    this._baseMap = {};
    this._noPsy = false;
    this._archetypeMods = null;
  }

  /** (Re)initialise l'état de génération à partir du verrou persisté. */
  _seedFromLock() {
    const l = this.lock ?? {};
    this.gen.method = l.method ?? null;
    this.gen.rolledOnce = !!l.rolledOnce;
    this.gen.pool = Array.isArray(l.pool) ? [...l.pool] : [];
    this.gen.assign = { ...(l.assign ?? {}) };
    this.gen.points = { ...(l.points ?? {}) };
    this.gen.psyDraw = { ...(l.psyDraw ?? {}) };
    this.gen.rolled = this.gen.pool.length === 12 ? this.gen.pool.map(v => ({ v, dropped: false })) : [];
    this.gen.dropped = l.dropped ?? null;
  }

  /** Sauvegarde l'avancement sur le User. No-op hors verrouillage. */
  async _persist() {
    if (!this.locksApply) return;
    this.lock = await setChargenLock(game.user, {
      method: this.gen.method,
      rolledOnce: this.gen.rolledOnce,
      pool: this.gen.pool.length === 12 ? [...this.gen.pool] : null,
      dropped: this.gen.dropped,
      assign: this.gen.assign, points: this.gen.points, psyDraw: this.gen.psyDraw,
      draft: {
        name: this.draft.name, speciesId: this.draft.speciesId, careerId: this.draft.careerId,
        role: this.draft.role, archetypeId: this.draft.archetypeId,
        vice: this.draft.vice, vertu: this.draft.vertu, details: this.draft.details
      },
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

  async _packDoc(packKey, id): Promise<any> {
    if (!id) return null;
    const p = game.packs.get(packKey); if (!p) return null;
    await p.getIndex();
    return p.getDocument(id);
  }

  /** Base d'une caractéristique (espèce). */
  _base(k) { return this._baseMap[k] ?? (k === "psy" ? 0 : 25); }

  /** Calcule les totaux finaux des caractéristiques selon la méthode choisie. */
  _genTotals(): Record<string, number> {
    const t: Record<string, number> = {};
    for (const k of CHARACTERISTIC_KEYS) t[k] = this._base(k);
    if (this.gen.method === "roll") {
      for (const [k, idx] of Object.entries(this.gen.assign)) {
        const i = idx as number;
        if (this.gen.pool[i] != null) t[k] = this._base(k) + this.gen.pool[i];
      }
    } else {
      for (const k of KEYS12) t[k] = this._base(k) + (Number(this.gen.points[k]) || 0);
    }

    // Prélèvement vers PSY (COM compte double) — ignoré pour les espèces sans PSY
    let psy = this._base("psy") ?? 0;
    if (!this._noPsy) {
      for (const [k, d] of Object.entries(this.gen.psyDraw)) {
        const draw = Math.clamp(Number(d) || 0, 0, 10);
        if (!draw) continue;
        t[k] = Math.max(0, t[k] - draw);
        psy += (k === "com" ? draw * 2 : draw);
      }
      t.psy = psy;
      if (!this.actor) t.psy = Math.min(t.psy, BRIGANDYNE.mechanics.maxCharCreation);
    } else {
      t.psy = 0;
    }

    // Modificateurs d'archétype (appliqués après la répartition initiale)
    if (this._archetypeMods) {
      for (const k of CHARACTERISTIC_KEYS) {
        const mod = Number(this._archetypeMods[k]) || 0;
        if (mod) t[k] = Math.clamp(t[k] + mod, 0, 100);
      }
    }

    for (const k of CHARACTERISTIC_KEYS) t[k] = Math.clamp(Math.round(t[k]), 0, 100);
    return t;
  }

  /**
   * PV et SF de départ :
   *   PV = FOR/5 + END/5 + *VOL* (+ bonus d'espèce)
   *   SF = VOL/5 + CNS/5 + *COM* (+ bonus d'espèce)
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

  async _prepareContext(): Promise<any> {
    const sp = game.packs.get(PACK.species); await sp?.getIndex();
    const ca = game.packs.get(PACK.careers); await (ca as any)?.getIndex({ fields: ["system.faction"] });
    const arcPack = game.packs.get(PACK.archetypes); await arcPack?.getIndex();

    const species = sp ? sp.index.contents.map(e => ({ id: e._id, name: (e as any).name })).sort((a, b) => a.name.localeCompare(b.name)) : [];
    const archetypes = arcPack
      ? arcPack.index.contents
          .filter(e => !(e as any)._key?.startsWith("!folders!"))
          .map(e => ({ id: e._id, name: (e as any).name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

    const careerGroups: any[] = [];
    if (ca) {
      const byFaction: Record<string, any[]> = {};
      for (const e of (ca as any).index) (byFaction[(e as any).system?.faction || "civils"] ??= []).push({ id: e._id, name: (e as any).name });
      const pushGroup = (key, label) => {
        if (byFaction[key]?.length) { careerGroups.push({ key, label, careers: byFaction[key].sort((a, b) => a.name.localeCompare(b.name)) }); delete byFaction[key]; }
      };
      for (const [key, label] of Object.entries(BRIGANDYNE.factions) as [string, any][]) pushGroup(key, game.i18n.localize(label));
      for (const key of Object.keys(byFaction)) pushGroup(key, key);
    }

    const speciesDoc = await this._packDoc(PACK.species, this.draft.speciesId);
    const careerDoc = await this._packDoc(PACK.careers, this.draft.careerId);
    const archetypeDoc = await this._packDoc(PACK.archetypes, this.draft.archetypeId);

    this._baseMap = {};
    for (const k of CHARACTERISTIC_KEYS) this._baseMap[k] = (speciesDoc?.system as any)?.base?.[k] ?? (k === "psy" ? 0 : 25);
    this._noPsy = (speciesDoc?.system as any)?.noPsy ?? false;
    this._archetypeMods = (archetypeDoc?.system as any)?.modifiers ?? null;

    const totals = this._genTotals();
    const charTip = k => `${game.i18n.localize(BRIGANDYNE.characteristics[k].label)} — ${game.i18n.localize(`BRIG.Char.${k}.desc`)}`;
    const chars = CHARACTERISTIC_KEYS.map(k => ({
      key: k, abbr: BRIGANDYNE.characteristics[k].abbrev, label: BRIGANDYNE.characteristics[k].label, tip: charTip(k),
      base: this._base(k), value: totals[k], bonus: Math.floor(totals[k] / 10)
    }));
    const { pv, sf } = this._derivePvSf(totals, (speciesDoc?.system as any)?.special ?? []);

    // Données de génération (étape caractéristiques)
    const usedIdx = new Set(Object.values(this.gen.assign).filter(v => v != null));
    const genRows = KEYS12.map(k => ({
      key: k, abbr: BRIGANDYNE.characteristics[k].abbrev, tip: charTip(k), base: this._base(k), total: totals[k],
      assignedIdx: this.gen.assign[k] ?? "", point: this.gen.points[k] ?? 0, psyDraw: this.gen.psyDraw[k] ?? 0,
      options: this.gen.pool.map((v, i) => ({ i, v, used: usedIdx.has(i) && this.gen.assign[k] !== i }))
    }));
    let _pp = 0;
    const rolledDisplay = this.gen.rolled.map(r => r.dropped
      ? { v: r.v, dropped: true, used: false }
      : { v: r.v, dropped: false, used: usedIdx.has(_pp++) });

    // Informations sur les atouts de carrière (pool disponible)
    const stripHtml = s => (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    let specialtiesInfo: any[] = [], talentsInfo: any[] = [];
    if (careerDoc) {
      const specPack = game.packs.get(PACK.specialties); await (specPack as any)?.getIndex({ fields: ["system.effect"] });
      const talPack = game.packs.get(PACK.talents); await (talPack as any)?.getIndex({ fields: ["system.effect"] });
      const tipOf = (pack, n) => stripHtml((pack?.index.find(i => (i as any).name === n) as any)?.system?.effect);
      specialtiesInfo = ((careerDoc.system as any).specialties ?? []).map(n => ({ name: n, tip: tipOf(specPack, n) }));
      talentsInfo = ((careerDoc.system as any).talents ?? []).map(n => ({ name: n, tip: tipOf(talPack, n) }));
    }

    // Calcul du nombre d'atouts tirés au hasard : *CNS*-1
    const cnsBonus = Math.floor((totals.cns ?? 25) / 10);
    const numAtouts = Math.max(0, cnsBonus - 1);
    const poolSize = ((careerDoc?.system as any)?.specialties?.length ?? 0) + ((careerDoc?.system as any)?.talents?.length ?? 0);

    const blocked = this.locksApply && (getChargenLock() as any).complete;
    const methodLabel = this.gen.method
      ? game.i18n.localize(this.gen.method === "roll" ? "BRIG.CharGen.method.roll" : "BRIG.CharGen.method.points")
      : "";

    const lore = BRIGANDYNE.speciesLore?.[speciesDoc?.name] ?? null;
    const speciesTraits = ((speciesDoc?.system as any)?.special ?? []).map(t => game.i18n.localize(BRIGANDYNE.speciesTraits[t] ?? t));
    const speciesLimits: string[] = [];
    if (speciesDoc) for (const k of CHARACTERISTIC_KEYS) {
      const lim = (speciesDoc.system as any)?.limits?.[k];
      if (lim != null) speciesLimits.push(`${game.i18n.localize(BRIGANDYNE.characteristics[k].abbrev)} ${lim}`);
    }

    return {
      speciesDesc: lore?.desc, speciesLifespan: lore?.lifespan, speciesSize: lore?.size, speciesTraits, speciesLimits,
      careerDesc: (careerDoc?.system as any)?.description, careerQuote: (careerDoc?.system as any)?.quote,
      careerStartingEquipment: (careerDoc?.system as any)?.startingEquipment ?? "",
      specialtiesInfo, talentsInfo,
      locksApply: this.locksApply, blocked,
      methodChosen: !!this.gen.method, methodLocked: this.locksApply && !!this.gen.method,
      showMethodTabs: !this.locksApply, rollLocked: this.locksApply && this.gen.rolledOnce, methodLabel,
      noPacks: !species.length || !careerGroups.length,
      stages: this.steps.map((id, i) => ({ id, i, active: i === this.step, done: i < this.step, label: game.i18n.localize(`BRIG.CharGen.step.${id}`) })),
      stepId: this.stepId, first: this.step === 0, last: this.step === this.steps.length - 1, editMode: !!this.actor,
      draft: this.draft, species, careerGroups, roles: BRIGANDYNE.roles,
      speciesName: speciesDoc?.name, destin: (speciesDoc?.system as any)?.destin,
      careerName: careerDoc?.name, lifestyle: careerDoc ? game.i18n.localize(BRIGANDYNE.lifestyles[(careerDoc.system as any)?.lifestyle]?.label ?? "") : "",
      specialties: (careerDoc?.system as any)?.specialties ?? [], talents: (careerDoc?.system as any)?.talents ?? [],
      chars, pv, sf, details: this.draft.details, detailKeys: DETAIL_KEYS,
      // Archétypes & Traits
      archetypes, archetypeDoc, archetypeName: archetypeDoc?.name ?? "",
      vices: BRIGANDYNE.vices, virtues: BRIGANDYNE.virtues,
      noPsy: this._noPsy,
      // Atouts (tirage aléatoire)
      numAtouts, cnsBonus, poolSize,
      gen: {
        method: this.gen.method, rolled: this.gen.rolled, rolledDisplay, dropped: this.gen.dropped, hasPool: this.gen.pool.length === 12,
        rows: genRows, psyBase: this._base("psy"), psyTotal: totals.psy, psyCap: BRIGANDYNE.mechanics.maxCharCreation,
        pointsTotal: POINTS_TOTAL, pointsUsed: this._pointsUsed(), pointsRemaining: POINTS_TOTAL - this._pointsUsed(),
        valid: this._genValid(),
        diceSum: this.gen.pool.reduce((s, v) => s + (Number(v) || 0), 0),
        charTotal: CHARACTERISTIC_KEYS.reduce((s, k) => s + (Number(totals[k]) || 0), 0)
      }
    };
  }

  _onRender() {
    const el = this.element;
    el.querySelectorAll("[data-refresh]").forEach(s => s.addEventListener("change", () => { this._capture(); this._persist(); this.render(); }));
    el.querySelectorAll("[name^='points.'],[name^='psyDraw.']").forEach(i => i.addEventListener("input", () => this._refreshTotals()));
    el.querySelectorAll('select[name^="assign."]').forEach(s => s.addEventListener("change", () => this._onAssign(s)));

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

  /** Mise à jour live des totaux/compteurs sans re-render. */
  _refreshTotals() {
    this._captureGen();
    const t = this._genTotals();
    const el = this.element;
    for (const k of CHARACTERISTIC_KEYS) { const s = el.querySelector(`[data-total="${k}"]`); if (s) s.textContent = String(t[k]); }
    const rem = el.querySelector("[data-points-remaining]"); if (rem) rem.textContent = String(POINTS_TOTAL - this._pointsUsed());
  }

  /** Capture points & prélèvements PSY depuis le DOM. */
  _captureGen() {
    const el = this.element; if (!el) return;
    for (const k of KEYS12) {
      const pt = el.querySelector(`[name="points.${k}"]`) as HTMLInputElement | null;
      if (pt) this.gen.points[k] = Math.clamp(Number(pt.value) || 0, 0, 20);
      const pd = el.querySelector(`[name="psyDraw.${k}"]`) as HTMLInputElement | null;
      if (pd) this.gen.psyDraw[k] = Math.clamp(Number(pd.value) || 0, 0, 10);
    }
    this.draft.chars = this._genTotals();
  }

  /** Assigne un dé (par index) à une caractéristique, avec échange si déjà pris. */
  _onAssign(sel) {
    this._captureGen();
    const key = sel.name.slice("assign.".length);
    const val = sel.value === "" ? null : Number(sel.value);
    const prev = this.gen.assign[key] ?? null;
    if (val == null) {
      delete this.gen.assign[key];
    } else {
      for (const k of KEYS12) {
        if (k !== key && this.gen.assign[k] === val) {
          if (prev != null) this.gen.assign[k] = prev;
          else delete this.gen.assign[k];
        }
      }
      this.gen.assign[key] = val;
    }
    this._persist();
    this.render();
  }

  _capture() {
    const el = this.element; if (!el) return;
    const get = (n: string) => el.querySelector(`[name="${n}"]`) as HTMLInputElement | null;
    if (this.stepId === "identity") {
      if (get("name")) this.draft.name = get("name")!.value;
      if (get("speciesId")) this.draft.speciesId = get("speciesId")!.value || null;
      if (get("careerId")) this.draft.careerId = get("careerId")!.value || null;
      if (get("role")) this.draft.role = get("role")!.value;
    } else if (this.stepId === "characteristics") {
      this._captureGen();
    } else if (this.stepId === "traits") {
      if (get("archetypeId")) this.draft.archetypeId = get("archetypeId")!.value || null;
      if (get("vice")) this.draft.vice = get("vice")!.value || null;
      if (get("vertu")) this.draft.vertu = get("vertu")!.value || null;
    } else if (this.stepId === "details") {
      for (const d of DETAIL_KEYS) { const i = get(`details.${d}`); if (i) this.draft.details[d] = i.value; }
    }
  }

  static async #onNext() { this._capture(); if (this.step < this.steps.length - 1) this.step++; await this._persist(); this.render(); }
  static async #onPrev() { this._capture(); if (this.step > 0) this.step--; await this._persist(); this.render(); }
  static async #onGoto(event, target) { this._capture(); this.step = Number(target.dataset.i) || 0; await this._persist(); this.render(); }
  static #onCancel() { this.close(); }
  static async #onFinish() { this._capture(); await this._commit(); this.close(); }

  /** Choix de méthode. Pour un joueur, le choix est définitif. */
  static async #onGenMethod(event, target) {
    this._capture();
    const method = target.dataset.method;
    if (!this.locksApply) { this.gen.method = method; this.render(); return; }
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

  static #onGenMethodReset() {
    if (this.locksApply) return;
    this._capture();
    this.gen.method = null;
    this.gen.rolled = []; this.gen.pool = []; this.gen.assign = {}; this.gen.rolledOnce = false; this.gen.dropped = null;
    this.render();
  }

  static async #onGenRoll() {
    this._capture();
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

  static #onRequestNew() { requestUnlock("new"); }
  static #onRequestMethod() { requestUnlock("method"); }
  static #onRequestReroll() { requestUnlock("reroll"); }

  /** Construit et crée (ou met à jour) le personnage. */
  async _commit() {
    const speciesDoc = await this._packDoc(PACK.species, this.draft.speciesId);
    const careerDoc = await this._packDoc(PACK.careers, this.draft.careerId);
    const archetypeDoc = await this._packDoc(PACK.archetypes, this.draft.archetypeId);

    // Initialiser les données de base pour _genTotals()
    this._baseMap = {};
    for (const k of CHARACTERISTIC_KEYS) this._baseMap[k] = (speciesDoc?.system as any)?.base?.[k] ?? (k === "psy" ? 0 : 25);
    this._noPsy = (speciesDoc?.system as any)?.noPsy ?? false;
    this._archetypeMods = (archetypeDoc?.system as any)?.modifiers ?? null;

    const totals = this._genTotals();  // inclut modificateurs d'archétype et psyDraw

    const characteristics = {};
    for (const k of CHARACTERISTIC_KEYS) characteristics[k] = { value: totals[k], mod: 0, advances: 0 };
    const { pv, sf, pvBonus, sfBonus } = this._derivePvSf(totals, (speciesDoc?.system as any)?.special ?? []);

    const system = {
      characteristics, role: this.draft.role,
      speciesName: speciesDoc?.name ?? "", species: speciesDoc?.name ?? "",
      careerName: careerDoc?.name ?? "", lifestyle: (careerDoc?.system as any)?.lifestyle ?? "ordinaire",
      destin: { value: (speciesDoc?.system as any)?.destin ?? 2, max: (speciesDoc?.system as any)?.destin ?? 2 },
      pv: { value: pv, max: pv, bonus: pvBonus }, sf: { value: sf, max: sf, bonus: sfBonus },
      details: this.draft.details,
      schemaVersion: game.system.version
    };

    const items = [];

    if (careerDoc) {
      items.push(careerDoc.toObject());

      // Chargement des packs d'atouts
      const specPack = game.packs.get(PACK.specialties); await specPack?.getIndex();
      const talPack = game.packs.get(PACK.talents); await talPack?.getIndex();

      // Construction du pool complet d'atouts (spécialités + talents de la carrière)
      const atoutPool = [];
      for (const name of ((careerDoc.system as any).specialties ?? [])) {
        const e = specPack?.index.find(i => (i as any).name === name);
        atoutPool.push({ packRef: specPack, entry: e, name, type: "specialty" });
      }
      for (const name of ((careerDoc.system as any).talents ?? [])) {
        const e = talPack?.index.find(i => (i as any).name === name);
        atoutPool.push({ packRef: talPack, entry: e, name, type: "talent" });
      }

      // Tirage aléatoire de *CNS*-1 atouts (Fisher-Yates)
      const cnsBonus = Math.floor((totals.cns ?? 25) / 10);
      const numAtouts = Math.max(0, cnsBonus - 1);
      for (let i = atoutPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [atoutPool[i], atoutPool[j]] = [atoutPool[j], atoutPool[i]];
      }
      const chosenAtouts = atoutPool.slice(0, numAtouts);
      for (const { packRef, entry, name, type } of chosenAtouts) {
        items.push(entry ? (await packRef.getDocument(entry._id)).toObject() : { name, type });
      }

      // Équipement de départ : recherche par nom dans les compendiums
      if ((careerDoc.system as any).startingEquipment) {
        const equipPacks = EQUIP_PACKS.map(id => game.packs.get(id)).filter(Boolean);
        for (const p of equipPacks) await p.getIndex();

        const plainText = ((careerDoc.system as any).startingEquipment as string)
          .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const candidateNames = plainText.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 2);

        for (const rawName of candidateNames) {
          const normName = rawName.toLowerCase();
          for (const p of equipPacks) {
            const entry = p.index.find(e => (e as any).name.toLowerCase() === normName);
            if (entry) {
              items.push((await p.getDocument(entry._id)).toObject());
              break;
            }
          }
        }
      }
    }

    // Vice choisi (trait item)
    if (this.draft.vice && BRIGANDYNE.vices[this.draft.vice]) {
      const viceName = game.i18n.localize(BRIGANDYNE.vices[this.draft.vice]);
      items.push({ name: viceName, type: "trait", system: { traitType: "vice", rating: 1, god: "", effect: "" } });
    }
    // Vertu choisie (trait item)
    if (this.draft.vertu && BRIGANDYNE.virtues[this.draft.vertu]) {
      const vertuName = game.i18n.localize(BRIGANDYNE.virtues[this.draft.vertu]);
      items.push({ name: vertuName, type: "trait", system: { traitType: "vertu", rating: 1, god: "", effect: "" } });
    }

    if (this.actor) {
      await this.actor.update({ name: this.draft.name, system });
      if (items.length) await this.actor.createEmbeddedDocuments("Item", items);
      ui.notifications?.info(game.i18n.format("BRIG.CharGen.done", { name: this.actor.name }));
      this.actor.sheet?.render(true);
      return;
    }

    const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };
    const actor = await Actor.create({ name: this.draft.name, type: "character", ownership, system, items } as any);
    if (actor) {
      await game.user.update({ character: actor.id });
      if (this.locksApply) await setChargenLock(game.user, { complete: true, actorId: actor.id });
      ui.notifications?.info(game.i18n.format("BRIG.CharGen.created", { name: actor.name }));
      actor.sheet?.render(true);
    }
  }
}
