/**
 * Sesja online: lobby (Presence), start meczu, role host/klient, migracja hosta.
 * Spina transport, łącza WebRTC/przekaźnik, pętle hosta i klienta oraz wybór hosta.
 */
import { MSG, envelope } from './messages.js';
import { createLinkManager } from './signaling.js';
import { createHostLoop } from './host.js';
import { createClientLoop } from './client.js';
import { electHost, rankPeers, successorOf, resolveClaim, shouldPlannedMigrate, createStepMonitor, hostLost, MIGRATION } from './election.js';
import { createMatchState, cloneState } from '../sim/state.js';
import { disconnectPlayer } from '../sim/rules.js';
import { makeRng } from '../sim/rng.js';
import { MATCH } from '../sim/config.js';

/**
 * @param {{transport: import('./transport.js').Transport, rooms: any, room:{id:string|null, code:string, ownerId:string|null},
 *   nick:string, skin:string, deviceScore:number, isOwner:boolean, iceServers:RTCIceServer[], forceRelay?:boolean,
 *   readInput:(view:any, me:any)=>any, speed?:number, targetScore?:number, now?:()=>number}} o
 */
export function createSession(o) {
  const t = o.transport;
  const self = t.selfId;
  const now = o.now || (() => performance.now());
  const listeners = {};
  const emit = (ev, data) => (listeners[ev] || []).forEach((cb) => cb(data));

  /** @type {import('./transport.js').PresenceInfo} */
  const me = { userId: self, nick: o.nick, skin: o.skin, deviceScore: o.deviceScore, joinedAt: Date.now(), ready: false, owner: o.isOwner, status: 'lobby' };
  let baseScore = o.deviceScore;
  /** @type {import('./transport.js').PresenceInfo[]} */
  let presence = [me];
  let phase = /** @type {'lobby'|'match'|'ended'} */ ('lobby');
  let role = /** @type {'host'|'client'|null} */ (null);
  let overlay = /** @type {string|null} */ (null);
  /** @type {{id:string, epoch:number, hostId:string, players:string[], startedAt:number, finalState:any}|null} */
  let match = null;
  let host = /** @type {ReturnType<typeof createHostLoop>|null} */ (null);
  let client = /** @type {ReturnType<typeof createClientLoop>|null} */ (null);
  let migrating = false;
  let migrationTimer = /** @type {any} */ (0);
  let resumeTimer = /** @type {any} */ (0);
  let hellos = new Set();
  let hiddenSince = /** @type {number|null} */ (null);
  const stepMon = createStepMonitor();
  const absentSince = new Map();
  const log = [];
  const note = (s) => {
    log.push(`${Math.round(now())} ${s}`);
    if (log.length > 200) log.shift();
  };

  const links = createLinkManager({
    transport: t,
    iceServers: o.iceServers,
    forceRelay: o.forceRelay,
    onMessage: (m) => handle(m),
  });

  t.onPresence((list) => {
    presence = list.some((p) => p.userId === self) ? list : [...list, me];
    emit('presence', lobbyInfo());
    checkAbsent();
  });
  t.onMessage((m) => {
    if (links.handleTransportMessage(m)) return;
    handle(m);
  });

  // --- lobby ---------------------------------------------------------------
  function lobbyInfo() {
    const list = rankPeers(presence);
    const lobbyPeers = list.filter((p) => p.status === 'lobby');
    const el = electHost(lobbyPeers);
    const ownerPresent = presence.some((p) => p.owner);
    return { players: list, hostId: match?.hostId ?? el.hostId, successorId: el.successorId, selfId: self, isOwner: me.owner, ownerPresent, phase, code: o.room.code };
  }
  function pushPresence() {
    t.updatePresence({ ...me });
  }

  // --- start ---------------------------------------------------------------
  function requestStart() {
    if (!me.owner) return { ok: false, reason: 'Tylko właściciel pokoju może wystartować.' };
    const ready = presence.filter((p) => p.status === 'lobby');
    if (ready.length < MATCH.minPlayers) return { ok: false, reason: 'Potrzeba co najmniej 2 graczy.' };
    if (ready.some((p) => !p.ready)) return { ok: false, reason: 'Nie wszyscy są gotowi.' };
    const { hostId } = electHost(ready);
    if (hostId === self) startAsHost();
    else t.send(envelope(MSG.LOBBY_CMD, self, { cmd: 'start' }, hostId ?? undefined));
    return { ok: true };
  }

  function startAsHost() {
    const ready = rankPeers(presence.filter((p) => p.status === 'lobby' && p.ready)).slice(0, MATCH.maxPlayers);
    if (ready.length < MATCH.minPlayers) return;
    const seed = (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0;
    const order = [...ready].sort((a, b) => a.joinedAt - b.joinedAt);
    const state = createMatchState({ seed, players: order.map((p) => ({ id: p.userId, nick: p.nick, skin: p.skin })), targetScore: o.targetScore });
    const matchId = `m${seed.toString(36)}`;
    match = { id: matchId, epoch: 1, hostId: self, players: order.map((p) => p.userId), startedAt: Date.now(), finalState: null };
    links.setEpoch(1);
    t.send(envelope(MSG.START, self, { epoch: 1, hostId: self, matchId, state }));
    o.rooms.setStatus(o.room.id, 'playing').catch?.(() => {});
    enterMatch();
    becomeHostLoop(state, false, 0);
    note('start as host');
  }

  function enterMatch() {
    phase = 'match';
    me.status = 'match';
    me.ready = false;
    pushPresence();
    emit('matchStart', { selfId: self });
  }

  /** @param {any} m */
  function onStart(m) {
    if (phase === 'match' && match && m.payload.epoch <= match.epoch) return;
    if (!m.payload.state.players.some((p) => p.id === self)) return; // nie jesteśmy w tym meczu
    match = { id: m.payload.matchId, epoch: m.payload.epoch, hostId: m.payload.hostId, players: m.payload.state.players.map((p) => p.id), startedAt: Date.now(), finalState: null };
    links.setEpoch(match.epoch);
    becomeClient(m.payload.hostId, m.payload.state);
    enterMatch();
    note('start as client of ' + m.payload.hostId);
  }

  // --- role ----------------------------------------------------------------
  /** @param {any} state @param {boolean} paused @param {number} countdown */
  function becomeHostLoop(state, paused, countdown) {
    client?.stop();
    client = null;
    host?.stop();
    role = 'host';
    host = createHostLoop({
      state,
      selfId: self,
      speed: o.speed,
      readLocalInput: (s) => o.readInput(s, s.players.find((p) => p.id === self)),
      sendSnapshot: (s) => {
        const msg = envelope(MSG.SNAPSHOT, self, { epoch: match?.epoch ?? 0, state: s });
        for (const id of match?.players ?? []) if (id !== self) links.sendState(id, msg);
      },
      sendEvents: (events, tick) => {
        const msg = envelope(MSG.EVENTS, self, { epoch: match?.epoch ?? 0, tick, events });
        for (const id of match?.players ?? []) if (id !== self) links.sendEvent(id, msg);
      },
      onStepTime: (ms, at) => stepMon.record(ms, at),
      onEnd: (s) => onMatchEnd(s, true),
    });
    host.start();
    if (!paused) host.resume();
    else if (countdown > 0) scheduleResume(countdown);
  }

  /** @param {string} hostId @param {any} [initialState] */
  function becomeClient(hostId, initialState) {
    host?.stop();
    host = null;
    role = 'client';
    client?.stop();
    client = createClientLoop({
      selfId: self,
      readInput: o.readInput,
      sendInput: (input) => {
        if (!match) return;
        links.sendState(match.hostId, envelope(MSG.INPUT, self, input));
      },
    });
    if (initialState) client.pushSnapshot(initialState);
    client.start();
    links.closeAll();
    links.connect(hostId);
    t.send(envelope(MSG.HELLO, self, { epoch: match?.epoch ?? 0 }, hostId));
  }

  // --- wiadomości ----------------------------------------------------------
  /** @param {any} m */
  function handle(m) {
    switch (m.type) {
      case MSG.LOBBY_CMD:
        return onLobbyCmd(m);
      case MSG.START:
        return onStart(m);
      case MSG.HOST_CLAIM:
        return onClaim(m);
      case MSG.HANDOFF:
        return onHandoff(m);
      case MSG.INPUT:
        if (role === 'host' && host && match?.players.includes(m.from)) host.setInput(m.from, m.payload);
        return;
      case MSG.HELLO:
        if (role === 'host' && match && m.payload.epoch === match.epoch) {
          hellos.add(m.from);
          host?.forceSnapshot();
          maybeResume();
        }
        return;
      case MSG.SNAPSHOT:
        if (role === 'client' && client && match && m.from === match.hostId && m.payload.epoch === match.epoch) {
          client.pushSnapshot(m.payload.state);
          if (m.payload.state.phase === 'ended' && phase !== 'ended') onMatchEnd(m.payload.state, false);
        }
        return;
      case MSG.EVENTS:
        if (role === 'client' && client && match && m.from === match.hostId && m.payload.epoch === match.epoch) client.pushEvents(m.payload.events);
        return;
      case MSG.RESUME:
        if (role === 'client' && match && m.from === match.hostId && m.payload.epoch === match.epoch) showCountdown(m.payload.countdown);
        return;
      default:
        return;
    }
  }

  function isOwnerId(id) {
    return presence.some((p) => p.userId === id && p.owner) || (o.room.ownerId && o.room.ownerId === id);
  }

  /** @param {any} m */
  function onLobbyCmd(m) {
    if (!isOwnerId(m.from)) return;
    if (m.payload.cmd === 'start' && phase === 'lobby') {
      const { hostId } = electHost(presence.filter((p) => p.status === 'lobby'));
      if (hostId === self) startAsHost();
    } else if (m.payload.cmd === 'rematch') backToLobby();
  }

  // --- migracja -------------------------------------------------------------
  /** @param {any} m */
  function onClaim(m) {
    if (!match || phase !== 'match') return;
    const claim = { epoch: m.payload.epoch, hostId: m.payload.hostId };
    if (claim.hostId !== m.from) return;
    const cur = { epoch: match.epoch, hostId: match.hostId };
    const ranking = rankPeers(presence).map((p) => p.userId);
    const win = resolveClaim(cur, claim, ranking);
    if (win === claim && (claim.epoch !== cur.epoch || claim.hostId !== cur.hostId)) {
      note(`accept claim e${claim.epoch} ${claim.hostId}`);
      const keepState = host ? cloneState(host.state) : client?.latest();
      match.epoch = claim.epoch;
      match.hostId = claim.hostId;
      links.setEpoch(claim.epoch);
      clearTimeout(migrationTimer);
      migrating = true;
      overlay = 'Migracja hosta…';
      becomeClient(claim.hostId, keepState);
      client?.touch();
    } else if (role === 'host' && win === cur && claim.hostId !== self) {
      note('reject claim, re-assert');
      t.send(envelope(MSG.HOST_CLAIM, self, { epoch: match.epoch, hostId: self, tick: host?.state.tick ?? 0 }));
    }
  }

  /** @param {any} m */
  function onHandoff(m) {
    if (!match || m.payload.to !== self || m.from !== match.hostId) return;
    if (m.payload.epoch <= match.epoch) return;
    note('handoff received');
    takeOver(m.payload.state, m.payload.epoch, null, false);
  }

  /** Przejęcie roli hosta. @param {any} state @param {number} epoch @param {string|null} dropped @param {boolean} unplanned */
  function takeOver(state, epoch, dropped, unplanned) {
    if (!match) return;
    match.epoch = epoch;
    match.hostId = self;
    links.setEpoch(epoch);
    links.closeAll();
    const s = cloneState(state);
    if (dropped) disconnectPlayer(s, dropped);
    for (const id of match.players) {
      if (id !== self && !presence.some((p) => p.userId === id)) disconnectPlayer(s, id);
    }
    hellos = new Set();
    migrating = true;
    overlay = 'Migracja hosta…';
    becomeHostLoop(s, true, 0);
    t.send(envelope(MSG.HOST_CLAIM, self, { epoch, hostId: self, tick: s.tick }));
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => startResume(unplanned), unplanned ? MIGRATION.helloWaitMs : 2000);
    resumeWanted = unplanned;
    maybeResume();
  }
  let resumeWanted = false;

  function expectedPeers() {
    if (!match || !host) return [];
    return host.state.players.filter((p) => p.connected && p.id !== self && presence.some((x) => x.userId === p.id)).map((p) => p.id);
  }
  function maybeResume() {
    if (role !== 'host' || !host || !host.paused || !migrating) return;
    if (expectedPeers().every((id) => hellos.has(id))) startResume(resumeWanted);
  }
  /** @param {boolean} withCountdown */
  function startResume(withCountdown) {
    if (role !== 'host' || !host || !migrating || !match) return;
    clearTimeout(resumeTimer);
    migrating = false;
    const cd = withCountdown ? MIGRATION.resumeCountdown : 0;
    t.send(envelope(MSG.RESUME, self, { epoch: match.epoch, countdown: cd }));
    for (const id of match.players) if (id !== self) links.sendEvent(id, envelope(MSG.RESUME, self, { epoch: match.epoch, countdown: cd }));
    note('resume ' + cd);
    if (cd > 0) scheduleResume(cd);
    else {
      overlay = null;
      host.resume();
    }
  }
  /** @param {number} seconds */
  function scheduleResume(seconds) {
    showCountdown(seconds, () => host?.resume());
  }
  let countdownTimer = /** @type {any} */ (0);
  /** @param {number} seconds @param {()=>void} [done] */
  function showCountdown(seconds, done) {
    clearInterval(countdownTimer);
    migrating = false;
    let left = Math.ceil(seconds);
    if (left <= 0) {
      overlay = null;
      done?.();
      return;
    }
    overlay = String(left);
    countdownTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(countdownTimer);
        overlay = null;
        done?.();
      } else overlay = String(left);
    }, 1000);
  }

  /** Nieplanowana: klient wykrył utratę hosta. @param {string} reason */
  function beginUnplanned(reason, excluded = []) {
    if (!match || !client) return;
    const oldHost = match.hostId;
    migrating = true;
    overlay = 'Migracja hosta…';
    const exclude = [oldHost, ...excluded];
    const alive = match.players.filter((id) => !exclude.includes(id));
    const succ = successorOf(presence.filter((p) => p.deviceScore >= 0), exclude, alive);
    note(`host lost (${reason}); successor ${succ}`);
    if (!succ) return;
    if (succ === self) {
      const st = client.latest();
      if (st) takeOver(st, match.epoch + 1, oldHost, true);
      return;
    }
    clearTimeout(migrationTimer);
    migrationTimer = setTimeout(() => {
      if (match && match.hostId === oldHost) beginUnplanned('successor-timeout', [...excluded, succ]);
    }, 3500);
  }

  /** Planowana: host słabnie — przekazuje stan następcy. @param {string} reason */
  function plannedHandoff(reason) {
    if (!match || !host) return;
    const succ = successorOf(presence.filter((p) => p.userId !== self), [self], match.players.filter((id) => host?.state.players.find((p) => p.id === id && p.connected)));
    if (!succ) return;
    note(`planned handoff (${reason}) -> ${succ}`);
    const st = cloneState(host.state);
    const epoch = match.epoch + 1;
    const msg = envelope(MSG.HANDOFF, self, { to: succ, epoch, state: st }, succ);
    t.send(msg);
    links.sendEvent(succ, msg);
    host.stop();
    match.hostId = succ;
    match.epoch = epoch;
    links.setEpoch(epoch);
    migrating = true;
    overlay = 'Migracja hosta…';
    becomeClient(succ, st);
  }

  function checkAbsent() {
    if (role !== 'host' || !host || !match) return;
    const tnow = now();
    for (const id of match.players) {
      if (id === self) continue;
      const present = presence.some((p) => p.userId === id);
      if (present) absentSince.delete(id);
      else if (!absentSince.has(id)) absentSince.set(id, tnow);
    }
  }

  const monitor = setInterval(() => {
    if (phase !== 'match' || !match) return;
    const tnow = now();
    if (role === 'client' && client && !migrating) {
      const lost = hostLost({ lastSnapshotAt: client.lastSnapshotAt, now: tnow, hostInPresence: presence.some((p) => p.userId === match?.hostId), channelClosed: false });
      if (lost) beginUnplanned(lost);
    }
    if (role === 'host' && host) {
      checkAbsent();
      for (const [id, since] of absentSince) {
        if (tnow - since > 1500) {
          const p = host.state.players.find((x) => x.id === id);
          if (p && p.connected) {
            disconnectPlayer(host.state, id);
            note('player left ' + id);
          }
          absentSince.delete(id);
        }
      }
      if (!migrating && !host.paused && host.state.phase !== 'ended') {
        const why = shouldPlannedMigrate({ hiddenSince, now: tnow, slowSince: stepMon.slowSince });
        if (why) plannedHandoff(why);
      }
    }
  }, 200);

  const onVisibility = () => {
    const hidden = isHidden();
    hiddenSince = hidden ? now() : null;
    me.deviceScore = hidden ? 0 : baseScore;
    pushPresence();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // --- koniec meczu ---------------------------------------------------------
  /** @param {any} state @param {boolean} asHost */
  async function onMatchEnd(state, asHost) {
    if (phase === 'ended' || !match) return;
    phase = 'ended';
    match.finalState = cloneState(state);
    me.status = 'lobby';
    me.ready = false;
    pushPresence();
    let saved = null;
    if (asHost) {
      saved = await o.rooms.saveResults({ roomId: o.room.id, hostId: self, startedAt: match.startedAt, state }).catch((e) => ({ saved: false, reason: String(e) }));
      o.rooms.setStatus(o.room.id, 'finished').catch?.(() => {});
    }
    setTimeout(() => emit('matchEnd', { state: match?.finalState, saved, isOwner: me.owner }), 1200);
  }

  function backToLobby() {
    host?.stop();
    client?.stop();
    host = null;
    client = null;
    role = null;
    match = null;
    phase = 'lobby';
    overlay = null;
    migrating = false;
    links.closeAll();
    me.status = 'lobby';
    me.ready = false;
    pushPresence();
    emit('lobby', lobbyInfo());
  }

  return {
    selfId: self,
    on(ev, cb) {
      (listeners[ev] ||= []).push(cb);
    },
    async join() {
      await t.join(o.room.code, { ...me });
      emit('presence', lobbyInfo());
    },
    lobbyInfo,
    setSkin(skin) {
      me.skin = skin;
      pushPresence();
    },
    setReady(r) {
      me.ready = r;
      pushPresence();
    },
    get ready() {
      return me.ready;
    },
    requestStart,
    rematch() {
      if (!me.owner) return;
      t.send(envelope(MSG.LOBBY_CMD, self, { cmd: 'rematch' }));
      o.rooms.setStatus(o.room.id, 'lobby').catch?.(() => {});
      backToLobby();
    },
    /** Źródło klatek dla gameView. */
    frame() {
      if (phase === 'lobby' || !match) return null;
      if (role === 'host' && host) return { view: host.state, events: host.drainEvents(), meIds: [self], overlay };
      if (role === 'client' && client) {
        const v = client.view();
        if (!v) return null;
        return { view: v, events: client.drainEvents(), meIds: [self], overlay };
      }
      return null;
    },
    debug() {
      return {
        selfId: self,
        role,
        phase,
        hostId: match?.hostId ?? null,
        epoch: match?.epoch ?? 0,
        migrating,
        overlay,
        ranking: rankPeers(presence).map((p) => p.userId),
        presence: presence.map((p) => ({ ...p })),
        links: links.modes(),
        log: [...log],
      };
    },
    getState() {
      if (role === 'host') return host?.state ?? null;
      return client?.latest() ?? match?.finalState ?? null;
    },
    async leave() {
      clearInterval(monitor);
      clearInterval(countdownTimer);
      clearTimeout(resumeTimer);
      clearTimeout(migrationTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      host?.stop();
      client?.stop();
      links.destroy();
      await t.leave();
    },
    /** Do testów: wymusza migrację planowaną. */
    _forceHandoff: () => plannedHandoff('forced'),
  };
}

/** document.hidden z możliwością nadpisania w testach. */
function isHidden() {
  const g = /** @type {any} */ (globalThis);
  if (typeof g.__koronaHidden === 'boolean') return g.__koronaHidden;
  return typeof document !== 'undefined' && document.hidden;
}

export { makeRng };
