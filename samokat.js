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

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("caseStar");
  if (!container) {
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.className = "case-hero__star-canvas";
  canvas.width = canvas.height = 80;
  container.appendChild(canvas);
  const star = new MorphingStar(canvas, { size: 80, color: "#CC0E1F" });
  window.addEventListener("resize", () => star.updateCanvasScale());
});
