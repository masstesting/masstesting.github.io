const STAR_PATH = "M24 0L24.0837 1.39581C24.8106 13.5197 34.4803 23.1894 46.6042 23.9163L48 24L46.6042 24.0837C34.4803 24.8106 24.8106 34.4803 24.0837 46.6042L24 48L23.9163 46.6042C23.1894 34.4803 13.5197 24.8106 1.39581 24.0837L0 24L1.39581 23.9163C13.5197 23.1894 23.1894 13.5197 23.9163 1.39581L24 0Z";
const LETTERS = ["С", "А", "М", "О", "К", "А", "Т"];
const LETTER_POOL_SIZE = 5;
const LETTER_INTERVAL_MS = 2400;
const LETTER_STAGGER_MS = 360;
const LETTER_MIN_SPACING = 40;
const LETTER_VISIBILITY_MS = 2100;

class CaseGrid {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = this.canvas?.getContext("2d") || null;
    this.pixelRatio = 1;
    this.color = this.getGridColor();
    this.startOffset = 40;
    this.step = 40;
    if (this.ctx) {
      this.resize();
    }
  }

  getGridColor() {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--grid-line-color");
    return value && value.trim() ? value.trim() : "rgba(0, 0, 0, 0.05)";
  }

  resize() {
    if (!this.canvas || !this.ctx) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.pixelRatio = ratio;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(ratio, ratio);
    this.draw();
  }

  draw() {
    if (!this.ctx) {
      return;
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1 / this.pixelRatio;

    const startX = this.startOffset;
    const startY = this.startOffset;
    const step = this.step;

    for (let x = startX; x <= width; x += step) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
      ctx.stroke();
    }

    for (let x = startX - step; x >= 0; x -= step) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
      ctx.stroke();
    }

    for (let y = startY; y <= height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
      ctx.stroke();
    }

    for (let y = startY - step; y >= 0; y -= step) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawStaticStar(canvas, { size, color = "#FFFFFF" } = {}) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const fallbackSize = canvas.clientWidth || parseFloat(getComputedStyle(canvas).width) || 90;
  const cssSize = size ?? fallbackSize;
  canvas.width = cssSize * ratio;
  canvas.height = cssSize * ratio;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, cssSize, cssSize);

  const path = new Path2D(STAR_PATH);
  const scale = cssSize / 48;
  ctx.save();
  ctx.translate(cssSize / 2, cssSize / 2);
  ctx.scale(scale, scale);
  ctx.translate(-24, -24);
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.restore();
}

document.addEventListener("DOMContentLoaded", () => {
  const gridCanvas = document.getElementById("caseGridCanvas");
  const grid = gridCanvas ? new CaseGrid(gridCanvas) : null;

  const starHost = document.getElementById("caseStar");
  const letterContainer = document.createElement("div");
  letterContainer.className = "case-hero__letters";

  const letterState = {
    index: 0,
    radiusMin: 48,
    radiusMax: 96,
    activePositions: []
  };

  const updateLetterBounds = () => {
    if (!starHost) {
      return;
    }
    const size = Math.min(starHost.offsetWidth, starHost.offsetHeight);
    letterState.radiusMax = Math.max(70, size * 0.45);
    letterState.radiusMin = Math.max(36, letterState.radiusMax * 0.45);
  };

  const purgeExpiredPositions = () => {
    const now = performance.now();
    letterState.activePositions = letterState.activePositions.filter(pos => pos.expiry > now);
  };

  const pickPosition = () => {
    purgeExpiredPositions();
    let attempts = 0;
    let x = 0;
    let y = 0;
    const maxAttempts = 32;
    do {
      const angle = Math.random() * Math.PI * 2;
      const distance = letterState.radiusMin + Math.random() * (letterState.radiusMax - letterState.radiusMin);
      x = Math.cos(angle) * distance;
      y = Math.sin(angle) * distance;
      attempts += 1;
    } while (
      attempts < maxAttempts &&
      letterState.activePositions.some(pos => Math.hypot(pos.x - x, pos.y - y) < LETTER_MIN_SPACING)
    );
    return { x, y };
  };

  const scheduleLetterLoop = (element, delay = 0) => {
    const trigger = () => {
      const char = LETTERS[letterState.index];
      letterState.index = (letterState.index + 1) % LETTERS.length;

      const { x, y } = pickPosition();
      element.textContent = char;
      element.style.setProperty("--x", `${x}px`);
      element.style.setProperty("--y", `${y}px`);

      element.classList.remove("case-hero__letter--active");
      void element.offsetWidth;
      element.classList.add("case-hero__letter--active");

      letterState.activePositions.push({ x, y, expiry: performance.now() + LETTER_VISIBILITY_MS });

      window.setTimeout(trigger, LETTER_INTERVAL_MS);
    };
    window.setTimeout(trigger, delay);
  };

  if (starHost) {
    const canvas = document.createElement("canvas");
    canvas.className = "case-hero__star-canvas";
    starHost.appendChild(canvas);
    drawStaticStar(canvas, { color: "#FFFFFF" });

    starHost.appendChild(letterContainer);

    const letterElements = Array.from({ length: LETTER_POOL_SIZE }, () => {
      const span = document.createElement("span");
      span.className = "case-hero__letter";
      letterContainer.appendChild(span);
      return span;
    });

    updateLetterBounds();
    letterElements.forEach((element, idx) => {
      scheduleLetterLoop(element, idx * LETTER_STAGGER_MS);
    });
  }

  const handleResize = () => {
    if (grid) {
      grid.resize();
    }
    if (starHost) {
      const canvas = starHost.querySelector(".case-hero__star-canvas");
      if (canvas) {
        drawStaticStar(canvas, { color: "#FFFFFF" });
      }
    }
    updateLetterBounds();
  };

  window.addEventListener("resize", handleResize, { passive: true });
});
