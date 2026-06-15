/**
 * Warhammer 40,000 : Brigandyne — point d'entrée du système.
 */
import { BRIGANDYNE } from "./config/config.mjs";
import { ACTOR_MODELS, ITEM_MODELS } from "./data/index.mjs";
import { BrigActor } from "./documents/actor.mjs";
import { BrigItem } from "./documents/item.mjs";
import { BrigCharacterSheet } from "./apps/sheets/actor/character-sheet.mjs";
import { BrigNpcSheet } from "./apps/sheets/actor/npc-sheet.mjs";
import { BrigVehicleSheet } from "./apps/sheets/actor/vehicle-sheet.mjs";
import { BrigItemSheet } from "./apps/sheets/item/item-sheet.mjs";
import { registerHandlebarsHelpers, preloadHandlebarsTemplates } from "./helpers/handlebars.mjs";
import { BrigTest, rollTest, degreeOf } from "./dice/roll.mjs";
import { registerChatListeners } from "./documents/chat.mjs";
import { BrigCharGen } from "./apps/char-gen.mjs";

export const SYSTEM_ID = "brigandyne-40k";

Hooks.once("init", async function () {
  console.log(`${SYSTEM_ID} | Initialisation de Warhammer 40,000 : Brigandyne`);

  CONFIG.BRIGANDYNE = BRIGANDYNE;
  game.brigandyne = { BrigTest, rollTest, degreeOf, config: BRIGANDYNE, CharGen: BrigCharGen };

  // Documents
  CONFIG.Actor.documentClass = BrigActor;
  CONFIG.Item.documentClass = BrigItem;

  // DataModels
  for (const [type, model] of Object.entries(ACTOR_MODELS)) CONFIG.Actor.dataModels[type] = model;
  for (const [type, model] of Object.entries(ITEM_MODELS)) CONFIG.Item.dataModels[type] = model;

  // Initiative (turn order)
  CONFIG.Combat.initiative = { formula: "@initiative", decimals: 0 };

  // Effets actifs modernes
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Enregistrement des feuilles (ApplicationV2)
  const DSC = foundry.applications.apps.DocumentSheetConfig;
  DSC.registerSheet(Actor, SYSTEM_ID, BrigCharacterSheet, { types: ["character"], makeDefault: true, label: "BRIG.Sheet.character" });
  DSC.registerSheet(Actor, SYSTEM_ID, BrigNpcSheet, { types: ["npc"], makeDefault: true, label: "BRIG.Sheet.npc" });
  DSC.registerSheet(Actor, SYSTEM_ID, BrigVehicleSheet, { types: ["vehicle"], makeDefault: true, label: "BRIG.Sheet.vehicle" });
  DSC.registerSheet(Item, SYSTEM_ID, BrigItemSheet, { makeDefault: true, label: "BRIG.Sheet.item" });

  registerHandlebarsHelpers();
  registerChatListeners();
  await preloadHandlebarsTemplates();
});

Hooks.once("i18nInit", function () {
  // États / conditions comme status effects
  CONFIG.statusEffects = Object.entries(BRIGANDYNE.conditions).map(([id, c]) => ({
    id,
    name: game.i18n.localize(c.label),
    img: c.icon
  }));
  CONFIG.specialStatusEffects = foundry.utils.mergeObject(CONFIG.specialStatusEffects ?? {}, {
    DEFEATED: "aterre"
  });
});

Hooks.once("ready", function () {
  console.log(`${SYSTEM_ID} | Système prêt — Pour l'Empereur !`);
});
