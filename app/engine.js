// All numerical values are provisional smoke-test parameters, not balance decisions.
export const VERSION = 2;
export const ITEMS = {
  potato: { name: '生土豆', icon: '●', w: 1, h: 1, color: 'gold', info: '食物 · +25 饱食' },
  water: { name: '瓶装水', icon: '▥', w: 1, h: 2, color: 'blue', info: '补水 +45 · 留下塑料废料' },
  plastic: { name: '塑料废料', icon: '♧', w: 1, h: 1, color: 'blue', info: '滤水器原料' },
  fertilizer: { name: '生物肥料', icon: '✦', w: 1, h: 1, color: 'green', info: '栽培盆原料 · 1 → 3 土豆' },
  metal: { name: '铁废料', icon: '⌁', w: 2, h: 1, color: 'gray', info: '收藏材料 · 本版无加工用途' },
  knife: { name: '旧猎刀', icon: '╱', w: 1, h: 2, color: 'rose', info: '基地可装备 · 降低外出伤害' },
  backpack: { name: '帆布背包', icon: '▣', w: 2, h: 2, color: 'green', info: '基地可装备 · 提供 4 × 3 网格' },
};
export const RECIPES = {
  farm: { name: '变异土豆盆', input: 'fertilizer', output: 'potato', count: 3, duration: 20 },
  water: { name: '简易滤水器', input: 'plastic', output: 'water', count: 1, duration: 16 },
};
export const ROUTES = {
  depot: { name: '废弃货运站', subtitle: '旧世界边缘 · 低风险', risk: .32, damage: 18 },
  tunnel: { name: '断电隧道', subtitle: '深入废墟 · 高风险', risk: .76, damage: 40 },
};
const owns = (object, key) => typeof key === 'string' && Object.hasOwn(object, key);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const inventoryKey = key => key === 'warehouse' || key === 'bag';

export function grid(w, h) { return { w, h, items: [] }; }

// Rotation belongs to the item, not the item definition. Unknown items have no shape.
export function dimensions(item) {
  const type = typeof item === 'string' ? item : item?.type;
  if (!owns(ITEMS, type)) return null;
  const rotated = typeof item === 'string' ? false : item.rotated;
  if (rotated !== undefined && typeof rotated !== 'boolean') return null;
  const { w, h } = ITEMS[type];
  return rotated ? { w: h, h: w } : { w, h };
}

function validGrid(g) {
  return isRecord(g) && Number.isSafeInteger(g.w) && g.w > 0 && Number.isSafeInteger(g.h) && g.h > 0 && Array.isArray(g.items);
}

// Pure placement preview. ignoreId is only for the item already in this grid.
export function canPlace(g, item, x, y, ignoreId) {
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
export function position(g, item, rotated) {
  if (rotated !== undefined) item = { ...(typeof item === 'string' ? { type: item } : item), rotated };
  const d = dimensions(item);
  if (!validGrid(g) || !d) return null;
  for (let y = 0; y <= g.h - d.h; y++) for (let x = 0; x <= g.w - d.w; x++) {
    if (canPlace(g, item, x, y)) return { x, y };
  }
  return null;
}

export function add(s, g, type, rotated = false) {
  if (!s || !Number.isSafeInteger(s.nextId) || s.nextId < 0 || s.nextId >= Number.MAX_SAFE_INTEGER || typeof rotated !== 'boolean') return false;
  const p = position(g, { type, rotated });
  if (!p) return false;
  g.items.push({ id: ++s.nextId, type, ...p, rotated });
  return true;
}

function take(g, id) { const idx = g.items.findIndex(i => i.id === id); return idx < 0 ? null : g.items.splice(idx, 1)[0]; }

// An explicit drop either applies entirely or changes nothing, including nextId.
// Same-grid moves retain array order. Transfers append in arrival order.
export function move(s, from, to, id, x, y, rotated) {
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

export function transfer(s, from, id) {
  if (s?.phase !== 'base' || !inventoryKey(from)) return false;
  const to = from === 'bag' ? 'warehouse' : 'bag';
  const source = s[from], target = s[to];
  if (!validGrid(source) || !validGrid(target)) return false;
  const item = source.items.find(candidate => candidate.id === id);
  if (!item) return false;
  const p = position(target, item);
  return p ? move(s, from, to, id, p.x, p.y) : false;
}
export function initial(seed = Date.now()) {
  const s = { version: VERSION, nextId: 0, seed: seed >>> 0 || 1, phase: 'base', hp: 100, food: 80, hydration: 80, clock: 0, runs: 0, route: 'depot', weapon: true, pack: true, bag: grid(4, 3), warehouse: grid(8, 5), step: 0, result: '', log: [], machines: { farm: { input: 0, output: 0, progress: 0 }, water: { input: 0, output: 0, progress: 0 } } };
  for (const type of ['water', 'potato']) add(s, s.bag, type);
  for (const type of ['fertilizer', 'fertilizer', 'plastic', 'plastic', 'water', 'potato', 'potato', 'knife', 'backpack']) add(s, s.warehouse, type);
  return s;
}
function random(s) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
export function log(s, text, kind = 'normal') { s.log.push({ text, kind, step: s.step }); if (s.log.length > 40) s.log.shift(); }
export function feed(s, key) {
  if (s.phase !== 'base' || !owns(RECIPES, key)) return false;
  const m = s.machines[key]; const item = s.warehouse.items.find(i => i.type === RECIPES[key].input);
  if (!item || m.input >= 3) return false; take(s.warehouse, item.id); m.input++; return true;
}
export function collect(s, key) {
  if (s.phase !== 'base' || !owns(RECIPES, key)) return false;
  const m = s.machines[key]; if (!m.output || !add(s, s.warehouse, RECIPES[key].output)) return false; m.output--; return true;
}
export function production(s, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  for (const [key, m] of Object.entries(s.machines)) {
    const r = RECIPES[key]; if (!m.input || m.output + r.count > 6) continue;
    m.progress += dt;
    while (m.progress >= r.duration && m.input && m.output + r.count <= 6) { m.progress -= r.duration; m.input--; m.output += r.count; }
    if (!m.input || m.output + r.count > 6) m.progress = 0;
  }
}
export function tick(s, dt = 1) {
  if (s.phase !== 'base' || !Number.isFinite(dt)) return;
  dt = Math.max(0, Math.min(2, dt)); s.clock += dt; production(s, dt);
  s.hp = Math.min(100, s.hp + dt * .65); s.food = Math.min(100, s.food + dt * .4); s.hydration = Math.min(100, s.hydration + dt * .5);
}
export function consume(s, from, id) {
  return s?.phase === 'base' && consumeItem(s, from, id);
}

// Expedition supplies are automatic; public inventory actions stay base-only.
function consumeItem(s, from, id) {
  if (!inventoryKey(from)) return false;
  const g = s[from]; const item = g?.items.find(i => i.id === id); if (!item || !['water', 'potato'].includes(item.type)) return false;
  if (item.type === 'water') { s.hydration = Math.min(100, s.hydration + 45); item.type = 'plastic'; item.rotated = false; }
  else { s.food = Math.min(100, s.food + 25); take(g, id); }
  return true;
}
export function equip(s, id) {
  if (s.phase !== 'base') return false;
  const item = s.warehouse.items.find(i => i.id === id); if (!item) return false;
  if (item.type === 'knife' && !s.weapon) { take(s.warehouse, id); s.weapon = true; return true; }
  if (item.type === 'backpack' && !s.pack) { take(s.warehouse, id); s.pack = true; s.bag.w = 4; s.bag.h = 3; return true; }
  return false;
}
export function start(s, route) {
  if (s.phase !== 'base' || !owns(ROUTES, route)) return false;
  s.phase = 'expedition'; s.route = route; s.step = 0; s.result = ''; s.log = []; log(s, `驶近${ROUTES[route].name}。离开车厢，探索自动开始。`, 'accent'); return true;
}
export function fail(s) {
  s.bag = grid(2, 2); s.weapon = false; s.pack = false; s.hp = 12; s.phase = 'base'; s.runs++; s.result = '撤离失败';
  log(s, '此次装备、背包及携带物品全部丢失。你以低生命值返回列车。', 'danger');
}
export function expeditionStep(s) {
  if (s.phase !== 'expedition') return false;
  s.step++; s.clock += 30; production(s, 30); s.food = Math.max(0, s.food - 10); s.hydration = Math.max(0, s.hydration - 14);
  for (const [type, value] of [['potato', s.food], ['water', s.hydration]]) {
    const item = s.bag.items.find(i => i.type === type);
    if (value <= 40 && item) { consumeItem(s, 'bag', item.id); log(s, type === 'water' ? '自动饮水。瓶装水变为塑料废料，仍占 1 格。' : '自动食用生土豆，恢复饱食度。', 'good'); }
  }
  if (!s.food || !s.hydration) { s.hp -= 14; log(s, '缺乏补给，身体逐渐虚弱。生命 −14。', 'danger'); }
  const r = ROUTES[s.route];
  if (random(s) < r.risk) { const damage = Math.round(r.damage * (s.weapon ? .55 : 1)); s.hp -= damage; log(s, `穿过坍塌通道时受伤。${s.weapon ? '猎刀帮助你脱困。' : ''}生命 −${damage}。`, 'danger'); }
  else log(s, ['沿铁轨搜索散落的货箱。', '无线电传来静电声。前路暂时安全。', '翻过废墟，发现一间旧储藏室。'][s.step % 3]);
  if (s.hp <= 0) { fail(s); return true; }
  const pool = ['fertilizer', 'plastic', 'potato', 'water', 'metal', 'knife', 'backpack']; const type = pool[Math.floor(random(s) * pool.length)];
  const accepted = add(s, s.bag, type); log(s, accepted ? `发现${ITEMS[type].name}，按发现顺序装入背包。` : `发现${ITEMS[type].name}，空间不足，留在原地。已有物品保持不变。`, accepted ? 'good' : 'muted');
  if (s.step >= 6) { s.phase = 'base'; s.runs++; s.result = '安全归来'; log(s, '车门在身后合拢。拖动背包物品，手动转移到主仓库。', 'accent'); }
  return true;
}
// Stored state is untrusted. V2 uses a separate save; malformed or V1 saves
// are rejected rather than silently changing spatial inventory semantics.
export function restore(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 100000) return null;
    const s = JSON.parse(raw);
    if (!isRecord(s) || s.version !== VERSION || !['base', 'expedition'].includes(s.phase) || !owns(ROUTES, s.route)) return null;
    for (const n of ['hp', 'food', 'hydration']) if (!Number.isFinite(s[n]) || s[n] < 0 || s[n] > 100) return null;
    for (const n of ['nextId', 'seed', 'runs', 'step']) if (!Number.isSafeInteger(s[n]) || s[n] < 0) return null;
    if (s.seed > 0xffffffff || (s.phase === 'expedition' && (s.step >= 6 || s.hp <= 0)) || s.step > 6 || !Number.isFinite(s.clock) || s.clock < 0 || typeof s.pack !== 'boolean' || typeof s.weapon !== 'boolean') return null;
    const ids = new Set();
    for (const [key, w, h] of [['warehouse', 8, 5], ['bag', s.pack ? 4 : 2, s.pack ? 3 : 2]]) {
      const g = s[key];
      if (!isRecord(g) || g.w !== w || g.h !== h || !Array.isArray(g.items) || g.items.length > w * h) return null;
      const checked = grid(w, h);
      for (const item of g.items) {
        if (!isRecord(item) || typeof item.rotated !== 'boolean' || !Number.isSafeInteger(item.id) || item.id < 1 || item.id > s.nextId || ids.has(item.id) || !canPlace(checked, item, item.x, item.y)) return null;
        ids.add(item.id);
        checked.items.push(item);
      }
    }
    if (!isRecord(s.machines) || Object.keys(s.machines).sort().join(',') !== 'farm,water') return null;
    for (const key of Object.keys(RECIPES)) {
      const m = s.machines[key], r = RECIPES[key];
      if (!isRecord(m) || !Number.isInteger(m.input) || m.input < 0 || m.input > 3 || !Number.isInteger(m.output) || m.output < 0 || m.output > 6 || !Number.isFinite(m.progress) || m.progress < 0 || m.progress >= r.duration) return null;
      if ((!m.input || m.output + r.count > 6) && m.progress !== 0) return null;
    }
    if (!Array.isArray(s.log) || s.log.length > 40 || s.log.some(entry => !isRecord(entry) || typeof entry.text !== 'string' || entry.text.length > 300 || !['normal', 'accent', 'danger', 'good', 'muted'].includes(entry.kind) || !Number.isInteger(entry.step) || entry.step < 0 || entry.step > 6) || typeof s.result !== 'string' || s.result.length > 30) return null;
    return s;
  } catch { return null; }
}
