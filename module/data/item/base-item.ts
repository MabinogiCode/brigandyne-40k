import { fields, str, html, int, bool, num } from "../fields.js";

/**
 * Modèle de base partagé par tous les objets.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class BaseItemModel extends (foundry.abstract.TypeDataModel as any) {
  declare description: string;
  declare gmNotes: string;
  declare source: string;

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
export class PhysicalItemModel extends (BaseItemModel as any) {
  declare quantity: number;
  declare weight: number;
  declare price: number;
  declare availability: string;
  declare equipped: boolean;
  declare carried: boolean;
  declare container: string;

  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantity: int(1, { min: 0 }),
      weight: num(0, { min: 0 }),
      price: int(0, { min: 0 }),
      availability: str(""),
      equipped: bool(false),
      carried: bool(true),
      container: str("")
    };
  }

  get totalWeight(): number {
    return (this.weight ?? 0) * (this.quantity ?? 1);
  }
}
