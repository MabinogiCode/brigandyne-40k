/**
 * Règles pures de création de personnage — RAW Brigandyne 2e (Livre Premier).
 * Aucune dépendance Foundry : testables en isolation (node --test).
 */

/* -------------------------------------------- */
/*  Compétences (p. 24-25)                      */
/* -------------------------------------------- */

/** Méthode B : capital de points à répartir (p. 25). */
export const POINTS_TOTAL = 120;
/** Méthode B : maximum de points par compétence (p. 25). */
export const POINTS_MAX_PER_CHAR = 20;
/** Transfert vers PSY/MAGIE : prélèvement max par compétence (p. 25). */
export const PSY_DRAW_MAX = 10;
/** Méthode A : nombre de tirages 2D10 (p. 25). */
export const ROLL_COUNT = 13;
/** Création rapide : les 12 scores à assigner (p. 21). */
export const QUICK_SCORES = [25, 30, 30, 30, 35, 35, 35, 40, 40, 40, 45, 45];

/**
 * Méthode A (p. 25) : sur 13 sommes de 2D10, on raye la plus faible.
 * @param {number[]} sums  les 13 résultats
 * @returns {{pool:number[], dropped:number, droppedIndex:number}}
 */
export function dropLowest(sums) {
  const dropped = Math.min(...sums);
  const droppedIndex = sums.indexOf(dropped);
  return { pool: sums.filter((_, i) => i !== droppedIndex), dropped, droppedIndex };
}

/**
 * Méthode B (p. 25) : la répartition est valide si le total ne dépasse pas 120
 * et qu'aucune compétence ne reçoit plus de 20 points.
 * @param {number[]} points  points attribués à chaque compétence (hors PSY)
 */
export function pointBuyValid(points) {
  const vals = points.map(v => Number(v) || 0);
  if (vals.some(v => v < 0 || v > POINTS_MAX_PER_CHAR)) return false;
  return vals.reduce((s, v) => s + v, 0) <= POINTS_TOTAL;
}

/**
 * Transfert vers PSY/MAGIE (p. 25) : max 10 par compétence, chaque point
 * prélevé en COM compte double.
 * @param {object} totals  totaux {com, cns, …} AVANT transfert (psy inclus)
 * @param {object} psyDraw  points prélevés par compétence {sur: 10, com: 5, …}
 * @param {number|null} cap  plafond de PSY à la création (null = aucun)
 * @returns {object} nouveaux totaux
 */
export function applyPsyTransfer(totals, psyDraw = {}, cap = null) {
  const out = { ...totals };
  let psy = Number(out.psy) || 0;
  for (const [k, d] of Object.entries(psyDraw)) {
    if (k === "psy") continue;
    const draw = Math.min(Math.max(Number(d) || 0, 0), PSY_DRAW_MAX);
    if (!draw) continue;
    out[k] = Math.max(0, (Number(out[k]) || 0) - draw);
    psy += (k === "com" ? draw * 2 : draw);
  }
  out.psy = (cap != null) ? Math.min(psy, cap) : psy;
  return out;
}

/* -------------------------------------------- */
/*  Atouts de départ (p. 22, 26, 110, 115)      */
/* -------------------------------------------- */

/**
 * Nombre d'atouts de départ = *CNS* − 1 (p. 26/110).
 * Exemples RAW : CNS 35 → 2 ; CNS 30 → 2 ; CNS 25 → 1.
 * @param {number} cns  total de Connaissances (après archétype)
 */
export function atoutCount(cns) {
  return Math.max(0, Math.floor((Number(cns) || 0) / 10) - 1);
}

/**
 * Filtre les atouts qu'il est encore possible de tirer (p. 111/115) :
 *  - un atout ne peut jamais être pris deux fois ;
 *  - pas de spécialité de Magie/occulte si la compétence PSY est à 0.
 * @param {Array<{name:string, kind:"specialty"|"talent", specialtyType?:string}>} entries
 * @param {{owned?:string[], psy?:number}} state
 */
export function selectableAtouts(entries, { owned = [], psy = 0 } = {}) {
  const taken = new Set(owned);
  return entries.filter(e => {
    if (taken.has(e.name)) return false;
    if (e.kind === "specialty" && e.specialtyType === "occulte" && !(Number(psy) > 0)) return false;
    return true;
  });
}

/**
 * Tirage d'UN atout (p. 110/115) : on jette 2D10 sur la liste de la catégorie,
 * chaque dé désigne un atout et le joueur choisit l'un des deux. En cas de
 * doublé (ou de dé désignant un atout indisponible), on relance pour toujours
 * conserver un choix entre deux options valides et distinctes.
 * Statistiquement équivalent : deux tirages uniformes distincts dans le pool
 * des atouts valides.
 * @param {Array} pool  atouts valides (déjà filtrés par selectableAtouts)
 * @param {() => number} rand  générateur [0,1) injectable (tests)
 * @returns {Array} 0, 1 ou 2 options distinctes
 */
export function drawAtoutOptions(pool, rand = Math.random) {
  if (!pool.length) return [];
  if (pool.length === 1) return [pool[0]];
  const i = Math.floor(rand() * pool.length);
  let j = Math.floor(rand() * (pool.length - 1));
  if (j >= i) j += 1;                       // relance implicite du doublé
  return [pool[i], pool[j]];
}
