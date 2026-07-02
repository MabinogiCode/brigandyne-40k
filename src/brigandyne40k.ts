/**
 * Warhammer 40,000 : Brigandyne — point d'entrée du système.
 */
import { BRIGANDYNE } from "./config/config.ts";
import { ACTOR_MODELS, ITEM_MODELS } from "./data/index.ts";
import { BrigActor } from "./documents/actor.ts";
import { BrigItem } from "./documents/item.ts";
import { BrigCharacterSheet } from "./apps/sheets/actor/character-sheet.ts";
import { BrigNpcSheet } from "./apps/sheets/actor/npc-sheet.ts";
import { BrigVehicleSheet } from "./apps/sheets/actor/vehicle-sheet.ts";
import { BrigItemSheet } from "./apps/sheets/item/item-sheet.ts";
import { registerHandlebarsHelpers, preloadHandlebarsTemplates } from "./helpers/handlebars.ts";
import { BrigTest, rollTest, degreeOf } from "./dice/roll.ts";
import { registerChatListeners } from "./documents/chat.ts";
import { BrigCharGen } from "./apps/char-gen.ts";
import { BrigWelcome, registerWelcome } from "./apps/welcome.ts";
import { registerCharGenSocket, openCharGenAdmin } from "./apps/chargen-lock.ts";

export const SYSTEM_ID = "brigandyne-40k";

Hooks.once("init", async function () {
  console.log(`${SYSTEM_ID} | Initialisation de Warhammer 40,000 : Brigandyne`);

  CONFIG.BRIGANDYNE = BRIGANDYNE;
  game.brigandyne = { BrigTest, rollTest, degreeOf, config: BRIGANDYNE, CharGen: BrigCharGen, Welcome: BrigWelcome };

  // Police d'ambiance — anciennement clé « fonts » du manifest, retirée car
  // inconnue du schéma system.json (enregistrement par code désormais).
  CONFIG.fontDefinitions["Cinzel"] = {
    editor: true,
    fonts: [{ urls: [`systems/${SYSTEM_ID}/assets/fonts/Cinzel.ttf`], weight: 700, style: "normal" }]
  };

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
  registerWelcome();
  await preloadHandlebarsTemplates();
});

Hooks.once("i18nInit", function () {
  // États / conditions comme status effects
  CONFIG.statusEffects = Object.entries(BRIGANDYNE.conditions).map(([id, c]: [string, any]) => ({
    id,
    name: game.i18n.localize(c.label),
    img: c.icon
  }));
  CONFIG.specialStatusEffects = foundry.utils.mergeObject(CONFIG.specialStatusEffects ?? {}, {
    DEFEATED: "vaincu"
  });
});

Hooks.once("ready", function () {
  registerCharGenSocket();
  console.log(`${SYSTEM_ID} | Système prêt — Pour l'Empereur !`);
});

// Bouton « Assistant de création » dans le répertoire des Acteurs
Hooks.on("renderActorDirectory", (app, html) => {
  const el = html instanceof HTMLElement ? html : html?.[0];
  if (!el || el.querySelector(".brig-chargen-launch")) return;
  const header = el.querySelector(".header-actions") || el.querySelector(".directory-header");
  if (!header) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "brig-chargen-launch";
  btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${game.i18n.localize("BRIG.CharGen.title")}`;
  btn.addEventListener("click", () => new BrigCharGen().render(true));
  header.appendChild(btn);

  // Écran d'accueil : accessible à tous (joueurs compris) pour rouvrir la bannière
  const welcome = document.createElement("button");
  welcome.type = "button";
  welcome.className = "brig-welcome-launch";
  welcome.innerHTML = `<i class="fa-solid fa-book-skull"></i> ${game.i18n.localize("BRIG.Welcome.reopen")}`;
  welcome.addEventListener("click", () => new BrigWelcome().render(true));
  header.appendChild(welcome);

  // Outil MJ : gestion des verrous de création
  if (game.user.isGM) {
    const admin = document.createElement("button");
    admin.type = "button";
    admin.className = "brig-chargen-admin-launch";
    admin.innerHTML = `<i class="fa-solid fa-user-lock"></i> ${game.i18n.localize("BRIG.CharGen.lock.adminTitle")}`;
    admin.addEventListener("click", () => openCharGenAdmin());
    header.appendChild(admin);
  }
});
