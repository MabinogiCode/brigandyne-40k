import { BaseActorModel } from "./base-actor.mjs";
import { fields, int, str, bool, html, choice } from "../fields.mjs";

/**
 * Personnage joueur.
 */
export class CharacterModel extends BaseActorModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      // Les personnages sont des Premiers rôles par défaut
      role: choice({ premierRole: "BRIG.Role.premierRole", secondRole: "BRIG.Role.secondRole", figurant: "BRIG.Role.figurant" }, "premierRole"),
      species: str(""),
      speciesName: str(""),
      careerName: str(""),
      xp: new fields.SchemaField({
        total: int(0, { min: 0 }),
        spent: int(0, { min: 0 })
      }),
      faith: new fields.SchemaField({
        devoted: bool(false)        // peut canaliser la Vraie Foi
      }),
      details: new fields.SchemaField({
        age: str(""),
        height: str(""),
        weight: str(""),
        eyes: str(""),
        hair: str(""),
        gender: str(""),
        homeworld: str(""),
        deity: str(""),
        motivation: str("")
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.xp.available = (this.xp.total ?? 0) - (this.xp.spent ?? 0);
    // Actes de Foi par jour = VOL_bonus / 2
    this.faith.actsPerDay = Math.floor(this.characteristics.vol.bonus / 2);
  }
}
