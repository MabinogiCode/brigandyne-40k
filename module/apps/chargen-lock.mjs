import { SYSTEM_ID } from "../brigandyne40k.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * Verrouillage de la création de personnage.
 *
 * L'état est stocké dans un flag sur le **User** : `flags.brigandyne-40k.chargen`.
 * Le verrou EST la présence de la valeur :
 *   - `method` non nul        → méthode choisie (on ne peut plus en changer)
 *   - `rolledOnce`/`pool`      → dés jetés (on ne peut plus relancer)
 *   - `complete`              → le joueur possède déjà son unique personnage
 *
 * Le MJ déverrouille en effaçant la valeur (via une demande du joueur passée par
 * socket, ou via l'outil de gestion). Le joueur re-verrouille dès qu'il refait
 * le choix correspondant.
 */

export const BLANK_LOCK = { method: null, rolledOnce: false, pool: null, complete: false, actorId: null };

/** Lit l'état de création d'un utilisateur (avec valeurs par défaut). */
export function getChargenLock(user = game.user) {
  const stored = user?.getFlag(SYSTEM_ID, "chargen") ?? {};
  return foundry.utils.mergeObject(foundry.utils.deepClone(BLANK_LOCK), stored, { inplace: false });
}

/** Fusionne un correctif dans l'état de création. */
export async function setChargenLock(user, patch) {
  const next = foundry.utils.mergeObject(getChargenLock(user), patch, { inplace: false });
  return user.setFlag(SYSTEM_ID, "chargen", next);
}

/* ----- Actions MJ (déverrouillage) ----- */

/** Réinitialise totalement la création (« faire un nouveau perso »). */
export async function gmResetCreation(user) {
  return user.setFlag(SYSTEM_ID, "chargen", foundry.utils.deepClone(BLANK_LOCK));
}
/** Déverrouille le choix de méthode (et invalide le tirage qui en dépend). */
export async function gmUnlockMethod(user) {
  return setChargenLock(user, { method: null, rolledOnce: false, pool: null });
}
/** Déverrouille uniquement le tirage des dés. */
export async function gmUnlockReroll(user) {
  return setChargenLock(user, { rolledOnce: false, pool: null });
}

const REQUESTS = {
  new: { labelKey: "BRIG.CharGen.lock.req.new", apply: gmResetCreation },
  method: { labelKey: "BRIG.CharGen.lock.req.method", apply: gmUnlockMethod },
  reroll: { labelKey: "BRIG.CharGen.lock.req.reroll", apply: gmUnlockReroll }
};

/* ----- Côté joueur : demande au MJ via socket ----- */

/** Y a-t-il au moins un MJ connecté pour traiter une demande ? */
export function hasActiveGM() {
  return game.users.some(u => u.isGM && u.active);
}

/** Le joueur envoie une demande de déverrouillage au(x) MJ. */
export function requestUnlock(request) {
  if (!REQUESTS[request]) return;
  if (!hasActiveGM()) { ui.notifications?.warn(game.i18n.localize("BRIG.CharGen.lock.noGM")); return; }
  game.socket.emit(`system.${SYSTEM_ID}`, {
    action: "chargenRequest", request, userId: game.user.id, userName: game.user.name
  });
  ui.notifications?.info(game.i18n.localize("BRIG.CharGen.lock.requestSent"));
}

/* ----- Côté MJ : réception socket ----- */

export function registerCharGenSocket() {
  game.socket.on(`system.${SYSTEM_ID}`, onSocket);
}

async function onSocket(data) {
  if (data?.action !== "chargenRequest" || !game.user.isGM) return;
  // Un seul MJ traite la demande (le MJ « actif » désigné).
  if (game.users.activeGM && game.users.activeGM !== game.user) return;

  const req = REQUESTS[data.request];
  const target = game.users.get(data.userId);
  if (!req || !target) return;

  const reqLabel = game.i18n.localize(req.labelKey);
  const ok = await DialogV2.confirm({
    window: { title: game.i18n.localize("BRIG.CharGen.lock.gmRequestTitle"), icon: "fa-solid fa-unlock" },
    content: `<p>${game.i18n.format("BRIG.CharGen.lock.gmRequestBody", { user: target.name, request: reqLabel })}</p>`,
    rejectClose: false
  }).catch(() => false);

  if (ok) {
    await req.apply(target);
    ui.notifications?.info(game.i18n.format("BRIG.CharGen.lock.granted", { user: target.name, request: reqLabel }));
  }
}

/* ----- Outil MJ : gestion des créations ----- */

const STATE_KEY = lock => lock.complete ? "complete" : lock.rolledOnce ? "rolled" : lock.method ? "method" : "fresh";

/** Construit le contenu HTML de l'outil de gestion (une ligne par joueur). */
function adminContent() {
  const players = game.users.filter(u => !u.isGM);
  if (!players.length) return `<p>${game.i18n.localize("BRIG.CharGen.lock.noPlayers")}</p>`;
  const rows = players.map(u => {
    const lock = getChargenLock(u);
    const methodLabel = lock.method
      ? game.i18n.localize(lock.method === "roll" ? "BRIG.CharGen.method.roll" : "BRIG.CharGen.method.points")
      : "—";
    const state = game.i18n.localize(`BRIG.CharGen.lock.state.${STATE_KEY(lock)}`);
    return `
      <tr data-user="${u.id}">
        <td class="u-name"><span class="u-dot" style="background:${u.color}"></span>${u.name}</td>
        <td>${state}</td>
        <td>${methodLabel}${lock.rolledOnce ? ' <i class="fa-solid fa-dice" data-tooltip="Dés jetés"></i>' : ""}</td>
        <td class="u-actions">
          <button type="button" data-act="reroll" data-tooltip="${game.i18n.localize("BRIG.CharGen.lock.req.reroll")}"><i class="fa-solid fa-rotate"></i></button>
          <button type="button" data-act="method" data-tooltip="${game.i18n.localize("BRIG.CharGen.lock.req.method")}"><i class="fa-solid fa-sliders"></i></button>
          <button type="button" data-act="new" data-tooltip="${game.i18n.localize("BRIG.CharGen.lock.req.new")}"><i class="fa-solid fa-user-plus"></i></button>
        </td>
      </tr>`;
  }).join("");
  return `
    <div class="brig-chargen-admin">
      <p class="hint">${game.i18n.localize("BRIG.CharGen.lock.adminHint")}</p>
      <table>
        <thead><tr>
          <th>${game.i18n.localize("BRIG.CharGen.lock.colPlayer")}</th>
          <th>${game.i18n.localize("BRIG.CharGen.lock.colState")}</th>
          <th>${game.i18n.localize("BRIG.CharGen.method.label")}</th>
          <th>${game.i18n.localize("BRIG.CharGen.lock.colActions")}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/** Ouvre l'outil MJ de gestion des verrous de création. */
export function openCharGenAdmin() {
  if (!game.user.isGM) return;
  const dialog = new DialogV2({
    window: { title: game.i18n.localize("BRIG.CharGen.lock.adminTitle"), icon: "fa-solid fa-user-lock" },
    classes: ["brigandyne-40k"],
    position: { width: 540 },
    content: adminContent(),
    buttons: [{ action: "close", label: game.i18n.localize("BRIG.CharGen.lock.adminClose"), default: true }]
  });

  const wire = () => {
    const el = dialog.element; if (!el) return;
    el.querySelectorAll(".u-actions button").forEach(btn => btn.addEventListener("click", async () => {
      const userId = btn.closest("[data-user]")?.dataset.user;
      const act = btn.dataset.act;
      const user = game.users.get(userId);
      if (!user || !REQUESTS[act]) return;
      await REQUESTS[act].apply(user);
      ui.notifications?.info(game.i18n.format("BRIG.CharGen.lock.granted", { user: user.name, request: game.i18n.localize(REQUESTS[act].labelKey) }));
      // Re-rendu du contenu pour refléter le nouvel état
      const content = el.querySelector(".dialog-content") || el.querySelector(".window-content");
      if (content) { content.innerHTML = adminContent(); wire(); }
    }));
  };

  dialog.render({ force: true }).then(wire);
}
