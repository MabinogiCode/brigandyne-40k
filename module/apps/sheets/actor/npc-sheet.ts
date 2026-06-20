import { BrigActorSheet } from "./base-actor-sheet.js";

/**
 * Feuille de PNJ / créature.
 */
export class BrigNpcSheet extends BrigActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["npc"],
    position: { width: 680, height: 640 }
  };

  static PARTS = {
    body: { template: "systems/brigandyne-40k/templates/actor/npc-sheet.hbs", scrollable: [".sheet-body"] }
  };

  get sheetTabs() {
    return [
      { id: "main", icon: "fa-solid fa-skull", label: "BRIG.Tab.statblock" },
      { id: "powers", icon: "fa-solid fa-hand-sparkles", label: "BRIG.Tab.powers" },
      { id: "bio", icon: "fa-solid fa-feather", label: "BRIG.Tab.bio" }
    ];
  }
}
