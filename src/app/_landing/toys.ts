import Matter from "matter-js";
import { drawTag, loadSprite, paintSprite, type Sprite, type SpriteKey, type TagLook } from "./sprites";

const { Bodies, Body, Composite, Constraint, Engine, Sleeping } = Matter;

export type ToyLook = { tints: string[]; tag: TagLook };

type Thing = {
  el: HTMLDivElement;
  canvas: HTMLCanvasElement;
  body: Matter.Body;
  w: number;
  h: number;
  tint: number;
  sprite?: Sprite;
  rope?: Matter.Constraint;
  line?: SVGLineElement;
  ropeLength?: number;
  anchorX?: number;
};

const LABELS: Record<SpriteKey, string> = {
  reg: "Ingeschreven",
  shield: "Bewaking",
  label: "Je naam",
  bell: "Melding",
  lock: "Vastgelegd",
  stamp: "Depot",
  loupe: "Check",
  paper: "Rapport",
  page: "Dossier",
};
const SCALE: Partial<Record<SpriteKey, number>> = { label: 1.1, shield: 0.95, paper: 0.94, page: 1.06 };
const ROUND: SpriteKey[] = ["reg", "bell"];

/** Gedeelde basis: objecten met zwaartekracht die je kunt oppakken, gooien of aantikken. */
abstract class Toybox {
  protected engine: Matter.Engine;
  protected things: Thing[] = [];
  protected tag: Thing | null = null;
  protected w = 0;
  protected h = 0;
  protected built = false;
  protected disposed = false;
  private builtWidth = 0;
  private raf = 0;
  private last = 0;
  private running = false;
  private visible = false;
  private drag: { constraint: Matter.Constraint; thing: Thing } | null = null;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private resizeTimer = 0;

  constructor(
    protected host: HTMLElement,
    protected look: ToyLook,
    protected reduced: boolean,
    protected coarse: boolean,
    private sleeping: boolean,
  ) {
    this.engine = Engine.create({ gravity: { x: 0, y: 1.15, scale: 0.001 }, enableSleeping: sleeping });
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (!this.visible) return;
      if (!this.built) this.rebuild();
      else this.start();
    });
    this.io.observe(host);
    this.ro = new ResizeObserver(() => {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.onResize(), 180);
    });
    this.ro.observe(host);
  }

  protected abstract populate(): Promise<void>;
  protected abstract bounds(): void;
  protected tick(time: number) {
    void time;
  }
  protected afterBody(thing: Thing) {
    void thing;
  }

  protected size() {
    return Math.min(170, Math.max(84, this.host.clientWidth * 0.105));
  }

  private async rebuild() {
    this.built = true;
    for (const t of this.all()) {
      t.el.remove();
      t.line?.remove();
    }
    Composite.clear(this.engine.world, false);
    this.things = [];
    this.tag = null;
    this.w = this.host.clientWidth;
    this.h = this.host.clientHeight;
    this.builtWidth = this.w;
    this.bounds();
    await this.populate();
    if (this.disposed) return;
    if (this.reduced) for (let i = 0; i < 300; i++) Engine.update(this.engine, 16.67);
    this.host.dataset.ready = "1";
    this.render();
    this.start();
  }

  protected all() {
    return this.tag ? [...this.things, this.tag] : this.things;
  }

  protected async addSprite(key: SpriteKey, tint: number, x: number, y: number, base: number) {
    const sprite = await loadSprite(key).catch(() => null);
    if (!sprite || this.disposed) return null;
    const k = (base * (SCALE[key] ?? 1)) / Math.max(sprite.w, sprite.h);
    const w = sprite.w * k;
    const h = sprite.h * k;
    const el = document.createElement("div");
    el.className = "toy";
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    const canvas = document.createElement("canvas");
    const label = document.createElement("span");
    label.textContent = LABELS[key];
    el.append(canvas, label);
    this.host.append(el);
    paintSprite(canvas, sprite, this.look.tints[tint % this.look.tints.length]);
    const opts = { restitution: 0.36, friction: 0.55, frictionAir: 0.012, density: 0.0012 };
    const body = ROUND.includes(key)
      ? Bodies.circle(x, y, Math.min(w, h) * 0.43, opts)
      : Bodies.rectangle(x, y, w * 0.84, h * 0.84, { ...opts, chamfer: { radius: Math.min(w, h) * 0.16 } });
    Composite.add(this.engine.world, body);
    const thing: Thing = { el, canvas, body, w, h, tint, sprite };
    this.bind(thing);
    this.things.push(thing);
    return thing;
  }

  /** Het naamplaatje: de bedrijfsnaam als los object tussen de rest. */
  protected setTag(x: number, y: number, angle = 0, velocity?: Matter.Vector) {
    const el = this.tag?.el ?? document.createElement("div");
    const canvas = this.tag?.canvas ?? document.createElement("canvas");
    if (!this.tag) {
      el.className = "toy toy-tag";
      el.append(canvas);
      this.host.append(el);
    }
    const { w, h, r } = drawTag(canvas, this.look.tag, Math.max(22, this.size() * 0.3), this.w * 0.82);
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    if (this.tag) {
      Composite.remove(this.engine.world, this.tag.body);
      if (this.tag.rope) Composite.remove(this.engine.world, this.tag.rope);
    }
    const body = Bodies.rectangle(x, y, w, h, {
      chamfer: { radius: Math.max(2, Math.min(r, h / 2 - 1)) },
      restitution: 0.3,
      friction: 0.55,
      frictionAir: 0.012,
      density: 0.0014,
    });
    Composite.add(this.engine.world, body);
    if (this.tag) {
      this.tag.body = body;
      this.tag.w = w;
      this.tag.h = h;
    } else {
      this.tag = { el, canvas, body, w, h, tint: 0 };
      this.bind(this.tag);
    }
    this.afterBody(this.tag);
    Body.setAngle(body, angle);
    if (velocity) Body.setVelocity(body, velocity);
    return this.tag;
  }

  private bind(thing: Thing) {
    const el = thing.el;
    const local = (e: PointerEvent) => {
      const r = this.host.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    el.addEventListener("pointerdown", (e) => {
      if (this.reduced) return;
      Sleeping.set(thing.body, false);
      if (e.pointerType === "touch" || this.coarse) {
        // Op een aanraakscherm blijft scrollen vrij: een tik geeft het object een zet.
        Body.setVelocity(thing.body, { x: (Math.random() - 0.5) * 12, y: -12 - Math.random() * 5 });
        Body.setAngularVelocity(thing.body, (Math.random() - 0.5) * 0.4);
        this.start();
        return;
      }
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const p = local(e);
      const constraint = Constraint.create({
        pointA: p,
        bodyB: thing.body,
        pointB: { x: p.x - thing.body.position.x, y: p.y - thing.body.position.y },
        stiffness: 0.16,
        damping: 0.12,
        length: 0,
      });
      Composite.add(this.engine.world, constraint);
      this.drag = { constraint, thing };
      el.dataset.drag = "1";
      this.start();
    });
    el.addEventListener("pointermove", (e) => {
      if (this.drag?.thing === thing) this.drag.constraint.pointA = local(e);
    });
    const release = () => {
      if (this.drag?.thing !== thing) return;
      Composite.remove(this.engine.world, this.drag.constraint);
      this.drag = null;
      delete el.dataset.drag;
    };
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
  }

  setLook(look: ToyLook) {
    const prev = this.look;
    this.look = look;
    if (!this.built) return;
    if (prev.tints.join() !== look.tints.join()) {
      for (const t of this.things) {
        if (t.sprite) paintSprite(t.canvas, t.sprite, look.tints[t.tint % look.tints.length]);
        if (!this.reduced) {
          Sleeping.set(t.body, false);
          Body.setVelocity(t.body, { x: (Math.random() - 0.5) * 8, y: -6 - Math.random() * 6 });
          Body.setAngularVelocity(t.body, (Math.random() - 0.5) * 0.25);
        }
      }
    }
    if (this.tag && JSON.stringify(prev.tag) !== JSON.stringify(look.tag)) {
      const b = this.tag.body;
      this.setTag(b.position.x, b.position.y, b.angle, this.reduced ? undefined : { x: b.velocity.x, y: -5 });
    }
    this.render();
    this.start();
  }

  private onResize() {
    if (this.disposed || !this.built) return;
    const w = this.host.clientWidth;
    if (Math.abs(w - this.builtWidth) / Math.max(this.builtWidth, 1) > 0.05) {
      this.rebuild();
      return;
    }
    this.w = w;
    this.h = this.host.clientHeight;
    this.bounds();
    this.start();
  }

  private start() {
    if (this.running || this.disposed || !this.visible || !this.built) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  protected render() {
    for (const t of this.all()) {
      const { position: p, angle } = t.body;
      t.el.style.transform = `translate3d(${p.x - t.w / 2}px,${p.y - t.h / 2}px,0) rotate(${angle}rad)`;
      if (t.rope && t.line) {
        const a = Constraint.pointAWorld(t.rope);
        const b = Constraint.pointBWorld(t.rope);
        t.line.setAttribute("x1", `${a.x}`);
        t.line.setAttribute("y1", `${a.y}`);
        t.line.setAttribute("x2", `${b.x}`);
        t.line.setAttribute("y2", `${b.y}`);
      }
    }
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    if (!this.visible || document.hidden) {
      this.running = false;
      return;
    }
    // De eerste frame geeft alleen een begintijd: een tijdstap van nul of minder zet alles in slaap.
    const dt = this.last ? Math.min(34, now - this.last) : 0;
    this.last = now;
    if (dt <= 0) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    if (!this.reduced) {
      this.tick(now / 1000);
      const steps = dt > 17 ? 2 : 1;
      for (let i = 0; i < steps; i++) Engine.update(this.engine, dt / steps);
      for (const t of this.all()) {
        const p = t.body.position;
        if (!t.rope && (p.y > this.h + 400 || p.x < -500 || p.x > this.w + 500)) {
          Body.setPosition(t.body, { x: this.w * (0.2 + Math.random() * 0.6), y: -200 });
          Body.setVelocity(t.body, { x: 0, y: 0 });
        }
      }
    }
    this.render();
    if (!this.drag && (this.reduced || (this.sleeping && this.all().every((t) => t.body.isSleeping)))) {
      this.running = false;
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.resizeTimer);
    this.io.disconnect();
    this.ro.disconnect();
    for (const t of this.all()) {
      t.el.remove();
      t.line?.remove();
    }
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }
}

/** Objecten die aan draden boven de kop hangen en meedeinen. */
export class Hang extends Toybox {
  private svg: SVGSVGElement;

  constructor(host: HTMLElement, look: ToyLook, reduced: boolean, coarse: boolean) {
    super(host, look, reduced, coarse, false);
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("class", "toy-ropes");
    host.append(this.svg);
  }

  protected bounds() {}

  protected async populate() {
    const narrow = this.w < 700;
    const k = narrow ? 1 : Math.min(1.12, Math.max(0.62, this.w / 1440));
    const base = narrow ? 84 : this.size();
    const slots: { key: SpriteKey | "tag"; x: number; len: number }[] = narrow
      ? [
          { key: "label", x: -132, len: 96 },
          { key: "shield", x: -52, len: 172 },
          { key: "tag", x: 36, len: 246 },
          { key: "lock", x: 130, len: 108 },
        ]
      : [
          { key: "reg", x: -470, len: 96 },
          { key: "label", x: -290, len: 152 },
          { key: "shield", x: -112, len: 84 },
          { key: "tag", x: 72, len: 236 },
          { key: "bell", x: 262, len: 92 },
          { key: "lock", x: 448, len: 150 },
        ];
    let tint = 0;
    for (const [i, slot] of slots.entries()) {
      const ax = this.w / 2 + slot.x * k;
      const len = slot.len * k;
      const swing = this.reduced ? 0 : (((i * 0.61 + 0.2) % 1) - 0.5) * 0.9;
      const x = ax + Math.sin(swing) * (len + base * 0.4);
      const y = Math.cos(swing) * (len + base * 0.4);
      const thing = slot.key === "tag" ? null : await this.addSprite(slot.key, tint++, x, y, base);
      if (this.disposed) return;
      if (slot.key === "tag") {
        const t = this.setTag(x, y);
        t.anchorX = ax;
        t.ropeLength = len;
        this.afterBody(t);
      } else if (thing) {
        thing.anchorX = ax;
        thing.ropeLength = len;
        this.afterBody(thing);
      }
    }
  }

  protected afterBody(thing: Thing) {
    if (thing.anchorX === undefined || thing.ropeLength === undefined) return;
    if (thing.rope) Composite.remove(this.engine.world, thing.rope);
    thing.rope = Constraint.create({
      pointA: { x: thing.anchorX, y: -6 },
      bodyB: thing.body,
      pointB: { x: 0, y: -thing.h * (thing === this.tag ? 0.5 : 0.4) },
      length: thing.ropeLength,
      stiffness: 0.9,
      damping: 0.03,
    });
    Composite.add(this.engine.world, thing.rope);
    if (!thing.line) {
      thing.line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      this.svg.append(thing.line);
    }
  }

  protected tick(time: number) {
    // Een beetje wind, zodat het geheel blijft deinen.
    this.all().forEach((t, i) => {
      Body.applyForce(t.body, t.body.position, { x: Math.sin(time * 0.9 + i * 1.7) * t.body.mass * 0.000035, y: 0 });
    });
  }

  dispose() {
    super.dispose();
    this.svg.remove();
  }
}

/** Een stapel objecten die naar beneden valt zodra hij in beeld komt. */
export class Pile extends Toybox {
  private walls: Matter.Body[] = [];

  constructor(host: HTMLElement, look: ToyLook, reduced: boolean, coarse: boolean) {
    super(host, look, reduced, coarse, true);
  }

  protected bounds() {
    Composite.remove(this.engine.world, this.walls);
    const t = 400;
    const opts = { isStatic: true, friction: 0.6 };
    this.walls = [
      Bodies.rectangle(this.w / 2, this.h + t / 2, this.w * 3, t, opts),
      Bodies.rectangle(-t / 2, this.h / 2 - 2000, t, this.h + 6000, opts),
      Bodies.rectangle(this.w + t / 2, this.h / 2 - 2000, t, this.h + 6000, opts),
    ];
    Composite.add(this.engine.world, this.walls);
  }

  protected async populate() {
    const base = this.size();
    const keys: SpriteKey[] =
      this.w < 560 ? ["reg", "label", "lock", "stamp", "bell", "paper", "shield"] : ["reg", "label", "lock", "stamp", "bell", "loupe", "paper", "shield", "page"];
    for (const [i, key] of keys.entries()) {
      const slot = (i + 0.5) / keys.length;
      const x = this.reduced ? this.w * (0.06 + slot * 0.88) : this.w * (0.1 + ((i * 0.37 + 0.13) % 1) * 0.8);
      const y = this.reduced ? this.h - base : -base - i * base * 0.85;
      const thing = await this.addSprite(key, i, x, y, base);
      if (this.disposed) return;
      if (thing && !this.reduced) {
        Body.setAngle(thing.body, (((i * 0.61) % 1) - 0.5) * 1.6);
        Body.setAngularVelocity(thing.body, (((i * 0.43) % 1) - 0.5) * 0.12);
      }
    }
    this.setTag(this.w * 0.5, this.reduced ? this.h - base * 2 : -base * 9, 0.08);
  }
}
