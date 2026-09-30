import { BaseActorModel } from "./base-actor.ts";
import { fields, int, str, bool, html, choice } from "../fields.ts";
import { vitality, sangFroid } from "../derive.ts";
import { faithActsPerDay } from "../warp-rules.ts";

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
      }),
      schemaVersion: str("")
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.xp.available = (this.xp.total ?? 0) - (this.xp.spent ?? 0);
    // Actes de Foi par jour = bonus de VOL / 2 (40K)
    this.faith.actsPerDay = faithActsPerDay(this.characteristics.vol.bonus);

    // PV (Vitalité) et SF (Sang-froid) dérivés EN CONTINU des caractéristiques
    // (RAW : « les attributs secondaires évoluent avec les scores »).
    // Le champ `.bonus` porte les ajustements (bonus d'espèce, modifs manuelles).
    const c = this.characteristics;
    const totals = { for: c.for.total, end: c.end.total, vol: c.vol.total, cns: c.cns.total, com: c.com.total };
    // `lost` = pertes définitives (crise de folie p.176, Douleurs chroniques p.197).
    this.pv.max = Math.max(0, vitality(totals, this.pv.bonus ?? 0) + (this.augmentationFx?.pv ?? 0) - (this.pv.lost ?? 0));
    this.sf.max = Math.max(0, sangFroid(totals, this.sf.bonus ?? 0) - (this.sf.lost ?? 0));
    if (this.pv.value > this.pv.max) this.pv.value = this.pv.max;
    if (this.sf.value > this.sf.max) this.sf.value = this.sf.max;

    // Seuil de Blessure (SB) = PV/2 (arrondi à l'inférieur)
    this.pv.seuil = Math.floor(this.pv.max / 2);

    // Seuil d'instabilité = 1/4 du SF DE BASE (avant pertes définitives, p.176).
    this.sf.base = this.sf.max + (this.sf.lost ?? 0);
    this.corruption.threshold = Math.floor(this.sf.base / 4);
  }
}
