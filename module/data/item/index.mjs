import { WeaponModel, ArmorModel, AmmunitionModel, EquipmentModel, AugmentationModel } from "./gear.mjs";
import { SpeciesModel, CareerModel, SpecialtyModel, TalentModel, TraitModel, MutationModel, CriticalInjuryModel } from "./build.mjs";
import { PsychicPowerModel, FaithActModel } from "./powers.mjs";

export const ITEM_MODELS = {
  weapon: WeaponModel,
  armor: ArmorModel,
  ammunition: AmmunitionModel,
  equipment: EquipmentModel,
  augmentation: AugmentationModel,
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
  SpeciesModel, CareerModel, SpecialtyModel, TalentModel, TraitModel, MutationModel, CriticalInjuryModel,
  PsychicPowerModel, FaithActModel
};
