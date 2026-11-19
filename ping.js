/* 핑 — G(한글 ㅎ)를 누른 채 마우스를 밀어 고르고, 떼면 그 자리에 찍힌다.
   롤 핑처럼 X자로 나뉜 원판: 왼쪽 ? 미아, 위 ! 위험, 오른쪽 갑니다, 아래·가운데 취소. 연속 3번까지, 3번 찍으면 5초 쉰다.
   자리는 게임이 정한다: 2D는 월드 좌표, 3D는 화면 비율(0~1). 의자 쌓기 2D·3D가 같은 파일을 쓴다.
   찍힐 때 종류마다 소리가 난다(sounds/question·danger·omw.mp3) */

export const PING_KINDS = {
  q:  { label: '미아!',   color: '#e2b04a', sound: 'question' },
  d:  { label: '위험!',   color: '#e8443a', sound: 'danger' },
  go: { label: '갑니다!', color: '#2fb59b', sound: 'omw' },
};
/* 롤 핑처럼 생긴 아이콘. (0,0) 가운데, 대략 ±22 크기 */
const INK = '#160f08';
function glyph(k) {
  if (k === 'd') return `<path d="M-6.5 -22 L6.5 -22 L3 7 L-3 7 Z" fill="#e8443a" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cy="15" r="5" fill="#e8443a" stroke="${INK}" stroke-width="2.4"/>`;
  if (k === 'q') return `<text y="15" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="900" font-size="44" fill="#e2b04a" stroke="${INK}" stroke-width="2.4" paint-order="stroke">?</text>`;
  if (k === 'go') return `<path d="M-3.5 -22 H3.5 V-2 H-3.5 Z" fill="#2fb59b" stroke="${INK}" stroke-width="2.2"/><path d="M-19 -9 L0 6 L19 -9 L19 2 L0 19 L-19 2 Z" fill="#2fb59b" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`;
  return `<path d="M-9 -9 L9 9 M9 -9 L-9 9" stroke="#e9dcc0" stroke-width="3.4" stroke-linecap="round"/>`;
}
/* 소리: 이 파일 옆 sounds/*.mp3. 겹쳐 찍혀도 끊기지 않게 매번 복제해서 튼다 */
const SOUNDS = {};
for (const k in PING_KINDS) {
  const a = new Audio(new URL(`./sounds/${PING_KINDS[k].sound}.mp3`, import.meta.url).href);
  a.preload = 'auto'; a.volume = .6; SOUNDS[k] = a;
}
function playSound(k) {
  const a = SOUNDS[k]; if (!a) return;
  try { const c = a.cloneNode(); c.volume = a.volume; const p = c.play(); if (p) p.catch(() => {}); } catch {}
}
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
.pg-wheel{position:fixed;width:232px;height:232px;margin:-116px 0 0 -116px;filter:drop-shadow(0 6px 18px #0007)}
.pg-wheel svg{display:block;overflow:visible}
.pg-wheel .sec{fill:#141716e6;stroke:#c8aa6e;stroke-width:1.4;transition:fill .08s}
.pg-wheel .sec.on{fill:#4d4128f2}
.pg-wheel .ctr{fill:#101312;stroke:#c8aa6e;stroke-width:2}
.pg-wheel .ctr.on{fill:#3a3322}
.pg-wheel .ic{transition:transform .08s;opacity:.82}
.pg-wheel .ic.on{opacity:1}
.pg-wheel .lb{font:700 12.5px/1 system-ui,sans-serif;fill:#f3ead8;stroke:#000c;stroke-width:3;paint-order:stroke}
.pg-wheel.cool{opacity:.55}
.pg-wheel s{position:absolute;left:-40px;right:-40px;top:100%;margin-top:6px;text-align:center;text-decoration:none;font:600 12.5px/1.3 system-ui,sans-serif;color:#f3ead8;text-shadow:0 1px 3px #000c;white-space:nowrap}
.pg{position:fixed;left:0;top:0;width:0;height:0}
.pg svg{position:absolute;left:-36px;top:-42px;width:72px;height:72px;overflow:visible;animation:pg-pop .34s cubic-bezier(.3,1.6,.5,1)}
.pg u{position:absolute;left:-20px;top:-8px;width:40px;height:16px;border-radius:50%;border:2.5px solid;animation:pg-ring .9s ease-out 3}
.pg span{position:absolute;left:0;top:34px;transform:translateX(-50%);padding:2px 9px;border-radius:999px;background:#141716e0;border:1px solid #c8aa6e88;color:#f3ead8;font:600 12px/1.4 system-ui,sans-serif;white-space:nowrap}
.pg.out{transition:opacity .4s;opacity:0}
@keyframes pg-pop{from{transform:translateY(-14px) scale(.3);opacity:0}to{transform:none;opacity:1}}
@keyframes pg-ring{from{transform:scale(.6);opacity:1}to{transform:scale(2.4);opacity:0}}
`;

/* 원판: 가운데 (116,116), 네 칸은 X자로 나뉜다(위·오른쪽·아래·왼쪽) */
const C = 116, R = 104, r = 27, RI = 64;
const pt = (rad, deg) => { const a = deg * Math.PI / 180; return `${(C + rad * Math.cos(a)).toFixed(2)} ${(C + rad * Math.sin(a)).toFixed(2)}`; };
const sector = deg => `M${pt(r, deg - 45)} L${pt(R, deg - 45)} A${R} ${R} 0 0 1 ${pt(R, deg + 45)} L${pt(r, deg + 45)} A${r} ${r} 0 0 0 ${pt(r, deg - 45)} Z`;
const SLOTS = [['d', -90, '위험!'], ['go', 0, '갑니다!'], ['x', 90, '취소'], ['q', 180, '미아!']];
function wheelSVG() {
  let h = `<svg width="232" height="232" viewBox="0 0 232 232">`;
  h += `<circle cx="${C}" cy="${C}" r="${R + 5}" fill="none" stroke="#785a28" stroke-width="4"/>`;
  for (const [k, deg] of SLOTS) h += `<path class="sec" data-k="${k}" d="${sector(deg)}"/>`;
  h += `<circle cx="${C}" cy="${C}" r="${R + 1.5}" fill="none" stroke="#c8aa6e" stroke-width="1.6"/>`;
  for (const [k, deg, lb] of SLOTS) {
    const a = deg * Math.PI / 180, x = C + RI * Math.cos(a), y = C + RI * Math.sin(a) - 7;
    h += `<g class="ic" data-k="${k}" style="transform-origin:${x}px ${y}px"><g transform="translate(${x} ${y}) scale(${k === 'x' ? .9 : .78})">${glyph(k)}</g></g>`;
    h += `<text class="lb" x="${x}" y="${y + 30}" text-anchor="middle">${lb}</text>`;
  }
  h += `<circle class="ctr" cx="${C}" cy="${C}" r="${r - 4}"/><g transform="translate(${C} ${C}) scale(.75)">${glyph('x')}</g>`;
  return h + `</svg>`;
}

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
  wheel.innerHTML = wheelSVG() + '<s></s>';
  layer.appendChild(wheel);
  const gate = pingGate();
  const S = { open: false, cx: 0, cy: 0, mx: innerWidth / 2, my: innerHeight / 2, sel: null, list: [], raf: 0 };

  const pick = () => {
    const dx = S.mx - S.cx, dy = S.my - S.cy;
    if (Math.hypot(dx, dy) < r) return null;   // 가운데 = 취소
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    return dir === 'down' ? 'x' : DIRS[dir];
  };
  function paint() {
    S.sel = pick();
    for (const el of wheel.querySelectorAll('.sec,.ic')) {
      const on = el.dataset.k === S.sel; el.classList.toggle('on', on);
      if (el.classList.contains('ic')) el.style.transform = on ? 'scale(1.18)' : '';
    }
    wheel.querySelector('.ctr').classList.toggle('on', S.sel === null);
    const w = gate.wait(), left = gate.left();
    wheel.classList.toggle('cool', w > 0);
    wheel.querySelector('s').textContent = w > 0 ? `${Math.ceil(w / 1000)}초 뒤에 다시` : `${left}번 남음`;
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
    playSound(k);
    const el = document.createElement('div'); el.className = 'pg';
    el.innerHTML = `<u style="border-color:${kind.color}"></u><svg viewBox="-30 -30 60 60" style="filter:drop-shadow(0 0 6px ${kind.color}aa) drop-shadow(0 2px 3px #000a)">${glyph(k)}</svg><span></span>`;
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
