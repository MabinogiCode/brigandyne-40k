/**
 * Séquelles & blessures graves — Livre Premier p.196-197 (règles avancées,
 * « Combat et séquelles »). Source de vérité du tirage : d100 sur 11 lignes.
 *
 * Les pertes de points sont DÉFINITIVES (p.197). Le livre parle d'Habileté (HAB) ;
 * l'adaptation 40K la remplace par la Technique (TEC).
 */

export interface SequelaPenalty {
  /** Caractéristiques concernées : une seule = perte imposée, plusieurs = « au choix du joueur ». */
  chars: string[];
  /** Variation définitive (en %), ex. −5. */
  value: number;
}

export interface Sequela {
  min: number;
  max: number;
  name: string;
  /** Texte du livre (effet). */
  effect: string;
  /** Pertes de compétence appliquées automatiquement (avec choix quand `chars.length > 1`). */
  penalties: SequelaPenalty[];
  /** Perte définitive de PV (Douleurs chroniques). */
  pvLost?: number;
  /** Localisation affichée sur la fiche. */
  location: string;
}

export const SEQUELAE: Sequela[] = [
  { min: 1, max: 5, name: "Œil crevé", location: "Tête",
    effect: "Pas de chance, le personnage devient borgne. TIR, TEC et PER −5 %.",
    penalties: [{ chars: ["tir"], value: -5 }, { chars: ["tec"], value: -5 }, { chars: ["per"], value: -5 }] },
  { min: 6, max: 10, name: "Oreille tranchée, écrasée", location: "Tête",
    effect: "Tous les tests de PER auditive se font à −10 %.", penalties: [] },
  { min: 11, max: 20, name: "Souvenir enlaidissant", location: "Visage",
    effect: "Nez de travers, entaille à la bouche, dents en moins, crâne pelé, vilaine cicatrice… SOC −5 %.",
    penalties: [{ chars: ["soc"], value: -5 }] },
  { min: 21, max: 30, name: "Choc au crâne", location: "Tête",
    effect: "Perte de neurones, trous de mémoire, légers troubles cognitifs… CNS −5 %.",
    penalties: [{ chars: ["cns"], value: -5 }] },
  { min: 31, max: 45, name: "Belle cicatrice", location: "—",
    effect: "Juste de quoi plastronner dans les tavernes. Vous vous en tirez bien pour cette fois.", penalties: [] },
  { min: 46, max: 55, name: "Blessure sale, infection", location: "—",
    effect: "−1 PV/jour tant que la blessure n'est pas soignée par un médecin ou le membre amputé.", penalties: [] },
  { min: 56, max: 65, name: "Blessure handicapante (jambe)", location: "Jambe",
    effect: "Choc ou déchirure (jambe, genou, pied ou hanche). MOU ou DIS −5 % (au choix du joueur).",
    penalties: [{ chars: ["mou", "dis"], value: -5 }] },
  { min: 66, max: 75, name: "Blessure handicapante (main)", location: "Bras",
    effect: "Choc ou déchirure (main, doigts, coude ou poignet). TEC ou TIR −5 % (au choix du joueur).",
    penalties: [{ chars: ["tec", "tir"], value: -5 }] },
  { min: 76, max: 85, name: "Affaiblissement", location: "Torse",
    effect: "Choc à l'épaule, au dos, au poumon, côtes cassées… FOR ou END −5 % (au choix du joueur).",
    penalties: [{ chars: ["for", "end"], value: -5 }] },
  { min: 86, max: 95, name: "Douleurs chroniques", location: "—",
    effect: "Perte définitive de 2 PV.", penalties: [], pvLost: 2 },
  { min: 96, max: 100, name: "Blessure traumatisante", location: "—",
    effect: "Le PJ a vu la mort de si près qu'il en est devenu moins téméraire. COM ou VOL −5 % (au choix du joueur).",
    penalties: [{ chars: ["com", "vol"], value: -5 }] }
];

/** Ligne de la table pour un jet de d100 (1-100). */
export function sequelaFor(roll: number): Sequela {
  const r = Math.min(100, Math.max(1, Math.round(roll)));
  return SEQUELAE.find(s => r >= s.min && r <= s.max)!;
}
