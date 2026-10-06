import { dimensions, ITEMS, RECIPES, ROUTES } from './engine';
import { CELL, GRID_ORIGINS, gridRect, itemRect, WIDTH, HEIGHT } from './input';
import type { Drag, HitTarget } from './input';
import { GameRenderer, WORLD } from './renderer';
import type { GameState, InventoryName, ItemType, Rect, RouteKey, Selection } from './types';

export type Modal = 'help' | 'reset' | null;
export interface ViewState {
  selected: Selection | null; drag: Drag | null; route: RouteKey;
  modal: Modal; tab: 'operations' | 'journal'; logScroll: number;
  note: string; saveOkay: boolean; focus: string | null; hover: string | null;
}
const C = { bg: '#11272f', panel: '#1c353d', inset: '#142c34', line: '#446263', cream: '#ede5bf', muted: '#91aaa0', gold: '#e3b866', green: '#9bbb77', danger: '#df8e7b', blue: '#87b9cc' };
const itemColors: Record<ItemType, string> = { water: '#294e60', potato: '#554832', plastic: '#294d50', fertilizer: '#3b5341', metal: '#3e4c50', knife: '#514247', backpack: '#44513a' };

export function drawInterface(renderer: GameRenderer, state: GameState, view: ViewState): HitTarget[] {
  const h = renderer.hud; h.begin(); let targets: HitTarget[] = [];
  const active = state.phase === 'expedition';
  const button = (id: string, label: string, rect: Rect, enabled = true, accent = false): void => {
    targets.push({ id, rect, enabled });
    const highlighted = view.focus === id || view.hover === id;
    h.rect(rect.x, rect.y, rect.w, rect.h, enabled ? accent ? C.gold : highlighted ? '#395451' : '#29444a' : '#21373b');
    h.border(rect, view.focus === id ? C.cream : highlighted ? C.gold : accent && enabled ? '#efd391' : C.line);
    const size = 16, textWidth = Math.min(rect.w - 12, label.length * 17);
    h.text(label, rect.x + Math.max(7, (rect.w - textWidth) / 2), rect.y + (rect.h - size * 1.55) / 2, size, enabled ? accent ? '#253d3e' : C.cream : '#6b8280', rect.w - 12);
  };
  const icon = (type: ItemType, rect: Rect, rotated = false, opacity = 1): void => {
    const texture = (rotated ? renderer.rotatedIcons : renderer.icons).get(type);
    if (texture) h.texture(texture, rect, opacity);
  };
  const panel = (rect: Rect): void => { h.rect(rect.x, rect.y, rect.w, rect.h, C.panel); h.border(rect, C.line); };
  h.rect(0, 0, WIDTH, HEIGHT, C.bg);
  h.rect(0, 0, WIDTH, 4, C.gold);
  h.text('THE LAST LINE / 07', 24, 16, 9, C.gold, 400, true);
  h.text('时空列车', 22, 34, 31, C.cream);
  h.text('SPACE TRAIN', 192, 49, 10, C.muted, 300, true);
  h.rect(796, 32, 7, 7, active ? C.gold : C.green);
  h.text(active ? '外出探索中' : '列车整备中', 816, 25, 16, C.cream);
  h.text(`${String(Math.floor(state.clock / 60)).padStart(2, '0')}:${String(Math.floor(state.clock % 60)).padStart(2, '0')}`, 820, 52, 11, C.muted, 200, true);
  button('help', '操作说明', { x: 1050, y: 25, w: 108, h: 38 });
  button('reset', '重置', { x: 1170, y: 25, w: 86, h: 38 });
  const stats = [['生命', state.hp, C.danger], ['饱食', state.food, C.gold], ['补水', state.hydration, C.blue]] as const;
  stats.forEach(([label, value, color], index) => {
    const x = 24 + index * 267;
    h.text(label, x, 85, 15, C.muted); h.rect(x + 47, 93, 157, 8, '#284148'); h.rect(x + 47, 93, 157 * value / 100, 8, color);
    h.text(String(Math.ceil(value)).padStart(3, ' '), x + 212, 83, 14, color, 45);
  });
  h.text(active ? '探索快进 · 自动使用补给' : '停靠恢复 · 时间流速 1×', 920, 83, 15, C.muted, 345);
  h.text('SECTOR 04 / DUSK', 25, 113, 8, C.muted, 400, true);
  h.text(active ? `探索 · ${ROUTES[state.route].name}` : '停靠 · 废土边缘', 1031, 108, 14, C.muted, 225);
  h.texture(renderer.worldTexture, WORLD);
  h.text('01  货仓', 403, 346, 15, C.cream); h.text('02  栽培车厢', 585, 346, 15, C.cream); h.text('03  供水车厢', 800, 346, 15, C.cream);
  panel({ x: 16, y: 376, w: 480, h: 426 }); panel({ x: 520, y: 376, w: 256, h: 426 }); panel({ x: 792, y: 376, w: 472, h: 426 });
  h.text('主仓库', 32, 389, 21, C.cream); h.text('随身背包', 536, 389, 21, C.cream);
  h.text('8 × 5', 411, 393, 14, C.muted);
  const drawGrid = (name: InventoryName): void => {
    const g = state[name], rect = gridRect(state, name);
    h.rect(rect.x, rect.y, rect.w, rect.h, C.inset);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      h.border({ x: rect.x + x * CELL, y: rect.y + y * CELL, w: CELL, h: CELL }, '#29434a', 1);
      h.rect(rect.x + x * CELL + 25, rect.y + y * CELL + 26, 2, 2, '#345157');
    }
    for (const item of g.items) {
      const r = itemRect(name, item), d = dimensions(item)!;
      const selected = view.selected?.id === item.id;
      const dragging = view.drag?.item.id === item.id;
      h.rect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, itemColors[item.type], dragging ? .38 : 1);
      h.border({ x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }, selected || view.focus === `item:${name}:${item.id}` ? C.gold : '#63807a', selected ? 2 : 1);
      const size = Math.min(70, r.w - 7, r.h - 7);
      icon(item.type, { x: r.x + (r.w - size) / 2, y: r.y + (r.h - size) / 2 - 3, w: size, h: size }, item.rotated, dragging ? .3 : 1);
      h.text(`${d.w}×${d.h}`, r.x + r.w - 30, r.y + r.h - 22, 11, C.muted, 30);
      targets.push({ id: `item:${name}:${item.id}`, rect: r, enabled: !active });
    }
    h.border(rect, '#5b7773');
  };
  drawGrid('warehouse'); drawGrid('bag');
  h.text(`${state.weapon ? '◆ 猎刀已装备' : '◇ 无武器'}   ${state.pack ? '▣ 帆布包' : '□ 临时口袋'}`, 536, 429, 13, C.muted, 224);
  h.text(`${state.bag.w} × ${state.bag.h} · 拖放整理`, 536, 641, 14, C.muted, 224);
  h.paragraph('外出失败，携带物品与装备全部丢失。仓库物资安全。', 536, 679, 216, 15, C.danger, 25);
  h.text('R 旋转 · Esc 取消', 536, 748, 14, C.muted, 224);
  h.text('Tab 切换 · Enter 操作', 536, 774, 13, C.muted, 224);
  const selected = view.selected && state[view.selected.from].items.find(item => item.id === view.selected?.id);
  if (selected && view.selected) {
    icon(selected.type, { x: 30, y: 706, w: 45, h: 45 });
    h.text(ITEMS[selected.type].name, 84, 704, 17, C.cream, 398);
    h.text(ITEMS[selected.type].info, 84, 730, 13, C.muted, 398);
    button('transfer', view.selected.from === 'bag' ? '移入仓库' : '装入背包', { x: 32, y: 763, w: 120, h: 30 }, !active);
    button('rotate', '旋转 R', { x: 162, y: 763, w: 104, h: 30 }, !active);
    if (selected.type === 'water' || selected.type === 'potato') button('consume', '使用', { x: 276, y: 763, w: 92, h: 30 }, !active);
    if (view.selected.from === 'warehouse' && (selected.type === 'knife' || selected.type === 'backpack')) button('equip', '装备', { x: 276, y: 763, w: 92, h: 30 }, !active);
  } else {
    h.text('选择物品查看详情', 32, 718, 17, C.muted);
    h.text('点击快捷操作，或拖到指定格位。', 32, 749, 15, C.muted);
    h.text('瓶装水饮用后留下 1 格塑料废料。', 32, 776, 13, C.muted);
  }
  button('tab:operations', '列车控制', { x: 808, y: 389, w: 215, h: 35 }, true, view.tab === 'operations');
  button('tab:journal', `航行日志${state.log.length ? ' ·' : ''}`, { x: 1033, y: 389, w: 215, h: 35 }, true, view.tab === 'journal');
  if (view.tab === 'operations') {
    for (const [index, key] of (['farm', 'water'] as const).entries()) {
      const recipe = RECIPES[key], machine = state.machines[key], y = 436 + index * 92;
      icon(recipe.output, { x: 807, y: y + 2, w: 57, h: 57 });
      h.text(recipe.name, 870, y, 17, C.cream, 230);
      h.text(machine.output ? `待领取 ${machine.output}` : machine.input ? '生产中' : '待投料', 1138, y + 1, 13, machine.output ? C.green : C.muted, 110);
      h.rect(870, y + 32, 377, 5, C.inset); h.rect(870, y + 32, 377 * machine.progress / recipe.duration, 5, C.green);
      h.text(`${machine.input}/3 原料 · ${machine.output}/6 产物`, 870, y + 49, 14, C.muted, 210);
      button(`feed:${key}`, '投料', { x: 1090, y: y + 43, w: 73, h: 30 }, !active && machine.input < 3 && state.warehouse.items.some(item => item.type === recipe.input));
      button(`collect:${key}`, '领取', { x: 1173, y: y + 43, w: 73, h: 30 }, !active && machine.output > 0);
    }
    h.text('下一站 / NEXT STOP', 811, 624, 13, C.muted);
    button('route:depot', '货运站 · 低风险', { x: 808, y: 656, w: 214, h: 39 }, !active, view.route === 'depot');
    button('route:tunnel', '隧道 · 高风险', { x: 1033, y: 656, w: 214, h: 39 }, !active, view.route === 'tunnel');
    button('depart', active ? '探索中 · 无需操作' : '整备完毕 · 出发 →', { x: 808, y: 710, w: 440, h: 43 }, !active, true);
    if (active) {
      h.text(`节点 ${state.step}/6`, 811, 766, 14, C.muted);
      for (let i = 0; i < 6; i++) h.rect(915 + i * 54, 776, 43, 6, i < state.step ? C.gold : C.line);
    } else h.text(state.result ? `${state.result} · 第 ${state.runs} 次外出` : '6 个探索节点 · 约 18 秒', 811, 766, 15, state.result === '撤离失败' ? C.danger : C.muted, 436);
  } else {
    h.text(`FIELD NOTES / ${state.runs} 次外出`, 813, 434, 12, C.muted);
    const lines = state.log.length ? [...state.log].reverse().flatMap(entry => h.lines(`· ${entry.text}`, 430, 15).map(text => ({ text, kind: entry.kind }))) : [{ text: '第一次外出后，旅途将记录在这里。', kind: 'muted' }];
    const maxScroll = Math.max(0, lines.length - 11); view.logScroll = Math.max(0, Math.min(maxScroll, view.logScroll));
    lines.slice(view.logScroll, view.logScroll + 11).forEach((line, index) => h.text(line.text, 813, 467 + index * 25, 15, line.kind === 'danger' ? C.danger : line.kind === 'good' ? C.green : line.kind === 'accent' ? C.gold : C.muted, 432));
    button('log:up', '↑ 较新', { x: 811, y: 761, w: 106, h: 30 }, view.logScroll > 0);
    h.text(`${Math.min(lines.length, view.logScroll + 1)}–${Math.min(lines.length, view.logScroll + 11)} / ${lines.length}`, 943, 764, 13, C.muted, 167);
    button('log:down', '较早 ↓', { x: 1139, y: 761, w: 106, h: 30 }, view.logScroll < maxScroll);
  }
  h.text(view.note, 22, 811, 15, C.cream, 1000);
  h.text(view.saveOkay ? '本机自动保存' : '存储不可用', 1124, 812, 13, view.saveOkay ? C.muted : C.danger, 140);
  h.text('PIXEL SLICE 0.3', 23, 841, 7, C.muted, 320, true);
  h.text(renderer.failed ? '软件场景失败 · 请刷新' : renderer.mode === 'webgl' ? 'THREE.JS / WEBGL · 全画布界面' : 'THREE.JS / 软件兼容渲染 · 全画布界面', 862, 836, 12, renderer.failed ? C.danger : C.muted, 400);
  if (view.drag?.moved) {
    const drag = view.drag, size = dimensions({ ...drag.item, rotated: drag.rotated })!;
    if (drag.target) {
      const origin = GRID_ORIGINS[drag.target.name];
      h.border({ x: origin.x + drag.target.x * CELL, y: origin.y + drag.target.y * CELL, w: size.w * CELL, h: size.h * CELL }, drag.target.valid ? '#b2dc8d' : '#f29178', 4);
    }
    const r = { x: drag.point.x - drag.offset.x * CELL - CELL / 2, y: drag.point.y - drag.offset.y * CELL - CELL / 2, w: size.w * CELL, h: size.h * CELL };
    h.rect(r.x, r.y, r.w, r.h, drag.target?.valid ? '#658752' : '#915044', .7);
    h.border(r, drag.target?.valid ? '#d7efad' : '#f6b09a');
    const side = Math.min(r.w, r.h, 84); icon(drag.item.type, { x: r.x + (r.w - side) / 2, y: r.y + (r.h - side) / 2, w: side, h: side }, drag.rotated);
  }
  if (view.modal) {
    // Underlying controls are not in the active hit/focus registry while a modal is open.
    targets = [];
    h.rect(0, 0, WIDTH, HEIGHT, '#06161f', .84);
    const rect = { x: 300, y: 152, w: 680, h: 554 }; panel(rect); h.border(rect, C.gold, 3);
    h.text(view.modal === 'help' ? 'FIELD MANUAL' : 'NEW JOURNEY', 333, 180, 11, C.gold, 550, true);
    h.text(view.modal === 'help' ? '在废土，给明天留一瓶水。' : '重新开始这段旅程？', 331, 217, 26, C.cream, 600);
    if (view.modal === 'help') {
      const paragraphs = [
        '拖动物品到仓库或背包的指定格位。绿色轮廓可放置，红色表示碰撞或越界。R 旋转，Esc 或拖到外部取消。',
        '也可以点击物品，使用下方的转移、旋转、使用按钮。Tab 切换焦点，Enter 操作；日志可滚轮或按方向键翻阅。',
        '给栽培盆投入肥料，给滤水器投入塑料。生产完成后手动领取，输出满会停机。',
        '选择路线后 6 个节点自动推进。失败丢失全部携带物品与装备；备用装备可在基地重新装备。',
        '页面隐藏、窗口失焦与菜单打开时暂停。本版没有离线生产。数值仍是可玩切片的测试参数。',
      ];
      let y = 276;
      for (const text of paragraphs) { y += h.paragraph(text, 333, y, 604, 16, C.muted, 25) + 13; }
    } else {
      h.paragraph('将清除此版本的本机进度，无法撤销。你的其他项目不会受影响。', 333, 285, 601, 18, C.muted, 30);
      button('confirm-reset', '确认重置存档', { x: 333, y: 391, w: 281, h: 43 }, true, true);
    }
    button('close-modal', view.modal === 'reset' ? '取消 · 返回列车' : '返回列车', { x: 657, y: 639, w: 289, h: 40 });
  }
  h.end(); return targets;
}
