/**
 * Helpers Handlebars personnalisés + chargement des partials.
 */
export function registerHandlebarsHelpers() {
  const H = Handlebars;
  H.registerHelper("eq", (a, b) => a === b);
  H.registerHelper("ne", (a, b) => a !== b);
  H.registerHelper("gt", (a, b) => Number(a) > Number(b));
  H.registerHelper("lt", (a, b) => Number(a) < Number(b));
  H.registerHelper("gte", (a, b) => Number(a) >= Number(b));
  H.registerHelper("lte", (a, b) => Number(a) <= Number(b));
  H.registerHelper("abs", (a) => Math.abs(Number(a) || 0));
  H.registerHelper("add", (a, b) => (Number(a) || 0) + (Number(b) || 0));
  H.registerHelper("sub", (a, b) => (Number(a) || 0) - (Number(b) || 0));
  H.registerHelper("signed", (a) => { const n = Number(a) || 0; return n >= 0 ? `+${n}` : `${n}`; });
  H.registerHelper("brigConcat", (...args) => args.slice(0, -1).join(""));
  H.registerHelper("concat", (...args) => args.slice(0, -1).join(""));
  H.registerHelper("brigOr", (...args) => args.slice(0, -1).some(Boolean));
  H.registerHelper("brigAnd", (...args) => args.slice(0, -1).every(Boolean));
  H.registerHelper("repeat", function (n, block) {
    let out = "";
    for (let i = 0; i < (Number(n) || 0); i++) out += block.fn(i);
    return out;
  });
}

// Partials nommés (clé = nom utilisable avec {{> nom}})
const PARTIALS = {
  "qualities-editor": "systems/brigandyne-40k/templates/item/partials/qualities-editor.hbs"
};

export async function preloadHandlebarsTemplates() {
  const { loadTemplates } = foundry.applications.handlebars;
  return loadTemplates(PARTIALS);
}
