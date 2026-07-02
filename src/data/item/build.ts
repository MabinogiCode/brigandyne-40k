import { BaseItemModel } from "./base-item.ts";
import { fields, str, int, num, bool, choice, html, characteristicsSchema } from "../fields.ts";

/**
 * Archétype de personnalité (symbolisé par un animal).
 * Applique des modificateurs fixes aux caractéristiques à la création.
 */
export class ArchetypeModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      animal: str(""),
      modifiers: characteristicsSchema(0),       // modificateurs de carac FIXES
      modChoices: new fields.ArrayField(new fields.SchemaField({   // choix « X ou Y » de carac
        chars: new fields.ArrayField(str("")),
        value: int(0)
      })),
      traitsFixed: new fields.ArrayField(str("")),   // vices/vertus accordés d'office (+1)
      traitsChoices: new fields.ArrayField(str("")), // vices/vertus parmi lesquels choisir
      traitsChoiceCount: int(1, { min: 0 }),         // nombre à choisir dans traitsChoices
      talents: new fields.ArrayField(str("")),       // talents accessibles (informatif)
      description: html("")
    };
  }
}

/**
 * Espèce (Humain, Squat, Ogryn…).
 */
export class SpeciesModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      base: characteristicsSchema(25),
      limits: characteristicsSchema(null, { nullable: true }),
      destin: int(2, { min: 0 }),
      special: new fields.ArrayField(str("")),  // clés de speciesTraits
      lifespan: str(""),
      sizeNote: str(""),
      noPsy: bool(false)
    };
  }
}

/**
 * Carrière (par Adeptus).
 */
export class CareerModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      faction: str("civils"),
      quote: str(""),
      advances: characteristicsSchema(0),        // allocations 0-6 par caractéristique
      lifestyle: str("ordinaire"),
      specialties: new fields.ArrayField(str("")),
      talents: new fields.ArrayField(str("")),
      startingEquipment: html(""),
      // Équipement de base du groupe (RAW p.26/57) : si vide, on retombe sur
      // BRIGANDYNE.factionBaseEquipment[faction].
      baseEquipment: html("")
    };
  }
}

/**
 * Spécialité (atout donnant un bonus ciblé à une caractéristique).
 */
export class SpecialtyModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      specialtyType: choice({ standard: "BRIG.SpecialtyType.standard", martiale: "BRIG.SpecialtyType.martiale", occulte: "BRIG.SpecialtyType.occulte" }, "standard"),
      characteristic: str(""),       // caractéristique liée
      bonus: int(10),                // +5 / +10 / +20
      effect: str("")
    };
  }
}

/**
 * Talent.
 */
export class TalentModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      usage: choice({ permanent: "Permanent", scene: "1×/scène", jour: "1×/jour", combat: "Combat", autre: "Autre" }, "permanent"),
      characteristic: str(""),       // pour Doué (CNS), etc.
      effect: html(""),
      taken: int(1, { min: 1 })      // nombre de fois acquis
    };
  }
}

/**
 * Trait : Vice, Vertu, capacité spéciale de créature (PEUR, Nuée…), particularité.
 */
export class TraitModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      traitType: choice({ vice: "BRIG.TraitType.vice", vertu: "BRIG.TraitType.vertu", capacite: "BRIG.TraitType.capacite", particularite: "BRIG.TraitType.particularite" }, "capacite"),
      rating: int(0),                // niveau de Vice/Vertu, ou rang (PEUR (X))
      god: str(""),                  // dieu du Chaos associé pour un Vice
      effect: html("")
    };
  }
}

/**
 * Mutation : Grâce ou Fardeau.
 */
export class MutationModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      mutationType: choice({ grace: "Grâce", fardeau: "Fardeau" }, "fardeau"),
      effect: html("")
    };
  }
}

/**
 * Blessure grave / handicap.
 */
export class CriticalInjuryModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      location: str(""),
      severity: int(1, { min: 1 }),
      condition: str(""),            // condition liée éventuelle
      effect: html("")
    };
  }
}
