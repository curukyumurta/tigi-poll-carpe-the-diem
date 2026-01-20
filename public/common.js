// ---------- Player ID ----------
export function getPlayerId() {
  const k = "tigi_player_id";
  let v = localStorage.getItem(k);
  if (!v) {
    v = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now();
    localStorage.setItem(k, v);
  }
  return v;
}

// ---------- Colors ----------
export const GREENS = ["#7CFF6B", "#32CD32", "#1E7F3A"];

// ---------- 8-bit SFX ----------
export const SFX = (() => {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);
  }

  async function unlock() {
    ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  function tone({ freq = 440, when = 0, attack = 0.001, decay = 0.03, vol = 0.85, type = "square" } = {}) {
    ensure();
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);

    osc.connect(g);
    g.connect(master);

    osc.start(t0);
    osc.stop(t0 + attack + decay + 0.02);
  }

  async function clickA() {
    await unlock();
    tone({ freq: 988, decay: 0.02, vol: 0.85 });
    tone({ freq: 1319, when: 0.03, decay: 0.02, vol: 0.6 });
  }

  async function clickB() {
    await unlock();
    tone({ freq: 659, decay: 0.03, vol: 0.85 });
    tone({ freq: 523, when: 0.04, decay: 0.03, vol: 0.7 });
  }

  async function roundStart() {
    await unlock();
    const notes = [784, 988, 1175, 1568, 1175];
    notes.forEach((freq, i) => {
      tone({ freq, when: i * 0.08, decay: 0.06, vol: 0.75, type: "square" });
    });
  }

  // 🔴 SECRET: 10 pes bip + hafif vibrato
  async function secretBuzz() {
    await unlock();

    const baseFreq = 130;
    const vibrato = 4;
    const hits = 10;
    const step = 0.07;
    const decay = 0.055;

    for (let i = 0; i < hits; i++) {
      const wobble = Math.sin(i * 0.9) * vibrato;
      tone({
        freq: baseFreq + wobble,
        when: i * step,
        decay,
        vol: 0.9,
        type: "square"
      });
    }
  }

  // 🙂 TROLLFACE: 25 nota, 2 frekans, makine gibi rahatsiz
  async function plotSmile() {
    await unlock();

    const f1 = 370;
    const f2 = 415;
    const total = 25;
    const step = 0.045;
    const decay = 0.035;

    for (let i = 0; i < total; i++) {
      const freq = i % 2 === 0 ? f1 : f2;
      tone({
        freq,
        when: i * step,
        decay,
        vol: 0.85,
        type: "square"
      });
    }
  }

  // 🟥 OYUN BITTI: 25 nota, tiz + daha vibratolu
  async function plotGameOver() {
    await unlock();

    const base1 = 980;    // tiz
    const base2 = 1180;   // daha tiz
    const total = 25;
    const step = 0.04;    // makine gibi
    const decay = 0.03;

    const vibrato = 28;   // daha vibratolu (Hz)
    // (not: burada vibrato "nota başına" dalgalanıyor, kulağa titrek gelir)

    for (let i = 0; i < total; i++) {
      const base = i % 2 === 0 ? base1 : base2;
      const wobble = Math.sin(i * 1.7) * vibrato;

      tone({
        freq: base + wobble,
        when: i * step,
        decay,
        vol: 0.9,
        type: "square"
      });
    }
  }

  return { clickA, clickB, roundStart, secretBuzz, plotSmile, plotGameOver };
})();

// ---------- Canvas helpers ----------
export function setupCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener("resize", resize);
  return { ctx, resize };
}

export function clearCanvas(ctx, canvas) {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
}

export function drawPixel(ctx, canvas, { x01, y01, size = 8, color = "#32CD32" }) {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;
  const x = Math.floor(x01 * (w - size));
  const y = Math.floor(y01 * (h - size));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
}

// ---------- UI helpers ----------
export function setLevelText(el, level) {
  el.textContent = `LEVEL ${level}`;
}

export function renderTimeBlocks(container, remainingMs, totalMs) {
  const n = 10;
  const per = totalMs / n;
  const left = Math.max(0, remainingMs);
  const blocksOn = Math.ceil(left / per);

  container.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const b = document.createElement("div");
    b.className = "timeBlock";
    if (i >= blocksOn) b.style.opacity = "0";
    container.appendChild(b);
  }
}
