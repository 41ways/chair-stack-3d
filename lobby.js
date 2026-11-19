/* 열린 방 목록 — 우리 서버 없이 PeerJS만 쓴다.
   `${prefix}lobby` 라는 이름을 먼저 잡은 브라우저가 목록을 맡는다(목록 담당).
   방장은 자기 방 정보를 담당에게 보내고, 목록 화면을 연 사람은 담당에게서 목록을 받는다.
   담당이 나가면 연결이 끊긴 사람들 중 먼저 이름을 잡은 쪽이 새 담당이 되고, 방장들은 방 정보를 다시 보낸다.
   의자 쌓기 2D·3D가 같은 파일을 쓴다(prefix만 다름) */

const CLEAN = s => String(s ?? '').replace(/[\u0000-\u001f<>&"'`]/g, '').trim();
const MAX_ROOMS = 30, STALE_MS = 75000, REFRESH_MS = 20000;

function cleanRoom(r) {
  if (!r || typeof r !== 'object') return null;
  const code = CLEAN(r.code).toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) return null;
  const n = Math.max(0, Math.min(99, r.n | 0)), max = Math.max(1, Math.min(99, r.max | 0));
  return { code, host: CLEAN(r.host).slice(0, 12), n, max, mode: r.mode === 'ext' ? 'ext' : 'basic',
    state: ['wait', 'full', 'playing'].includes(r.state) ? r.state : 'wait' };
}

export function makeLobby(prefix) {
  const ID = prefix + 'lobby';
  const L = { peer: null, conn: null, reg: null, dialing: false, claiming: false, timer: null, refresh: null,
    watchers: 0, onList: null, info: null, rooms: new Map(), subs: new Set(), listT: null, last: [] };

  const needed = () => L.watchers > 0 || !!L.info;
  const later = (fn, ms) => { clearTimeout(L.timer); L.timer = setTimeout(fn, ms); };
  const jitter = () => 300 + Math.random() * 1200;
  const emit = list => { L.last = list; if (L.watchers && L.onList) L.onList(list); };

  /* ── 담당 쪽 ── */
  function list() {
    const now = Date.now(), out = [];
    for (const [k, r] of L.rooms) { if (now - r.ts > STALE_MS) L.rooms.delete(k); else out.push(r.room); }
    const rank = r => (r.state === 'wait' ? 0 : r.state === 'full' ? 1 : 2);
    return out.sort((a, b) => rank(a) - rank(b)).slice(0, MAX_ROOMS);
  }
  function changed() {
    if (L.listT) return;
    L.listT = setTimeout(() => {
      L.listT = null; if (!L.reg) return;
      const m = { t: 'list', list: list() };
      for (const c of L.subs) if (c.open) { try { c.send(m); } catch {} }
      emit(m.list);
    }, 200);
  }
  function setRoom(key, room) {
    if (room) { if (!L.rooms.has(key) && L.rooms.size >= MAX_ROOMS) return; L.rooms.set(key, { room, ts: Date.now() }); }
    else L.rooms.delete(key);
    changed();
  }
  function claim() {
    if (!needed() || L.reg || L.claiming) return;
    L.claiming = true;
    const reg = new Peer(ID);
    reg.on('open', () => {
      L.reg = reg; L.claiming = false; L.dialing = false; L.rooms.clear(); L.subs.clear();
      if (L.info) setRoom('self', L.info);
      changed();
    });
    reg.on('connection', c => {
      c.on('data', d => {
        if (!d || typeof d.t !== 'string') return;
        if (d.t === 'sub') { L.subs.add(c); if (c.open) c.send({ t: 'list', list: list() }); }
        else if (d.t === 'unsub') L.subs.delete(c);
        else if (d.t === 'room') { const r = cleanRoom(d.room); if (r) setRoom(c.peer, r); }
        else if (d.t === 'bye') setRoom(c.peer, null);
      });
      const gone = () => { L.subs.delete(c); if (L.rooms.has(c.peer)) setRoom(c.peer, null); };
      c.on('close', gone); c.on('error', gone);
    });
    reg.on('error', e => {
      if (L.reg && L.reg !== reg) return;
      try { reg.destroy(); } catch {}
      if (L.reg === reg) L.reg = null;
      L.claiming = false; L.dialing = false;
      // 다른 사람이 먼저 담당이 됐으면 그쪽에 붙는다
      later(ensure, e.type === 'unavailable-id' ? 200 + Math.random() * 400 : 3000);
    });
    reg.on('disconnected', () => { try { reg.reconnect(); } catch {} });
  }

  /* ── 붙는 쪽 ── */
  function dial() {
    if (!needed() || L.reg || (L.conn && L.conn.open)) return;
    L.dialing = true;
    const c = L.peer.connect(ID, { reliable: true });
    let ok = false;
    const giveUp = setTimeout(() => { if (!ok) { try { c.close(); } catch {} L.dialing = false; claim(); } }, 7000);
    c.on('open', () => {
      ok = true; clearTimeout(giveUp); L.dialing = false; L.conn = c;
      if (L.watchers) c.send({ t: 'sub' });
      if (L.info) c.send({ t: 'room', room: L.info });
    });
    c.on('data', d => { if (d && d.t === 'list' && Array.isArray(d.list)) emit(d.list.map(cleanRoom).filter(Boolean)); });
    c.on('close', () => { if (L.conn === c) { L.conn = null; if (needed()) later(ensure, jitter()); } });
  }
  function ensure() {
    if (!needed()) return stop();
    if (typeof Peer === 'undefined' || L.reg || L.claiming || L.dialing || (L.conn && L.conn.open)) return;
    if (!L.peer || L.peer.destroyed) {
      L.dialing = true;
      const p = new Peer(); L.peer = p;
      p.on('open', () => { if (L.peer === p) { L.dialing = false; dial(); } });
      p.on('error', e => {
        if (L.peer !== p) return;
        if (e.type === 'peer-unavailable') { L.dialing = false; claim(); return; }   // 담당이 없다 → 내가 맡는다
        if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
          L.dialing = false; try { p.destroy(); } catch {} L.peer = null; later(ensure, 4000);
        }
      });
      p.on('disconnected', () => { try { p.reconnect(); } catch {} });
      return;
    }
    if (L.peer.open) dial();
  }
  function stop() {
    clearTimeout(L.timer); clearInterval(L.refresh); L.refresh = null;
    const { peer, reg, conn } = L;
    try { if (conn && conn.open && L.info === null) conn.send({ t: 'bye' }); } catch {}
    Object.assign(L, { peer: null, conn: null, reg: null, dialing: false, claiming: false });
    L.rooms.clear(); L.subs.clear();
    setTimeout(() => { for (const p of [peer, reg]) try { p && p.destroy(); } catch {} }, 150);
  }

  return {
    /** 목록 받기 시작. cb(list)는 목록이 바뀔 때마다 */
    watch(cb) {
      L.onList = cb; L.watchers = 1;
      if (L.reg) emit(list());
      else if (L.conn && L.conn.open) L.conn.send({ t: 'sub' });
      ensure();
    },
    unwatch() {
      L.watchers = 0; L.onList = null;
      if (L.conn && L.conn.open) try { L.conn.send({ t: 'unsub' }); } catch {}
      if (!needed()) stop();
    },
    /** 내 방을 목록에 올리거나(room) 내린다(null) */
    announce(room) {
      const r = room ? cleanRoom(room) : null;
      if (!r) {
        if (!L.info) return;
        L.info = null; clearInterval(L.refresh); L.refresh = null;
        if (L.reg) setRoom('self', null);
        else if (L.conn && L.conn.open) try { L.conn.send({ t: 'bye' }); } catch {}
        if (!needed()) stop();
        return;
      }
      L.info = r;
      if (L.reg) setRoom('self', r);
      else if (L.conn && L.conn.open) L.conn.send({ t: 'room', room: r });
      if (!L.refresh) L.refresh = setInterval(() => {
        if (!L.info) return;
        if (L.reg) setRoom('self', L.info); else if (L.conn && L.conn.open) L.conn.send({ t: 'room', room: L.info });
      }, REFRESH_MS);
      ensure();
    },
    get last() { return L.last; },
    get isRegistry() { return !!L.reg; },
  };
}
