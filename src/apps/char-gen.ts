import { BRIGANDYNE } from "../config/config.ts";
import { CHARACTERISTIC_KEYS } from "../data/fields.ts";
import { vitality, sangFroid, speciesResourceBonus, applyArchetype, bonusOf } from "../data/derive.ts";
import { atoutCount, selectableAtouts, drawAtoutOptions, applyPsyTransfer, dropLowest, ROLL_COUNT, NEEDS_PRECISION, precisedName } from "../data/chargen-rules.ts";
import { SYSTEM_ID } from "../brigandyne40k.ts";
import { BLANK_LOCK, getChargenLock, setChargenLock, requestUnlock } from "./chargen-lock.ts";

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
 * Étapes : Identité → Caractéristiques → Archétype & Traits → Atouts → Détails → Récapitulatif.
 * Caractéristiques : méthode A (tirage 2D10 + assignation) ou B (répartir 120 pts),
 * + prélèvement vers PSY (max 10/comp, COM compte double).
 * Archétype : modifie les caractéristiques ; Vices & Vertus ajoutés comme traits.
 * Atouts (RAW p.110) : *CNS*-1 atouts ; le joueur répartit entre spécialités et
 * Talents, chaque tirage propose DEUX options (2D10, doublé relancé) et le joueur
 * choisit. Pas de spécialité occulte si PSY = 0.
 * Équipement : recherche automatique par nom dans les compendiums.
 */
export class BrigCharGen extends HandlebarsApplicationMixin(ApplicationV2) {
  declare actor: any;
  declare isGM: boolean;
  declare locksApply: boolean;
  declare lock: any;
  declare steps: string[];
  declare step: number;
  declare draft: any;
  declare gen: any;
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

    this.steps = ["identity", "characteristics", "traits", "atouts", "details", "summary"];
    this.step = Number.isInteger(this.lock.step) ? this.lock.step : 0;
    this.draft = {
      name: this.lock.draft?.name ?? this.actor?.name ?? game.i18n.localize("BRIG.CharGen.defaultName"),
      speciesId: this.lock.draft?.speciesId ?? null,
      careerId: this.lock.draft?.careerId ?? null,
      role: this.lock.draft?.role ?? this.actor?.system?.role ?? "premierRole",
      archetypeId: this.lock.draft?.archetypeId ?? null,
      archetypeTraits: Array.isArray(this.lock.draft?.archetypeTraits) ? [...this.lock.draft.archetypeTraits] : [],
      atouts: Array.isArray(this.lock.draft?.atouts) ? foundry.utils.deepClone(this.lock.draft.atouts) : [],
      atoutDraw: this.lock.draft?.atoutDraw ? foundry.utils.deepClone(this.lock.draft.atoutDraw) : null,
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
        archetypeTraits: this.draft.archetypeTraits,
        atouts: this.draft.atouts, atoutDraw: this.draft.atoutDraw,
        details: this.draft.details
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
      wizRequestReroll: BrigCharGen.#onRequestReroll,
      atoutDraw: BrigCharGen.#onAtoutDraw,
      atoutPick: BrigCharGen.#onAtoutPick,
      atoutsReset: BrigCharGen.#onAtoutsReset
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
    const t: Record<string, number> = {};
    for (const k of CHARACTERISTIC_KEYS) t[k] = this._base(k);
    if (this.gen.method === "roll") {
      for (const [k, idx] of Object.entries(this.gen.assign) as Array<[string, number]>) {
        if (this.gen.pool[idx] != null) t[k] = this._base(k) + this.gen.pool[idx];
      }
    } else {
      for (const k of KEYS12) t[k] = this._base(k) + (Number(this.gen.points[k]) || 0);
    }

    // Prélèvement vers PSY (max 10/comp, COM compte double — RAW p.25),
    // ignoré pour les espèces sans PSY
    if (!this._noPsy) {
      t.psy = this._base("psy") ?? 0;
      const cap = this.actor ? null : BRIGANDYNE.mechanics.maxCharCreation;
      Object.assign(t, applyPsyTransfer(t, this.gen.psyDraw, cap));
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

  async _prepareContext() {
    const sp = game.packs.get(PACK.species); await sp?.getIndex();
    const ca = game.packs.get(PACK.careers); await ca?.getIndex({ fields: ["system.faction"] });
    const arcPack = game.packs.get(PACK.archetypes); await arcPack?.getIndex();

    const species = sp ? sp.index.contents.map(e => ({ id: e._id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name)) : [];
    const archetypes = arcPack
      ? arcPack.index.contents
          .filter(e => !e._key?.startsWith("!folders!"))
          .map(e => ({ id: e._id, name: e.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

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
    const archetypeDoc = await this._packDoc(PACK.archetypes, this.draft.archetypeId);

    this._baseMap = {};
    for (const k of CHARACTERISTIC_KEYS) this._baseMap[k] = speciesDoc?.system.base?.[k] ?? (k === "psy" ? 0 : 25);
    this._noPsy = speciesDoc?.system.noPsy ?? false;
    this._archetypeMods = archetypeDoc?.system.modifiers ?? null;

    const totals = this._genTotals();
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
    let _pp = 0;
    const rolledDisplay = this.gen.rolled.map(r => r.dropped
      ? { v: r.v, dropped: true, used: false }
      : { v: r.v, dropped: false, used: usedIdx.has(_pp++) });

    // Informations sur les atouts de carrière (pool disponible)
    const stripHtml = s => (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    let specialtiesInfo = [], talentsInfo = [];
    if (careerDoc) {
      const specPack = game.packs.get(PACK.specialties); await specPack?.getIndex({ fields: ["system.effect", "system.specialtyType"] });
      const talPack = game.packs.get(PACK.talents); await talPack?.getIndex({ fields: ["system.effect"] });
      const entryOf = (pack, n) => pack?.index.find(i => i.name === n);
      specialtiesInfo = (careerDoc.system.specialties ?? []).map(n => ({
        name: n, kind: "specialty", tip: stripHtml(entryOf(specPack, n)?.system?.effect),
        specialtyType: entryOf(specPack, n)?.system?.specialtyType ?? "standard"
      }));
      talentsInfo = (careerDoc.system.talents ?? []).map(n => ({
        name: n, kind: "talent", tip: stripHtml(entryOf(talPack, n)?.system?.effect)
      }));
    }

    // Nombre d'atouts de départ : *CNS* − 1 (RAW p.110), CNS après archétype
    const cnsBonus = bonusOf(totals.cns);
    const numAtouts = atoutCount(totals.cns);
    const poolSize = specialtiesInfo.length + talentsInfo.length;

    // État du tirage des atouts (étape « Atouts ») — l'exclusion se fait sur
    // l'ENTRÉE de carrière (a.entry), pas sur le nom précisé : une entrée
    // « X ou Y » ou « (au choix) » déjà tirée ne peut pas ressortir.
    const ownedNames = (this.draft.atouts ?? []).map(a => a.entry ?? a.name);
    const tipByName = new Map([...specialtiesInfo, ...talentsInfo].map(e => [e.name, e.tip]));
    const atoutsChosen = (this.draft.atouts ?? []).map(a => ({ ...a, tip: tipByName.get(a.entry ?? a.name) ?? "" }));
    const atoutsRemaining = Math.max(0, numAtouts - atoutsChosen.length);
    const specPool = selectableAtouts(specialtiesInfo, { owned: ownedNames, psy: totals.psy });
    const talPool = selectableAtouts(talentsInfo, { owned: ownedNames, psy: totals.psy });
    const pendingDraw = this.draft.atoutDraw
      ? {
          kind: this.draft.atoutDraw.kind,
          kindLabel: this.draft.atoutDraw.kind === "talent" ? "Talent" : "Spécialité",
          options: (this.draft.atoutDraw.options ?? []).map(n => ({ name: n, tip: tipByName.get(n) ?? "" }))
        }
      : null;
    const occulteExcluded = !(totals.psy > 0) && specialtiesInfo.some(e => e.specialtyType === "occulte");

    // Vices & vertus de l'archétype (fixes + choix), avec effet miroir (RAW p.50)
    const traitLabel = (key) => {
      const isVice = !!BRIGANDYNE.vices[key];
      const isVertu = !!BRIGANDYNE.virtues[key];
      if (!isVice && !isVertu) return { key, label: key, kind: "", tip: "" };
      const label = game.i18n.localize((isVice ? BRIGANDYNE.vices : BRIGANDYNE.virtues)[key]);
      const mirrorKey = isVice
        ? BRIGANDYNE.traitMirrors[key]
        : Object.keys(BRIGANDYNE.traitMirrors).find(v => BRIGANDYNE.traitMirrors[v] === key);
      const mirror = mirrorKey ? game.i18n.localize((isVice ? BRIGANDYNE.virtues : BRIGANDYNE.vices)[mirrorKey]) : "";
      return { key, label, kind: isVice ? "vice" : "vertu", tip: mirror ? `Effet miroir : ${mirror} −1` : "" };
    };
    const archFixed = (archetypeDoc?.system?.traitsFixed ?? []).map(traitLabel);
    const archChoices = (archetypeDoc?.system?.traitsChoices ?? []).map(traitLabel);
    const archCount = archetypeDoc?.system?.traitsChoiceCount ?? 0;

    // Talents accessibles de l'archétype, avec info-bulle (effet du compendium)
    const archTalPack = game.packs.get(PACK.talents);
    await archTalPack?.getIndex({ fields: ["system.effect"] });
    const archTalents = (archetypeDoc?.system?.talents ?? []).map(n => ({
      name: n,
      tip: stripHtml(archTalPack?.index.find(i => i.name === n)?.system?.effect)
    }));
    const archSlots = Array.from({ length: archCount }, (_, i) => ({ i, selected: this.draft.archetypeTraits?.[i] ?? "" }));
    const archChoiceKeys = new Set(archChoices.map(c => c.key));
    const archGranted = [...archFixed, ...(this.draft.archetypeTraits ?? []).filter(k => archChoiceKeys.has(k)).map(traitLabel)];

    const blocked = this.locksApply && getChargenLock().complete;
    const methodLabel = this.gen.method
      ? game.i18n.localize(this.gen.method === "roll" ? "BRIG.CharGen.method.roll" : "BRIG.CharGen.method.points")
      : "";

    const lore = BRIGANDYNE.speciesLore?.[speciesDoc?.name] ?? null;
    const speciesTraits = (speciesDoc?.system.special ?? []).map(t => game.i18n.localize(BRIGANDYNE.speciesTraits[t] ?? t));
    const speciesLimits = [];
    if (speciesDoc) for (const k of CHARACTERISTIC_KEYS) {
      const lim = speciesDoc.system.limits?.[k];
      if (lim != null) speciesLimits.push(`${game.i18n.localize(BRIGANDYNE.characteristics[k].abbrev)} ${lim}`);
    }

    return {
      speciesDesc: lore?.desc, speciesLifespan: lore?.lifespan, speciesSize: lore?.size, speciesTraits, speciesLimits,
      careerDesc: careerDoc?.system.description, careerQuote: careerDoc?.system.quote,
      careerStartingEquipment: careerDoc?.system.startingEquipment ?? "",
      // Équipement de base du groupe de carrières (RAW p.26/57) : celui porté
      // par la carrière (mondes féodaux) sinon celui de sa faction.
      careerBaseEquipment: careerDoc
        ? (careerDoc.system.baseEquipment || BRIGANDYNE.factionBaseEquipment[careerDoc.system.faction] || "")
        : "",
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
      // Archétypes & Traits
      archetypes, archetypeDoc, archetypeName: archetypeDoc?.name ?? "",
      archFixed, archChoices, archCount, archTalents, archSlots, archGranted,
      vices: BRIGANDYNE.vices, virtues: BRIGANDYNE.virtues,
      noPsy: this._noPsy,
      // Atouts (tirage RAW p.110)
      numAtouts, cnsBonus, poolSize, cnsValue: totals.cns,
      atoutsChosen, atoutsRemaining, pendingDraw, occulteExcluded,
      specPoolCount: specPool.length, talPoolCount: talPool.length,
      atoutsDone: atoutsRemaining === 0,
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
    for (const k of CHARACTERISTIC_KEYS) { const s = el.querySelector(`[data-total="${k}"]`); if (s) s.textContent = t[k]; }
    const rem = el.querySelector("[data-points-remaining]"); if (rem) rem.textContent = POINTS_TOTAL - this._pointsUsed();
  }

  /** Capture points & prélèvements PSY depuis le DOM. */
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
    const get = n => el.querySelector(`[name="${n}"]`);
    if (this.stepId === "identity") {
      if (get("name")) this.draft.name = get("name").value;
      if (get("speciesId")) this.draft.speciesId = get("speciesId").value || null;
      if (get("careerId")) {
        const newCareer = get("careerId").value || null;
        if (newCareer !== this.draft.careerId) {
          // Changement de carrière : les atouts tirés dépendent de la carrière.
          this.draft.atouts = [];
          this.draft.atoutDraw = null;
        }
        this.draft.careerId = newCareer;
      }
      if (get("role")) this.draft.role = get("role").value;
    } else if (this.stepId === "characteristics") {
      this._captureGen();
    } else if (this.stepId === "traits") {
      const archSelect = get("archetypeId") as HTMLSelectElement | null;
      let newArch = archSelect ? (archSelect.value || null) : this.draft.archetypeId;
      // Garde-fou : un select revenu à vide alors qu'un archétype est déjà
      // choisi n'est PAS une demande de retrait — seul un changement explicite
      // (le select a le focus) compte. Le reset silencieux au premier clic sur
      // un vice venait de là.
      if (newArch === null && this.draft.archetypeId && document.activeElement !== archSelect) {
        newArch = this.draft.archetypeId;
      }
      if (newArch !== this.draft.archetypeId) {
        // Changement d'archétype : on repart de zéro sur les choix de vices/vertus.
        this.draft.archetypeId = newArch;
        this.draft.archetypeTraits = [];
      } else {
        // Deux traits DIFFÉRENTS (RAW p.50) : les doublons sont ignorés.
        const picks = [];
        for (let i = 0; i < 2; i++) {
          const sel = get(`archTrait.${i}`);
          if (sel && sel.value && !picks.includes(sel.value)) picks.push(sel.value);
        }
        this.draft.archetypeTraits = picks;
      }
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
    // Méthode A (RAW p.25) : 13 × 2D10, on raye le résultat le plus faible.
    const roll = await new Roll(`${ROLL_COUNT * 2}d10`).evaluate();
    const faces = roll.dice[0].results.map(r => r.result);
    const sums = [];
    for (let i = 0; i < ROLL_COUNT; i++) sums.push(faces[2 * i] + faces[2 * i + 1]);
    const { pool, dropped, droppedIndex } = dropLowest(sums);
    this.gen.method = "roll";
    this.gen.rolled = sums.map((v, i) => ({ v, dropped: i === droppedIndex }));
    this.gen.dropped = dropped;
    this.gen.pool = pool;
    this.gen.assign = {};
    this.gen.rolledOnce = true;
    await this._persist();
    this.render();
  }

  static #onRequestNew() { requestUnlock("new"); }
  static #onRequestMethod() { requestUnlock("method"); }
  static #onRequestReroll() { requestUnlock("reroll"); }

  /** Entrées d'atouts de la carrière courante (avec type de spécialité). */
  async _atoutEntries() {
    const careerDoc = await this._packDoc(PACK.careers, this.draft.careerId);
    if (!careerDoc) return [];
    const specPack = game.packs.get(PACK.specialties); await specPack?.getIndex({ fields: ["system.specialtyType"] });
    const talPack = game.packs.get(PACK.talents); await talPack?.getIndex();
    const spec = (careerDoc.system.specialties ?? []).map(n => ({
      name: n, kind: "specialty",
      specialtyType: specPack?.index.find(i => i.name === n)?.system?.specialtyType ?? "standard"
    }));
    const tal = (careerDoc.system.talents ?? []).map(n => ({ name: n, kind: "talent" }));
    return [...spec, ...tal];
  }

  /**
   * Tirage d'un atout (RAW p.110/115) : 2D10 sur la catégorie choisie par le
   * joueur → deux options distinctes (doublé relancé), parmi les atouts encore
   * disponibles (jamais deux fois le même ; pas d'occulte si PSY = 0).
   */
  static async #onAtoutDraw(event, target) {
    if (this.draft.atoutDraw) return;                          // un tirage en attente
    const kind = target.dataset.kind === "talent" ? "talent" : "specialty";
    const entries = (await this._atoutEntries()).filter(e => e.kind === kind);
    const totals = this._genTotals();
    const pool = selectableAtouts(entries, {
      owned: (this.draft.atouts ?? []).map(a => a.name),
      psy: totals.psy
    });
    const options = drawAtoutOptions(pool);
    if (!options.length) {
      ui.notifications?.warn("Plus aucun atout disponible dans cette catégorie.");
      return;
    }
    this.draft.atoutDraw = { kind, options: options.map(o => o.name) };
    await this._persist();
    this.render();
  }

  /**
   * Le joueur retient l'une des deux options proposées.
   * - Entrée « X ou Y » : il retient définitivement l'une des deux moitiés,
   *   l'autre devient « hors-carrière » (RAW p.22) — l'entrée complète est
   *   exclue des tirages suivants.
   * - Entrée « (au choix) » : le joueur précise le domaine, ex.
   *   « Arme à distance (au choix) » → « Arme à distance (fusil) » (p.111).
   */
  static async #onAtoutPick(event, target) {
    const draw = this.draft.atoutDraw;
    const entry = target.dataset.name;
    if (!draw || !draw.options.includes(entry)) return;

    let name = entry;
    if (entry.includes(" ou ")) {
      const half = await this._promptHalf(entry.split(" ou ").map(s => s.trim()));
      if (!half) return;                       // annulé : le tirage reste en attente
      name = half;
    }
    if (NEEDS_PRECISION.test(name)) {
      const precision = await this._promptPrecision(name);
      if (precision === null) return;          // annulé
      name = precisedName(name, precision);
    }

    this.draft.atouts = [...(this.draft.atouts ?? []), { kind: draw.kind, name, entry }];
    this.draft.atoutDraw = null;
    await this._persist();
    this.render();
  }

  /** Choix définitif entre les deux moitiés d'une entrée « X ou Y » (RAW p.22). */
  async _promptHalf(halves: string[]): Promise<string | null> {
    return DialogV2.wait({
      window: { title: game.i18n.localize("BRIG.CharGen.atouts.halfTitle"), icon: "fa-solid fa-code-branch" },
      content: `<p>${game.i18n.localize("BRIG.CharGen.atouts.halfHint")}</p>`,
      buttons: halves.map((h, i) => ({ action: h, label: h, default: i === 0 })),
      rejectClose: false
    }).catch(() => null);
  }

  /** Précision du domaine d'une entrée « (au choix) » — ex. fusil, épées… */
  async _promptPrecision(name: string): Promise<string | null> {
    const result = await DialogV2.prompt({
      window: { title: game.i18n.localize("BRIG.CharGen.atouts.precisionTitle"), icon: "fa-solid fa-pen" },
      content: `
        <p>${game.i18n.format("BRIG.CharGen.atouts.precisionHint", { name })}</p>
        <input type="text" name="precision" placeholder="${game.i18n.localize("BRIG.CharGen.atouts.precisionPlaceholder")}" autofocus />`,
      ok: {
        label: game.i18n.localize("BRIG.CharGen.atouts.precisionOk"),
        callback: (event, button) => button.form.elements.precision.value
      },
      rejectClose: false
    }).catch(() => null);
    return result == null ? null : String(result).trim();
  }

  /** Recommencer les tirages — réservé au MJ / mode édition (RAW : tirage définitif). */
  static async #onAtoutsReset() {
    if (this.locksApply) return;
    this.draft.atouts = [];
    this.draft.atoutDraw = null;
    await this._persist();
    this.render();
  }

  /** Construit et crée (ou met à jour) le personnage. */
  async _commit() {
    const speciesDoc = await this._packDoc(PACK.species, this.draft.speciesId);
    const careerDoc = await this._packDoc(PACK.careers, this.draft.careerId);
    const archetypeDoc = await this._packDoc(PACK.archetypes, this.draft.archetypeId);

    // Initialiser les données de base pour _genTotals()
    this._baseMap = {};
    for (const k of CHARACTERISTIC_KEYS) this._baseMap[k] = speciesDoc?.system.base?.[k] ?? (k === "psy" ? 0 : 25);
    this._noPsy = speciesDoc?.system.noPsy ?? false;
    this._archetypeMods = archetypeDoc?.system.modifiers ?? null;

    const totals = this._genTotals();  // inclut modificateurs d'archétype et psyDraw

    const characteristics = {};
    for (const k of CHARACTERISTIC_KEYS) characteristics[k] = { value: totals[k], mod: 0, advances: 0 };
    const { pv, sf, pvBonus, sfBonus } = this._derivePvSf(totals, speciesDoc?.system?.special ?? []);

    const system = {
      characteristics, role: this.draft.role,
      speciesName: speciesDoc?.name ?? "", species: speciesDoc?.name ?? "",
      careerName: careerDoc?.name ?? "", lifestyle: careerDoc?.system.lifestyle ?? "ordinaire",
      destin: { value: speciesDoc?.system.destin ?? 2, max: speciesDoc?.system.destin ?? 2 },
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

      // Atouts de départ (RAW p.110) : *CNS*-1 atouts choisis à l'étape « Atouts »
      // (tirage 2D10 par catégorie, choix du joueur entre deux options).
      const numAtouts = atoutCount(totals.cns);
      const chosenAtouts = (this.draft.atouts ?? []).slice(0, numAtouts);
      if (chosenAtouts.length < numAtouts) {
        ui.notifications?.warn(game.i18n.format("BRIG.CharGen.atouts.incomplete", {
          done: chosenAtouts.length, total: numAtouts
        }));
      }
      for (const { kind, name, entry } of chosenAtouts) {
        const packRef = kind === "talent" ? talPack : specPack;
        // Nom final d'abord (moitié d'un « X ou Y »), sinon l'entrée générique
        // de la carrière (« Arme à distance (au choix) » pour un nom précisé).
        const idx = packRef?.index.find(i => i.name === name)
          ?? (entry ? packRef?.index.find(i => i.name === entry) : null);
        if (idx) {
          const obj = (await packRef.getDocument(idx._id)).toObject();
          obj.name = name;   // conserve la précision du joueur (ex. Arme à distance (fusil))
          items.push(obj);
        } else {
          items.push({ name, type: kind === "talent" ? "talent" : "specialty" });
        }
      }

      // Équipement de départ (RAW p.26/57) : équipement de BASE du groupe de
      // carrières + équipement ADDITIONNEL de la carrière. Recherche par nom
      // dans les compendiums.
      const baseEquipment = careerDoc.system.baseEquipment
        || BRIGANDYNE.factionBaseEquipment[careerDoc.system.faction] || "";
      const equipmentSource = [baseEquipment, careerDoc.system.startingEquipment ?? ""].join(";");
      if (equipmentSource.replace(/<[^>]+>/g, "").trim()) {
        const equipPacks = EQUIP_PACKS.map(id => game.packs.get(id)).filter(Boolean);
        for (const p of equipPacks) await p.getIndex();

        const plainText = equipmentSource
          .replace(/<\/li>/g, ";")
          .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const candidateNames = plainText.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 2);

        const grantedEquip = new Set();
        for (const rawName of candidateNames) {
          const normName = rawName.toLowerCase();
          if (grantedEquip.has(normName)) continue;   // base + carrière peuvent se recouper
          for (const p of equipPacks) {
            const entry = p.index.find(e => e.name.toLowerCase() === normName);
            if (entry) {
              items.push((await p.getDocument(entry._id)).toObject());
              grantedEquip.add(normName);
              break;
            }
          }
        }
      }
    }

    // Vices & vertus issus de l'archétype : fixes (auto) + choix (filtrés sur la liste de l'archétype)
    const grantTrait = (key) => {
      const isVice = !!BRIGANDYNE.vices[key];
      const isVertu = !!BRIGANDYNE.virtues[key];
      if (!isVice && !isVertu) return;
      const label = game.i18n.localize((isVice ? BRIGANDYNE.vices : BRIGANDYNE.virtues)[key]);
      // Effet miroir (RAW p.50) : +1 dans un trait = -1 dans le trait opposé.
      const mirrorKey = isVice
        ? BRIGANDYNE.traitMirrors[key]
        : Object.keys(BRIGANDYNE.traitMirrors).find(v => BRIGANDYNE.traitMirrors[v] === key);
      const mirrorLabel = mirrorKey
        ? game.i18n.localize((isVice ? BRIGANDYNE.virtues : BRIGANDYNE.vices)[mirrorKey])
        : "";
      const effect = mirrorLabel ? `<p>Effet miroir : <strong>${mirrorLabel} −1</strong>.</p>` : "";
      items.push({ name: label, type: "trait", system: { traitType: isVice ? "vice" : "vertu", rating: 1, god: "", effect } });
    };
    const fixedTraits = archetypeDoc?.system?.traitsFixed ?? [];
    const allowed = new Set(archetypeDoc?.system?.traitsChoices ?? []);
    const chosenTraits = (this.draft.archetypeTraits ?? []).filter(k => allowed.has(k));
    const grantedSeen = new Set();
    for (const key of [...fixedTraits, ...chosenTraits]) {
      if (grantedSeen.has(key)) continue;
      grantedSeen.add(key);
      grantTrait(key);
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
      if (this.locksApply) await setChargenLock(game.user, { complete: true, actorId: actor.id });
      ui.notifications?.info(game.i18n.format("BRIG.CharGen.created", { name: actor.name }));
      actor.sheet?.render(true);
    }
  }
}
