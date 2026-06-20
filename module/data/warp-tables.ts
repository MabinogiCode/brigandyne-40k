/**
 * Tables des Phénomènes psychiques et des Périls du Warp.
 * Déclenchées automatiquement sur échec majeur / critique d'un pouvoir psy.
 */
const { renderTemplate } = foundry.applications.handlebars;

export const PHENOMENA = [
  [1, 2, "Sombre pressentiment", "Tout le monde perd 1 point de SF."],
  [3, 5, "Écho du Warp", "Des voix et des bruits étranges résonnent quelques secondes."],
  [6, 8, "Odeur éthérée", "Une odeur ténue, agréable ou nauséabonde, emplit l'air."],
  [9, 11, "Montée de paranoïa", "Le Psyker perd 1 point de SF."],
  [12, 14, "Froid sépulcral", "La température chute, une fine couche de givre apparaît."],
  [15, 17, "Aura d'étrangeté", "Les animaux paniquent et fuient."],
  [18, 20, "Ver mémoriel", "Les témoins oublient quelque chose sans importance."],
  [21, 23, "Rancissement", "Nourriture et boissons pourrissent et tombent en cendre."],
  [24, 26, "Brise inquiétante", "Un vent modéré projette les objets légers."],
  [27, 29, "Voile d'obscurité", "Pendant PSY tours, tous subissent 1 Désavantage (obscurité illusoire)."],
  [30, 32, "Distorsion", "Miroirs et surfaces réfléchissantes se brisent ou se déforment."],
  [33, 35, "Essoufflement", "Le Psyker et ses voisins deviennent Essoufflés 1 tour."],
  [36, 38, "Masque démoniaque", "Le Psyker obtient l'effet PEUR (1) pendant PSY tours."],
  [39, 41, "Dépérissement surnaturel", "Les plantes flétrissent et meurent autour du Psyker."],
  [42, 44, "Bourrasque spectrale", "Test de FOR à +10 ou être jeté à terre."],
  [45, 47, "Larmes de sang", "Du sang suinte de la pierre et du bois."],
  [48, 50, "Protestation tellurique", "Le sol tremble : test de MOU ou à terre."],
  [51, 53, "Décharge psy", "Le Psyker s'élève jusqu'à PSY mètres puis retombe."],
  [54, 56, "Fantômes du Warp", "Test de VOL ou perdre 2 points de SF."],
  [57, 59, "Chute vers le haut", "La gravité s'inverse : tout s'élève de 10 m pendant 1 tour."],
  [60, 62, "Hurlement de mort", "Test de FOR ou être sonné et assourdi PSY tours."],
  [63, 65, "Déchaînement", "Le Psyker est paralysé PSY tours ; les autres : test de FOR/tour ou à terre."],
  [66, 68, "Aperçu du Warp", "Test de VOL à -10 ou perdre PSY points de SF."],
  [69, 71, "Technodégoût", "Les objets technologiques tombent en panne, les armes s'enrayent PSY tours."],
  [72, 74, "Démence du Warp", "Tous les voisins sont terrorisés et perdent 5 points de SF."],
  [75, 100, "Périls du Warp", "Le pouvoir engendre un Péril du Warp (relancez sur la table des Périls)."]
];

export const PERILS = [
  [1, 5, "Bégaiement incontrôlé", "Test de VOL ou perdre PSY points de SF."],
  [6, 9, "Brûlure Warp", "1 dégât de feu par tour pendant PSY tours."],
  [10, 13, "Concussion psychique", "Le Psyker sombre dans l'inconscience 3 tours."],
  [14, 18, "Psydéflagration", "Projeté jusqu'à PSY mètres (dégâts de chute)."],
  [19, 24, "Brûlure de l'âme", "PSY dégâts de feu ; plus de pouvoirs pendant 1 heure."],
  [25, 30, "Claustration", "État catatonique PSY tours (test de VOL/tour pour se libérer)."],
  [31, 38, "Discontinuité temporelle", "Le Psyker disparaît et réapparaît 1 minute plus tard."],
  [39, 46, "Réflexion psychique", "Le pouvoir se retourne contre le Psyker (ou PSY dégâts psy)."],
  [47, 55, "Murmures du Warp", "Toutes les créatures : test de VOL à -20 ou perdre RU points de SF."],
  [56, 61, "Damnation de la chair", "Une créature aléatoire subit 1 mutation."],
  [62, 67, "Sombre invocation", "Un démon mineur se manifeste et attaque le Psyker."],
  [68, 72, "Tempête éthérée", "Toutes les créatures conscientes subissent PSY+2 dégâts (ignore armures)."],
  [73, 78, "Pluie de sang", "Tout pouvoir psy engendre 1 Péril du Warp pendant PSY tours."],
  [79, 82, "Déflagration cataclysmique", "Toutes les créatures à 10 m subissent 10 dégâts."],
  [83, 86, "Possession de masse", "Test de VOL à -20 ; échec : chacun perd 1 SF/tour pendant RU tours."],
  [87, 90, "Les liens fragiles de la matière", "La gravité s'inverse : tout s'élève pendant PSY tours."],
  [91, 99, "Possédé", "Test de VOL à -30 ou devenir un Possédé pendant RU tours."],
  [100, 100, "Festin du Warp", "Une faille s'ouvre : l'existence du Psyker prend fin."]
];

function lookup(table, roll) {
  return table.find(([min, max]) => roll >= min && roll <= max);
}

/**
 * Lance et publie un Phénomène psychique ou un Péril du Warp.
 * @param {Actor} actor
 * @param {"phenomenon"|"peril"} kind
 */
export async function postWarpResult(actor, kind): Promise<any> {
  let table = kind === "peril" ? PERILS : PHENOMENA;
  let title = kind === "peril" ? "Péril du Warp" : "Phénomène psychique";
  let r = await new Roll("1d100").evaluate();
  let entry = lookup(table, r.total);
  // Un phénomène 75+ déclenche un véritable Péril
  if (kind !== "peril" && entry && entry[2] === "Périls du Warp") {
    const r2 = await new Roll("1d100").evaluate();
    table = PERILS; title = "Péril du Warp"; r = r2; entry = lookup(PERILS, r2.total);
  }
  if (!entry) return;
  const content = await renderTemplate("systems/brigandyne-40k/templates/chat/warp-card.hbs", {
    title, roll: r.total, name: entry[2], effect: entry[3], peril: kind === "peril" || title === "Péril du Warp"
  });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as any }),
    content, rolls: [r as any], sound: CONFIG.sounds.dice
  } as any);
}
