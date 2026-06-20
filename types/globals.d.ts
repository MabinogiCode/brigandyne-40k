/**
 * Augmentations des globaux Foundry VTT non couverts par foundry-vtt-types.
 * Déclarations complémentaires pour le système Brigandyne 40K.
 */

// Math.clamp est une extension de Foundry VTT non présente dans les types DOM standard.
interface Math {
  clamp(value: number, min: number, max: number): number;
}

// fromUuid est un utilitaire Foundry global
declare function fromUuid(uuid: string): Promise<foundry.abstract.Document<any, any, any> | null>;
