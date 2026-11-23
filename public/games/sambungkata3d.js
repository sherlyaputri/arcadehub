// 🔤 Sambung Kata 3D - Roblox Style Multiplayer Game Engine
// Berdasarkan konsep viral Roblox Sambung Kata Indonesia & TikTok Live

class SambungKataGame3D {
  constructor(viewportEl, socket, roomInfo, selfId) {
    this.container = viewportEl;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.selfId = selfId;

    this.active = true;
    this.clock = new THREE.Clock();
    this.avatars = {}; // id -> { root, head, hair, body, leftArm, rightArm, leftLeg, rightLeg, bubbleSprite, animTime, isJumping, jumpY }

    this.gameState = {
      turnIndex: 0,
      currentTurnId: selfId,
      prompt: 'NJ',
      mode: 'syllable',
      timeLeft: 15,
      usedWords: [],
      lastWord: '',
      playerData: {},
      winner: null,
      status: 'playing',
      history: []
    };

    this.initThree();
    this.buildStageEnvironment();
    this.buildHUD();
    this.spawnAvatars();
    this.bindSocketEvents();
    this.animate();

    // Notify server we're ready
    this.socket.emit('sambungkata:ready');
  }

  initThree() {
    this.width = this.container.clientWidth || 1200;
    this.height = this.container.clientHeight || 750;

    this.scene = new THREE.Scene();

    // 🌅 Sunset Twilight Skybox (Warna senja hangat persis gambar referensi)
    this.scene.background = new THREE.Color(0xfb923c);
    this.scene.fog = new THREE.FogExp2(0xfb923c, 0.009);

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 800);
    this.camera.position.set(0, 3.8, 8.5);
    this.camera.lookAt(0, 2.0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.canvas = this.renderer.domElement;
    this.canvas.id = 'sambungKataCanvas';
    this.container.appendChild(this.canvas);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffedd5, 0.95);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.4);
    sunLight.position.set(8, 18, 12);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    this.scene.add(sunLight);

    const sunsetRimLight = new THREE.DirectionalLight(0xf43f5e, 0.8);
    sunsetRimLight.position.set(-10, 5, -8);
    this.scene.add(sunsetRimLight);

    // Window resize
    this.resizeHandler = () => {
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  buildStageEnvironment() {
    // 🪵 1. Panggung Kayu (Wooden Deck Stage)
    const deckGeo = new THREE.CylinderGeometry(10, 10.5, 0.8, 32);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.85,
      metalness: 0.1
    });
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.position.y = -0.4;
    deckMesh.receiveShadow = true;
    this.scene.add(deckMesh);

    // Garis lantai kayu (Wood Planks Detail)
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    for (let r = 2.5; r <= 9.5; r += 2.2) {
      const ringGeo = new THREE.RingGeometry(r, r + 0.08, 32);
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.01;
      this.scene.add(ringMesh);
    }

    // 🧱 2. Pagar / Balok Kayu Latar Belakang (Seperti di foto)
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 });
    for (let i = -4; i <= 4; i++) {
      const postGeo = new THREE.BoxGeometry(0.35, 3.2, 0.35);
      const postMesh = new THREE.Mesh(postGeo, fenceMat);
      postMesh.position.set(i * 2.2, 1.4, -4.5);
      postMesh.castShadow = true;
      this.scene.add(postMesh);
    }
    const barGeo = new THREE.BoxGeometry(19, 0.28, 0.25);
    const barMesh1 = new THREE.Mesh(barGeo, fenceMat);
    barMesh1.position.set(0, 1.2, -4.5);
    this.scene.add(barMesh1);
    const barMesh2 = new THREE.Mesh(barGeo, fenceMat);
    barMesh2.position.set(0, 2.4, -4.5);
    this.scene.add(barMesh2);

    // 🌿 3. Rumput Hijau & Bukit (Grassy Ground & Mountain Hills)
    const groundGeo = new THREE.PlaneGeometry(350, 350);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.95 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.42;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Bukit di kejauhan
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.9 });
    for (let i = 0; i < 8; i++) {
      const hillGeo = new THREE.ConeGeometry(18 + i * 4, 22 + i * 3, 7);
      const hillMesh = new THREE.Mesh(hillGeo, hillMat);
      const angle = (i / 8) * Math.PI * 2;
      hillMesh.position.set(Math.cos(angle) * 75, 4, Math.sin(angle) * 75 - 30);
      this.scene.add(hillMesh);
    }

    // 🌲 4. Pohon-pohon Blok (Blocky Low-Poly Trees)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
    for (let t = -5; t <= 5; t += 2) {
      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 4.5, 6), trunkMat);
      trunk.position.y = 2.0;
      treeGroup.add(trunk);

      for (let l = 0; l < 3; l++) {
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.4 - l * 0.45, 2.6, 6), leavesMat);
        leaves.position.y = 3.6 + l * 1.5;
        leaves.castShadow = true;
        treeGroup.add(leaves);
      }
      treeGroup.position.set(t * 3.8 + (Math.random() - 0.5) * 2, 0, -8 - Math.random() * 4);
      this.scene.add(treeGroup);
    }
  }

  // 🧑‍🎨 Pembuatan Karakter Roblox 3D Lengkap dengan Wajah Kacamata & Rambut Anime (Persis Gambar)
  createRobloxAvatar(player) {
    const avatar = new THREE.Group();
    const outfitColor = player.color ? new THREE.Color(player.color) : new THREE.Color(0x18181b);

    // Bahan Kulit (Skin Tone)
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 });
    // Bahan Baju / Hoodie (Black Jacket seperti foto)
    const outfitMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
    // Bahan Rambut Hitam
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });

    // 1. Kaki Kiri & Kanan (Legs)
    const legGeo = new THREE.BoxGeometry(0.48, 1.35, 0.48);
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.32, 0.68, 0);
    leftLeg.castShadow = true;
    avatar.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.32, 0.68, 0);
    rightLeg.castShadow = true;
    avatar.add(rightLeg);

    // 2. Badan / Tubuh (Torso)
    const torsoGeo = new THREE.BoxGeometry(1.25, 1.45, 0.65);
    const torso = new THREE.Mesh(torsoGeo, outfitMat);
    torso.position.set(0, 2.05, 0);
    torso.castShadow = true;
    avatar.add(torso);

    // Badge / Detail Baju di Dada
    const badgeGeo = new THREE.PlaneGeometry(0.55, 0.55);
    const badgeMat = new THREE.MeshBasicMaterial({ color: outfitColor });
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0, 2.1, 0.33);
    avatar.add(badge);

    // 3. Tangan Kiri & Kanan (Arms)
    const armGeo = new THREE.BoxGeometry(0.42, 1.35, 0.45);
    const leftArm = new THREE.Mesh(armGeo, outfitMat);
    leftArm.position.set(-0.92, 2.0, 0);
    leftArm.castShadow = true;
    avatar.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, outfitMat);
    rightArm.position.set(0.92, 2.0, 0);
    rightArm.castShadow = true;
    avatar.add(rightArm);

    // 4. Kepala Kotak (Roblox Head) dengan Tekstur Wajah Kacamata
    const headCanvas = document.createElement('canvas');
    headCanvas.width = 256;
    headCanvas.height = 256;
    const hctx = headCanvas.getContext('2d');

    // Background Kulit Wajah
    hctx.fillStyle = '#d4a373';
    hctx.fillRect(0, 0, 256, 256);

    // Mata Anime Tajam & Kacamata Hitam Kotak (Persis Gambar)
    hctx.strokeStyle = '#09090b';
    hctx.lineWidth = 14;
    // Frame Kacamata Kiri
    hctx.strokeRect(32, 85, 75, 58);
    // Frame Kacamata Kanan
    hctx.strokeRect(148, 85, 75, 58);
    // Jembatan Kacamata
    hctx.beginPath();
    hctx.moveTo(107, 110);
    hctx.lineTo(148, 110);
    hctx.stroke();

    // Lensa Mata di Dalam Kacamata
    hctx.fillStyle = '#ffffff';
    hctx.fillRect(45, 96, 50, 36);
    hctx.fillRect(160, 96, 50, 36);

    // Pupil Hitam
    hctx.fillStyle = '#1e1b4b';
    hctx.beginPath();
    hctx.arc(70, 114, 16, 0, Math.PI * 2);
    hctx.arc(185, 114, 16, 0, Math.PI * 2);
    hctx.fill();

    // Kilau Cahaya Putih di Mata
    hctx.fillStyle = '#ffffff';
    hctx.beginPath();
    hctx.arc(65, 108, 6, 0, Math.PI * 2);
    hctx.arc(180, 108, 6, 0, Math.PI * 2);
    hctx.fill();

    // Mulut Cool Kalem
    hctx.strokeStyle = '#7c2d12';
    hctx.lineWidth = 5;
    hctx.beginPath();
    hctx.moveTo(112, 185);
    hctx.lineTo(144, 185);
    hctx.stroke();

    const faceTex = new THREE.CanvasTexture(headCanvas);
    const headMaterials = [
      skinMat, // kanan
      skinMat, // kiri
      skinMat, // atas
      skinMat, // bawah
      new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.7 }), // DEPAN (Wajah Kacamata)
      skinMat  // belakang
    ];

    const headGeo = new THREE.BoxGeometry(1.05, 1.05, 1.05);
    const head = new THREE.Mesh(headGeo, headMaterials);
    head.position.set(0, 3.25, 0);
    head.castShadow = true;
    avatar.add(head);

    // 5. Rambut Anime Hitam Blok (Black Anime Hair Fringe)
    const hairTopGeo = new THREE.BoxGeometry(1.18, 0.45, 1.18);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 3.82, 0);
    avatar.add(hairTop);

    // Poni Rambut Depan Jatuh di Atas Kacamata
    for (let b = -0.4; b <= 0.4; b += 0.22) {
      const bangGeo = new THREE.BoxGeometry(0.24, 0.45, 0.35);
      const bang = new THREE.Mesh(bangGeo, hairMat);
      bang.position.set(b, 3.65, 0.52);
      bang.rotation.x = 0.2;
      avatar.add(bang);
    }

    // 6. 💬 BUBBLE CARD 3D MELAYANG DI ATAS KEPALA (PERSIS GAMBAR: BENDERA INDONESIA 🇮🇩 & DUA HURUF BESAR)
    const bubbleCanvas = document.createElement('canvas');
    bubbleCanvas.width = 512;
    bubbleCanvas.height = 512;
    const bctx = bubbleCanvas.getContext('2d');

    const bubbleTexture = new THREE.CanvasTexture(bubbleCanvas);
    const bubbleMat = new THREE.SpriteMaterial({ map: bubbleTexture, transparent: true });
    const bubbleSprite = new THREE.Sprite(bubbleMat);
    bubbleSprite.position.set(0, 5.6, 0);
    bubbleSprite.scale.set(3.4, 3.4, 1);
    avatar.add(bubbleSprite);

    // Simpan data render bubble
    avatar.userData = {
      bubbleCanvas,
      bubbleTexture,
      bctx
    };

    this.updateAvatarBubbleCard(avatar, 'NJ', player.name);

    return {
      root: avatar,
      head,
      torso,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      bubbleSprite,
      animTime: Math.random() * 10,
      jumpY: 0,
      isJumping: false,
      playerName: player.name
    };
  }

  // Gambar Kartu Putih Melayang dengan Bendera 🇮🇩 dan Huruf Besar
  updateAvatarBubbleCard(avatar, promptText, playerName) {
    const { bubbleCanvas, bubbleTexture, bctx } = avatar.userData;
    bctx.clearRect(0, 0, 512, 512);

    // 1. Text Top 99+ Nama Player
    bctx.fillStyle = '#ffffff';
    bctx.strokeStyle = '#000000';
    bctx.lineWidth = 8;
    bctx.font = 'bold 34px sans-serif';
    bctx.textAlign = 'center';
    bctx.strokeText(`Top 99+`, 256, 52);
    bctx.fillText(`Top 99+`, 256, 52);

    bctx.font = '900 44px sans-serif';
    bctx.strokeText((playerName || 'PEMAIN').toUpperCase(), 256, 102);
    bctx.fillText((playerName || 'PEMAIN').toUpperCase(), 256, 102);

    // 2. Ikon HP 📱 & Bendera Indonesia 🇮🇩
    bctx.font = '40px sans-serif';
    bctx.fillText(`📱 🇮🇩`, 256, 155);

    // 3. Kotak Putih Melayang Bersudut Bulat (White Rounded Speech Card)
    bctx.save();
    bctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    bctx.shadowBlur = 24;
    bctx.shadowOffsetY = 12;

    bctx.fillStyle = '#ffffff';
    bctx.strokeStyle = '#0f172a';
    bctx.lineWidth = 14;
    this.roundRect(bctx, 96, 180, 320, 290, 48);
    bctx.fill();
    bctx.stroke();
    bctx.restore();

    // 4. Huruf Promosi Besar di Tengah Kotak Putih (contoh: NJ atau TL)
    bctx.fillStyle = '#0f172a';
    bctx.font = '900 130px sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText(promptText || 'NJ', 256, 325);

    bubbleTexture.needsUpdate = true;
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  spawnAvatars() {
    const playersArr = Object.values(this.roomInfo.players);
    const total = playersArr.length;

    playersArr.forEach((p, idx) => {
      const avatarObj = this.createRobloxAvatar(p);

      // Susun melingkar atau berjejer di panggung
      const spacing = 3.2;
      const startX = -((total - 1) * spacing) / 2;
      const xPos = total === 1 ? 0 : startX + idx * spacing;
      const zPos = total === 1 ? 0 : -Math.abs(xPos * 0.25);

      avatarObj.root.position.set(xPos, 0, zPos);
      this.scene.add(avatarObj.root);
      this.avatars[p.id] = avatarObj;
    });
  }

  buildHUD() {
    this.hudWrap = document.createElement('div');
    this.hudWrap.id = 'sambungKataHUD';
    this.hudWrap.innerHTML = `
      <style>
        #sambungKataHUD {
          position: absolute;
          inset: 0;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 16px;
          z-index: 20;
          font-family: inherit;
        }
        .sk-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .sk-card {
          background: rgba(15, 23, 42, 0.90);
          backdrop-filter: blur(10px);
          border: 2px solid #f59e0b;
          border-radius: 16px;
          padding: 10px 18px;
          color: #ffffff;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
        }
        .sk-badge {
          display: inline-block;
          background: #f59e0b;
          color: #0f172a;
          font-weight: 900;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          text-transform: uppercase;
        }
        .sk-lives {
          font-size: 22px;
          letter-spacing: 2px;
          margin-top: 4px;
        }
        .sk-center-prompt {
          background: rgba(15, 23, 42, 0.92);
          border: 2px solid #00f2fe;
          border-radius: 20px;
          padding: 8px 24px;
          text-align: center;
          color: #fff;
          box-shadow: 0 0 25px rgba(0, 242, 254, 0.35);
        }
        .sk-prompt-letter {
          font-size: 38px;
          font-weight: 900;
          color: #facc15;
          letter-spacing: 4px;
          text-shadow: 0 0 15px rgba(250, 204, 21, 0.6);
        }
        .sk-timer {
          font-size: 28px;
          font-weight: 900;
          color: #00ff88;
        }
        .sk-timer.danger {
          color: #ef4444;
          animation: pulse 0.5s infinite alternate;
        }
        .sk-history-box {
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 8px 14px;
          max-height: 120px;
          overflow-y: auto;
          font-size: 13px;
          color: #e2e8f0;
          width: 260px;
        }
        .sk-bottom-input-wrap {
          pointer-events: auto;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 12px;
        }
        .sk-input-form {
          display: flex;
          gap: 10px;
          width: 100%;
          max-width: 600px;
          background: rgba(15, 23, 42, 0.95);
          border: 2px solid #f59e0b;
          border-radius: 50px;
          padding: 6px 10px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
        }
        .sk-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 18px;
          font-weight: 700;
          padding: 8px 18px;
          outline: none;
          text-transform: uppercase;
        }
        .sk-input::placeholder {
          color: #64748b;
          font-size: 14px;
          text-transform: none;
        }
        .sk-btn-send {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border: none;
          border-radius: 40px;
          color: #0f172a;
          font-weight: 900;
          font-size: 15px;
          padding: 8px 24px;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.1s;
        }
        .sk-btn-send:hover {
          transform: scale(1.04);
          box-shadow: 0 0 15px rgba(245, 158, 11, 0.6);
        }
        .sk-feedback-msg {
          position: absolute;
          bottom: 85px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(239, 68, 68, 0.92);
          color: #fff;
          font-weight: 800;
          padding: 6px 18px;
          border-radius: 20px;
          font-size: 14px;
          display: none;
          box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        }
        .sk-feedback-msg.success {
          background: rgba(16, 185, 129, 0.92);
        }
      </style>

      <div class="sk-top-bar">
        <div class="sk-card">
          <div class="sk-badge">❤️ Sisa Nyawa Kamu</div>
          <div class="sk-lives" id="skLivesDisplay">❤️❤️❤️</div>
          <div style="font-size: 13px; font-weight: 800; color: #fbbf24; margin-top: 4px;" id="skScoreDisplay">Skor: 0</div>
        </div>

        <div class="sk-center-prompt">
          <div style="font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">
            🔤 2 Huruf Awalan Kata
          </div>
          <div class="sk-prompt-letter" id="skPromptDisplay">AN</div>
          <div style="font-size: 13px; color: #38bdf8; font-weight: 700;" id="skTurnIndicator">
            Giliran Kamu!
          </div>
        </div>

        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
          <div class="sk-card" style="text-align: center; min-width: 90px;">
            <div style="font-size: 11px; font-weight: 800; color: #94a3b8;">SISA WAKTU</div>
            <div class="sk-timer" id="skTimerDisplay">15s</div>
          </div>
          <div class="sk-history-box" id="skHistoryList">
            <strong>Rantai Sambung Kata:</strong>
            <div id="skHistoryContent">Belum ada kata</div>
          </div>
        </div>
      </div>

      <div class="sk-feedback-msg" id="skFeedbackMsg">Kata tidak valid!</div>

      <div class="sk-bottom-input-wrap">
        <form class="sk-input-form" id="skInputForm">
          <input type="text" class="sk-input" id="skWordInput" placeholder="Ketik kata berawalan [AN]... (misal: ANGGUR)" autocomplete="off" />
          <button type="submit" class="sk-btn-send" id="skBtnSend">KIRIM ↵</button>
        </form>
      </div>
    `;

    this.container.appendChild(this.hudWrap);

    this.livesEl = document.getElementById('skLivesDisplay');
    this.scoreEl = document.getElementById('skScoreDisplay');
    this.promptEl = document.getElementById('skPromptDisplay');
    this.turnIndicatorEl = document.getElementById('skTurnIndicator');
    this.timerEl = document.getElementById('skTimerDisplay');
    this.historyEl = document.getElementById('skHistoryContent');
    this.inputEl = document.getElementById('skWordInput');
    this.formEl = document.getElementById('skInputForm');
    this.feedbackEl = document.getElementById('skFeedbackMsg');

    this.formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = this.inputEl.value.trim();
      if (!val) return;

      this.socket.emit('sambungkata:submit', { word: val });
      this.inputEl.value = '';
    });
  }

  showFeedback(msg, isSuccess = false) {
    if (!this.feedbackEl) return;
    this.feedbackEl.textContent = msg;
    this.feedbackEl.className = isSuccess ? 'sk-feedback-msg success' : 'sk-feedback-msg';
    this.feedbackEl.style.display = 'block';
    clearTimeout(this.feedbackTimeout);
    this.feedbackTimeout = setTimeout(() => {
      if (this.feedbackEl) this.feedbackEl.style.display = 'none';
    }, 2200);
  }

  bindSocketEvents() {
    this.onStateUpdate = (state) => {
      this.gameState = state;
      this.renderHUD();

      // Update bubble text pada avatar yang sedang gilirannya
      Object.keys(this.avatars).forEach(id => {
        const av = this.avatars[id];
        const isCurrentTurn = id === state.currentTurnId;
        const pData = state.playerData[id];
        const pName = pData ? pData.name : av.playerName;

        this.updateAvatarBubbleCard(av.root, state.prompt, pName);

        // Skala membesar sedikit jika giliran aktif
        av.bubbleSprite.scale.set(isCurrentTurn ? 3.9 : 3.2, isCurrentTurn ? 3.9 : 3.2, 1);
      });

      // Fokus kamera ke pemain yang sedang mendapat giliran
      const activeAv = this.avatars[state.currentTurnId];
      if (activeAv) {
        this.targetCameraX = activeAv.root.position.x * 0.7;
      }
    };

    this.onWordAccepted = ({ playerId, word, score }) => {
      if (window.soundManager) window.soundManager.playBeep(784, 0.25, 'sine');
      const av = this.avatars[playerId];
      if (av) {
        av.isJumping = true;
        av.jumpY = 0;
      }
      if (playerId === this.selfId) {
        this.showFeedback(`✅ Kata "${word}" Benar! (+Skor)`, true);
      }
    };

    this.onTimeout = ({ playerId, remainingLives }) => {
      if (window.soundManager) window.soundManager.playBeep(180, 0.35, 'sawtooth');
      if (playerId === this.selfId) {
        this.showFeedback(`⏳ Waktu Habis! Nyawa berkurang 1`, false);
      }
    };

    this.onInvalidWord = (msg) => {
      if (window.soundManager) window.soundManager.playBeep(220, 0.2, 'sawtooth');
      this.showFeedback(`❌ ${msg}`, false);
    };

    this.socket.on('sambungkata:update', this.onStateUpdate);
    this.socket.on('sambungkata:wordAccepted', this.onWordAccepted);
    this.socket.on('sambungkata:timeout', this.onTimeout);
    this.socket.on('sambungkata:invalid', this.onInvalidWord);
  }

  renderHUD() {
    const s = this.gameState;
    const myData = s.playerData[this.selfId] || { lives: 3, score: 0 };

    // Lives display
    let hearts = '';
    for (let i = 0; i < myData.lives; i++) hearts += '❤️';
    for (let i = myData.lives; i < 3; i++) hearts += '🖤';
    this.livesEl.textContent = hearts;
    this.scoreEl.textContent = `Skor: ${myData.score} Poin`;

    // Prompt & Turn
    this.promptEl.textContent = s.prompt;
    const isMyTurn = s.currentTurnId === this.selfId;
    const activePlayerName = s.playerData[s.currentTurnId]?.name || 'Pemain';

    if (isMyTurn) {
      this.turnIndicatorEl.textContent = '👉 GILIRAN KAMU SEKARANG!';
      this.turnIndicatorEl.style.color = '#00ff88';
      this.inputEl.disabled = false;
      this.inputEl.placeholder = `Ketik kata berawalan [${s.prompt}]... (misal: ${s.prompt}...)`;
      this.inputEl.focus();
    } else {
      this.turnIndicatorEl.textContent = `⏳ Giliran ${activePlayerName} (Awalan: ${s.prompt})...`;
      this.turnIndicatorEl.style.color = '#94a3b8';
      this.inputEl.disabled = true;
      this.inputEl.placeholder = `Menunggu ${activePlayerName} menjawab kata berawalan [${s.prompt}]...`;
    }

    // Timer
    this.timerEl.textContent = `${s.timeLeft}s`;
    if (s.timeLeft <= 5) {
      this.timerEl.classList.add('danger');
      if (isMyTurn && window.soundManager && Math.random() < 0.4) {
        window.soundManager.playBeep(440, 0.05, 'triangle');
      }
    } else {
      this.timerEl.classList.remove('danger');
    }

    // History Rantai Kata
    if (s.usedWords && s.usedWords.length > 0) {
      this.historyEl.innerHTML = s.usedWords.slice(-5).map((w) => {
        const end2 = w.slice(-2);
        return `<div style="color: #38bdf8; font-weight: 700; margin-top: 3px;">• ${w} <span style="color: #facc15;">➔ [${end2}]</span></div>`;
      }).reverse().join('');
    } else {
      this.historyEl.textContent = 'Belum ada kata';
    }

    // Winner celebration
    if (s.status === 'finished' && s.winner) {
      this.showWinnerModal(s.winner);
    }
  }

  showWinnerModal(winner) {
    if (this.winnerShown) return;
    this.winnerShown = true;
    if (window.soundManager) window.soundManager.winFanfare();

    const isMe = winner.id === this.selfId;
    const modal = document.createElement('div');
    modal.style = `
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.88);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 50;
      padding: 20px;
    `;
    modal.innerHTML = `
      <div style="background: #1e293b; border: 3px solid #f59e0b; border-radius: 24px; padding: 36px 28px; text-align: center; max-width: 450px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.8); color: #fff;">
        <div style="font-size: 64px; margin-bottom: 12px;">🏆</div>
        <h2 style="font-size: 28px; font-weight: 900; margin-bottom: 8px;">${isMe ? 'SELAMAT, KAMU JUARA!' : 'PEMENANG SAMBUNG KATA!'}</h2>
        <div style="font-size: 20px; font-weight: 800; color: #fbbf24; margin-bottom: 16px;">${winner.name}</div>
        <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">Bertahan sebagai pemain terakhir dengan perbendaharaan kata terbanyak!</p>
        <button class="btn btn-primary" id="btnRestartSK" style="padding: 12px 28px; font-size: 16px; font-weight: 800; border-radius: 30px;">
          🔄 Main Ronde Berikutnya
        </button>
      </div>
    `;
    this.container.appendChild(modal);

    const restartBtn = document.getElementById('btnRestartSK');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.socket.emit('sambungkata:restart');
        modal.remove();
        this.winnerShown = false;
      });
    }
  }

  animate() {
    if (!this.active) return;
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // Kamera smooth panning ke pemain yang sedang jalan
    if (this.targetCameraX !== undefined) {
      this.camera.position.x += (this.targetCameraX - this.camera.position.x) * 0.08;
      this.camera.lookAt(this.camera.position.x * 0.6, 2.0, 0);
    }

    // Animasi Avatar Roblox
    Object.keys(this.avatars).forEach(id => {
      const av = this.avatars[id];
      av.animTime += delta;

      // 1. Pernapasan / Idle Bobbing
      const idleBob = Math.sin(av.animTime * 2.8) * 0.04;
      av.torso.position.y = 2.05 + idleBob;
      av.head.position.y = 3.25 + idleBob * 1.2;
      av.bubbleSprite.position.y = 5.6 + idleBob * 1.5;

      // Gerakan tangan santai
      av.leftArm.rotation.x = Math.sin(av.animTime * 2.8) * 0.08;
      av.rightArm.rotation.x = -Math.sin(av.animTime * 2.8) * 0.08;

      // 2. Animasi Melompat saat Jawaban Benar
      if (av.isJumping) {
        av.jumpY += delta * 12;
        const jumpH = Math.sin(av.jumpY) * 1.2;
        av.root.position.y = Math.max(0, jumpH);
        av.leftArm.rotation.z = 1.2; // Tangan angkat ke atas (Victory pose)
        av.rightArm.rotation.z = -1.2;

        if (av.jumpY >= Math.PI) {
          av.isJumping = false;
          av.root.position.y = 0;
          av.leftArm.rotation.z = 0;
          av.rightArm.rotation.z = 0;
        }
      }

      // 3. Animasi Gemetar jika Sisa Waktu < 5 Detik & Gilirannya
      if (this.gameState.currentTurnId === id && this.gameState.timeLeft <= 5) {
        const jitter = (Math.random() - 0.5) * 0.06;
        av.head.position.x = jitter;
        av.torso.position.x = jitter * 0.5;
      } else {
        av.head.position.x = 0;
        av.torso.position.x = 0;
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.active = false;
    window.removeEventListener('resize', this.resizeHandler);
    if (this.socket) {
      this.socket.off('sambungkata:update', this.onStateUpdate);
      this.socket.off('sambungkata:wordAccepted', this.onWordAccepted);
      this.socket.off('sambungkata:timeout', this.onTimeout);
      this.socket.off('sambungkata:invalid', this.onInvalidWord);
    }
    if (this.hudWrap) this.hudWrap.remove();
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
  }
}

window.SambungKataGame3D = SambungKataGame3D;
