class CaseGrid {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");
    this.pixelRatio = 1;
    this.color = this.getGridColor();
    this.startOffset = 40;
    this.step = 40;
    this.resize();
  }

  getGridColor() {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--grid-line-color");
    return value && value.trim() ? value.trim() : "rgba(0,0,0,0.08)";
  }

  resize() {
    if (!this.canvas) {
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

class MorphingStar {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.color = options.color || "#CC0E1F";
    this.size = options.size || 80;
    this.sampleCount = options.sampleCount || 120;
    this.duration = options.duration || 0.6;

    this.ctx = this.canvas.getContext("2d");

    this.starShapeDefs = [
      "M24 0L24.0837 1.39581C24.8106 13.5197 34.4803 23.1894 46.6042 23.9163L48 24L46.6042 24.0837C34.4803 24.8106 24.8106 34.4803 24.0837 46.6042L24 48L23.9163 46.6042C23.1894 34.4803 13.5197 24.8106 1.39581 24.0837L0 24L1.39581 23.9163C13.5197 23.1894 23.1894 13.5197 23.9163 1.39581L24 0Z",
      "M24 4C35.0457 4 44 12.9543 44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4Z",
      "M24 2L29.39 17.51H46L32.3 27.5L37.7 43L24 33L10.3 43L15.7 27.5L2 17.51H18.61L24 2Z",
      "M24 4L28.28 15.72L40 20L28.28 24.28L24 36L19.72 24.28L8 20L19.72 15.72L24 4Z",
      "M24 2L46 24L24 46L2 24Z",
      "M12 4L36 4L44 24L36 44L12 44L4 24Z",
      "M24 2L28 16H46L32 24L46 32H28L24 46L20 32H2L16 24L2 16H20L24 2Z",
      "M24 2L46 46H2Z",
      "M24 0L28 12L40 8L36 20L48 24L36 28L40 40L28 36L24 48L20 36L8 40L12 28L0 24L12 20L8 8L20 12Z",
      "M4 24C4 14.0589 12.9543 6 24 6C35.0457 6 44 14.0589 44 24C44 33.9411 35.0457 42 24 42C12.9543 42 4 33.9411 4 24Z"
    ];

    this.starShapes = this.starShapeDefs.map(def => this.samplePathDefinition(def, this.sampleCount));
    this.star = {
      points: this.clonePointSet(this.starShapes[0]),
      shapeIndex: 0,
      animation: null
    };

    this.lastFrame = performance.now();
    this.pixelRatio = 1;

    this.updateCanvasScale();
    this.resetAnimation(this.star, true);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  updateCanvasScale() {
    const ratio = window.devicePixelRatio || 1;
    if (this.pixelRatio === ratio && this.canvas.width) {
      return;
    }
    this.pixelRatio = ratio;
    const target = Math.round(this.size * ratio);
    this.canvas.width = target;
    this.canvas.height = target;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(ratio, ratio);
  }

  loop(timestamp) {
    const dt = (timestamp - this.lastFrame) / 1000;
    this.lastFrame = timestamp;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    if (!this.star.animation) {
      this.resetAnimation(this.star, true);
    }
    const anim = this.star.animation;
    if (!anim) {
      return;
    }
    anim.elapsed += dt;
    let progress = anim.elapsed / anim.duration;
    if (progress >= 1) {
      progress = 1;
    }
    const eased = this.easeInOutQuad(progress);
    const { from, to } = anim;
    const count = Math.min(from.length, to.length, this.star.points.length);
    for (let i = 0; i < count; i += 1) {
      const a = from[i];
      const b = to[i];
      this.star.points[i].x = a.x + (b.x - a.x) * eased;
      this.star.points[i].y = a.y + (b.y - a.y) * eased;
    }
    if (progress >= 1) {
      this.star.shapeIndex = anim.nextIndex;
      this.star.points = this.clonePointSet(this.starShapes[this.star.shapeIndex]);
      this.resetAnimation(this.star);
    }
  }

  render() {
    const size = this.size;
    this.ctx.clearRect(0, 0, size, size);
    const scale = size / 48;
    const points = this.star.points;
    if (!points || !points.length) {
      return;
    }
    this.ctx.save();
    this.ctx.translate(size / 2, size / 2);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-24, -24);
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = this.color;
    this.ctx.fill();
    this.ctx.restore();
  }

  resetAnimation(star, initial = false) {
    const nextIndex = this.pickNextStarShapeIndex(star.shapeIndex);
    const duration = this.duration;
    star.animation = {
      duration,
      elapsed: initial ? Math.random() * duration * 0.4 : 0,
      from: this.clonePointSet(star.points),
      to: this.clonePointSet(this.starShapes[nextIndex]),
      nextIndex
    };
  }

  pickNextStarShapeIndex(currentIndex) {
    const total = this.starShapes.length;
    if (total <= 1) {
      return currentIndex || 0;
    }
    let nextIndex = Math.floor(Math.random() * total);
    if (typeof currentIndex === "number" && total > 1) {
      const safety = total * 2;
      let attempts = 0;
      while (nextIndex === currentIndex && attempts < safety) {
        nextIndex = Math.floor(Math.random() * total);
        attempts += 1;
      }
    }
    return nextIndex;
  }

  samplePathDefinition(pathDefinition, sampleCount) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathDefinition);
    const totalLength = path.getTotalLength();
    const points = [];
    for (let i = 0; i < sampleCount; i += 1) {
      const point = path.getPointAtLength((totalLength * i) / sampleCount);
      points.push({ x: point.x, y: point.y });
    }
    return points;
  }

  clonePointSet(points) {
    if (!points || !points.length) {
      return [];
    }
    return points.map(point => ({ x: point.x, y: point.y }));
  }

  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}

function drawStaticStar(canvas, options = {}) {
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  const color = options.color || "#CC0E1F";
  const targetSize = options.size || canvas.clientWidth || canvas.width || 80;
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.round(targetSize * ratio);
  canvas.height = Math.round(targetSize * ratio);
  canvas.style.width = `${targetSize}px`;
  canvas.style.height = `${targetSize}px`;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);

  const center = targetSize / 2;
  const outer = targetSize * 0.32;
  const inner = outer * 0.6;

  ctx.clearRect(0, 0, targetSize, targetSize);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(center, center - outer);
  ctx.quadraticCurveTo(center + inner, center - inner, center + outer, center);
  ctx.quadraticCurveTo(center + inner, center + inner, center, center + outer);
  ctx.quadraticCurveTo(center - inner, center + inner, center - outer, center);
  ctx.quadraticCurveTo(center - inner, center - inner, center, center - outer);
  ctx.closePath();
  ctx.fill();
}

function createStarRing(container, options = {}) {
  const svgNS = "http://www.w3.org/2000/svg";
  const size = options.size || 120;
  const text = options.text || "САМОКАТ";

  const viewBoxSize = options.viewBoxSize || 280;
  const center = viewBoxSize / 2;
  const radius = options.radius || 112;
  const circumference = 2 * Math.PI * radius;

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${viewBoxSize} ${viewBoxSize}`);
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("case-hero__star-ring-svg");
  svg.setAttribute("overflow", "visible");

  const defs = document.createElementNS(svgNS, "defs");
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("id", "case-star-ring-path");
  path.setAttribute(
    "d",
    `M${center} ${center - radius} a ${radius} ${radius} 0 1 1 -0.01 0`
  );
  path.setAttribute("pathLength", `${circumference}`);
  defs.appendChild(path);
  svg.appendChild(defs);

  const textEl = document.createElementNS(svgNS, "text");
  textEl.classList.add("case-hero__star-ring-text");
  textEl.setAttribute("xml:space", "preserve");
  const textPath = document.createElementNS(svgNS, "textPath");
  textPath.setAttribute("href", "#case-star-ring-path");
  textPath.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#case-star-ring-path");
  textPath.setAttribute("textLength", `${circumference}`);
  textPath.setAttribute("lengthAdjust", "spacing");
  textPath.setAttribute("startOffset", "0");

  const upper = text.toUpperCase();
  const repeatCount = options.repeatCount || 3;
  const spacing = options.spacing ?? "      ";
  const gap = options.separator !== undefined ? options.separator : spacing;
  const words = Array.from({ length: repeatCount }, () => upper);
  const content = words.join(gap);
  textPath.textContent = content;

  textEl.appendChild(textPath);
  svg.appendChild(textEl);

  const wrapper = document.createElement("div");
  wrapper.className = "case-hero__star-ring";
  wrapper.appendChild(svg);
  container.appendChild(wrapper);

  return wrapper;
}

document.addEventListener("DOMContentLoaded", () => {
  const gridCanvas = document.getElementById("caseGridCanvas");
  const grid = gridCanvas ? new CaseGrid(gridCanvas) : null;

  const container = document.getElementById("caseStar");
  let starCanvas = null;
  if (container) {
    createStarRing(container, {
      size: 160,
      text: "САМОКАТ",
      viewBoxSize: 280,
      radius: 112,
      repeatCount: 3,
      spacing: ""
    });
    const canvas = document.createElement("canvas");
    canvas.className = "case-hero__star-canvas";
    canvas.width = canvas.height = 80;
    container.appendChild(canvas);
    starCanvas = canvas;
    drawStaticStar(canvas, { size: 90, color: "#CC0E1F" });
  }

  const handleResize = () => {
    if (grid) {
      grid.resize();
    }
    if (starCanvas) {
      drawStaticStar(starCanvas, { size: 90, color: "#CC0E1F" });
    }
  };

  window.addEventListener("resize", handleResize);

  setupCaseLoader();
  setupCaseSlider();
  setupAutoPlayVideos();
  setupScrollVideos();
  applyNonBreakingSpaces();
  setupCrossLinkHover();
});

function setupCaseLoader() {
  const body = document.body;
  if (!body.classList.contains("case-page")) return;

  const loader = document.querySelector(".case-loader");
  if (!loader) return;

  const prevOverflow = body.style.overflow;
  body.style.overflow = "hidden";

  const minVisibleMs = 400;
  const startedAt = performance.now();

  const hideLoader = () => {
    const elapsed = performance.now() - startedAt;
    const wait = Math.max(0, minVisibleMs - elapsed);
    window.setTimeout(() => {
      loader.classList.add("is-hidden");
      loader.addEventListener(
        "transitionend",
        () => {
          loader.remove();
          body.style.overflow = prevOverflow;
        },
        { once: true }
      );
    }, wait);
  };

  if (document.readyState === "complete") {
    hideLoader();
  } else {
    window.addEventListener("load", hideLoader, { once: true });
  }
}

function setupCaseSlider() {
  const slider = document.querySelector("[data-case-slider]");
  if (!slider) {
    return;
  }

  const slides = Array.from(slider.querySelectorAll(".case-slider__slide"));
  const prevBtn = slider.querySelector("[data-case-slider-prev]");
  const nextBtn = slider.querySelector("[data-case-slider-next]");

  if (!slides.length || !prevBtn || !nextBtn) {
    return;
  }

  let current = 0;

  const setActive = (index) => {
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === index);
    });
    current = index;
  };

  const move = (direction) => {
    const total = slides.length;
    const next = (current + direction + total) % total;
    setActive(next);
  };

  prevBtn.addEventListener("click", () => move(-1));
  nextBtn.addEventListener("click", () => move(1));
  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
  });

  setActive(0);
}

function setupAutoPlayVideos() {
  const videoWrappers = Array.from(document.querySelectorAll("[data-video]"));
  if (!videoWrappers.length) {
    return;
  }

  const videos = videoWrappers
    .map((wrap) => {
      const video = wrap.querySelector("video, .case-video__el");
      if (!video) {
        return null;
      }
      video.muted = true;
      video.playsInline = true;
      if (!video.hasAttribute("preload")) {
        video.preload = "metadata";
      }
      return {
        wrap,
        el: video,
        lastInZone: 0,
      };
    })
    .filter(Boolean);

  if (!videos.length) {
    return;
  }

  let active = null;
  let scheduled = false;
  let pendingCandidate = null;
  let debounceTimer = null;

  const startZone = { top: 0.35, bottom: 0.65 };
  const keepZone = { top: 0.25, bottom: 0.75 };
  const resetTimeoutMs = 10000;
  const debounceMs = 180;

  const pauseVideo = (item) => {
    if (!item) return;
    item.el.pause();
    item.el.classList.remove("is-playing");
  };

  const playVideo = (item) => {
    if (!item) return;
    item.el.classList.add("is-playing");
    const now = performance.now();
    item.lastInZone = now;
    item.el.play().catch(() => {
      // noop if browser blocks autoplay; user can manually start
    });
  };

  const chooseCandidate = () => {
    const vh = window.innerHeight;
    const center = vh / 2;
    const candidates = [];

    videos.forEach((item) => {
      const rect = item.el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const norm = mid / vh;
      const inKeep =
        norm >= keepZone.top && norm <= keepZone.bottom && rect.height > 0;
      const inStart =
        norm >= startZone.top && norm <= startZone.bottom && rect.height > 0;

      item.inKeep = inKeep;
      item.inStart = inStart;
      item.distance = Math.abs(mid - center);
    });

    // If active is out of keep zone, pause it
    if (active && !active.inKeep) {
      pauseVideo(active);
      active = null;
    }

    const nearest = videos
      .filter((v) => v.inStart)
      .sort((a, b) => a.distance - b.distance)[0];

    if (!nearest) {
      return;
    }

    if (active && active === nearest) {
      return;
    }

    pendingCandidate = nearest;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      if (pendingCandidate && pendingCandidate.inStart) {
        if (active && active !== pendingCandidate) {
          pauseVideo(active);
        }
        active = pendingCandidate;
        playVideo(active);
      }
    }, debounceMs);
  };

  const tick = () => {
    scheduled = false;
    chooseCandidate();
  };

  const requestTick = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(tick);
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      if (!document.hidden) {
        requestTick();
      }
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] }
  );

  videos.forEach((item) => io.observe(item.el));
  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      videos.forEach((v) => pauseVideo(v));
      active = null;
    }
  });

  requestTick();
}

function setupScrollVideos() {
  const videos = Array.from(document.querySelectorAll(".scroll-video"));
  if (!videos.length) {
    return;
  }

  const ensureIndicator = (video) => {
    const wrapper = video.closest(".case-video-wrap") || video.parentElement;
    if (wrapper) {
      wrapper.classList.add("case-video-wrap");
    }
    let indicator = wrapper ? wrapper.querySelector(".tap-indicator") : null;
    if (!indicator && wrapper) {
      indicator = document.createElement("div");
      indicator.className = "tap-indicator";
      indicator.setAttribute("aria-hidden", "true");
      wrapper.appendChild(indicator);
    }
    return { wrapper, indicator };
  };

  const items = videos.map((video) => {
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.controls = false;
    if (!video.hasAttribute("preload")) {
      video.preload = "metadata";
    }
    const { wrapper, indicator } = ensureIndicator(video);
    return {
      el: video,
      wrapper,
      indicator,
      isUserPaused: false,
      hideTimer: null,
    };
  });

  const itemByVideo = new Map(items.map((item) => [item.el, item]));

  let active = null;
  let hasInteracted = false;
  let scheduled = false;
  let debounceTimer = null;
  const debounceMs = 150;
  const zone = { top: 0.3, bottom: 0.7 };

  const showIndicator = (item, state) => {
    if (!item || !item.indicator) return;
    if (item.hideTimer) {
      clearTimeout(item.hideTimer);
      item.hideTimer = null;
    }
    const svg = state === "pause"
      ? '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 10h8v28h-8zM26 10h8v28h-8z"/></svg>'
      : '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 10l20 14-20 14z"/></svg>';
    item.indicator.innerHTML = svg;
    item.indicator.classList.add("is-visible");
    item.hideTimer = window.setTimeout(() => {
      item.indicator.classList.remove("is-visible");
      item.hideTimer = null;
    }, 520);
  };

  const pauseItem = (item, { fromUser = false } = {}) => {
    if (!item) return;
    item.el.pause();
    if (fromUser) {
      item.isUserPaused = true;
    }
    item.el.classList.remove("is-playing");
    if (fromUser) {
      showIndicator(item, "pause");
    }
  };

  const pauseOthers = (except) => {
    items.forEach((other) => {
      if (other !== except) {
        pauseItem(other);
      }
    });
  };

  const playItem = (item, { fromUser = false } = {}) => {
    if (!item) return;
    if (item.isUserPaused && !fromUser) return;
    pauseOthers(item);
    item.isUserPaused = false;
    item.el.classList.add("is-playing");
    item.el.play().catch(() => {});
    if (fromUser) {
      showIndicator(item, "play");
    }
  };

  items.forEach((item) => {
    if (item.wrapper) {
      item.wrapper.addEventListener("click", () => {
        hasInteracted = true;
        const playing = !item.el.paused && !item.el.ended && !item.isUserPaused;
        if (playing) {
          pauseItem(item, { fromUser: true });
        } else {
          playItem(item, { fromUser: true });
          active = item;
        }
      });
    }
  });

  const evaluate = () => {
    scheduled = false;
    if (!hasInteracted || document.hidden) {
      return;
    }
    const vh = window.innerHeight || 1;
    const centerY = vh / 2;

    const candidates = items
      .map((item) => {
        const rect = item.el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const norm = mid / vh;
        const inZone = norm >= zone.top && norm <= zone.bottom;
        return {
          item,
          inZone,
          distance: Math.abs(mid - centerY),
        };
      })
      .filter((c) => c.inZone)
      .sort((a, b) => a.distance - b.distance);

    const next = candidates.find((c) => !c.item.isUserPaused)?.item || null;

    if (next && next !== active) {
      if (active) pauseItem(active);
      active = next;
      playItem(active);
    } else if (!next && active) {
      pauseItem(active);
      active = null;
    }
  };

  const scheduleEval = () => {
    if (!hasInteracted) return;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(evaluate);
      }
    }, debounceMs);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const item = itemByVideo.get(entry.target);
        if (!item) return;
        if (entry.intersectionRatio === 0) {
          item.isUserPaused = false;
          pauseItem(item);
          if (item === active) {
            active = null;
          }
        }
      });
      scheduleEval();
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] }
  );

  items.forEach((v) => io.observe(v.el));

  const onFirstInteraction = () => {
    hasInteracted = true;
    scheduleEval();
    window.removeEventListener("scroll", onFirstInteraction);
    window.removeEventListener("touchstart", onFirstInteraction);
  };

  window.addEventListener("scroll", onFirstInteraction, { passive: true });
  window.addEventListener("touchstart", onFirstInteraction, { passive: true });
  window.addEventListener("scroll", scheduleEval, { passive: true });
  window.addEventListener("resize", scheduleEval);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      items.forEach((item) => pauseItem(item));
      active = null;
    }
  });
}

function applyNonBreakingSpaces() {
  const prepositions = [
    "и",
    "в",
    "на",
    "с",
    "к",
    "у",
    "о",
    "а",
    "но",
    "да",
    "по",
    "из",
    "за",
    "над",
    "под",
    "при",
    "без",
    "для",
    "от",
    "до",
    "об",
    "про"
  ];

  const pattern = new RegExp(`\\b(${prepositions.join("|")})\\s+`, "gi");
  const skipTags = new Set(["script", "style", "textarea"]);

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentNode;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.nodeName.toLowerCase();
        if (skipTags.has(tag)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !pattern.test(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }
        pattern.lastIndex = 0;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const toUpdate = [];
  while (walker.nextNode()) {
    toUpdate.push(walker.currentNode);
  }

  toUpdate.forEach((node) => {
    node.nodeValue = node.nodeValue.replace(pattern, (match, prep) => {
      return `${prep}\u00A0`;
    });
  });
}

function setupCrossLinkHover() {
  const links = document.querySelectorAll(".case-crosslink.info-panel__link");
  if (!links.length) {
    return;
  }
  links.forEach((link) => {
    link.addEventListener("mouseenter", () => spawnHoverStars(link));
  });
}

function spawnHoverStars(link) {
  const existing = link.querySelectorAll(".hover-star");
  existing.forEach((star) => star.remove());

  const rect = link.getBoundingClientRect();
  const starCount = 6 + Math.floor(Math.random() * 3);

  for (let i = 0; i < starCount; i += 1) {
    const starWrapper = document.createElement("span");
    starWrapper.className = "hover-star";

    const size = 10 + Math.random() * 18;
    const opacity = 0.35 + Math.random() * 0.45;
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.max(rect.width, 60) * (0.4 + Math.random() * 0.6);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const duration = 600 + Math.random() * 400;

    starWrapper.style.setProperty("--size", `${size}px`);
    starWrapper.style.setProperty("--opacity", opacity.toFixed(2));
    starWrapper.style.setProperty("--dx", `${dx.toFixed(1)}px`);
    starWrapper.style.setProperty("--dy", `${dy.toFixed(1)}px`);
    starWrapper.style.setProperty("--duration", `${duration}ms`);

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 48 48");
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute(
      "d",
      "M24 0C24 13.2548 34.7452 24 48 24C34.7452 24 24 34.7452 24 48C24 34.7452 13.2548 24 0 24C13.2548 24 24 13.2548 24 0Z"
    );
    svg.appendChild(path);
    starWrapper.appendChild(svg);

    const removeAfterAnimation = () => {
      starWrapper.removeEventListener("animationend", removeAfterAnimation);
      starWrapper.remove();
    };
    starWrapper.addEventListener("animationend", removeAfterAnimation);

    link.appendChild(starWrapper);
  }
}
