/**
 * Calculs dérivés purs (sans dépendance Foundry) — testables en isolation.
 * Utilisés par le DataModel des personnages ET par l'assistant de création.
 */

/** Bonus (indice) d'une caractéristique = son chiffre des dizaines. */
export const bonusOf = (total) => Math.floor((total ?? 0) / 10);

/**
 * Vitalité (PV) d'un premier rôle — RAW Brigandyne 2e (p.18).
 *   PV = FOR/5 + END/5 + *VOL* (+ bonus éventuel : espèce, ajustement manuel)
 * @param {{for:number, end:number, vol:number}} c  totaux des caractéristiques
 * @param {number} extra  bonus additionnel (pvPlus1/2 d'espèce, etc.)
 */
export function vitality(c = {}, extra = 0) {
  return Math.floor((c.for ?? 0) / 5) + Math.floor((c.end ?? 0) / 5) + bonusOf(c.vol) + (extra || 0);
}

/**
 * Sang-froid (SF) d'un premier rôle — RAW Brigandyne 2e (p.18).
 *   SF = VOL/5 + CNS/5 + *COM* (+ bonus éventuel)
 * @param {{vol:number, cns:number, com:number}} c  totaux des caractéristiques
 * @param {number} extra  bonus additionnel (sfPlus1 d'espèce, etc.)
 */
export function sangFroid(c = {}, extra = 0) {
  return Math.floor((c.vol ?? 0) / 5) + Math.floor((c.cns ?? 0) / 5) + bonusOf(c.com) + (extra || 0);
}

/** Vitalité d'un PNJ mineur (figurant) — RAW : FOR/5 + END/10. */
export function vitalityMinor(c = {}, extra = 0) {
  return Math.floor((c.for ?? 0) / 5) + Math.floor((c.end ?? 0) / 10) + (extra || 0);
}

/** Bonus PV/SF apportés par les spécificités d'espèce. */
export function speciesResourceBonus(special = []) {
  return {
    pv: (special.includes("pvPlus1") ? 1 : 0) + (special.includes("pvPlus2") ? 2 : 0),
    sf: special.includes("sfPlus1") ? 1 : 0
  };
}
