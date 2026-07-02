import { PhysicalItemModel } from "./base-item.ts";
import { fields, str, int, num, bool, choice, qualitiesField } from "../fields.ts";

/**
 * Arme (mêlée ou distance).
 * Dégâts mêlée  = RU + (bonus de FOR ± modificateur)   → damageBase "for"
 * Dégâts distance = RU + bonus fixe                     → damageBase "flat"
 */
export class WeaponModel extends PhysicalItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      weaponType: choice({ melee: "BRIG.WeaponType.melee", ranged: "BRIG.WeaponType.ranged" }, "melee"),
      group: str("lame"),
      attackChar: str(""),                 // "com"/"tir" — vide = auto selon weaponType
      // Dégâts
      damageBase: choice({ for: "FOR", flat: "Fixe" }, "for"),
      damageMod: int(0),                   // *FOR*+2 → +2 ; arme distance +4 → damageBase=flat, damageMod=4
      damageType: str("physique"),
      // Mêlée
      reach: str("C"),
      hands: int(1, { min: 1, max: 2 }),
      // Distance
      range: num(20, { min: 0 }),          // portée utile (m)
      magazine: int(0, { min: 0 }),        // taille du chargeur (0 = sans objet)
      currentAmmo: int(0, { min: 0 }),
      ammoType: str(""),
      reload: int(1, { min: 0 }),          // tours de rechargement
      // Qualités
      qualities: qualitiesField(),
      specialText: str(""),                // texte d'origine, fidélité
      // État
      equippedHands: int(0, { min: 0, max: 2 })
    };
  }

  get isMelee() { return this.weaponType === "melee"; }
  get isRanged() { return this.weaponType === "ranged"; }

  /** Caractéristique d'attaque effective. */
  get rollChar() {
    return this.attackChar || (this.isMelee ? "com" : "tir");
  }

  /** Renvoie le rang d'une qualité, ou null si absente. */
  qualityValue(key) {
    const q = this.qualities.find(q => q.key === key);
    return q ? (q.value ?? true) : null;
  }
  hasQuality(key) {
    return this.qualities.some(q => q.key === key);
  }
}

/**
 * Armure.
 */
export class ArmorModel extends PhysicalItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      protection: int(1, { min: 0 }),
      coverage: choice({ partielle: "BRIG.Armor.partielle", complete: "BRIG.Armor.complete", bonus: "BRIG.Armor.bonus" }, "complete"),
      initiativeMod: int(0),               // Init -X (valeur négative)
      mouMod: int(0),                      // MOU -X% (valeur négative)
      qualities: qualitiesField(),
      specialText: str(""),
      longToDon: bool(false)
    };
  }

  qualityValue(key) {
    const q = this.qualities.find(q => q.key === key);
    return q ? (q.value ?? true) : null;
  }
  hasQuality(key) {
    return this.qualities.some(q => q.key === key);
  }
}

/**
 * Munition.
 */
export class AmmunitionModel extends PhysicalItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      ammoType: str(""),
      effect: str(""),
      qualities: qualitiesField()
    };
  }
}

/**
 * Équipement divers (outils, nourriture, drogues, techno…).
 */
export class EquipmentModel extends PhysicalItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      category: str(""),
      effect: str("")
    };
  }
}

/**
 * Augmentation / prothèse / organe bionique / système implanté.
 */
export class AugmentationModel extends PhysicalItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      augType: choice({ prothese: "Prothèse", organe: "Organe bionique", systeme: "Système implanté" }, "prothese"),
      location: str(""),
      effect: str(""),
      installed: bool(true)
    };
  }
}
