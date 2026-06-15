import { BRIGANDYNE, } from "../config/config.mjs";
import { CHARACTERISTIC_KEYS } from "../data/fields.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PACK = {
  species: "brigandyne-40k.species",
  careers: "brigandyne-40k.careers",
  specialties: "brigandyne-40k.specialties",
  talents: "brigandyne-40k.talents"
};

/**
 * Assistant de création de personnage : espèce → carrière → application.
 */
export class BrigCharGen extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    this.selection = { species: null, career: null };
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["brigandyne-40k", "char-gen"],
    position: { width: 560, height: "auto" },
    window: { title: "BRIG.CharGen.title", icon: "fa-solid fa-wand-magic-sparkles" },
    form: { handler: BrigCharGen.#onSubmit, closeOnSubmit: true },
    actions: { preview: BrigCharGen.#onPreview }
  };

  static PARTS = { body: { template: "systems/brigandyne-40k/templates/apps/char-gen.hbs" } };

  async _prepareContext() {
    const sp = game.packs.get(PACK.species); await sp?.getIndex();
    const ca = game.packs.get(PACK.careers); await ca?.getIndex();
    const species = sp ? sp.index.contents.map(e => ({ id: e._id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name)) : [];
    const careers = ca ? ca.index.contents.map(e => ({ id: e._id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name)) : [];

    let preview = null;
    if (this.selection.species) {
      const doc = await sp.getDocument(this.selection.species);
      if (doc) preview = {
        speciesName: doc.name, destin: doc.system.destin,
        chars: CHARACTERISTIC_KEYS.map(k => ({ key: k, abbr: BRIGANDYNE.characteristics[k].abbrev, value: doc.system.base?.[k] ?? 25 }))
      };
    }
    return {
      actorName: this.actor?.name, species, careers,
      selSpecies: this.selection.species, selCareer: this.selection.career, preview,
      noPacks: !species.length || !careers.length
    };
  }

  static async #onPreview(event, target) {
    const form = target.closest("form");
    this.selection.species = form.elements.species.value || null;
    this.selection.career = form.elements.career.value || null;
    this.render();
  }

  static async #onSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    return this.applySelection(data.species, data.career);
  }

  /** Applique une espèce et une carrière à l'acteur (logique réutilisable). */
  async applySelection(speciesId, careerId) {
    if (!this.actor) return;
    const sp = game.packs.get(PACK.species);
    const ca = game.packs.get(PACK.careers);
    const speciesDoc = speciesId ? await sp.getDocument(speciesId) : null;
    const careerDoc = careerId ? await ca.getDocument(careerId) : null;

    const updates = {};
    if (speciesDoc) {
      for (const k of CHARACTERISTIC_KEYS) updates[`system.characteristics.${k}.value`] = speciesDoc.system.base?.[k] ?? 25;
      updates["system.speciesName"] = speciesDoc.name;
      updates["system.species"] = speciesDoc.name;
      updates["system.destin.value"] = speciesDoc.system.destin ?? 2;
      updates["system.destin.max"] = speciesDoc.system.destin ?? 2;
    }
    if (careerDoc) {
      updates["system.careerName"] = careerDoc.name;
      updates["system.lifestyle"] = careerDoc.system.lifestyle ?? "ordinaire";
    }
    // PV / SF de départ (interprétation : base 8 + bonus)
    if (speciesDoc) {
      const b = k => Math.floor((speciesDoc.system.base?.[k] ?? 25) / 10);
      const pv = 8 + b("end") + b("for");
      const sf = 8 + b("vol");
      updates["system.pv.value"] = pv; updates["system.pv.max"] = pv;
      updates["system.sf.value"] = sf; updates["system.sf.max"] = sf;
    }
    await this.actor.update(updates);

    // Objets à créer : carrière, spécialités & talents de la carrière
    const toCreate = [];
    if (careerDoc) {
      toCreate.push(careerDoc.toObject());
      const specPack = game.packs.get(PACK.specialties); await specPack?.getIndex();
      const talPack = game.packs.get(PACK.talents); await talPack?.getIndex();
      for (const name of (careerDoc.system.specialties ?? [])) {
        const e = specPack?.index.find(i => i.name === name);
        toCreate.push(e ? (await specPack.getDocument(e._id)).toObject() : { name, type: "specialty" });
      }
      for (const name of (careerDoc.system.talents ?? [])) {
        const e = talPack?.index.find(i => i.name === name);
        toCreate.push(e ? (await talPack.getDocument(e._id)).toObject() : { name, type: "talent" });
      }
    }
    if (toCreate.length) await this.actor.createEmbeddedDocuments("Item", toCreate);

    ui.notifications?.info(game.i18n.format("BRIG.CharGen.done", { name: this.actor.name }));
    this.actor.sheet?.render(true);
  }
}
