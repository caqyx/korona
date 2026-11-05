/**
 * Sygnalizacja WebRTC przez transport (Broadcast z polem `to`) + menedżer łączy.
 * Dla każdego peera: jeśli DataChannel jest otwarty — wysyłamy przez WebRTC,
 * w przeciwnym razie (jeszcze się łączy albo NAT nie pozwolił) — przez przekaźnik.
 */
import { MSG, envelope, validateMessage } from './messages.js';
import { createPeerLink } from './peer.js';
import { createRelay } from './relay.js';

/** Konfiguracja ICE: publiczny STUN + opcjonalny TURN z .env. */
export function iceServersFromEnv(env = /** @type {any} */ (import.meta).env || {}) {
  if (env.VITE_ICE_NONE === '1') return [];
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (env.VITE_TURN_URL) servers.push({ urls: env.VITE_TURN_URL, username: env.VITE_TURN_USERNAME, credential: env.VITE_TURN_CREDENTIAL });
  return /** @type {RTCIceServer[]} */ (servers);
}

/**
 * @param {{transport: import('./transport.js').Transport, iceServers: RTCIceServer[], forceRelay?: boolean,
 *          onMessage:(m:any)=>void, onLinkChange?:()=>void}} o
 */
export function createLinkManager(o) {
  const self = o.transport.selfId;
  /** @type {Map<string, ReturnType<typeof createPeerLink>>} */
  const links = new Map();
  const relay = createRelay(o.transport, o.transport.relayHz);
  relay.start();
  let epoch = 0;

  const sendSignal = (to) => (sig) => o.transport.send(envelope(MSG.SIGNAL, self, { ...sig, epoch }, to));

  /** @param {string} peerId @param {boolean} initiator */
  function makeLink(peerId, initiator) {
    if (o.forceRelay || typeof RTCPeerConnection === 'undefined') return null;
    links.get(peerId)?.close();
    const link = createPeerLink({
      peerId,
      initiator,
      iceServers: o.iceServers,
      sendSignal: sendSignal(peerId),
      onMessage: o.onMessage,
      onOpen: () => o.onLinkChange?.(),
      onClose: () => {
        if (links.get(peerId) === link) links.delete(peerId);
        o.onLinkChange?.();
      },
    });
    links.set(peerId, link);
    return link;
  }

  return {
    /** @param {number} e */
    setEpoch(e) {
      epoch = e;
    },
    /** Klient łączy się z hostem. @param {string} peerId */
    connect(peerId) {
      makeLink(peerId, true);
    },
    /** Obsługa przychodzącego sygnału i przekaźnika. @param {any} m */
    handleTransportMessage(m) {
      if (m.type === MSG.SIGNAL) {
        if (m.payload.epoch !== epoch) return true;
        let link = links.get(m.from);
        if (m.payload.kind === 'offer') link = makeLink(m.from, false) ?? undefined;
        link?.handleSignal(m.payload);
        return true;
      }
      if (m.type === MSG.RELAY) {
        const inner = m.payload.msg;
        if (inner && inner.from === m.from && validateMessage(inner)) o.onMessage(inner);
        return true;
      }
      return false;
    },
    /** @param {string} to @param {any} msg */
    sendState(to, msg) {
      const l = links.get(to);
      if (!l || !l.sendState(msg)) relay.sendState(to, msg);
    },
    /** @param {string} to @param {any} msg */
    sendEvent(to, msg) {
      const l = links.get(to);
      if (!l || !l.sendEvent(msg)) relay.sendEvent(to, msg);
    },
    /** @param {string} peerId */
    drop(peerId) {
      links.get(peerId)?.close();
      links.delete(peerId);
    },
    /** @param {string} peerId */
    isWebRtc(peerId) {
      return !!links.get(peerId)?.isOpen;
    },
    modes() {
      const out = {};
      for (const [id, l] of links) out[id] = l.isOpen ? 'webrtc' : 'connecting';
      return out;
    },
    closeAll() {
      for (const l of links.values()) l.close();
      links.clear();
    },
    destroy() {
      this.closeAll();
      relay.stop();
    },
  };
}
