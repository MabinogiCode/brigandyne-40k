/**
 * Déclarations minimales des globaux Foundry VTT (v13+).
 * Le typage complet (fvtt-types) pourra remplacer ces `any` progressivement ;
 * l'objectif ici est de typer NOTRE logique, pas l'API Foundry.
 */

declare const foundry: any;
declare const game: any;
declare const ui: any;
declare const canvas: any;
declare const CONFIG: any;
declare const CONST: any;
declare const Hooks: {
  once(event: string, fn: (...args: any[]) => any): number;
  on(event: string, fn: (...args: any[]) => any): number;
  off(event: string, id: number): void;
  call(event: string, ...args: any[]): boolean;
  callAll(event: string, ...args: any[]): boolean;
};

declare class Roll {
  constructor(formula: string, data?: object);
  evaluate(options?: object): Promise<this>;
  total: number;
  dice: any[];
  terms: any[];
  static fromTerms(terms: any[]): Roll;
}

declare class Actor {
  static create(data: object, options?: object): Promise<any>;
  [key: string]: any;
}
declare class Item {
  [key: string]: any;
}
declare class ChatMessage {
  static create(data: object, options?: object): Promise<any>;
  static getSpeaker(options?: object): object;
  static applyMode(data: object, mode: string): object;
  [key: string]: any;
}
declare class Dialog {
  [key: string]: any;
}
declare function fromUuid(uuid: string): Promise<any>;
declare function fromUuidSync(uuid: string): any;
declare function renderTemplate(path: string, data?: object): Promise<string>;
declare function loadTemplates(paths: string[] | Record<string, string>): Promise<any>;
declare const Handlebars: any;

/** Extensions Foundry des prototypes natifs. */
interface Math {
  clamp(num: number, min: number, max: number): number;
}
