import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { createWorldScene, itemModel, litScene } from './scene';
import { WIDTH, HEIGHT } from './input';
import type { ItemType, Rect } from './types';

export const WORLD: Rect = { x: 18, y: 132, w: 1244, h: 218 };
const WORLD_W = 622, WORLD_H = 109;
const pixelTexture = (canvas: HTMLCanvasElement): THREE.CanvasTexture => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false;
  return texture;
};
function canvas2D(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}
async function rasterize(svg: SVGElement, width: number, height: number): Promise<HTMLCanvasElement> {
  const { canvas, context } = canvas2D(width, height);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve(); image.onerror = () => reject(new Error('Software scene rasterization failed.'));
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  });
  context.drawImage(image, 0, 0, width, height); return canvas;
}

interface CachedText { texture: THREE.CanvasTexture; w: number; h: number; used: number }
/** The HUD is a retained pool of actual Three.js meshes. Canvas2D only authors textures. */
export class HudLayer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(0, WIDTH, HEIGHT, 0, -10, 10);
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly meshes: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly labels = new Map<string, CachedText>();
  private readonly measure = canvas2D(1, 1).context;
  private cursor = 0;
  private frame = 0;
  begin(): void { this.cursor = 0; this.frame++; }
  end(): void {
    for (let i = this.cursor; i < this.meshes.length; i++) this.meshes[i].visible = false;
    // Retain frequently reused glyph/text textures, release stale log/timer strings.
    if (this.labels.size > 240) for (const [key, entry] of this.labels) {
      if (entry.used < this.frame - 2) { entry.texture.dispose(); this.labels.delete(key); }
    }
  }
  rect(x: number, y: number, w: number, h: number, color: string, opacity = 1, map: THREE.Texture | null = null): void {
    let mesh = this.meshes[this.cursor];
    if (!mesh) {
      mesh = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true, toneMapped: false }));
      mesh.frustumCulled = false; this.meshes.push(mesh); this.scene.add(mesh);
    }
    mesh.visible = true; mesh.position.set(x + w / 2, HEIGHT - y - h / 2, 0); mesh.scale.set(w, h, 1);
    mesh.renderOrder = this.cursor++;
    const previousMap = mesh.material.map;
    mesh.material.color.set(color); mesh.material.opacity = opacity; mesh.material.map = map;
    if (!!previousMap !== !!map) mesh.material.needsUpdate = true;
  }
  border(rect: Rect, color: string, thickness = 2): void {
    this.rect(rect.x, rect.y, rect.w, thickness, color); this.rect(rect.x, rect.y + rect.h - thickness, rect.w, thickness, color);
    this.rect(rect.x, rect.y, thickness, rect.h, color); this.rect(rect.x + rect.w - thickness, rect.y, thickness, rect.h, color);
  }
  texture(texture: THREE.Texture, rect: Rect, opacity = 1): void { this.rect(rect.x, rect.y, rect.w, rect.h, '#ffffff', opacity, texture); }
  text(text: string, x: number, y: number, size = 16, color = '#ece8c8', maxWidth = 1200, pixel = false): void {
    if (!text) return;
    const font = pixel ? `${size}px "Press Start 2P", monospace` : `500 ${size}px "Noto Sans CJK SC", "Microsoft YaHei", system-ui, sans-serif`;
    const key = [text, font, color, maxWidth].join('|');
    let label = this.labels.get(key);
    if (!label) {
      this.measure.font = font;
      const w = Math.min(maxWidth, Math.ceil(this.measure.measureText(text).width) + 4), h = Math.ceil(size * 1.55);
      const { canvas, context } = canvas2D(Math.max(1, w), h);
      context.font = font; context.fillStyle = color; context.textBaseline = 'middle';
      // Long single labels are clipped, never squeezed or distorted.
      context.fillText(text, 1, h / 2);
      label = { texture: pixelTexture(canvas), w, h, used: this.frame }; this.labels.set(key, label);
    }
    label.used = this.frame;
    this.texture(label.texture, { x: Math.round(x), y: Math.round(y), w: label.w, h: label.h });
  }
  lines(text: string, width: number, size = 16): string[] {
    this.measure.font = `500 ${size}px "Noto Sans CJK SC", "Microsoft YaHei", system-ui, sans-serif`;
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const character of paragraph) {
        if (line && this.measure.measureText(line + character).width > width) { lines.push(line); line = ''; }
        line += character;
      }
      lines.push(line);
    }
    return lines;
  }
  paragraph(text: string, x: number, y: number, width: number, size = 16, color = '#b2c5b4', lineHeight = 25): number {
    const lines = this.lines(text, width, size);
    lines.forEach((line, i) => this.text(line, x, y + i * lineHeight, size, color, width)); return lines.length * lineHeight;
  }
  /** Software adapter consumes the very same Three.js mesh graph and textures. */
  paintSoftware(context: CanvasRenderingContext2D): void {
    this.scene.updateMatrixWorld(); this.camera.updateMatrixWorld();
    context.clearRect(0, 0, WIDTH, HEIGHT);
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const mesh of this.meshes) {
      if (!mesh.visible) continue;
      a.set(-.5, .5, 0).applyMatrix4(mesh.matrixWorld).project(this.camera);
      b.set(.5, -.5, 0).applyMatrix4(mesh.matrixWorld).project(this.camera);
      const x = Math.round((a.x + 1) * WIDTH / 2), y = Math.round((1 - a.y) * HEIGHT / 2);
      const w = Math.round((b.x - a.x) * WIDTH / 2), h = Math.round((a.y - b.y) * HEIGHT / 2);
      const material = mesh.material;
      context.globalAlpha = material.opacity;
      const source: unknown = material.map?.source.data;
      if (source instanceof HTMLCanvasElement) context.drawImage(source, x, y, w, h);
      else { context.fillStyle = '#' + material.color.getHexString(THREE.SRGBColorSpace); context.fillRect(x, y, w, h); }
    }
    context.globalAlpha = 1;
  }
  dispose(): void {
    this.geometry.dispose(); this.meshes.forEach(mesh => mesh.material.dispose());
    this.labels.forEach(entry => entry.texture.dispose()); this.labels.clear(); this.scene.clear();
  }
}

export class GameRenderer {
  readonly hud = new HudLayer();
  readonly canvas: HTMLCanvasElement;
  readonly mode: 'webgl' | 'software';
  readonly icons = new Map<ItemType, THREE.CanvasTexture>();
  readonly rotatedIcons = new Map<ItemType, THREE.CanvasTexture>();
  readonly worldTexture: THREE.Texture;
  private readonly gl: THREE.WebGLRenderer | null;
  private readonly software: SVGRenderer | null;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly target: THREE.WebGLRenderTarget | null;
  private readonly world = createWorldScene(WORLD_W / WORLD_H);
  private readonly softwareWorld: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
  private worldPending = false;
  private lastWorld = -10000;
  private disposed = false;
  private softwareError = false;
  get failed(): boolean { return this.softwareError; }
  private constructor(canvas: HTMLCanvasElement, gl: THREE.WebGLRenderer | null) {
    this.canvas = canvas; this.gl = gl; this.mode = gl ? 'webgl' : 'software';
    this.softwareWorld = canvas2D(WORLD_W, WORLD_H);
    if (gl) {
      this.software = null; this.context = null;
      gl.setPixelRatio(1); gl.setSize(WIDTH, HEIGHT, false); gl.outputColorSpace = THREE.SRGBColorSpace;
      this.target = new THREE.WebGLRenderTarget(WORLD_W, WORLD_H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      this.target.texture.colorSpace = THREE.SRGBColorSpace; this.worldTexture = this.target.texture;
    } else {
      this.target = null; this.software = new SVGRenderer(); this.software.setQuality('low');
      this.software.setSize(WORLD_W, WORLD_H); this.context = canvas.getContext('2d');
      if (!this.context) throw new Error('No rendering backend is available.');
      canvas.width = WIDTH; canvas.height = HEIGHT; this.context.imageSmoothingEnabled = false;
      this.worldTexture = pixelTexture(this.softwareWorld.canvas);
    }
    canvas.dataset.renderer = this.mode;
  }
  static async create(canvas: HTMLCanvasElement): Promise<GameRenderer> {
    let gl: THREE.WebGLRenderer | null = null;
    const forceSoftware = new URLSearchParams(location.search).get('renderer') === 'software';
    if (!forceSoftware) try { gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true }); } catch { /* Same Three scene graph, explicit software backend. */ }
    const renderer = new GameRenderer(canvas, gl);
    await renderer.createIcons(); return renderer;
  }
  private async createIcons(): Promise<void> {
    const scene = litScene(); const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
    camera.position.set(2, 1.8, 3); camera.lookAt(0, 0, 0);
    const svg = new SVGRenderer(); svg.setSize(72, 72); svg.setQuality('low'); svg.setClearColor(new THREE.Color('#253e48'), 0);
    // Icons are original Three.js voxel models baked once into transparent textures.
    for (const type of ['water', 'potato', 'plastic', 'fertilizer', 'metal', 'knife', 'backpack'] as const) {
      const model = itemModel(type); scene.add(model); svg.render(scene, camera);
      svg.domElement.style.backgroundColor = 'transparent';
      const canvas = await rasterize(svg.domElement, 72, 72); this.icons.set(type, pixelTexture(canvas));
      const rotated = canvas2D(72, 72); rotated.context.translate(36, 36); rotated.context.rotate(Math.PI / 2); rotated.context.drawImage(canvas, -36, -36); this.rotatedIcons.set(type, pixelTexture(rotated.canvas));
      scene.remove(model); model.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    }
  }
  draw(time: number, active: boolean): void {
    if (this.disposed) return;
    if (this.gl && this.target) {
      this.world.update(time, active); this.gl.setRenderTarget(this.target); this.gl.render(this.world.scene, this.world.camera);
      this.gl.setRenderTarget(null); this.gl.render(this.hud.scene, this.hud.camera);
    } else if (this.context && this.software) {
      this.hud.paintSoftware(this.context);
      if (!this.worldPending && time - this.lastWorld >= 750) {
        this.lastWorld = time; this.worldPending = true; this.world.update(time, active);
        this.software.render(this.world.scene, this.world.camera);
        void rasterize(this.software.domElement, WORLD_W, WORLD_H).then(canvas => {
          if (this.disposed) return;
          this.softwareWorld.context.clearRect(0, 0, WORLD_W, WORLD_H);
          this.softwareWorld.context.drawImage(canvas, 0, 0); this.worldTexture.needsUpdate = true;
        }).catch(() => { this.softwareError = true; }).finally(() => { this.worldPending = false; });
      }
    }
  }
  dispose(): void {
    this.disposed = true; this.hud.dispose(); this.world.dispose(); this.target?.dispose(); this.gl?.dispose();
    this.worldTexture.dispose(); this.icons.forEach(texture => texture.dispose()); this.rotatedIcons.forEach(texture => texture.dispose());
  }
}
