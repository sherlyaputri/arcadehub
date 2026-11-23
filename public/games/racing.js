// Turbo Racers 2D - Canvas Multiplayer Racing Game Engine
class RacingGame {
  constructor(canvas, socket, roomInfo, selfId) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.selfId = selfId;

    this.active = false;
    this.totalLaps = 3;
    this.countdown = 3;
    this.raceStarted = false;
    this.raceFinished = false;
    this.startTime = 0;
    this.myFinishTime = 0;

    // Track definition: circuit waypoints with width
    // Canvas coordinate space: 1200 x 750
    this.trackWidth = 135;
    this.trackPoints = [
      { x: 300, y: 620 }, // 0: Start / Finish line straight
      { x: 600, y: 620 }, // 1
      { x: 880, y: 620 }, // 2
      { x: 1040, y: 530 }, // 3 turn right upward
      { x: 1050, y: 350 }, // 4
      { x: 970, y: 200 }, // 5 chicane
      { x: 830, y: 220 }, // 6
      { x: 730, y: 330 }, // 7 hair-pin loop
      { x: 620, y: 340 }, // 8
      { x: 500, y: 190 }, // 9
      { x: 320, y: 150 }, // 10 top left turn
      { x: 150, y: 250 }, // 11
      { x: 150, y: 450 }, // 12
      { x: 200, y: 580 }  // 13 enter straight
    ];

    // Checkpoints along the track for lap validation
    this.checkpoints = [
      { id: 0, x: 420, y: 620, radius: 100, isFinish: true },
      { id: 1, x: 880, y: 620, radius: 110 },
      { id: 2, x: 1050, y: 350, radius: 110 },
      { id: 3, x: 780, y: 270, radius: 110 },
      { id: 4, x: 500, y: 190, radius: 110 },
      { id: 5, x: 150, y: 350, radius: 110 }
    ];

    // Boost pads
    this.boostPads = [
      { x: 540, y: 620, angle: 0, radius: 35 },
      { x: 230, y: 180, angle: Math.PI * 0.75, radius: 35 }
    ];

    // Local player car physics
    const startPositions = [
      { x: 260, y: 595, angle: 0 },
      { x: 220, y: 645, angle: 0 },
      { x: 180, y: 595, angle: 0 },
      { x: 140, y: 645, angle: 0 },
      { x: 100, y: 595, angle: 0 },
      { x: 60,  y: 645, angle: 0 }
    ];

    const playerIndex = Object.keys(roomInfo.players).indexOf(selfId) % startPositions.length;
    const startPos = startPositions[playerIndex] || { x: 240, y: 620, angle: 0 };

    this.car = {
      x: startPos.x,
      y: startPos.y,
      angle: startPos.angle,
      speed: 0,
      maxSpeed: 8.5,
      accel: 0.18,
      brake: 0.28,
      reverseSpeed: -2.8,
      friction: 0.965,
      turnSpeed: 0.046,
      nitro: 100,
      isBoosting: false,
      color: roomInfo.players[selfId]?.color || '#ff3366',
      name: roomInfo.players[selfId]?.name || 'Pembalap',
      lap: 1,
      currentCheckpoint: 0,
      passedCheckpoints: new Set([0])
    };

    // Remote cars: id -> { x, y, angle, speed, color, name, lap }
    this.remoteCars = {};

    // Visual trails and effects
    this.skidMarks = [];
    this.particles = [];

    // Input state
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      nitro: false
    };

    this.bindInputs();
    this.bindSocketEvents();
  }

  bindInputs() {
    this.keyDownHandler = (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = true;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = true;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = true;
      if (['ShiftLeft', 'ShiftRight', 'Space'].includes(e.code)) this.keys.nitro = true;
    };

    this.keyUpHandler = (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = false;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = false;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = false;
      if (['ShiftLeft', 'ShiftRight', 'Space'].includes(e.code)) this.keys.nitro = false;
    };

    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  }

  bindSocketEvents() {
    this.playerUpdateHandler = ({ id, state }) => {
      if (id === this.selfId) return;
      this.remoteCars[id] = state;
    };

    this.lapAnnounceHandler = (data) => {
      if (window.soundManager) window.soundManager.lapComplete();
    };

    this.playerFinishedHandler = ({ id, name, rank, timeMs, leaderboard }) => {
      if (window.renderPodium) {
        window.renderPodium(leaderboard);
      }
    };

    this.socket.on('racing:playerUpdate', this.playerUpdateHandler);
    this.socket.on('racing:lapAnnounce', this.lapAnnounceHandler);
    this.socket.on('racing:playerFinished', this.playerFinishedHandler);
  }

  startCountdown() {
    this.active = true;
    this.countdown = 3;
    this.raceStarted = false;

    if (window.soundManager) window.soundManager.countdownBeep(false);

    const interval = setInterval(() => {
      this.countdown--;
      if (this.countdown > 0) {
        if (window.soundManager) window.soundManager.countdownBeep(false);
      } else if (this.countdown === 0) {
        if (window.soundManager) window.soundManager.countdownBeep(true);
        this.raceStarted = true;
        this.startTime = Date.now();
      } else {
        clearInterval(interval);
      }
    }, 1000);

    // Sync broadcast timer
    this.syncInterval = setInterval(() => {
      if (!this.active) return;
      this.socket.emit('racing:update', {
        x: Math.round(this.car.x),
        y: Math.round(this.car.y),
        angle: Number(this.car.angle.toFixed(3)),
        speed: Number(this.car.speed.toFixed(2)),
        color: this.car.color,
        name: this.car.name,
        lap: this.car.lap,
        isBoosting: this.car.isBoosting
      });
    }, 33); // ~30 times / sec

    this.lastFrameTime = performance.now();
    this.loop();
  }

  isOnTrack(x, y) {
    // Check minimum distance to track polyline
    let minDistance = Infinity;
    const pts = this.trackPoints;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const dist = this.distToSegment({ x, y }, p1, p2);
      if (dist < minDistance) minDistance = dist;
    }
    return minDistance <= (this.trackWidth / 2);
  }

  distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  updatePhysics() {
    if (!this.raceStarted || this.raceFinished) return;

    const car = this.car;
    const onTrack = this.isOnTrack(car.x, car.y);

    // Maximum speed depends on surface
    let currentMaxSpeed = onTrack ? car.maxSpeed : 3.0;

    // Nitro handling
    car.isBoosting = false;
    if (this.keys.nitro && car.nitro > 0 && car.speed > 2) {
      car.isBoosting = true;
      currentMaxSpeed += 4.5;
      car.nitro = Math.max(0, car.nitro - 0.7);
      if (Math.random() < 0.3 && window.soundManager) window.soundManager.boost();

      // Nitro smoke particle
      this.particles.push({
        x: car.x - Math.cos(car.angle) * 20,
        y: car.y - Math.sin(car.angle) * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: 6,
        color: '#00d2ff',
        alpha: 0.9,
        decay: 0.04
      });
    } else {
      car.nitro = Math.min(100, car.nitro + 0.15); // recharge
    }

    // Check boost pads
    for (let pad of this.boostPads) {
      if (Math.hypot(car.x - pad.x, car.y - pad.y) < pad.radius) {
        car.speed = Math.min(car.speed + 2.5, currentMaxSpeed + 3);
        if (window.soundManager) window.soundManager.boost();
      }
    }

    // Acceleration & Braking
    if (this.keys.up) {
      if (car.speed < currentMaxSpeed) {
        car.speed += car.accel;
      }
    } else if (this.keys.down) {
      if (car.speed > 0) {
        car.speed -= car.brake;
      } else if (car.speed > car.reverseSpeed) {
        car.speed -= car.accel * 0.5;
      }
    } else {
      car.speed *= car.friction;
      if (Math.abs(car.speed) < 0.05) car.speed = 0;
    }

    // Steering (effective only when car is moving)
    if (Math.abs(car.speed) > 0.2) {
      const dir = car.speed > 0 ? 1 : -1;
      const turnEff = car.turnSpeed * Math.min(1.2, Math.abs(car.speed) / 3.5);

      if (this.keys.left) {
        car.angle -= turnEff * dir;
        this.addSkidMark(car);
      }
      if (this.keys.right) {
        car.angle += turnEff * dir;
        this.addSkidMark(car);
      }
    }

    // Move car
    car.x += Math.cos(car.angle) * car.speed;
    car.y += Math.sin(car.angle) * car.speed;

    // Boundaries check
    car.x = Math.max(30, Math.min(this.canvas.width - 30, car.x));
    car.y = Math.max(30, Math.min(this.canvas.height - 30, car.y));

    // Checkpoints & Lap calculation
    for (let cp of this.checkpoints) {
      const dist = Math.hypot(car.x - cp.x, car.y - cp.y);
      if (dist < cp.radius) {
        if (cp.isFinish) {
          // Player crossed finish line
          // Must have passed all intermediate checkpoints
          if (car.passedCheckpoints.size >= this.checkpoints.length - 1) {
            car.lap++;
            car.passedCheckpoints = new Set([0]);

            const timeNow = Date.now() - this.startTime;
            this.socket.emit('racing:finishedLap', {
              lap: car.lap - 1,
              totalLaps: this.totalLaps,
              timeMs: timeNow
            });

            if (car.lap > this.totalLaps) {
              this.raceFinished = true;
              this.myFinishTime = timeNow;
              if (window.soundManager) window.soundManager.winFanfare();
            }
          }
        } else {
          car.passedCheckpoints.add(cp.id);
        }
      }
    }

    // Update particles & skidmarks
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    if (this.skidMarks.length > 250) {
      this.skidMarks.shift();
    }
  }

  addSkidMark(car) {
    if (Math.abs(car.speed) > 5.5 && Math.random() < 0.4) {
      if (window.soundManager && Math.random() < 0.1) window.soundManager.skid();
      const perpAngle = car.angle + Math.PI / 2;
      const offsetX = Math.cos(perpAngle) * 9;
      const offsetY = Math.sin(perpAngle) * 9;

      this.skidMarks.push({
        x1: car.x + offsetX,
        y1: car.y + offsetY,
        x2: car.x - offsetX,
        y2: car.y - offsetY,
        alpha: 0.35
      });
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Background Grass with grid texture
    ctx.fillStyle = '#1e392a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grass subtle detail grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }

    // 2. Track Borders / Curbs (Red & White alternating)
    this.drawCurbs();

    // 3. Track Asphalt
    this.drawAsphalt();

    // 4. Boost Pads
    this.drawBoostPads();

    // 5. Checkpoints / Finish Line
    this.drawFinishLine();

    // 6. Skid marks
    ctx.fillStyle = 'rgba(20, 20, 20, 0.4)';
    for (let s of this.skidMarks) {
      ctx.beginPath();
      ctx.arc(s.x1, s.y1, 2.5, 0, Math.PI * 2);
      ctx.arc(s.x2, s.y2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Particles
    for (let p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 8. Remote Cars
    for (let id in this.remoteCars) {
      const rc = this.remoteCars[id];
      this.drawCar(rc.x, rc.y, rc.angle, rc.color || '#00d2ff', rc.name || 'Rival', rc.isBoosting, false);
    }

    // 9. Local Car
    this.drawCar(this.car.x, this.car.y, this.car.angle, this.car.color, this.car.name, this.car.isBoosting, true);

    // 10. HUD & Overlays
    this.drawHUD();
  }

  drawCurbs() {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    const pts = this.trackPoints;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.lineWidth = this.trackWidth + 24;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#e74c3c';
    ctx.stroke();

    ctx.lineWidth = this.trackWidth + 14;
    ctx.strokeStyle = '#ecf0f1';
    ctx.setLineDash([20, 20]);
    ctx.stroke();
    ctx.restore();
  }

  drawAsphalt() {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    const pts = this.trackPoints;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.lineWidth = this.trackWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2b2d42';
    ctx.stroke();

    // Track centerline dash
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.setLineDash([15, 20]);
    ctx.stroke();
    ctx.restore();
  }

  drawBoostPads() {
    const ctx = this.ctx;
    for (let pad of this.boostPads) {
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.rotate(pad.angle);

      // Glowing pad
      ctx.fillStyle = '#ff9900';
      ctx.beginPath();
      ctx.rect(-30, -18, 60, 36);
      ctx.fill();

      // Chevrons
      ctx.fillStyle = '#ffffff';
      for (let ox of [-16, 0, 16]) {
        ctx.beginPath();
        ctx.moveTo(ox - 8, -10);
        ctx.lineTo(ox + 4, 0);
        ctx.lineTo(ox - 8, 10);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawFinishLine() {
    const ctx = this.ctx;
    const finishCp = this.checkpoints[0];
    ctx.save();
    ctx.translate(finishCp.x, finishCp.y);

    // Checkerboard pattern
    const rows = 2;
    const cols = 8;
    const size = 10;
    const startY = - (cols * size) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111111';
        ctx.fillRect(r * size - size, startY + c * size, size, size);
      }
    }
    ctx.restore();
  }

  drawCar(x, y, angle, color, name, isBoosting, isSelf) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(-16, -10, 38, 24);

    // Wheels
    ctx.fillStyle = '#111111';
    ctx.fillRect(-14, -13, 9, 4); // Rear left
    ctx.fillRect(-14, 9, 9, 4);  // Rear right
    ctx.fillRect(9, -13, 9, 4);   // Front left
    ctx.fillRect(9, 9, 9, 4);    // Front right

    // Body
    ctx.fillStyle = color;
    this.roundRect(ctx, -17, -10, 36, 20, 5);
    ctx.fill();

    // Roof & Windshield
    ctx.fillStyle = '#1a1a24';
    this.roundRect(ctx, -6, -8, 16, 16, 3);
    ctx.fill();

    // Windshield glass
    ctx.fillStyle = '#70d6ff';
    ctx.fillRect(3, -7, 5, 14);

    // Rear glass
    ctx.fillRect(-5, -6, 3, 12);

    // Headlights
    ctx.fillStyle = '#ffff66';
    ctx.fillRect(17, -9, 3, 4);
    ctx.fillRect(17, 5, 3, 4);

    // Taillights
    ctx.fillStyle = '#ff2222';
    ctx.fillRect(-18, -8, 2, 3);
    ctx.fillRect(-18, 5, 2, 3);

    // Nitro exhaust fire
    if (isBoosting) {
      ctx.fillStyle = '#00f2fe';
      ctx.beginPath();
      ctx.moveTo(-18, -3);
      ctx.lineTo(-28 - Math.random() * 8, 0);
      ctx.lineTo(-18, 3);
      ctx.fill();
    }

    ctx.restore();

    // Name badge & arrow over car
    ctx.save();
    ctx.translate(x, y);
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';

    // Label background
    const textWidth = ctx.measureText(name).width;
    ctx.fillStyle = isSelf ? 'rgba(0, 255, 136, 0.85)' : 'rgba(0, 0, 0, 0.75)';
    this.roundRect(ctx, - (textWidth + 12) / 2, -28, textWidth + 12, 16, 4);
    ctx.fill();

    ctx.fillStyle = isSelf ? '#0b1320' : '#ffffff';
    ctx.fillText(name, 0, -16);

    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  drawHUD() {
    const ctx = this.ctx;

    // Countdown overlay
    if (this.countdown >= 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 90px sans-serif';

      if (this.countdown > 0) {
        ctx.fillStyle = '#ffcc00';
        ctx.fillText(this.countdown.toString(), this.canvas.width / 2, this.canvas.height / 2);
      } else {
        ctx.fillStyle = '#00ff88';
        ctx.fillText('GO! 🏁', this.canvas.width / 2, this.canvas.height / 2);
      }
      ctx.restore();
    }

    // Top HUD Bar
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    this.roundRect(ctx, 20, 20, 230, 95, 10);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Lap Info
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('PUTARAN (LAP)', 35, 45);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#38bdf8';
    const currentDisplayLap = Math.min(this.car.lap, this.totalLaps);
    ctx.fillText(`${currentDisplayLap} / ${this.totalLaps}`, 35, 75);

    // Speedometer
    const speedKmh = Math.abs(Math.round(this.car.speed * 18));
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('KECEPATAN', 150, 45);

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${speedKmh}`, 150, 72);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('KM/H', 195, 72);

    // Nitro Bar
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#00f2fe';
    ctx.fillText('NITRO [SHIFT / SPACE]', 35, 100);

    ctx.fillStyle = '#334155';
    ctx.fillRect(160, 92, 75, 8);
    ctx.fillStyle = '#00f2fe';
    ctx.fillRect(160, 92, (this.car.nitro / 100) * 75, 8);

    ctx.restore();

    // Finished Banner
    if (this.raceFinished) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.textAlign = 'center';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillStyle = '#00ff88';
      ctx.fillText('🏁 FINISH!', this.canvas.width / 2, this.canvas.height / 2 - 40);

      const sec = (this.myFinishTime / 1000).toFixed(2);
      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Waktu Balapan: ${sec} Detik`, this.canvas.width / 2, this.canvas.height / 2 + 10);
      ctx.restore();
    }
  }

  loop() {
    if (!this.active) return;
    this.updatePhysics();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  destroy() {
    this.active = false;
    clearInterval(this.syncInterval);
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    this.socket.off('racing:playerUpdate', this.playerUpdateHandler);
    this.socket.off('racing:lapAnnounce', this.lapAnnounceHandler);
    this.socket.off('racing:playerFinished', this.playerFinishedHandler);
  }
}

window.RacingGame = RacingGame;
