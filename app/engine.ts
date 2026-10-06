import type { GameState, Inventory, Item, ItemType, Shape, Point, InventoryName, MachineKey, RouteKey, LogKind, ItemDefinition, Recipe, Route, Machine, LogEntry } from './types';
// All numerical values are provisional smoke-test parameters, not balance decisions.
export const VERSION = 2;
export const ITEMS: Record<ItemType, ItemDefinition> = {
  potato: { name: '生土豆', icon: '●', w: 1, h: 1, color: 'gold', info: '食物 · +25 饱食' },
  water: { name: '瓶装水', icon: '▥', w: 1, h: 2, color: 'blue', info: '补水 +45 · 留下塑料废料' },
  plastic: { name: '塑料废料', icon: '♧', w: 1, h: 1, color: 'blue', info: '滤水器原料' },
  fertilizer: { name: '生物肥料', icon: '✦', w: 1, h: 1, color: 'green', info: '栽培盆原料 · 1 → 3 土豆' },
  metal: { name: '铁废料', icon: '⌁', w: 2, h: 1, color: 'gray', info: '收藏材料 · 本版无加工用途' },
  knife: { name: '旧猎刀', icon: '╱', w: 1, h: 2, color: 'rose', info: '基地可装备 · 降低外出伤害' },
  backpack: { name: '帆布背包', icon: '▣', w: 2, h: 2, color: 'green', info: '基地可装备 · 提供 4 × 3 网格' },
};
export const RECIPES: Record<MachineKey, Recipe> = {
  farm: { name: '变异土豆盆', input: 'fertilizer', output: 'potato', count: 3, duration: 20 },
  water: { name: '简易滤水器', input: 'plastic', output: 'water', count: 1, duration: 16 },
};
export const ROUTES: Record<RouteKey, Route> = {
  depot: { name: '废弃货运站', subtitle: '旧世界边缘 · 低风险', risk: .32, damage: 18 },
  tunnel: { name: '断电隧道', subtitle: '深入废墟 · 高风险', risk: .76, damage: 40 },
};
const owns = <T extends object>(object: T, key: unknown): key is keyof T => typeof key === 'string' && Object.hasOwn(object, key);
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const inventoryKey = (key: unknown): key is InventoryName => key === 'warehouse' || key === 'bag';

export function grid(w: number, h: number): Inventory { return { w, h, items: [] }; }

// Rotation belongs to the item, not the item definition. Unknown items have no shape.
export function dimensions(item: unknown): Shape | null {
  const type = typeof item === 'string' ? item : isRecord(item) ? item.type : undefined;
  if (!owns(ITEMS, type)) return null;
  const rotated = isRecord(item) ? item.rotated : false;
  if (rotated !== undefined && typeof rotated !== 'boolean') return null;
  const { w, h } = ITEMS[type];
  return rotated ? { w: h, h: w } : { w, h };
}

function validGrid(g: unknown): g is Inventory {
  return isRecord(g) && typeof g.w === 'number' && Number.isSafeInteger(g.w) && g.w > 0 && typeof g.h === 'number' && Number.isSafeInteger(g.h) && g.h > 0 && Array.isArray(g.items);
}

// Pure placement preview. ignoreId is only for the item already in this grid.
export function canPlace(g: unknown, item: unknown, x: number, y: number, ignoreId?: number): boolean {
  const d = dimensions(item);
  if (!validGrid(g) || !d || !Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x + d.w > g.w || y + d.h > g.h) return false;
  return g.items.every(other => {
    if (ignoreId !== undefined && other?.id === ignoreId) return true;
    const shape = dimensions(other);
    if (!shape || !Number.isSafeInteger(other.x) || !Number.isSafeInteger(other.y) || other.x < 0 || other.y < 0 || other.x + shape.w > g.w || other.y + shape.h > g.h) return false;
    return x + d.w <= other.x || other.x + shape.w <= x || y + d.h <= other.y || other.y + shape.h <= y;
  });
}

// Legacy type-string calls still work; passing an item preserves its orientation.
// Auto placement is row-major and never rotates/reorders an existing item for space.
export function position(g: Inventory, item: ItemType | { type: ItemType; rotated?: boolean }, rotated?: boolean): Point | null {
  if (rotated !== undefined) item = { ...(typeof item === 'string' ? { type: item } : item), rotated };
  const d = dimensions(item);
  if (!validGrid(g) || !d) return null;
  for (let y = 0; y <= g.h - d.h; y++) for (let x = 0; x <= g.w - d.w; x++) {
    if (canPlace(g, item, x, y)) return { x, y };
  }
  return null;
}

export function add(s: GameState, g: Inventory, type: ItemType, rotated = false): boolean {
  if (!s || !Number.isSafeInteger(s.nextId) || s.nextId < 0 || s.nextId >= Number.MAX_SAFE_INTEGER || typeof rotated !== 'boolean') return false;
  const p = position(g, { type, rotated });
  if (!p) return false;
  g.items.push({ id: ++s.nextId, type, ...p, rotated });
  return true;
}

function take(g: Inventory, id: number): Item | null { const idx = g.items.findIndex(i => i.id === id); return idx < 0 ? null : g.items.splice(idx, 1)[0]; }

// An explicit drop either applies entirely or changes nothing, including nextId.
// Same-grid moves retain array order. Transfers append in arrival order.
export function move(s: GameState, from: InventoryName, to: InventoryName, id: number, x: number, y: number, rotated?: boolean): boolean {
  if (s?.phase !== 'base' || !inventoryKey(from) || !inventoryKey(to) || !Number.isSafeInteger(id) || id < 1) return false;
  const source = s[from], target = s[to];
  if (!validGrid(source) || !validGrid(target)) return false;
  const item = source.items.find(candidate => candidate.id === id);
  if (!item) return false;
  const orientation = rotated === undefined ? (item.rotated ?? false) : rotated;
  if (typeof orientation !== 'boolean') return false;
  const candidate = { ...item, x, y, rotated: orientation };
  if (from !== to && target.items.some(other => other.id === id)) return false;
  if (!canPlace(target, candidate, x, y, from === to ? id : undefined)) return false;
  if (from === to) Object.assign(item, { x, y, rotated: orientation });
  else { take(source, id); target.items.push(candidate); }
  return true;
}

export function transfer(s: GameState, from: InventoryName, id: number): boolean {
  if (s?.phase !== 'base' || !inventoryKey(from)) return false;
  const to = from === 'bag' ? 'warehouse' : 'bag';
  const source = s[from], target = s[to];
  if (!validGrid(source) || !validGrid(target)) return false;
  const item = source.items.find(candidate => candidate.id === id);
  if (!item) return false;
  const p = position(target, item);
  return p ? move(s, from, to, id, p.x, p.y) : false;
}
export function initial(seed = Date.now()): GameState {
  const s: GameState = { version: VERSION, nextId: 0, seed: seed >>> 0 || 1, phase: 'base', hp: 100, food: 80, hydration: 80, clock: 0, runs: 0, route: 'depot', weapon: true, pack: true, bag: grid(4, 3), warehouse: grid(8, 5), step: 0, result: '', log: [], machines: { farm: { input: 0, output: 0, progress: 0 }, water: { input: 0, output: 0, progress: 0 } } };
  for (const type of ['water', 'potato'] as const) add(s, s.bag, type);
  for (const type of ['fertilizer', 'fertilizer', 'plastic', 'plastic', 'water', 'potato', 'potato', 'knife', 'backpack'] as const) add(s, s.warehouse, type);
  return s;
}
function random(s: GameState): number { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
export function log(s: GameState, text: string, kind: LogKind = 'normal'): void { s.log.push({ text, kind, step: s.step }); if (s.log.length > 40) s.log.shift(); }
export function feed(s: GameState, key: MachineKey): boolean {
  if (s.phase !== 'base' || !owns(RECIPES, key)) return false;
  const m = s.machines[key]; const item = s.warehouse.items.find(i => i.type === RECIPES[key].input);
  if (!item || m.input >= 3) return false; take(s.warehouse, item.id); m.input++; return true;
}
export function collect(s: GameState, key: MachineKey): boolean {
  if (s.phase !== 'base' || !owns(RECIPES, key)) return false;
  const m = s.machines[key]; if (!m.output || !add(s, s.warehouse, RECIPES[key].output)) return false; m.output--; return true;
}
export function production(s: GameState, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  for (const [key, m] of Object.entries(s.machines)) {
    const r = RECIPES[key as MachineKey]; if (!m.input || m.output + r.count > 6) continue;
    m.progress += dt;
    while (m.progress >= r.duration && m.input && m.output + r.count <= 6) { m.progress -= r.duration; m.input--; m.output += r.count; }
    if (!m.input || m.output + r.count > 6) m.progress = 0;
  }
}
export function tick(s: GameState, dt = 1): void {
  if (s.phase !== 'base' || !Number.isFinite(dt)) return;
  dt = Math.max(0, Math.min(2, dt)); s.clock += dt; production(s, dt);
  s.hp = Math.min(100, s.hp + dt * .65); s.food = Math.min(100, s.food + dt * .4); s.hydration = Math.min(100, s.hydration + dt * .5);
}
export function consume(s: GameState, from: InventoryName, id: number): boolean {
  return s?.phase === 'base' && consumeItem(s, from, id);
}

// Expedition supplies are automatic; public inventory actions stay base-only.
function consumeItem(s: GameState, from: InventoryName, id: number): boolean {
  if (!inventoryKey(from)) return false;
  const g = s[from]; const item = g?.items.find(i => i.id === id); if (!item || !['water', 'potato'].includes(item.type)) return false;
  if (item.type === 'water') { s.hydration = Math.min(100, s.hydration + 45); item.type = 'plastic'; item.rotated = false; }
  else { s.food = Math.min(100, s.food + 25); take(g, id); }
  return true;
}
export function equip(s: GameState, id: number): boolean {
  if (s.phase !== 'base') return false;
  const item = s.warehouse.items.find(i => i.id === id); if (!item) return false;
  if (item.type === 'knife' && !s.weapon) { take(s.warehouse, id); s.weapon = true; return true; }
  if (item.type === 'backpack' && !s.pack) { take(s.warehouse, id); s.pack = true; s.bag.w = 4; s.bag.h = 3; return true; }
  return false;
}
export function start(s: GameState, route: RouteKey): boolean {
  if (s.phase !== 'base' || !owns(ROUTES, route)) return false;
  s.phase = 'expedition'; s.route = route; s.step = 0; s.result = ''; s.log = []; log(s, `驶近${ROUTES[route].name}。离开车厢，探索自动开始。`, 'accent'); return true;
}
export function fail(s: GameState): void {
  s.bag = grid(2, 2); s.weapon = false; s.pack = false; s.hp = 12; s.phase = 'base'; s.runs++; s.result = '撤离失败';
  log(s, '此次装备、背包及携带物品全部丢失。你以低生命值返回列车。', 'danger');
}
export function expeditionStep(s: GameState): boolean {
  if (s.phase !== 'expedition') return false;
  s.step++; s.clock += 30; production(s, 30); s.food = Math.max(0, s.food - 10); s.hydration = Math.max(0, s.hydration - 14);
  for (const [type, value] of [['potato', s.food], ['water', s.hydration]] as const) {
    const item = s.bag.items.find(i => i.type === type);
    if (value <= 40 && item) { consumeItem(s, 'bag', item.id); log(s, type === 'water' ? '自动饮水。瓶装水变为塑料废料，仍占 1 格。' : '自动食用生土豆，恢复饱食度。', 'good'); }
  }
  if (!s.food || !s.hydration) { s.hp -= 14; log(s, '缺乏补给，身体逐渐虚弱。生命 −14。', 'danger'); }
  const r = ROUTES[s.route];
  if (random(s) < r.risk) { const damage = Math.round(r.damage * (s.weapon ? .55 : 1)); s.hp -= damage; log(s, `穿过坍塌通道时受伤。${s.weapon ? '猎刀帮助你脱困。' : ''}生命 −${damage}。`, 'danger'); }
  else log(s, ['沿铁轨搜索散落的货箱。', '无线电传来静电声。前路暂时安全。', '翻过废墟，发现一间旧储藏室。'][s.step % 3]);
  if (s.hp <= 0) { fail(s); return true; }
  const pool: ItemType[] = ['fertilizer', 'plastic', 'potato', 'water', 'metal', 'knife', 'backpack']; const type = pool[Math.floor(random(s) * pool.length)];
  const accepted = add(s, s.bag, type); log(s, accepted ? `发现${ITEMS[type].name}，按发现顺序装入背包。` : `发现${ITEMS[type].name}，空间不足，留在原地。已有物品保持不变。`, accepted ? 'good' : 'muted');
  if (s.step >= 6) { s.phase = 'base'; s.runs++; s.result = '安全归来'; log(s, '车门在身后合拢。拖动背包物品，手动转移到主仓库。', 'accent'); }
  return true;
}

// Decode untrusted JSON field-by-field. The v2 format and storage key are unchanged.
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const integer = (value: unknown): value is number => finite(value) && Number.isSafeInteger(value);
export function restore(raw: unknown): GameState | null {
  try {
    if (typeof raw !== 'string' || raw.length > 100000) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const { version, nextId, seed, phase, hp, food, hydration, clock, runs, route, weapon, pack, step, result } = value;
    if (version !== VERSION || (phase !== 'base' && phase !== 'expedition') || !owns(ROUTES, route)) return null;
    if (!finite(hp) || hp < 0 || hp > 100 || !finite(food) || food < 0 || food > 100 || !finite(hydration) || hydration < 0 || hydration > 100) return null;
    if (!integer(nextId) || nextId < 0 || !integer(seed) || seed < 0 || seed > 0xffffffff || !integer(runs) || runs < 0 || !integer(step) || step < 0 || step > 6) return null;
    if (!finite(clock) || clock < 0 || typeof pack !== 'boolean' || typeof weapon !== 'boolean' || (phase === 'expedition' && (step >= 6 || hp <= 0))) return null;
    if (typeof result !== 'string' || result.length > 30) return null;
    const ids = new Set<number>();
    const inventories: Record<InventoryName, Inventory> = { warehouse: grid(8, 5), bag: grid(pack ? 4 : 2, pack ? 3 : 2) };
    for (const key of ['warehouse', 'bag'] as const) {
      const source = value[key], checked = inventories[key];
      if (!isRecord(source) || source.w !== checked.w || source.h !== checked.h || !Array.isArray(source.items) || source.items.length > checked.w * checked.h) return null;
      for (const candidate of source.items as unknown[]) {
        if (!isRecord(candidate)) return null;
        const { id, type, x, y, rotated } = candidate;
        if (!integer(id) || id < 1 || id > nextId || ids.has(id) || !owns(ITEMS, type) || !integer(x) || !integer(y) || typeof rotated !== 'boolean') return null;
        const item: Item = { id, type, x, y, rotated };
        if (!canPlace(checked, item, x, y)) return null;
        ids.add(id); checked.items.push(item);
      }
    }
    if (!isRecord(value.machines) || Object.keys(value.machines).sort().join(',') !== 'farm,water') return null;
    const machines: Record<MachineKey, Machine> = { farm: { input: 0, output: 0, progress: 0 }, water: { input: 0, output: 0, progress: 0 } };
    for (const key of ['farm', 'water'] as const) {
      const candidate = value.machines[key], recipe = RECIPES[key];
      if (!isRecord(candidate)) return null;
      const { input, output, progress } = candidate;
      if (!integer(input) || input < 0 || input > 3 || !integer(output) || output < 0 || output > 6 || !finite(progress) || progress < 0 || progress >= recipe.duration) return null;
      if ((!input || output + recipe.count > 6) && progress !== 0) return null;
      machines[key] = { input, output, progress };
    }
    if (!Array.isArray(value.log) || value.log.length > 40) return null;
    const entries: LogEntry[] = [];
    for (const entry of value.log as unknown[]) {
      if (!isRecord(entry)) return null;
      const { text, kind, step: entryStep } = entry;
      if (typeof text !== 'string' || text.length > 300 || (kind !== 'normal' && kind !== 'accent' && kind !== 'danger' && kind !== 'good' && kind !== 'muted') || !integer(entryStep) || entryStep < 0 || entryStep > 6) return null;
      entries.push({ text, kind, step: entryStep });
    }
    return { version, nextId, seed, phase, hp, food, hydration, clock, runs, route, weapon, pack, step, result, ...inventories, machines, log: entries };
  } catch { return null; }
}
