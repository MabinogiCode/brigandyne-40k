import { BrigActorSheet } from "./base-actor-sheet.js";

/**
 * Feuille de Personnage joueur.
 */
export class BrigCharacterSheet extends BrigActorSheet {
  static override DEFAULT_OPTIONS: any = {
    classes: ["character"],
    position: { width: 800, height: 760 }
  };

  static PARTS = {
    body: { template: "systems/brigandyne-40k/templates/actor/character-sheet.hbs", scrollable: [".sheet-body"] }
  };
}
