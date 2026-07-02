import { BaseItemModel } from "./base-item.ts";
import { fields, str, int, bool, choice, html } from "../fields.ts";

/**
 * Pouvoir psychique (Psyker).
 * Le jet se fait en PSY avec le modificateur "difficulty".
 */
export class PsychicPowerModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      discipline: choice({
        generique: "BRIG.Discipline.generique",
        biomancie: "BRIG.Discipline.biomancie",
        divination: "BRIG.Discipline.divination",
        pyromancie: "BRIG.Discipline.pyromancie",
        telekinesie: "BRIG.Discipline.telekinesie",
        telepathie: "BRIG.Discipline.telepathie"
      }, "generique"),
      isMinor: bool(false),               // Pouvoir mineur
      difficulty: int(0),                 // modificateur au test de PSY
      duration: str(""),
      range: str(""),
      resistance: str(""),                // caractéristique de résistance de la cible, ou "-"
      rPlus: str(""),                     // effet de Réussite supérieure
      damage: str(""),                    // ex. "RU+PSY"
      damageType: str("psychique"),
      effect: html("")
    };
  }
}

/**
 * Acte de Foi (Vraie Foi).
 * Le jet se fait en VOL.
 */
export class FaithActModel extends BaseItemModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      isMiracle: bool(false),
      difficulty: int(0),
      duration: str(""),
      range: str(""),
      resistance: str(""),
      rPlus: str(""),
      damage: str(""),
      damageType: str("physique"),
      effect: html("")
    };
  }
}
