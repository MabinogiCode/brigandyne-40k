import { BRIGANDYNE } from "../config/config.js";

const { DialogV2 } = foundry.applications.api;

/**
 * Ouvre le dialogue de configuration d'un test et renvoie les modificateurs
 * choisis, ou null si annulé.
 * @returns {Promise<{difficulty:number, situational:number, advantage:number, disadvantage:number}|null>}
 */
export async function promptTest({ actor, testData }: { actor?: any; testData?: any } = {}) {
  const base = testData?.base ?? 0;
  const presetMods = (testData?.modifiers || []).reduce((s, m) => s + (Number(m.value) || 0), 0);

  const diffOptions = Object.entries(BRIGANDYNE.difficulties)
    .map(([v, label]: [string, any]) => `<option value="${v}" ${Number(v) === 0 ? "selected" : ""}>${game.i18n.localize(label)}</option>`)
    .join("");

  // Tactiques de combat (uniquement pour les attaques)
  const tacticBlock = testData?.tactics ? `
      <div class="form-group">
        <label><i class="fa-solid fa-chess-knight"></i> ${game.i18n.localize("BRIG.Tactic.label")}</label>
        <select name="tactic">
          <option value="">${game.i18n.localize("BRIG.Tactic.none")}</option>
          ${Object.entries(BRIGANDYNE.combatTactics).map(([k, t]: [string, any]) =>
            `<option value="${k}">${game.i18n.localize(t.label)}</option>`).join("")}
        </select>
      </div>` : "";

  const content = `
    <form class="brigandyne-40k test-dialog">
      <p class="dialog-target">
        ${game.i18n.localize("BRIG.Dialog.base")} : <strong>${base}</strong>
        ${presetMods ? `<span class="preset">(${presetMods >= 0 ? "+" : ""}${presetMods})</span>` : ""}
      </p>
      <div class="form-group">
        <label>${game.i18n.localize("BRIG.Difficulty.label")}</label>
        <select name="difficulty">${diffOptions}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("BRIG.Test.situational")}</label>
        <input type="number" name="situational" value="0" step="5" />
      </div>
      <div class="form-grid two">
        <div class="form-group">
          <label><i class="fa-solid fa-circle-up"></i> ${game.i18n.localize("BRIG.Dialog.advantage")}</label>
          <input type="number" name="advantage" value="0" min="0" max="3" />
        </div>
        <div class="form-group">
          <label><i class="fa-solid fa-circle-down"></i> ${game.i18n.localize("BRIG.Dialog.disadvantage")}</label>
          <input type="number" name="disadvantage" value="0" min="0" max="3" />
        </div>
      </div>
      ${tacticBlock}
    </form>`;

  const parse = (form) => ({
    difficulty: Number(form.difficulty.value) || 0,
    situational: Number(form.situational.value) || 0,
    advantage: Number(form.advantage.value) || 0,
    disadvantage: Number(form.disadvantage.value) || 0,
    tactic: form.tactic?.value || ""
  });

  // Instance + Promise manuelle pour pouvoir forcer le premier plan (bringToFront)
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const dialog = new DialogV2({
      window: { title: testData?.label || game.i18n.localize("BRIG.Dialog.title"), icon: "fa-solid fa-dice-d10" },
      classes: ["brigandyne-40k"],
      content,
      buttons: [
        { action: "roll", label: game.i18n.localize("BRIG.Dialog.roll"), icon: "fa-solid fa-dice-d10", default: true, callback: (event, button) => finish(parse(button.form.elements)) },
        { action: "cancel", label: game.i18n.localize("BRIG.Dialog.cancel"), icon: "fa-solid fa-xmark", callback: () => finish(null) }
      ],
      close: () => finish(null)
    } as any);
    dialog.render({ force: true }).then(() => {
      dialog.bringToFront?.();
      setTimeout(() => dialog.bringToFront?.(), 30);
    });
  });
}
