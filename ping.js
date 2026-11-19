/* 핑 — 롤 핑처럼 G(한글 ㅎ)를 누르면 커서가 바뀌고, 클릭한 자리에 X자로 나뉜 원판이 뜬다.
   왼쪽 ? 미아, 위 ! 위험, 오른쪽 갑니다, 아래·가운데 취소. 연속 3번까지, 3번 찍으면 5초 쉰다.
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

/* G를 누른 뒤 클릭할 때까지 바뀌는 커서: 금색 조준 고리 */
const CURSOR = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="none" stroke="#160f08" stroke-width="5"/><circle cx="16" cy="16" r="10" fill="none" stroke="#e2c27a" stroke-width="2.4"/><path d="M16 1v7M16 24v7M1 16h7M24 16h7" stroke="#160f08" stroke-width="5" stroke-linecap="round"/><path d="M16 2v6M16 24v6M2 16h6M24 16h6" stroke="#e2c27a" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="16" r="2.6" fill="#e2c27a" stroke="#160f08" stroke-width="1.2"/></svg>')}")`;
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
.pg-wheel .cd{font:800 22px/1 system-ui,sans-serif;fill:#f3ead8}
.pg-wheel.cool{opacity:.55}
html.pg-aim,html.pg-aim *{cursor:${CURSOR} 16 16,crosshair!important}
.pg{position:fixed;left:0;top:0;width:0;height:0}
.pg svg{position:absolute;left:-36px;top:-42px;width:72px;height:72px;overflow:visible;animation:pg-pop .34s cubic-bezier(.3,1.6,.5,1)}
.pg u{position:absolute;left:-20px;top:-8px;width:40px;height:16px;border-radius:50%;border:2.5px solid;animation:pg-ring .9s ease-out 3}
.pg span{position:absolute;left:0;top:34px;transform:translateX(-50%);padding:2px 9px;border-radius:999px;background:#141716e0;border:1px solid #c8aa6e88;color:#f3ead8;font:600 12px/1.4 system-ui,sans-serif;white-space:nowrap}
.pg.out{transition:opacity .4s;opacity:0}
@keyframes pg-pop{from{transform:translateY(-14px) scale(.3);opacity:0}to{transform:none;opacity:1}}
@keyframes pg-ring{from{transform:scale(.6);opacity:1}to{transform:scale(2.4);opacity:0}}
`;

/* 원판: 가운데 (116,116), 네 칸은 X자로 나뉜다(위·오른쪽·아래·왼쪽) */
const C = 116, R = 104, r = 27, RI = 66;
const pt = (rad, deg) => { const a = deg * Math.PI / 180; return `${(C + rad * Math.cos(a)).toFixed(2)} ${(C + rad * Math.sin(a)).toFixed(2)}`; };
const sector = deg => `M${pt(r, deg - 45)} L${pt(R, deg - 45)} A${R} ${R} 0 0 1 ${pt(R, deg + 45)} L${pt(r, deg + 45)} A${r} ${r} 0 0 0 ${pt(r, deg - 45)} Z`;
const SLOTS = [['d', -90], ['go', 0], ['x', 90], ['q', 180]];
function wheelSVG() {
  let h = `<svg width="232" height="232" viewBox="0 0 232 232">`;
  h += `<circle cx="${C}" cy="${C}" r="${R + 5}" fill="none" stroke="#785a28" stroke-width="4"/>`;
  for (const [k, deg] of SLOTS) h += `<path class="sec" data-k="${k}" d="${sector(deg)}"/>`;
  h += `<circle cx="${C}" cy="${C}" r="${R + 1.5}" fill="none" stroke="#c8aa6e" stroke-width="1.6"/>`;
  for (const [k, deg] of SLOTS) {
    const a = deg * Math.PI / 180, x = C + RI * Math.cos(a), y = C + RI * Math.sin(a);
    h += `<g class="ic" data-k="${k}" style="transform-origin:${x}px ${y}px"><g transform="translate(${x} ${y}) scale(${k === 'x' ? 1.15 : 1.22})">${glyph(k)}</g></g>`;
  }
  h += `<circle class="ctr" cx="${C}" cy="${C}" r="${r - 4}"/><g class="cx" transform="translate(${C} ${C}) scale(.75)">${glyph('x')}</g>`;
  h += `<text class="cd" x="${C}" y="${C + 8}" text-anchor="middle"></text>`;
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
  wheel.innerHTML = wheelSVG();
  layer.appendChild(wheel);
  const gate = pingGate();
  // aim: G를 눌러 클릭을 기다리는 중(커서가 바뀜). open: 원판이 떠 있음. drag: 누른 채 끄는 중
  const S = { aim: false, open: false, drag: false, cx: 0, cy: 0, mx: innerWidth / 2, my: innerHeight / 2, sel: null, list: [], raf: 0 };

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
    const w = gate.wait();   // 쉬는 중이면 가운데에 남은 초
    wheel.classList.toggle('cool', w > 0);
    wheel.querySelector('.cd').textContent = w > 0 ? Math.ceil(w / 1000) : '';
    wheel.querySelector('.cx').style.display = w > 0 ? 'none' : '';
  }
  function setAim(on) {
    S.aim = on; document.documentElement.classList.toggle('pg-aim', on);
  }
  function open(x, y) {
    S.open = true; S.cx = x; S.cy = y;
    wheel.style.left = S.cx + 'px'; wheel.style.top = S.cy + 'px'; wheel.hidden = false;
    paint();
    clearInterval(S.coolT); if (gate.wait() > 0) S.coolT = setInterval(paint, 250);
  }
  function close(fire) {
    const k = S.sel, was = S.open;
    S.open = false; S.drag = false; wheel.hidden = true; clearInterval(S.coolT); setAim(false);
    if (!was || !fire || !PING_KINDS[k] || !o.canPing() || !gate.take()) return;
    const p = o.fromScreen(S.cx, S.cy);
    show(k, p, '나');
    try { o.send({ k, p }); } catch {}
  }
  function show(k, p, name) {
    const kind = PING_KINDS[k]; if (!kind) return;
    playSound(k);
    const el = document.createElement('div'); el.className = 'pg';
    el.innerHTML = `<u style="border-color:${kind.color}"></u><svg viewBox="-30 -30 60 60" style="filter:drop-shadow(0 0 6px ${kind.color}aa) drop-shadow(0 2px 3px #000a)">${glyph(k)}</svg><span></span>`;
    el.querySelector('span').textContent = name;
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

  // G → 커서가 바뀌고, 클릭한 자리에 원판이 뜬다. 누른 채 끌어 고르고 떼면 찍힌다.
  // 끌지 않고 바로 떼면 원판이 남아 있어 칸을 한 번 더 누르면 된다. G·Esc·우클릭은 취소
  const busy = () => S.aim || S.open;
  const swallow = () => performance.now() < (S.eatUntil || 0);   // 핑을 끝낸 직후 뒤따르는 떼기·클릭이 게임에 가지 않게
  const eat = e => { e.stopPropagation(); e.preventDefault(); };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    S.mx = e.clientX; S.my = e.clientY;
    if (S.open) paint();
  }, true);
  addEventListener('pointerdown', e => {
    if (!busy() || e.pointerType !== 'mouse') return;
    eat(e); S.eatUntil = performance.now() + 1500;
    if (e.button !== 0 || !o.canPing()) return close(false);
    S.mx = e.clientX; S.my = e.clientY;
    if (!S.open) { open(e.clientX, e.clientY); S.drag = true; return; }
    S.drag = false; paint();                    // 떠 있는 원판에서 칸을 누름(떼는 쪽은 위에서 먹는다)
    S.sel === null ? close(false) : close(true);
  }, true);
  addEventListener('pointerup', e => {
    if (!(busy() || swallow()) || e.pointerType !== 'mouse') return;
    eat(e); S.eatUntil = performance.now() + 60;   // 뒤따르는 click 까지
    if (!S.open || !S.drag) return;
    S.drag = false; paint();
    if (S.sel !== null) close(true);            // 끌어서 고른 칸. 가운데에서 떼면 원판을 남긴다
  }, true);
  for (const t of ['click', 'mousedown', 'mouseup', 'contextmenu']) addEventListener(t, e => { if (busy() || swallow()) eat(e); }, true);
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.code === 'Escape' && busy()) { eat(e); return close(false); }
    if (e.code !== 'KeyG' || e.repeat) return;
    e.preventDefault();
    if (busy()) return close(false);
    if (o.canPing()) setAim(true);
  }, true);
  addEventListener('blur', () => close(false));
  // 차례가 바뀌어 못 찍게 되면 접는다
  setInterval(() => { if (busy() && !o.canPing()) close(false); }, 300);

  return {
    /** 다른 사람이 찍은 핑 */
    receive(m) { if (m && PING_KINDS[m.k] && m.p != null) show(m.k, m.p, String(m.name || '누군가').slice(0, 12)); },
    isOpen: () => S.open || S.aim,
    clear() { for (const it of [...S.list]) drop(it); },
  };
}
