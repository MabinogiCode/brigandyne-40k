import { BRIGANDYNE } from "../../../config/config.js";
import { BrigCharGen } from "../../char-gen.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;

/**
 * Feuille d'acteur de base (ApplicationV2).
 */
export class BrigActorSheet extends (HandlebarsApplicationMixin(ActorSheetV2) as any) {
  declare actor: any;
  declare document: any;
  declare isEditable: boolean;
  declare element: HTMLElement;
  static DEFAULT_OPTIONS: any = {
    classes: ["brigandyne-40k", "sheet", "actor"],
    position: { width: 780, height: 740 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollChar: BrigActorSheet.#onRollChar,
      rollItem: BrigActorSheet.#onRollItem,
      itemCreate: BrigActorSheet.#onItemCreate,
      itemEdit: BrigActorSheet.#onItemEdit,
      itemDelete: BrigActorSheet.#onItemDelete,
      toggleEquip: BrigActorSheet.#onToggleEquip,
      adjust: BrigActorSheet.#onAdjust,
      editImage: BrigActorSheet.#onEditImage,
      charGen: BrigActorSheet.#onCharGen,
      advanceChar: BrigActorSheet.#onAdvanceChar,
      refundChar: BrigActorSheet.#onRefundChar,
      vehicleManeuver: BrigActorSheet.#onVehicleManeuver,
      vehicleFire: BrigActorSheet.#onVehicleFire,
      learnAtout: BrigActorSheet.#onLearnAtout,
      rest: BrigActorSheet.#onRest,
      endScenario: BrigActorSheet.#onEndScenario,
      salary: BrigActorSheet.#onSalary,
      corruption: BrigActorSheet.#onCorruption,
      recalcStats: BrigActorSheet.#onRecalcStats
    }
  };

  static #onLearnAtout(event, target) { this.actor.learnAtout(target.dataset.kind); }

  /** Repos : demande le nombre de nuits, puis régénère PV/SF. */
  static async #onRest(event, target) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const nights = await DialogV2.prompt({
      window: { title: game.i18n.localize("BRIG.Rest.title"), icon: "fa-solid fa-bed" },
      content: `<form class="brigandyne-40k"><div class="form-group"><label>${game.i18n.localize("BRIG.Rest.nights")}</label>
        <input type="number" name="n" value="1" min="1" /></div></form>`,
      ok: { label: game.i18n.localize("BRIG.Rest.do"), callback: (e, b) => Number(b.form.n.value) || 1 }, rejectClose: false
    } as any).catch(() => null);
    if (nights) this.actor.rest(nights);
  }

  static #onEndScenario(event, target) { this.actor.endScenario(); }
  static #onSalary(event, target) { this.actor.rollSalary(); }

  static async #onRecalcStats() {
    await this.actor.update({ "system.schemaVersion": game.system.version });
    ui.notifications?.info(game.i18n.format("BRIG.RecalcStats.done", { version: game.system.version }));
  }

  /** Test de Corruption : choisit dieu / source / caractéristique. */
  static async #onCorruption(event, target) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const gods = Object.entries(BRIGANDYNE.chaosGods)
      .map(([k, g]: [string, any]) => `<option value="${k}">${game.i18n.localize(g.label)}</option>`).join("");
    const content = `<form class="brigandyne-40k">
      <div class="form-group"><label>${game.i18n.localize("BRIG.Corruption.god")}</label>
        <select name="god"><option value="">—</option>${gods}</select></div>
      <div class="form-group"><label>${game.i18n.localize("BRIG.Corruption.source")}</label>
        <select name="source"><option value="10">${game.i18n.localize("BRIG.Corruption.minor")} (+10)</option>
        <option value="0" selected>${game.i18n.localize("BRIG.Corruption.median")} (0)</option>
        <option value="-10">${game.i18n.localize("BRIG.Corruption.major")} (−10)</option></select></div>
      <div class="form-group"><label>${game.i18n.localize("BRIG.Corruption.resistWith")}</label>
        <select name="characteristic"><option value="vol">${game.i18n.localize("BRIG.Char.vol.abbr")}</option>
        <option value="for">${game.i18n.localize("BRIG.Char.for.abbr")}</option></select></div></form>`;
    const res = await DialogV2.prompt({
      window: { title: game.i18n.localize("BRIG.Corruption.test"), icon: "fa-solid fa-skull" },
      content, ok: { label: game.i18n.localize("BRIG.Dialog.roll"), callback: (e, b) => ({
        god: b.form.god.value, source: b.form.source.value, characteristic: b.form.characteristic.value
      }) }, rejectClose: false
    } as any).catch(() => null);
    if (res) this.actor.rollCorruption(res);
  }

  /** Trouve le personnage opérateur (personnage assigné ou jeton contrôlé). */
  _operator(): any {
    return game.user.character
      || canvas.tokens?.controlled?.find(t => (t.actor?.type as string) === "character")?.actor
      || null;
  }

  static #onVehicleManeuver(event, target) {
    const char = this._operator();
    if (!char) return ui.notifications?.warn(game.i18n.localize("BRIG.Warn.noOperator"));
    const tec = char.system.characteristics.tec;
    const maneuver = this.actor.system.maneuver || 0;
    char._performTest({
      label: game.i18n.localize("BRIG.Vehicle.maneuver"), flavor: this.actor.name,
      characteristic: "tec", base: tec.total,
      modifiers: maneuver ? [{ label: game.i18n.localize("BRIG.Vehicle.maneuverability"), value: maneuver }] : [],
      rollType: "test"
    }, { event });
  }

  static #onVehicleFire(event, target) {
    const char = this._operator();
    if (!char) return ui.notifications?.warn(game.i18n.localize("BRIG.Warn.noOperator"));
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item) char.rollWeaponAttack(item, { event });
  }

  static #onCharGen(event, target) {
    new BrigCharGen({ actor: this.actor }).render(true);
  }
  static #onAdvanceChar(event, target) { this.actor.advanceCharacteristic(target.dataset.char); }
  static #onRefundChar(event, target) { this.actor.refundCharacteristic(target.dataset.char); }

  static async #onEditImage(event, target) {
    const attr = target.dataset.edit || "img";
    const current = foundry.utils.getProperty(this.document, attr) as string | undefined;
    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: "image", current,
      callback: path => this.document.update({ [attr]: path })
    });
    return fp.browse();
  }

  tabGroups = { primary: "main" };

  /** Onglets de la feuille (surchargé par sous-classe). */
  get sheetTabs() {
    return [
      { id: "main", icon: "fa-solid fa-chart-simple", label: "BRIG.Tab.main" },
      { id: "combat", icon: "fa-solid fa-crosshairs", label: "BRIG.Tab.combat" },
      { id: "skills", icon: "fa-solid fa-book", label: "BRIG.Tab.skills" },
      { id: "powers", icon: "fa-solid fa-hand-sparkles", label: "BRIG.Tab.powers" },
      { id: "bio", icon: "fa-solid fa-feather", label: "BRIG.Tab.bio" }
    ];
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.actor = this.actor;
    ctx.system = this.actor.system;
    ctx.config = BRIGANDYNE;
    ctx.editable = this.isEditable;
    ctx.limited = this.actor.limited;
    ctx.items = this._organizeItems();
    ctx.tabs = this.sheetTabs.map(t => ({ ...t, active: this.tabGroups.primary === t.id }));
    ctx.activeTab = this.tabGroups.primary;
    ctx.characteristics = this._characteristicsForDisplay();
    ctx.enrichedBio = await TextEditor.implementation.enrichHTML(this.actor.system.biography ?? "", {
      relativeTo: this.actor, secrets: this.actor.isOwner
    });
    return ctx;
  }

  /** Caractéristiques mises en forme pour l'affichage. */
  _characteristicsForDisplay() {
    const out = {};
    const chars = this.actor.system.characteristics ?? {};
    for (const [k, def] of Object.entries(BRIGANDYNE.characteristics)) {
      const c = chars[k];
      if (!c) continue;
      out[k] = { key: k, ...(def as any), value: c.value, total: c.total, bonus: c.bonus, mod: c.mod, advances: c.advances ?? 0 };
    }
    return out;
  }

  /** Range les objets par catégorie. */
  _organizeItems() {
    const groups = {
      weapon: [], armor: [], ammunition: [], equipment: [], augmentation: [],
      specialty: [], talent: [], trait: [], mutation: [], criticalInjury: [],
      psychicPower: [], faithAct: [], species: [], career: []
    };
    for (const item of this.actor.items) {
      (groups[item.type] ??= []).push(item);
    }
    for (const k of Object.keys(groups)) groups[k].sort((a, b) => a.name.localeCompare(b.name));
    return groups;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    // Navigation par onglets (sans re-render)
    const root = this.element;
    root.querySelectorAll("[data-action='tab']").forEach(a => {
      a.addEventListener("click", ev => {
        const tab = (ev.currentTarget as HTMLElement).dataset.tab;
        this.tabGroups.primary = tab;
        root.querySelectorAll("[data-action='tab']").forEach(n => n.classList.toggle("active", (n as HTMLElement).dataset.tab === tab));
        root.querySelectorAll(".tab[data-tab]").forEach(s => s.classList.toggle("active", (s as HTMLElement).dataset.tab === tab));
      });
    });
    // Clic droit sur un objet = éditer ; molette sur ressources, etc. (extension future)
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */
  static #onRollChar(event, target) {
    this.actor.rollCharacteristic(target.dataset.char, { event });
  }

  static #onRollItem(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    item?.use({ event });
  }

  static async #onItemCreate(event, target) {
    const type = target.dataset.type || "equipment";
    const name = game.i18n.format("DOCUMENT.New", { type: game.i18n.localize(`TYPES.Item.${type}`) });
    await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
  }

  static #onItemEdit(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    item?.sheet.render(true);
  }

  static async #onItemDelete(event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(id);
    if (!item) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("BRIG.Confirm.deleteTitle") },
      content: `<p>${game.i18n.format("BRIG.Confirm.deleteItem", { name: item.name })}</p>`
    });
    if (ok) item.delete();
  }

  static async #onToggleEquip(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item && "equipped" in item.system) await item.update({ "system.equipped": !item.system.equipped });
  }

  static async #onAdjust(event, target) {
    const path = target.dataset.path;
    const delta = Number(target.dataset.delta) || 0;
    const cur = (foundry.utils.getProperty(this.actor, path) as number) ?? 0;
    await this.actor.update({ [path]: cur + delta });
  }
}
