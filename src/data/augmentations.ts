/**
 * Augmentations — règles pures (adaptation « Warhammer 40.000 : Brigandyne »,
 * section Augmentations : Prothèses et organes bioniques, Systèmes implantés).
 */

export interface AugmentationLike { name?: string; system?: Record<string, any> }

export interface AugmentationEffects {
  /** Bonus permanents de caractéristique (en %). */
  chars: Record<string, number>;
  /** Bonus de Vitalité maximale. */
  pv: number;
  /** Bonus de Protection. */
  protection: number;
  /** Bonus aux TESTS d'une caractéristique (sans changer la caractéristique). */
  tests: Record<string, number>;
}

/** « Viscères augmentées » → « visceres augmentees » : nom d'augmentation sans accents ni casse. */
const norm = (name = ""): string =>
  String(name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const isInstalled = (a: AugmentationLike): boolean => a.system?.installed !== false;
const qty = (a: AugmentationLike): number => Math.max(1, a.system?.quantity ?? 1);

/** Nombre d'installations par nom d'augmentation (les objets installés uniquement). */
function tally(augmentations: AugmentationLike[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of augmentations.filter(isInstalled)) out.set(norm(a.name), (out.get(norm(a.name)) ?? 0) + qty(a));
  return out;
}

/**
 * « Un personnage ne peut recevoir que *VOL* augmentations » (40K) : les
 * augmentations esthétiques ne comptent pas et la Cyberchape double le maximum.
 * `volBonus` = bonus (dizaine) de VOL.
 */
export function augmentationStatus(volBonus: number, augmentations: AugmentationLike[]): { count: number; max: number; over: number } {
  const t = tally(augmentations);
  let count = 0;
  for (const [name, n] of t) if (name !== "augmentation esthetique" && name !== "cyberchape") count += n;
  const max = Math.max(0, volBonus) * (t.has("cyberchape") ? 2 : 1);
  return { count, max, over: Math.max(0, count - max) };
}

/**
 * Effets chiffrés des augmentations du document d'adaptation :
 *  - Augmentation esthétique : +5 % SOC chacune (maximum +20 %) ;
 *  - Bras bionique : FOR +10 % par bras (2 maximum) ;
 *  - Jambe cybernétique : MOU +20 % si les deux jambes sont équipées ;
 *  - Organes bioniques : END +20 % ;
 *  - Viscères augmentées : +2 PV par installation (5 maximum) ;
 *  - Armure subdermique : Protection +1 ;
 *  - Tendons renforcés : +10 % aux tests de force physique ;
 *  - Implant cortical : +10 % aux tests de connaissances ou de réflexion.
 */
export function augmentationEffects(augmentations: AugmentationLike[]): AugmentationEffects {
  const t = tally(augmentations);
  const out: AugmentationEffects = { chars: {}, pv: 0, protection: 0, tests: {} };
  const add = (rec: Record<string, number>, k: string, v: number) => { if (v) rec[k] = (rec[k] ?? 0) + v; };

  add(out.chars, "soc", Math.min(20, 5 * (t.get("augmentation esthetique") ?? 0)));
  add(out.chars, "for", 10 * Math.min(2, t.get("bras bionique") ?? 0));
  if ((t.get("jambe cybernetique") ?? 0) >= 2) add(out.chars, "mou", 20);
  if (t.has("organes bioniques")) add(out.chars, "end", 20);
  out.pv = 2 * Math.min(5, t.get("visceres augmentees") ?? 0);
  if (t.has("armure subdermique")) out.protection = 1;
  if (t.has("tendons renforces")) add(out.tests, "for", 10);
  if (t.has("implant cortical")) add(out.tests, "cns", 10);
  return out;
}
