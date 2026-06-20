import { SYSTEM_ID } from "../brigandyne40k.js";
import { BrigCharGen } from "./char-gen.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Écran d'accueil du système, affiché au lancement du monde.
 * Présente la bannière, un mot de bienvenue, les crédits et un accès rapide
 * à l'assistant de création. Une case « ne plus afficher » mémorise la version vue.
 */
export class BrigWelcome extends (HandlebarsApplicationMixin(ApplicationV2) as any) {
  static DEFAULT_OPTIONS = {
    id: "brig-welcome",
    tag: "div",
    classes: ["brigandyne-40k", "brig-welcome"],
    position: { width: 720, height: "auto" },
    window: { title: "BRIG.Welcome.title", icon: "fa-solid fa-skull", resizable: false },
    actions: {
      welcomeChargen: BrigWelcome.#onChargen,
      welcomeClose: BrigWelcome.#onClose
    }
  };

  static PARTS = { body: { template: "systems/brigandyne-40k/templates/apps/welcome.hbs" } };

  async _prepareContext() {
    const sys = game.system;
    return {
      banner: `systems/${SYSTEM_ID}/assets/ui/welcome-banner.webp`,
      version: sys?.version ?? "",
      isGM: game.user.isGM,
      note: (sys?.flags as any)?.[SYSTEM_ID]?.note ?? ""
    };
  }

  /** Lit l'état de la case « ne plus afficher » et l'enregistre. */
  async _persistDontShow() {
    const cb = this.element?.querySelector("input[name='dontShow']");
    if ((cb as any)?.checked) await (game.settings as any).set(SYSTEM_ID, "welcomeSeenVersion", game.system.version);
    else await (game.settings as any).set(SYSTEM_ID, "welcomeSeenVersion", "");
  }

  static async #onChargen() {
    await this._persistDontShow();
    await this.close();
    new BrigCharGen().render(true);
  }

  static async #onClose() {
    await this._persistDontShow();
    await this.close();
  }
}

/**
 * Enregistre le réglage de suivi de version et programme l'affichage de l'écran
 * d'accueil au `ready` (une fois par version, par client). Expose un raccourci
 * `game.brigandyne.welcome()` pour le rouvrir manuellement.
 */
export function registerWelcome() {
  (game.settings as any).register(SYSTEM_ID, "welcomeSeenVersion", {
    name: "BRIG.Settings.welcomeSeenVersion",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });
  (game.settings as any).register(SYSTEM_ID, "showWelcome", {
    name: "BRIG.Settings.showWelcome.name",
    hint: "BRIG.Settings.showWelcome.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  if ((game as any).brigandyne) (game as any).brigandyne.welcome = () => new BrigWelcome().render(true);

  Hooks.once("ready", () => {
    if (!(game.settings as any).get(SYSTEM_ID, "showWelcome")) return;
    if ((game.settings as any).get(SYSTEM_ID, "welcomeSeenVersion") === game.system.version) return;
    new BrigWelcome().render(true);
  });
}
