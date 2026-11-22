// PixiJS 繪圖層：只負責畫，不做模擬。位置、狀態都由 DualView 每一幀傳進來。
// 小人用 character.ts 的 SVG 烘成 texture；主題改變時重新烘。
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { renderCharacter, renderNode, type CharacterParams, type State } from '../../lib/sprites/character';
import type { Point } from '../../lib/sim/campus';
import { readTheme, resolveVars, type ThemeColors } from '../../lib/ui/theme';

/** 烘焙解析度倍數：texture 以 3 倍大小繪製再縮小，縮放時仍清楚。 */
const BAKE = 3;
const BODY_H = 36, BODY_W = 24;

export interface FrameTie { a: number; b: number; weight: number; /** 0..1，新連結長出來的進度 */ grow: number }

export interface Frame {
  campus: Point[];
  net: Point[];
  /** 0 = 校園視圖，1 = 網路視圖（中間值是變形動畫） */
  viewT: number;
  walking: boolean[];
  states: State[];
  ties: FrameTie[];
  showEdges: boolean;
  selected: number | null;
  highlightNodes: ReadonlySet<number>;
  highlightEdges: ReadonlySet<string>;
  /** 正在說話的人 → 對話框已經出現幾秒 */
  talking: ReadonlyMap<number, number>;
  /** 網路視圖的節點直徑（螢幕 px） */
  nodeSize: number[];
  now: number;
  reducedMotion: boolean;
}

interface Agent {
  root: Container;
  body: Sprite;
  node: Sprite;
  glow: Graphics;
  bubble: Graphics;
  /** 對話框裡的三個點 */
  dots: Graphics[];
  look: CharacterParams;
  state: State;
  phase: number;
}

const lookKey = (p: CharacterParams) => `${p.skin}${p.hair}${p.hairColor}${p.college}${p.accessory}${p.year}`;

async function svgToTexture(svg: string): Promise<Texture> {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  return Texture.from(img);
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const hex = (c: string) => c;

export class CampusScene {
  app = new Application();
  private world = new Container();
  private edges = new Graphics();
  private layer = new Container();
  private agents: Agent[] = [];
  private textures = new Map<string, Promise<Texture>>();
  private colors: ThemeColors = {};
  /** 每公尺（世界單位）幾個螢幕 px */
  fit = 1;
  /** 使用者縮放、平移（螢幕 px） */
  view = { x: 0, y: 0, k: 1 };
  /** 手機上小人縮到 0.8 倍 */
  spriteScale = 1;
  private lastScreen: Point[] = [];
  private looks: CharacterParams[] = [];

  async init(host: HTMLElement, looks: CharacterParams[], width: number, height: number): Promise<void> {
    await this.app.init({
      width, height, backgroundAlpha: 0, antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
      preference: 'webgl',
    });
    this.app.ticker.stop(); // 由 DualView 的 requestAnimationFrame 驅動
    this.app.stage.eventMode = 'none';
    this.app.canvas.setAttribute('aria-hidden', 'true');
    this.app.canvas.style.position = 'absolute';
    this.app.canvas.style.inset = '0';
    host.appendChild(this.app.canvas);
    this.world.addChild(this.edges, this.layer);
    this.app.stage.addChild(this.world);
    this.looks = looks;
    this.colors = readTheme();
    for (const look of looks) {
      const root = new Container();
      const glow = new Graphics();
      const body = new Sprite(Texture.EMPTY);
      const node = new Sprite(Texture.EMPTY);
      const bubble = new Graphics();
      body.anchor.set(0.5, 1);
      node.anchor.set(0.5);
      root.addChild(glow, body, node, bubble);
      this.layer.addChild(root);
      this.agents.push({ root, body, node, glow, bubble, look, state: 'idle', phase: this.agents.length * 2.39996, dots: [] });
    }
    await this.bakeAll();
  }

  private texture(svg: string): Promise<Texture> {
    const key = svg;
    let t = this.textures.get(key);
    if (!t) { t = svgToTexture(svg); this.textures.set(key, t); }
    return t;
  }

  private bodySvg(look: CharacterParams, state: State) {
    return resolveVars(renderCharacter(look, state === 'selected' ? 'idle' : state, { size: BODY_H * BAKE }), this.colors);
  }

  private nodeSvg(look: CharacterParams) {
    return resolveVars(renderNode(look, 28 * BAKE), this.colors);
  }

  /** 重新烘所有 texture（初始化、主題改變時）。 */
  async bakeAll(): Promise<void> {
    this.colors = readTheme();
    for (const old of this.textures.values()) old.then((t) => t.destroy(true)).catch(() => {});
    this.textures.clear();
    await Promise.all(this.agents.map(async (a) => {
      const [b, n] = await Promise.all([this.texture(this.bodySvg(a.look, a.state)), this.texture(this.nodeSvg(a.look))]);
      a.body.texture = b; a.node.texture = n;
    }));
    this.drawBubbles();
  }

  private setState(i: number, state: State) {
    const a = this.agents[i];
    if (a.state === state) return;
    a.state = state;
    this.texture(this.bodySvg(a.look, state)).then((t) => { if (a.state === state) a.body.texture = t; });
  }

  private drawBubbles() {
    for (const a of this.agents) {
      a.bubble.clear();
      a.bubble.roundRect(-11, -9, 22, 13, 6).fill({ color: hex(this.colors['--panel']) }).stroke({ width: 1, color: hex(this.colors['--line']) });
      a.bubble.moveTo(-2, 4).lineTo(0, 8).lineTo(3, 4).fill({ color: hex(this.colors['--panel']) });
      for (const d of a.dots) d.destroy();
      a.dots = [-5, 0, 5].map((x) => {
        const d = new Graphics().circle(x, -2.5, 1.6).fill({ color: hex(this.colors['--ink']) });
        a.bubble.addChild(d);
        return d;
      });
    }
  }

  resize(width: number, height: number, worldWidth: number): void {
    this.app.renderer.resize(width, height);
    this.fit = width / worldWidth;
  }

  /** 螢幕座標 → 世界座標 */
  toWorld(sx: number, sy: number): Point {
    const s = this.fit * this.view.k;
    return { x: (sx - this.view.x) / s, y: (sy - this.view.y) / s };
  }

  /** 找出螢幕座標附近的人；沒有就回傳 null。 */
  hitTest(sx: number, sy: number, radius = 18): number | null {
    let best: number | null = null, bestD = radius * radius;
    this.lastScreen.forEach((p, i) => {
      const d = (p.x - sx) ** 2 + (p.y - sy) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /** 某人在螢幕上的位置（給資料卡定位）。 */
  screenPos(i: number): Point | null {
    return this.lastScreen[i] ?? null;
  }

  render(f: Frame): void {
    const c = this.colors;
    const s = this.fit * this.view.k;
    this.world.position.set(this.view.x, this.view.y);
    this.world.scale.set(s);
    const e = f.reducedMotion ? Math.round(f.viewT) : easeInOut(f.viewT);
    const inv = 1 / this.fit; // 讓小人在螢幕上維持固定大小（不受容器寬度影響，但會跟著使用者縮放）
    const pos: Point[] = f.campus.map((p, i) => ({ x: p.x + (f.net[i].x - p.x) * e, y: p.y + (f.net[i].y - p.y) * e }));

    // 連結
    const g = this.edges;
    g.clear();
    if (f.showEdges || e > 0) {
      const maxW = Math.max(1, ...f.ties.map((t) => t.weight));
      const buckets: [number, number, FrameTie[]][] = [[0.7, 0.35, []], [1.4, 0.5, []], [2.4, 0.65, []]];
      const growing: FrameTie[] = [], hot: FrameTie[] = [];
      for (const t of f.ties) {
        if (f.highlightEdges.has(t.a < t.b ? `${t.a}-${t.b}` : `${t.b}-${t.a}`)) { hot.push(t); continue; }
        if (t.grow < 1) { growing.push(t); continue; }
        // 線的粗細 = 累積相處時間（兩個視圖都一樣）
        const r = Math.sqrt(t.weight / maxW);
        buckets[r > 0.66 ? 2 : r > 0.33 ? 1 : 0][2].push(t);
      }
      const alphaScale = f.showEdges ? 1 : e;
      for (const [w, alpha, list] of buckets) {
        if (!list.length) continue;
        for (const t of list) g.moveTo(pos[t.a].x, pos[t.a].y).lineTo(pos[t.b].x, pos[t.b].y);
        g.stroke({ width: w * inv, color: c['--accent'], alpha: alpha * alphaScale });
      }
      for (const t of growing) {
        const a = pos[t.a], b = pos[t.b];
        const mid = { x: a.x + (b.x - a.x) * t.grow, y: a.y + (b.y - a.y) * t.grow };
        g.moveTo(a.x, a.y).lineTo(mid.x, mid.y).stroke({ width: 1.6 * inv, color: c['--accent'], alpha: 0.9 * Math.max(alphaScale, 0.6) });
      }
      if (hot.length) {
        for (const t of hot) g.moveTo(pos[t.a].x, pos[t.a].y).lineTo(pos[t.b].x, pos[t.b].y);
        g.stroke({ width: 2.4 * inv, color: c['--signal'], alpha: 0.95 });
      }
    }

    // 小人
    const screen: Point[] = [];
    this.agents.forEach((a, i) => {
      this.setState(i, f.states[i]);
      const p = pos[i];
      let y = p.y, rot = 0;
      if (!f.reducedMotion && e < 1) {
        if (f.walking[i]) rot = ((Math.floor(f.now / 180) + i) % 2 ? 1 : -1) * (3 * Math.PI) / 180;
        else y += Math.sin(a.phase + (f.now / 2400) * Math.PI * 2) * inv;
      }
      a.root.position.set(p.x, y);
      const bodyH = BODY_H * this.spriteScale * inv;
      a.body.height = bodyH; a.body.width = (bodyH * BODY_W) / BODY_H;
      a.body.rotation = rot;
      a.body.alpha = (1 - e) * (f.states[i] === 'removed' ? 0.6 : 1);
      // 網路視圖：頭部放大成節點（節點中心對齊腳下位置）
      const nd = (f.nodeSize[i] ?? 12) * inv;
      const fromD = 14 * this.spriteScale * inv;
      const d = fromD + (nd - fromD) * e;
      a.node.width = a.node.height = d;
      a.node.position.set(0, -(bodyH - fromD / 2 - 2 * inv) * (1 - e));
      a.node.alpha = e;
      a.node.visible = e > 0;
      a.body.visible = e < 1;
      // 選取光暈與高亮
      a.glow.clear();
      const ring = f.selected === i || f.highlightNodes.has(i);
      if (ring) {
        const breathe = f.reducedMotion ? 0.8 : 0.55 + 0.35 * Math.sin((f.now / 1200) * Math.PI * 2);
        const color = f.selected === i ? c['--accent'] : c['--signal'];
        const cy = -(bodyH / 2) * (1 - e);
        const r = (e > 0.5 ? d / 2 + 3 * inv : bodyH * 0.55);
        a.glow.circle(0, cy, r).stroke({ width: 2 * inv, color, alpha: breathe });
      }
      // 對話框
      const age = f.talking.get(i);
      a.bubble.visible = age !== undefined && e < 0.5;
      if (a.bubble.visible) {
        a.bubble.position.set(0, -bodyH - 8 * inv);
        a.bubble.scale.set(inv * this.spriteScale);
        a.bubble.alpha = f.reducedMotion ? 1 : Math.min(1, age! * 4, (1.6 - age!) * 4);
        // 三個點依序變亮
        const lit = f.reducedMotion ? -1 : Math.floor(f.now / 250) % 3;
        a.dots.forEach((d, k) => { d.alpha = lit < 0 || k === lit ? 0.9 : 0.3; });
      }
      screen.push({ x: this.view.x + p.x * s, y: this.view.y + (p.y - (bodyH / 2) * (1 - e)) * s });
    });
    this.lastScreen = screen;
    this.app.renderer.render(this.app.stage);
  }

  destroy(): void {
    for (const t of this.textures.values()) t.then((x) => x.destroy(true)).catch(() => {});
    this.app.destroy(true, { children: true });
  }
}
