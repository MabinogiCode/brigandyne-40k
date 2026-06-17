/**
 * Configuration maîtresse du système Warhammer 40,000 : Brigandyne.
 * Toutes les énumérations, libellés (clés i18n) et données de règles.
 */
export const BRIGANDYNE = {};

BRIGANDYNE.id = "brigandyne-40k";
BRIGANDYNE.ASCII = "Warhammer 40000 : Brigandyne";

/* -------------------------------------------- */
/*  Caractéristiques (13 compétences-carac.)    */
/* -------------------------------------------- */
// Le « bonus » d'une caractéristique = sa dizaine (FOR 45 → +4).
BRIGANDYNE.characteristics = {
  com: { label: "BRIG.Char.com.long", abbrev: "BRIG.Char.com.abbr", group: "martial" },
  cns: { label: "BRIG.Char.cns.long", abbrev: "BRIG.Char.cns.abbr", group: "mental" },
  dis: { label: "BRIG.Char.dis.long", abbrev: "BRIG.Char.dis.abbr", group: "physique" },
  end: { label: "BRIG.Char.end.long", abbrev: "BRIG.Char.end.abbr", group: "physique" },
  for: { label: "BRIG.Char.for.long", abbrev: "BRIG.Char.for.abbr", group: "physique" },
  tec: { label: "BRIG.Char.tec.long", abbrev: "BRIG.Char.tec.abbr", group: "mental" },
  psy: { label: "BRIG.Char.psy.long", abbrev: "BRIG.Char.psy.abbr", group: "occulte" },
  mou: { label: "BRIG.Char.mou.long", abbrev: "BRIG.Char.mou.abbr", group: "physique" },
  per: { label: "BRIG.Char.per.long", abbrev: "BRIG.Char.per.abbr", group: "mental" },
  soc: { label: "BRIG.Char.soc.long", abbrev: "BRIG.Char.soc.abbr", group: "mental" },
  sur: { label: "BRIG.Char.sur.long", abbrev: "BRIG.Char.sur.abbr", group: "mental" },
  tir: { label: "BRIG.Char.tir.long", abbrev: "BRIG.Char.tir.abbr", group: "martial" },
  vol: { label: "BRIG.Char.vol.long", abbrev: "BRIG.Char.vol.abbr", group: "mental" }
};

BRIGANDYNE.characteristicGroups = {
  martial: "BRIG.CharGroup.martial",
  physique: "BRIG.CharGroup.physique",
  mental: "BRIG.CharGroup.mental",
  occulte: "BRIG.CharGroup.occulte"
};

/* -------------------------------------------- */
/*  Degrés de réussite                          */
/* -------------------------------------------- */
// success: roll <= carac. Degré par les zéros :
//   unités == 0           -> critique
//   dizaines == 0 (01-09) -> majeure (réussite) / (91-99 -> majeur en échec)
//   sinon                 -> mineure
BRIGANDYNE.degrees = {
  critSuccess: { label: "BRIG.Degree.critSuccess", success: true, tier: 3, css: "crit-success" },
  majorSuccess: { label: "BRIG.Degree.majorSuccess", success: true, tier: 2, css: "major-success" },
  minorSuccess: { label: "BRIG.Degree.minorSuccess", success: true, tier: 1, css: "minor-success" },
  minorFailure: { label: "BRIG.Degree.minorFailure", success: false, tier: -1, css: "minor-failure" },
  majorFailure: { label: "BRIG.Degree.majorFailure", success: false, tier: -2, css: "major-failure" },
  critFailure: { label: "BRIG.Degree.critFailure", success: false, tier: -3, css: "crit-failure" }
};

/* -------------------------------------------- */
/*  Difficultés                                 */
/* -------------------------------------------- */
BRIGANDYNE.difficulties = {
  "30": "BRIG.Difficulty.simple",
  "20": "BRIG.Difficulty.aisee",
  "10": "BRIG.Difficulty.faisable",
  "0": "BRIG.Difficulty.assezDifficile",
  "-10": "BRIG.Difficulty.difficile",
  "-20": "BRIG.Difficulty.tresDifficile",
  "-30": "BRIG.Difficulty.complexe"
};

/* -------------------------------------------- */
/*  Portées (mètres)                            */
/* -------------------------------------------- */
BRIGANDYNE.ranges = {
  contact: { label: "BRIG.Range.contact", m: 1 },
  courte: { label: "BRIG.Range.courte", m: 5 },
  moyenne: { label: "BRIG.Range.moyenne", m: 20 },
  longue: { label: "BRIG.Range.longue", m: 50 },
  extreme: { label: "BRIG.Range.extreme", m: 100 }
};

/* -------------------------------------------- */
/*  Allonges des armes de mêlée                 */
/* -------------------------------------------- */
// F (au corps) < E < D < C < B < A < AA (plus l'allonge est grande, plus on frappe loin)
BRIGANDYNE.reaches = ["F", "E", "D", "C", "B", "A", "AA"];

/* -------------------------------------------- */
/*  Qualités d'armes                            */
/* -------------------------------------------- */
// hasValue: la qualité prend un rang numérique, ex. Perce-armure (3)
BRIGANDYNE.weaponQualities = {
  perceArmure: { label: "BRIG.Quality.perceArmure", hasValue: true, target: "both" },
  destruction: { label: "BRIG.Quality.destruction", hasValue: false, target: "both" },
  ignoreBoucliers: { label: "BRIG.Quality.ignoreBoucliers", hasValue: false, target: "both" },
  ignoreArmures: { label: "BRIG.Quality.ignoreArmures", hasValue: false, target: "both" },
  espace: { label: "BRIG.Quality.espace", hasValue: false, target: "melee" },
  choc: { label: "BRIG.Quality.choc", hasValue: false, target: "melee" },
  charge: { label: "BRIG.Quality.charge", hasValue: false, target: "melee" },
  saisie: { label: "BRIG.Quality.saisie", hasValue: false, target: "melee" },
  force: { label: "BRIG.Quality.force", hasValue: false, target: "melee" },
  electrique: { label: "BRIG.Quality.electrique", hasValue: false, target: "both" },
  risquee: { label: "BRIG.Quality.risquee", hasValue: false, target: "melee" },
  corpsACorps: { label: "BRIG.Quality.corpsACorps", hasValue: false, target: "melee" },
  initiative: { label: "BRIG.Quality.initiative", hasValue: true, target: "both" }, // valeur négative
  tronconneuse: { label: "BRIG.Quality.tronconneuse", hasValue: false, target: "melee" },
  degatsTemporaires: { label: "BRIG.Quality.degatsTemporaires", hasValue: false, target: "both" },
  automatique: { label: "BRIG.Quality.automatique", hasValue: false, target: "ranged" },
  semiAutomatique: { label: "BRIG.Quality.semiAutomatique", hasValue: false, target: "ranged" },
  chargement: { label: "BRIG.Quality.chargement", hasValue: true, target: "ranged" },
  lourde: { label: "BRIG.Quality.lourde", hasValue: false, target: "ranged" },
  precis: { label: "BRIG.Quality.precis", hasValue: false, target: "ranged" },
  souffle: { label: "BRIG.Quality.souffle", hasValue: true, target: "ranged" },
  surchauffe: { label: "BRIG.Quality.surchauffe", hasValue: false, target: "ranged" },
  rayon: { label: "BRIG.Quality.rayon", hasValue: true, target: "ranged" },
  poison: { label: "BRIG.Quality.poison", hasValue: false, target: "both" },
  viseur: { label: "BRIG.Quality.viseur", hasValue: false, target: "ranged" },
  maniable: { label: "BRIG.Quality.maniable", hasValue: true, target: "ranged" }
};

/* -------------------------------------------- */
/*  Catégories d'armes                          */
/* -------------------------------------------- */
BRIGANDYNE.weaponTypes = {
  melee: "BRIG.WeaponType.melee",
  ranged: "BRIG.WeaponType.ranged"
};

BRIGANDYNE.weaponGroups = {
  // mêlée
  improvisee: "BRIG.WeaponGroup.improvisee",
  lame: "BRIG.WeaponGroup.lame",
  epee: "BRIG.WeaponGroup.epee",
  hacheMasse: "BRIG.WeaponGroup.hacheMasse",
  articulee: "BRIG.WeaponGroup.articulee",
  hast: "BRIG.WeaponGroup.hast",
  tronconneuse: "BRIG.WeaponGroup.tronconneuse",
  energetique: "BRIG.WeaponGroup.energetique",
  forceWeapon: "BRIG.WeaponGroup.force",
  // distance
  primitive: "BRIG.WeaponGroup.primitive",
  solide: "BRIG.WeaponGroup.solide",
  laser: "BRIG.WeaponGroup.laser",
  bolt: "BRIG.WeaponGroup.bolt",
  plasma: "BRIG.WeaponGroup.plasma",
  flamme: "BRIG.WeaponGroup.flamme",
  fusion: "BRIG.WeaponGroup.fusion",
  explosif: "BRIG.WeaponGroup.explosif",
  xeno: "BRIG.WeaponGroup.xeno"
};

/* -------------------------------------------- */
/*  Armures                                      */
/* -------------------------------------------- */
BRIGANDYNE.armorCoverage = {
  partielle: "BRIG.Armor.partielle",
  complete: "BRIG.Armor.complete",
  bonus: "BRIG.Armor.bonus"
};

/* -------------------------------------------- */
/*  Munitions                                    */
/* -------------------------------------------- */
BRIGANDYNE.ammoTypes = {
  carreaux: "BRIG.Ammo.carreaux",
  balleP: "BRIG.Ammo.balleP",
  balleM: "BRIG.Ammo.balleM",
  balleL: "BRIG.Ammo.balleL",
  cartouche: "BRIG.Ammo.cartouche",
  aiguilles: "BRIG.Ammo.aiguilles",
  celluleP: "BRIG.Ammo.celluleP",
  celluleM: "BRIG.Ammo.celluleM",
  celluleL: "BRIG.Ammo.celluleL",
  bolt: "BRIG.Ammo.bolt",
  flasqueP: "BRIG.Ammo.flasqueP",
  flasqueM: "BRIG.Ammo.flasqueM",
  flasqueL: "BRIG.Ammo.flasqueL",
  reservoir: "BRIG.Ammo.reservoir",
  fusion: "BRIG.Ammo.fusion"
};

/* -------------------------------------------- */
/*  Types de dégâts                             */
/* -------------------------------------------- */
BRIGANDYNE.damageTypes = {
  physique: { label: "BRIG.Damage.physique", ignoreArmor: false },
  feu: { label: "BRIG.Damage.feu", ignoreArmor: false, evenEffect: "enflamme" },
  froid: { label: "BRIG.Damage.froid", ignoreArmor: false, evenEffect: "ralenti" },
  electrique: { label: "BRIG.Damage.electrique", ignoreMetalArmor: true, evenEffect: "sonne" },
  psychique: { label: "BRIG.Damage.psychique", ignoreArmor: true, evenEffect: "confus" },
  acide: { label: "BRIG.Damage.acide", ignoreArmor: false, armorDamage: 1 },
  asphyxiant: { label: "BRIG.Damage.asphyxiant", ignoreArmor: true },
  chute: { label: "BRIG.Damage.chute", ignoreArmor: true },
  temporaire: { label: "BRIG.Damage.temporaire", ignoreArmor: false, temporary: true }
};

/* -------------------------------------------- */
/*  États / conditions (status effects)         */
/* -------------------------------------------- */
BRIGANDYNE.conditions = {
  affaibli: { label: "BRIG.Condition.affaibli", icon: "icons/svg/downgrade.svg" },
  affame: { label: "BRIG.Condition.affame", icon: "icons/svg/hazard.svg" },
  apeure: { label: "BRIG.Condition.apeure", icon: "icons/svg/terror.svg" },
  aterre: { label: "BRIG.Condition.aterre", icon: "icons/svg/falling.svg" },
  aveugle: { label: "BRIG.Condition.aveugle", icon: "icons/svg/blind.svg" },
  confus: { label: "BRIG.Condition.confus", icon: "icons/svg/daze.svg" },
  demoralise: { label: "BRIG.Condition.demoralise", icon: "icons/svg/degen.svg" },
  ensanglante: { label: "BRIG.Condition.ensanglante", icon: "icons/svg/blood.svg" },
  essouffle: { label: "BRIG.Condition.essouffle", icon: "icons/svg/windmill.svg" },
  paralyse: { label: "BRIG.Condition.paralyse", icon: "icons/svg/paralysis.svg" },
  ralenti: { label: "BRIG.Condition.ralenti", icon: "icons/svg/net.svg" },
  sonne: { label: "BRIG.Condition.sonne", icon: "icons/svg/stoned.svg" },
  terrorise: { label: "BRIG.Condition.terrorise", icon: "icons/svg/terror.svg" }
};

/* -------------------------------------------- */
/*  Disciplines psychiques                      */
/* -------------------------------------------- */
BRIGANDYNE.psychicDisciplines = {
  generique: "BRIG.Discipline.generique",
  biomancie: "BRIG.Discipline.biomancie",
  divination: "BRIG.Discipline.divination",
  pyromancie: "BRIG.Discipline.pyromancie",
  telekinesie: "BRIG.Discipline.telekinesie",
  telepathie: "BRIG.Discipline.telepathie"
};

// Nombre de disciplines connaissables selon le score de PSY
BRIGANDYNE.psyDisciplineThresholds = [
  { max: 49, count: 1 },
  { max: 69, count: 2 },
  { max: 89, count: 3 },
  { max: 99, count: 4 },
  { max: 100, count: 5 }
];

/* -------------------------------------------- */
/*  Chaos : Vices, Vertus, Dieux                */
/* -------------------------------------------- */
BRIGANDYNE.vices = {
  colerique: "BRIG.Vice.colerique",
  cruel: "BRIG.Vice.cruel",
  orgueilleux: "BRIG.Vice.orgueilleux",
  avare: "BRIG.Vice.avare",
  gourmand: "BRIG.Vice.gourmand",
  luxurieux: "BRIG.Vice.luxurieux",
  paresseux: "BRIG.Vice.paresseux",
  lache: "BRIG.Vice.lache",
  envieux: "BRIG.Vice.envieux",
  trompeur: "BRIG.Vice.trompeur"
};

BRIGANDYNE.virtues = {
  genereux: "BRIG.Virtue.genereux",
  bienveillant: "BRIG.Virtue.bienveillant",
  valeureux: "BRIG.Virtue.valeureux",
  chaste: "BRIG.Virtue.chaste",
  loyal: "BRIG.Virtue.loyal"
};

BRIGANDYNE.chaosGods = {
  khorne: { label: "BRIG.ChaosGod.khorne", vices: ["colerique", "cruel", "orgueilleux", "avare"] },
  slaanesh: { label: "BRIG.ChaosGod.slaanesh", vices: ["gourmand", "luxurieux", "avare", "orgueilleux"] },
  nurgle: { label: "BRIG.ChaosGod.nurgle", vices: ["paresseux", "lache", "gourmand", "envieux"] },
  tzeentch: { label: "BRIG.ChaosGod.tzeentch", vices: ["trompeur", "envieux", "orgueilleux", "lache"] }
};

/* -------------------------------------------- */
/*  Niveaux de vie (régénération & salaire)     */
/* -------------------------------------------- */
// pv/sf : { value, unit } régénération ; salary : table par degré (Trônes Gelt / semaine)
BRIGANDYNE.lifestyles = {
  miserable: { label: "BRIG.Lifestyle.miserable", pv: "1/sem", sf: "1/sem", salary: { critSuccess: 30, majorSuccess: 25, minorSuccess: 15, minorFailure: 10, majorFailure: 5, critFailure: 0 } },
  pauvre: { label: "BRIG.Lifestyle.pauvre", pv: "1/2j", sf: "1/2j", salary: { critSuccess: 50, majorSuccess: 35, minorSuccess: 25, minorFailure: 20, majorFailure: 15, critFailure: 10 } },
  ordinaire: { label: "BRIG.Lifestyle.ordinaire", pv: "1/j", sf: "1/j", salary: { critSuccess: 100, majorSuccess: 75, minorSuccess: 50, minorFailure: 25, majorFailure: 20, critFailure: 15 } },
  aise: { label: "BRIG.Lifestyle.aise", pv: "2/j", sf: "1/j", salary: { critSuccess: 1000, majorSuccess: 500, minorSuccess: 400, minorFailure: 300, majorFailure: 200, critFailure: 100 } },
  riche: { label: "BRIG.Lifestyle.riche", pv: "2/j", sf: "2/j", salary: { critSuccess: 1500, majorSuccess: 1000, minorSuccess: 500, minorFailure: 400, majorFailure: 300, critFailure: 200 } },
  royal: { label: "BRIG.Lifestyle.royal", pv: "2/j", sf: "2/j", salary: { critSuccess: 2500, majorSuccess: 1500, minorSuccess: 1000, minorFailure: 500, majorFailure: 400, critFailure: 300 } }
};

/* -------------------------------------------- */
/*  Espèces (données de base, création)         */
/* -------------------------------------------- */
// base = valeurs de départ ; limits = plafonds ; destin = points de Destin
BRIGANDYNE.species = {
  humain: {
    label: "BRIG.Species.humain",
    base: { com: 25, cns: 25, dis: 25, end: 25, for: 25, tec: 25, psy: 0, mou: 25, per: 25, soc: 25, sur: 25, tir: 25, vol: 25 },
    limits: {}, destin: 3, special: []
  },
  squat: {
    label: "BRIG.Species.squat",
    base: { com: 30, cns: 25, dis: 25, end: 30, for: 25, tec: 30, psy: 0, mou: 20, per: 20, soc: 20, sur: 20, tir: 20, vol: 30 },
    limits: { mou: 60 }, destin: 2, special: ["nyctalopie", "sfPlus1", "pvPlus1"]
  },
  ratling: {
    label: "BRIG.Species.ratling",
    base: { com: 25, cns: 20, dis: 30, end: 20, for: 15, tec: 30, psy: 0, mou: 30, per: 30, soc: 20, sur: 25, tir: 30, vol: 25 },
    limits: { com: 75, for: 45 }, destin: 3, special: []
  },
  ogryn: {
    label: "BRIG.Species.ogryn",
    base: { com: 35, cns: 10, dis: 10, end: 40, for: 50, tec: 15, psy: 0, mou: 20, per: 20, soc: 15, sur: 30, tir: 25, vol: 30 },
    limits: { cns: 30, soc: 50 }, destin: 1, special: ["pvPlus2", "resMaladies"]
  },
  mutant: {
    label: "BRIG.Species.mutant",
    base: { com: 25, cns: 25, dis: 25, end: 30, for: 25, tec: 25, psy: 0, mou: 25, per: 25, soc: 15, sur: 25, tir: 25, vol: 30 },
    limits: { soc: 50 }, destin: 2, special: ["mutations"]
  },
  aeldari: {
    label: "BRIG.Species.aeldari",
    base: { com: 25, cns: 25, dis: 25, end: 20, for: 20, tec: 25, psy: 10, mou: 30, per: 25, soc: 25, sur: 20, tir: 30, vol: 20 },
    limits: { for: 60 }, destin: 2, special: ["nyctalopie"]
  },
  paria: {
    label: "BRIG.Species.paria",
    base: { com: 25, cns: 25, dis: 25, end: 25, for: 25, tec: 25, psy: null, mou: 25, per: 25, soc: 15, sur: 25, tir: 25, vol: 35 },
    limits: {}, destin: 1, special: ["geneParia"], noPsy: true
  }
};

// Lore court par espèce (pour l'assistant de création) — clé = nom du compendium
BRIGANDYNE.speciesLore = {
  "Humain": { desc: "L'espèce majoritaire de l'Imperium, répandue sur d'innombrables mondes. Adaptables et tenaces, mais avides de pouvoir et de conquête.", lifespan: "≈ 60 ans", size: "~1m70, 65 kg" },
  "Squat": { desc: "Abhumains trapus des mondes à forte gravité. Vaillants, opiniâtres, d'une constitution robuste et ingénieurs hors pair.", lifespan: "≈ 100 ans", size: "~1m50, 70 kg" },
  "Ratling": { desc: "Petits Abhumains des Militarum Auxilla. Grossiers et sans-gêne, mais tireurs d'élite inégalés et survivants tenaces.", lifespan: "≈ 60 ans", size: "~1m30, 50 kg" },
  "Ogryn": { desc: "Abhumains colossaux, simples d'esprit mais d'une force légendaire. Leur équipement est conçu pour résister à leur maladresse.", lifespan: "≈ 60 ans", size: "~2m50, 120 kg" },
  "Mutant": { desc: "Humains marqués par une déviance génétique stable. Tolérés mais méprisés, ils occupent les places les plus basses de l'Imperium.", lifespan: "≈ 60 ans", size: "~1m70, 65 kg" },
  "Aeldari": { desc: "Xenos élancés et gracieux, aux sens et à l'agilité surhumains. Rares dans l'Imperium, où on les considère au mieux comme des parias.", lifespan: "≈ 900 ans", size: "~1m70, 60 kg" },
  "Paria": { desc: "Êtres rarissimes nés sans écho dans le Warp. Leur présence désoriente les Psykers proches — mais glace aussi les âmes alentour.", lifespan: "≈ 60 ans", size: "~1m70, 65 kg" }
};

BRIGANDYNE.speciesTraits = {
  nyctalopie: "BRIG.SpeciesTrait.nyctalopie",
  mutations: "BRIG.SpeciesTrait.mutations",
  geneParia: "BRIG.SpeciesTrait.geneParia",
  sfPlus1: "BRIG.SpeciesTrait.sfPlus1",
  pvPlus1: "BRIG.SpeciesTrait.pvPlus1",
  pvPlus2: "BRIG.SpeciesTrait.pvPlus2",
  resMaladies: "BRIG.SpeciesTrait.resMaladies"
};

/* -------------------------------------------- */
/*  Factions / Adepta (groupes de carrières)    */
/* -------------------------------------------- */
BRIGANDYNE.factions = {
  administratum: "BRIG.Faction.administratum",
  arbites: "BRIG.Faction.arbites",
  mechanicus: "BRIG.Faction.mechanicus",
  ministorum: "BRIG.Faction.ministorum",
  militarum: "BRIG.Faction.militarum",
  feodal: "BRIG.Faction.feodal",
  civils: "BRIG.Faction.civils",
  assassinorum: "BRIG.Faction.assassinorum",
  psykana: "BRIG.Faction.psykana",
  inquisition: "BRIG.Faction.inquisition",
  xenos: "BRIG.Faction.xenos",
  chaos: "BRIG.Faction.chaos"
};

/* -------------------------------------------- */
/*  Spécialités (catégories d'atouts)           */
/* -------------------------------------------- */
BRIGANDYNE.specialtyTypes = {
  standard: "BRIG.SpecialtyType.standard",     // +10 / +20
  martiale: "BRIG.SpecialtyType.martiale",     // +5
  occulte: "BRIG.SpecialtyType.occulte"        // +5 (disciplines, Vraie Foi)
};

/* -------------------------------------------- */
/*  Types d'objets « trait »                    */
/* -------------------------------------------- */
BRIGANDYNE.traitTypes = {
  vice: "BRIG.TraitType.vice",
  vertu: "BRIG.TraitType.vertu",
  capacite: "BRIG.TraitType.capacite",   // PEUR, Nuée, Infatigable, Furie…
  particularite: "BRIG.TraitType.particularite"
};

/* -------------------------------------------- */
/*  Rôles narratifs (figurant / second / premier) */
/* -------------------------------------------- */
BRIGANDYNE.roles = {
  premierRole: "BRIG.Role.premierRole",
  secondRole: "BRIG.Role.secondRole",
  figurant: "BRIG.Role.figurant"
};

/* -------------------------------------------- */
/*  Constantes mécaniques                       */
/* -------------------------------------------- */
BRIGANDYNE.mechanics = {
  modoCenter: 50,          // MODO = 50 - compétence
  sfForAdvantage: 2,       // -2 SF => +1 Avantage
  pvForBonus: 1,           // 1 PV sacrifié => +1%
  sfBonusPercent: 10,      // payer du SF => +10%
  maxCharCreation: 50      // plafond de PSY à la création, etc.
};

/* -------------------------------------------- */
/*  Avancement (XP) — coûts ajustables          */
/* -------------------------------------------- */
BRIGANDYNE.advancement = {
  charStep: 5,             // une amélioration = +5%
  // Coût en XP pour ATTEINDRE une valeur ≤ max (barème RAW Brigandyne 2e, p.150)
  charCosts: [
    { max: 50, cost: 100 },
    { max: 60, cost: 150 },
    { max: 70, cost: 200 },
    { max: 80, cost: 250 },
    { max: 90, cost: 300 },
    { max: 100, cost: 350 }
  ],
  maxBoxes: 6,             // 6 cases de progression max par compétence (+30 ; +40 pour carrière avancée, non modélisé)
  charOffProfileExtra: 50, // hors profil de progression : +50 PX (RAW p.151)
  specialtyCost: 100,      // spécialité de carrière (hors-carrière : +50, RAW p.151)
  talentCost: 100          // talent de carrière (hors-carrière : +50, RAW p.151)
};

/** Coût XP pour amener une caractéristique à `newTotal`. */
BRIGANDYNE.charAdvanceCost = function (newTotal) {
  const row = BRIGANDYNE.advancement.charCosts.find(r => newTotal <= r.max);
  return row ? row.cost : 350;
};

export default BRIGANDYNE;
