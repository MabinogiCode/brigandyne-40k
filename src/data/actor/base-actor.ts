import { fields, int, num, str, bool, html, resource, choice } from "../fields.ts";
import { CHARACTERISTIC_KEYS } from "../fields.ts";
import { psyDailyLimits } from "../warp-rules.ts";
import { augmentationEffects } from "../augmentations.ts";

/** Construit le bloc des 13 caractéristiques { value, mod } pour un acteur. */
function actorCharacteristics() {
  const schema = {};
  for (const k of CHARACTERISTIC_KEYS) {
    schema[k] = new fields.SchemaField({
      value: int(k === "psy" ? 0 : 25, { min: 0, max: 100 }),
      mod: int(0),
      advances: int(0, { min: 0 })
    });
  }
  return new fields.SchemaField(schema);
}

/**
 * Modèle de base des acteurs « vivants » (Personnage & PNJ).
 * Gère les caractéristiques, leurs bonus (dizaine), PV, SF, Destin, Corruption
 * et l'Initiative dérivée.
 */
export class BaseActorModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      characteristics: actorCharacteristics(),
      pv: resource(10),
      sf: resource(10),
      destin: new fields.SchemaField({ value: int(0, { min: 0 }), max: int(0, { min: 0 }) }),
      corruption: new fields.SchemaField({
        value: int(0, { min: 0 }),
        threshold: int(1, { min: 0 })       // Seuil d'instabilité
      }),
      dailyUse: new fields.SchemaField({    // usages journaliers (réinitialisés au repos)
        powers: int(0, { min: 0 }),         // pouvoirs psychiques lancés aujourd'hui (p.209 : *PSY* pouvoirs)
        minors: int(0, { min: 0 }),         // pouvoirs mineurs lancés aujourd'hui (p.209 : *PSY* tours de magie)
        faith: int(0, { min: 0 }),          // Actes de Foi manifestés aujourd'hui
        forced: bool(false)                 // « forcer » le Warp déjà utilisé aujourd'hui (p.211-213 : une fois/jour)
      }),
      initiative: new fields.SchemaField({
        base: num(null),                     // override manuel (PNJ) ; null = dérivée
        mod: int(0)
      }),
      protection: new fields.SchemaField({
        base: int(0, { min: 0 }),            // protection « naturelle » / PNJ
        mod: int(0)
      }),
      role: choice({ figurant: "BRIG.Role.figurant", secondRole: "BRIG.Role.secondRole", premierRole: "BRIG.Role.premierRole" }, "secondRole"),
      lifestyle: str("ordinaire"),
      wealth: new fields.SchemaField({ gelt: int(0, { min: 0 }) }),
      biography: html(""),
      gmNotes: html("")
    };
  }

  /** Bonus d'une caractéristique = sa dizaine. */
  static bonusOf(total) {
    return Math.floor((total ?? 0) / 10);
  }

  prepareBaseData() {
    // Effets chiffrés des augmentations installées (40K, Augmentations), lues sur les objets de l'acteur.
    const items = this.parent?.items;
    const augmentations = items ? Array.from(items).filter((i: any) => i.type === "augmentation") : [];
    this.augmentationFx = augmentationEffects(augmentations as any);

    // Total et bonus de chaque caractéristique
    for (const k of CHARACTERISTIC_KEYS) {
      const c = this.characteristics[k];
      c.aug = this.augmentationFx.chars[k] ?? 0;
      c.total = Math.clamp(c.value + (c.mod ?? 0) + c.aug, 0, 100);
      c.bonus = BaseActorModel.bonusOf(c.total);
    }
  }

  prepareDerivedData() {
    // Protection totale (la couche armures s'ajoute au niveau du document)
    this.protection.value = (this.protection.base ?? 0) + (this.protection.mod ?? 0) + (this.protection.fromArmor ?? 0);

    // Initiative dérivée = bonus COM + MOU + PER (+ mod), sauf override manuel (RAW Brigandyne)
    const derived = this.characteristics.com.bonus + this.characteristics.mou.bonus + this.characteristics.per.bonus;
    this.initiative.derived = derived;
    this.initiative.value = (this.initiative.base ?? derived) + (this.initiative.mod ?? 0);

    // Seuil d'instabilité = SF/4 (RAW Brigandyne) — pertes de SF lors des tests de Corruption
    this.corruption.threshold = Math.floor(((this.sf.max ?? 0) + (this.sf.lost ?? 0)) / 4);

    // Nombre de disciplines / pouvoirs psy par jour
    const psy = this.characteristics.psy.total;
    this.psy = this.psy ?? {};
    this.psy.rating = psy;
    this.psy.powersPerDay = this.characteristics.psy.bonus;   // *PSY* pouvoirs/jour (bonus)
    this.psy.limits = psyDailyLimits(this.characteristics.psy.bonus);   // deux compteurs : pouvoirs et pouvoirs mineurs (p.209)
  }
}
