import { BrigActorSheet } from "./base-actor-sheet.ts";

/**
 * Feuille de véhicule / vaisseau.
 */
export class BrigVehicleSheet extends BrigActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["vehicle"],
    position: { width: 640, height: 560 }
  };

  static PARTS = {
    body: { template: "systems/brigandyne-40k/templates/actor/vehicle-sheet.hbs", scrollable: [".sheet-body"] }
  };

  get sheetTabs() {
    return [
      { id: "main", icon: "fa-solid fa-truck-monster", label: "BRIG.Tab.main" },
      { id: "bio", icon: "fa-solid fa-feather", label: "BRIG.Tab.bio" }
    ];
  }
}
