/**
 * „Soczystość”: cząsteczki, drżenie ekranu, hit-stop, napisy. Czysto wizualne —
 * nie wpływa na symulację. Zasilane zdarzeniami ze state.events.
 */
export function createFx() {
  return {
    /** @type {{x:number,y:number,vx:number,vy:number,life:number,max:number,color:string,size:number}[]} */
    parts: [],
    /** @type {{x:number,y:number,text:string,life:number,color:string}[]} */
    texts: [],
    /** @type {{pts:number[][],life:number}[]} */
    bolts: [],
    shake: 0,
    hitStop: 0,
    flash: 0,
    banner: /** @type {null|{text:string,sub:string,life:number}} */ (null),
  };
}

/** @param {ReturnType<typeof createFx>} fx */
export function burst(fx, x, y, color, n = 10, speed = 6, size = 0.12) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random());
    fx.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, max: 0.5, color, size });
  }
  if (fx.parts.length > 600) fx.parts.splice(0, fx.parts.length - 600);
}

/**
 * Zamienia zdarzenia symulacji na efekty.
 * @param {ReturnType<typeof createFx>} fx @param {any[]} events @param {any} state @param {string|null} meId
 * @param {(id:string)=>string} colorOf @param {(name:string)=>void} [sound]
 */
export function applyEvents(fx, events, state, meId, colorOf, sound = () => {}) {
  for (const e of events) {
    switch (e.t) {
      case 'bossHit':
        burst(fx, e.x, e.y, colorOf(e.by), 4, 5);
        if (e.by === meId) fx.hitStop = Math.max(fx.hitStop, 0.05);
        sound('hit');
        break;
      case 'heroHit':
        burst(fx, e.x, e.y, '#ffffff', 10, 7);
        fx.shake = Math.min(1.2, fx.shake + 0.45);
        if (e.id === meId) fx.flash = 0.25;
        sound('hurt');
        break;
      case 'heroDie':
        burst(fx, e.x, e.y, colorOf(e.id), 28, 9, 0.16);
        fx.shake = Math.min(1.5, fx.shake + 0.6);
        sound('die');
        break;
      case 'zoneFire':
        burst(fx, e.x, e.y, '#ff5470', 8, 5);
        fx.shake = Math.min(1.2, fx.shake + 0.3);
        sound('boom');
        break;
      case 'block':
      case 'reflect':
        burst(fx, e.x, e.y, '#9be7ff', 8, 6);
        sound('block');
        break;
      case 'dash':
        sound('dash');
        break;
      case 'swing':
        if (e.hit) sound('swing');
        break;
      case 'ability':
        if (e.skin === 'kaplan') burst(fx, e.x, e.y, '#ffe066', 24, 4);
        sound('ability');
        break;
      case 'bossCast':
        if (e.ab !== 'atk') sound('cast');
        break;
      case 'chain':
        fx.bolts.push({ pts: e.pts, life: 0.35 });
        sound('zap');
        break;
      case 'crownTaken': {
        const p = state.players.find((x) => x.id === e.id);
        fx.banner = { text: (p ? p.nick : '?') + ' przejmuje koronę', sub: '', life: 1.6 };
        fx.shake = 1.5;
        sound('crown');
        break;
      }
      case 'lastHit':
        fx.texts.push({ x: 0, y: 0, text: '+10', life: 1.2, color: '#ffd23f' });
        break;
      case 'minionDie':
        burst(fx, e.x, e.y, '#e8e8e8', 10, 4);
        break;
      case 'matchEnd':
        sound('win');
        break;
      case 'go':
        sound('go');
        break;
      default:
        break;
    }
  }
}

/** @param {ReturnType<typeof createFx>} fx @param {number} dt */
export function updateFx(fx, dt) {
  for (const p of fx.parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
  }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  for (const t of fx.texts) t.life -= dt;
  fx.texts = fx.texts.filter((t) => t.life > 0);
  for (const b of fx.bolts) b.life -= dt;
  fx.bolts = fx.bolts.filter((b) => b.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 3);
  fx.hitStop = Math.max(0, fx.hitStop - dt);
  fx.flash = Math.max(0, fx.flash - dt);
  if (fx.banner) {
    fx.banner.life -= dt;
    if (fx.banner.life <= 0) fx.banner = null;
  }
}
