import { fields, int, num, str, bool, html, resource, choice } from "../fields.js";

/**
 * Véhicule / vaisseau spatial.
 * `pv` = Structure (compatible barre de jeton primaire). `protection` = Blindage.
 */
export class VehicleModel extends (foundry.abstract.TypeDataModel as any) {
  static defineSchema() {
    return {
      vehicleType: choice({ terrestre: "Terrestre", volant: "Volant", spatial: "Spatial" }, "terrestre"),
      subtitle: str(""),
      size: int(2, { min: 1, max: 5 }),       // gabarit / Taille (détermine le nb d'armes)
      maneuver: int(0),                        // Maniabilité (% aux manœuvres)
      speed: int(0),                           // Vitesse (s'ajoute au RU en accélération)
      places: int(2, { min: 0 }),             // nombre de places
      pilotsMin: int(1, { min: 1 }),          // pilotes minimum
      pv: resource(20),                        // Structure
      protection: new fields.SchemaField({ base: int(0, { min: 0 }), mod: int(0) }),
      resistance: bool(true),                  // résistance aux armes à échelle humaine
      price: int(0, { min: 0 }),
      specialText: str(""),
      biography: html(""),
      gmNotes: html("")
    };
  }

  prepareDerivedData() {
    this.protection.value = (this.protection.base ?? 0) + (this.protection.mod ?? 0);
  }
}
