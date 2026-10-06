export type ItemType = 'potato' | 'water' | 'plastic' | 'fertilizer' | 'metal' | 'knife' | 'backpack';
export type InventoryName = 'warehouse' | 'bag';
export type MachineKey = 'farm' | 'water';
export type RouteKey = 'depot' | 'tunnel';
export type LogKind = 'normal' | 'accent' | 'danger' | 'good' | 'muted';
export interface Shape { w: number; h: number }
export interface Point { x: number; y: number }
export interface Rect extends Point { w: number; h: number }
export interface Item extends Point { id: number; type: ItemType; rotated: boolean }
export interface Inventory extends Shape { items: Item[] }
export interface Machine { input: number; output: number; progress: number }
export interface LogEntry { text: string; kind: LogKind; step: number }
export interface GameState {
  version: number; nextId: number; seed: number; phase: 'base' | 'expedition';
  hp: number; food: number; hydration: number; clock: number; runs: number;
  route: RouteKey; weapon: boolean; pack: boolean; bag: Inventory; warehouse: Inventory;
  step: number; result: string; log: LogEntry[]; machines: Record<MachineKey, Machine>;
}
export interface ItemDefinition extends Shape { name: string; icon: string; color: string; info: string }
export interface Recipe { name: string; input: ItemType; output: ItemType; count: number; duration: number }
export interface Route { name: string; subtitle: string; risk: number; damage: number }
export interface Selection { from: InventoryName; id: number }
