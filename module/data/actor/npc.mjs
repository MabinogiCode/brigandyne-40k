import { BaseActorModel } from "./base-actor.mjs";
import { fields, int, str, bool, html } from "../fields.mjs";

/**
 * PNJ / créature (bestiaire).
 * Bloc de stats simplifié : COM/TIR, Init, Prot, PV, Dégâts, Spécial.
 */
export class NpcModel extends BaseActorModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      subtitle: str(""),                 // description courte (« Un ange de la mort… »)
      faction: str("chaos"),
      fear: int(0, { min: 0 }),          // PEUR (X)
      threat: str(""),                   // niveau de menace / récompense XP
      attacksText: html(""),             // dégâts/armes en texte libre (import bestiaire)
      specialAbilities: html(""),        // capacités spéciales en texte libre
      isSwarm: bool(false)               // Nuée
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    // Modificateur défensif au contact (MODO) = 50 - COM, pour les attaquants
    this.defenseMod = 50 - this.characteristics.com.total;
  }
}
