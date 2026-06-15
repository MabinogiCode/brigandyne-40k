import { BrigActorSheet } from "./base-actor-sheet.mjs";

/**
 * Feuille de Personnage joueur.
 */
export class BrigCharacterSheet extends BrigActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["character"],
    position: { width: 800, height: 760 }
  };

  static PARTS = {
    body: { template: "systems/brigandyne-40k/templates/actor/character-sheet.hbs", scrollable: [".sheet-body"] }
  };
}
