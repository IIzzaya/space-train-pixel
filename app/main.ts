import '@fontsource/press-start-2p/latin-400.css';
import './style.css';
import * as E from './engine';
import { beginDrag, commitDrag, contains, hitTarget, itemAt, previewDrag, rotateDrag, toLogical } from './input';
import type { HitTarget } from './input';
import { GameRenderer } from './renderer';
import { drawInterface } from './ui';
import type { ViewState } from './ui';
import type { GameState, MachineKey, Point, Selection } from './types';

const KEY = 'space-train-pixel-v2';
const host = document.querySelector<HTMLDivElement>('#app');
if (!host) throw new Error('Missing canvas host.');
const canvas = document.createElement('canvas');
canvas.tabIndex = 0;
canvas.setAttribute('role', 'application');
canvas.setAttribute('aria-label', '时空列车游戏。Tab 切换控件，Enter 操作，R 旋转物品，Esc 取消或关闭菜单。');
host.append(canvas);
const fallback = document.createElement('p'); fallback.className = 'fallback'; fallback.textContent = '正在连接列车…'; host.append(fallback);
let state: GameState;
try { state = E.restore(localStorage.getItem(KEY)) ?? E.initial(); } catch { state = E.initial(); }
const view: ViewState = { selected: null, drag: null, route: state.route, modal: null, tab: 'operations', logScroll: 0, note: '把物资装进背包，下一站等你探索。', saveOkay: true, focus: null, hover: null };
let renderer: GameRenderer;
try {
  await document.fonts.load('10px "Press Start 2P"');
  renderer = await GameRenderer.create(canvas); fallback.remove();
}
catch (error) {
  canvas.remove(); fallback.textContent = '此浏览器无法启动图形界面。请启用图形加速后刷新，已有存档不会清除。';
  console.error(error); throw error;
}
let targets: HitTarget[] = [], dirty = true, pressed: { id: string; pointerId: number } | null = null;
let expElapsed = 0, saveElapsed = 0, simulationElapsed = 0, lastFrame = performance.now(), lastDraw = 0;
const atBase = (): boolean => state.phase === 'base';
let sceneTime = 0;
let blurred = false, frameId = 0, suspended = false, previousFocus: string | null = null;
function refresh(): void { dirty = true; }
function tell(text: string): void { view.note = text; refresh(); }
function save(): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)); view.saveOkay = true; }
  catch { view.saveOkay = false; }
  refresh();
}
function point(event: Pick<PointerEvent, 'clientX' | 'clientY'>): Point | null { return toLogical({ x: event.clientX, y: event.clientY }, canvas.getBoundingClientRect()); }
function release(pointerId: number): void { if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId); }
function cancelDrag(message = false): void {
  const drag = view.drag; view.drag = null;
  if (drag) { release(drag.pointerId); if (message) tell('已取消移动。物品保留在原位。'); }
  const click = pressed; pressed = null; if (click) release(click.pointerId);
  refresh();
}
function openModal(modal: 'help' | 'reset'): void {
  cancelDrag(); previousFocus = view.focus; view.modal = modal; view.focus = 'close-modal'; refresh();
}
function closeModal(): void { view.modal = null; view.focus = previousFocus; previousFocus = null; refresh(); }
function choose(selection: Selection): void { view.selected = selection; refresh(); }
function itemAction(action: string): void {
  if (!view.selected || state.phase !== 'base') return;
  const { from, id } = view.selected, item = state[from].items.find(candidate => candidate.id === id);
  if (!item) { view.selected = null; refresh(); return; }
  let okay = false;
  if (action === 'transfer') { okay = E.transfer(state, from, id); if (okay) view.selected = { from: from === 'bag' ? 'warehouse' : 'bag', id }; }
  if (action === 'rotate') okay = E.move(state, from, from, id, item.x, item.y, !item.rotated);
  if (action === 'consume') okay = E.consume(state, from, id);
  if (action === 'equip' && from === 'warehouse') okay = E.equip(state, id);
  if (!state[view.selected.from].items.some(candidate => candidate.id === view.selected?.id)) view.selected = null;
  tell(okay ? '操作完成。' : action === 'equip' ? '已装备同类物品，无需重复装备。' : '空间不足，物品保持原样。'); save();
}
function activate(id: string): void {
  // The same registry drives pointer and keyboard activation. No DOM gameplay actions.
  if (!targets.some(target => target.id === id && target.enabled)) return;
  if (id === 'help') { openModal('help'); return; }
  if (id === 'reset') { openModal('reset'); return; }
  if (id === 'close-modal') { closeModal(); return; }
  if (id === 'confirm-reset' && view.modal === 'reset') {
    state = E.initial(); view.route = 'depot'; view.selected = null; view.logScroll = 0; expElapsed = 0;
    closeModal(); tell('新的旅程开始。整理补给，再次出发。'); save(); return;
  }
  if (view.modal) return;
  if (id.startsWith('item:')) {
    const [, from, rawId] = id.split(':');
    if (from === 'bag' || from === 'warehouse') choose({ from, id: Number(rawId) });
    return;
  }
  if (['transfer', 'rotate', 'consume', 'equip'].includes(id)) { itemAction(id); return; }
  if (id.startsWith('feed:') || id.startsWith('collect:')) {
    const [action, rawKey] = id.split(':');
    if (rawKey !== 'farm' && rawKey !== 'water') return;
    const key: MachineKey = rawKey;
    if (action === 'feed') tell(E.feed(state, key) ? '原料已投入，产物将保留在机器输出区。' : '当前无法投料。');
    else tell(E.collect(state, key) ? '领取了 1 个产物，已放入仓库。' : '仓库空间不足，产物仍在机器输出区。');
    save(); return;
  }
  if ((id === 'route:depot' || id === 'route:tunnel') && state.phase === 'base') { view.route = id === 'route:depot' ? 'depot' : 'tunnel'; state.route = view.route; save(); return; }
  if (id === 'tab:operations' || id === 'tab:journal') { view.tab = id === 'tab:operations' ? 'operations' : 'journal'; refresh(); return; }
  if (id === 'log:up' || id === 'log:down') { view.logScroll += id === 'log:up' ? -5 : 5; refresh(); return; }
  if (id === 'depart') {
    cancelDrag();
    if (E.start(state, view.route)) { view.selected = null; expElapsed = 0; view.logScroll = 0; tell('自动探索开始。途中不能整理，补给会自动使用。'); save(); }
  }
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || view.drag || pressed || suspended) return;
  event.preventDefault(); canvas.focus({ preventScroll: true });
  const p = point(event); if (!p) return;
  if (!view.modal) {
    const selection = itemAt(state, p);
    if (selection) {
      if (state.phase !== 'base') { tell('外出途中库存锁定，归来后再整理。'); return; }
      choose(selection); view.focus = `item:${selection.from}:${selection.id}`;
      view.drag = beginDrag(state, selection, p, event.pointerId);
      if (view.drag) { canvas.setPointerCapture(event.pointerId); previewDrag(state, view.drag, p); }
      refresh(); return;
    }
  }
  const hit = hitTarget(targets, p);
  if (hit) { view.focus = hit.id; pressed = { id: hit.id, pointerId: event.pointerId }; canvas.setPointerCapture(event.pointerId); refresh(); }
});
canvas.addEventListener('pointermove', event => {
  const p = point(event);
  if (view.drag) {
    if (view.drag.pointerId !== event.pointerId) return;
    previewDrag(state, view.drag, p); refresh();
  } else {
    const hover = p ? hitTarget(targets, p)?.id ?? null : null;
    if (hover !== view.hover) { view.hover = hover; canvas.style.cursor = hover ? 'pointer' : 'default'; refresh(); }
  }
});
canvas.addEventListener('pointerup', event => {
  if (view.drag?.pointerId === event.pointerId) {
    const drag = view.drag; previewDrag(state, drag, point(event)); view.drag = null; release(event.pointerId);
    if (drag.moved) {
      const selection = commitDrag(state, drag);
      if (selection) { view.selected = selection; tell(`${E.ITEMS[drag.item.type].name}已放入${selection.from === 'bag' ? '背包' : '仓库'}。`); }
      else tell(drag.target ? '这个位置放不下。物品保留在原位。' : '已取消移动。物品保留在原位。');
    }
    save(); refresh(); return; // Never activate the button underneath a drop.
  }
  if (pressed?.pointerId === event.pointerId) {
    const id = pressed.id; pressed = null; release(event.pointerId);
    const p = point(event); if (p && hitTarget(targets, p)?.id === id) activate(id);
  }
});
for (const kind of ['pointercancel', 'lostpointercapture'] as const) canvas.addEventListener(kind, event => {
  if (view.drag?.pointerId === event.pointerId || pressed?.pointerId === event.pointerId) cancelDrag(true);
});
canvas.addEventListener('pointerleave', () => { view.hover = null; refresh(); });
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('wheel', event => {
  const p = point(event);
  if (view.modal || view.tab !== 'journal' || !p || !contains({ x: 792, y: 430, w: 472, h: 372 }, p)) return;
  event.preventDefault(); view.logScroll += Math.sign(event.deltaY) * 3; refresh();
}, { passive: false });
canvas.addEventListener('keydown', event => {
  if (suspended) return;
  if (event.key === 'Escape') {
    event.preventDefault(); if (view.drag) cancelDrag(true); else if (view.modal) closeModal(); return;
  }
  if (event.key === 'Tab') {
    event.preventDefault(); if (view.drag) cancelDrag(true);
    const enabled = targets.filter(target => target.enabled), index = enabled.findIndex(target => target.id === view.focus);
    if (enabled.length) view.focus = enabled[(index + (event.shiftKey ? -1 : 1) + enabled.length) % enabled.length].id;
    refresh(); return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && !event.repeat && !view.drag) {
    event.preventDefault(); if (view.focus) activate(view.focus); return;
  }
  if (event.key.toLowerCase() === 'r' && !event.repeat && !view.modal) {
    event.preventDefault(); if (view.drag) { rotateDrag(state, view.drag); refresh(); } else itemAction('rotate'); return;
  }
  if (!view.modal && view.tab === 'journal' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault(); view.logScroll += event.key === 'ArrowUp' ? -1 : 1; refresh();
  }
});
window.addEventListener('blur', () => { blurred = true; cancelDrag(true); save(); });
window.addEventListener('focus', () => { blurred = false; lastFrame = performance.now(); refresh(); });
window.addEventListener('resize', () => { cancelDrag(true); refresh(); });
document.addEventListener('visibilitychange', () => { lastFrame = performance.now(); if (document.hidden) { cancelDrag(true); save(); } refresh(); });
window.addEventListener('pagehide', save);
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); cancelDrag(); save(); suspended = true;
  fallback.textContent = '图形连接已中断，进度已保存。请刷新页面继续。'; host.append(fallback);
});
canvas.addEventListener('webglcontextrestored', () => { location.reload(); });
function animate(now: number): void {
  const dt = Math.min(1, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
  const paused = document.hidden || blurred || view.modal !== null || suspended;
  if (!paused) {
    sceneTime += dt * 1000;
    simulationElapsed += dt; saveElapsed += dt;
    if (simulationElapsed >= .2) {
      if (state.phase === 'expedition') {
        expElapsed += simulationElapsed;
        if (expElapsed >= 3) {
          expElapsed -= 3; E.expeditionStep(state); view.logScroll = 0;
          tell(atBase() ? state.result === '安全归来' ? '安全归来。请手动整理背包战利品。' : '撤离失败。装备与背包全损，基地正在恢复状态。' : state.log.at(-1)?.text ?? '探索中');
        }
      } else E.tick(state, simulationElapsed);
      simulationElapsed = 0; refresh();
    }
    if (saveElapsed >= 2) { saveElapsed = 0; save(); }
  }
  if (!document.hidden && !suspended && now - lastDraw >= (renderer.mode === 'software' ? 100 : 33)) {
    if (dirty) { targets = drawInterface(renderer, state, view); dirty = false; }
    renderer.draw(sceneTime, state.phase === 'expedition'); lastDraw = now;
  }
  frameId = requestAnimationFrame(animate);
}
save(); frameId = requestAnimationFrame(animate);
if (import.meta.hot) import.meta.hot.dispose(() => { cancelAnimationFrame(frameId); renderer.dispose(); });
