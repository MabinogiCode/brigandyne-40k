import { WeaponModel, ArmorModel, AmmunitionModel, EquipmentModel, AugmentationModel } from "./gear.ts";
import { ArchetypeModel, SpeciesModel, CareerModel, SpecialtyModel, TalentModel, TraitModel, MutationModel, CriticalInjuryModel } from "./build.ts";
import { PsychicPowerModel, FaithActModel } from "./powers.ts";

export const ITEM_MODELS = {
  weapon: WeaponModel,
  armor: ArmorModel,
  ammunition: AmmunitionModel,
  equipment: EquipmentModel,
  augmentation: AugmentationModel,
  archetype: ArchetypeModel,
  species: SpeciesModel,
  career: CareerModel,
  specialty: SpecialtyModel,
  talent: TalentModel,
  trait: TraitModel,
  mutation: MutationModel,
  criticalInjury: CriticalInjuryModel,
  psychicPower: PsychicPowerModel,
  faithAct: FaithActModel
};

export {
  WeaponModel, ArmorModel, AmmunitionModel, EquipmentModel, AugmentationModel,
  ArchetypeModel, SpeciesModel, CareerModel, SpecialtyModel, TalentModel, TraitModel, MutationModel, CriticalInjuryModel,
  PsychicPowerModel, FaithActModel
};
