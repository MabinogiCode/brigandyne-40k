import { BRIGANDYNE } from "../config/config.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * Ouvre le dialogue de configuration d'un test et renvoie les modificateurs
 * choisis, ou null si annulé.
 * @returns {Promise<{difficulty:number, situational:number, advantage:number, disadvantage:number}|null>}
 */
export async function promptTest({ actor, testData } = {}) {
  const base = testData?.base ?? 0;
  const presetMods = (testData?.modifiers || []).reduce((s, m) => s + (Number(m.value) || 0), 0);

  const diffOptions = Object.entries(BRIGANDYNE.difficulties)
    .map(([v, label]) => `<option value="${v}" ${Number(v) === 0 ? "selected" : ""}>${game.i18n.localize(label)}</option>`)
    .join("");

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
          <input type="number" name="advantage" value="0" min="0" />
        </div>
        <div class="form-group">
          <label><i class="fa-solid fa-circle-down"></i> ${game.i18n.localize("BRIG.Dialog.disadvantage")}</label>
          <input type="number" name="disadvantage" value="0" min="0" />
        </div>
      </div>
    </form>`;

  const parse = (form) => ({
    difficulty: Number(form.difficulty.value) || 0,
    situational: Number(form.situational.value) || 0,
    advantage: Number(form.advantage.value) || 0,
    disadvantage: Number(form.disadvantage.value) || 0
  });

  return DialogV2.wait({
    window: { title: testData?.label || game.i18n.localize("BRIG.Dialog.title"), icon: "fa-solid fa-dice-d10" },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "roll",
        label: game.i18n.localize("BRIG.Dialog.roll"),
        icon: "fa-solid fa-dice-d10",
        default: true,
        callback: (event, button) => parse(button.form.elements)
      },
      {
        action: "cancel",
        label: game.i18n.localize("BRIG.Dialog.cancel"),
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ],
    close: () => null
  });
}
