import { BRIGANDYNE } from "../config/config.mjs";
import { CHARACTERISTIC_KEYS } from "../data/fields.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PACK = {
  species: "brigandyne-40k.species",
  careers: "brigandyne-40k.careers",
  specialties: "brigandyne-40k.specialties",
  talents: "brigandyne-40k.talents"
};
const DETAIL_KEYS = ["age", "height", "weight", "eyes", "hair", "gender", "homeworld", "motivation"];

/**
 * Assistant (wizard) de création de personnage.
 * - Multi-étapes : Identité → Caractéristiques → Détails → Récapitulatif.
 * - Annulable : aucun acteur n'est créé tant que « Terminer » n'est pas validé.
 * - Crée le personnage et le rattache au joueur courant (propriétaire + perso assigné).
 * - Mode édition si un `actor` est fourni (met à jour au lieu de créer).
 */
export class BrigCharGen extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
    this.steps = ["identity", "characteristics", "details", "summary"];
    this.step = 0;
    this.draft = {
      name: this.actor?.name ?? game.i18n.localize("BRIG.CharGen.defaultName"),
      speciesId: null, careerId: null, role: this.actor?.system?.role ?? "secondRole",
      chars: {}, details: { ...(this.actor?.system?.details ?? {}) }
    };
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["brigandyne-40k", "char-gen", "wizard"],
    position: { width: 640, height: "auto" },
    window: { title: "BRIG.CharGen.title", icon: "fa-solid fa-wand-magic-sparkles" },
    actions: {
      wizNext: BrigCharGen.#onNext,
      wizPrev: BrigCharGen.#onPrev,
      wizCancel: BrigCharGen.#onCancel,
      wizFinish: BrigCharGen.#onFinish,
      wizGoto: BrigCharGen.#onGoto
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

  async _prepareContext() {
    const sp = game.packs.get(PACK.species); await sp?.getIndex();
    const ca = game.packs.get(PACK.careers); await ca?.getIndex();
    const species = sp ? sp.index.contents.map(e => ({ id: e._id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name)) : [];
    const careers = ca ? ca.index.contents.map(e => ({ id: e._id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name)) : [];

    const speciesDoc = await this._packDoc(PACK.species, this.draft.speciesId);
    const careerDoc = await this._packDoc(PACK.careers, this.draft.careerId);

    // Caractéristiques effectives (base d'espèce + ajustements du brouillon)
    const chars = CHARACTERISTIC_KEYS.map(k => {
      const base = speciesDoc?.system.base?.[k] ?? (k === "psy" ? 0 : 25);
      const value = this.draft.chars[k] ?? base;
      return { key: k, abbr: BRIGANDYNE.characteristics[k].abbrev, label: BRIGANDYNE.characteristics[k].label, base, value, bonus: Math.floor(value / 10) };
    });

    const b = k => Math.floor((chars.find(c => c.key === k)?.value ?? 0) / 10);
    const pv = 8 + b("end") + b("for");
    const sf = 8 + b("vol");

    return {
      noPacks: !species.length || !careers.length,
      stages: this.steps.map((id, i) => ({ id, i, active: i === this.step, done: i < this.step, label: game.i18n.localize(`BRIG.CharGen.step.${id}`) })),
      stepId: this.stepId, first: this.step === 0, last: this.step === this.steps.length - 1, editMode: !!this.actor,
      draft: this.draft, species, careers, roles: BRIGANDYNE.roles,
      speciesName: speciesDoc?.name, destin: speciesDoc?.system.destin,
      careerName: careerDoc?.name, lifestyle: careerDoc ? game.i18n.localize(BRIGANDYNE.lifestyles[careerDoc.system.lifestyle]?.label ?? "") : "",
      specialties: careerDoc?.system.specialties ?? [], talents: careerDoc?.system.talents ?? [],
      chars, pv, sf, details: this.draft.details, detailKeys: DETAIL_KEYS
    };
  }

  _onRender() {
    // Rafraîchir l'aperçu quand on change d'espèce/carrière
    this.element.querySelectorAll("[data-refresh]").forEach(sel =>
      sel.addEventListener("change", () => { this._capture(); this.render(); }));
  }

  /** Lit les champs de l'étape courante dans le brouillon. */
  _capture() {
    const el = this.element; if (!el) return;
    const get = n => el.querySelector(`[name="${n}"]`);
    if (this.stepId === "identity") {
      if (get("name")) this.draft.name = get("name").value;
      if (get("speciesId")) this.draft.speciesId = get("speciesId").value || null;
      if (get("careerId")) this.draft.careerId = get("careerId").value || null;
      if (get("role")) this.draft.role = get("role").value;
    } else if (this.stepId === "characteristics") {
      for (const k of CHARACTERISTIC_KEYS) { const i = get(`char.${k}`); if (i) this.draft.chars[k] = Number(i.value) || 0; }
    } else if (this.stepId === "details") {
      for (const d of DETAIL_KEYS) { const i = get(`details.${d}`); if (i) this.draft.details[d] = i.value; }
    }
  }

  static #onNext() { this._capture(); if (this.step < this.steps.length - 1) this.step++; this.render(); }
  static #onPrev() { this._capture(); if (this.step > 0) this.step--; this.render(); }
  static #onGoto(event, target) { this._capture(); this.step = Number(target.dataset.i) || 0; this.render(); }
  static #onCancel() { this.close(); }
  static async #onFinish() { this._capture(); await this._commit(); this.close(); }

  /** Construit et crée (ou met à jour) le personnage. */
  async _commit() {
    const speciesDoc = await this._packDoc(PACK.species, this.draft.speciesId);
    const careerDoc = await this._packDoc(PACK.careers, this.draft.careerId);

    const characteristics = {};
    for (const k of CHARACTERISTIC_KEYS) {
      const base = speciesDoc?.system.base?.[k] ?? (k === "psy" ? 0 : 25);
      characteristics[k] = { value: this.draft.chars[k] ?? base, mod: 0, advances: 0 };
    }
    const b = k => Math.floor((characteristics[k].value) / 10);
    const pv = 8 + b("end") + b("for");
    const sf = 8 + b("vol");

    const system = {
      characteristics, role: this.draft.role,
      speciesName: speciesDoc?.name ?? "", species: speciesDoc?.name ?? "",
      careerName: careerDoc?.name ?? "", lifestyle: careerDoc?.system.lifestyle ?? "ordinaire",
      destin: { value: speciesDoc?.system.destin ?? 2, max: speciesDoc?.system.destin ?? 2 },
      pv: { value: pv, max: pv, bonus: 0 }, sf: { value: sf, max: sf, bonus: 0 },
      details: this.draft.details
    };

    // Objets : carrière + spécialités + talents
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

    // Création + rattachement au joueur courant
    const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };
    const actor = await Actor.create({ name: this.draft.name, type: "character", ownership, system, items });
    if (actor) {
      await game.user.update({ character: actor.id });
      ui.notifications?.info(game.i18n.format("BRIG.CharGen.created", { name: actor.name }));
      actor.sheet?.render(true);
    }
  }
}
