/**
 * Helpers de champs pour les DataModels.
 */
const fields = foundry.data.fields;

export const CHARACTERISTIC_KEYS = ["com", "cns", "dis", "end", "for", "tec", "psy", "mou", "per", "soc", "sur", "tir", "vol"];

/** Champ numérique entier. */
export function int(initial = 0, opts = {}) {
  return new fields.NumberField({ required: true, nullable: false, integer: true, initial, ...opts });
}

/** Champ numérique pouvant être null. */
export function num(initial = null, opts = {}) {
  return new fields.NumberField({ required: false, nullable: true, initial, ...opts });
}

/** Champ texte court. */
export function str(initial = "", opts = {}) {
  return new fields.StringField({ required: true, blank: true, initial, ...opts });
}

/** Champ booléen. */
export function bool(initial = false) {
  return new fields.BooleanField({ initial });
}

/** Champ HTML enrichi. */
export function html(initial = "") {
  return new fields.HTMLField({ required: false, blank: true, initial });
}

/** Ressource { value, max } (PV, SF…). */
export function resource(initialMax = 10) {
  return new fields.SchemaField({
    value: int(initialMax),
    max: int(initialMax),
    bonus: int(0)
  });
}

/** Choix dans une énumération de la config. */
export function choice(choices: Record<string, string>, initial: string, opts: Record<string, any> = {}) {
  return new fields.StringField({ required: true, blank: opts.blank ?? false, choices, initial, ...opts });
}

/**
 * Bloc des 13 caractéristiques.
 * @param {number|null} initial  Valeur initiale de chaque caractéristique.
 * @param {boolean} nullable     Autoriser null (utile pour les plafonds d'espèce).
 */
export function characteristicsSchema(initial = 0, { nullable = false } = {}) {
  const schema = {};
  for (const k of CHARACTERISTIC_KEYS) {
    schema[k] = nullable
      ? num(null, { min: 0, max: 100 })
      : int(initial, { min: 0, max: 100 });
  }
  return new fields.SchemaField(schema);
}

/** Liste de qualités { key, value }. */
export function qualitiesField() {
  return new fields.ArrayField(new fields.SchemaField({
    key: str(""),
    value: num(null)
  }));
}

export { fields };
