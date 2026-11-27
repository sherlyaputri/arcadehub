// 🎾 ArcadeHub Tennis 3D - Third-Person Behind-the-Player View (Roblox Style)
// Full Interactive Controls: Move (WASD), Jump (Space), Serve & Power Smash (Mouse / J / Touch)

class TennisGame {
  constructor(container, socket, roomInfo, selfId) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.selfId = selfId;
    this.active = true;
    this.animId = null;
    this.clock = new THREE.Clock();

    // Determine roles
    const playerList = Object.values(roomInfo.players);
    this.p1 = playerList.find(p => p.isHost) || playerList[0]; // Near side (+Z)
    this.p2 = playerList.find(p => !p.isHost) || playerList[1] || null; // Far side (-Z)
    this.isP1 = this.selfId === this.p1?.id;
    this.isP2 = this.p2 && this.selfId === this.p2.id;
    this.isSolo = !this.p2;

    // Court dimensions along Z (length) and X (width)
    this.COURT_HALF_L = 13.5; // Baseline at Z = +13.5 and -13.5
    this.COURT_HALF_W = 6.5;  // Singles width: X = -6.5 to +6.5
    this.NET_Z = 0;
    this.NET_H = 1.35;
    this.BALL_R = 0.22;

    // Game state - P1 (host) is authoritative
    this.gs = {
      ball: { x: 0, y: 1.5, z: 0, vx: 0, vy: 0, vz: 0, isSmash: false },
      near: { x: 0, y: 0, z: this.COURT_HALF_L, vy: 0, isJumping: false, score: 0 }, // Near player (+Z)
      far: { x: 0, y: 0, z: -this.COURT_HALF_L, vy: 0, isJumping: false, score: 0 },  // Far player (-Z)
      status: 'countdown', // countdown | waiting_serve | playing | point | finished
      server: 'near',      // 'near' | 'far'
      maxScore: 7,
      winner: null,
      rally: 0
    };

    this.cdCount = 3;
    this.cdInterval = null;
    this.keys = {};
    this.shakeTimer = 0;

    this.initThree();
    this.buildCourt();
    this.buildCharacters();
    this.buildBall();
    this.buildHUD();
    this.bindKeys();
    this.bindSocket();
    this.startCountdown();
    this.loop();
  }

  // ==================== THREE.JS SETUP ====================
  initThree() {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.width = this.container.clientWidth || 1200;
    this.height = this.container.clientHeight || 700;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x6ec5f8); // Bright tropical blue sky
    this.scene.fog = new THREE.FogExp2(0xb6e3ff, 0.012);

    // Camera: Third-person behind player looking towards the net
    const aspect = this.width / this.height;
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.1, 400);

    // If local player is P2, put camera behind far side looking at +Z
    if (this.isP2) {
      this.baseCamPos = new THREE.Vector3(0, 5.6, -22.5);
      this.camTarget = new THREE.Vector3(0, 1.8, 4.0);
    } else {
      this.baseCamPos = new THREE.Vector3(0, 5.6, 22.5);
      this.camTarget = new THREE.Vector3(0, 1.8, -4.0);
    }
    this.camera.position.copy(this.baseCamPos);
    this.camera.lookAt(this.camTarget);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xfff5e6, 0.75);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff8e7, 1.35);
    sun.position.set(15, 30, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 35;
    sun.shadow.camera.bottom = -35;
    this.scene.add(sun);

    const hemi = new THREE.HemisphereLight(0x70c5ff, 0xe2ba78, 0.4);
    this.scene.add(hemi);

    // Resize listener
    this._onResize = () => {
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    };
    window.addEventListener('resize', this._onResize);
  }

  // ==================== COURT & ENVIRONMENT ====================
  buildCourt() {
    // 1. Sandy beach ground
    const sandGeo = new THREE.PlaneGeometry(160, 180);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xedd6a4, roughness: 0.95 });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = -0.05;
    sand.receiveShadow = true;
    this.scene.add(sand);

    // Ocean water on sides
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.2, metalness: 0.1 });
    [-55, 55].forEach(x => {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(50, 180), waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(x, -0.04, 0);
      this.scene.add(water);
    });

    // 2. Outer apron (run-off area)
    const apronGeo = new THREE.BoxGeometry(22, 0.08, 38);
    const apronMat = new THREE.MeshStandardMaterial({ color: 0xdeaa6b, roughness: 0.9 });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.position.set(0, 0.04, 0);
    apron.receiveShadow = true;
    this.scene.add(apron);

    // 3. Main Clay Court (Roland Garros terracotta orange-red)
    const courtGeo = new THREE.BoxGeometry(15, 0.10, 31);
    const courtMat = new THREE.MeshStandardMaterial({ color: 0xcb5f30, roughness: 0.82 });
    const court = new THREE.Mesh(courtGeo, courtMat);
    court.position.set(0, 0.05, 0);
    court.receiveShadow = true;
    this.scene.add(court);

    // 4. White Court Lines
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const addLine = (w, d, x, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), lineMat);
      mesh.position.set(x, 0.11, z);
      this.scene.add(mesh);
    };

    const hw = this.COURT_HALF_W;
    const hl = this.COURT_HALF_L;
    const lw = 0.14; // line thickness

    // Outer sidelines
    addLine(lw, hl * 2, -hw, 0);
    addLine(lw, hl * 2, hw, 0);
    // Baselines
    addLine(hw * 2 + lw, lw, 0, -hl);
    addLine(hw * 2 + lw, lw, 0, hl);
    // Service lines (at Z = ±6.5)
    addLine(hw * 2, lw, 0, -6.5);
    addLine(hw * 2, lw, 0, 6.5);
    // Center service line
    addLine(lw, 13.0, 0, 0);
    // Center marks at baselines
    addLine(lw, 0.6, 0, -hl + 0.3);
    addLine(lw, 0.6, 0, hl - 0.3);

    // 5. Net (at Z = 0)
    const netGroup = new THREE.Group();
    // Posts
    const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
    [-hw - 0.8, hw + 0.8].forEach(x => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 8), postMat);
      post.position.set(x, 0.8, 0);
      post.castShadow = true;
      netGroup.add(post);
    });

    // Net mesh (semi-transparent grid)
    const netMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.72, side: THREE.DoubleSide
    });
    const netMesh = new THREE.Mesh(new THREE.PlaneGeometry((hw + 0.8) * 2, this.NET_H), netMat);
    netMesh.position.set(0, this.NET_H / 2 + 0.08, 0);
    netGroup.add(netMesh);

    // Top white tape
    const tapeMesh = new THREE.Mesh(new THREE.BoxGeometry((hw + 0.8) * 2, 0.09, 0.08), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    tapeMesh.position.set(0, this.NET_H + 0.08, 0);
    netGroup.add(tapeMesh);

    // Center vertical strap
    const strapMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, this.NET_H, 0.09), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    strapMesh.position.set(0, this.NET_H / 2 + 0.08, 0);
    netGroup.add(strapMesh);

    this.scene.add(netGroup);

    // 6. Court Side Barriers with Cyan Neon Strip
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xe0742a });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    [-11.5, 11.5].forEach(x => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 40), barrierMat);
      b.position.set(x, 0.55, 0);
      b.castShadow = true;
      this.scene.add(b);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 40), neonMat);
      strip.position.set(x, 1.05, 0);
      this.scene.add(strip);
    });

    // 7. Background Stadium & Giant Scoreboard Screen (Z = -25)
    this.buildStadium();

    // 8. Palm Trees along both sides
    this.buildPalmTrees();

    // 9. Beach Umbrellas & Beach Ball
    this.buildBeachProps();
  }

  buildStadium() {
    const bgGroup = new THREE.Group();
    bgGroup.position.set(0, 0, -25);

    // Bleachers / stairs
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    for (let i = 0; i < 7; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 1.2), stepMat);
      step.position.set(0, 0.3 + i * 0.6, -i * 1.1);
      step.receiveShadow = true;
      bgGroup.add(step);

      // Colorful audience dots on steps
      for (let c = 0; c < 14; c++) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 6, 5),
          new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((c * 0.17 + i * 0.23) % 1, 0.8, 0.55) })
        );
        dot.position.set(-11 + c * 1.7 + (Math.random() - 0.5) * 0.4, 0.75 + i * 0.6, -i * 1.1);
        bgGroup.add(dot);
      }
    }

    // Giant LED Scoreboard Screen Frame
    const frameMesh = new THREE.Mesh(
      new THREE.BoxGeometry(16, 8.5, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6 })
    );
    frameMesh.position.set(0, 8.8, -8);
    bgGroup.add(frameMesh);

    // Screen display (Canvas texture)
    this.boardCanvas = document.createElement('canvas');
    this.boardCanvas.width = 1024;
    this.boardCanvas.height = 512;
    this.boardTex = new THREE.CanvasTexture(this.boardCanvas);
    this._renderScoreboardCanvas();

    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(15.2, 7.8),
      new THREE.MeshBasicMaterial({ map: this.boardTex })
    );
    screenMesh.position.set(0, 8.8, -7.58);
    bgGroup.add(screenMesh);

    // Stadium speaker towers on sides of scoreboard
    const spkMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
    [-9.2, 9.2].forEach(x => {
      const spk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7.5, 1.2), spkMat);
      spk.position.set(x, 8.8, -8);
      bgGroup.add(spk);

      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 12, 1.8), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
      pillar.position.set(x, 6, -8);
      bgGroup.add(pillar);
    });

    this.scene.add(bgGroup);
  }

  _renderScoreboardCanvas() {
    const ctx = this.boardCanvas.getContext('2d');
    const w = this.boardCanvas.width;
    const h = this.boardCanvas.height;

    // Dark sleek background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(1, '#05080f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Border glow
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Glowing Header
    ctx.fillStyle = '#22d3ee';
    ctx.font = '900 52px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ ARCADEHUB TENNIS 🎾', w / 2, 85);

    // Big Score Display
    const p1Name = (this.p1?.name || 'P1').slice(0, 12).toUpperCase();
    const p2Name = (this.p2?.name || (this.isSolo ? 'BOT' : 'P2')).slice(0, 12).toUpperCase();
    const p1Color = this.p1?.color || '#3b82f6';
    const p2Color = this.p2?.color || '#ef4444';

    // Player 1 box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(80, 120, 380, 240);
    ctx.fillStyle = p1Color;
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText(p1Name, 270, 175);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 130px system-ui, sans-serif';
    ctx.fillText(this.gs.near.score, 270, 315);

    // VS center
    ctx.fillStyle = '#94a3b8';
    ctx.font = '900 48px system-ui, sans-serif';
    ctx.fillText('VS', w / 2, 255);

    // Player 2 box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(w - 460, 120, 380, 240);
    ctx.fillStyle = p2Color;
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText(p2Name, w - 270, 175);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 130px system-ui, sans-serif';
    ctx.fillText(this.gs.far.score, w - 270, 315);

    // Rally ticker at bottom
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 32px system-ui, sans-serif';
    const rallyText = this.gs.rally >= 3 ? `🔥 RALLY: ${this.gs.rally} HITS!` : 'FIRST TO 7 WINS!';
    ctx.fillText(rallyText, w / 2, 440);

    if (this.boardTex) this.boardTex.needsUpdate = true;
  }

  buildPalmTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7, side: THREE.DoubleSide });

    const createTree = (x, z, scale = 1) => {
      const tg = new THREE.Group();
      tg.position.set(x, 0, z);
      tg.scale.set(scale, scale, scale);

      for (let s = 0; s < 7; s++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.38 - s * 0.02, 0.42 - s * 0.02, 1.2, 7), trunkMat);
        seg.position.set(Math.sin(s * 0.25) * 0.4, 0.6 + s * 1.15, 0);
        seg.rotation.z = -0.08 * s;
        seg.castShadow = true;
        tg.add(seg);
      }

      const topY = 8.4;
      const topX = Math.sin(6 * 0.25) * 0.4;
      for (let l = 0; l < 8; l++) {
        const ang = (l / 8) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.2, 5), leafMat);
        leaf.position.set(topX + Math.cos(ang) * 1.8, topY - 0.4, Math.sin(ang) * 1.8);
        leaf.rotation.x = Math.sin(ang) * 0.8 + Math.PI / 2;
        leaf.rotation.z = Math.cos(ang) * 0.8;
        leaf.castShadow = true;
        tg.add(leaf);
      }
      this.scene.add(tg);
    };

    [-18, -22, -26].forEach((x, i) => createTree(x, -12 + i * 14, 1.1 + (i % 2) * 0.15));
    [18, 22, 26].forEach((x, i) => createTree(x, -10 + i * 14, 1.15 + (i % 2) * 0.1));
  }

  buildBeachProps() {
    const umbrellaMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db });

    const createUmbrella = (x, z) => {
      const ug = new THREE.Group();
      ug.position.set(x, 0, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), poleMat);
      pole.position.y = 1.6;
      ug.add(pole);

      const top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.8, 8), umbrellaMat);
      top.position.y = 3.2;
      top.rotation.x = 0.15;
      ug.add(top);
      this.scene.add(ug);
    };

    createUmbrella(-15, 6);
    createUmbrella(15, -4);
    createUmbrella(-15, -8);

    const ballMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 });
    const bb = new THREE.Mesh(new THREE.SphereGeometry(2.0, 14, 10), ballMat);
    bb.position.set(16, 3.5, -20);
    this.scene.add(bb);
  }

  // ==================== CHARACTERS (ROBLOX STYLE) ====================
  buildCharacters() {
    // Near Player: stands at Z = +COURT_HALF_L (faces -Z, back to camera)
    this.charNear = this.createRobloxCharacter(0, this.p1?.name || 'P1', this.p1?.color || '#3b82f6');
    this.charNear.root.position.set(0, 0, this.COURT_HALF_L);
    this.charNear.root.rotation.y = Math.PI;
    this.scene.add(this.charNear.root);

    // Far Player (Opponent or Bot): stands at Z = -COURT_HALF_L (faces +Z, towards net)
    this.charFar = this.createRobloxCharacter(1, this.p2?.name || (this.isSolo ? 'BOT' : 'P2'), this.p2?.color || '#ef4444');
    this.charFar.root.position.set(0, 0, -this.COURT_HALF_L);
    this.charFar.root.rotation.y = 0;
    this.scene.add(this.charFar.root);

    // Player Ground Shadows
    const shadowGeo = new THREE.CircleGeometry(0.7, 14);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 });

    this.nearShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.nearShadow.rotation.x = -Math.PI / 2;
    this.nearShadow.position.set(0, 0.11, this.COURT_HALF_L);
    this.scene.add(this.nearShadow);

    this.farShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.farShadow.rotation.x = -Math.PI / 2;
    this.farShadow.position.set(0, 0.11, -this.COURT_HALF_L);
    this.scene.add(this.farShadow);

    // Rackets attached to right arms
    this.racketNear = this.buildRacket(this.p1?.color || 0x3b82f6);
    this.racketNear.position.set(0.65, -0.1, 0.45);
    this.charNear.rightArm.add(this.racketNear);

    this.racketFar = this.buildRacket(this.p2?.color || 0xef4444);
    this.racketFar.position.set(0.65, -0.1, 0.45);
    this.charFar.rightArm.add(this.racketFar);

    // Name tags floating above
    this.nearTag = this.createNameTag(this.p1?.name || 'P1', this.p1?.color || '#3b82f6');
    this.nearTag.position.set(0, 5.0, this.COURT_HALF_L);
    this.scene.add(this.nearTag);

    this.farTag = this.createNameTag(this.p2?.name || (this.isSolo ? 'BOT' : 'P2'), this.p2?.color || '#ef4444');
    this.farTag.position.set(0, 5.0, -this.COURT_HALF_L);
    this.scene.add(this.farTag);
  }

  createRobloxCharacter(idx, name, customColor) {
    const root = new THREE.Group();

    const outfitColor = customColor ? new THREE.Color(customColor) : (idx === 0 ? 0x3b82f6 : 0xef4444);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 });
    const outfitMat = new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.85 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });

    // Legs
    const legGeo = new THREE.BoxGeometry(0.48, 1.35, 0.48);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.32, 0.68, 0);
    leftLeg.castShadow = true;
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.32, 0.68, 0);
    rightLeg.castShadow = true;
    root.add(rightLeg);

    // Torso
    const torsoGeo = new THREE.BoxGeometry(1.25, 1.45, 0.62);
    const torso = new THREE.Mesh(torsoGeo, outfitMat);
    torso.position.set(0, 2.05, 0);
    torso.castShadow = true;
    root.add(torso);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.45, 1.35, 0.45);
    const leftArm = new THREE.Mesh(armGeo, outfitMat);
    leftArm.position.set(-0.88, 2.05, 0);
    leftArm.castShadow = true;
    root.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, outfitMat);
    rightArm.position.set(0.88, 2.05, 0);
    rightArm.castShadow = true;
    root.add(rightArm);

    // Head with Roblox Glasses Face Texture
    const headCanvas = document.createElement('canvas');
    headCanvas.width = 256; headCanvas.height = 256;
    const ctx = headCanvas.getContext('2d');
    ctx.fillStyle = '#d4a373';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#111827';
    ctx.fillRect(35, 95, 75, 45);
    ctx.fillRect(146, 95, 75, 45);
    ctx.fillRect(110, 110, 36, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(50, 105, 20, 20);
    ctx.fillRect(160, 105, 20, 20);
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(100, 180, 56, 10);

    const faceTex = new THREE.CanvasTexture(headCanvas);
    const headGeo = new THREE.BoxGeometry(1.15, 1.15, 1.15);
    const headMats = [
      skinMat, skinMat, skinMat, skinMat,
      new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.7 }),
      skinMat
    ];
    const head = new THREE.Mesh(headGeo, headMats);
    head.position.set(0, 3.25, 0);
    head.castShadow = true;
    root.add(head);

    // Spiky Hair
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.52, 1.22), hairMat);
    hairTop.position.set(0, 3.84, 0);
    root.add(hairTop);

    const bangs = [
      { x: -0.42, y: 3.65, z: 0.54, w: 0.22, h: 0.48 },
      { x: 0.0,   y: 3.62, z: 0.58, w: 0.25, h: 0.52 },
      { x: 0.42,  y: 3.66, z: 0.54, w: 0.22, h: 0.48 },
      { x: -0.58, y: 3.45, z: 0.1,  w: 0.20, h: 0.75 },
      { x: 0.58,  y: 3.45, z: 0.1,  w: 0.20, h: 0.75 },
      { x: 0.0,   y: 3.50, z: -0.56, w: 1.1,  h: 0.70 },
    ];
    bangs.forEach(b => {
      const bm = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, 0.32), hairMat);
      bm.position.set(b.x, b.y, b.z);
      root.add(bm);
    });

    return { root, head, torso, leftArm, rightArm, leftLeg, rightLeg, animTime: 0, swingTime: 0 };
  }

  buildRacket(color) {
    const rg = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, 0.9, 6),
      new THREE.MeshStandardMaterial({ color: 0x78350f })
    );
    handle.position.set(0, -0.45, 0);
    rg.add(handle);

    const frameMat = new THREE.MeshStandardMaterial({ color: color || 0x3b82f6 });
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 16), frameMat);
    frame.position.set(0, 0.45, 0);
    rg.add(frame);

    const strMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    for (let i = -3; i <= 3; i++) {
      const vStr = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.0, 0.02), strMat);
      vStr.position.set(i * 0.14, 0.45, 0);
      rg.add(vStr);

      const hStr = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.02), strMat);
      hStr.position.set(0, 0.45 + i * 0.14, 0);
      rg.add(hStr);
    }

    rg.rotation.x = Math.PI / 4;
    return rg;
  }

  createNameTag(name, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(10,22,40,0.85)';
    this._roundRect(ctx, 8, 8, 496, 112, 20);
    ctx.fill();
    ctx.strokeStyle = color || '#fff';
    ctx.lineWidth = 4;
    this._roundRect(ctx, 8, 8, 496, 112, 20);
    ctx.stroke();
    ctx.fillStyle = color || '#fff';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.length > 12 ? name.slice(0, 11) + '…' : name, 256, 64);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(4, 1, 1);
    return sprite;
  }

  _roundRect(ctx, x, y, w, h, r) {
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

  // ==================== BALL ====================
  buildBall() {
    const geo = new THREE.SphereGeometry(this.BALL_R, 16, 12);
    this.ballMatRegular = new THREE.MeshStandardMaterial({ color: 0xd4f04a, roughness: 0.45, metalness: 0.05 });
    this.ballMatSmash = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff5500, emissiveIntensity: 0.6, roughness: 0.2 });
    this.ball3d = new THREE.Mesh(geo, this.ballMatRegular);
    this.ball3d.castShadow = true;
    this.scene.add(this.ball3d);

    // Ball shadow blob on clay court
    const blobGeo = new THREE.CircleGeometry(0.28, 12);
    const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
    this.ballShadow = new THREE.Mesh(blobGeo, blobMat);
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.11;
    this.scene.add(this.ballShadow);
  }

  // ==================== HUD & CONTROLS ====================
  buildHUD() {
    this.hud = document.createElement('div');
    this.hud.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0;
      pointer-events: none; z-index: 10;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;
    this.hud.innerHTML = `
      <div id="tennis3d-scorebar" style="
        display: flex; align-items: center; justify-content: center;
        gap: 16px; padding: 6px 20px; margin: 8px auto;
        background: rgba(10,22,40,0.85); border: 1px solid rgba(255,255,255,0.18);
        border-radius: 32px; width: fit-content; backdrop-filter: blur(6px);
      ">
        <span id="t3d-nearname" style="font-weight:800;color:${this.p1?.color||'#3b82f6'};font-size:14px;">${(this.p1?.name||'P1').slice(0,12)}</span>
        <span id="t3d-nearscore" style="font-size:26px;font-weight:900;color:#fff;min-width:28px;text-align:center;">0</span>
        <span style="color:rgba(255,255,255,0.4);font-size:12px;">VS</span>
        <span id="t3d-farscore" style="font-size:26px;font-weight:900;color:#fff;min-width:28px;text-align:center;">0</span>
        <span id="t3d-farname" style="font-weight:800;color:${this.p2?.color||'#ef4444'};font-size:14px;">${(this.p2?.name||(this.isSolo?'BOT':'P2')).slice(0,12)}</span>
      </div>
      <div id="t3d-serve-prompt" style="text-align:center;font-size:15px;font-weight:900;color:#38bdf8;text-shadow:0 0 10px rgba(56,189,248,0.7);display:none;">
        ⚡ TEKAN SMASH / SPACE UNTUK SERVIS!
      </div>
      <div id="t3d-rally" style="text-align:center;font-size:13px;font-weight:800;color:#fbbf24;min-height:18px;"></div>
    `;
    this.container.appendChild(this.hud);

    // Mobile controls: Directional Cluster (Left) + Action Buttons (Right)
    this.mobileCtrl = document.createElement('div');
    this.mobileCtrl.style.cssText = `
      position: absolute; bottom: 12px; left: 0; right: 0;
      display: ${(window.innerWidth <= 768 || 'ontouchstart' in window) ? 'flex' : 'none'};
      justify-content: space-between; align-items: flex-end; padding: 0 16px;
      z-index: 10; pointer-events: none;
    `;
    this.mobileCtrl.innerHTML = `
      <!-- LEFT: D-PAD (Maju, Mundur, Kiri, Kanan) -->
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;user-select:none;touch-action:none;gap:4px;">
        <button id="t3d-up" style="width:56px;height:52px;font-size:24px;border-radius:14px;background:rgba(15,23,42,0.85);border:2px solid #38bdf8;color:#fff;cursor:pointer;">▲</button>
        <div style="display:flex;gap:10px;">
          <button id="t3d-left" style="width:56px;height:52px;font-size:24px;border-radius:14px;background:rgba(15,23,42,0.85);border:2px solid #38bdf8;color:#fff;cursor:pointer;">◀</button>
          <button id="t3d-down" style="width:56px;height:52px;font-size:24px;border-radius:14px;background:rgba(15,23,42,0.85);border:2px solid #38bdf8;color:#fff;cursor:pointer;">▼</button>
          <button id="t3d-right" style="width:56px;height:52px;font-size:24px;border-radius:14px;background:rgba(15,23,42,0.85);border:2px solid #38bdf8;color:#fff;cursor:pointer;">▶</button>
        </div>
      </div>

      <!-- RIGHT: ACTION BUTTONS (Lompat & Power Smash) -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;pointer-events:auto;user-select:none;touch-action:none;">
        <button id="t3d-jump-btn" style="width:64px;height:64px;font-size:28px;border-radius:50%;background:linear-gradient(135deg,#0284c7,#0369a1);border:2px solid #38bdf8;color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(2,132,199,0.5);">🦘</button>
        <button id="t3d-smash-btn" style="width:76px;height:76px;font-size:32px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);border:3px solid #facc15;color:#fff;cursor:pointer;box-shadow:0 4px 20px rgba(239,68,68,0.7);font-weight:900;">⚡</button>
      </div>
    `;
    this.container.appendChild(this.mobileCtrl);
    this._bindMobileCtrl();

    // Desktop Controls Guide Badge
    const role = document.createElement('div');
    role.style.cssText = `position:absolute;bottom:${window.innerWidth<=768?140:10}px;left:50%;transform:translateX(-50%);font-size:12px;font-weight:600;color:rgba(255,255,255,0.8);background:rgba(15,23,42,0.75);padding:6px 16px;border-radius:20px;border:1px solid rgba(255,255,255,0.15);white-space:nowrap;pointer-events:none;z-index:10;`;
    role.innerHTML = window.innerWidth <= 768
      ? 'D-Pad: Gerak | 🦘: Lompat | ⚡: Smash / Servis'
      : '🕹️ <b>WASD / Panah</b>: Gerak | <b>Space</b>: Lompat | <b>Klik Mouse / J</b>: Servis & Smash';
    this.container.appendChild(role);

    // Countdown overlay
    this.cdOverlay = document.createElement('div');
    this.cdOverlay.style.cssText = `
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(10,22,40,0.6); backdrop-filter: blur(4px);
      z-index: 20; pointer-events: none;
    `;
    this.cdOverlay.innerHTML = `<div id="t3d-cd" style="font-size:110px;font-weight:900;color:#fbbf24;text-shadow:0 0 40px rgba(251,191,36,0.7);">3</div>`;
    this.container.appendChild(this.cdOverlay);
  }

  _bindMobileCtrl() {
    const bindBtn = (id, keyName, isAction) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (isAction) {
        el.addEventListener('touchstart', ev => { ev.preventDefault(); this._triggerAction(keyName); }, { passive: false });
        el.addEventListener('mousedown', () => this._triggerAction(keyName));
      } else {
        const s = () => { this.keys[keyName] = true; };
        const e = () => { this.keys[keyName] = false; };
        el.addEventListener('touchstart', ev => { ev.preventDefault(); s(); }, { passive: false });
        el.addEventListener('touchend', ev => { ev.preventDefault(); e(); }, { passive: false });
        el.addEventListener('mousedown', s);
        el.addEventListener('mouseup', e);
        el.addEventListener('mouseleave', e);
      }
    };

    bindBtn('t3d-up', 'up', false);
    bindBtn('t3d-down', 'down', false);
    bindBtn('t3d-left', 'left', false);
    bindBtn('t3d-right', 'right', false);
    bindBtn('t3d-jump-btn', 'jump', true);
    bindBtn('t3d-smash-btn', 'smash', true);
  }

  // ==================== KEYBOARD & MOUSE ====================
  bindKeys() {
    this._onKeyDown = e => {
      // Movement
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) { this.keys['left'] = true; e.preventDefault(); }
      if (['ArrowRight', 'd', 'D'].includes(e.key)) { this.keys['right'] = true; e.preventDefault(); }
      if (['ArrowUp', 'w', 'W'].includes(e.key)) { this.keys['up'] = true; e.preventDefault(); }
      if (['ArrowDown', 's', 'S'].includes(e.key)) { this.keys['down'] = true; e.preventDefault(); }

      // Jump
      if (e.code === 'Space') {
        this._triggerAction('jump');
        e.preventDefault();
      }
      // Smash / Hit / Serve
      if (['KeyJ', 'KeyF', 'Enter'].includes(e.code) || ['j', 'f', 'J', 'F'].includes(e.key)) {
        this._triggerAction('smash');
        e.preventDefault();
      }
    };

    this._onKeyUp = e => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) this.keys['left'] = false;
      if (['ArrowRight', 'd', 'D'].includes(e.key)) this.keys['right'] = false;
      if (['ArrowUp', 'w', 'W'].includes(e.key)) this.keys['up'] = false;
      if (['ArrowDown', 's', 'S'].includes(e.key)) this.keys['down'] = false;
    };

    // Mouse click on canvas to Smash / Serve
    this._onMouseDown = e => {
      if (e.target.tagName !== 'BUTTON') {
        this._triggerAction('smash');
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.container.addEventListener('mousedown', this._onMouseDown);
  }

  // ==================== INTERACTIVE ACTIONS ====================
  _triggerAction(action) {
    if (!this.active) return;
    const player = (this.isP1 || this.isSolo) ? this.gs.near : this.gs.far;
    const char = (this.isP1 || this.isSolo) ? this.charNear : this.charFar;

    if (action === 'jump') {
      if (!player.isJumping) {
        player.isJumping = true;
        player.vy = 8.5; // Jump upward velocity
        this._playBeep(480);
      }
    } else if (action === 'smash') {
      // If waiting for serve
      if (this.gs.status === 'waiting_serve') {
        const canServe = (this.gs.server === 'near' && (this.isP1 || this.isSolo)) ||
                         (this.gs.server === 'far' && this.isP2);
        if (canServe) {
          this._executeServe();
          return;
        }
      }

      // Swing racket animation
      char.swingTime = 0.45;

      // Check for Smash / Hit contact
      this._attemptHit(true);
    }
  }

  _executeServe() {
    const isNearServer = this.gs.server === 'near';
    const serverPlayer = isNearServer ? this.gs.near : this.gs.far;
    const b = this.gs.ball;

    b.x = serverPlayer.x * 0.7;
    b.z = isNearServer ? serverPlayer.z - 1.2 : serverPlayer.z + 1.2;
    b.y = 2.4;
    const speed = 11.0;
    b.vz = isNearServer ? -speed : speed;
    b.vx = (Math.random() - 0.5) * 4.5;
    b.vy = 4.2;
    b.isSmash = false;

    this.gs.rally = 0;
    this.gs.status = 'playing';

    const prompt = document.getElementById('t3d-serve-prompt');
    if (prompt) prompt.style.display = 'none';

    this._playBeep(520);
    this.socket.emit('tennis:state', this.gs);
  }

  _attemptHit(isDeliberateSmash) {
    if (this.gs.status !== 'playing') return;
    const b = this.gs.ball;
    const isNear = (this.isP1 || this.isSolo);
    const player = isNear ? this.gs.near : this.gs.far;
    const char = isNear ? this.charNear : this.charFar;

    const distX = Math.abs(b.x - player.x);
    const distZ = Math.abs(b.z - player.z);
    const isHeadingTowardsMe = isNear ? (b.vz > 0) : (b.vz < 0);

    // Hit Range
    if (isHeadingTowardsMe && distX < 2.5 && distZ < 2.8) {
      char.swingTime = 0.45;
      const hitOffset = (b.x - player.x) / 2.5;

      // Check if it's a POWER SMASH (Player is jumping or ball is high)
      const isAerial = player.isJumping || player.y > 0.5 || b.y > 2.2;

      if (isDeliberateSmash && isAerial) {
        // 💥 POWER SMASH!
        b.isSmash = true;
        const smashSpeed = Math.min(16.5 + this.gs.rally * 0.35, 25.0);
        b.vz = isNear ? -smashSpeed : smashSpeed;
        b.vx = hitOffset * 7.5 + (Math.random() - 0.5) * 0.6;
        b.vy = -2.8; // Drives downward into opponent court!
        this.gs.rally += 2;
        this.shakeTimer = 0.18; // Camera micro-shake
        this._showSmashFlash();
        this._playSmashSound();
      } else {
        // Standard solid hit
        b.isSmash = false;
        const speed = Math.min(10.8 + this.gs.rally * 0.25, 20.0);
        b.vz = isNear ? -speed : speed;
        b.vx = hitOffset * 6.5 + (Math.random() - 0.5) * 0.5;
        b.vy = 4.8 + Math.random() * 0.5;
        this.gs.rally++;
        this._playBeep(440);
      }

      this.updateScoreHUD();
      this.socket.emit('tennis:state', this.gs);
    }
  }

  _showSmashFlash() {
    const ex = document.getElementById('t3d-smash-banner');
    if (ex) ex.remove();
    const el = document.createElement('div');
    el.id = 't3d-smash-banner';
    el.style.cssText = `
      position: absolute; top: 38%; left: 50%;
      transform: translate(-50%, -50%) scale(1);
      font-size: 38px; font-weight: 900; font-style: italic;
      color: #facc15; text-shadow: 0 0 25px #ef4444, 0 0 45px #f59e0b;
      background: rgba(15, 23, 42, 0.9); border: 3px solid #ef4444;
      border-radius: 28px; padding: 8px 36px; z-index: 25;
      pointer-events: none; animation: t3dSmashPop 0.4s ease-out;
    `;
    el.textContent = '💥 POWER SMASH!!';
    this.container.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  _playSmashSound() {
    if (!window.soundManager) return;
    try {
      window.soundManager.playBeep(750, 0.12, 'sawtooth');
      setTimeout(() => window.soundManager.playBeep(220, 0.25, 'triangle'), 60);
    } catch (e) {}
  }

  // ==================== COUNTDOWN & SERVE ====================
  startCountdown() {
    this.cdCount = 3;
    const el = document.getElementById('t3d-cd');
    if (el) el.textContent = '3';
    if (this.cdInterval) clearInterval(this.cdInterval);
    this.cdInterval = setInterval(() => {
      this.cdCount--;
      const e = document.getElementById('t3d-cd');
      if (this.cdCount > 0) {
        if (e) e.textContent = this.cdCount;
        this._playBeep(500 + this.cdCount * 50);
      } else {
        clearInterval(this.cdInterval);
        if (this.cdOverlay) this.cdOverlay.style.display = 'none';
        this._playBeep(900);
        this._readyServe('near');
      }
    }, 1000);
  }

  _readyServe(serverSide) {
    this.gs.status = 'waiting_serve';
    this.gs.server = serverSide;
    const prompt = document.getElementById('t3d-serve-prompt');
    if (prompt) {
      prompt.style.display = 'block';
      const isMyTurn = (serverSide === 'near' && (this.isP1 || this.isSolo)) ||
                       (serverSide === 'far' && this.isP2);
      prompt.textContent = isMyTurn
        ? '⚡ TEKAN SMASH / SPACE UNTUK SERVIS!'
        : '⏳ MENUNGGU LAWAN SERVIS...';
    }

    // Auto-serve fallback if player is idle after 4 seconds
    if (this.isP1 || this.isSolo) {
      setTimeout(() => {
        if (this.active && this.gs.status === 'waiting_serve') {
          this._executeServe();
        }
      }, 4000);
    }
  }

  updateScoreHUD() {
    const s1 = document.getElementById('t3d-nearscore');
    const s2 = document.getElementById('t3d-farscore');
    if (s1) s1.textContent = this.gs.near.score;
    if (s2) s2.textContent = this.gs.far.score;
    const rally = document.getElementById('t3d-rally');
    if (rally) rally.textContent = this.gs.rally >= 3 ? `🔥 Ralian x${this.gs.rally}` : '';
    this._renderScoreboardCanvas();
  }

  // ==================== SOCKET ====================
  bindSocket() {
    this._onStateUpdate = data => {
      if (!this.active) return;
      this.gs = data;
      this.updateScoreHUD();
    };
    this._onPaddleUpdate = data => {
      if (!this.active) return;
      if (this.isP1 && data.role === 'far') {
        this.gs.far.x = data.x;
        this.gs.far.z = data.z;
        this.gs.far.y = data.y || 0;
      } else if (this.isP2 && data.role === 'near') {
        this.gs.near.x = data.x;
        this.gs.near.z = data.z;
        this.gs.near.y = data.y || 0;
      }
    };
    this._onPoint = data => {
      if (!this.active) return;
      this.gs.near.score = data.nearScore;
      this.gs.far.score = data.farScore;
      this.updateScoreHUD();
      this._showPointFlash(data.scorer);
    };
    this._onGameOver = data => {
      if (!this.active) return;
      this.gs.status = 'finished';
      this._showWinner(data);
    };
    this._onRestart = () => {
      if (!this.active) return;
      this.gs.near.score = 0;
      this.gs.far.score = 0;
      this.gs.rally = 0;
      this.gs.winner = null;
      const wo = document.getElementById('t3d-winner');
      if (wo) wo.remove();
      this.updateScoreHUD();
      if (this.cdOverlay) this.cdOverlay.style.display = 'flex';
      this.startCountdown();
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
    const delta = Math.min(this.clock.getDelta(), 0.08);
    this.update(delta);
    this.animateCharacters(delta);
    this.renderer.render(this.scene, this.camera);
  }

  update(delta) {
    const gs = this.gs;
    const MOVE_X = 9.5; // X axis speed
    const MOVE_Z = 8.5; // Z axis speed
    const MAX_X = this.COURT_HALF_W - 0.4;

    // Movement: Near Player (+Z court)
    if (this.isP1 || this.isSolo) {
      const p = gs.near;
      if (this.keys['left']) p.x = Math.max(-MAX_X, p.x - MOVE_X * delta);
      if (this.keys['right']) p.x = Math.min(MAX_X, p.x + MOVE_X * delta);
      if (this.keys['up']) p.z = Math.max(2.8, p.z - MOVE_Z * delta); // Forward towards net
      if (this.keys['down']) p.z = Math.min(this.COURT_HALF_L + 2.5, p.z + MOVE_Z * delta); // Back towards baseline

      // Jump Physics
      if (p.isJumping) {
        p.vy -= 22 * delta;
        p.y += p.vy * delta;
        if (p.y <= 0) { p.y = 0; p.vy = 0; p.isJumping = false; }
      }

      this.socket.emit('tennis:paddle', { role: 'near', x: p.x, z: p.z, y: p.y });
    }

    // Movement: Far Player (P2 with flipped view)
    if (this.isP2) {
      const p = gs.far;
      // In P2 view facing +Z: left is +X, right is -X, up is +Z (towards net), down is -Z (baseline)
      if (this.keys['left']) p.x = Math.min(MAX_X, p.x + MOVE_X * delta);
      if (this.keys['right']) p.x = Math.max(-MAX_X, p.x - MOVE_X * delta);
      if (this.keys['up']) p.z = Math.min(-2.8, p.z + MOVE_Z * delta);
      if (this.keys['down']) p.z = Math.max(-this.COURT_HALF_L - 2.5, p.z - MOVE_Z * delta);

      if (p.isJumping) {
        p.vy -= 22 * delta;
        p.y += p.vy * delta;
        if (p.y <= 0) { p.y = 0; p.vy = 0; p.isJumping = false; }
      }

      this.socket.emit('tennis:paddle', { role: 'far', x: p.x, z: p.z, y: p.y });
    }

    // Bot AI (Controls far player in solo mode)
    if (this.isSolo) {
      const p = gs.far;
      const diffX = gs.ball.x - p.x;
      const botSpeed = Math.min(7.0 + gs.rally * 0.15, 11.0);
      if (Math.abs(diffX) > 0.15) {
        p.x += Math.sign(diffX) * Math.min(botSpeed * delta, Math.abs(diffX));
      }
      p.x = Math.max(-MAX_X, Math.min(MAX_X, p.x));

      // Bot positioning along Z (steps forward to volley or jumps to smash)
      if (gs.ball.vz < 0 && Math.abs(diffX) < 1.8 && gs.ball.z < -6.0) {
        if (!p.isJumping && gs.ball.y > 2.2 && Math.random() < 0.08) {
          p.isJumping = true;
          p.vy = 8.0;
        }
      }
      if (p.isJumping) {
        p.vy -= 22 * delta;
        p.y += p.vy * delta;
        if (p.y <= 0) { p.y = 0; p.vy = 0; p.isJumping = false; }
      }
    }

    // Camera follow & micro-shake
    let camX = (this.isP2 ? gs.far.x : gs.near.x) * 0.22;
    let shakeOffset = 0;
    if (this.shakeTimer > 0) {
      this.shakeTimer -= delta;
      shakeOffset = (Math.random() - 0.5) * 0.35;
    }
    this.camera.position.x = this.baseCamPos.x + camX + shakeOffset;
    this.camera.position.y = this.baseCamPos.y + (shakeOffset * 0.5);

    // --- Authoritative Ball Physics (P1 / Solo) ---
    if (!this.isP1 && !this.isSolo) {
      this._syncVisuals();
      return;
    }

    if (gs.status !== 'playing') {
      this._syncVisuals();
      return;
    }

    const b = gs.ball;
    b.x += b.vx * delta;
    b.z += b.vz * delta;
    b.vy -= 18 * delta; // Gravity
    b.y += b.vy * delta;

    // Bounce on clay court
    if (b.y <= this.BALL_R) {
      b.y = this.BALL_R;
      b.vy = Math.abs(b.vy) * 0.74;
      this._playBeep(360);
    }

    // Side barriers bounce
    if (b.x < -MAX_X - 1.2) { b.x = -MAX_X - 1.2; b.vx = Math.abs(b.vx) * 0.85; this._playBeep(520); }
    if (b.x > MAX_X + 1.2) { b.x = MAX_X + 1.2; b.vx = -Math.abs(b.vx) * 0.85; this._playBeep(520); }

    // Net collision (Z = 0)
    if (Math.abs(b.z) < 0.25 && b.y < this.NET_H) {
      b.vz = -b.vz * 0.5;
      b.vy = Math.abs(b.vy) * 0.3;
      this._playBeep(260);
    }

    // Proximity auto-hit fallback (so casual players can still rally smoothly)
    const distNear = Math.hypot(b.x - gs.near.x, b.z - gs.near.z);
    if (b.vz > 0 && distNear < 1.4 && b.y < 3.0) {
      this._attemptHit(false);
    }
    const distFar = Math.hypot(b.x - gs.far.x, b.z - gs.far.z);
    if (b.vz < 0 && distFar < 1.4 && b.y < 3.0) {
      if (this.isSolo) {
        // Bot hits
        const isBotSmash = gs.far.isJumping || gs.ball.y > 2.0;
        this.charFar.swingTime = 0.45;
        if (isBotSmash) {
          b.isSmash = true;
          const spd = Math.min(15.5 + gs.rally * 0.3, 24.0);
          b.vz = spd;
          b.vx = (b.x - gs.far.x) * 2.2;
          b.vy = -2.5;
          gs.rally += 2;
          this._showSmashFlash();
          this._playSmashSound();
        } else {
          b.isSmash = false;
          const spd = Math.min(10.5 + gs.rally * 0.25, 20.0);
          b.vz = spd;
          b.vx = (b.x - gs.far.x) * 2.0;
          b.vy = 4.8;
          gs.rally++;
          this._playBeep(440);
        }
        this.updateScoreHUD();
      } else {
        this._attemptHit(false);
      }
    }

    // --- Point Detection (Ball past baseline) ---
    if (b.z > this.COURT_HALF_L + 3.0) {
      // Far player scores
      gs.far.score++;
      this._playBeep(220);
      this.socket.emit('tennis:point', { scorer: 'far', nearScore: gs.near.score, farScore: gs.far.score });
      this._showPointFlash('far');
      this._checkWinner('near');
    } else if (b.z < -this.COURT_HALF_L - 3.0) {
      // Near player scores
      gs.near.score++;
      this._playBeep(220);
      this.socket.emit('tennis:point', { scorer: 'near', nearScore: gs.near.score, farScore: gs.far.score });
      this._showPointFlash('near');
      this._checkWinner('far');
    }

    // Broadcast state every 2 frames
    if (!this._tick) this._tick = 0;
    if (++this._tick % 2 === 0) {
      this.socket.emit('tennis:state', gs);
    }

    this._syncVisuals();
  }

  _syncVisuals() {
    const gs = this.gs;
    // Ball position and material
    if (this.ball3d) {
      this.ball3d.position.set(gs.ball.x, Math.max(this.BALL_R, gs.ball.y), gs.ball.z);
      this.ball3d.rotation.x += 0.25;
      this.ball3d.material = gs.ball.isSmash ? this.ballMatSmash : this.ballMatRegular;
    }
    if (this.ballShadow) {
      this.ballShadow.position.set(gs.ball.x, 0.11, gs.ball.z);
      const s = Math.max(0.15, 1 - gs.ball.y * 0.15);
      this.ballShadow.scale.set(s, s, s);
    }

    // Near Character (Position & Ground Shadow)
    if (this.charNear) {
      this.charNear.root.position.set(gs.near.x, gs.near.y || 0, gs.near.z);
      if (this.nearTag) this.nearTag.position.set(gs.near.x, (gs.near.y || 0) + 5.0, gs.near.z);
      if (this.nearShadow) {
        this.nearShadow.position.set(gs.near.x, 0.11, gs.near.z);
        const sy = Math.max(0.3, 1 - (gs.near.y || 0) * 0.25);
        this.nearShadow.scale.set(sy, sy, sy);
      }
    }

    // Far Character (Position & Ground Shadow)
    if (this.charFar) {
      this.charFar.root.position.set(gs.far.x, gs.far.y || 0, gs.far.z);
      if (this.farTag) this.farTag.position.set(gs.far.x, (gs.far.y || 0) + 5.0, gs.far.z);
      if (this.farShadow) {
        this.farShadow.position.set(gs.far.x, 0.11, gs.far.z);
        const sy = Math.max(0.3, 1 - (gs.far.y || 0) * 0.25);
        this.farShadow.scale.set(sy, sy, sy);
      }
    }
  }

  animateCharacters(delta) {
    const t = this.clock.getElapsedTime();

    // Near Character animations
    if (this.charNear) {
      const ch = this.charNear;
      const isMoving = (this.keys['left'] || this.keys['right'] || this.keys['up'] || this.keys['down']) && (this.isP1 || this.isSolo);
      const walk = isMoving ? Math.sin(t * 14) * 0.45 : 0;
      if (ch.leftLeg) ch.leftLeg.rotation.x = walk;
      if (ch.rightLeg) ch.rightLeg.rotation.x = -walk;

      // Arm swing / Smash animation
      if (ch.swingTime > 0) {
        ch.swingTime -= delta;
        if (ch.rightArm) ch.rightArm.rotation.x = -Math.PI * 0.75 + Math.sin(ch.swingTime * 18) * 1.2;
      } else {
        if (ch.rightArm) ch.rightArm.rotation.x = -0.3 + Math.sin(t * 2) * 0.08;
      }
    }

    // Far Character animations
    if (this.charFar) {
      const ch = this.charFar;
      const isMoving = (this.keys['left'] || this.keys['right'] || this.keys['up'] || this.keys['down']) && this.isP2;
      const walk = (isMoving || this.isSolo) ? Math.sin(t * 14) * 0.45 : 0;
      if (ch.leftLeg) ch.leftLeg.rotation.x = walk;
      if (ch.rightLeg) ch.rightLeg.rotation.x = -walk;

      if (ch.swingTime > 0) {
        ch.swingTime -= delta;
        if (ch.rightArm) ch.rightArm.rotation.x = -Math.PI * 0.75 + Math.sin(ch.swingTime * 18) * 1.2;
      } else {
        if (ch.rightArm) ch.rightArm.rotation.x = -0.3 + Math.sin(t * 2 + 1) * 0.08;
      }
    }
  }

  _checkWinner(nextServer) {
    const gs = this.gs;
    if (gs.near.score >= gs.maxScore || gs.far.score >= gs.maxScore) {
      gs.status = 'finished';
      const winner = gs.near.score >= gs.maxScore ? 'near' : 'far';
      gs.winner = winner;
      const wp = winner === 'near' ? this.p1 : this.p2;
      const data = {
        winner,
        winnerName: wp?.name || (winner === 'near' ? 'P1' : 'P2'),
        winnerColor: wp?.color || '#fbbf24',
        nearScore: gs.near.score,
        farScore: gs.far.score
      };
      this.socket.emit('tennis:gameover', data);
      this._showWinner(data);
    } else {
      gs.status = 'point';
      setTimeout(() => {
        if (!this.active || gs.status === 'finished') return;
        this._readyServe(nextServer || 'near');
      }, 1500);
    }
  }

  _showPointFlash(scorer) {
    const ex = document.getElementById('t3d-flash');
    if (ex) ex.remove();
    const el = document.createElement('div');
    el.id = 't3d-flash';
    const isNear = scorer === 'near';
    const name = isNear ? (this.p1?.name || 'P1') : (this.p2?.name || (this.isSolo ? 'BOT' : 'P2'));
    const color = isNear ? (this.p1?.color || '#3b82f6') : (this.p2?.color || '#ef4444');
    el.style.cssText = `
      position:absolute;top:45%;left:50%;
      transform:translate(-50%,-50%);
      font-size:28px;font-weight:900;
      color:${color};background:rgba(10,22,40,0.88);
      border:2px solid ${color};border-radius:24px;
      padding:10px 28px;z-index:25;white-space:nowrap;
      pointer-events:none;animation:t3dFlash 0.3s ease;
    `;
    el.textContent = `+1 ${name}! 🎾`;
    this.container.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  _showWinner(data) {
    const ex = document.getElementById('t3d-winner');
    if (ex) ex.remove();
    const isMyWin = (data.winner === 'near' && this.isP1) || (data.winner === 'far' && this.isP2);
    if (isMyWin && window.soundManager) window.soundManager.winFanfare();
    else if (!isMyWin && window.soundManager) window.soundManager.playBeep(200, 0.5, 'sawtooth');
    const icon = isMyWin ? '🏆' : '👑';
    const color = data.winnerColor || '#fbbf24';
    const ov = document.createElement('div');
    ov.id = 't3d-winner';
    ov.style.cssText = `
      position:absolute;inset:0;background:rgba(10,22,40,0.92);
      backdrop-filter:blur(10px);display:flex;flex-direction:column;
      align-items:center;justify-content:center;z-index:30;gap:12px;
    `;
    ov.innerHTML = `
      <div style="font-size:72px;">${icon}</div>
      <h2 style="font-size:30px;font-weight:900;color:${color};margin:0;">${isMyWin ? 'KAMU MENANG!' : data.winnerName + ' Menang!'}</h2>
      <div style="font-size:20px;color:rgba(255,255,255,0.7);margin-bottom:8px;">Skor: ${data.nearScore} - ${data.farScore}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
        <button id="t3d-restart-btn" style="padding:12px 26px;font-size:15px;font-weight:800;border-radius:30px;background:linear-gradient(135deg,#f59e0b,#d97706);border:none;cursor:pointer;color:#0f172a;">🔄 Main Lagi</button>
        <button id="t3d-lobby-btn" style="padding:12px 26px;font-size:15px;font-weight:800;border-radius:30px;background:rgba(30,41,59,0.9);border:1px solid rgba(255,255,255,0.25);cursor:pointer;color:#fff;">🏠 Kembali ke Room</button>
      </div>
    `;
    this.container.appendChild(ov);
    document.getElementById('t3d-restart-btn')?.addEventListener('click', () => {
      this.socket.emit('tennis:restart');
      ov.remove();
      this.gs.near.score = 0; this.gs.far.score = 0;
      this.gs.rally = 0; this.gs.winner = null;
      this.updateScoreHUD();
      if (this.cdOverlay) this.cdOverlay.style.display = 'flex';
      this.startCountdown();
    });
    document.getElementById('t3d-lobby-btn')?.addEventListener('click', () => this.socket.emit('backToLobby'));
  }

  _playBeep(freq) {
    if (!window.soundManager) return;
    try { window.soundManager.playBeep(freq, 0.07, 'sine'); } catch (e) {}
  }

  // ==================== DESTROY ====================
  destroy() {
    this.active = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.cdInterval) clearInterval(this.cdInterval);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('resize', this._onResize);
    this.container.removeEventListener('mousedown', this._onMouseDown);
    this.socket.off('tennis:state', this._onStateUpdate);
    this.socket.off('tennis:paddle', this._onPaddleUpdate);
    this.socket.off('tennis:point', this._onPoint);
    this.socket.off('tennis:gameover', this._onGameOver);
    this.socket.off('tennis:restart', this._onRestart);
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    this.container.innerHTML = '';
    this.container.style.position = '';
    this.container.style.overflow = '';
  }
}

// Flash and Smash animation CSS
(function() {
  if (!document.getElementById('t3d-anim')) {
    const s = document.createElement('style');
    s.id = 't3d-anim';
    s.textContent = `
      @keyframes t3dFlash {
        0% { transform: translate(-50%,-50%) scale(0.5); opacity:0; }
        60% { transform: translate(-50%,-50%) scale(1.1); opacity:1; }
        100% { transform: translate(-50%,-50%) scale(1); opacity:1; }
      }
      @keyframes t3dSmashPop {
        0% { transform: translate(-50%,-50%) scale(0.3) rotate(-6deg); opacity:0; }
        50% { transform: translate(-50%,-50%) scale(1.2) rotate(2deg); opacity:1; }
        100% { transform: translate(-50%,-50%) scale(1.0) rotate(0deg); opacity:1; }
      }
    `;
    document.head.appendChild(s);
  }
})();

window.TennisGame = TennisGame;
