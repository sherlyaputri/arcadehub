// 🎾 ArcadeHub Tennis 3D - Roblox-style Characters + Three.js Court
// 1v1 Real-time Multiplayer (or vs Bot)

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
    this.p1 = playerList.find(p => p.isHost) || playerList[0]; // Left side
    this.p2 = playerList.find(p => !p.isHost) || playerList[1] || null; // Right side
    this.isP1 = this.selfId === this.p1?.id;
    this.isP2 = this.p2 && this.selfId === this.p2.id;
    this.isSolo = !this.p2;

    // Court logical dimensions (used for physics)
    this.COURT_W = 24;   // X width (left-right)
    this.COURT_D = 12;   // Z depth (top-bottom) - half court visible per side
    this.PADDLE_HALF = 1.5; // half paddle size in world units
    this.BALL_R = 0.22;

    // Game state - P1 (host) is authoritative
    this.gs = {
      ball: { x: 0, z: 0, vx: 0, vz: 0, vy: 0, y: 0.6, bounces: 0 },
      left: { z: 0, score: 0 },   // P1 (left side)
      right: { z: 0, score: 0 },  // P2 (right side)
      status: 'countdown', // countdown | playing | point | finished
      maxScore: 7,
      winner: null,
      rally: 0
    };

    this.cdCount = 3;
    this.cdInterval = null;
    this.keys = {};

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

  // ==================== THREE.JS INIT ====================
  initThree() {
    this.width = this.container.clientWidth || 1200;
    this.height = this.container.clientHeight || 700;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
    this.scene.fog = new THREE.FogExp2(0xa0d0f0, 0.02);

    // Camera - side view, slightly elevated, looking at center court
    this.camera = new THREE.PerspectiveCamera(55, this.width / this.height, 0.1, 500);
    this.camera.position.set(0, 10, 22);
    this.camera.lookAt(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfffde7, 1.4);
    sun.position.set(10, 25, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    this.scene.add(sun);

    // Fill light from left
    const fill = new THREE.DirectionalLight(0xddeeff, 0.5);
    fill.position.set(-10, 8, 5);
    this.scene.add(fill);

    // Resize
    this._onResize = () => {
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    };
    window.addEventListener('resize', this._onResize);
  }

  // ==================== COURT ENVIRONMENT ====================
  buildCourt() {
    // Grass ground
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a7d44, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Court surface (green tennis/grass court)
    const courtGeo = new THREE.BoxGeometry(this.COURT_W + 4, 0.08, this.COURT_D * 2 + 4);
    const courtMat = new THREE.MeshStandardMaterial({ color: 0x1a7a2a, roughness: 0.85 });
    const court = new THREE.Mesh(courtGeo, courtMat);
    court.position.set(0, 0.04, 0);
    court.receiveShadow = true;
    this.scene.add(court);

    // Court lines (white)
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

    // Helper to add a line
    const addLine = (w, d, x, y, z) => {
      const geo = new THREE.BoxGeometry(w, 0.04, d);
      const mesh = new THREE.Mesh(geo, lineMat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
    };

    const lh = 0.12; // line height
    const hw = this.COURT_W / 2;
    const hd = this.COURT_D;

    // Outer boundary (long sides)
    addLine(this.COURT_W, 0.15, 0, lh, -hd);
    addLine(this.COURT_W, 0.15, 0, lh, hd);
    // Short sides (baseline)
    addLine(0.15, hd * 2, -hw, lh, 0);
    addLine(0.15, hd * 2, hw, lh, 0);
    // Center line (Z axis - net)
    addLine(0.15, hd * 2, 0, lh, 0);
    // Service lines
    addLine(this.COURT_W, 0.15, 0, lh, -hd * 0.5);
    addLine(this.COURT_W, 0.15, 0, lh, hd * 0.5);
    // Center service mark
    addLine(0.15, hd * 0.5, -hw * 0.5, lh, 0);
    addLine(0.15, hd * 0.5, hw * 0.5, lh, 0);

    // ============= NET =============
    // Net posts
    const postMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 });
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8);
    [-hd - 0.3, hd + 0.3].forEach(z => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(0, 0.9, z);
      this.scene.add(post);
    });

    // Net mesh
    const netGroup = new THREE.Group();
    const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide });

    for (let i = 0; i < 12; i++) {
      const stripGeo = new THREE.PlaneGeometry(0.08, 1.6);
      const strip = new THREE.Mesh(stripGeo, netMat);
      strip.position.set(0, 0.85, -hd + (i + 0.5) * (hd * 2 / 12));
      strip.rotation.y = Math.PI / 2;
      netGroup.add(strip);
    }
    for (let j = 0; j < 8; j++) {
      const hStripGeo = new THREE.PlaneGeometry((hd * 2 + 0.6), 0.08);
      const hstrip = new THREE.Mesh(hStripGeo, netMat);
      hstrip.position.set(0, 0.1 + j * 0.22, 0);
      hstrip.rotation.y = Math.PI / 2;
      netGroup.add(hstrip);
    }
    // Top tape
    const tapeGeo = new THREE.BoxGeometry(0.12, 0.08, hd * 2 + 0.6);
    const tapeMesh = new THREE.Mesh(tapeGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
    tapeMesh.position.set(0, 1.68, 0);
    netGroup.add(tapeMesh);

    this.scene.add(netGroup);

    // Crowd stands / bleachers (simple colored boxes)
    const standMat1 = new THREE.MeshStandardMaterial({ color: 0x1e3a5f });
    const standMat2 = new THREE.MeshStandardMaterial({ color: 0x2d6a4f });

    for (let side = -1; side <= 1; side += 2) {
      const standGeo = new THREE.BoxGeometry(this.COURT_W + 10, 5, 3);
      const stand = new THREE.Mesh(standGeo, side < 0 ? standMat1 : standMat2);
      stand.position.set(0, 2.5, side * (hd + 7));
      this.scene.add(stand);

      // Crowd dots
      for (let c = 0; c < 30; c++) {
        const dotGeo = new THREE.SphereGeometry(0.3, 6, 4);
        const dotMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5) });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(
          (Math.random() - 0.5) * (this.COURT_W + 8),
          0.5 + Math.random() * 3.5,
          side * (hd + 7) + (Math.random() - 0.5) * 2.5
        );
        this.scene.add(dot);
      }
    }

    // Background trees
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 });
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const dist = 28 + Math.random() * 8;
      const tg = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 5, 6), trunkMat);
      trunk.position.y = 2.5;
      tg.add(trunk);
      for (let l = 0; l < 3; l++) {
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.5 - l * 0.4, 2.5, 7), leafMat);
        leaves.position.y = 4.5 + l * 1.4;
        tg.add(leaves);
      }
      tg.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      this.scene.add(tg);
    }

    // Store net position for physics
    this.netX = 0;
    this.netH = 1.65;
  }

  // ==================== CHARACTERS ====================
  buildCharacters() {
    // P1 character (left side, faces right)
    const p1Idx = 0;
    const p2Idx = 1;

    this.charLeft = this.createRobloxCharacter(p1Idx, this.p1?.name || 'P1');
    this.charLeft.root.position.set(-this.COURT_W / 2 + 2, 0, 0);
    this.charLeft.root.rotation.y = Math.PI / 2; // face right (+X)
    this.scene.add(this.charLeft.root);

    this.charRight = this.createRobloxCharacter(p2Idx, this.p2?.name || (this.isSolo ? 'BOT' : 'P2'));
    this.charRight.root.position.set(this.COURT_W / 2 - 2, 0, 0);
    this.charRight.root.rotation.y = -Math.PI / 2; // face left (-X)
    this.scene.add(this.charRight.root);

    // Rackets
    this.racketLeft = this.buildRacket(0x2563eb);
    this.racketLeft.position.set(0.9, 2.1, 0.5);
    this.charLeft.rightArm.add(this.racketLeft);

    this.racketRight = this.buildRacket(0xef4444);
    this.racketRight.position.set(-0.9, 2.1, 0.5);
    this.charRight.leftArm.add(this.racketRight);

    // Name tags above characters
    this.leftTag = this.createNameTag(this.p1?.name || 'P1', this.p1?.color || '#2563eb');
    this.leftTag.position.set(-this.COURT_W / 2 + 2, 5.5, 0);
    this.scene.add(this.leftTag);

    this.rightTag = this.createNameTag(this.p2?.name || (this.isSolo ? 'BOT' : 'P2'), this.p2?.color || '#ef4444');
    this.rightTag.position.set(this.COURT_W / 2 - 2, 5.5, 0);
    this.scene.add(this.rightTag);
  }

  createRobloxCharacter(idx, name) {
    const root = new THREE.Group();

    const PALETTES = [
      { outfit: 0x2563eb, pants: 0x1e293b, hair: 0x09090b },
      { outfit: 0xef4444, pants: 0x18181b, hair: 0x171717 },
      { outfit: 0x059669, pants: 0x111827, hair: 0x27272a },
      { outfit: 0x7c3aed, pants: 0x1e1b4b, hair: 0x09090b },
      { outfit: 0xd97706, pants: 0x1c1917, hair: 0x18181b },
      { outfit: 0x0891b2, pants: 0x134e4a, hair: 0x18181b },
    ];

    const pal = PALETTES[idx % PALETTES.length];
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 });
    const outfitMat = new THREE.MeshStandardMaterial({ color: pal.outfit, roughness: 0.85 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pal.pants, roughness: 0.9 });
    const hairMat = new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.9 });

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
    const torsoGeo = new THREE.BoxGeometry(1.25, 1.45, 0.65);
    const torso = new THREE.Mesh(torsoGeo, outfitMat);
    torso.position.set(0, 2.05, 0);
    torso.castShadow = true;
    root.add(torso);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.42, 1.35, 0.45);
    const leftArm = new THREE.Mesh(armGeo, outfitMat);
    leftArm.position.set(-0.92, 2.0, 0);
    leftArm.castShadow = true;
    root.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, outfitMat);
    rightArm.position.set(0.92, 2.0, 0);
    rightArm.castShadow = true;
    root.add(rightArm);

    // Head - with face texture
    const headCanvas = document.createElement('canvas');
    headCanvas.width = 256; headCanvas.height = 256;
    const hctx = headCanvas.getContext('2d');
    hctx.fillStyle = '#d4a373'; hctx.fillRect(0, 0, 256, 256);
    // Glasses
    hctx.strokeStyle = '#09090b'; hctx.lineWidth = 14;
    hctx.strokeRect(32, 85, 75, 58);
    hctx.strokeRect(148, 85, 75, 58);
    hctx.beginPath(); hctx.moveTo(107, 110); hctx.lineTo(148, 110); hctx.stroke();
    // Eyes
    hctx.fillStyle = '#ffffff'; hctx.fillRect(45, 96, 50, 36); hctx.fillRect(160, 96, 50, 36);
    hctx.fillStyle = '#1e1b4b';
    hctx.beginPath(); hctx.arc(70, 114, 16, 0, Math.PI*2); hctx.arc(185, 114, 16, 0, Math.PI*2); hctx.fill();
    hctx.fillStyle = '#ffffff';
    hctx.beginPath(); hctx.arc(65, 108, 6, 0, Math.PI*2); hctx.arc(180, 108, 6, 0, Math.PI*2); hctx.fill();
    // Mouth
    hctx.strokeStyle = '#7c2d12'; hctx.lineWidth = 5;
    hctx.beginPath(); hctx.moveTo(112, 185); hctx.lineTo(144, 185); hctx.stroke();

    const faceTex = new THREE.CanvasTexture(headCanvas);
    const headMats = [skinMat, skinMat, skinMat, skinMat,
      new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.7 }), skinMat];

    const headGeo = new THREE.BoxGeometry(1.05, 1.05, 1.05);
    const head = new THREE.Mesh(headGeo, headMats);
    head.position.set(0, 3.25, 0);
    head.castShadow = true;
    root.add(head);

    // Hair
    const hairTopGeo = new THREE.BoxGeometry(1.22, 0.52, 1.22);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 3.84, 0);
    root.add(hairTop);

    const bangs = [
      { x: -0.42, y: 3.65, z: 0.54, w: 0.22, h: 0.48 },
      { x: 0.0,   y: 3.62, z: 0.58, w: 0.25, h: 0.52 },
      { x: 0.42,  y: 3.66, z: 0.54, w: 0.22, h: 0.48 },
      { x: -0.58, y: 3.45, z: 0.1,  w: 0.20, h: 0.75 },
      { x: 0.58,  y: 3.45, z: 0.1,  w: 0.20, h: 0.75 },
    ];
    bangs.forEach(b => {
      const bm = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, 0.32), hairMat);
      bm.position.set(b.x, b.y, b.z);
      root.add(bm);
    });

    return { root, head, torso, leftArm, rightArm, leftLeg, rightLeg, animTime: Math.random() * 10 };
  }

  buildRacket(color) {
    const rg = new THREE.Group();
    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.4, 0, 0);
    rg.add(handle);

    // Frame (oval)
    const frameMat = new THREE.MeshStandardMaterial({ color: color || 0x2563eb });
    const frameGeo = new THREE.TorusGeometry(0.55, 0.06, 6, 14);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(-0.2, 0, 0);
    frame.rotation.y = Math.PI / 2;
    rg.add(frame);

    // Strings
    const strMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    for (let i = -3; i <= 3; i++) {
      const sg = new THREE.BoxGeometry(0.02, 0.02, 1.0);
      const sm = new THREE.Mesh(sg, strMat);
      sm.position.set(-0.2, i * 0.14, 0);
      rg.add(sm);
    }
    for (let i = -3; i <= 3; i++) {
      const sg = new THREE.BoxGeometry(0.02, 1.0, 0.02);
      const sm = new THREE.Mesh(sg, strMat);
      sm.position.set(-0.2, 0, i * 0.14);
      rg.add(sm);
    }

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
    ctx.font = 'bold 56px sans-serif';
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
    const geo = new THREE.SphereGeometry(this.BALL_R, 14, 10);
    const mat = new THREE.MeshStandardMaterial({ color: 0xd4f04a, roughness: 0.5, metalness: 0.05 });
    this.ball3d = new THREE.Mesh(geo, mat);
    this.ball3d.castShadow = true;
    this.scene.add(this.ball3d);

    // Shadow blob on ground
    const blobGeo = new THREE.CircleGeometry(0.25, 12);
    const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    this.ballShadow = new THREE.Mesh(blobGeo, blobMat);
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.06;
    this.scene.add(this.ballShadow);
  }

  // ==================== HUD ====================
  buildHUD() {
    // Overlay div for scores and countdown
    this.hud = document.createElement('div');
    this.hud.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0;
      pointer-events: none;
      z-index: 10;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;
    this.hud.innerHTML = `
      <div id="tennis3d-scorebar" style="
        display: flex; align-items: center; justify-content: center;
        gap: 16px; padding: 8px 20px; margin: 8px auto;
        background: rgba(10,22,40,0.88); border: 1px solid rgba(255,255,255,0.15);
        border-radius: 32px; width: fit-content;
      ">
        <span id="t3d-p1name" style="font-weight:800;color:${this.p1?.color||'#2563eb'};font-size:14px;">${(this.p1?.name||'P1').slice(0,12)}</span>
        <span id="t3d-p1score" style="font-size:28px;font-weight:900;color:#fff;min-width:28px;text-align:center;">0</span>
        <span style="color:rgba(255,255,255,0.4);font-size:12px;">VS</span>
        <span id="t3d-p2score" style="font-size:28px;font-weight:900;color:#fff;min-width:28px;text-align:center;">0</span>
        <span id="t3d-p2name" style="font-weight:800;color:${this.p2?.color||'#ef4444'};font-size:14px;">${(this.p2?.name||(this.isSolo?'BOT':'P2')).slice(0,12)}</span>
      </div>
      <div id="t3d-rally" style="text-align:center;font-size:13px;font-weight:800;color:#fbbf24;min-height:18px;"></div>
    `;
    this.container.appendChild(this.hud);

    // Mobile controls
    this.mobileCtrl = document.createElement('div');
    this.mobileCtrl.style.cssText = `
      position: absolute; bottom: 12px; left: 50%;
      transform: translateX(-50%);
      display: ${(window.innerWidth <= 768 || 'ontouchstart' in window) ? 'flex' : 'none'};
      gap: 20px; z-index: 10; pointer-events: auto;
    `;
    this.mobileCtrl.innerHTML = `
      <button id="t3d-up" style="width:60px;height:60px;font-size:26px;border-radius:50%;background:rgba(30,41,59,0.9);border:2px solid rgba(255,255,255,0.3);color:#fff;cursor:pointer;user-select:none;touch-action:none;">▲</button>
      <button id="t3d-down" style="width:60px;height:60px;font-size:26px;border-radius:50%;background:rgba(30,41,59,0.9);border:2px solid rgba(255,255,255,0.3);color:#fff;cursor:pointer;user-select:none;touch-action:none;">▼</button>
    `;
    this.container.appendChild(this.mobileCtrl);
    this._bindMobileCtrl();

    // Role info
    const role = document.createElement('div');
    role.style.cssText = `position:absolute;bottom:${window.innerWidth<=768?80:8}px;left:50%;transform:translateX(-50%);font-size:11px;color:rgba(255,255,255,0.4);white-space:nowrap;pointer-events:none;z-index:10;`;
    role.textContent = this.isP1 ? 'Kamu: Raket KIRI ◀  (W/S atau ↑↓)' : (this.isP2 ? 'Kamu: Raket KANAN ▶  (W/S atau ↑↓)' : '👁️ Spectating');
    this.container.appendChild(role);

    // Countdown overlay
    this.cdOverlay = document.createElement('div');
    this.cdOverlay.style.cssText = `
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(10,22,40,0.65); backdrop-filter: blur(4px);
      z-index: 20; pointer-events: none; border-radius: 0;
    `;
    this.cdOverlay.innerHTML = `<div id="t3d-cd" style="font-size:110px;font-weight:900;color:#fbbf24;text-shadow:0 0 40px rgba(251,191,36,0.6);">3</div>`;
    this.container.appendChild(this.cdOverlay);
  }

  _bindMobileCtrl() {
    const up = document.getElementById('t3d-up');
    const down = document.getElementById('t3d-down');
    if (!up || !down) return;
    const s = k => { this.keys[k] = true; };
    const e = k => { this.keys[k] = false; };
    up.addEventListener('touchstart', ev => { ev.preventDefault(); s('up'); }, { passive: false });
    up.addEventListener('touchend', ev => { ev.preventDefault(); e('up'); }, { passive: false });
    up.addEventListener('mousedown', () => s('up'));
    up.addEventListener('mouseup', () => e('up'));
    up.addEventListener('mouseleave', () => e('up'));
    down.addEventListener('touchstart', ev => { ev.preventDefault(); s('down'); }, { passive: false });
    down.addEventListener('touchend', ev => { ev.preventDefault(); e('down'); }, { passive: false });
    down.addEventListener('mousedown', () => s('down'));
    down.addEventListener('mouseup', () => e('down'));
    down.addEventListener('mouseleave', () => e('down'));
  }

  updateScoreHUD() {
    const p1s = document.getElementById('t3d-p1score');
    const p2s = document.getElementById('t3d-p2score');
    if (p1s) p1s.textContent = this.gs.left.score;
    if (p2s) p2s.textContent = this.gs.right.score;
    const rally = document.getElementById('t3d-rally');
    if (rally) rally.textContent = this.gs.rally >= 5 ? `🔥 Ralian x${this.gs.rally}` : '';
  }

  // ==================== KEYBOARD ====================
  bindKeys() {
    this._onKeyDown = e => {
      if (['ArrowUp', 'w', 'W'].includes(e.key)) { this.keys['up'] = true; e.stopPropagation(); }
      if (['ArrowDown', 's', 'S'].includes(e.key)) { this.keys['down'] = true; e.stopPropagation(); }
    };
    this._onKeyUp = e => {
      if (['ArrowUp', 'w', 'W'].includes(e.key)) this.keys['up'] = false;
      if (['ArrowDown', 's', 'S'].includes(e.key)) this.keys['down'] = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  // ==================== COUNTDOWN ====================
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
        this.gs.status = 'playing';
        if (this.isP1 || this.isSolo) this._resetBall(true);
        if (this.cdOverlay) this.cdOverlay.style.display = 'none';
        this._playBeep(900);
      }
    }, 1000);
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
      if (this.isP1 && data.role === 'right') this.gs.right.z = data.z;
      else if (this.isP2 && data.role === 'left') this.gs.left.z = data.z;
    };
    this._onPoint = data => {
      if (!this.active) return;
      this.gs.left.score = data.leftScore;
      this.gs.right.score = data.rightScore;
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
      this.gs.left.score = 0;
      this.gs.right.score = 0;
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
    const delta = this.clock.getDelta();
    this.update(delta);
    this.animateCharacters(delta);
    this.renderer.render(this.scene, this.camera);
  }

  update(delta) {
    if (this.gs.status !== 'playing') return;
    const gs = this.gs;
    const SPEED = 10; // world units per second
    const HALF_D = this.COURT_D - 0.3;

    // Move local character paddle
    const isLeft = this.isP1 || this.isSolo;
    const isRight = this.isP2;

    if (isLeft) {
      if (this.keys['up']) gs.left.z = Math.max(-HALF_D, gs.left.z - SPEED * delta);
      if (this.keys['down']) gs.left.z = Math.min(HALF_D, gs.left.z + SPEED * delta);
    }
    if (isRight) {
      if (this.keys['up']) gs.right.z = Math.max(-HALF_D, gs.right.z - SPEED * delta);
      if (this.keys['down']) gs.right.z = Math.min(HALF_D, gs.right.z + SPEED * delta);
    }

    // Bot AI (solo mode - controls right side)
    if (this.isSolo) {
      const diff = gs.ball.z - gs.right.z;
      const botSpeed = Math.min(7 + gs.rally * 0.1, 11);
      if (Math.abs(diff) > 0.2) gs.right.z += Math.sign(diff) * Math.min(botSpeed * delta, Math.abs(diff));
      gs.right.z = Math.max(-HALF_D, Math.min(HALF_D, gs.right.z));
    }

    // Broadcast paddle
    if (isLeft) this.socket.emit('tennis:paddle', { role: 'left', z: gs.left.z });
    if (isRight) this.socket.emit('tennis:paddle', { role: 'right', z: gs.right.z });

    // --- Ball physics (only P1 / solo runs authoritative) ---
    if (!this.isP1 && !this.isSolo) {
      this._syncVisuals();
      return;
    }

    const b = gs.ball;
    b.x += b.vx * delta;
    b.z += b.vz * delta;
    b.vy -= 20 * delta; // gravity
    b.y += b.vy * delta;

    // Bounce off ground
    if (b.y <= this.BALL_R) {
      b.y = this.BALL_R;
      b.vy = Math.abs(b.vy) * 0.72;
      gs.rally++;
      this._playBeep(350);
    }

    // Bounce off back walls (Z)
    if (b.z < -this.COURT_D + this.BALL_R) { b.z = -this.COURT_D + this.BALL_R; b.vz = Math.abs(b.vz); this._playBeep(600); }
    if (b.z > this.COURT_D - this.BALL_R) { b.z = this.COURT_D - this.BALL_R; b.vz = -Math.abs(b.vz); this._playBeep(600); }

    // Net collision
    const leftEdge = -this.COURT_W / 2;
    const rightEdge = this.COURT_W / 2;
    const paddleW = this.PADDLE_HALF; // in Z direction

    // Left paddle (at X ~ leftEdge + 1.5)
    const leftPaddleX = leftEdge + 2;
    if (b.x <= leftPaddleX + 0.3 && b.x >= leftPaddleX - 0.4 && b.y <= 3.5 &&
        Math.abs(b.z - gs.left.z) < paddleW) {
      b.x = leftPaddleX + 0.3;
      const hitOff = (b.z - gs.left.z) / paddleW;
      const spd = Math.min(Math.sqrt(b.vx * b.vx + b.vz * b.vz) + 1, 20);
      b.vx = Math.abs(spd * Math.cos(hitOff * 0.8));
      b.vz = spd * Math.sin(hitOff * 0.8);
      b.vy = Math.max(5, spd * 0.5);
      gs.rally++;
      this._playBeep(400);
    }

    // Right paddle (at X ~ rightEdge - 1.5)
    const rightPaddleX = rightEdge - 2;
    if (b.x >= rightPaddleX - 0.3 && b.x <= rightPaddleX + 0.4 && b.y <= 3.5 &&
        Math.abs(b.z - gs.right.z) < paddleW) {
      b.x = rightPaddleX - 0.3;
      const hitOff = (b.z - gs.right.z) / paddleW;
      const spd = Math.min(Math.sqrt(b.vx * b.vx + b.vz * b.vz) + 1, 20);
      b.vx = -Math.abs(spd * Math.cos(hitOff * 0.8));
      b.vz = spd * Math.sin(hitOff * 0.8);
      b.vy = Math.max(5, spd * 0.5);
      gs.rally++;
      this._playBeep(500);
    }

    // Net block
    if (Math.abs(b.x) < 0.2 && b.y < this.netH) {
      b.vx = -b.vx * 0.6;
      b.vy = Math.abs(b.vy) * 0.3;
      this._playBeep(250);
    }

    // Score if ball goes past baseline
    if (b.x < leftEdge - 0.5) {
      // Right scores
      gs.right.score++;
      this._playBeep(200);
      this.socket.emit('tennis:point', { scorer: 'right', leftScore: gs.left.score, rightScore: gs.right.score });
      this._showPointFlash('right');
      this.updateScoreHUD();
      this._checkWinner();
      return;
    }
    if (b.x > rightEdge + 0.5) {
      // Left scores
      gs.left.score++;
      this._playBeep(200);
      this.socket.emit('tennis:point', { scorer: 'left', leftScore: gs.left.score, rightScore: gs.right.score });
      this._showPointFlash('left');
      this.updateScoreHUD();
      this._checkWinner();
      return;
    }

    // Broadcast state every 2 frames
    if (!this._tick) this._tick = 0;
    this._tick++;
    if (this._tick % 2 === 0) this.socket.emit('tennis:state', { ...gs });

    this._syncVisuals();
  }

  _syncVisuals() {
    const gs = this.gs;
    const b = gs.ball;

    // Ball position
    if (this.ball3d) this.ball3d.position.set(b.x, Math.max(this.BALL_R, b.y), b.z);
    if (this.ballShadow) {
      this.ballShadow.position.set(b.x, 0.06, b.z);
      const shadowScale = Math.max(0.3, 1 - b.y * 0.08);
      this.ballShadow.scale.set(shadowScale, shadowScale, shadowScale);
    }

    // Characters follow paddle Z
    if (this.charLeft) {
      this.charLeft.root.position.z = gs.left.z;
      this.leftTag.position.z = gs.left.z;
    }
    if (this.charRight) {
      this.charRight.root.position.z = gs.right.z;
      this.rightTag.position.z = gs.right.z;
    }
  }

  animateCharacters(delta) {
    const t = this.clock.getElapsedTime();

    // Animate left character
    if (this.charLeft) {
      const ch = this.charLeft;
      ch.animTime = (ch.animTime || 0) + delta * 3;
      // Idle breathing bounce
      ch.root.position.y = Math.sin(t * 2) * 0.04;
      // Swing arm when ball is near
      const bx = this.gs.ball.x;
      const nearLeft = bx < -this.COURT_W / 2 + 5;
      const swingAmt = nearLeft ? Math.sin(t * 8) * 0.4 : Math.sin(t * 1.5) * 0.08;
      if (ch.rightArm) ch.rightArm.rotation.x = -0.5 + swingAmt;
      if (ch.leftArm) ch.leftArm.rotation.x = 0.1 - swingAmt * 0.5;
      // Leg walk animation when moving
      const moving = this.keys['up'] || this.keys['down'];
      const walkAmt = moving ? Math.sin(t * 8) * 0.3 : 0;
      if (ch.leftLeg) ch.leftLeg.rotation.x = walkAmt;
      if (ch.rightLeg) ch.rightLeg.rotation.x = -walkAmt;
    }

    // Animate right character
    if (this.charRight) {
      const ch = this.charRight;
      ch.root.position.y = Math.sin(t * 2 + 1) * 0.04;
      const bx = this.gs.ball.x;
      const nearRight = bx > this.COURT_W / 2 - 5;
      const swingAmt = nearRight ? Math.sin(t * 8) * 0.4 : Math.sin(t * 1.5 + 1) * 0.08;
      if (ch.leftArm) ch.leftArm.rotation.x = -0.5 + swingAmt;
      if (ch.rightArm) ch.rightArm.rotation.x = 0.1 - swingAmt * 0.5;
    }
  }

  _resetBall(toRight) {
    const gs = this.gs;
    gs.ball.x = 0;
    gs.ball.z = (Math.random() - 0.5) * 4;
    gs.ball.y = 3;
    const spd = 8;
    const ang = (Math.random() - 0.5) * 0.6;
    gs.ball.vx = (toRight ? 1 : -1) * spd * Math.cos(ang);
    gs.ball.vz = spd * Math.sin(ang);
    gs.ball.vy = 2;
    gs.rally = 0;
    gs.status = 'playing';
  }

  _checkWinner() {
    const gs = this.gs;
    if (gs.left.score >= gs.maxScore || gs.right.score >= gs.maxScore) {
      gs.status = 'finished';
      const winner = gs.left.score >= gs.maxScore ? 'left' : 'right';
      gs.winner = winner;
      const wp = winner === 'left' ? this.p1 : this.p2;
      const data = {
        winner,
        winnerName: wp?.name || (winner === 'left' ? 'P1' : 'P2'),
        winnerColor: wp?.color || '#fbbf24',
        leftScore: gs.left.score,
        rightScore: gs.right.score
      };
      this.socket.emit('tennis:gameover', data);
      this._showWinner(data);
    } else {
      gs.status = 'point';
      setTimeout(() => {
        if (!this.active || gs.status === 'finished') return;
        this._resetBall(gs.left.score > gs.right.score);
      }, 1500);
    }
  }

  _showPointFlash(scorer) {
    const ex = document.getElementById('t3d-flash');
    if (ex) ex.remove();
    const el = document.createElement('div');
    el.id = 't3d-flash';
    const isLeft = scorer === 'left';
    const name = isLeft ? (this.p1?.name || 'P1') : (this.p2?.name || 'P2');
    const color = isLeft ? (this.p1?.color || '#2563eb') : (this.p2?.color || '#ef4444');
    el.style.cssText = `
      position:absolute;top:50%;left:50%;
      transform:translate(-50%,-50%);
      font-size:30px;font-weight:900;
      color:${color};background:rgba(10,22,40,0.88);
      border:2px solid ${color};border-radius:20px;
      padding:10px 28px;z-index:25;white-space:nowrap;
      pointer-events:none;animation:t3dFlash 0.3s ease;
    `;
    el.textContent = `+1 ${name}! 🎾`;
    this.container.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  _showWinner(data) {
    const ex = document.getElementById('t3d-winner');
    if (ex) ex.remove();
    const isMyWin = (data.winner === 'left' && this.isP1) || (data.winner === 'right' && this.isP2);
    if (isMyWin && window.soundManager) window.soundManager.winFanfare();
    else if (!isMyWin && window.soundManager) window.soundManager.playBeep(200, 0.5, 'sawtooth');
    const icon = isMyWin ? '🏆' : '👑';
    const color = data.winnerColor || '#fbbf24';
    const ov = document.createElement('div');
    ov.id = 't3d-winner';
    ov.style.cssText = `
      position:absolute;inset:0;background:rgba(10,22,40,0.90);
      backdrop-filter:blur(10px);display:flex;flex-direction:column;
      align-items:center;justify-content:center;z-index:30;gap:10px;
    `;
    ov.innerHTML = `
      <div style="font-size:72px;">${icon}</div>
      <h2 style="font-size:28px;font-weight:900;color:${color};margin:0;">${isMyWin ? 'KAMU MENANG!' : data.winnerName + ' Menang!'}</h2>
      <div style="font-size:18px;color:rgba(255,255,255,0.7);margin-bottom:8px;">Skor: ${data.leftScore} - ${data.rightScore}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
        <button id="t3d-restart-btn" style="padding:12px 24px;font-size:15px;font-weight:800;border-radius:30px;background:linear-gradient(135deg,#f59e0b,#d97706);border:none;cursor:pointer;color:#0f172a;">🔄 Main Lagi</button>
        <button id="t3d-lobby-btn" style="padding:12px 24px;font-size:15px;font-weight:800;border-radius:30px;background:rgba(30,41,59,0.9);border:1px solid rgba(255,255,255,0.2);cursor:pointer;color:#fff;">🏠 Kembali ke Room</button>
      </div>
    `;
    this.container.appendChild(ov);
    document.getElementById('t3d-restart-btn')?.addEventListener('click', () => {
      this.socket.emit('tennis:restart');
      ov.remove();
      this.gs.left.score = 0; this.gs.right.score = 0;
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
  }
}

// Flash animation CSS
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
    `;
    document.head.appendChild(s);
  }
})();

window.TennisGame = TennisGame;
