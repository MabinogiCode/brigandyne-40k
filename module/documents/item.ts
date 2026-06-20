import { BRIGANDYNE } from "../config/config.js";

/**
 * Document Objet du système.
 */
export class BrigItem extends (Item as any) {

  prepareDerivedData() {
    super.prepareDerivedData();
    if (this.type === "weapon") this._prepareWeaponLabel();
  }

  /** Construit une chaîne de dégâts lisible (RU + bonus). */
  _prepareWeaponLabel() {
    const s = this.system;
    const actor = this.actor;
    let bonus = s.damageMod ?? 0;
    if (s.damageBase === "for") {
      const forBonus = actor?.system?.characteristics?.for?.bonus;
      s.damageLabel = forBonus != null
        ? `RU+${Math.max(0, forBonus + bonus)}`
        : `RU+FOR${bonus >= 0 ? "+" : ""}${bonus || ""}`.replace("+0", "");
    } else {
      s.damageLabel = `RU+${bonus}`;
    }
  }

  /** Utilise/active l'objet selon son type. */
  async use(options = {}) {
    if (!this.actor) return this.sheet?.render(true);
    switch (this.type) {
      case "weapon": return this.actor.rollWeaponAttack(this, options);
      case "psychicPower": return this.actor.rollPower(this, options);
      case "faithAct": return this.actor.rollFaith(this, options);
      case "specialty": return this.actor.rollSpecialty(this, options);
      default: return this.toChat();
    }
  }

  /** Affiche une fiche descriptive de l'objet en chat. */
  async toChat() {
    const { renderTemplate } = foundry.applications.handlebars;
    const content = await renderTemplate("systems/brigandyne-40k/templates/chat/item-card.hbs", {
      item: this, system: this.system
    });
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }
}
