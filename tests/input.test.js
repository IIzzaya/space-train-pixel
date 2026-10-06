import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, add, grid, fail, start } from '../app/engine.ts';
import { WIDTH, HEIGHT, CELL, GRID_ORIGINS, contains, toLogical, gridRect, itemAt, beginDrag, previewDrag, rotateDrag, commitDrag, hitTarget } from '../app/input.ts';
const empty = () => { const state = initial(1); state.bag.items = []; state.warehouse.items = []; return state; };
const cell = (name, x, y) => ({ x: GRID_ORIGINS[name].x + CELL * (x + .5), y: GRID_ORIGINS[name].y + CELL * (y + .5) });

test('logical mapping accounts for CSS scale and letterbox offset without DPR', () => {
  for (const scale of [.375, .7525, 1, 1.25, 2]) {
    const bounds = { left: 17.25, top: 93.75, width: WIDTH * scale, height: HEIGHT * scale };
    const source = { x: 911.125, y: 532.75 };
    const mapped = toLogical({ x: bounds.left + source.x * scale, y: bounds.top + source.y * scale }, bounds);
    assert.ok(Math.abs(mapped.x - source.x) < 1e-9); assert.ok(Math.abs(mapped.y - source.y) < 1e-9);
  }
});
test('canvas hit bounds include left/top and exclude right/bottom', () => {
  const bounds = { left: 20, top: 40, width: 640, height: 430 };
  assert.deepEqual(toLogical({ x: 20, y: 40 }, bounds), { x: 0, y: 0 });
  for (const point of [{ x: 660, y: 40 }, { x: 20, y: 470 }, { x: 19.9, y: 80 }, { x: 25, y: 39.9 }, { x: NaN, y: 100 }]) assert.equal(toLogical(point, bounds), null);
  assert.equal(toLogical({ x: 0, y: 0 }, { left: 0, top: 0, width: 0, height: 200 }), null);
  assert.equal(contains({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 1 }), false);
});
test('item hit testing respects occupied cells and real bag dimensions after gear loss', () => {
  const state = empty(); add(state, state.bag, 'water');
  const id = state.bag.items[0].id;
  assert.deepEqual(itemAt(state, cell('bag', 0, 1)), { from: 'bag', id });
  assert.equal(itemAt(state, cell('bag', 1, 1)), null);
  assert.equal(gridRect(state, 'bag').w, 4 * CELL);
  fail(state); assert.equal(gridRect(state, 'bag').w, 2 * CELL); assert.equal(gridRect(state, 'bag').h, 2 * CELL);
  assert.equal(itemAt(state, cell('bag', 3, 2)), null);
});
test('grabbed lower cell offsets an explicit cross-grid drop', () => {
  const state = empty(); add(state, state.warehouse, 'water');
  const id = state.warehouse.items[0].id, before = structuredClone(state);
  const drag = beginDrag(state, { from: 'warehouse', id }, cell('warehouse', 0, 1), 7);
  assert.deepEqual(drag.offset, { x: 0, y: 1 });
  previewDrag(state, drag, cell('bag', 3, 2));
  assert.deepEqual(drag.target, { name: 'bag', x: 3, y: 1, valid: true });
  assert.deepEqual(state, before, 'preview is never a mutation');
  assert.deepEqual(commitDrag(state, drag), { from: 'bag', id });
  assert.equal(state.bag.items[0].x, 3); assert.equal(state.bag.items[0].y, 1);
});
test('rotation transforms grabbed cell and round-trips anchor without moving source', () => {
  const state = empty(); add(state, state.warehouse, 'water');
  const id = state.warehouse.items[0].id, before = structuredClone(state);
  const drag = beginDrag(state, { from: 'warehouse', id }, cell('warehouse', 0, 1), 9);
  previewDrag(state, drag, cell('bag', 1, 2)); rotateDrag(state, drag);
  assert.equal(drag.rotated, true); assert.deepEqual(drag.offset, { x: 0, y: 0 });
  assert.deepEqual(drag.target, { name: 'bag', x: 1, y: 2, valid: true });
  rotateDrag(state, drag); assert.equal(drag.rotated, false); assert.deepEqual(drag.offset, { x: 0, y: 1 });
  assert.deepEqual(state, before);
});
test('outside, collision, overhang, and cancelled previews preserve entire state', () => {
  for (const destination of [null, cell('bag', 0, 0), cell('bag', 3, 2)]) {
    const state = empty(); add(state, state.warehouse, 'water'); add(state, state.bag, 'potato');
    const before = structuredClone(state), id = state.warehouse.items[0].id;
    const drag = beginDrag(state, { from: 'warehouse', id }, cell('warehouse', 0, 0), 1);
    previewDrag(state, drag, destination);
    assert.equal(commitDrag(state, drag), null); assert.deepEqual(state, before);
  }
  const state = initial(1), before = structuredClone(state), id = state.bag.items[0].id;
  const drag = beginDrag(state, { from: 'bag', id }, cell('bag', 0, 0), 1);
  previewDrag(state, drag, cell('warehouse', 7, 2)); rotateDrag(state, drag);
  // Escape/blur/pointercancel discard the transaction without calling commitDrag.
  assert.deepEqual(state, before);
});
test('a pointer click selects without moving; state phase rechecked at commit', () => {
  const state = empty(); add(state, state.bag, 'potato'); const id = state.bag.items[0].id;
  const drag = beginDrag(state, { from: 'bag', id }, cell('bag', 0, 0), 5);
  previewDrag(state, drag, cell('bag', 0, 0)); assert.equal(commitDrag(state, drag), null);
  previewDrag(state, drag, cell('warehouse', 6, 4)); assert.equal(drag.target.valid, true);
  start(state, 'depot'); const before = structuredClone(state);
  assert.equal(commitDrag(state, drag), null); assert.deepEqual(state, before);
  assert.equal(beginDrag(state, { from: 'bag', id }, cell('bag', 0, 0), 5), null);
});
test('last drawn control receives hits; disabled overlays swallow clicks', () => {
  const rect = { x: 0, y: 0, w: 50, h: 50 }, p = { x: 20, y: 20 };
  const background = { id: 'depart', rect, enabled: true }, modal = { id: 'close-modal', rect, enabled: true };
  assert.equal(hitTarget([background, modal], p).id, 'close-modal');
  assert.equal(hitTarget([background, { ...modal, enabled: false }], p), null);
  assert.equal(hitTarget([modal], { x: 900, y: 700 }), null, 'modal-only registry cannot hit background');
  assert.equal(hitTarget([background], { x: 50, y: 20 }), null);
});
test('rotated wide item anchored at last occupied cell fits target consistently across CSS scales', () => {
  const state = empty(); add(state, state.warehouse, 'water', true); const id = state.warehouse.items[0].id;
  const drag = beginDrag(state, { from: 'warehouse', id }, cell('warehouse', 1, 0), 3);
  const p = cell('bag', 3, 2), bounds = { left: 12, top: 12, width: 1156, height: HEIGHT * 1156 / WIDTH };
  previewDrag(state, drag, toLogical({ x: bounds.left + p.x * bounds.width / WIDTH, y: bounds.top + p.y * bounds.height / HEIGHT }, bounds));
  assert.deepEqual(drag.target, { name: 'bag', x: 2, y: 2, valid: true });
  assert.ok(commitDrag(state, drag));
});
