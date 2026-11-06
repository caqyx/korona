/**
 * „Soczystość”: cząsteczki (piksele), drżenie ekranu, hit-stop, błyski trafień, liczby obrażeń,
 * smugi dashu, cięcia broni, kill feed. Czysto wizualne — nie wpływa na symulację.
 */
export function createFx() {
  return {
    /** @type {{x:number,y:number,vx:number,vy:number,life:number,max:number,color:string,size:number,g:number}[]} */
    parts: [],
    /** liczby obrażeń/napisy w świecie @type {{x:number,y:number,text:string,life:number,max:number,color:string,big:boolean}[]} */
    texts: [],
    /** @type {{pts:number[][],life:number}[]} */
    bolts: [],
    /** cięcia broni @type {{x:number,y:number,a:number,range:number,arc:number,life:number,color:string}[]} */
    swings: [],
    /** fale/kręgi @type {{x:number,y:number,r:number,max:number,life:number,total:number,color:string}[]} */
    rings: [],
    /** błyski trafień per id (sekundy) */
    flash: /** @type {Record<string, number>} */ ({}),
    /** smugi dashu */
    ghosts: /** @type {{id:string,x:number,y:number,life:number}[]} */ ([]),
    /** kill feed @type {{text:string,color:string,life:number}[]} */
    feed: [],
    shake: 0,
    hitStop: 0,
    redFlash: 0,
    banner: /** @type {null|{text:string,sub:string,life:number}} */ (null),
  };
}

/** @param {ReturnType<typeof createFx>} fx */
export function burst(fx, x, y, color, n = 10, speed = 6, size = 1, gravity = 0) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random());
    const life = 0.3 + Math.random() * 0.35;
    fx.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size, g: gravity });
  }
  if (fx.parts.length > 700) fx.parts.splice(0, fx.parts.length - 700);
}

function addText(fx, x, y, text, color, big = false) {
  fx.texts.push({ x: x + (Math.random() - 0.5) * 0.6, y, text, life: big ? 1.3 : 0.8, max: big ? 1.3 : 0.8, color, big });
  if (fx.texts.length > 60) fx.texts.shift();
}

function addFeed(fx, text, color) {
  fx.feed.unshift({ text, color, life: 5 });
  if (fx.feed.length > 5) fx.feed.length = 5;
}

/**
 * Zamienia zdarzenia symulacji na efekty, dźwięk i haptykę.
 * @param {ReturnType<typeof createFx>} fx @param {any[]} events @param {any} state @param {string|null} meId
 * @param {(id:string)=>string} colorOf
 * @param {{sound?:(name:string)=>void, vibrate?:(p:number|number[])=>void}} [out]
 */
export function applyEvents(fx, events, state, meId, colorOf, out = {}) {
  const sound = out.sound || (() => {});
  const vib = out.vibrate || (() => {});
  const nick = (id) => state.players.find((p) => p.id === id)?.nick ?? '?';
  for (const e of events) {
    switch (e.t) {
      case 'bossHit':
        burst(fx, e.x + (Math.random() - 0.5), e.y - 0.6 + (Math.random() - 0.5), colorOf(e.by), 5, 6);
        fx.flash[e.id] = 0.08;
        addText(fx, e.x, e.y - 1.8, String(Math.round(e.dmg)), e.dmg >= 20 ? '#ffd23f' : '#ffffff', e.dmg >= 20);
        if (e.by === meId) {
          fx.hitStop = Math.max(fx.hitStop, e.dmg >= 20 ? 0.07 : 0.035);
          sound('hit');
        }
        break;
      case 'heroHit':
        burst(fx, e.x, e.y, '#ff5470', 10, 7);
        fx.flash[e.id] = 0.18;
        fx.shake = Math.min(3, fx.shake + 1.2);
        if (e.id === meId) {
          fx.redFlash = 0.3;
          vib(45);
          const me = state.players.find((p) => p.id === meId);
          sound(me && me.hp <= 1 ? 'lowhp' : 'hurt');
        } else sound('hurt');
        break;
      case 'heroDie':
        burst(fx, e.x, e.y, colorOf(e.id), 26, 9, 2);
        burst(fx, e.x, e.y, '#ffffff', 10, 4);
        fx.shake = Math.min(4, fx.shake + 2);
        if (e.by) addFeed(fx, `${nick(e.by)} ☠ ${nick(e.id)}`, '#ff8fa3');
        if (e.id === meId) vib([60, 40, 90]);
        sound('die');
        break;
      case 'zoneFire':
        burst(fx, e.x, e.y, '#ff5470', 8, 6);
        burst(fx, e.x, e.y, '#ffb347', 6, 3);
        fx.rings.push({ x: e.x, y: e.y, r: 0, max: Math.max(1, e.r), life: 0.25, total: 0.25, color: '#ffd0d8' });
        fx.shake = Math.min(3, fx.shake + 0.8);
        sound('boom');
        break;
      case 'block':
      case 'reflect':
        burst(fx, e.x, e.y, '#9be7ff', 10, 6);
        addText(fx, e.x, e.y - 1, e.t === 'block' ? 'BLOK' : 'ODBICIE', '#9be7ff');
        sound('block');
        break;
      case 'dash':
        fx.ghosts.push({ id: e.id, x: e.x, y: e.y, life: 0.2 });
        burst(fx, e.x, e.y + 0.3, '#8f9bff', 5, 2);
        sound('dash');
        break;
      case 'swing':
        fx.swings.push({ x: e.x, y: e.y, a: e.a, range: e.range, arc: (e.arc * Math.PI) / 180, life: 0.14, color: colorOf(e.id) });
        sound('swing');
        break;
      case 'ability':
        if (e.skin === 'kaplan') {
          fx.rings.push({ x: e.x, y: e.y, r: 0, max: e.r, life: 0.5, total: 0.5, color: '#ffe066' });
          burst(fx, e.x, e.y, '#ffe066', 22, 4);
          sound('heal');
        } else if (e.skin === 'inzynier') sound('turret');
        else if (e.skin === 'lotrzyk') {
          burst(fx, e.fromX, e.fromY, '#c77dff', 14, 4);
          burst(fx, e.x, e.y, '#c77dff', 14, 4);
          sound('blink');
        } else sound('ability');
        break;
      case 'charge':
        sound('ability');
        break;
      case 'blink':
        burst(fx, e.fromX, e.fromY, '#b14dff', 16, 5);
        burst(fx, e.x, e.y, '#b14dff', 16, 5);
        sound('blink');
        break;
      case 'bossCast': {
        const me = state.players.find((p) => p.id === meId);
        if (e.ab !== 'atk') sound(me && !me.boss ? 'warn' : 'cast');
        break;
      }
      case 'chain':
        fx.bolts.push({ pts: e.pts, life: 0.35 });
        sound('zap');
        break;
      case 'crownTaken':
        fx.shake = 3;
        addFeed(fx, `♛ ${nick(e.id)} przejmuje koronę`, '#ffd23f');
        sound('crown');
        break;
      case 'lastHit':
        addFeed(fx, `${nick(e.id)} — ostatni cios +10`, '#ffd23f');
        if (e.id === meId) vib([30, 30, 60]);
        sound('lastHit');
        break;
      case 'assist':
        addFeed(fx, `${nick(e.id)} — asysta +2`, '#9be7ff');
        break;
      case 'minionDie':
        burst(fx, e.x, e.y, '#e8e8e8', 10, 4);
        break;
      case 'respawn':
        burst(fx, e.x, e.y, '#ffffff', 14, 3);
        if (e.id === meId) sound('respawn');
        break;
      case 'crownDrop':
        addFeed(fx, 'Korona upadła na środek!', '#ffd23f');
        break;
      case 'leave':
        addFeed(fx, `${nick(e.id)} opuścił mecz`, '#888');
        break;
      case 'matchEnd':
        sound('win');
        break;
      case 'go':
        sound('go');
        break;
      case 'wave':
        addFeed(fx, e.boss ? `Fala ${e.n} — BOSS!` : `Fala ${e.n}`, e.boss ? '#ff5470' : '#ffd23f');
        sound(e.boss ? 'roar' : 'countdown');
        break;
      case 'waveClear':
        addFeed(fx, `Fala ${e.n} przetrwana!`, '#5ce07a');
        sound('reveal');
        break;
      case 'bossStage':
        addFeed(fx, `Boss ${e.n}/${e.total}`, '#ff5470');
        sound('roar');
        break;
      case 'bossDie':
        burst(fx, e.x, e.y, '#ffffff', 40, 10, 2);
        burst(fx, e.x, e.y, '#ffd23f', 30, 7, 2);
        fx.shake = 4;
        sound('bossDie');
        break;
      case 'upgrade':
      case 'upgradeAuto':
        sound('pickup');
        break;
      case 'burn':
        burst(fx, e.x, e.y, '#ff8a3d', 8, 3);
        break;
      case 'minionHit':
        addText(fx, e.x, e.y - 1, String(e.dmg), '#ffffff');
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
    p.vy += p.g * dt;
    p.vx *= 0.9;
    p.vy *= 0.9;
    p.life -= dt;
  }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  for (const t of fx.texts) {
    t.life -= dt;
    t.y -= dt * 1.2;
  }
  fx.texts = fx.texts.filter((t) => t.life > 0);
  for (const arr of [fx.bolts, fx.swings, fx.ghosts, fx.rings, fx.feed]) for (const b of arr) b.life -= dt;
  fx.bolts = fx.bolts.filter((b) => b.life > 0);
  fx.swings = fx.swings.filter((b) => b.life > 0);
  fx.ghosts = fx.ghosts.filter((b) => b.life > 0);
  fx.rings = fx.rings.filter((b) => b.life > 0);
  fx.feed = fx.feed.filter((b) => b.life > 0);
  for (const k of Object.keys(fx.flash)) {
    fx.flash[k] -= dt;
    if (fx.flash[k] <= 0) delete fx.flash[k];
  }
  fx.shake = Math.max(0, fx.shake - dt * 10);
  fx.hitStop = Math.max(0, fx.hitStop - dt);
  fx.redFlash = Math.max(0, fx.redFlash - dt);
  if (fx.banner) {
    fx.banner.life -= dt;
    if (fx.banner.life <= 0) fx.banner = null;
  }
}
