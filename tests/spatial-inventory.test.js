import test from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, ITEMS, initial, grid, add, dimensions, canPlace, position, move, transfer, consume, production, tick, feed, collect, equip, start, expeditionStep, restore } from '../app/engine.js';

const emptyState = () => {
  const s = initial(1);
  s.bag.items = [];
  s.warehouse.items = [];
  return s;
};
const snapshot = s => structuredClone(s);
const rejection = (s, operation) => {
  const before = snapshot(s);
  assert.equal(operation(), false);
  assert.deepEqual(s, before, 'rejected action must be completely atomic');
};

test('V2 canonical item metadata and definition dimensions', () => {
  assert.equal(VERSION, 2);
  const s = initial(1);
  for (const item of [...s.bag.items, ...s.warehouse.items]) assert.equal(item.rotated, false);
  assert.deepEqual(dimensions('water'), { w: 1, h: 2 });
  assert.deepEqual(dimensions({ type: 'water', rotated: true }), { w: 2, h: 1 });
  assert.deepEqual(dimensions({ type: 'metal', rotated: true }), { w: 1, h: 2 });
  assert.deepEqual(dimensions({ type: 'backpack', rotated: true }), { w: 2, h: 2 });
  for (const value of [null, undefined, {}, 'constructor', '__proto__', 'invalid', { type: 'water', rotated: 1 }]) assert.equal(dimensions(value), null);
  assert.equal(ITEMS.water.w, 1, 'rotation cannot mutate the shared item definition');
});

test('placement previews honor shapes, touching edges and ignore only their own ID', () => {
  const s = emptyState();
  add(s, s.bag, 'water');
  const water = s.bag.items[0], before = snapshot(s);
  assert.equal(canPlace(s.bag, 'plastic', 1, 0), true);
  assert.equal(canPlace(s.bag, 'plastic', 0, 1), false);
  assert.equal(canPlace(s.bag, water, 0, 0), false);
  assert.equal(canPlace(s.bag, water, 0, 0, water.id), true);
  assert.equal(canPlace(s.bag, water, 0, 0, water.id + 1), false);
  assert.equal(canPlace(s.bag, { ...water, rotated: true }, 2, 2), true);
  assert.equal(canPlace(s.bag, water, 3, 2), false);
  assert.deepEqual(s, before);
});

test('invalid coordinates, orientations and grids never place an item', () => {
  const g = grid(4, 3);
  for (const [x, y] of [[-1, 0], [0, -1], [4, 0], [0, 3], [0.5, 1], [0, 0.5], [NaN, 0], [0, Infinity], ['1', 0], [null, 0], [Number.MAX_SAFE_INTEGER + 1, 0]]) assert.equal(canPlace(g, 'potato', x, y), false);
  for (const malformed of [null, {}, [], grid(0, 3), grid(4.5, 3), { w: 4, h: 3, items: null }]) assert.equal(canPlace(malformed, 'water', 0, 0), false);
  for (const other of [null, { type: 'unknown', x: 0, y: 0 }, { type: 'water', x: -1, y: 0 }, { type: 'water', x: 3, y: 2 }, { type: 'water', x: 0.1, y: 0 }, { type: 'water', x: 0, y: 0, rotated: 'yes' }]) {
    assert.equal(canPlace({ w: 4, h: 3, items: [other] }, 'potato', 2, 0), false);
  }
});

test('same-grid move ignores itself, keeps object identity, order and nextId', () => {
  const s = emptyState();
  add(s, s.bag, 'water'); add(s, s.bag, 'plastic');
  const water = s.bag.items[0], nextId = s.nextId, ids = s.bag.items.map(i => i.id);
  assert.equal(move(s, 'bag', 'bag', water.id, 0, 1), true);
  assert.equal(s.bag.items[0], water);
  assert.deepEqual({ x: water.x, y: water.y }, { x: 0, y: 1 });
  assert.equal(move(s, 'bag', 'bag', water.id, 2, 2, true), true);
  assert.deepEqual(dimensions(water), { w: 2, h: 1 });
  assert.deepEqual(s.bag.items.map(i => i.id), ids);
  assert.equal(s.nextId, nextId);
  const before = snapshot(s);
  assert.equal(move(s, 'bag', 'bag', water.id, 2, 2), true);
  assert.deepEqual(s, before, 'drop at the same position is a successful no-op');
});

test('warehouse and bag explicit drops preserve identity and chosen orientation', () => {
  const s = emptyState(); add(s, s.warehouse, 'metal');
  const item = s.warehouse.items[0], id = item.id, nextId = s.nextId;
  assert.equal(move(s, 'warehouse', 'bag', id, 3, 1, true), true);
  assert.equal(s.warehouse.items.length, 0);
  assert.deepEqual(s.bag.items[0], { ...item, x: 3, y: 1, rotated: true });
  assert.equal(move(s, 'bag', 'warehouse', id, 7, 3), true);
  assert.equal(s.bag.items.length, 0);
  assert.deepEqual(s.warehouse.items[0], { ...item, x: 7, y: 3, rotated: true });
  assert.equal(s.nextId, nextId);
  assert.deepEqual(restore(JSON.stringify(s)), s);
});

test('collision, overhang and failed rotation reject atomically in either grid', () => {
  const s = emptyState(); add(s, s.bag, 'water'); add(s, s.bag, 'potato'); add(s, s.warehouse, 'backpack');
  const id = s.bag.items[0].id;
  rejection(s, () => move(s, 'bag', 'bag', id, 1, 0));
  rejection(s, () => move(s, 'bag', 'bag', id, 0, 0, true));
  rejection(s, () => move(s, 'bag', 'bag', id, 3, 0, true));
  rejection(s, () => move(s, 'bag', 'bag', id, 0, 2, false));
  rejection(s, () => move(s, 'bag', 'warehouse', id, 1, 1));
  rejection(s, () => move(s, 'bag', 'warehouse', id, 7, 4));
  rejection(s, () => move(s, 'bag', 'warehouse', id, 7, 0, true));
});

test('invalid move inputs, missing IDs and invalid endpoints do not mutate state', () => {
  const s = initial(1), id = s.bag.items[0].id;
  for (const from of ['log', 'machines', 'constructor', '__proto__', '', undefined]) rejection(s, () => move(s, from, 'bag', id, 0, 0));
  for (const to of ['log', 'machines', 'constructor', '__proto__', '', undefined]) rejection(s, () => move(s, 'bag', to, id, 0, 0));
  for (const missing of [-1, 0, 99999, String(id), NaN, null, 1.5]) rejection(s, () => move(s, 'bag', 'warehouse', missing, 6, 0));
  for (const rotation of [null, 0, 1, 'true', {}, []]) rejection(s, () => move(s, 'bag', 'warehouse', id, 6, 0, rotation));
  for (const [x, y] of [[-1, 0], [0, -1], [0.5, 0], [0, NaN], [Infinity, 0], ['6', 0]]) rejection(s, () => move(s, 'bag', 'warehouse', id, x, y));
  assert.equal(move(null, 'bag', 'warehouse', id, 0, 0), false);
});

test('all manual inventory and machinery editing is base-only; auto-use remains possible', () => {
  const s = initial(1), water = s.bag.items.find(i => i.type === 'water');
  s.hydration = 20; s.food = 20;
  assert.ok(start(s, 'depot'));
  rejection(s, () => move(s, 'bag', 'bag', water.id, 2, 0, true));
  rejection(s, () => move(s, 'bag', 'warehouse', water.id, 6, 0));
  rejection(s, () => transfer(s, 'bag', water.id));
  rejection(s, () => consume(s, 'bag', water.id));
  rejection(s, () => consume(s, 'warehouse', s.warehouse.items.find(i => i.type === 'water').id));
  rejection(s, () => feed(s, 'farm'));
  rejection(s, () => collect(s, 'water'));
  rejection(s, () => equip(s, s.warehouse.items.find(i => i.type === 'knife').id));
  assert.equal(expeditionStep(s), true);
  assert.equal(water.type, 'plastic');
  assert.equal(s.hydration, 51);
  assert.equal(s.food, 35);
});

test('automatic placement preserves row-major order and never auto-rotates loot', () => {
  const s = emptyState(), g = grid(3, 1);
  assert.equal(add(s, g, 'water'), false, 'an unrotated bottle does not fit a one-high row');
  assert.equal(add(s, g, 'water', true), true);
  assert.deepEqual(g.items[0], { id: s.nextId, type: 'water', x: 0, y: 0, rotated: true });
  assert.deepEqual(position(g, 'plastic'), { x: 2, y: 0 });
  const before = snapshot(g), nextId = s.nextId;
  assert.equal(add(s, g, 'metal'), false);
  assert.deepEqual(g, before);
  assert.equal(s.nextId, nextId);
  assert.deepEqual(position(grid(3, 1), 'water', true), { x: 0, y: 0 });
  assert.equal(position(grid(3, 1), 'water'), null);
});

test('auto transfer respects orientation and preserves existing arrangement', () => {
  const s = emptyState();
  s.bag = grid(2, 1); add(s, s.warehouse, 'water', true);
  const id = s.warehouse.items[0].id;
  assert.equal(transfer(s, 'warehouse', id), true);
  assert.equal(s.bag.items[0].rotated, true);
  assert.equal(transfer(s, 'bag', id), true);
  s.warehouse.items[0].rotated = false;
  rejection(s, () => transfer(s, 'warehouse', id));
  for (const key of ['constructor', 'log', '__proto__']) rejection(s, () => transfer(s, key, id));
});

test('rotated water shrinks at its top-left cell and resets rotation', () => {
  const s = emptyState(); add(s, s.bag, 'water', true);
  const water = s.bag.items[0];
  assert.ok(move(s, 'bag', 'bag', water.id, 2, 2));
  s.hydration = 10;
  assert.equal(consume(s, 'bag', water.id), true);
  assert.deepEqual(water, { id: water.id, type: 'plastic', x: 2, y: 2, rotated: false });
  assert.deepEqual(dimensions(water), { w: 1, h: 1 });
  assert.equal(s.hydration, 55);
  assert.equal(canPlace(s.bag, 'plastic', 3, 2), true);
  assert.equal(restore(JSON.stringify(s))?.bag.items[0].rotated, false);
});

test('save validation accepts orientation-aware shapes and rejects rotated bounds/overlaps', () => {
  const s = emptyState(); add(s, s.bag, 'water', true);
  assert.ok(move(s, 'bag', 'bag', s.bag.items[0].id, 2, 2));
  assert.deepEqual(restore(JSON.stringify(s)), s);
  for (const mutate of [
    state => { state.bag.items[0].x = 3; },
    state => { state.bag.items[0].rotated = false; },
    state => { state.bag.items[0].rotated = 'true'; },
    state => { state.bag.items[0].rotated = null; },
    state => { delete state.bag.items[0].rotated; },
    state => { state.bag.items.push({ id: ++state.nextId, type: 'potato', x: 3, y: 2, rotated: false }); },
    state => { state.warehouse.items.push({ ...state.bag.items[0], x: 0, y: 0 }); },
  ]) {
    const bad = snapshot(s); mutate(bad);
    assert.equal(restore(JSON.stringify(bad)), null);
  }
});

test('save validation rejects malformed scalar, grid, item, machine and log data', () => {
  for (const raw of ['null', '[]', 'true', '12', '"state"', '{', '', '{}', undefined, null, {}, ' '.repeat(100001)]) assert.equal(restore(raw), null);
  for (const mutate of [
    s => { s.version = 1; }, s => { s.version = 3; }, s => { s.seed = 0x100000000; },
    s => { s.nextId = -1; }, s => { s.nextId = 1; }, s => { s.clock = -1; }, s => { s.hp = 101; },
    s => { s.route = 'constructor'; }, s => { s.route = '__proto__'; }, s => { s.pack = 1; }, s => { s.weapon = 'true'; },
    s => { s.bag = []; }, s => { s.bag.w = 5; }, s => { s.bag.items = {}; }, s => { s.warehouse = null; },
    s => { s.bag.items[0] = null; }, s => { s.bag.items[0].type = 'constructor'; }, s => { s.bag.items[0].type = '__proto__'; },
    s => { s.bag.items[0].x = 0.5; }, s => { s.bag.items[0].y = -1; }, s => { s.bag.items[0].id = 0; },
    s => { s.bag.items[0].id = s.warehouse.items[0].id; }, s => { s.bag.items[0].id = s.nextId + 1; },
    s => { s.machines = []; }, s => { s.machines.farm = null; }, s => { s.machines.water.input = 4; },
    s => { s.machines.water.output = 7; }, s => { s.machines.farm.progress = 20; }, s => { s.machines.farm.progress = 1; },
    s => { s.machines.farm = { input: 1, output: 5, progress: 1 }; }, s => { delete s.machines.water; },
    s => { s.log = [null]; }, s => { s.log = [{ text: 'ok', kind: 'good' }]; },
    s => { s.log = [{ text: 'ok', kind: 'good', step: 7 }]; }, s => { s.log = [{ text: 'x'.repeat(301), kind: 'good', step: 0 }]; },
    s => { s.result = 'x'.repeat(31); }, s => { s.step = 7; }, s => { s.phase = 'expedition'; s.step = 6; },
    s => { s.phase = 'expedition'; s.hp = 0; },
  ]) {
    const s = initial(1); mutate(s); assert.equal(restore(JSON.stringify(s)), null, mutate.toString());
  }
});

test('invalid elapsed time and unknown recipe/route keys do not corrupt state', () => {
  const s = initial(1);
  for (const dt of [NaN, Infinity, -Infinity, undefined, '10']) {
    const before = snapshot(s); production(s, dt); assert.deepEqual(s, before);
    if (dt !== undefined) { tick(s, dt); assert.deepEqual(s, before); }
  }
  for (const key of ['constructor', '__proto__', 'prototype', null]) {
    rejection(s, () => feed(s, key)); rejection(s, () => collect(s, key)); rejection(s, () => start(s, key));
  }
  s.nextId = Number.MAX_SAFE_INTEGER;
  rejection(s, () => add(s, s.warehouse, 'potato'));
});

test('seeded move/rotation stress preserves identities and valid saves', () => {
  let seed = 87123;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let run = 0; run < 20; run++) {
    const s = initial(run + 1), originalIds = [...s.bag.items, ...s.warehouse.items].map(i => i.id).sort((a, b) => a - b);
    for (let step = 0; step < 150; step++) {
      const from = random(2) ? 'bag' : 'warehouse', to = random(2) ? 'bag' : 'warehouse';
      const item = s[from].items[random(Math.max(1, s[from].items.length))];
      if (!item) continue;
      const before = snapshot(s);
      const changed = move(s, from, to, item.id, random(s[to].w + 2) - 1, random(s[to].h + 2) - 1, !!random(2));
      if (!changed) assert.deepEqual(s, before);
      assert.deepEqual([...s.bag.items, ...s.warehouse.items].map(i => i.id).sort((a, b) => a - b), originalIds);
      assert.deepEqual(restore(JSON.stringify(s)), s, `run ${run}, move ${step}`);
    }
  }
});
