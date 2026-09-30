/**
 * Règles de combat pures (sans Foundry) — testables en isolation.
 *
 * Sources : Brigandyne 2e éd., Livre Premier (numérotation = pages imprimées)
 * et adaptation « Warhammer 40.000 : Brigandyne » (sections Armes, Armures,
 * Combat, Véhicules). Chaque fonction cite sa règle.
 */

/** Qualité d'arme/armure : clé + rang éventuel, ex. Perce-armure (2). */
export interface Quality { key: string; value?: number | null }

/** Objet minimal nécessaire aux calculs d'équipement (Item Foundry ou objet brut). */
export interface GearLike { type: string; system: Record<string, any> }

/* ------------------------------------------------------------------ */
/*  Qualités                                                           */
/* ------------------------------------------------------------------ */

/** Rang d'une qualité (`true` si sans rang), ou null si absente. */
export function qualityValue(qualities: Quality[] = [], key: string): number | true | null {
  const q = (qualities ?? []).find(q => q.key === key);
  return q ? (q.value ?? true) : null;
}

export function hasQuality(qualities: Quality[] = [], key: string): boolean {
  return (qualities ?? []).some(q => q.key === key);
}

/* ------------------------------------------------------------------ */
/*  Doublés & blessures graves                                         */
/* ------------------------------------------------------------------ */

/**
 * Doublé (11, 22, … 99) — Livre Premier p.162 : égalité au combat, séquelle
 * qui abîme l'armure (p.196), arme Risquée / Fragile (p.183).
 * 00 (= 100) est traité à part (échec critique, p.162).
 */
export function isDouble(total: number): boolean {
  return total >= 11 && total <= 99 && total % 11 === 0;
}

/** Seuil de blessure grave = moitié de la Vitalité (p.196), arrondie à l'inférieur. */
export function woundThreshold(pvMax = 0): number {
  return Math.floor((pvMax || 0) / 2);
}

/**
 * Blessure grave : une seule passe d'armes fait perdre un nombre de PV « égal
 * ou supérieur » au seuil (p.196). Une passe sans perte de PV n'en cause jamais.
 */
export function isSevereWound(pvLost: number, pvMax: number): boolean {
  return pvLost > 0 && pvLost >= woundThreshold(pvMax);
}

/* ------------------------------------------------------------------ */
/*  Résolution des dégâts                                              */
/* ------------------------------------------------------------------ */

export interface DamageInput {
  /** Dégâts bruts (RU + bonus d'arme). */
  amount: number;
  /** Protection totale de la cible. */
  protection: number;
  /** Ignore toute l'armure (dégâts psychiques, de chute…, p.135). */
  ignoreArmor?: boolean;
  /** Perce-armure (X) : ignore X points d'armure (40K, Spécificités des armes). */
  ap?: number;
  /** Armure /2 (armes à poudre, p.188) — arrondi à l'inférieur. */
  halveArmor?: boolean;
  /** Dégâts minimums d'une blessure (p.161 : 1 point). */
  minDamage?: number;
  /** Résistance (x) : dégâts divisés par deux, arrondi inférieur (Livre Second p.115). */
  halveDamage?: boolean;
}

/** Dégâts réellement encaissés et protection retenue. */
export function resolveDamage(i: DamageInput): { applied: number; protection: number; amount: number } {
  let amount = Math.max(0, i.amount);
  if (i.halveDamage) amount = Math.floor(amount / 2);
  let prot = i.ignoreArmor ? 0 : Math.max(0, i.protection ?? 0);
  if (!i.ignoreArmor && i.halveArmor) prot = Math.floor(prot / 2);
  if (!i.ignoreArmor) prot = Math.max(0, prot - (i.ap ?? 0));
  let applied = Math.max(0, amount - prot);
  if (i.minDamage && amount > 0) applied = Math.max(i.minDamage, applied);
  return { applied, protection: prot, amount };
}

/** Effet d'un total de dégâts PAIR selon le type (feu → enflammé, électrique → Sonné…, p.135). */
export function evenDamageEffect(damageType: string, total: number, effects: Record<string, string | undefined>): string | null {
  return total > 0 && total % 2 === 0 ? (effects[damageType] ?? null) : null;
}

/* ------------------------------------------------------------------ */
/*  Échelle humaine / véhicule / vaisseau (40K — Véhicules)            */
/* ------------------------------------------------------------------ */

export type WeaponScale = "human" | "vehicle" | "ship";
export type TargetKind = "human" | "vehicle" | "ship";
export type WeaponFamily = "solid" | "bolt" | "laser" | "other";

/** Famille d'une arme d'après son type de munition (Résistance des véhicules : solide, Bolt, laser). */
export function weaponFamily(ammoType = ""): WeaponFamily {
  const t = String(ammoType).trim().toLowerCase();
  if (/^(balle|cartouche|aiguille|carreau)/.test(t)) return "solid";
  if (/^bolt/.test(t)) return "bolt";
  if (/^cellule/.test(t)) return "laser";
  return "other";
}

/** Échelle d'une arme : groupe « vehicle »/« ship » du compendium, ou qualité Anti-véhicule. */
export function weaponScale(group = "", antiVehicle = false): WeaponScale {
  if (group === "ship") return "ship";
  if (group === "vehicle" || antiVehicle) return "vehicle";
  return "human";
}

export function targetKind(actorType: string, vehicleType = "terrestre"): TargetKind {
  if (actorType !== "vehicle") return "human";
  return vehicleType === "spatial" ? "ship" : "vehicle";
}

export interface ScaleEffect {
  /** Aucun dégât (les vaisseaux sont immunisés aux armes à échelle humaine). */
  immune: boolean;
  /** Dégâts ÷2 (Résistance des véhicules aux armes solides, Bolt et laser). */
  halve: boolean;
  /** Dégâts ×2 (arme de véhicule/vaisseau contre une cible à taille humaine). */
  double: boolean;
}

/**
 * Effet de l'échelle sur les dégâts :
 *  - « Tous les véhicules ont une Résistance (Armes à munitions solides, Bolt et laser) » → ÷2 ;
 *  - « Les vaisseaux sont immunisés à la plupart des armes standards » → aucun dégât ;
 *  - « Sur des cibles à taille humaine, les dégâts [des armes de véhicule] sont doublés ».
 */
export function scaleEffect(weapon: WeaponScale, family: WeaponFamily, target: TargetKind): ScaleEffect {
  const out: ScaleEffect = { immune: false, halve: false, double: false };
  if (weapon === "human") {
    if (target === "ship") out.immune = true;
    else if (target === "vehicle" && family !== "other") out.halve = true;
  } else if (target === "human") {
    out.double = true;
  }
  return out;
}

/** Percuter avec un véhicule : RU + Taille, doublés contre une cible à taille humaine (Contact). */
export function rammingDamage(ru: number, size: number, humanTarget: boolean): number {
  const base = Math.max(0, ru) + Math.max(0, size);
  return humanTarget ? base * 2 : base;
}

/** Course-poursuite : l'écart varie de RU + Vitesse (minimum 1). */
export function chaseStep(ru: number, speed: number): number {
  return Math.max(1, ru + speed);
}

/** Manœuvre à un pilote alors que le véhicule en exige davantage : 1 Désavantage. */
export function undermannedDisadvantage(pilotsMin: number, pilots = 1): number {
  return pilots < pilotsMin ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/*  Armes à distance : modes de tir, chargeur, portée                  */
/* ------------------------------------------------------------------ */

export type FireMode = "single" | "semi" | "burst";

/** Automatique → Semi-auto ou Rafale ; Semi-automatique → Semi-auto (40K, Spécificités des armes à distance). */
export function fireModes(qualities: Quality[] = []): FireMode[] {
  if (hasQuality(qualities, "automatique")) return ["single", "semi", "burst"];
  if (hasQuality(qualities, "semiAutomatique")) return ["single", "semi"];
  return ["single"];
}

/** Semi-auto : 1 Désavantage pour les deux tirs. Rafale : 1 Désavantage, dégâts totaux doublés. */
export function fireModeEffect(mode: FireMode): { disadvantage: number; damageMultiplier: number } {
  if (mode === "semi") return { disadvantage: 1, damageMultiplier: 1 };
  if (mode === "burst") return { disadvantage: 1, damageMultiplier: 2 };
  return { disadvantage: 0, damageMultiplier: 1 };
}

/**
 * Munitions consommées par test : 1 coup, 2 en semi-auto (« chaque tir consomme
 * 2 munitions »), la moitié du chargeur en rafale (« la moitié totale de ses
 * munitions »), sans jamais dépasser ce qui reste.
 */
export function ammoCost(mode: FireMode, magazine: number, current: number): number {
  const want = mode === "semi" ? 2 : mode === "burst" ? Math.max(1, Math.ceil((magazine || 0) / 2)) : 1;
  return Math.min(want, Math.max(0, current));
}

/** Un tir est possible s'il reste de quoi payer le coût (rafale : au moins 1 munition). */
export function canFire(mode: FireMode, magazine: number, current: number): boolean {
  if (magazine <= 0) return true;                       // arme sans chargeur suivi (grenade, arme de véhicule…)
  if (mode === "burst") return current >= 1;
  return current >= (mode === "semi" ? 2 : 1);
}

/**
 * Rechargement : en combat, les munitions restantes sont perdues ; hors combat
 * on peut remplacer les balles une par une (munitions solides et Bolt).
 */
export function reloadOutcome(current: number, magazine: number, inCombat: boolean): { loaded: number; lost: number } {
  return { loaded: magazine, lost: inCombat ? Math.max(0, current) : 0 };
}

/** Au-delà de la portée effective, le tireur a un Désavantage. */
export function rangeDisadvantage(distance: number | null | undefined, range: number): number {
  return distance != null && range > 0 && distance > range ? 1 : 0;
}

/** Viser : 1 Avantage au prochain tir, 2 avec un Viseur (40K, Actions spéciales / Améliorations). */
export function aimAdvantage(hasViseur: boolean): number {
  return hasViseur ? 2 : 1;
}

/** Lourde : Désavantage si la FOR est inférieure à 50. */
export function heavyDisadvantage(qualities: Quality[], forTotal: number): number {
  return hasQuality(qualities, "lourde") && forTotal < 50 ? 1 : 0;
}

/** Surchauffe : sur un E+ (échec majeur ou critique), le tireur subit les dégâts de l'arme sans le RU. */
export function overheats(qualities: Quality[], tier: number): boolean {
  return hasQuality(qualities, "surchauffe") && tier <= -2;
}

/** Points d'armure détruits par une attaque réussie : Destruction (1), dégâts acides (1). */
export function armorWear(qualities: Quality[], damageType = "physique"): number {
  return hasQuality(qualities, "destruction") || damageType === "acide" ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/*  Armures & équipement porté                                         */
/* ------------------------------------------------------------------ */

export interface GearSummary {
  /** Protection totale (armure de corps + bonus). */
  protection: number;
  initMod: number;
  mouMod: number;
  perMod: number;
  /** Décupleur : +10 aux tests de FOR/END et +1 aux dégâts de mêlée (armure énergétique). */
  decupleur: boolean;
  /** Couvert (X) du meilleur bouclier équipé. */
  cover: number;
}

/**
 * Synthèse de l'équipement porté.
 *  - les armures de corps ne s'empilent pas (la meilleure compte) ; casques et
 *    boucliers (« bonus ») s'ajoutent (p.192) ;
 *  - Combinaison composite « 2/+1 » et Synthéderme « 4/+2 » : la 1re valeur
 *    seule, la 2nde sous une autre armure (40K, Armures) ;
 *  - Init (−x) : les armures s'additionnent ; pour les armes, la plus encombrante.
 */
export function summarizeGear(items: GearLike[]): GearSummary {
  const worn = items.filter(i => i.type === "armor" && i.system.equipped);
  const under = worn.filter(a => (a.system.underBonus ?? 0) > 0);
  const main = worn.filter(a => a.system.coverage !== "bonus" && !((a.system.underBonus ?? 0) > 0));
  const bonus = worn.filter(a => a.system.coverage === "bonus" && !((a.system.underBonus ?? 0) > 0));

  const prot = (a: GearLike) => a.system.protection ?? 0;
  let body: number;
  if (main.length) {
    body = Math.max(...main.map(prot)) + (under.length ? Math.max(...under.map(a => a.system.underBonus)) : 0);
  } else {
    body = under.length ? Math.max(...under.map(prot)) : 0;
  }
  const protection = body + bonus.reduce((s, a) => s + prot(a), 0);

  const sum = (key: string) => worn.reduce((s, a) => s + (a.system[key] ?? 0), 0);
  const weaponInit = items
    .filter(i => i.type === "weapon" && i.system.equipped)
    .map(w => Number(qualityValue(w.system.qualities, "initiative")) || 0)
    .reduce((m, v) => Math.min(m, v), 0);

  return {
    protection,
    initMod: sum("initiativeMod") + weaponInit,
    mouMod: sum("mouMod"),
    perMod: sum("perMod"),
    decupleur: worn.some(a => hasQuality(a.system.qualities, "decupleur")),
    cover: worn.reduce((m, a) => Math.max(m, Number(qualityValue(a.system.qualities, "couvert")) || 0), 0)
  };
}

/** Couvert (X) : le tireur reçoit X Désavantages, sauf avec une arme qui « ignore les boucliers ». */
export function coverDisadvantage(cover: number, weaponQualities: Quality[]): number {
  return hasQuality(weaponQualities, "ignoreBoucliers") ? 0 : cover;
}

/** Armure qui perd le point de protection (Destruction/acide) : la meilleure armure de corps équipée, sinon un bonus. */
export function armorToWear<T extends { protection: number; coverage: string; equipped: boolean }>(armors: T[]): T | null {
  const worn = armors.filter(a => a.equipped && a.protection > 0);
  const pick = (list: T[]) => list.sort((a, b) => b.protection - a.protection)[0] ?? null;
  return pick(worn.filter(a => a.coverage !== "bonus")) ?? pick(worn.filter(a => a.coverage === "bonus"));
}

/**
 * Viser (tactique de combat, p.180) : malus selon l'armure adverse — partielle −5,
 * complète −10, casque et bouclier −5 chacun (−20 maximum) ; 0 sans armure.
 */
export function aimMalus(armors: Array<{ coverage: string; equipped: boolean }>): number {
  const worn = armors.filter(a => a.equipped);
  const main = worn.find(a => a.coverage === "complete") ? -10 : worn.find(a => a.coverage === "partielle") ? -5 : 0;
  const extras = worn.filter(a => a.coverage === "bonus").length * -5;
  return Math.max(-20, main + extras);
}

/** Sur la défensive : 2 Avantages, 3 avec un bouclier (p.180). */
export function defensiveAdvantages(hasShield: boolean): number {
  return hasShield ? 3 : 2;
}
