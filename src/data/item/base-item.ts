import { fields, str, html, int, bool, num } from "../fields.ts";

/**
 * Modèle de base partagé par tous les objets.
 */
export class BaseItemModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: html(),
      gmNotes: html(),
      source: str("")
    };
  }
}

/**
 * Objet physique : possède quantité, poids, prix, état équipé.
 */
export class PhysicalItemModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantity: int(1, { min: 0 }),
      weight: num(0, { min: 0 }),          // encombrement (kg)
      price: int(0, { min: 0 }),           // Trônes Gelt
      availability: str(""),               // disponibilité / rareté
      equipped: bool(false),
      carried: bool(true),
      container: str("")                   // id d'un objet conteneur éventuel
    };
  }

  get totalWeight() {
    return (this.weight ?? 0) * (this.quantity ?? 1);
  }
}
