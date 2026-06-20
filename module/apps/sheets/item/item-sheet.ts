import { BRIGANDYNE } from "../../../config/config.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;

/**
 * Feuille d'objet générique (pilotée par le type).
 */
export class BrigItemSheet extends (HandlebarsApplicationMixin(ItemSheetV2) as any) {
  declare actor: any;
  declare item: any;
  declare document: any;
  declare isEditable: boolean;
  declare element: HTMLElement;
  static DEFAULT_OPTIONS = {
    classes: ["brigandyne-40k", "sheet", "item"],
    position: { width: 540, height: 580 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      qualityAdd: BrigItemSheet.#onQualityAdd,
      qualityDelete: BrigItemSheet.#onQualityDelete,
      editImage: BrigItemSheet.#onEditImage
    }
  };

  static async #onEditImage(event, target) {
    const attr = target.dataset.edit || "img";
    const current = foundry.utils.getProperty(this.document, attr) as string | undefined;
    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: "image", current,
      callback: path => this.document.update({ [attr]: path })
    });
    return fp.browse();
  }

  static PARTS = {
    body: { template: "systems/brigandyne-40k/templates/item/item-sheet.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.item = this.item;
    ctx.system = this.item.system;
    ctx.config = BRIGANDYNE;
    ctx.editable = this.isEditable;
    ctx.type = this.item.type;
    ctx.isPhysical = ["weapon", "armor", "ammunition", "equipment", "augmentation"].includes(this.item.type);
    ctx.flags = Object.fromEntries(
      ["weapon", "armor", "ammunition", "equipment", "augmentation", "specialty", "talent",
       "trait", "mutation", "criticalInjury", "psychicPower", "faithAct", "species", "career"]
        .map(t => [t, this.item.type === t])
    );
    ctx.enrichedDescription = await TextEditor.implementation.enrichHTML(this.item.system.description ?? "", {
      relativeTo: this.item, secrets: this.item.isOwner
    });
    // Qualités disponibles (filtrées selon mêlée/distance pour les armes)
    if (["weapon", "armor"].includes(this.item.type)) {
      const wt = this.item.system.weaponType;
      ctx.availableQualities = Object.entries(BRIGANDYNE.weaponQualities)
        .filter(([, q]: [string, any]) => this.item.type === "armor" ? true
          : (q.target === "both" || q.target === wt))
        .map(([key, q]: [string, any]) => ({ key, label: q.label, hasValue: q.hasValue }));
    }
    ctx.charChoices = BRIGANDYNE.characteristics;
    return ctx;
  }

  static async #onQualityAdd(event, target) {
    const list = foundry.utils.deepClone(this.item.system.qualities ?? []);
    list.push({ key: "perceArmure", value: null });
    await this.item.update({ "system.qualities": list });
  }

  static async #onQualityDelete(event, target) {
    const idx = Number(target.dataset.index);
    const list = foundry.utils.deepClone(this.item.system.qualities ?? []);
    list.splice(idx, 1);
    await this.item.update({ "system.qualities": list });
  }
}
