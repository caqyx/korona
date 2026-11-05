/**
 * Połączenie WebRTC z jednym peerem: 2 DataChannele
 *  - 'state':  ordered:false, maxRetransmits:0 (snapshoty, inputy)
 *  - 'events': niezawodny (zabójstwa, korona, koniec meczu, handoff)
 */
import { parseMessage, encodeMessage } from './messages.js';

/**
 * @param {{peerId:string, initiator:boolean, iceServers:RTCIceServer[], sendSignal:(sig:any)=>void,
 *          onMessage:(m:any)=>void, onOpen:()=>void, onClose:()=>void}} o
 */
export function createPeerLink(o) {
  const pc = new RTCPeerConnection({ iceServers: o.iceServers });
  /** @type {RTCDataChannel|null} */ let stateCh = null;
  /** @type {RTCDataChannel|null} */ let eventsCh = null;
  /** @type {RTCIceCandidateInit[]} */ const pendingIce = [];
  let open = false;
  let closed = false;

  const checkOpen = () => {
    if (!open && stateCh?.readyState === 'open' && eventsCh?.readyState === 'open') {
      open = true;
      o.onOpen();
    }
  };
  const close = () => {
    if (closed) return;
    closed = true;
    open = false;
    try {
      pc.close();
    } catch {
      /* ignore */
    }
    o.onClose();
  };
  /** @param {RTCDataChannel} ch */
  const wire = (ch) => {
    if (ch.label === 'state') stateCh = ch;
    else if (ch.label === 'events') eventsCh = ch;
    else return;
    ch.onopen = checkOpen;
    ch.onclose = close;
    ch.onmessage = (e) => {
      const m = parseMessage(e.data);
      if (m && m.from === o.peerId) o.onMessage(m);
    };
    checkOpen();
  };

  pc.onicecandidate = (e) => o.sendSignal({ kind: 'ice', candidate: e.candidate ? e.candidate.toJSON() : null });
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') close();
  };
  pc.ondatachannel = (e) => wire(e.channel);

  if (o.initiator) {
    wire(pc.createDataChannel('state', { ordered: false, maxRetransmits: 0 }));
    wire(pc.createDataChannel('events', { ordered: true }));
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => o.sendSignal({ kind: 'offer', sdp: pc.localDescription?.sdp ?? '' }))
      .catch(close);
  }

  const flushIce = async () => {
    while (pendingIce.length) await pc.addIceCandidate(/** @type {RTCIceCandidateInit} */ (pendingIce.shift())).catch(() => {});
  };

  return {
    peerId: o.peerId,
    get isOpen() {
      return open;
    },
    /** @param {any} sig */
    async handleSignal(sig) {
      if (closed) return;
      try {
        if (sig.kind === 'offer' && !o.initiator) {
          await pc.setRemoteDescription({ type: 'offer', sdp: sig.sdp });
          await flushIce();
          await pc.setLocalDescription(await pc.createAnswer());
          o.sendSignal({ kind: 'answer', sdp: pc.localDescription?.sdp ?? '' });
        } else if (sig.kind === 'answer' && o.initiator) {
          await pc.setRemoteDescription({ type: 'answer', sdp: sig.sdp });
          await flushIce();
        } else if (sig.kind === 'ice' && sig.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(sig.candidate).catch(() => {});
          else pendingIce.push(sig.candidate);
        }
      } catch {
        close();
      }
    },
    /** @param {any} msg */
    sendState(msg) {
      if (open && stateCh) {
        try {
          stateCh.send(encodeMessage(msg));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },
    /** @param {any} msg */
    sendEvent(msg) {
      if (open && eventsCh) {
        try {
          eventsCh.send(encodeMessage(msg));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },
    close,
  };
}
