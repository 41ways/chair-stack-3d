/* 핑 — G(한글 ㅎ)를 누른 채 마우스를 밀어 고르고, 떼면 그 자리에 찍힌다.
   왼쪽 ? 물음표, 위 ! 위험, 오른쪽 → 간다, 아래 취소. 연속 3번까지, 3번 찍으면 5초 쉰다.
   자리는 게임이 정한다: 2D는 월드 좌표, 3D는 화면 비율(0~1). 의자 쌓기 2D·3D가 같은 파일을 쓴다 */

export const PING_KINDS = {
  q:  { sym: '?', label: '물음표', color: '#e3a21a' },
  d:  { sym: '!', label: '위험',   color: '#d8432f' },
  go: { sym: '→', label: '간다',   color: '#2f7bd1' },
};
const DIRS = { left: 'q', up: 'd', right: 'go', down: null };
export const PING_MAX = 3, PING_COOL = 5000, PING_LIFE = 3000;

/** 3번 찍으면 5초 쉬는 계산. 받는 쪽(방장)도 같은 걸로 막는다 */
export function pingGate() {
  const g = { n: 0, last: 0, until: 0 };
  return {
    left(now = Date.now()) { if (now < g.until) return 0; if (now - g.last > PING_COOL) g.n = 0; return PING_MAX - g.n; },
    wait(now = Date.now()) { return Math.max(0, g.until - now); },
    take(now = Date.now()) {
      if (now < g.until) return false;
      if (now - g.last > PING_COOL) g.n = 0;
      g.n++; g.last = now;
      if (g.n >= PING_MAX) { g.until = now + PING_COOL; g.n = 0; }
      return true;
    },
  };
}

const CSS = `
.pg-layer{position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden}
.pg-wheel{position:fixed;width:168px;height:168px;margin:-84px 0 0 -84px;border-radius:50%;background:#1d2622c4;box-shadow:0 6px 24px #0004;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.pg-wheel i{position:absolute;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;display:grid;place-items:center;font:700 24px/1 system-ui,sans-serif;color:#fff;opacity:.55;transition:transform .08s,opacity .08s}
.pg-wheel i.on{opacity:1;transform:scale(1.18)}
.pg-wheel i[data-k=q]{left:30px;top:84px}.pg-wheel i[data-k=d]{left:84px;top:30px}
.pg-wheel i[data-k=go]{left:138px;top:84px}.pg-wheel i[data-k=x]{left:84px;top:138px;font-size:18px}
.pg-wheel i.on[data-k=q]{background:#e3a21a}.pg-wheel i.on[data-k=d]{background:#d8432f}.pg-wheel i.on[data-k=go]{background:#2f7bd1}.pg-wheel i.on[data-k=x]{background:#ffffff33}
.pg-wheel b{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#fff}
.pg-wheel s{position:absolute;left:0;right:0;top:100%;margin-top:8px;text-align:center;text-decoration:none;font:600 13px/1.3 system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000a;white-space:nowrap}
.pg-wheel.cool i{opacity:.25}
.pg{position:fixed;left:0;top:0;width:0;height:0}
.pg em{position:absolute;left:-18px;top:-18px;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font:800 22px/1 system-ui,sans-serif;font-style:normal;color:#fff;box-shadow:0 2px 8px #0005,0 0 0 3px #fff;animation:pg-pop .32s cubic-bezier(.3,1.6,.5,1)}
.pg u{position:absolute;left:-18px;top:-18px;width:36px;height:36px;border-radius:50%;border:3px solid;animation:pg-ring 1s ease-out 2}
.pg span{position:absolute;left:0;top:24px;transform:translateX(-50%);padding:2px 8px;border-radius:999px;background:#1d2622d0;color:#fff;font:600 12px/1.4 system-ui,sans-serif;white-space:nowrap}
.pg.out{transition:opacity .4s;opacity:0}
@keyframes pg-pop{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pg-ring{from{transform:scale(1);opacity:.9}to{transform:scale(2.6);opacity:0}}
`;

/**
 * o.toScreen(p) → [clientX, clientY] | null   찍힌 자리를 지금 화면 위치로
 * o.fromScreen(x, y) → p                       화면 위치를 보낼 자리로
 * o.canPing() → bool                           지금 찍어도 되는지(게임 화면일 때)
 * o.send({k, p})                               다른 사람에게 보내기(혼자면 아무것도 안 해도 된다)
 */
export function makePings(o) {
  if (!document.getElementById('pg-css')) {
    const st = document.createElement('style'); st.id = 'pg-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const layer = document.createElement('div'); layer.className = 'pg-layer'; document.body.appendChild(layer);
  const wheel = document.createElement('div'); wheel.className = 'pg-wheel'; wheel.hidden = true;
  wheel.innerHTML = '<i data-k="q">?</i><i data-k="d">!</i><i data-k="go">→</i><i data-k="x">✕</i><b></b><s></s>';
  layer.appendChild(wheel);
  const gate = pingGate();
  const S = { open: false, cx: 0, cy: 0, mx: innerWidth / 2, my: innerHeight / 2, sel: null, list: [], raf: 0 };

  const pick = () => {
    const dx = S.mx - S.cx, dy = S.my - S.cy;
    if (Math.hypot(dx, dy) < 22) return null;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    return dir === 'down' ? 'x' : DIRS[dir];
  };
  function paint() {
    S.sel = pick();
    for (const i of wheel.querySelectorAll('i')) i.classList.toggle('on', i.dataset.k === S.sel);
    const w = gate.wait(), left = gate.left();
    wheel.classList.toggle('cool', w > 0);
    const sel = PING_KINDS[S.sel];
    wheel.querySelector('s').textContent = w > 0 ? `${Math.ceil(w / 1000)}초 뒤에 다시` : sel ? `${sel.label} · ${left}번 남음` : S.sel === 'x' ? '취소' : `${left}번 남음`;
  }
  function open() {
    if (S.open || !o.canPing()) return;
    S.open = true; S.cx = S.mx; S.cy = S.my;
    wheel.style.left = S.cx + 'px'; wheel.style.top = S.cy + 'px'; wheel.hidden = false;
    paint();
    if (gate.wait() > 0) S.coolT = setInterval(paint, 250);
  }
  function close(fire) {
    if (!S.open) return;
    S.open = false; wheel.hidden = true; clearInterval(S.coolT);
    const k = S.sel;
    if (!fire || !PING_KINDS[k] || !o.canPing() || !gate.take()) return;
    const p = o.fromScreen(S.cx, S.cy);
    show(k, p, '나');
    try { o.send({ k, p }); } catch {}
  }
  function show(k, p, name) {
    const kind = PING_KINDS[k]; if (!kind) return;
    const el = document.createElement('div'); el.className = 'pg';
    el.innerHTML = `<u style="border-color:${kind.color}"></u><em style="background:${kind.color}">${kind.sym}</em><span></span>`;
    el.querySelector('span').textContent = `${name} · ${kind.label}`;
    layer.appendChild(el);
    const item = { el, p, t: performance.now() };
    S.list.push(item);
    if (S.list.length > 12) drop(S.list[0]);
    setTimeout(() => el.classList.add('out'), PING_LIFE - 400);
    setTimeout(() => drop(item), PING_LIFE);
    place(item);
    if (!S.raf) S.raf = requestAnimationFrame(tick);
  }
  function drop(item) { const i = S.list.indexOf(item); if (i >= 0) S.list.splice(i, 1); item.el.remove(); }
  function place(item) {
    const xy = o.toScreen(item.p);
    if (!xy) { item.el.style.display = 'none'; return; }
    item.el.style.display = ''; item.el.style.transform = `translate(${xy[0]}px,${xy[1]}px)`;
  }
  function tick() { S.raf = 0; for (const it of S.list) place(it); if (S.list.length) S.raf = requestAnimationFrame(tick); }

  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; S.mx = e.clientX; S.my = e.clientY; if (S.open) paint(); }, true);
  addEventListener('keydown', e => {
    if (e.code !== 'KeyG' || e.repeat) return;
    if (e.target.closest && e.target.closest('input,textarea')) return;
    e.preventDefault(); open();
  });
  addEventListener('keyup', e => { if (e.code === 'KeyG') close(true); });
  addEventListener('blur', () => close(false));

  return {
    /** 다른 사람이 찍은 핑 */
    receive(m) { if (m && PING_KINDS[m.k] && m.p != null) show(m.k, m.p, String(m.name || '누군가').slice(0, 12)); },
    isOpen: () => S.open,
    clear() { for (const it of [...S.list]) drop(it); },
  };
}
