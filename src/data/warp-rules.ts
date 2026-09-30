/**
 * Règles du Warp, de la Foi, de la Corruption et de la Folie — pures (sans Foundry).
 *
 * Sources : Livre Premier (Sang-froid p.142-147, Folie p.174-177, Magie p.208-214)
 * et adaptation « Warhammer 40.000 : Brigandyne » (Corruption, Mutations,
 * Pouvoirs, Dangers psychiques, Vraie Foi, Augmentations).
 */
import { instability } from "./derive.ts";

/** Trait (Vice/Vertu) tel qu'il apparaît sur un acteur. */
export interface TraitLike { name?: string; system?: Record<string, any> }

/* ------------------------------------------------------------------ */
/*  Utilitaires                                                        */
/* ------------------------------------------------------------------ */

/** « Colérique » → « colerique » : clé de vice/vertu, insensible aux accents, à la casse et aux suffixes. */
export function normalizeTraitKey(name = ""): string {
  return String(name).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[([+\-−0-9].*$/, "").trim().toLowerCase();
}

/** Clé de caractéristique d'un texte comme « MOU », « VOL » ou « - » (sans résistance). */
export function parseResistanceKey(text = ""): string | null {
  const m = /^\s*(COM|CNS|DIS|END|FOR|TEC|PSY|MOU|PER|SOC|SUR|TIR|VOL)\b/i.exec(text);
  return m ? m[1].toLowerCase() : null;
}

/* ------------------------------------------------------------------ */
/*  Pouvoirs psychiques                                                */
/* ------------------------------------------------------------------ */

/** « Un Psyker ne peut lancer que *PSY* Pouvoirs et *PSY* Pouvoirs mineurs par jour » (40K) — deux compteurs distincts (p.209). */
export function psyDailyLimits(psyBonus: number): { minor: number; power: number } {
  return { minor: Math.max(0, psyBonus), power: Math.max(0, psyBonus) };
}

/** Dépasser la limite coûte des PV : pouvoir mineur 2, pouvoir 4 (p.209). */
export function psyOverflowCost(isMinor: boolean): number {
  return isMinor ? 2 : 4;
}

/**
 * Résistance de la cible (p.213) : on prend « le modificateur le plus difficile
 * entre la difficulté du sort OU le MODO » ; avec plusieurs cibles, la Résistance
 * la plus haute (donc le MODO le plus bas). `scores` = valeur de la caractéristique
 * de résistance de chaque cible.
 */
export function resistanceModifier(difficulty: number, scores: number[] = [], modoCenter = 50): number {
  if (!scores.length) return difficulty;
  const worstModo = Math.min(...scores.map(s => modoCenter - s));
  return Math.min(difficulty, worstModo);
}

/** Un pouvoir mineur (tour de magie) réussit automatiquement (p.208). */
export function isAutomaticCast(isMinor: boolean): boolean {
  return !!isMinor;
}

/** Gêne du Paria : un Psyker qui manifeste un pouvoir près d'un Paria subit 1 Désavantage (40K, Spécialités). */
export function pariaDisadvantage(nearbyParias: number): number {
  return nearbyParias > 0 ? 1 : 0;
}

/** Gêne du Paria : +10 % pour résister aux effets du Warp (40K, Spécialités). */
export const PARIA_WARP_BONUS = 10;

/** Un Psyker connaît des disciplines selon son PSY : voir BRIGANDYNE.psyDisciplineThresholds. */
export function disciplineCount(psy: number, thresholds: Array<{ max: number; count: number }>): number {
  return (thresholds.find(t => psy <= t.max) ?? thresholds[thresholds.length - 1]).count;
}

/* ------------------------------------------------------------------ */
/*  Apprentissage des pouvoirs (Magie p.216-218, adapté au Psychisme)   */
/* ------------------------------------------------------------------ */

/** Pouvoirs de départ : *CNS* pouvoirs mineurs et *CNS* pouvoirs (p.216, exemple Silas : CNS 43 → 4 + 4). */
export function startingPowerAllowance(cnsBonus: number): { minor: number; power: number } {
  return { minor: Math.max(0, cnsBonus), power: Math.max(0, cnsBonus) };
}

/**
 * « Pour apprendre un sort, il faut que le mage ait au moins 40 % de chances de pouvoir le lancer » (p.216) :
 * PSY + difficulté ≥ 40. Les pouvoirs mineurs, qui ne demandent aucun test, restent accessibles.
 */
export function canLearnPower(psy: number, difficulty: number, isMinor: boolean): boolean {
  return isMinor || psy + difficulty >= 40;
}

/** Coût en PX : pouvoir mineur 50, pouvoir 100 ; hors de ses domaines +50 (p.217). */
export function powerXpCost(isMinor: boolean, outOfDomain: boolean): number {
  return (isMinor ? 50 : 100) + (outOfDomain ? 50 : 0);
}

export interface PowerLearning {
  ok: boolean;
  /** psyTooLow : moins de 40 % de chances de le lancer. */
  reason: "" | "psyTooLow";
  /** Discipline non maîtrisée : exception d'histoire (p.217), +50 PX. */
  outOfDomain: boolean;
  cost: number;
}

/**
 * Faisabilité et coût d'un pouvoir pour un Psyker. Les pouvoirs Génériques sont toujours connus ;
 * le nombre de disciplines spécialisées connues est borné par le PSY (table p.216 / 40K).
 * @param known  disciplines spécialisées déjà maîtrisées (via les pouvoirs possédés)
 */
export function powerLearning(o: {
  psy: number; difficulty: number; isMinor: boolean; discipline: string;
  known: string[]; thresholds: Array<{ max: number; count: number }>;
}): PowerLearning {
  if (!canLearnPower(o.psy, o.difficulty, o.isMinor)) return { ok: false, reason: "psyTooLow", outOfDomain: false, cost: 0 };
  const generic = o.discipline === "generique";
  const inDomain = generic || o.known.includes(o.discipline) || o.known.length < disciplineCount(o.psy, o.thresholds);
  return { ok: true, reason: "", outOfDomain: !inDomain, cost: powerXpCost(o.isMinor, !inDomain) };
}

/** Psyconduit : riche +5 %, relique +10 % aux tests de PSY (40K, Outils) ; on garde le meilleur possédé. */
export function psyconduitBonus(items: Array<{ name?: string }>): number {
  let best = 0;
  for (const i of items) {
    const n = normalizeTraitKey(i.name ?? "");
    if (/^psyconduit,?\s*relique/.test(n)) best = Math.max(best, 10);
    else if (/^psyconduit,?\s*riche/.test(n)) best = Math.max(best, 5);
  }
  return best;
}

/** Sacrifier des PV avant un pouvoir : +1 % par PV, sans jamais tomber sous 1 PV (p.211). */
export function pvSacrifice(requested: number, pvNow: number, perPv = 1): { pv: number; bonus: number } {
  const pv = Math.max(0, Math.min(Math.floor(requested || 0), Math.max(0, pvNow - 1)));
  return { pv, bonus: pv * perPv };
}

/* ------------------------------------------------------------------ */
/*  Corruption & mutations                                             */
/* ------------------------------------------------------------------ */

/** Modificateurs de difficulté selon la source de corruption (40K) : mineure +10, médiane 0, majeure −10. */
export const CORRUPTION_SOURCES = { minor: 10, median: 0, major: -10 } as const;

/**
 * « Un personnage doté d'un Vice lié à un des Dieux sombres subit toujours
 * 1 désavantage par niveau de Vice » (40K, Corruption > Effets secondaires).
 * Le trait est reconnu par son nom (clé de vice normalisée) ou par `system.viceKey`.
 */
export function corruptionViceLevels(godViceKeys: string[], traits: TraitLike[]): number {
  const gods = new Set(godViceKeys);
  let levels = 0;
  for (const t of traits) {
    const s = t.system ?? {};
    if (s.traitType !== "vice") continue;
    const key = s.viceKey || normalizeTraitKey(t.name);
    if (gods.has(key)) levels += Math.max(0, s.rating ?? 0);
  }
  return levels;
}

/**
 * Perte de SF sur un test de Corruption raté : Seuil d'instabilité, +1 sur un E+
 * (échec majeur ou critique) — 40K, Le test de résistance à la Corruption.
 * `tier` : −1 mineur, −2 majeur, −3 critique ; réussite (tier > 0) : aucune perte.
 */
export function corruptionSfLoss(threshold: number, tier: number): number {
  if (tier > 0) return 0;
  return threshold + (tier <= -2 ? 1 : 0);
}

/** Mutation quand la Corruption vide le SF : D10 pair → Grâce, impair → Fardeau (40K, Conséquences). */
export function mutationKind(d10: number): "grace" | "fardeau" {
  return d10 % 2 === 0 ? "grace" : "fardeau";
}

/* ------------------------------------------------------------------ */
/*  Folie                                                              */
/* ------------------------------------------------------------------ */

/** Test de Folie raté : −2 SF (échec mineur), −4 (majeur), −6 (critique) — p.143. */
export function madnessSfLoss(tier: number): number {
  if (tier >= 0) return 0;
  return tier === -1 ? 2 : tier === -2 ? 4 : 6;
}

/**
 * Crise de folie à 0 SF : perte DÉFINITIVE égale à l'Instabilité (1/4 du SF de
 * base, arrondi à l'inférieur) — p.174/176. `sfBase` = SF de base avant la crise.
 */
export function madnessPermanentLoss(sfBase: number): number {
  return instability(sfBase);
}

/** Personnage fou : son SF définitif tombe sous sa valeur d'Instabilité (p.176). */
export function isMad(sfBaseAfterLoss: number, instabilityValue: number): boolean {
  return sfBaseAfterLoss < instabilityValue;
}

/* ------------------------------------------------------------------ */
/*  Destin                                                             */
/* ------------------------------------------------------------------ */

/**
 * Éviter la mort en dépensant DÉFINITIVEMENT 1 point de Destin (p.147) : le
 * score courant ET le score de départ baissent de 1 ; à 0, aucune survie possible.
 */
export function permanentDestinSpend(value: number, max: number): { ok: boolean; value: number; max: number } {
  if (value <= 0) return { ok: false, value, max };
  return { ok: true, value: value - 1, max: Math.max(0, max - 1) };
}

/* ------------------------------------------------------------------ */
/*  Vraie Foi                                                          */
/* ------------------------------------------------------------------ */

/** Vertus ouvrant la Vraie Foi (40K) ; sinon Vice Colérique au niveau +2. */
export const FAITH_VIRTUES = ["genereux", "bienveillant", "valeureux", "chaste", "loyal"];

export function canChannelFaith(traits: TraitLike[]): boolean {
  return traits.some(t => {
    const s = t.system ?? {};
    const key = s.viceKey || normalizeTraitKey(t.name);
    if (s.traitType === "vertu") return FAITH_VIRTUES.includes(key) && (s.rating ?? 0) > 0;
    if (s.traitType === "vice") return key === "colerique" && (s.rating ?? 0) >= 2;
    return false;
  });
}

/** Actes de Foi par jour : le bonus de VOL divisé par 2 (40K). */
export function faithActsPerDay(volBonus: number): number {
  return Math.floor(Math.max(0, volBonus) / 2);
}

/** Deux tours de prière pour un Acte de Foi, trois pour un Miracle (40K). */
export function faithPrayerTurns(isMiracle: boolean): number {
  return isMiracle ? 3 : 2;
}

/** Actes de Foi au-delà de la limite quotidienne : −20 %. */
export const FAITH_OVERLIMIT_MALUS = -20;
