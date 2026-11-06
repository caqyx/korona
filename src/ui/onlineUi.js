/**
 * UI trybu online: start → lobby → mecz → podsumowanie. Wybór transportu:
 * Supabase (jeśli są klucze w .env) albo LocalTransport (BroadcastChannel) — `?transport=local` wymusza lokalny.
 */
import { $, esc, showScreen, setOverlay } from './dom.js';
import { showSummary } from './summary.js';
import { SKINS, SKIN_IDS } from '../sim/config.js';
import { slotColor } from '../render/palette.js';
import { createLocalTransport, createSupabaseTransport } from '../net/transport.js';
import { getSupabase, hasSupabaseConfig, signInAnon, createRoomsApi, isValidRoomCode } from '../net/supabase.js';
import { createSession } from '../net/session.js';
import { iceServersFromEnv } from '../net/signaling.js';
import { measureDevice } from '../net/election.js';
import { openDirectory } from '../net/directory.js';
import { getProfile, getActiveLook } from './profile.js';
import { step } from '../sim/step.js';
import { createBenchmarkState } from '../sim/benchmark.js';
import { createKeyboardMouse } from '../input/keyboard.js';
import { createBotDevice } from '../input/bot.js';
import { isTouchDevice } from '../input/touch.js';
import { keepAwake } from './pwa.js';
import { SKIN_TEXT } from './codex.js';
import { heroPreview, mount } from './previews.js';

/** @param {{gameView:any, nickInput:HTMLInputElement, touchRoot:HTMLElement, getTouch:()=>any, params:URLSearchParams, backToMenu:()=>void}} ctx */
export function startOnlineUi(ctx) {
  const { params } = ctx;
  const useSupabase = hasSupabaseConfig() && params.get('transport') !== 'local';
  /** @type {ReturnType<typeof createSession>|null} */
  let session = null;
  let device = null;
  let skin = params.get('skin') && SKIN_IDS.includes(/** @type {any} */ (params.get('skin'))) ? params.get('skin') : 'rycerz';
  let busy = false;

  const msg = (t) => ($('#start-msg').textContent = t);

  /** Katalog pokoi (ogłaszanie własnego pokoju na liście Multiplayer). */
  let directory = /** @type {import('../net/directory.js').Directory|null} */ (null);
  let roomCode = '';
  const announce = (info) => {
    if (!directory || !info?.isOwner) return;
    directory.announce({
      code: roomCode,
      ownerNick: ctx.nickInput.value.trim() || 'Gracz',
      players: info.players.length,
      max: 6,
      status: info.phase === 'lobby' ? 'lobby' : 'playing',
      createdAt: createdAt,
    });
  };
  let createdAt = Date.now();

  /**
   * Wejście do pokoju: create=true tworzy nowy; inaczej dołącza po kodzie (parametr lub pole #join-code).
   * @param {boolean} create @param {string} [codeParam]
   */
  async function enter(create, codeParam) {
    if (busy) return;
    const nick = ctx.nickInput.value.trim() || `Gracz${Math.floor(Math.random() * 900 + 100)}`;
    ctx.nickInput.value = nick;
    skin = getProfile().skin || skin;
    const codeIn = (codeParam || /** @type {HTMLInputElement} */ ($('#join-code'))?.value || '').trim().toUpperCase();
    if (!create && !isValidRoomCode(codeIn)) return msg('Kod: 5 znaków (bez 0/O/1/I).');
    busy = true;
    msg('Mierzę urządzenie…');
    try {
      const sb = useSupabase ? await getSupabase() : null;
      const selfId = sb ? await signInAnon(nick) : randomId();
      const rooms = createRoomsApi(sb);
      const { score } = await measureDevice((s) => step(s, {}), createBenchmarkState);
      let room;
      if (create) room = await rooms.createRoom();
      else {
        room = await rooms.findRoom(codeIn);
        if (!room) throw new Error('Nie ma takiego pokoju.');
        if (room.status && room.status !== 'lobby') throw new Error('Mecz w tym pokoju już trwa.');
      }
      const transport = sb ? createSupabaseTransport(sb, selfId) : createLocalTransport(selfId);
      device = params.get('bot') === '1' ? createBotDevice(hash(selfId)) : isTouchDevice() && !matchMedia('(pointer:fine)').matches ? ctx.getTouch() : createKeyboardMouse(ctx.gameView);
      session = createSession({
        transport,
        rooms,
        room,
        nick,
        skin: /** @type {string} */ (skin),
        look: await getActiveLook(/** @type {string} */ (skin)),
        deviceScore: score,
        isOwner: create,
        iceServers: params.get('ice') === 'none' ? [] : iceServersFromEnv(),
        forceRelay: params.get('relay') === '1',
        readInput: (view, me) => device.read(view, me),
        speed: Number(params.get('speed')) || 1,
        targetScore: Number(params.get('target')) || undefined,
      });
      wireSession(session, room.code);
      roomCode = room.code;
      createdAt = Date.now();
      if (create) {
        directory?.close();
        directory = await openDirectory({ forceLocal: !sb });
      }
      await session.join();
      announce(session.lobbyInfo());
      if (!create) {
        await new Promise((r) => setTimeout(r, 1200));
        const info = session.lobbyInfo();
        if (!info.players.some((p) => p.userId !== selfId)) {
          await session.leave();
          session = null;
          throw new Error('Pokój jest pusty albo nie istnieje.');
        }
      }
      msg('');
      showScreen('#screen-lobby');
    } catch (e) {
      msg(String(/** @type {any} */ (e)?.message || e));
    } finally {
      busy = false;
    }
  }

  function wireSession(s, code) {
    $('#room-code').textContent = code;
    window.__korona = {
      mode: 'online',
      session: s,
      getState: () => s.getState(),
      debug: () => s.debug(),
    };
    s.on('presence', (info) => {
      renderLobby(info);
      announce(info);
    });
    s.on('lobby', (info) => {
      ctx.gameView.setSource(null);
      ctx.touchRoot.classList.add('hidden');
      setOverlay(null);
      renderLobby(info);
      showScreen('#screen-lobby');
    });
    s.on('matchStart', () => {
      announce({ ...s.lobbyInfo(), phase: 'match' });
      ctx.gameView.cam.mode = 'follow';
      ctx.gameView.setSource({ frame: () => s.frame() });
      ctx.touchRoot.classList.toggle('hidden', device?.kind !== 'touch');
      document.body.dataset.inMatch = '1';
      keepAwake(true);
      showScreen(null);
    });
    s.on('matchEnd', ({ state, saved, isOwner }) => {
      document.body.dataset.inMatch = '0';
      ctx.onMatchRecorded?.(state, s.selfId, { online: true });
      keepAwake(false);
      ctx.touchRoot.classList.add('hidden');
      const note = saved ? (saved.saved ? 'Wynik zapisany w Supabase.' : `Wynik niezapisany (${saved.reason}).`) : '';
      showSummary(state, {
        canRematch: isOwner,
        msg: (isOwner ? '' : 'Rewanż uruchamia właściciel pokoju. ') + note,
        onRematch: () => s.rematch(),
        onBack: async () => {
          await s.leave();
          session = null;
          directory?.close();
          directory = null;
          ctx.backToMenu();
        },
      });
    });
  }

  function renderLobby(info) {
    if (!session) return;
    const ul = $('#lobby-players');
    ul.innerHTML = info.players
      .map((p, i) => {
        const pct = Math.min(100, (p.deviceScore / Math.max(1, info.players[0].deviceScore)) * 100);
        return `<li style="--c:${slotColor(i)}" data-id="${esc(p.userId)}">
          <span class="mini" data-skin-pv="${esc(p.skin || '')}"></span>
          <span class="nick">${esc(p.nick)}${p.userId === info.selfId ? ' (ty)' : ''}</span>
          <span class="badge">${SKINS[p.skin]?.name ?? ''}</span>
          ${p.userId === info.hostId ? '<span class="badge host">♛ host</span>' : ''}
          ${p.owner ? '<span class="badge">właściciel</span>' : ''}
          ${p.status === 'match' ? '<span class="badge">w meczu</span>' : p.ready ? '<span class="badge ready">gotowy</span>' : '<span class="badge">czeka</span>'}
          <span class="score-bar" title="Wynik urządzenia: ${Math.round(p.deviceScore)}"><i style="width:${pct}%"></i></span>
        </li>`;
      })
      .join('');
    ul.querySelectorAll('[data-skin-pv]').forEach((el, i) => {
      const sk = /** @type {HTMLElement} */ (el).dataset.skinPv;
      if (sk && /** @type {any} */ (SKINS)[sk]) mount(el, heroPreview(sk, slotColor(i), { w: 48, h: 44, maxScale: 2, look: info.players[i]?.look }));
    });
    const st = /** @type {HTMLButtonElement} */ ($('#btn-start'));
    st.classList.toggle('hidden', !info.isOwner);
    const lobbyPeers = info.players.filter((p) => p.status === 'lobby');
    st.disabled = lobbyPeers.length < 2 || lobbyPeers.some((p) => !p.ready);
    $('#btn-ready').textContent = session.ready ? 'Nie gotowy' : 'Gotowy';
    if (!info.ownerPresent) $('#lobby-msg').textContent = 'Właściciel pokoju wyszedł.';
  }

  function renderSkins() {
    const root = $('#lobby-skins');
    root.innerHTML = SKIN_IDS.map((id) => {
      const t = SKIN_TEXT[id];
      return `<div class="skin ${id === skin ? 'sel' : ''}" data-skin="${id}" style="--c:${SKINS[id].color}" role="button" tabindex="0" aria-pressed="${id === skin}">
          <div class="skin-pv"></div>
          <span class="skin-name">${SKINS[id].name}</span>
          <span class="role">${esc(t.role)}</span>
          <span class="line"><span class="k">Atak:</span> ${esc(t.attack)}</span>
          <span class="abil"><b>${esc(t.ability)}</b> <span class="cd">${t.cd} s</span><br />${esc(t.abilityDesc)}</span>
        </div>`;
    }).join('');
    for (const el of root.querySelectorAll('.skin')) {
      const id = /** @type {HTMLElement} */ (el).dataset.skin || 'rycerz';
      const pv = el.querySelector('.skin-pv');
      mount(pv, heroPreview(id, SKINS[id].color, { w: 96, h: 84, maxScale: 4 }));
      // własny wygląd (tylko odblokowane kosmetyki, skin klasy tylko na swojej klasie)
      getActiveLook(id)
        .then((look) => pv?.isConnected && mount(pv, heroPreview(id, SKINS[id].color, { w: 96, h: 84, maxScale: 4, look })))
        .catch(() => {});
      const pick = () => {
        skin = id;
        session?.setSkin(skin);
        getActiveLook(skin).then((look) => session?.setLook(look));
        for (const c of root.querySelectorAll('.skin')) {
          const on = /** @type {HTMLElement} */ (c).dataset.skin === id;
          c.classList.toggle('sel', on);
          c.setAttribute('aria-pressed', String(on));
        }
      };
      el.addEventListener('click', pick);
      el.addEventListener('keydown', (e) => {
        const k = /** @type {KeyboardEvent} */ (e).key;
        if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          pick();
        }
      });
    }
  }
  renderSkins();

  $('#btn-ready').onclick = () => {
    if (!session) return;
    session.setReady(!session.ready);
    renderLobby(session.lobbyInfo());
  };
  $('#btn-start').onclick = () => {
    const r = session?.requestStart();
    $('#lobby-msg').textContent = r && !r.ok ? r.reason : '';
  };
  $('#btn-leave').onclick = async () => {
    directory?.close();
    directory = null;
    await session?.leave();
    session = null;
    ctx.backToMenu();
  };
  $('#btn-copy').onclick = async () => {
    const code = $('#room-code').textContent || '';
    const url = `${location.origin}${location.pathname}?join=${code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'KORONA', text: `Dołącz do pokoju ${code}`, url });
      else await navigator.clipboard.writeText(code);
      $('#lobby-msg').textContent = 'Skopiowano kod.';
    } catch {
      $('#lobby-msg').textContent = `Kod: ${code}`;
    }
  };
  return { enter };
}

function randomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return 'u' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
