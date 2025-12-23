class TextSnakeGame {
  constructor(canvas, scoreElement, uiSafeZoneProvider = null) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");
    this.scoreElement = scoreElement;

    this.settings = {
      phrase: "Дизайнила в Самокате Озоне и Контуре",
      fontFamily: '"Palui SP", Arial, sans-serif',
      fontWeight: 700,
      fontSize: 32,
      letterColor: getComputedStyle(document.documentElement).getPropertyValue("--letter-color")?.trim() || "#CC0E1F",
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--background-color")?.trim() || "#F2B0C1",
      startOffset: 40,
      gridSize: 40,
      moveSpeed: 220, // pixels per second
      starSizePx: 36,
      starColors: ["#CC0E1F", "#FFFFFF"],
      starsOnField: 4,
      scoreSafeRadiusPx: 160,
      gridLineColor: getComputedStyle(document.documentElement).getPropertyValue("--grid-line-color")?.trim() || "rgba(0,0,0,0.05)",
      showGrid: true
    };

    this.gridSize = this.settings.gridSize;
    this.fullLetters = [...this.settings.phrase];
    this.visibleLetters = this.fullLetters.length;
    this.currentStarSize = this.settings.starSizePx;

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

    this.direction = { dx: 1, dy: 0 };
    this.directionQueue = [];
    this.moveProgress = 0;
    this.score = 0;

    this.snakeCells = [];
    this.prevSnakeCells = [];

    this.stars = [];
    this.lastFrameTime = performance.now();
    this.starSampleCount = 120;
    this.starShapes = this.starShapeDefs.map(def => this.samplePathDefinition(def, this.starSampleCount));
    this.starPops = [];
    this.uiSafeZoneProvider = uiSafeZoneProvider;
    this.uiSafeZones = [];
    if (this.uiSafeZoneProvider) {
      this.setUISafeZones(this.uiSafeZoneProvider());
    }
    this.introMoveTimeouts = [];
    this.userInteracted = false;

    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.loop = this.loop.bind(this);

    this.handleResize();
    this.setupInitialSnake();
    this.ensureStarCount();
    this.updateScoreDisplay();
    this.scheduleIntroMoves();

    window.addEventListener("resize", this.handleResize);
    document.addEventListener("keydown", this.handleKeyDown);
    requestAnimationFrame(this.loop);
  }

  setupInitialSnake() {
    const totalSegments = this.visibleLetters;
    if (totalSegments === 0) {
      this.snakeCells = [{ col: 0, row: 0 }];
      this.prevSnakeCells = [{ col: 0, row: 0 }];
      return;
    }

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const verticalOffset = Math.min(this.canvas.height * 0.35, 320);
    const startPos = this.gridAlignedPosition(centerX, centerY + verticalOffset);
    const headCol = startPos.col;
    const baseRow = startPos.row;

    this.snakeCells = Array.from({ length: totalSegments }, (_, index) => ({
      col: headCol - this.direction.dx * index,
      row: baseRow - this.direction.dy * index
    }));
    this.prevSnakeCells = this.snakeCells.map(cell => ({ ...cell }));
  }

  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    const playableWidth = Math.max(160, this.canvas.width - this.settings.startOffset * 2);
    const playableHeight = Math.max(160, this.canvas.height - this.settings.startOffset * 2);

    const baseColsEstimate = Math.max(8, Math.round(playableWidth / this.settings.gridSize));
    const minColsForPhrase = Math.max(this.visibleLetters + 4, 8);
    this.cols = Math.max(minColsForPhrase, baseColsEstimate);
    this.gridSize = playableWidth / this.cols;

    this.currentStarSize = Math.max(14, Math.min(this.settings.starSizePx, this.gridSize * 0.9));

    this.rows = Math.max(6, Math.floor(playableHeight / this.gridSize));

    this.ctx.textBaseline = "middle";
    this.ctx.textAlign = "center";
    const scaledFontSize = Math.min(this.settings.fontSize, this.gridSize * 0.78);
    this.ctx.font = `${this.settings.fontWeight} ${scaledFontSize}px ${this.settings.fontFamily}`;
    this.currentFontSize = scaledFontSize;

    this.prevSnakeCells = this.snakeCells.map(cell => ({ ...cell }));

    if (this.stars.length) {
      this.stars.forEach((star) => {
        star.col = this.wrapIndex(star.col, this.cols);
        star.row = this.wrapIndex(star.row, this.rows);
      });

      this.stars = this.stars.filter((star) => {
        const pos = this.gridToPixel(star.col, star.row);
        return !this.inScoreSafeZone(pos.x, pos.y) && !this.isInUISafeZone(pos.x, pos.y);
      });
    }

    if (this.uiSafeZoneProvider) {
      this.setUISafeZones(this.uiSafeZoneProvider());
    }

    if (this.snakeCells.length) {
      this.ensureStarCount();
    }
  }

  handleKeyDown(event) {
    const dir = this.mapKeyToDirection(event.key);
    if (!dir) {
      return;
    }

    if (dir.hint) {
      pulseControlHint(dir.hint);
    }

    if (!this.userInteracted) {
      this.userInteracted = true;
      this.clearIntroMoves();
    }

    const lastQueued = this.directionQueue[this.directionQueue.length - 1] || this.direction;
    if (dir.dx === lastQueued.dx && dir.dy === lastQueued.dy) {
      return;
    }

    if (this.snakeCells.length > 1) {
      const opposite = dir.dx === -this.direction.dx && dir.dy === -this.direction.dy;
      if (opposite) {
        return;
      }
    }

    this.directionQueue.push(dir);
  }

  mapKeyToDirection(key) {
    switch (key) {
      case "ArrowUp":
      case "w":
      case "W":
      case "ц":
      case "Ц":
        return { dx: 0, dy: -1, hint: "up" };
      case "ArrowDown":
      case "s":
      case "S":
      case "ы":
      case "Ы":
        return { dx: 0, dy: 1, hint: "down" };
      case "ArrowLeft":
      case "a":
      case "A":
      case "ф":
      case "Ф":
        return { dx: -1, dy: 0, hint: "left" };
      case "ArrowRight":
      case "d":
      case "D":
      case "в":
      case "В":
        return { dx: 1, dy: 0, hint: "right" };
      default:
        return null;
    }
  }

  loop(timestamp) {
    const dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;

    this.update(dt);
    this.render(timestamp);

    requestAnimationFrame(this.loop);
  }

  update(dt) {
    const cellsPerSecond = this.settings.moveSpeed / this.gridSize;
    this.moveProgress += cellsPerSecond * dt;

    while (this.moveProgress >= 1) {
      this.moveProgress -= 1;
      this.advanceSnake();
    }

    this.updateStarMorph(dt);
  }

  advanceSnake() {
    this.prevSnakeCells = this.snakeCells.map(cell => ({ ...cell }));

    if (this.directionQueue.length) {
      const next = this.directionQueue.shift();
      const isOpposite = next.dx === -this.direction.dx && next.dy === -this.direction.dy;
      if (!isOpposite) {
        this.direction = next;
      }
    }

    const head = this.snakeCells[0];
    const newHead = {
      col: head.col + this.direction.dx,
      row: head.row + this.direction.dy
    };

    this.snakeCells.unshift(newHead);

    this.snakeCells.pop();

    if (this.stars.length) {
      const hitIndex = this.stars.findIndex(star => this.sameCell(newHead, star));
      if (hitIndex !== -1) {
        this.consumeStar(hitIndex);
      }
    }
  }

  sameCell(cell, star) {
    return (
      this.wrapIndex(cell.col, this.cols) === star.col &&
      this.wrapIndex(cell.row, this.rows) === star.row
    );
  }

  wrapIndex(value, limit) {
    if (limit <= 0) {
      return 0;
    }
    let wrapped = value % limit;
    if (wrapped < 0) {
      wrapped += limit;
    }
    return wrapped;
  }

  spawnStar() {
    if (!this.cols || !this.rows) {
      return null;
    }

    const maxAttempts = 200;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const col = Math.floor(Math.random() * this.cols);
      const row = Math.floor(Math.random() * this.rows);
      if (!this.cellOccupied(col, row) && !this.starCellOccupied(col, row)) {
        const pos = this.gridToPixel(col, row);
        if (this.inScoreSafeZone(pos.x, pos.y) || this.isInUISafeZone(pos.x, pos.y)) {
          continue;
        }
        const star = this.createStar(col, row);
        if (star) {
          this.stars.push(star);
          return star;
        }
      }
    }
    return null;
  }

  cellOccupied(col, row) {
    return this.snakeCells.some(cell => (
      this.wrapIndex(cell.col, this.cols) === col &&
      this.wrapIndex(cell.row, this.rows) === row
    ));
  }

  starCellOccupied(col, row) {
    return this.stars.some(star => (
      this.wrapIndex(star.col, this.cols) === col &&
      this.wrapIndex(star.row, this.rows) === row
    ));
  }

  createStar(col, row) {
    if (!this.starShapes.length) {
      return null;
    }

    const startingShape = this.starShapes[0] || [];
    const star = {
      col,
      row,
      points: this.clonePointSet(startingShape),
      shapeIndex: 0,
      animation: null,
      color: this.randomStarColor()
    };

    this.resetStarAnimation(star, true);
    return star;
  }

  consumeStar(starIndex) {
    if (starIndex < 0 || starIndex >= this.stars.length) {
      return;
    }

    const eatenStar = this.stars[starIndex];
    if (eatenStar) {
      this.spawnStarPop(eatenStar);
    }

    this.score += 1;
    this.updateScoreDisplay();

    this.stars.splice(starIndex, 1);
    this.ensureStarCount();
  }

  ensureStarCount() {
    const desiredCount = Math.max(1, Math.floor(this.settings.starsOnField || 1));
    while (this.stars.length > desiredCount) {
      this.stars.pop();
    }
    let safety = desiredCount * 10;
    while (this.stars.length < desiredCount && safety > 0) {
      const created = this.spawnStar();
      if (!created) {
        break;
      }
      safety -= 1;
    }
  }

  updateScoreDisplay() {
    if (this.scoreElement) {
      this.scoreElement.textContent = String(this.score);
    }
  }

  render(timeMs) {
    this.ctx.fillStyle = this.settings.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.settings.showGrid) {
      this.drawGrid();
    }

    if (this.stars.length) {
      this.drawStars();
    }

    this.drawSnake();
    if (this.starPops.length) {
      this.drawStarPops(timeMs);
    }
  }

  drawGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.settings.gridLineColor;
    ctx.lineWidth = 1;

    const startX = this.settings.startOffset;
    const startY = this.settings.startOffset;
    const step = this.gridSize;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // vertical lines to the right of the playable area
    for (let x = startX; x <= width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
    // vertical lines to the left
    for (let x = startX - step; x >= 0; x -= step) {
      ctx.beginPath();
      const lineX = x + 0.5;
      ctx.moveTo(lineX, 0);
      ctx.lineTo(lineX, height);
      ctx.stroke();
    }

    // horizontal lines below the playable area
    for (let y = startY; y <= height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }
    // horizontal lines above
    for (let y = startY - step; y >= 0; y -= step) {
      ctx.beginPath();
      const lineY = y + 0.5;
      ctx.moveTo(0, lineY);
      ctx.lineTo(width, lineY);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawStars() {
    this.stars.forEach(star => this.drawStar(star));
  }

  drawStar(star) {
    if (!star) {
      return;
    }

    const { col, row, points, color } = star;
    const pos = this.gridToPixel(col, row);
    const targetSize = this.currentStarSize ?? this.settings.starSizePx;
    const scale = targetSize / 48;

    const ctx = this.ctx;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(scale, scale);
    ctx.translate(-24, -24);
    ctx.beginPath();
    if (points && points.length) {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.restore();
  }

  resetStarAnimation(star, initial = false) {
    if (!star || !this.starShapes.length) {
      if (star) {
        star.animation = null;
      }
      return;
    }

    const nextIndex = this.pickNextStarShapeIndex(star.shapeIndex);
    const duration = 0.4;
    star.animation = {
      duration,
      elapsed: initial ? Math.random() * duration * 0.6 : 0,
      from: this.clonePointSet(star.points),
      to: this.clonePointSet(this.starShapes[nextIndex]),
      nextIndex
    };
  }

  updateStarMorph(dt) {
    if (!this.stars.length) {
      return;
    }

    this.stars.forEach((star) => {
      if (!star.animation) {
        this.resetStarAnimation(star, true);
      }
      const anim = star.animation;
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
      const pointCount = Math.min(from.length, to.length, star.points.length);

      if (pointCount === 0) {
        star.shapeIndex = anim.nextIndex;
        star.points = this.clonePointSet(this.starShapes[star.shapeIndex]);
        this.resetStarAnimation(star);
        return;
      }

      for (let i = 0; i < pointCount; i += 1) {
        const a = from[i];
        const b = to[i];
        star.points[i].x = a.x + (b.x - a.x) * eased;
        star.points[i].y = a.y + (b.y - a.y) * eased;
      }

      if (progress >= 1) {
        star.shapeIndex = anim.nextIndex;
        star.points = this.clonePointSet(this.starShapes[star.shapeIndex]);
        this.resetStarAnimation(star);
      }
    });
  }

  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
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

  reducePointSet(points, step = 2) {
    if (!points || !points.length) {
      return [];
    }
    const stride = Math.max(1, Math.floor(step));
    if (stride <= 1) {
      return this.clonePointSet(points);
    }
    const reduced = [];
    for (let i = 0; i < points.length; i += stride) {
      const point = points[i];
      reduced.push({ x: point.x, y: point.y });
    }
    if (points.length % stride !== 1) {
      const last = points[points.length - 1];
      if (last) {
        reduced.push({ x: last.x, y: last.y });
      }
    }
    return reduced;
  }

  randomStarColor() {
    const palette = this.settings.starColors;
    if (!Array.isArray(palette) || palette.length === 0) {
      return "#CC0E1F";
    }
    const index = Math.floor(Math.random() * palette.length);
    return palette[index];
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

  inScoreSafeZone(x, y) {
    const radius = this.settings.scoreSafeRadiusPx || 0;
    if (radius <= 0) {
      return false;
    }
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    return dx * dx + dy * dy <= radius * radius;
  }

  setUISafeZones(zones) {
    if (!Array.isArray(zones)) {
      this.uiSafeZones = [];
      return;
    }
    this.uiSafeZones = zones
      .map(zone => ({
        left: Math.max(0, zone.left || 0),
        top: Math.max(0, zone.top || 0),
        right: Math.max(0, zone.right || 0),
        bottom: Math.max(0, zone.bottom || 0)
      }))
      .filter(zone => zone.right > zone.left && zone.bottom > zone.top);
  }

  isInUISafeZone(x, y) {
    if (!this.uiSafeZones || !this.uiSafeZones.length) {
      return false;
    }
    return this.uiSafeZones.some(zone => (
      x >= zone.left &&
      x <= zone.right &&
      y >= zone.top &&
      y <= zone.bottom
    ));
  }

  spawnStarPop(star) {
    if (!star) {
      return;
    }

    const { x, y } = this.gridToPixel(star.col, star.row);
    const baseShapePoints = this.reducePointSet(star.points || [], 2);
    const baseColor = star.color || this.settings.letterColor || "#FFFFFF";

    const fragmentCount = Math.max(5, 6 + Math.floor(Math.random() * 4));
    const fragments = Array.from({ length: fragmentCount }, () => {
      const angle = Math.random() * Math.PI * 2;
      return {
        points: this.clonePointSet(baseShapePoints),
        angle,
        startRadius: 6 + Math.random() * 10,
        endRadius: 38 + Math.random() * 22,
        startScale: 0.26 + Math.random() * 0.07,
        endScale: 0.12 + Math.random() * 0.05,
        spin: (Math.random() - 0.5) * 1.6,
        rotation: Math.random() * Math.PI * 2,
        baseAlpha: 0.68 + Math.random() * 0.22,
        fill: baseColor,
        stroke: this.colorWithAlpha(baseColor, 1)
      };
    });

    const rings = [
      { maxRadius: 32 + Math.random() * 14, width: 1.9 + Math.random() * 0.7, delay: 0 },
      { maxRadius: 52 + Math.random() * 16, width: 1.1 + Math.random() * 0.6, delay: 0.2 }
    ];

    const sparkles = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 14 + Math.random() * 14,
      size: 7 + Math.random() * 4,
      rotation: Math.random() * Math.PI * 2,
      color: this.colorWithAlpha(baseColor, 0.75 + Math.random() * 0.18)
    }));

    this.starPops.push({
      x,
      y,
      startTime: performance.now(),
      duration: 440,
      color: star.color,
      baseColor,
      fragments,
      rings,
      sparkles,
      shimmerOffset: Math.random() * Math.PI * 2
    });
  }

  drawStarPops(timeMs) {
    const ctx = this.ctx;
    const remaining = [];
    for (const pop of this.starPops) {
      const elapsed = timeMs - pop.startTime;
      const progress = elapsed / pop.duration;
      if (progress >= 1) {
        continue;
      }

      const fade = 1 - progress;
      const radial = this.easeOutCubic(Math.min(1, progress));

      ctx.save();
      ctx.translate(pop.x, pop.y);
      const baseColor = pop.baseColor || pop.color || "#FFFFFF";
      ctx.globalCompositeOperation = "lighter";

      if (pop.rings && pop.rings.length) {
        pop.rings.forEach((ring) => {
          const denom = Math.max(0.001, 1 - (ring.delay ?? 0));
          const ringProgress = Math.min(1, Math.max(0, (progress - (ring.delay ?? 0)) / denom));
          if (ringProgress <= 0) {
            return;
          }
          const ringEase = this.easeOutCubic(ringProgress);
          const radius = ring.maxRadius * ringEase;
          const alpha = Math.max(0, 0.48 * (1 - ringProgress));
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.lineWidth = Math.max(0.7, (ring.width ?? 1.4) * (1 - ringProgress * 0.65));
          ctx.strokeStyle = this.colorWithAlpha(baseColor, 0.85);
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        });
      }

      if (pop.fragments && pop.fragments.length) {
        pop.fragments.forEach((fragment) => {
          const travel = this.lerp(fragment.startRadius, fragment.endRadius, radial);
          const angle = fragment.angle;
          const px = Math.cos(angle) * travel;
          const py = Math.sin(angle) * travel;
          const scale = this.lerp(fragment.startScale, fragment.endScale, radial) * (1 + fade * 0.35);
          const rotation = fragment.rotation + fragment.spin * progress;

          const points = fragment.points;
          if (!points || !points.length) {
            return;
          }

          ctx.save();
          ctx.globalCompositeOperation = "source-over";
          ctx.translate(px, py);
          ctx.rotate(rotation);
          ctx.scale(scale, scale);
          ctx.translate(-24, -24);
          ctx.globalAlpha = Math.max(0, fragment.baseAlpha * (fade * 0.95 + 0.05));
          ctx.fillStyle = fragment.fill;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i += 1) {
            const pt = points[i];
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.fill();

          if (fragment.stroke) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, fragment.baseAlpha * 0.75 * fade);
            ctx.strokeStyle = fragment.stroke;
            ctx.lineWidth = 1.4;
            ctx.stroke();
            ctx.restore();
          }

          ctx.restore();
        });
      }

      if (pop.sparkles && pop.sparkles.length) {
        pop.sparkles.forEach((sparkle, idx) => {
          const spin = sparkle.rotation + progress * Math.PI * (2.4 + idx * 0.12);
          const radius = sparkle.radius * (0.45 + radial * 0.65);
          const px = Math.cos(spin) * radius;
          const py = Math.sin(spin) * radius;
          const size = Math.max(3.2, sparkle.size * (0.55 + fade * 0.45));

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(spin * 0.6);
          ctx.globalAlpha = Math.max(0, 0.52 * fade);
          ctx.fillStyle = sparkle.color || this.colorWithAlpha(baseColor, 0.82);
          ctx.beginPath();
          ctx.moveTo(0, -size * 0.5);
          ctx.lineTo(size * 0.35, 0);
          ctx.lineTo(0, size * 0.5);
          ctx.lineTo(-size * 0.35, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
      }

      const pulse = Math.sin(progress * Math.PI * 2 + (pop.shimmerOffset ?? 0)) * 0.08;
      const coreScale = 0.65 + fade * 0.55 + pulse;

      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.58 * fade);
      ctx.fillStyle = this.colorWithAlpha(baseColor, 0.96);
      ctx.beginPath();
      ctx.arc(0, 0, 12 * coreScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.34 * fade);
      ctx.strokeStyle = this.colorWithAlpha(baseColor, 0.9);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-8 * coreScale, 0);
      ctx.lineTo(8 * coreScale, 0);
      ctx.moveTo(0, -8 * coreScale);
      ctx.lineTo(0, 8 * coreScale);
      ctx.stroke();
      ctx.restore();

      ctx.restore();
      remaining.push(pop);
    }
    this.starPops = remaining;
  }

  drawSnake() {
    const totalSegments = Math.min(this.visibleLetters, this.snakeCells.length);
    const fontSize = this.currentFontSize ?? this.settings.fontSize;
    this.ctx.font = `${this.settings.fontWeight} ${fontSize}px ${this.settings.fontFamily}`;
    this.ctx.fillStyle = this.settings.letterColor;
    for (let i = totalSegments - 1; i >= 0; i -= 1) {
      const letterIndex = i;
      const letter = this.fullLetters[letterIndex] ?? "";
      const renderInfo = this.getSegmentRenderInfo(i);
      if (!renderInfo) {
        continue;
      }
      this.ctx.fillText(letter, renderInfo.x, renderInfo.y);
    }
  }

  getSegmentRenderInfo(index) {
    const current = this.snakeCells[index];
    if (!current) {
      return null;
    }

    const prevArray = this.prevSnakeCells;
    const previous = prevArray[index] || prevArray[prevArray.length - 1] || current;

    const t = this.smoothProgress(this.moveProgress);
    const interpCol = previous.col + (current.col - previous.col) * t;
    const interpRow = previous.row + (current.row - previous.row) * t;
    const { x, y } = this.gridToPixel(interpCol, interpRow);
    return { x, y };
  }

  smoothProgress(p) {
    return p * p * (3 - 2 * p);
  }

  easeOutCubic(t) {
    if (t <= 0) {
      return 0;
    }
    if (t >= 1) {
      return 1;
    }
    const inv = 1 - t;
    return 1 - inv * inv * inv;
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  colorWithAlpha(color, alpha = 1) {
    if (!color) {
      return `rgba(255,255,255,${alpha})`;
    }
    const trimmed = color.trim();
    if (trimmed.startsWith("rgba")) {
      const open = trimmed.indexOf("(");
      const close = trimmed.indexOf(")");
      if (open !== -1 && close !== -1) {
        const parts = trimmed
          .slice(open + 1, close)
          .split(",")
          .slice(0, 3)
          .map(part => part.trim());
        const [r, g, b] = parts;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    if (trimmed.startsWith("rgb")) {
      const open = trimmed.indexOf("(");
      const close = trimmed.indexOf(")");
      if (open !== -1 && close !== -1) {
        const parts = trimmed
          .slice(open + 1, close)
          .split(",")
          .map(part => part.trim());
        const [r, g, b] = parts;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    if (trimmed.startsWith("#")) {
      let hex = trimmed.slice(1);
      if (hex.length === 3) {
        hex = hex
          .split("")
          .map(ch => ch + ch)
          .join("");
      }
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
      }
    }
    return `rgba(255,255,255,${alpha})`;
  }

  gridToPixel(col, row) {
    const wrappedCol = this.wrapFloat(col, this.cols);
    const wrappedRow = this.wrapFloat(row, this.rows);
    const x = this.settings.startOffset + (wrappedCol + 0.5) * this.gridSize;
    const y = this.settings.startOffset + (wrappedRow + 0.5) * this.gridSize;
    return { x, y };
  }

  gridAlignedPosition(xPx, yPx) {
    const col = Math.floor((xPx - this.settings.startOffset) / this.gridSize);
    const row = Math.floor((yPx - this.settings.startOffset) / this.gridSize);
    return {
      col: Math.max(0, col),
      row: Math.max(0, row)
    };
  }

  scheduleIntroMoves() {
    if (this.userInteracted) {
      return;
    }
    this.clearIntroMoves();
    const baseDelay = Math.max(220, (this.gridSize / this.settings.moveSpeed) * 1300);
    const initialDelay = 1000;
    const sequence = [
      { dx: 0, dy: -1, hint: "up" },
      { dx: 1, dy: 0, hint: "right" },
      { dx: 0, dy: -1, hint: "up" },
      { dx: -1, dy: 0, hint: "left" },
      { dx: 1, dy: 0, hint: "right" },
      { dx: 0, dy: -1, hint: "up" },
      { dx: -1, dy: 0, hint: "left" }
    ];
    sequence.forEach((dir, idx) => {
      const timeout = window.setTimeout(() => {
        if (this.userInteracted) {
          return;
        }
        this.directionQueue.push({ dx: dir.dx, dy: dir.dy });
        pulseControlHint(dir.hint);
      }, initialDelay + baseDelay * (idx + 1));
      this.introMoveTimeouts.push(timeout);
    });
  }

  clearIntroMoves() {
    if (this.introMoveTimeouts && this.introMoveTimeouts.length) {
      this.introMoveTimeouts.forEach((id) => window.clearTimeout(id));
      this.introMoveTimeouts = [];
    }
  }

  wrapFloat(value, limit) {
    if (limit <= 0) {
      return 0;
    }
    let result = value % limit;
    if (result < 0) {
      result += limit;
    }
    return result;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gameCanvas");
  const scoreElement = document.getElementById("scoreValue");
  if (!canvas || !scoreElement) {
    return;
  }
  const safeZoneProvider = () => collectUISafeZones();
  const game = new TextSnakeGame(canvas, scoreElement, safeZoneProvider);
  window.addEventListener("resize", () => {
    game.setUISafeZones(safeZoneProvider());
  });
  setupLinkStarHover();
  setupProtectedSamokatLink();
  setupResumeDownload();
});

function setupLinkStarHover() {
  const links = document.querySelectorAll(".info-panel__link");
  if (!links.length) {
    return;
  }

  links.forEach((link) => {
    link.addEventListener("mouseenter", () => spawnHoverStars(link));
  });
}

function setupProtectedSamokatLink() {
  const protectedLinks = document.querySelectorAll('[data-password-protected]');
  if (!protectedLinks.length) {
    return;
  }

  const password = "PressStart";
  const promptMessage = "Введите пароль или свяжитесь со мной, чтобы его узнать:";
  const errorMessage = "Неверный пароль.";

  const createHandler = (link) => (event) => {
    if (event.type === 'click' && event.button !== 0) {
      return;
    }
    if (event.type === 'auxclick' && event.button !== 1) {
      return;
    }

    event.preventDefault();
    const targetUrl = link.href;
    const openInNewTab = event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1 || link.target === '_blank';
    const input = window.prompt(promptMessage);

    if (input === null) {
      return;
    }

    if (input.trim() === password) {
      if (openInNewTab) {
        window.open(targetUrl, link.target || '_blank', 'noopener');
      } else {
        window.location.href = targetUrl;
      }
      emitAnalyticsLinkEvent(link.dataset.analyticsKey || 'protected-link', {
        href: targetUrl,
        method: openInNewTab ? 'new-tab' : 'same-tab'
      });
    } else {
      window.alert(errorMessage);
    }
  };

  protectedLinks.forEach((link) => {
    const handler = createHandler(link);
    link.addEventListener('click', handler);
    link.addEventListener('auxclick', handler);
  });
}


function setupResumeDownload() {
  const resumeLink = document.querySelector('[data-resume-link]');
  if (!resumeLink) {
    return;
  }

  const resumeUrl = resumeLink.getAttribute('href') || resumeLink.dataset.resumeUrl || 'resumeChaplinskaya.pdf';
  const loader = createDownloadLoader();
  const preferredName = deriveDownloadFileName(resumeLink, resumeUrl);
  let isDownloading = false;

  const startDownload = async () => {
    if (isDownloading) {
      return;
    }
    isDownloading = true;
    showDownloadLoader(loader);
    let downloadMeta = null;

    try {
      const response = await fetch(resumeUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Resume download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = objectUrl;
      tempLink.download = preferredName;
      document.body.appendChild(tempLink);
      tempLink.click();
      tempLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
      downloadMeta = {
        size: blob.size,
        type: blob.type || 'application/pdf'
      };
    } catch (error) {
      console.error(error);
      window.alert('Не удалось скачать резюме. Попробуйте еще раз.');
    } finally {
      isDownloading = false;
      hideDownloadLoader(loader);
      if (downloadMeta) {
        emitAnalyticsLinkEvent(resumeLink.dataset.analyticsKey || 'resume-download', downloadMeta);
      }
    }
  };

  const handleActivation = (event) => {
    if (event.type === 'click' && event.button !== 0) {
      return;
    }
    event.preventDefault();
    startDownload();
  };

  resumeLink.addEventListener('click', handleActivation);
  resumeLink.addEventListener('auxclick', (event) => {
    if (event.button === 1) {
      handleActivation(event);
    }
  });
  resumeLink.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      startDownload();
    }
  });
}

function emitAnalyticsLinkEvent(key, meta = null) {
  if (!key) {
    return;
  }
  const detail = { key };
  if (meta && typeof meta === 'object' && Object.keys(meta).length) {
    detail.meta = meta;
  }
  window.dispatchEvent(new CustomEvent('analytics:link-click', { detail }));
}

function createDownloadLoader() {
  if (createDownloadLoader.instance) {
    return createDownloadLoader.instance;
  }
  const loader = document.createElement('div');
  loader.className = 'download-loader';
  loader.setAttribute('aria-hidden', 'true');

  const spinner = document.createElement('div');
  spinner.className = 'download-loader__spinner';
  spinner.setAttribute('role', 'status');
  spinner.setAttribute('aria-live', 'polite');
  spinner.setAttribute('aria-label', 'Скачивание резюме');

  loader.appendChild(spinner);
  document.body.appendChild(loader);
  createDownloadLoader.instance = loader;
  return loader;
}

function showDownloadLoader(loader) {
  if (!loader) {
    return;
  }
  loader.classList.add('download-loader--visible');
  loader.setAttribute('aria-hidden', 'false');
}

function hideDownloadLoader(loader) {
  if (!loader) {
    return;
  }
  loader.classList.remove('download-loader--visible');
  loader.setAttribute('aria-hidden', 'true');
}

function deriveDownloadFileName(link, fallbackUrl) {
  if (!link) {
    return 'resumeChaplinskaya.pdf';
  }
  const declared = link.getAttribute('download');
  if (declared && declared.trim()) {
    return declared.trim();
  }
  try {
    const url = new URL(fallbackUrl, window.location.href);
    const pathname = url.pathname || '';
    const parts = pathname.split('/').filter(Boolean);
    const candidate = parts[parts.length - 1];
    if (candidate) {
      return candidate;
    }
  } catch (error) {
    // ignore URL parsing errors and use default name
  }
  return 'resumeChaplinskaya.pdf';
}

function collectUISafeZones() {
  const zones = [];
  const panel = document.querySelector(".info-panel");
  if (panel) {
    const rect = panel.getBoundingClientRect();
    const padding = Math.max(12, Math.min(32, Math.min(rect.width, rect.height) * 0.08));
    zones.push({
      left: rect.left - padding,
      top: rect.top - padding,
      right: rect.right + padding,
      bottom: rect.bottom + padding
    });
  }
  return zones;
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

    starWrapper.addEventListener("animationend", () => {
      starWrapper.remove();
    });

    link.appendChild(starWrapper);
  }
}

function pulseControlHint(direction) {
  if (!direction) {
    return;
  }
  if (!pulseControlHint.arrowVariants) {
    pulseControlHint.arrowVariants = ["control-spin", "control-pulse"];
  }
  if (typeof pulseControlHint.arrowVariantIndex !== "number") {
    pulseControlHint.arrowVariantIndex = -1;
  }
  const map = {
    up: ["up"],
    down: ["down"],
    left: ["left"],
    right: ["right"]
  };
  const targets = map[direction];
  if (!targets) {
    return;
  }
  targets.forEach((dir) => {
    const arrow = document.querySelector(`.controls-hint__arrow[data-dir="${dir}"]`);
    const key = document.querySelector(`.controls-hint__key[data-dir="${dir}"]`);
    pulseControlHint.arrowVariantIndex = (pulseControlHint.arrowVariantIndex + 1) % pulseControlHint.arrowVariants.length;
    const arrowClass = pulseControlHint.arrowVariants[pulseControlHint.arrowVariantIndex];
    const keyClass = "control-pulse";

    if (arrow) {
      arrow.classList.remove("control-pulse", "control-spin");
      void arrow.offsetWidth;
      arrow.classList.add(arrowClass);
    }
    if (key) {
      key.classList.remove("control-pulse", "control-spin");
      void key.offsetWidth;
      key.classList.add(keyClass);
    }
  });
}
