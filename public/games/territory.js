// ⚔️ World Conquest (Peta Dunia 1v1 - Realistic Risk/Conquest Style)
class TerritoryGame {
  constructor(container, socket, roomInfo, selfId) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.selfId = selfId;

    this.gameData = null;
    this.selectedTerritoryId = null;
    this.hasShownStartBanner = false;

    // Realistic Continental SVG Paths with Shared Boundaries (32 Wilayah Dunia)
    this.territoryPaths = {
      // --- AMERIKA UTARA (7) ---
      alaska: 'M 30,70 L 115,55 L 135,105 L 90,135 L 45,120 Z',
      nw_terr: 'M 115,55 L 230,45 L 245,110 L 175,130 L 135,105 Z',
      quebec: 'M 230,45 L 340,40 L 350,110 L 290,140 L 245,110 Z',
      greenland: 'M 365,20 L 435,20 L 425,75 L 385,85 L 355,55 Z',
      usa_w: 'M 90,135 L 175,130 L 195,190 L 175,250 L 110,245 L 65,195 Z',
      usa_e: 'M 175,130 L 290,140 L 330,195 L 305,255 L 175,250 L 195,190 Z',
      mexico: 'M 110,245 L 175,250 L 245,255 L 225,330 L 180,340 L 130,295 Z',

      // --- AMERIKA SELATAN (4) ---
      venezuela: 'M 225,330 L 295,315 L 345,340 L 315,385 L 245,380 Z',
      brazil: 'M 295,315 L 390,325 L 420,385 L 385,445 L 305,440 L 315,385 L 345,340 Z',
      peru: 'M 225,330 L 245,380 L 315,385 L 305,440 L 265,465 L 235,420 Z',
      argentina: 'M 265,465 L 305,440 L 385,445 L 345,520 L 305,565 L 265,565 L 245,490 Z',

      // --- EROPA (6) ---
      iceland: 'M 375,80 L 415,75 L 420,105 L 380,110 Z',
      uk: 'M 390,125 L 425,120 L 430,175 L 395,180 Z M 370,140 L 388,140 L 385,168 L 368,165 Z',
      scandinavia: 'M 465,45 L 535,40 L 555,125 L 500,135 L 470,90 Z',
      w_europe: 'M 415,185 L 475,180 L 490,225 L 450,265 L 405,240 Z',
      s_europe: 'M 405,240 L 450,265 L 515,255 L 540,295 L 470,305 L 425,295 Z M 480,265 L 510,315 L 490,325 Z',
      e_europe: 'M 475,180 L 500,135 L 575,130 L 595,235 L 515,255 L 490,225 Z',

      // --- AFRIKA (5) ---
      n_africa: 'M 410,295 L 505,290 L 500,365 L 425,365 L 395,320 Z',
      egypt: 'M 505,290 L 585,285 L 600,355 L 525,370 L 500,365 Z',
      e_africa: 'M 525,370 L 600,355 L 610,435 L 560,465 L 515,435 Z',
      s_africa: 'M 425,365 L 525,370 L 515,435 L 560,465 L 545,540 L 490,540 L 455,450 Z',
      madagascar: 'M 625,435 L 648,430 L 642,495 L 620,485 Z',

      // --- ASIA (8) ---
      russia_w: 'M 575,55 L 690,45 L 700,165 L 575,130 Z',
      siberia: 'M 690,45 L 835,40 L 830,160 L 700,165 Z',
      kamchatka: 'M 835,40 L 950,35 L 960,120 L 895,160 L 830,160 Z',
      m_east: 'M 585,245 L 665,240 L 680,335 L 605,350 L 595,235 Z',
      india: 'M 665,240 L 740,240 L 755,315 L 710,380 L 670,330 Z',
      china: 'M 700,165 L 830,160 L 850,270 L 735,275 L 740,240 L 665,240 Z',
      japan: 'M 890,175 L 920,165 L 925,235 L 895,245 Z M 905,250 L 925,250 L 915,280 Z',
      se_asia: 'M 735,275 L 820,270 L 830,350 L 755,360 Z M 740,380 L 790,375 L 785,400 L 735,400 Z M 795,360 L 845,355 L 850,395 L 800,400 Z',

      // --- OSEANIA (2) ---
      w_australia: 'M 815,425 L 880,420 L 885,530 L 830,535 L 805,485 Z',
      e_australia: 'M 880,420 L 945,415 L 955,515 L 885,530 Z M 960,490 L 975,490 L 970,540 L 955,535 Z'
    };

    this.setupUI();
    this.bindSocket();
  }

  setupUI() {
    this.container.innerHTML = `
      <div class="conquest-wrapper">
        <!-- 🌟 CONQUEST HEADER -->
        <div class="conquest-header">
          <div class="conquest-title">
            <span class="star-icon">⭐</span> CONQUEST
          </div>
          <div class="conquest-score-bar">
            <div class="score-chip red-chip">
              <span class="chip-dot">🔴</span>
              <span id="p1Label">P1</span>: <b id="p1Score">6</b>
            </div>
            <div class="vs-text">VS</div>
            <div class="score-chip orange-chip">
              <span class="chip-dot">🟠</span>
              <span id="p2Label">P2</span>: <b id="p2Score">7</b>
            </div>
          </div>
          <div class="header-right-tools">
            <div class="conquest-round-tag" id="roundTag">Round 1</div>
            <button class="btn-help-guide" id="btnOpenHelp" title="Petunjuk Cara Bermain">❓ Cara Main</button>
          </div>
        </div>

        <!-- 📢 FLOATING TURN & INSTRUCTION BANNER -->
        <div class="floating-instruction-bar" id="instructionBar">
          <span class="turn-indicator-badge" id="turnIndicatorBadge">🔴 GILIRAN ANDA</span>
          <span class="instruction-main-text" id="instructionMainText">Memuat peta perang...</span>
        </div>

        <!-- 🗺️ WORLD MAP SVG ARENA -->
        <div class="conquest-map-stage">
          <svg viewBox="0 0 1000 580" class="world-svg" id="worldSvg">
            <!-- Ocean background -->
            <rect width="1000" height="580" fill="#46a2dc" rx="14" />

            <!-- Latitude navigation lines -->
            <line x1="0" y1="200" x2="1000" y2="200" stroke="rgba(255,255,255,0.4)" stroke-dasharray="10,10" stroke-width="2" />
            <line x1="0" y1="400" x2="1000" y2="400" stroke="rgba(255,255,255,0.4)" stroke-dasharray="10,10" stroke-width="2" />

            <!-- White dashed sea routes -->
            <g class="sea-routes">
              <!-- Pacific: Alaska <-> Kamchatka -->
              <line x1="30" y1="70" x2="0" y2="65" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="5,5" />
              <line x1="950" y1="40" x2="1000" y2="35" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="5,5" />
              <!-- Atlantic: Greenland <-> Iceland <-> UK -->
              <line x1="425" y1="75" x2="400" y2="85" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="5,5" />
              <line x1="410" y1="105" x2="415" y2="125" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="5,5" />
              <!-- Atlantic: Brazil <-> North Africa -->
              <line x1="385" y1="355" x2="425" y2="340" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="5,5" />
              <!-- Pacific: Japan <-> Kamchatka / China -->
              <line x1="910" y1="165" x2="900" y2="155" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="5,5" />
              <!-- Indian: Madagascar <-> East Africa -->
              <line x1="600" y1="440" x2="625" y2="445" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="5,5" />
              <!-- Indian: Madagascar <-> Western Australia -->
              <line x1="645" y1="485" x2="805" y2="480" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="5,5" />
              <!-- Coral Sea: SE Asia <-> Australia -->
              <line x1="820" y1="400" x2="840" y2="425" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="5,5" />
            </g>

            <!-- Decorative Navy Battleships on the Oceans -->
            <g class="ocean-ships">
              <!-- Ship 1 (Atlantic) -->
              <g transform="translate(320, 260) scale(0.7)">
                <path d="M 0,10 L 30,10 L 24,18 L 6,18 Z" fill="#64748b" stroke="#1e293b" stroke-width="1.5"/>
                <rect x="8" y="4" width="14" height="6" fill="#94a3b8" />
                <line x1="15" y1="0" x2="15" y2="4" stroke="#1e293b" stroke-width="1.5" />
              </g>
              <!-- Ship 2 (South Atlantic) -->
              <g transform="translate(370, 480) scale(0.65)">
                <path d="M 0,10 L 30,10 L 24,18 L 6,18 Z" fill="#64748b" stroke="#1e293b" stroke-width="1.5"/>
                <rect x="8" y="4" width="14" height="6" fill="#94a3b8" />
              </g>
              <!-- Ship 3 (Indian Ocean) -->
              <g transform="translate(670, 460) scale(0.7)">
                <path d="M 0,10 L 30,10 L 24,18 L 6,18 Z" fill="#64748b" stroke="#1e293b" stroke-width="1.5"/>
                <rect x="8" y="4" width="14" height="6" fill="#94a3b8" />
              </g>
              <!-- Ship 4 (Pacific) -->
              <g transform="translate(930, 280) scale(0.7)">
                <path d="M 0,10 L 30,10 L 24,18 L 6,18 Z" fill="#64748b" stroke="#1e293b" stroke-width="1.5"/>
                <rect x="8" y="4" width="14" height="6" fill="#94a3b8" />
              </g>
              <!-- Ship 5 (Arctic/North Sea) -->
              <g transform="translate(435, 75) scale(0.6)">
                <path d="M 0,10 L 30,10 L 24,18 L 6,18 Z" fill="#64748b" stroke="#1e293b" stroke-width="1.5"/>
                <rect x="8" y="4" width="14" height="6" fill="#94a3b8" />
              </g>
            </g>

            <!-- Real Continent Outline Filter Shadows -->
            <!-- Territories layer -->
            <g id="territoryPathsGroup"></g>

            <!-- Badges layer -->
            <g id="territoryBadgesGroup"></g>
          </svg>
        </div>

        <!-- ⚓ BOTTOM COMMAND DOCK -->
        <div class="conquest-dock">
          <!-- Left: Player Avatar & Turn Banner -->
          <div class="turn-commander-wrap">
            <div class="commander-avatar-circle" id="commanderAvatar">👧</div>
            <div class="turn-bubble" id="turnBubble">Your Turn</div>
          </div>

          <!-- Center: Armored Attack / End Turn Button -->
          <div class="armored-control-bar">
            <button class="armored-attack-btn" id="btnMainAction">
              <span class="btn-sword-icon">⚔️</span>
              <span class="btn-text-label" id="mainActionLabel">END ATTACK</span>
            </button>
            <button class="reinforce-btn" id="btnReinforce" style="display: none;">
              ➕ TAMBAH PASUKAN (<span id="reinforceCount">0</span>)
            </button>
          </div>

          <!-- Right: Instructions & Hint -->
          <div class="dock-hint" id="dockHint">
            Klik wilayah merah milikmu, lalu klik wilayah sasaran untuk menyerang!
          </div>
        </div>

        <!-- 📜 BATTLE EVENT TOAST FEED -->
        <div class="conquest-feed-box" id="conquestFeed">
          <div class="feed-item">Siap bertempur untuk supremasi dunia!</div>
        </div>

        <!-- 📢 FLOATING GAME START OVERLAY MODAL -->
        <div class="conquest-announcement-overlay" id="announcementOverlay" style="display: none;">
          <div class="announcement-banner">
            <div class="announcement-swords">⚔️ 🗺️ ⚔️</div>
            <div class="announcement-title">PERANG DUNIA DIMULAI!</div>
            <div class="announcement-first-player">
              Pemain Pertama: <span class="first-player-badge" id="announcementFirstName">sherly 🔴</span>
            </div>
            <div class="announcement-guide">
              <div class="guide-step">
                <span class="step-num">1</span>
                <span>Klik <b>wilayahmu</b> (min. 2 pasukan), lalu klik wilayah tetangga untuk menyerang / merebut!</span>
              </div>
              <div class="guide-step">
                <span class="step-num">2</span>
                <span>Setiap wilayah yang berhasil direbut memberi <b>+1 Bonus Pasukan</b> untuk memperkuat pertahanan!</span>
              </div>
              <div class="guide-step">
                <span class="step-num">3</span>
                <span>Klik tombol hijau <b>END ATTACK</b> di bawah jika sudah selesai menyerang untuk mengoper giliran.</span>
              </div>
              <div class="guide-step">
                <span class="step-num">🏆</span>
                <span><b>Syarat Menang:</b> Kuasai minimal <b>18 wilayah</b> (dari 32) ATAU habisi seluruh wilayah lawan hingga <b>0</b>!</span>
              </div>
            </div>
            <button class="btn-start-dismiss" id="btnDismissAnnouncement">
              SIAP, MULAI BERMAIN! 🚀
            </button>
          </div>
        </div>

        <!-- 👑 VICTORY OVERLAY -->
        <div class="conquest-victory-overlay" id="victoryOverlay" style="display: none;">
          <div class="victory-card">
            <div class="victory-crown" id="victoryIcon">👑</div>
            <h2 id="victoryTitle">CONQUEST COMPLETE!</h2>
            <p id="victoryDesc">Kamu Berhasil Menaklukkan Seluruh Benua Dunia!</p>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 18px; flex-wrap: wrap;">
              <button class="btn btn-primary" id="btnRestartConquest" style="font-size: 15px;">
                ⚔️ Main Lagi
              </button>
              <button class="btn btn-secondary" id="btnConquestBackToLobby" style="font-size: 15px; background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255,255,255,0.2); color: #fff;">
                🏠 Kembali ke Room
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Cache elements
    this.pathsGroup = document.getElementById('territoryPathsGroup');
    this.badgesGroup = document.getElementById('territoryBadgesGroup');
    this.p1Label = document.getElementById('p1Label');
    this.p1Score = document.getElementById('p1Score');
    this.p2Label = document.getElementById('p2Label');
    this.p2Score = document.getElementById('p2Score');
    this.roundTag = document.getElementById('roundTag');
    this.btnOpenHelp = document.getElementById('btnOpenHelp');

    this.instructionBar = document.getElementById('instructionBar');
    this.turnIndicatorBadge = document.getElementById('turnIndicatorBadge');
    this.instructionMainText = document.getElementById('instructionMainText');

    this.commanderAvatar = document.getElementById('commanderAvatar');
    this.turnBubble = document.getElementById('turnBubble');
    this.btnMainAction = document.getElementById('btnMainAction');
    this.mainActionLabel = document.getElementById('mainActionLabel');
    this.btnReinforce = document.getElementById('btnReinforce');
    this.reinforceCount = document.getElementById('reinforceCount');
    this.dockHint = document.getElementById('dockHint');
    this.feedBox = document.getElementById('conquestFeed');

    this.announcementOverlay = document.getElementById('announcementOverlay');
    this.announcementFirstName = document.getElementById('announcementFirstName');
    this.btnDismissAnnouncement = document.getElementById('btnDismissAnnouncement');

    this.victoryOverlay = document.getElementById('victoryOverlay');
    this.victoryIcon = document.getElementById('victoryIcon');
    this.victoryTitle = document.getElementById('victoryTitle');
    this.victoryDesc = document.getElementById('victoryDesc');
    this.btnRestart = document.getElementById('btnRestartConquest');

    // Button event listeners
    this.btnMainAction.addEventListener('click', () => this.handleMainActionClick());
    this.btnReinforce.addEventListener('click', () => this.handleReinforceClick());
    this.btnDismissAnnouncement.addEventListener('click', () => {
      this.announcementOverlay.style.display = 'none';
      if (window.soundManager) window.soundManager.click();
    });
    this.btnOpenHelp.addEventListener('click', () => {
      this.announcementOverlay.style.display = 'flex';
      if (window.soundManager) window.soundManager.click();
    });
    this.btnRestart.addEventListener('click', () => {
      this.socket.emit('territory:restart');
      if (window.soundManager) window.soundManager.click();
    });
    const btnLobby = document.getElementById('btnConquestBackToLobby');
    if (btnLobby) {
      btnLobby.addEventListener('click', () => {
        if (window.soundManager) window.soundManager.click();
        this.socket.emit('backToLobby');
      });
    }
  }

  bindSocket() {
    this.updateHandler = (gameData) => {
      const prevWinner = this.gameData?.winner;
      this.gameData = gameData;
      this.render();

      // Show start announcement on first load
      if (!this.hasShownStartBanner && gameData.turn && gameData.players) {
        this.hasShownStartBanner = true;
        this.triggerStartAnnouncement(gameData);
      }

      if (gameData.winner && !prevWinner) {
        if (gameData.winner === this.selfId && window.soundManager) {
          window.soundManager.winFanfare();
        } else if (window.soundManager) {
          window.soundManager.conquer();
        }
      }
    };

    this.socket.on('territory:update', this.updateHandler);
    this.socket.emit('territory:init');
  }

  triggerStartAnnouncement(gameData) {
    const firstPlayer = gameData.players[gameData.turn];
    const isMe = gameData.turn === this.selfId;
    const colorTag = firstPlayer?.color === '#ef4444' ? '🔴 Merah' : '🟠 Oranye';
    const nameStr = `${firstPlayer?.name || 'Pemain 1'} (${colorTag})`;

    if (this.announcementFirstName) {
      this.announcementFirstName.innerHTML = `<b>${nameStr}</b> ${isMe ? '👉 (KAMU)' : ''}`;
    }

    if (this.announcementOverlay) {
      this.announcementOverlay.style.display = 'flex';
      if (window.soundManager) window.soundManager.conquer();

      // Auto dismiss after 5 seconds if not clicked
      setTimeout(() => {
        if (this.announcementOverlay) {
          this.announcementOverlay.style.display = 'none';
        }
      }, 5500);
    }
  }

  render() {
    if (!this.gameData || !this.gameData.territories) return;
    const gd = this.gameData;
    const playerIds = Object.keys(gd.players);
    const p1 = gd.players[playerIds[0]];
    const p2 = gd.players[playerIds[1]] || { name: 'P2', color: '#f97316' };

    // Count territories
    let p1Count = 0;
    let p2Count = 0;
    Object.values(gd.territories).forEach(t => {
      if (t.owner === p1.id) p1Count++;
      if (t.owner === p2.id) p2Count++;
    });

    // Update Header
    this.p1Label.textContent = p1.name.slice(0, 10);
    this.p1Score.textContent = `${p1Count}/18`;
    this.p2Label.textContent = p2.name.slice(0, 10);
    this.p2Score.textContent = `${p2Count}/18`;
    this.roundTag.textContent = `Round ${gd.turnNumber || 1}`;

    // Update Turn Indicator & Avatar
    const isMyTurn = gd.turn === this.selfId;
    const currentTurnPlayer = gd.players[gd.turn] || p1;
    const myPlayer = gd.players[this.selfId] || p1;
    this.commanderAvatar.textContent = myPlayer.avatar || '👧';

    // Instruction Banner
    if (isMyTurn) {
      this.turnBubble.textContent = 'Your Turn';
      this.turnBubble.className = 'turn-bubble your-turn';
      this.btnMainAction.disabled = false;
      this.btnMainAction.classList.add('end-mode');

      this.turnIndicatorBadge.className = 'turn-indicator-badge is-my-turn';

      if (gd.phase === 'reinforce') {
        this.turnIndicatorBadge.innerHTML = `🛡️ FASE TAMBAH PASUKAN (${myPlayer.name})`;
        this.mainActionLabel.textContent = 'SELESAI GILIRAN';
        this.btnReinforce.style.display = myPlayer.reinforcements > 0 ? 'inline-flex' : 'none';
        this.reinforceCount.textContent = myPlayer.reinforcements;

        if (myPlayer.reinforcements > 0) {
          this.instructionMainText.innerHTML = `🛡️ <b>Fase Tambah Pasukan di Akhir:</b> Anda punya <b>${myPlayer.reinforcements} Pasukan Cadangan</b>! Klik wilayahmu di peta untuk menambah pertahanan (hingga kapasitas), lalu tekan <b>SELESAI GILIRAN</b>.`;
          this.dockHint.innerHTML = `🛡️ Klik wilayahmu (+1) untuk memperkuat pertahanan sebelum oper giliran.`;
        } else {
          this.instructionMainText.innerHTML = `✅ Seluruh pasukan cadangan sudah ditempatkan! Tekan tombol hijau <b>SELESAI GILIRAN</b> di bawah untuk mengoper giliran ke lawan.`;
          this.dockHint.innerHTML = `Tekan <b>SELESAI GILIRAN</b> untuk mengoper ke lawan.`;
        }
      } else {
        // Phase is 'attack'
        this.turnIndicatorBadge.innerHTML = `⚔️ FASE SERANG (${myPlayer.name})`;
        this.mainActionLabel.textContent = 'END ATTACK';
        this.btnReinforce.style.display = 'none';

        if (this.selectedTerritoryId && gd.territories[this.selectedTerritoryId]) {
          const selT = gd.territories[this.selectedTerritoryId];
          this.instructionMainText.innerHTML = `🎯 <b>${selT.name} (${selT.troops}/${selT.maxTroops})</b> terpilih! Klik wilayah sasaran bertetangga untuk MEREBUT! Tekan <b>END ATTACK</b> jika selesai menyerang.`;
          this.dockHint.innerHTML = `⚔️ Klik sasaran untuk merebut. Tekan <b>END ATTACK</b> jika sudah selesai menyerang.`;
        } else {
          this.instructionMainText.innerHTML = `⚔️ <b>Fase Serang:</b> Klik wilayah warnamu (min. 2 pasukan) ➔ lalu klik wilayah sasaran tetangga! Tekan <b>END ATTACK</b> jika sudah selesai.`;
          this.dockHint.innerHTML = `⚔️ Serang wilayah dengan pasukanmu. Tekan <b>END ATTACK</b> jika sudah selesai.`;
        }
      }
    } else {
      const oppPhaseText = gd.phase === 'reinforce' ? 'Memperkuat Pasukan' : 'Menyerang';
      this.turnBubble.textContent = `${currentTurnPlayer.name}'s Turn`;
      this.turnBubble.className = 'turn-bubble enemy-turn';
      this.btnMainAction.disabled = true;
      this.btnMainAction.classList.remove('end-mode');
      this.btnReinforce.style.display = 'none';

      const oppColorDot = currentTurnPlayer.color === '#ef4444' ? '🔴' : '🟠';
      this.turnIndicatorBadge.className = 'turn-indicator-badge is-opp-turn';
      this.turnIndicatorBadge.innerHTML = `⏳ GILIRAN: ${currentTurnPlayer.name} ${oppColorDot}`;
      this.instructionMainText.innerHTML = `Menunggu <b>${currentTurnPlayer.name}</b> sedang ${oppPhaseText}... Harap bersabar!`;
      this.dockHint.textContent = `⏳ Menunggu giliran ${currentTurnPlayer.name} selesai...`;
    }

    // Render SVG Map
    this.renderWorldMap();

    // Render Battle Feed
    if (gd.history && gd.history.length > 0) {
      this.feedBox.innerHTML = gd.history.slice(0, 4).map(h => `
        <div class="feed-item">${h}</div>
      `).join('');
    }

    // Render Victory Modal
    if (gd.winner) {
      this.victoryOverlay.style.display = 'flex';
      const isWinner = gd.winner === this.selfId;
      const winnerName = gd.players[gd.winner]?.name || 'Pemenang';
      if (isWinner) {
        this.victoryIcon.textContent = '👑';
        this.victoryTitle.innerHTML = `<span style="color: #00ff88;">VICTORY!</span>`;
        this.victoryDesc.textContent = gd.winReason || 'Kamu Berhasil Menaklukkan Seluruh Benua Dunia!';
      } else {
        this.victoryIcon.textContent = '💀';
        this.victoryTitle.innerHTML = `<span style="color: #ef4444;">DEFEAT!</span>`;
        this.victoryDesc.textContent = `${winnerName} Berhasil Menaklukkan Duniamu!`;
      }
    } else {
      this.victoryOverlay.style.display = 'none';
    }
  }

  renderWorldMap() {
    const gd = this.gameData;
    const isMyTurn = gd.turn === this.selfId;
    const playerIds = Object.keys(gd.players);
    const p1Id = playerIds[0];
    const p2Id = playerIds[1];

    this.pathsGroup.innerHTML = '';
    this.badgesGroup.innerHTML = '';

    const selectedTerr = this.selectedTerritoryId ? gd.territories[this.selectedTerritoryId] : null;
    const validNeighbors = (selectedTerr && gd.connections[selectedTerr.id]) || [];

    for (let id in this.territoryPaths) {
      const terr = gd.territories[id];
      if (!terr) continue;

      const pathData = this.territoryPaths[id];
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', pathData);
      pathEl.setAttribute('class', 'territory-shape');
      pathEl.setAttribute('data-id', id);

      // Determine fill color
      let fillColor = '#94a3b8'; // Neutral Slate Gray
      if (terr.owner === p1Id) fillColor = '#ef4444'; // Red
      if (terr.owner === p2Id) fillColor = '#f97316'; // Orange

      pathEl.setAttribute('fill', fillColor);
      pathEl.setAttribute('stroke', '#1e293b');
      pathEl.setAttribute('stroke-width', '3.5');
      pathEl.setAttribute('stroke-linejoin', 'round');

      const isSelected = this.selectedTerritoryId === id;
      const isAdjacentTarget = selectedTerr && validNeighbors.includes(id) && isMyTurn && selectedTerr.troops >= 2;

      if (isSelected) {
        pathEl.classList.add('is-selected');
        pathEl.setAttribute('stroke', '#00ffff');
        pathEl.setAttribute('stroke-width', '4.5');
      } else if (isAdjacentTarget) {
        pathEl.classList.add('is-target');
        pathEl.setAttribute('stroke', '#f59e0b');
        pathEl.setAttribute('stroke-width', '4');
        pathEl.setAttribute('stroke-dasharray', '6,4');
      }

      pathEl.addEventListener('click', () => this.handleTerritoryClick(terr));
      this.pathsGroup.appendChild(pathEl);

      // Render Badge Circle & Text (Centered firmly at terr.x, terr.y)
      const badgeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      badgeG.setAttribute('class', 'territory-badge-group');
      badgeG.setAttribute('transform', `translate(${terr.x}, ${terr.y})`);
      badgeG.style.cursor = 'pointer';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', '17');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      circle.setAttribute('stroke', '#1e293b');
      circle.setAttribute('stroke-width', '2.5');

      // Badge background color
      if (terr.owner === p1Id) {
        circle.setAttribute('fill', '#ef4444');
      } else if (terr.owner === p2Id) {
        circle.setAttribute('fill', '#f97316');
      } else {
        circle.setAttribute('fill', '#e2e8f0');
      }

      if (isSelected) {
        circle.setAttribute('stroke', '#00ffff');
        circle.setAttribute('stroke-width', '3.5');
      }

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '0');
      text.setAttribute('y', '0');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('alignment-baseline', 'central');
      text.setAttribute('font-size', '11.5');
      text.setAttribute('font-weight', '900');
      text.setAttribute('font-family', 'sans-serif');
      text.setAttribute('pointer-events', 'none');
      text.setAttribute('fill', terr.owner ? '#ffffff' : '#0f172a');
      text.textContent = `${terr.troops}/${terr.maxTroops || 3}`;

      badgeG.appendChild(circle);
      badgeG.appendChild(text);

      badgeG.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleTerritoryClick(terr);
      });
      this.badgesGroup.appendChild(badgeG);
    }
  }

  handleTerritoryClick(terr) {
    if (!this.gameData || this.gameData.winner) return;
    const isMyTurn = this.gameData.turn === this.selfId;
    if (!isMyTurn) return;

    const gd = this.gameData;
    const myPlayer = gd.players[this.selfId];

    // IF IN REINFORCE PHASE (Fase Tambah Pasukan di Akhir):
    if (gd.phase === 'reinforce') {
      if (terr.owner === this.selfId && myPlayer.reinforcements > 0) {
        if (terr.troops < (terr.maxTroops || 4)) {
          if (window.soundManager) window.soundManager.coin();
          this.socket.emit('territory:deploy', { territoryId: terr.id });
        } else {
          if (window.soundManager) window.soundManager.click();
          this.instructionMainText.innerHTML = `⚠️ Wilayah <b>${terr.name}</b> sudah mencapai kapasitas penuh (${terr.troops}/${terr.maxTroops})! Pilih wilayah lain.`;
        }
      }
      return;
    }

    // IF IN ATTACK PHASE (Fase Serang):
    // Priority 1: If I have a territory selected and click an adjacent territory -> ATTACK OR TRANSFER!
    if (this.selectedTerritoryId !== null) {
      const selectedTerr = gd.territories[this.selectedTerritoryId];
      const validNeighbors = gd.connections[selectedTerr.id] || [];

      if (validNeighbors.includes(terr.id) && selectedTerr.troops >= 2) {
        if (terr.owner !== this.selfId) {
          // ATTACK ENEMY OR CONQUER NEUTRAL TERRITORY!
          if (window.soundManager) window.soundManager.swordClash();
          this.socket.emit('territory:attack', {
            fromId: selectedTerr.id,
            toId: terr.id
          });
          this.selectedTerritoryId = null;
        } else {
          // TRANSFER TROOPS TO OWN TERRITORY
          if (window.soundManager) window.soundManager.click();
          this.socket.emit('territory:attack', {
            fromId: selectedTerr.id,
            toId: terr.id
          });
          this.selectedTerritoryId = null;
        }
        return;
      }
    }

    // Priority 2: Select owned territory with troops >= 2 (or deselect)
    if (terr.owner === this.selfId) {
      this.selectedTerritoryId = (this.selectedTerritoryId === terr.id) ? null : terr.id;
      if (window.soundManager) window.soundManager.click();
    } else {
      this.selectedTerritoryId = null;
    }
    this.render();
  }

  handleMainActionClick() {
    if (!this.gameData || this.gameData.turn !== this.selfId) return;
    if (window.soundManager) window.soundManager.click();
    this.selectedTerritoryId = null;
    this.socket.emit('territory:endTurn');
  }

  handleReinforceClick() {
    const myPlayer = this.gameData?.players[this.selfId];
    if (!myPlayer || myPlayer.reinforcements <= 0) return;
    // Auto deploy to selected territory or first owned territory
    const myTerrs = Object.values(this.gameData.territories).filter(t => t.owner === this.selfId);
    const target = this.selectedTerritoryId ? this.gameData.territories[this.selectedTerritoryId] : myTerrs[0];
    if (target && target.owner === this.selfId) {
      if (window.soundManager) window.soundManager.coin();
      this.socket.emit('territory:deploy', { territoryId: target.id });
    }
  }

  destroy() {
    this.socket.off('territory:update', this.updateHandler);
    this.container.innerHTML = '';
  }
}

window.TerritoryGame = TerritoryGame;
