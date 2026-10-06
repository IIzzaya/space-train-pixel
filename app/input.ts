import { canPlace, dimensions, move } from './engine';
import type { GameState, InventoryName, Item, Point, Rect, Selection } from './types';

export const WIDTH = 1280;
export const HEIGHT = 860;
export const CELL = 54;
export const GRID_ORIGINS: Record<InventoryName, Point> = { warehouse: { x: 32, y: 424 }, bag: { x: 536, y: 464 } };
export interface CanvasBounds { left: number; top: number; width: number; height: number }
export function contains(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.w && point.y < rect.y + rect.h;
}
// Canvas CSS dimensions already include device-pixel-ratio scaling. Never apply DPR again.
export function toLogical(client: Point, bounds: CanvasBounds): Point | null {
  if (bounds.width <= 0 || bounds.height <= 0 || !Number.isFinite(client.x) || !Number.isFinite(client.y)) return null;
  const point = { x: (client.x - bounds.left) * WIDTH / bounds.width, y: (client.y - bounds.top) * HEIGHT / bounds.height };
  return contains({ x: 0, y: 0, w: WIDTH, h: HEIGHT }, point) ? point : null;
}
export function gridRect(state: GameState, name: InventoryName): Rect {
  return { ...GRID_ORIGINS[name], w: state[name].w * CELL, h: state[name].h * CELL };
}
export function itemRect(name: InventoryName, item: Item): Rect {
  const size = dimensions(item)!;
  return { x: GRID_ORIGINS[name].x + item.x * CELL, y: GRID_ORIGINS[name].y + item.y * CELL, w: size.w * CELL, h: size.h * CELL };
}
export function itemAt(state: GameState, point: Point): Selection | null {
  for (const name of ['warehouse', 'bag'] as const) {
    if (!contains(gridRect(state, name), point)) continue;
    const item = state[name].items.find(candidate => contains(itemRect(name, candidate), point));
    if (item) return { from: name, id: item.id };
  }
  return null;
}
export interface DropTarget { name: InventoryName; x: number; y: number; valid: boolean }
export interface Drag {
  from: InventoryName; item: Item; pointerId: number; rotated: boolean;
  offset: Point; start: Point; point: Point; moved: boolean; target: DropTarget | null;
}
export function beginDrag(state: GameState, selection: Selection, point: Point, pointerId: number): Drag | null {
  if (state.phase !== 'base') return null;
  const item = state[selection.from].items.find(candidate => candidate.id === selection.id);
  if (!item) return null;
  const rect = itemRect(selection.from, item);
  if (!contains(rect, point)) return null;
  return { from: selection.from, item: { ...item }, pointerId, rotated: item.rotated,
    offset: { x: Math.floor((point.x - rect.x) / CELL), y: Math.floor((point.y - rect.y) / CELL) },
    start: point, point, moved: false, target: null };
}
export function previewDrag(state: GameState, drag: Drag, point: Point | null): void {
  drag.target = null;
  if (!point) { drag.moved = true; return; }
  drag.point = point;
  drag.moved ||= Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 5;
  for (const name of ['warehouse', 'bag'] as const) {
    const rect = gridRect(state, name);
    if (!contains(rect, point)) continue;
    const x = Math.floor((point.x - rect.x) / CELL) - drag.offset.x;
    const y = Math.floor((point.y - rect.y) / CELL) - drag.offset.y;
    drag.target = { name, x, y, valid: canPlace(state[name], { ...drag.item, rotated: drag.rotated }, x, y, name === drag.from ? drag.item.id : undefined) };
    break;
  }
}
export function rotateDrag(state: GameState, drag: Drag): void {
  // Rotate the grabbed cell too; four rotations restore the original anchor.
  const old = dimensions({ ...drag.item, rotated: drag.rotated })!;
  const turningClockwise = !drag.rotated;
  const anchor = drag.offset;
  drag.offset = turningClockwise ? { x: old.h - 1 - anchor.y, y: anchor.x } : { x: anchor.y, y: old.w - 1 - anchor.x };
  drag.rotated = !drag.rotated; drag.moved = true; previewDrag(state, drag, drag.point);
}
export function commitDrag(state: GameState, drag: Drag): Selection | null {
  const target = drag.target;
  if (!drag.moved || !target?.valid) return null;
  return move(state, drag.from, target.name, drag.item.id, target.x, target.y, drag.rotated) ? { from: target.name, id: drag.item.id } : null;
}
export interface HitTarget { id: string; rect: Rect; enabled: boolean }
export function hitTarget(targets: readonly HitTarget[], point: Point): HitTarget | null {
  // Overlay controls are appended last. Disabled controls swallow hits.
  const target = [...targets].reverse().find(candidate => contains(candidate.rect, point));
  return target?.enabled ? target : null;
}
