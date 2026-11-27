// 🎾 ArcadeHub Tennis - 1v1 Real-time Multiplayer (Canvas 2D)
class TennisGame {
  constructor(container, socket, roomInfo, selfId) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.selfId = selfId;
    this.active = true;
    this.animId = null;

    // Figure out who is P1 (host) and P2
    const playerList = Object.values(roomInfo.players);
    this.p1 = playerList.find(p => p.isHost) || playerList[0];
    this.p2 = playerList.find(p => !p.isHost) || playerList[1] || null;
    this.isP1 = this.selfId === this.p1?.id;
    this.isP2 = this.p2 && this.selfId === this.p2.id;
    this.isSolo = !this.p2;

    // Game state - local authoritative for P1, mirrored for P2
    this.gameState = {
      ball: { x: 400, y: 300, vx: 4, vy: 3 },
      paddleLeft: { y: 250, h: 90, score: 0 },
      paddleRight: { y: 250, h: 90, score: 0 },
      status: 'countdown', // countdown | playing | point | finished
      countdown: 3,
      maxScore: 7,
      winner: null,
      rally: 0,
      lastHitBy: null,
    };

    this.COURT_W = 800;
    this.COURT_H = 500;
    this.PADDLE_W = 14;
    this.BALL_R = 10;
    this.PADDLE_SPEED = 7;

    // Keys for the local player
    this.keys = {};

    // Countdown
    this.cdInterval = null;

    this.setupUI();
    this.bindSocket();
    this.bindKeys();
    this.startCountdown();
    this.loop();
  }

  // ==================== UI SETUP ====================
  setupUI() {
    this.container.innerHTML = '';
    this.container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: #0a1628;
      position: relative;
      overflow: hidden;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    // Court canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.COURT_W;
    this.canvas.height = this.COURT_H;
    this.canvas.style.cssText = `
      max-width: 100%;
      max-height: calc(100vh - 180px);
      object-fit: contain;
      border-radius: 16px;
      box-shadow: 0 0 60px rgba(0, 200, 100, 0.25), 0 8px 32px rgba(0,0,0,0.6);
      display: block;
    `;
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    // Score header
    this.scoreBar = document.createElement('div');
    this.scoreBar.style.cssText = `
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 16px;
      background: rgba(10,22,40,0.90);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 32px;
      padding: 6px 20px;
      z-index: 10;
      white-space: nowrap;
    `;
    this.scoreBar.innerHTML = this._buildScoreHTML();
    this.container.appendChild(this.scoreBar);

    // Mobile paddle controls (touch arrows)
    this.mobileCtrl = document.createElement('div');
    this.mobileCtrl.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      gap: 20px;
      z-index: 10;
    `;
    this.mobileCtrl.innerHTML = `
      <button id="tennis-up" style="width:60px;height:60px;font-size:28px;border-radius:50%;background:rgba(30,41,59,0.9);border:2px solid rgba(255,255,255,0.3);color:#fff;cursor:pointer;user-select:none;">▲</button>
      <button id="tennis-down" style="width:60px;height:60px;font-size:28px;border-radius:50%;background:rgba(30,41,59,0.9);border:2px solid rgba(255,255,255,0.3);color:#fff;cursor:pointer;user-select:none;">▼</button>
    `;
    this.container.appendChild(this.mobileCtrl);

    // Show mobile controls for touch devices
    if (window.innerWidth <= 768 || 'ontouchstart' in window) {
      this.mobileCtrl.style.display = 'flex';
    }

    this._bindMobileCtrl();

    // Overlay (countdown/winner)
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(10,22,40,0.75);
      backdrop-filter: blur(6px);
      z-index: 20;
      border-radius: 16px;
    `;
    this.overlay.innerHTML = `<div id="tennis-cd" style="font-size:100px;font-weight:900;color:#fbbf24;text-shadow:0 0 40px rgba(251,191,36,0.6);">3</div>`;
    this.canvas.parentElement.style.position = 'relative';
    this.container.appendChild(this.overlay);

    // Player role info
    const roleText = document.createElement('div');
    roleText.style.cssText = `
      position: absolute;
      bottom: ${window.innerWidth <= 768 ? '80px' : '12px'};
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      white-space: nowrap;
    `;
    const side = this.isP1 ? 'Kamu: Raket KIRI ◀' : (this.isP2 ? 'Kamu: Raket KANAN ▶' : '👁️ Spectating');
    const ctrl = (window.innerWidth <= 768) ? '(Tombol ▲▼ untuk gerak)' : '(W/S atau ↑↓ untuk gerak)';
    roleText.textContent = `${side}  ${ctrl}`;
    this.container.appendChild(roleText);
  }

  _buildScoreHTML() {
    const p1 = this.p1 || { name: 'P1', color: '#ff3366' };
    const p2 = this.p2 || { name: 'BOT', color: '#00d2ff' };
    const gs = this.gameState;
    return `
      <span style="font-weight:800;color:${p1.color};font-size:14px;">${this._truncName(p1.name)}</span>
      <span style="font-size:28px;font-weight:900;color:#fff;min-width:28px;text-align:center;">${gs.paddleLeft.score}</span>
      <span style="color:rgba(255,255,255,0.4);font-size:12px;">VS</span>
      <span style="font-size:28px;font-weight:900;color:#fff;min-width:28px;text-align:center;">${gs.paddleRight.score}</span>
      <span style="font-weight:800;color:${p2.color};font-size:14px;">${this._truncName(p2.name)}</span>
    `;
  }

  _truncName(name) {
    return name.length > 10 ? name.slice(0, 9) + '…' : name;
  }

  _bindMobileCtrl() {
    const up = document.getElementById('tennis-up');
    const down = document.getElementById('tennis-down');
    if (!up || !down) return;
    const start = (dir) => { this.keys[dir] = true; };
    const end = (dir) => { this.keys[dir] = false; };
    up.addEventListener('touchstart', e => { e.preventDefault(); start('up'); }, { passive: false });
    up.addEventListener('touchend', e => { e.preventDefault(); end('up'); }, { passive: false });
    up.addEventListener('mousedown', () => start('up'));
    up.addEventListener('mouseup', () => end('up'));
    up.addEventListener('mouseleave', () => end('up'));
    down.addEventListener('touchstart', e => { e.preventDefault(); start('down'); }, { passive: false });
    down.addEventListener('touchend', e => { e.preventDefault(); end('down'); }, { passive: false });
    down.addEventListener('mousedown', () => start('down'));
    down.addEventListener('mouseup', () => end('down'));
    down.addEventListener('mouseleave', () => end('down'));
  }

  // ==================== KEYBOARD ====================
  bindKeys() {
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'w', 'W'].includes(e.key)) this.keys['up'] = true;
      if (['ArrowDown', 's', 'S'].includes(e.key)) this.keys['down'] = true;
      e.stopPropagation();
    };
    this._onKeyUp = (e) => {
      if (['ArrowUp', 'w', 'W'].includes(e.key)) this.keys['up'] = false;
      if (['ArrowDown', 's', 'S'].includes(e.key)) this.keys['down'] = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  // ==================== COUNTDOWN ====================
  startCountdown() {
    let count = 3;
    const cdEl = document.getElementById('tennis-cd');
    if (cdEl) cdEl.textContent = '3';

    this.cdInterval = setInterval(() => {
      count--;
      const el = document.getElementById('tennis-cd');
      if (count > 0) {
        if (el) {
          el.textContent = count;
          el.style.transform = 'scale(1.4)';
          setTimeout(() => { if (el) el.style.transform = 'scale(1)'; }, 200);
        }
      } else {
        clearInterval(this.cdInterval);
        this.gameState.status = 'playing';
        // Broadcast start to other player if P1
        if (this.isP1 || this.isSolo) {
          this._resetBall(true);
        }
        if (this.overlay) {
          this.overlay.style.display = 'none';
        }
      }
    }, 1000);
  }

  // ==================== SOCKET ====================
  bindSocket() {
    // Receive authoritative game state from P1 (host)
    this._onStateUpdate = (data) => {
      if (!this.active) return;
      this.gameState = data;
      if (this.scoreBar) this.scoreBar.innerHTML = this._buildScoreHTML();
    };

    // Receive paddle Y from opponent
    this._onPaddleUpdate = (data) => {
      if (!this.active) return;
      if (this.isP1 && data.role === 'right') {
        this.gameState.paddleRight.y = data.y;
      } else if (this.isP2 && data.role === 'left') {
        this.gameState.paddleLeft.y = data.y;
      }
    };

    // Point announcement
    this._onPoint = (data) => {
      if (!this.active) return;
      this.gameState.paddleLeft.score = data.leftScore;
      this.gameState.paddleRight.score = data.rightScore;
      if (this.scoreBar) this.scoreBar.innerHTML = this._buildScoreHTML();
      this._showPointFlash(data.scorer);
    };

    // Game over
    this._onGameOver = (data) => {
      if (!this.active) return;
      this.gameState.status = 'finished';
      this.gameState.winner = data.winner;
      this._showWinner(data);
    };

    // Restart
    this._onRestart = () => {
      if (!this.active) return;
      this.gameState.paddleLeft.score = 0;
      this.gameState.paddleRight.score = 0;
      this.gameState.paddleLeft.y = 205;
      this.gameState.paddleRight.y = 205;
      this.gameState.rally = 0;
      this.gameState.winner = null;
      if (this.scoreBar) this.scoreBar.innerHTML = this._buildScoreHTML();
      // Remove winner overlay if present
      const wo = document.getElementById('tennis-winner-overlay');
      if (wo) wo.remove();
      this.startCountdown();
      if (this.overlay) this.overlay.style.display = 'flex';
    };

    this.socket.on('tennis:state', this._onStateUpdate);
    this.socket.on('tennis:paddle', this._onPaddleUpdate);
    this.socket.on('tennis:point', this._onPoint);
    this.socket.on('tennis:gameover', this._onGameOver);
    this.socket.on('tennis:restart', this._onRestart);
  }

  // ==================== GAME LOOP ====================
  loop() {
    if (!this.active) return;
    this.animId = requestAnimationFrame(() => this.loop());
    this.update();
    this.draw();
  }

  update() {
    if (this.gameState.status !== 'playing') return;
    const gs = this.gameState;

    // --- Move local paddle ---
    const isLeft = this.isP1 || (this.isSolo);
    const isRight = this.isP2;

    if (isLeft) {
      if (this.keys['up']) gs.paddleLeft.y = Math.max(0, gs.paddleLeft.y - this.PADDLE_SPEED);
      if (this.keys['down']) gs.paddleLeft.y = Math.min(this.COURT_H - gs.paddleLeft.h, gs.paddleLeft.y + this.PADDLE_SPEED);
    }
    if (isRight) {
      if (this.keys['up']) gs.paddleRight.y = Math.max(0, gs.paddleRight.y - this.PADDLE_SPEED);
      if (this.keys['down']) gs.paddleRight.y = Math.min(this.COURT_H - gs.paddleRight.h, gs.paddleRight.y + this.PADDLE_SPEED);
    }

    // --- Bot AI for right paddle in solo mode ---
    if (this.isSolo) {
      const botCenter = gs.paddleRight.y + gs.paddleRight.h / 2;
      const diff = gs.ball.y - botCenter;
      const botSpeed = Math.min(5.5 + gs.rally * 0.08, 10); // Gets slightly faster with rally
      if (Math.abs(diff) > 4) {
        gs.paddleRight.y += diff > 0 ? botSpeed : -botSpeed;
        gs.paddleRight.y = Math.max(0, Math.min(this.COURT_H - gs.paddleRight.h, gs.paddleRight.y));
      }
    }

    // --- Broadcast own paddle position ---
    if (this._lastEmitPaddle !== Math.round(gs.paddleLeft.y) && isLeft) {
      this._lastEmitPaddle = Math.round(gs.paddleLeft.y);
      this.socket.emit('tennis:paddle', { role: 'left', y: gs.paddleLeft.y });
    }
    if (this._lastEmitPaddleR !== Math.round(gs.paddleRight.y) && isRight) {
      this._lastEmitPaddleR = Math.round(gs.paddleRight.y);
      this.socket.emit('tennis:paddle', { role: 'right', y: gs.paddleRight.y });
    }

    // --- Physics (only P1/solo runs authoritative ball) ---
    if (!this.isP1 && !this.isSolo) return;

    const b = gs.ball;

    // Move ball
    b.x += b.vx;
    b.y += b.vy;

    // Wall bounce (top/bottom)
    if (b.y - this.BALL_R <= 0) { b.y = this.BALL_R; b.vy = Math.abs(b.vy); this._playBeep(600); }
    if (b.y + this.BALL_R >= this.COURT_H) { b.y = this.COURT_H - this.BALL_R; b.vy = -Math.abs(b.vy); this._playBeep(600); }

    // Left paddle collision
    const lp = gs.paddleLeft;
    if (b.x - this.BALL_R <= 30 + this.PADDLE_W && b.x - this.BALL_R > 24 &&
        b.y >= lp.y && b.y <= lp.y + lp.h) {
      b.x = 30 + this.PADDLE_W + this.BALL_R;
      const hitPos = (b.y - lp.y) / lp.h; // 0 = top, 1 = bottom
      const angle = (hitPos - 0.5) * 2; // -1 to 1
      const speed = Math.min(Math.sqrt(b.vx * b.vx + b.vy * b.vy) + 0.4, 18);
      b.vx = Math.abs(speed * Math.cos(angle * 0.9));
      b.vy = speed * Math.sin(angle * 0.9);
      gs.rally++;
      gs.lastHitBy = 'left';
      this._playBeep(400);
    }

    // Right paddle collision
    const rp = gs.paddleRight;
    if (b.x + this.BALL_R >= this.COURT_W - 30 - this.PADDLE_W && b.x + this.BALL_R < this.COURT_W - 24 &&
        b.y >= rp.y && b.y <= rp.y + rp.h) {
      b.x = this.COURT_W - 30 - this.PADDLE_W - this.BALL_R;
      const hitPos = (b.y - rp.y) / rp.h;
      const angle = (hitPos - 0.5) * 2;
      const speed = Math.min(Math.sqrt(b.vx * b.vx + b.vy * b.vy) + 0.4, 18);
      b.vx = -Math.abs(speed * Math.cos(angle * 0.9));
      b.vy = speed * Math.sin(angle * 0.9);
      gs.rally++;
      gs.lastHitBy = 'right';
      this._playBeep(500);
    }

    // Score points
    if (b.x < 0) {
      // Right scores
      gs.paddleRight.score++;
      this._playBeep(200);
      this.socket.emit('tennis:point', { scorer: 'right', leftScore: gs.paddleLeft.score, rightScore: gs.paddleRight.score });
      this._showPointFlash('right');
      this._checkWinner();
      return;
    }
    if (b.x > this.COURT_W) {
      // Left scores
      gs.paddleLeft.score++;
      this._playBeep(200);
      this.socket.emit('tennis:point', { scorer: 'left', leftScore: gs.paddleLeft.score, rightScore: gs.paddleRight.score });
      this._showPointFlash('left');
      this._checkWinner();
      return;
    }

    // Broadcast authoritative ball state to other players
    if (this._stateTickCtr === undefined) this._stateTickCtr = 0;
    this._stateTickCtr++;
    if (this._stateTickCtr % 2 === 0) {
      this.socket.emit('tennis:state', { ...gs });
    }
  }

  _resetBall(toRight) {
    const gs = this.gameState;
    gs.ball.x = this.COURT_W / 2;
    gs.ball.y = this.COURT_H / 2 + (Math.random() - 0.5) * 100;
    const angle = (Math.random() - 0.5) * 0.6;
    const baseSpeed = 5;
    const dir = toRight ? 1 : -1;
    gs.ball.vx = dir * baseSpeed * Math.cos(angle);
    gs.ball.vy = baseSpeed * Math.sin(angle);
    gs.rally = 0;
    gs.status = 'playing';
  }

  _checkWinner() {
    const gs = this.gameState;
    if (gs.paddleLeft.score >= gs.maxScore || gs.paddleRight.score >= gs.maxScore) {
      gs.status = 'finished';
      const winner = gs.paddleLeft.score >= gs.maxScore ? 'left' : 'right';
      gs.winner = winner;
      const winnerPlayer = winner === 'left' ? this.p1 : this.p2;
      this.socket.emit('tennis:gameover', {
        winner,
        winnerName: winnerPlayer?.name || (winner === 'left' ? 'P1' : 'P2'),
        winnerColor: winnerPlayer?.color || '#fbbf24',
        leftScore: gs.paddleLeft.score,
        rightScore: gs.paddleRight.score
      });
      this._showWinner({
        winner,
        winnerName: winnerPlayer?.name || (winner === 'left' ? 'P1' : 'P2'),
        winnerColor: winnerPlayer?.color || '#fbbf24',
        leftScore: gs.paddleLeft.score,
        rightScore: gs.paddleRight.score
      });
    } else {
      gs.status = 'point';
      setTimeout(() => {
        if (!this.active || gs.status === 'finished') return;
        this._resetBall(gs.paddleLeft.score > gs.paddleRight.score);
      }, 1200);
    }
  }

  _showPointFlash(scorer) {
    const existing = document.getElementById('tennis-point-flash');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'tennis-point-flash';
    const isLeft = scorer === 'left';
    const whoName = isLeft ? (this.p1?.name || 'P1') : (this.p2?.name || 'P2');
    const whoColor = isLeft ? (this.p1?.color || '#ff3366') : (this.p2?.color || '#00d2ff');
    el.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 32px;
      font-weight: 900;
      color: ${whoColor};
      text-shadow: 0 0 24px ${whoColor};
      background: rgba(10,22,40,0.85);
      border: 2px solid ${whoColor};
      border-radius: 20px;
      padding: 10px 28px;
      z-index: 15;
      white-space: nowrap;
      pointer-events: none;
      animation: tennisFlash 0.3s ease;
    `;
    el.textContent = `+1 ${whoName}!`;
    this.container.appendChild(el);
    if (this.scoreBar) this.scoreBar.innerHTML = this._buildScoreHTML();
    setTimeout(() => el.remove(), 1200);
  }

  _showWinner(data) {
    const existing = document.getElementById('tennis-winner-overlay');
    if (existing) existing.remove();

    const isMyWin = (data.winner === 'left' && this.isP1) || (data.winner === 'right' && this.isP2);
    const icon = isMyWin ? '🏆' : (data.winner === null ? '🤝' : '😔');
    const title = isMyWin ? 'KAMU MENANG!' : `${data.winnerName || 'Pemenang'} Menang!`;
    const color = data.winnerColor || '#fbbf24';

    if (window.soundManager) {
      if (isMyWin) window.soundManager.winFanfare();
      else window.soundManager.playBeep(200, 0.5, 'sawtooth');
    }

    const ov = document.createElement('div');
    ov.id = 'tennis-winner-overlay';
    ov.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(10,22,40,0.90);
      backdrop-filter: blur(10px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 30;
      border-radius: 16px;
      gap: 10px;
    `;
    ov.innerHTML = `
      <div style="font-size:72px;">${icon}</div>
      <h2 style="font-size:30px;font-weight:900;color:${color};margin:0;">${title}</h2>
      <div style="font-size:18px;color:rgba(255,255,255,0.7);margin-bottom:8px;">Skor: ${data.leftScore} - ${data.rightScore}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
        <button id="btnTennisRestart" style="padding:12px 24px;font-size:15px;font-weight:800;border-radius:30px;background:linear-gradient(135deg,#f59e0b,#d97706);border:none;cursor:pointer;color:#0f172a;">
          🔄 Main Lagi
        </button>
        <button id="btnTennisLobby" style="padding:12px 24px;font-size:15px;font-weight:800;border-radius:30px;background:rgba(30,41,59,0.9);border:1px solid rgba(255,255,255,0.2);cursor:pointer;color:#fff;">
          🏠 Kembali ke Room
        </button>
      </div>
    `;
    this.container.appendChild(ov);

    document.getElementById('btnTennisRestart')?.addEventListener('click', () => {
      this.socket.emit('tennis:restart');
      ov.remove();
      this.gameState.paddleLeft.score = 0;
      this.gameState.paddleRight.score = 0;
      this.gameState.rally = 0;
      this.gameState.winner = null;
      if (this.scoreBar) this.scoreBar.innerHTML = this._buildScoreHTML();
      this.startCountdown();
      if (this.overlay) this.overlay.style.display = 'flex';
    });
    document.getElementById('btnTennisLobby')?.addEventListener('click', () => {
      this.socket.emit('backToLobby');
    });
  }

  // ==================== DRAWING ====================
  draw() {
    const ctx = this.ctx;
    const W = this.COURT_W;
    const H = this.COURT_H;
    const gs = this.gameState;

    // === BACKGROUND: Grass court ===
    // Base grass
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a6b30');
    grad.addColorStop(0.5, '#228b40');
    grad.addColorStop(1, '#1a6b30');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 16);
    ctx.fill();

    // Grass stripe pattern
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#fff' : '#000';
      ctx.fillRect(0, (H / 12) * i, W, H / 12);
    }
    ctx.globalAlpha = 1;

    // === COURT LINES ===
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;

    // Outer boundary
    ctx.strokeRect(28, 20, W - 56, H - 40);

    // Center line
    ctx.beginPath();
    ctx.setLineDash([12, 8]);
    ctx.moveTo(W / 2, 20);
    ctx.lineTo(W / 2, H - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Service boxes (horizontal service line)
    const svcY = H / 2;
    ctx.beginPath();
    ctx.moveTo(28, svcY);
    ctx.lineTo(W - 28, svcY);
    ctx.stroke();

    // Service box center line (vertical only inside service area)
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(W / 2, 20);
    ctx.lineTo(W / 2, H - 20);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Net
    const netX = W / 2;
    // Net shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(netX - 4, 10, 8, H - 20);
    // Net post
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(netX - 2, 15, 4, H - 30);
    // Net mesh pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1;
    for (let ny = 15; ny < H - 20; ny += 12) {
      ctx.beginPath();
      ctx.moveTo(netX - 2, ny);
      ctx.lineTo(netX + 2, ny);
      ctx.stroke();
    }
    // Net top tape
    ctx.fillStyle = '#fff';
    ctx.fillRect(netX - 3, 15, 6, 4);
    ctx.fillRect(netX - 3, H - 25, 6, 4);

    // === PADDLES ===
    // Left paddle (P1 / host)
    const lp = gs.paddleLeft;
    const p1Color = this.p1?.color || '#ff3366';
    this._drawPaddle(ctx, 30, lp.y, this.PADDLE_W, lp.h, p1Color);

    // Right paddle (P2)
    const rp = gs.paddleRight;
    const p2Color = this.p2?.color || '#00d2ff';
    this._drawPaddle(ctx, W - 30 - this.PADDLE_W, rp.y, this.PADDLE_W, rp.h, p2Color);

    // === BALL ===
    if (gs.status === 'playing' || gs.status === 'point') {
      const b = gs.ball;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(b.x + 3, b.y + 4, this.BALL_R * 0.8, this.BALL_R * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ball body (yellow-green tennis ball)
      const ballGrad = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, this.BALL_R);
      ballGrad.addColorStop(0, '#d4f04a');
      ballGrad.addColorStop(0.6, '#b5de1c');
      ballGrad.addColorStop(1, '#8db50a');
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, this.BALL_R, 0, Math.PI * 2);
      ctx.fill();
      // Ball seam
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, this.BALL_R * 0.65, 0.5, Math.PI - 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x, b.y, this.BALL_R * 0.65, Math.PI + 0.5, 2 * Math.PI - 0.5);
      ctx.stroke();
    }

    // === RALLY INDICATOR ===
    if (gs.rally >= 5 && gs.status === 'playing') {
      const rallyColors = gs.rally >= 15 ? '#ef4444' : gs.rally >= 10 ? '#f59e0b' : '#00d2ff';
      ctx.font = 'bold 13px system-ui';
      ctx.fillStyle = rallyColors;
      ctx.textAlign = 'center';
      ctx.fillText(`🔥 Ralian x${gs.rally}`, W / 2, 16);
    }

    // === SCORE IN CORNERS ===
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px system-ui';
    ctx.fillStyle = p1Color;
    ctx.fillText(gs.paddleLeft.score, 36, 46);
    ctx.textAlign = 'right';
    ctx.fillStyle = p2Color;
    ctx.fillText(gs.paddleRight.score, W - 36, 46);
    ctx.textAlign = 'left';
  }

  _drawPaddle(ctx, x, y, w, h, color) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, w, h, 7);
    ctx.fill();

    // Paddle gradient
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, color);
    grad.addColorStop(1, this._lighten(color, 40));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 7);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h * 0.4, 5);
    ctx.fill();

    // Grip lines
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 3, y + h * 0.25 + i * (h * 0.14));
      ctx.lineTo(x + w - 3, y + h * 0.25 + i * (h * 0.14));
      ctx.stroke();
    }
  }

  _lighten(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
  }

  _playBeep(freq) {
    if (!window.soundManager) return;
    try {
      window.soundManager.playBeep(freq, 0.08, 'sine');
    } catch (e) {}
  }

  // ==================== DESTROY ====================
  destroy() {
    this.active = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.cdInterval) clearInterval(this.cdInterval);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.socket.off('tennis:state', this._onStateUpdate);
    this.socket.off('tennis:paddle', this._onPaddleUpdate);
    this.socket.off('tennis:point', this._onPoint);
    this.socket.off('tennis:gameover', this._onGameOver);
    this.socket.off('tennis:restart', this._onRestart);
    this.container.innerHTML = '';
  }
}

// Add CSS animation for point flash
(function() {
  if (!document.getElementById('tennis-anim-style')) {
    const s = document.createElement('style');
    s.id = 'tennis-anim-style';
    s.textContent = `
      @keyframes tennisFlash {
        0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
        60% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(s);
  }
})();

window.TennisGame = TennisGame;
