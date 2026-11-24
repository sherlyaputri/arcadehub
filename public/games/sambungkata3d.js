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

    // Camera - Posisi close-up potret Roblox (Persis Gambar Referensi)
    this.camera = new THREE.PerspectiveCamera(46, this.width / this.height, 0.1, 800);
    this.camera.position.set(0, 3.4, 6.8);
    this.camera.lookAt(0, 2.7, 0);

    // Orbit Controls & Auto Focus Target
    this.orbitYaw = 0;
    this.orbitPitch = 0;
    this.orbitDist = 5.6;
    this.arenaRadius = 3.4;
    this.currentCameraAngle = Math.PI;
    this.targetCameraAngle = Math.PI;
    this.setupCameraControls();

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

  // 🎮 Kontrol Kamera Geser / Orbit 360° & Zoom
  setupCameraControls() {
    this.isDragging = false;
    this.prevMouseX = 0;
    this.prevMouseY = 0;

    const onPointerDown = (e) => {
      // Abaikan jika klik form input, tombol, atau kartu HUD
      if (e.target && (e.target.closest('#skInputForm') || e.target.closest('button') || e.target.closest('input'))) return;
      this.isDragging = true;
      this.prevMouseX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX) || 0;
      this.prevMouseY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY) || 0;
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX) || 0;
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY) || 0;
      const dx = clientX - this.prevMouseX;
      const dy = clientY - this.prevMouseY;

      // Geser sudut pandang horizontal (Yaw) & vertikal (Pitch)
      this.orbitYaw -= dx * 0.007;
      this.orbitPitch = Math.max(-0.45, Math.min(0.65, this.orbitPitch + dy * 0.006));

      this.prevMouseX = clientX;
      this.prevMouseY = clientY;
    };

    const onPointerUp = () => {
      this.isDragging = false;
    };

    const onWheel = (e) => {
      // Zoom in / zoom out kamera
      this.orbitDist = Math.max(3.8, Math.min(14.0, this.orbitDist + e.deltaY * 0.008));
    };

    this.container.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    this.container.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    this.container.addEventListener('wheel', onWheel, { passive: true });

    this.cleanupCameraControls = () => {
      this.container.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      this.container.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      this.container.removeEventListener('wheel', onWheel);
    };
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

    // 🧱 2. Pagar Kayu Melingkar Mengelilingi Seluruh Panggung (360° Fence)
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 });
    const postGeo = new THREE.BoxGeometry(0.32, 2.6, 0.32);
    const numPosts = 24;
    const fenceRadius = 9.3;

    for (let i = 0; i < numPosts; i++) {
      const a1 = (i / numPosts) * Math.PI * 2;
      const a2 = ((i + 1) / numPosts) * Math.PI * 2;
      const x1 = Math.cos(a1) * fenceRadius;
      const z1 = Math.sin(a1) * fenceRadius;
      const x2 = Math.cos(a2) * fenceRadius;
      const z2 = Math.sin(a2) * fenceRadius;

      // Tiang pagar tegak
      const postMesh = new THREE.Mesh(postGeo, fenceMat);
      postMesh.position.set(x1, 1.2, z1);
      postMesh.castShadow = true;
      this.scene.add(postMesh);

      // Balok palang pagar horizontal atas & bawah menghubungkan tiang
      const segLen = Math.hypot(x2 - x1, z2 - z1);
      const barGeo = new THREE.BoxGeometry(segLen + 0.1, 0.22, 0.18);
      const midX = (x1 + x2) / 2;
      const midZ = (z1 + z2) / 2;
      const rotY = Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2;

      const bar1 = new THREE.Mesh(barGeo, fenceMat);
      bar1.position.set(midX, 1.0, midZ);
      bar1.rotation.y = rotY;
      this.scene.add(bar1);

      const bar2 = new THREE.Mesh(barGeo, fenceMat);
      bar2.position.set(midX, 2.0, midZ);
      bar2.rotation.y = rotY;
      this.scene.add(bar2);
    }

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

    // 🌲 4. Pohon-pohon Blok Mengelilingi Arena Panggung (360° Trees)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
    const numTrees = 18;
    for (let t = 0; t < numTrees; t++) {
      const treeAngle = (t / numTrees) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
      const treeDist = 13.5 + (t % 3) * 3;
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
      treeGroup.position.set(Math.cos(treeAngle) * treeDist, 0, Math.sin(treeAngle) * treeDist);
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

    // Graphic Print Sablon Bulat Putih di Dada (Persis Gambar Kaos Hitam)
    const shirtCanvas = document.createElement('canvas');
    shirtCanvas.width = 128;
    shirtCanvas.height = 128;
    const sctx = shirtCanvas.getContext('2d');
    sctx.fillStyle = '#18181b';
    sctx.fillRect(0, 0, 128, 128);
    // Lingkaran motif putih
    sctx.strokeStyle = '#ffffff';
    sctx.lineWidth = 6;
    sctx.beginPath();
    sctx.arc(64, 64, 34, 0, Math.PI * 2);
    sctx.stroke();
    sctx.fillStyle = '#ffffff';
    sctx.beginPath();
    sctx.arc(64, 64, 18, 0, Math.PI * 2);
    sctx.fill();
    sctx.fillStyle = '#18181b';
    sctx.font = 'bold 20px sans-serif';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText('★', 64, 64);

    const shirtTex = new THREE.CanvasTexture(shirtCanvas);
    const badgeGeo = new THREE.PlaneGeometry(0.68, 0.68);
    const badgeMat = new THREE.MeshBasicMaterial({ map: shirtTex, transparent: true });
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0, 2.08, 0.33);
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

    // 5. Rambut Anime Hitam Blok & Berantakan (Messy Spiky Black Anime Hair persis screenshot)
    const hairTopGeo = new THREE.BoxGeometry(1.22, 0.52, 1.22);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 3.84, 0);
    avatar.add(hairTop);

    // Poni Rambut Depan Jatuh di Atas Kacamata
    const bangsConfig = [
      { x: -0.42, y: 3.65, z: 0.54, w: 0.22, h: 0.48, rotZ: 0.1, rotX: 0.22 },
      { x: -0.22, y: 3.58, z: 0.56, w: 0.24, h: 0.56, rotZ: -0.05, rotX: 0.25 },
      { x: 0.0,   y: 3.62, z: 0.58, w: 0.25, h: 0.52, rotZ: 0.08, rotX: 0.22 },
      { x: 0.22,  y: 3.56, z: 0.56, w: 0.24, h: 0.58, rotZ: 0.12, rotX: 0.25 },
      { x: 0.42,  y: 3.66, z: 0.54, w: 0.22, h: 0.48, rotZ: -0.1, rotX: 0.22 },
      // Sisi samping
      { x: -0.58, y: 3.45, z: 0.1,  w: 0.20, h: 0.75, rotZ: -0.15, rotX: 0.0 },
      { x: 0.58,  y: 3.45, z: 0.1,  w: 0.20, h: 0.75, rotZ: 0.15, rotX: 0.0 },
      // Spike belakang & atas
      { x: -0.25, y: 4.12, z: -0.1, w: 0.28, h: 0.35, rotZ: 0.2, rotX: -0.2 },
      { x: 0.25,  y: 4.15, z: -0.15, w: 0.28, h: 0.38, rotZ: -0.18, rotX: -0.2 }
    ];

    bangsConfig.forEach(cfg => {
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, 0.32), hairMat);
      bMesh.position.set(cfg.x, cfg.y, cfg.z);
      bMesh.rotation.x = cfg.rotX || 0;
      bMesh.rotation.z = cfg.rotZ || 0;
      avatar.add(bMesh);
    });

    // 6. 💬 BUBBLE CARD 3D MELAYANG DI ATAS KEPALA (PERSIS GAMBAR: IKON HP, BENDERA ID & DUA HURUF BESAR)
    const bubbleCanvas = document.createElement('canvas');
    bubbleCanvas.width = 512;
    bubbleCanvas.height = 512;
    const bctx = bubbleCanvas.getContext('2d');

    const bubbleTexture = new THREE.CanvasTexture(bubbleCanvas);
    const bubbleMat = new THREE.SpriteMaterial({ map: bubbleTexture, transparent: true });
    const bubbleSprite = new THREE.Sprite(bubbleMat);
    bubbleSprite.position.set(0, 5.2, 0);
    bubbleSprite.scale.set(3.0, 3.0, 1);
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
      playerName: player.name,
      lastAnsweredWord: ''
    };
  }

  // Helper untuk gambar sudut bulat di Canvas
  roundRectPath(ctx, x, y, w, h, r) {
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

  // Gambar Kartu Putih Melayang dengan Bendera 🇮🇩, Ikon HP, dan Huruf Besar (Persis Screenshot)
  updateAvatarBubbleCard(avatar, promptText, displayName) {
    const { bubbleCanvas, bubbleTexture, bctx } = avatar.userData;
    bctx.clearRect(0, 0, 512, 512);

    // 1. Text Rank / Title: Top 99+
    bctx.save();
    bctx.fillStyle = '#ffffff';
    bctx.strokeStyle = '#000000';
    bctx.lineWidth = 7;
    bctx.font = '900 32px sans-serif';
    bctx.textAlign = 'center';
    bctx.strokeText('Top 99+', 256, 48);
    bctx.fillText('Top 99+', 256, 48);

    // 2. Display Name / Last Answered Word (contoh: MINAOTUR di foto)
    const upperText = (displayName || 'PEMAIN').toUpperCase();
    bctx.lineWidth = 9;
    bctx.font = '900 46px sans-serif';
    bctx.strokeText(upperText, 256, 100);
    bctx.fillText(upperText, 256, 100);
    bctx.restore();

    // 3. Ikon HP 📱 & Bendera Indonesia 🇮🇩 (Digambar presisi via Canvas Vector)
    // A. Ikon Smartphone Putih-Hitam di sebelah kiri
    const phoneX = 222;
    const phoneY = 145;
    const phoneW = 28;
    const phoneH = 42;
    bctx.save();
    bctx.fillStyle = '#ffffff';
    bctx.strokeStyle = '#0f172a';
    bctx.lineWidth = 3.5;
    this.roundRectPath(bctx, phoneX - phoneW / 2, phoneY - phoneH / 2, phoneW, phoneH, 6);
    bctx.fill();
    bctx.stroke();

    // Layar HP Gelap
    bctx.fillStyle = '#0f172a';
    this.roundRectPath(bctx, phoneX - phoneW / 2 + 3.5, phoneY - phoneH / 2 + 5, phoneW - 7, phoneH - 12, 3);
    bctx.fill();

    // Notch / Home bar
    bctx.fillStyle = '#ffffff';
    bctx.fillRect(phoneX - 4, phoneY + phoneH / 2 - 4.5, 8, 2);
    bctx.restore();

    // B. Bendera Merah Putih Indonesia 🇮🇩 di sebelah kanan
    const flagX = 288;
    const flagY = 145;
    const flagW = 44;
    const flagH = 30;
    bctx.save();
    this.roundRectPath(bctx, flagX - flagW / 2, flagY - flagH / 2, flagW, flagH, 6);
    bctx.clip();

    // Merah atas
    bctx.fillStyle = '#ef4444';
    bctx.fillRect(flagX - flagW / 2, flagY - flagH / 2, flagW, flagH / 2);

    // Putih bawah
    bctx.fillStyle = '#ffffff';
    bctx.fillRect(flagX - flagW / 2, flagY, flagW, flagH / 2);

    // Border bingkai bendera
    bctx.strokeStyle = '#334155';
    bctx.lineWidth = 2.5;
    this.roundRectPath(bctx, flagX - flagW / 2, flagY - flagH / 2, flagW, flagH, 6);
    bctx.stroke();
    bctx.restore();

    // 4. Kotak Putih Melayang Bersudut Bulat (White Rounded Speech Card)
    bctx.save();
    bctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    bctx.shadowBlur = 24;
    bctx.shadowOffsetY = 10;

    bctx.fillStyle = '#ffffff';
    bctx.strokeStyle = '#18181b';
    bctx.lineWidth = 14;
    this.roundRectPath(bctx, 116, 185, 280, 260, 48);
    bctx.fill();
    bctx.stroke();
    bctx.restore();

    // 5. Huruf Prompt Besar di Tengah Kotak Putih (contoh: NJ atau TL)
    bctx.save();
    bctx.fillStyle = '#18181b';
    bctx.font = '900 135px sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText(promptText || 'NJ', 256, 315);
    bctx.restore();

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

    // Radius panggung arena untuk posisi pemain
    const circleRadius = total <= 2 ? 3.4 : Math.min(5.2, 2.6 + total * 0.45);
    this.arenaRadius = circleRadius;

    playersArr.forEach((p, idx) => {
      const avatarObj = this.createRobloxAvatar(p);

      let xPos = 0;
      let zPos = 0;
      let rotY = 0;
      let angle = 0;

      if (total === 1) {
        // 1 Pemain: Tepat di tengah panggung menghadap ke depan (+Z)
        xPos = 0;
        zPos = 0;
        rotY = 0;
        angle = Math.PI / 2;
      } else if (total === 2) {
        // 2 Pemain: Berhadapan langsung (Duel / Showdown 1v1)
        if (idx === 0) {
          xPos = -circleRadius;
          zPos = 0;
          rotY = Math.PI / 2; // Menghadap ke kanan (+X) langsung ke Pemain 2
          angle = Math.PI;    // Posisi sudut -X
        } else {
          xPos = circleRadius;
          zPos = 0;
          rotY = -Math.PI / 2; // Menghadap ke kiri (-X) langsung ke Pemain 1
          angle = 0;          // Posisi sudut +X
        }
      } else {
        // 3 Pemain atau Lebih: Melingkar mengelilingi panggung
        // Setiap pemain menghadap ke pusat lingkaran (0, 0, 0)
        angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
        xPos = Math.cos(angle) * circleRadius;
        zPos = Math.sin(angle) * circleRadius;
        rotY = Math.atan2(-xPos, -zPos); // Menghadap ke titik tengah arena
      }

      avatarObj.root.position.set(xPos, 0, zPos);
      avatarObj.root.rotation.y = rotY;
      avatarObj.arenaAngle = angle;

      this.scene.add(avatarObj.root);
      this.avatars[p.id] = avatarObj;
    });

    // Inisialisasi sudut kamera ke pemain giliran pertama
    const firstPlayerId = playersArr[0]?.id;
    if (firstPlayerId && this.avatars[firstPlayerId]) {
      this.targetCameraAngle = this.avatars[firstPlayerId].arenaAngle;
      this.currentCameraAngle = this.targetCameraAngle;
    } else {
      this.targetCameraAngle = Math.PI;
      this.currentCameraAngle = Math.PI;
    }
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
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 600px; gap: 6px;">
          <form class="sk-input-form" id="skInputForm">
            <input type="text" class="sk-input" id="skWordInput" placeholder="Ketik kata berawalan [AN]... (misal: ANGGUR)" autocomplete="off" />
            <button type="submit" class="sk-btn-send" id="skBtnSend">KIRIM ↵</button>
          </form>
          <div style="font-size: 11px; font-weight: 700; color: #cbd5e1; text-shadow: 0 1px 3px rgba(0,0,0,0.8); background: rgba(15,23,42,0.6); padding: 3px 14px; border-radius: 12px;">
            🎥 Geser mouse / layar untuk putar kamera 360° | Scroll untuk Zoom
          </div>
        </div>
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
        const displayName = av.lastAnsweredWord || (pData ? pData.name : av.playerName);

        this.updateAvatarBubbleCard(av.root, state.prompt, displayName);

        // Skala kartu sedikit membesar jika giliran aktif
        av.bubbleSprite.scale.set(isCurrentTurn ? 3.3 : 2.6, isCurrentTurn ? 3.3 : 2.6, 1);
      });

      // Auto fokus kamera ke pemain yang sedang mendapat giliran (Auto Camera Switch)
      const activeAv = this.avatars[state.currentTurnId];
      if (activeAv) {
        if (activeAv.arenaAngle !== undefined) {
          this.targetCameraAngle = activeAv.arenaAngle;
        }
        // Reset yaw sehingga kamera otomatis menatap lurus pemain yang aktif
        this.orbitYaw = 0;
      }
    };

    this.onWordAccepted = ({ playerId, word, score }) => {
      if (window.soundManager) window.soundManager.playBeep(784, 0.25, 'sine');
      const av = this.avatars[playerId];
      if (av) {
        av.isJumping = true;
        av.jumpY = 0;
        av.lastAnsweredWord = word;
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

    // Lives display (Maksimal dan selalu dikunci tepat 3 nyawa)
    const currentLives = Math.max(0, Math.min(3, myData.lives ?? 3));
    let hearts = '';
    for (let i = 0; i < currentLives; i++) hearts += '❤️';
    for (let i = currentLives; i < 3; i++) hearts += '🖤';
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

    // Winner celebration / Game Over
    if (s.status === 'finished') {
      this.showWinnerModal(s.winner);
    }
  }

  showWinnerModal(winner) {
    if (this.winnerShown) return;
    this.winnerShown = true;

    const isMe = winner && winner.id === this.selfId;
    const isGameOver = !winner; // Solo kalah atau semua tereliminasi

    if (isGameOver) {
      if (window.soundManager) window.soundManager.playBeep(160, 0.5, 'sawtooth');
    } else {
      if (window.soundManager) window.soundManager.winFanfare();
    }

    const modal = document.createElement('div');
    modal.style = `
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.90);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 50;
      padding: 20px;
    `;

    let icon = '🏆';
    let title = 'SELAMAT, KAMU JUARA!';
    let subtitle = winner ? winner.name : '';
    let desc = 'Bertahan sebagai pemain terakhir dengan perbendaharaan kata terbanyak!';

    if (isGameOver) {
      icon = '💀';
      title = 'GAME OVER!';
      subtitle = 'Nyawa Kamu Telah Habis';
      desc = '3 nyawamu telah habis karena kehabisan waktu. Asah kembali perbendaharaan katamu dan coba lagi!';
    } else if (!isMe) {
      icon = '👑';
      title = 'PEMENANG SAMBUNG KATA!';
      subtitle = winner.name;
      desc = 'Pemain ini berhasil bertahan sampai akhir!';
    }

    modal.innerHTML = `
      <div style="background: #1e293b; border: 3px solid ${isGameOver ? '#ef4444' : '#f59e0b'}; border-radius: 24px; padding: 36px 28px; text-align: center; max-width: 450px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.8); color: #fff;">
        <div style="font-size: 64px; margin-bottom: 12px;">${icon}</div>
        <h2 style="font-size: 28px; font-weight: 900; margin-bottom: 8px; color: ${isGameOver ? '#ef4444' : '#f59e0b'};">${title}</h2>
        <div style="font-size: 20px; font-weight: 800; color: #fbbf24; margin-bottom: 16px;">${subtitle}</div>
        <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">${desc}</p>
        <button class="btn btn-primary" id="btnRestartSK" style="padding: 12px 28px; font-size: 16px; font-weight: 800; border-radius: 30px; background: linear-gradient(135deg, #f59e0b, #d97706); border: none; cursor: pointer; color: #0f172a;">
          🔄 ${isGameOver ? 'Main Lagi (Reset)' : 'Main Ronde Berikutnya'}
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

    const totalPlayers = Object.keys(this.avatars).length;

    if (totalPlayers <= 1) {
      // 1 Pemain: Kamera tetap membingkai pemain solo di tengah
      const camDist = this.orbitDist || 5.6;
      const cosPitch = Math.cos(this.orbitPitch);
      const sinPitch = Math.sin(this.orbitPitch);
      const sinYaw = Math.sin(this.orbitYaw);
      const cosYaw = Math.cos(this.orbitYaw);

      const camX = camDist * cosPitch * sinYaw;
      const camY = 2.6 + camDist * sinPitch + 0.6;
      const camZ = camDist * cosPitch * cosYaw;

      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(0, 2.6, 0);
    } else {
      // 2 Pemain (Berhadapan) atau 3+ Pemain (Melingkar):
      // Interpolasi sudut kamera terpendek (shortest angular lerp) mengelilingi panggung
      if (this.targetCameraAngle !== undefined) {
        let diff = this.targetCameraAngle - this.currentCameraAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.currentCameraAngle += diff * 0.08;
      }

      const r = this.arenaRadius || 3.4;
      const targetX = Math.cos(this.currentCameraAngle) * r;
      const targetZ = Math.sin(this.currentCameraAngle) * r;
      const targetY = 2.6; // Fokus setinggi dada/wajah

      // Kamera berada di depan pemain (melihat wajah dan kartu secara lurus)
      const camDist = this.orbitDist || 5.6;
      const effectiveAngle = this.currentCameraAngle + Math.PI + this.orbitYaw;
      const cosPitch = Math.cos(this.orbitPitch);
      const sinPitch = Math.sin(this.orbitPitch);

      const camX = targetX + camDist * cosPitch * Math.cos(effectiveAngle);
      const camZ = targetZ + camDist * cosPitch * Math.sin(effectiveAngle);
      const camY = targetY + camDist * sinPitch + 0.6;

      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(targetX, targetY, targetZ);
    }

    // Animasi Avatar Roblox
    Object.keys(this.avatars).forEach(id => {
      const av = this.avatars[id];
      av.animTime += delta;

      // 1. Pernapasan / Idle Bobbing
      const idleBob = Math.sin(av.animTime * 2.8) * 0.04;
      av.torso.position.y = 2.05 + idleBob;
      av.head.position.y = 3.25 + idleBob * 1.2;
      av.bubbleSprite.position.y = 5.2 + idleBob * 1.5;

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
    if (this.cleanupCameraControls) {
      this.cleanupCameraControls();
    }
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
