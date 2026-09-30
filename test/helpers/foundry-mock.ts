/**
 * Simulacre minimal de Foundry VTT pour tester la « colle » (BrigActor) hors du VTT :
 * acteurs, objets, jets de dés scriptés, cartes de chat, notifications.
 * Il ne remplace PAS un essai dans Foundry ; il attrape les erreurs de logique
 * (variable manquante, mauvais calcul, mauvais ordre d'appel).
 */

export const log = {
  chat: [] as any[],
  warn: [] as string[],
  info: [] as string[],
  updates: [] as any[]
};
/** File des prochains résultats de dés (consommés dans l'ordre par `new Roll(...).evaluate()`). */
export const diceQueue: number[] = [];
export const registry = new Map<string, any>();
export const targets = new Set<any>();
export const flags = { combatStarted: false };

export function resetMock() {
  log.chat.length = 0; log.warn.length = 0; log.info.length = 0; log.updates.length = 0;
  diceQueue.length = 0; registry.clear(); targets.clear(); flags.combatStarted = false;
}

/** Affecte `obj[a][b][c] = v` pour un chemin « a.b.c ». */
function setPath(obj: any, path: string, value: any) {
  const parts = path.split(".");
  let o = obj;
  for (const p of parts.slice(0, -1)) o = (o[p] ??= {});
  o[parts[parts.length - 1]] = value;
}
export const getPath = (obj: any, path: string) => path.split(".").reduce((o, p) => (o == null ? o : o[p]), obj);

class MockItem {
  id: string; uuid: string; name: string; type: string; system: any; parent: any = null;
  constructor(data: any) {
    Object.assign(this, { id: data.id ?? Math.random().toString(36).slice(2), name: data.name, type: data.type });
    this.system = data.system ?? {};
    this.uuid = `Item.${this.id}`;
    registry.set(this.uuid, this);
    // méthodes des DataModels d'armes/armures
    const q = () => this.system.qualities ?? [];
    this.system.hasQuality ??= (k: string) => q().some((x: any) => x.key === k);
    this.system.qualityValue ??= (k: string) => { const x = q().find((y: any) => y.key === k); return x ? (x.value ?? true) : null; };
    if (this.type === "weapon") {
      this.system.isMelee ??= this.system.weaponType === "melee";
      this.system.isRanged ??= this.system.weaponType === "ranged";
      this.system.rollChar ??= this.system.attackChar || (this.system.isMelee ? "com" : "tir");
    }
  }
  async update(u: Record<string, any>) { for (const [k, v] of Object.entries(u)) setPath(this, k, v); log.updates.push({ item: this.name, ...u }); }
  async toChat() { log.chat.push({ item: this.name }); }
}

export const CHARS = ["com", "cns", "dis", "end", "for", "tec", "psy", "mou", "per", "soc", "sur", "tir", "vol"];

class MockActor {
  id = Math.random().toString(36).slice(2);
  uuid: string; name: string; type: string; system: any; items: any[] = []; isOwner = true;
  constructor(data: any) {
    this.name = data.name ?? "Acteur"; this.type = data.type ?? "character"; this.system = data.system ?? {};
    this.uuid = `Actor.${this.id}`;
    registry.set(this.uuid, this);
    for (const i of data.items ?? []) this.addItem(i);
  }
  addItem(data: any) { const it = new MockItem(data); it.parent = this; this.items.push(it); return it; }
  async createEmbeddedDocuments(_t: string, list: any[]) { return list.map(d => this.addItem(d)); }
  async update(u: Record<string, any>) { for (const [k, v] of Object.entries(u)) setPath(this, k, v); log.updates.push({ actor: this.name, ...u }); }
  getActiveTokens() { return []; }
  async toggleStatusEffect(id: string) { (this.system._statuses ??= []).push(id); }
  prepareDerivedData() {}
  getRollData() { return {}; }
}

/** Profil de personnage : toutes les caractéristiques à 25 sauf surcharges ; PV/SF/Destin courants. */
export function characterSystem(over: Record<string, any> = {}, chars: Record<string, number> = {}) {
  const characteristics: any = {};
  for (const k of CHARS) {
    const total = chars[k] ?? (k === "psy" ? 0 : 25);
    characteristics[k] = { value: total, mod: 0, total, bonus: Math.floor(total / 10) };
  }
  return {
    characteristics,
    pv: { value: 20, max: 20, bonus: 0, lost: 0 },
    sf: { value: 20, max: 20, bonus: 0, lost: 0, base: 20 },
    destin: { value: 3, max: 3 },
    corruption: { value: 0, threshold: 5 },
    dailyUse: { powers: 0, minors: 0, faith: 0, forced: false },
    psy: { limits: { minor: 2, power: 2 }, powersPerDay: 2 },
    faith: { devoted: false, actsPerDay: 1 },
    protection: { base: 0, mod: 0, value: 0 },
    initiative: { base: null, mod: 0, value: 0 },
    role: "premierRole",
    lifestyle: "ordinaire",
    ...over
  };
}

export function installFoundryMock() {
  const g: any = globalThis;
  g.foundry = {
    utils: {
      mergeObject: (a: any, b: any) => ({ ...a, ...b }),
      escapeHTML: (s: string) => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`),
      getProperty: getPath, deepClone: (o: any) => JSON.parse(JSON.stringify(o))
    },
    applications: {
      handlebars: { renderTemplate: async (path: string, data: any) => JSON.stringify({ path, data }, (k, v) => (k === "actor" || k === "parent" || k === "item" ? undefined : v)), loadTemplates: async () => {} },
      api: { DialogV2: class { static wait = async () => "madness"; static confirm = async () => true; static prompt = async () => null; }, HandlebarsApplicationMixin: (c: any) => c },
      sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} },
      ux: { TextEditor: {} }
    },
    abstract: { TypeDataModel: class {} },
    data: { fields: {} },
    dice: { terms: { PoolTerm: { fromRolls: (r: any) => ({ rolls: r }) } } }
  };
  g.Actor = MockActor;
  g.Item = MockItem;
  g.ChatMessage = { create: async (d: any) => { log.chat.push(d); return d; }, getSpeaker: () => ({}) , applyMode: (d: any) => d };
  g.Roll = class {
    total = 0; terms: any[] = []; dice: any[] = []; formula: string;
    constructor(formula: string) { this.formula = formula; }
    async evaluate() { this.total = diceQueue.length ? diceQueue.shift()! : 5; return this; }
    static fromTerms() { return new g.Roll("mock"); }
  };
  g.fromUuid = async (uuid: string) => registry.get(uuid) ?? null;
  g.game = {
    i18n: { localize: (k: string) => k, format: (k: string, d?: any) => `${k} ${JSON.stringify(d ?? {})}` },
    user: { targets },
    get combat() { return flags.combatStarted ? { started: true } : null; },
    packs: new Map(), settings: { get: () => "roll" }
  };
  g.ui = { notifications: { warn: (m: string) => log.warn.push(m), info: (m: string) => log.info.push(m) } };
  g.canvas = { tokens: { placeables: [], controlled: [] }, grid: {} };
  g.CONFIG = { sounds: { dice: "" }, statusEffects: [] };
  g.Math.clamp ??= (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
}

/** Programme un d100 (1-100) : deux d10 (dizaine puis unité), 10 valant 0. */
export function queueD100(n: number) {
  diceQueue.push(Math.floor(n / 10) || 10, n % 10 || 10);
}

/** Contenu JSON d'une carte de chat produite par le simulacre de renderTemplate. */
export function cardData(message: any): { path: string; data: any } | null {
  try { return JSON.parse(message.content); } catch { return null; }
}
