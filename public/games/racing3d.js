// ============================================================================
// 📢 DAFTAR SPANDUK & PAPAN REKLAME PINGGIR JALAN (BISA DIEDIT SESUKA HATI)
// ============================================================================
// Anda bebas mengubah teks judul, subteks, badge, dan warna latar di bawah ini!
// - title: Judul utama spanduk
// - subtitle: Keterangan / slogan di bawah judul
// - badge: Label stiker kecil di sudut atas (misal: SPONSOR, INFO, dll)
// - bgColor: Warna background spanduk
// - textColor: Warna teks tulisan
// - accentColor: Warna aksen garis dan badge
// - sampleIdx: Titik lokasi di lintasan (0 - 359)
// - side: 'left' (kiri jalan) atau 'right' (kanan jalan)
const CUSTOM_BILLBOARDS = [
  {
    title: 'PT. TAMBANG NUSANTARA',
    subtitle: 'Solusi Energi & Konstruksi Nasional',
    badge: 'SPONSOR UTAMA',
    bgColor: '#0f2b5c',      // Biru Navy
    textColor: '#ffffff',
    accentColor: '#f59e0b',  // Kuning Emas
    sampleIdx: 26,           // Sektor Awal dekat Garis Start
    side: 'left'
  },
  {
    title: 'MINING ENERGY DRINK ⚡',
    subtitle: 'Dorongan Tenaga Tanpa Batas!',
    badge: 'BOOST 100%',
    bgColor: '#991b1b',      // Merah Sporty
    textColor: '#ffffff',
    accentColor: '#fbbf24',
    sampleIdx: 65,           // Mendekati tanjakan bukit
    side: 'right'
  },
  {
    title: 'RALLY EXTREME 2026 🏁',
    subtitle: 'Juara Sejati Tak Pernah Menyerah!',
    badge: 'GRAND PRIX',
    bgColor: '#09090b',      // Hitam Karbon
    textColor: '#00ff88',    // Hijau Neon
    accentColor: '#00ff88',
    sampleIdx: 115,          // Puncak bukit tertinggi
    side: 'left'
  },
  {
    title: 'HATI-HATI JALAN OFFROAD ⚠️',
    subtitle: 'Jaga Keseimbangan & Kurangi Kecepatan',
    badge: 'ZONA BAHAYA',
    bgColor: '#b45309',      // Hazard Amber
    textColor: '#ffffff',
    accentColor: '#fef08a',
    sampleIdx: 175,          // S-curve chicane
    side: 'right'
  },
  {
    title: 'ARCADE HUB TOURNAMENT 🎮',
    subtitle: 'Mabar Seru Bersama Teman Kapan Saja!',
    badge: 'MULTIPLAYER',
    bgColor: '#581c87',      // Ungu Arcade
    textColor: '#f3e8ff',
    accentColor: '#c084fc',
    sampleIdx: 310,          // Menuju Garis Finish
    side: 'left'
  }
];

// Turbo Racers 3D - Three.js WebGL Multiplayer Racing Engine (Mining & Construction Rally Theme)
class RacingGame3D {
  constructor(viewportEl, socket, roomInfo, selfId) {
    this.container = viewportEl;
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

    // Physics parameters
    this.physics = {
      maxSpeed: 1.25,       // Top speed (~100-105 km/h) - lebih nyaman & terkendali
      nitroSpeed: 1.85,     // Boost top speed (~155 km/h)
      accel: 0.019,         // Akselerasi lebih halus & terkontrol
      brake: 0.045,
      reverseSpeed: -0.38,
      friction: 0.982,
      turnSpeed: 0.026,     // Bobot stir lebih mantap & terkontrol (tidak over-sensitif)
      driftFriction: 0.94
    };

    // Input state
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      nitro: false
    };

    // Remote cars dictionary: id -> { carMesh, targetPos, targetRot, wheels, nameTag, isBoosting }
    this.remotePlayers = {};

    // Dust & splash particles
    this.dustParticles = [];
    this.waterParticles = [];
    this.gravelParticles = [];
    this.waterRipples = [];
    this.screenDrops = [];
    this.sparkParticles = [];
    this.lastCrashSoundTime = 0;
    this.camShake = 0;
    this.billboardMeshes = [];

    // Camera Orbit & Modes (Geser / Putar Kamera & Lihat Papan Reklame)
    this.cameraMode = 0; // 0: Chase, 1: Panorama, 2: Hood
    this.cameraModeNames = ['CHASE', 'PANORAMA', 'KAP MOBIL'];
    this.targetCameraYaw = 0;
    this.manualCameraYaw = 0;
    this.manualCameraPitch = 0;
    this.isDraggingCamera = false;
    this.cameraTouchId = null;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.lastDragTime = 0;

    this.initThree();
    this.buildTrack();
    this.buildDirectionArrowsOnRoad();
    this.buildTurnSigns();
    this.buildCustomBillboards();
    this.buildLocalCar();
    this.buildMiningEnvironment();
    this.buildHUD();
    this.bindInputs();
    this.bindSocketEvents();
  }

  initThree() {
    this.width = this.container.clientWidth || 1200;
    this.height = this.container.clientHeight || 750;

    // Scene
    this.scene = new THREE.Scene();

    // ☀️ Bright Sunny Sky
    const skyColor = new THREE.Color(0x5cb8ff);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0xb8e2ff, 0.0030);

    // Camera
    this.camera = new THREE.PerspectiveCamera(58, this.width / this.height, 0.1, 1200);
    this.camera.position.set(0, 5, -10);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.canvas = this.renderer.domElement;
    this.canvas.id = 'threeRacingCanvas';
    this.container.appendChild(this.canvas);

    // ☀️ Bright Sun Lighting
    const ambientLight = new THREE.AmbientLight(0xfffaed, 0.78);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff4db, 1.35);
    sunLight.position.set(100, 180, 80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    const d = 200;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);

    // Sky & Warm Clay Hemisphere Light
    const hemiLight = new THREE.HemisphereLight(0x70c0ff, 0xd49257, 0.55);
    this.scene.add(hemiLight);

    // Visible Sun Disk in Sky
    const sunGeom = new THREE.SphereGeometry(16, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.position.set(180, 280, 120);
    this.scene.add(sunMesh);

    // Resize handler
    this.resizeHandler = () => {
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  buildTrack() {
    this.trackWidth = 15.0; // Wide 2-lane racing road
    this.halfW = this.trackWidth / 2;

    // 🎢 3D Roller-Coaster Circuit with Tanjakan, Turunan & Berliku!
    this.trackPoints = [
      new THREE.Vector3(0, 0.0, 0),         // 0: Start / Finish Line (Ground Level)
      new THREE.Vector3(45, 0.8, 0),        // 1: Straight acceleration
      new THREE.Vector3(90, 4.5, -15),      // 2: 🔺 Tanjakan mendaki bukit
      new THREE.Vector3(125, 9.0, -50),     // 3: ⛰️ Tikungan puncak atas tebing (View indah)
      new THREE.Vector3(120, 12.5, -100),   // 4: ⛰️ Puncak tertinggi tambang (Plateau curve)
      new THREE.Vector3(80, 6.0, -145),     // 5: 🔻 Turunan curam meluncur cepat!
      new THREE.Vector3(30, 1.2, -155),     // 6: Lembah cekungan tambang (Quarry basin)
      new THREE.Vector3(-10, 3.0, -135),    // 7: ⚡ Tikungan S berliku (Chicane)
      new THREE.Vector3(-40, 7.5, -150),    // 8: 🔺 Mendaki bukit kedua
      new THREE.Vector3(-90, 11.0, -130),   // 9: 🔄 Hairpin tajam di atas tebing batu
      new THREE.Vector3(-118, 6.0, -85),    // 10: 🔻 Turunan meliuk menyapu ke bawah
      new THREE.Vector3(-98, 1.8, -40),     // 11: Masuk ngarai dasar tambang (Canyon floor)
      new THREE.Vector3(-55, 0.5, -12),     // 12: Melandai menuju trek lurus
      new THREE.Vector3(-25, 0.0, 0)        // 13: Garis lurus menuju finish
    ];

    this.curve = new THREE.CatmullRomCurve3(this.trackPoints, true);
    this.curve.curveType = 'centripetal';

    this.sampleCount = 360;
    this.trackSamples = [];

    const roadGeom = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= this.sampleCount; i++) {
      const t = i / this.sampleCount;
      const p = this.curve.getPointAt(t % 1.0);
      const tangent = this.curve.getTangentAt(t % 1.0).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const left = new THREE.Vector3().copy(p).addScaledVector(binormal, -this.halfW);
      const right = new THREE.Vector3().copy(p).addScaledVector(binormal, this.halfW);

      positions.push(left.x, left.y + 0.03, left.z);
      positions.push(right.x, right.y + 0.03, right.z);

      normals.push(0, 1, 0);
      normals.push(0, 1, 0);

      // 🌍 MULTI-TERRAIN SECTORS:
      // 1. Asphalt: t < 0.22 or t >= 0.80 (Dark slate: 0.18, 0.20, 0.25)
      // 2. Gravel / Batu Kerikil: 0.22 <= t < 0.40 (Rough quarry earth slate: 0.30, 0.28, 0.26)
      // 3. Sand Dunes: 0.40 <= t < 0.62 (Golden quarry sand: 0.86, 0.64, 0.38)
      // 4. Water Splash: 0.62 <= t < 0.80 (Dark submerged wet riverbed: 0.08, 0.12, 0.16)
      let r = 0.18, g = 0.20, b = 0.25;
      let isGravel = false;
      let isSand = false;
      let isWater = false;

      if (t >= 0.22 && t < 0.40) {
        // Gravel
        isGravel = true;
        r = 0.30; g = 0.28; b = 0.26;
      } else if (t >= 0.40 && t < 0.62) {
        // Sand
        isSand = true;
        r = 0.86; g = 0.64; b = 0.38;
      } else if (t >= 0.62 && t < 0.80) {
        // Water (submerged dark wet asphalt under the water ribbon)
        isWater = true;
        r = 0.08; g = 0.12; b = 0.16;
      }

      colors.push(r, g, b);
      colors.push(r, g, b);

      const u = t * 45;
      uvs.push(0, u);
      uvs.push(1, u);

      if (i < this.sampleCount) {
        const v = i * 2;
        indices.push(v, v + 1, v + 2);
        indices.push(v + 1, v + 3, v + 2);
      }

      if (i < this.sampleCount) {
        this.trackSamples.push({
          t,
          p,
          tangent,
          binormal,
          left,
          right,
          isGravel,
          isSand,
          isWater
        });
      }
    }

    roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    roadGeom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    roadGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeom.setIndex(indices);

    const roadMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.90,
      metalness: 0.10
    });

    this.roadMesh = new THREE.Mesh(roadGeom, roadMat);
    this.roadMesh.receiveShadow = true;
    this.scene.add(this.roadMesh);

    // Build Continuous Guardrails on Left & Right
    this.buildGuardrailBarriers();

    // Build Sand Dunes along the Sand Sector
    this.buildSandDunesAlongTrack();

    // Build Water & Gravel Zone Props
    this.buildGravelAndWaterZones();

    // Build Start / Finish Arch (PERFECTLY SPANNING ACROSS ROAD)
    this.buildFinishLineArch();

    // Checkpoints for lap tracking
    this.checkpoints = [
      { id: 0, pos: new THREE.Vector3(0, 0, 0), radius: 15, isFinish: true },
      { id: 1, pos: new THREE.Vector3(125, 9, -50), radius: 22 },
      { id: 2, pos: new THREE.Vector3(80, 6, -145), radius: 22 },
      { id: 3, pos: new THREE.Vector3(-10, 3, -135), radius: 22 },
      { id: 4, pos: new THREE.Vector3(-90, 11, -130), radius: 22 },
      { id: 5, pos: new THREE.Vector3(-55, 0.5, -12), radius: 20 }
    ];

    // Boost Pads
    this.boostPads = [
      { pos: new THREE.Vector3(45, 0.85, 0), radius: 5 },
      { pos: new THREE.Vector3(-100, 1.85, -40), radius: 5 }
    ];
    this.buildBoostPads();
  }

  // 1. PANAH ARAH DI ATAS ASPAL (ROAD DIRECTION CHEVRONS)
  buildDirectionArrowsOnRoad() {
    // Generate directional arrow canvas texture (Neon yellow chevrons pointing forward)
    const arrowCanvas = document.createElement('canvas');
    arrowCanvas.width = 128;
    arrowCanvas.height = 128;
    const actx = arrowCanvas.getContext('2d');

    // Draw glowing forward arrow
    actx.fillStyle = 'rgba(245, 158, 11, 0.95)';
    actx.beginPath();
    actx.moveTo(64, 15);
    actx.lineTo(110, 65);
    actx.lineTo(82, 65);
    actx.lineTo(82, 110);
    actx.lineTo(46, 110);
    actx.lineTo(46, 65);
    actx.lineTo(18, 65);
    actx.closePath();
    actx.fill();

    actx.strokeStyle = '#ffffff';
    actx.lineWidth = 4;
    actx.stroke();

    const arrowTex = new THREE.CanvasTexture(arrowCanvas);
    const arrowMat = new THREE.MeshBasicMaterial({
      map: arrowTex,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });

    const arrowGeom = new THREE.PlaneGeometry(3.5, 3.5);

    // Place arrows along the track every ~18 samples
    for (let i = 10; i < this.trackSamples.length; i += 18) {
      const sample = this.trackSamples[i];
      const arrowMesh = new THREE.Mesh(arrowGeom, arrowMat);

      arrowMesh.position.copy(sample.p);
      arrowMesh.position.y += 0.07;

      // Align plane with road slope and heading
      arrowMesh.rotation.x = -Math.PI / 2;
      const angle = Math.atan2(sample.tangent.x, sample.tangent.z);
      arrowMesh.rotation.z = -angle;

      this.scene.add(arrowMesh);
    }
  }

  // 2. PAPAN RAMBU PANAH TIKUNGAN 3D (TRACKSIDE CHEVRON SIGNS)
  buildTurnSigns() {
    const makeSignCanvas = (isRight) => {
      const cv = document.createElement('canvas');
      cv.width = 256;
      cv.height = 128;
      const ctx = cv.getContext('2d');

      // Yellow & black border
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(8, 8, 240, 112);

      // Large Chevrons
      ctx.fillStyle = '#f59e0b';
      const drawChevron = (x) => {
        ctx.beginPath();
        if (isRight) {
          ctx.moveTo(x - 20, 24);
          ctx.lineTo(x + 20, 64);
          ctx.lineTo(x - 20, 104);
          ctx.lineTo(x, 104);
          ctx.lineTo(x + 40, 64);
          ctx.lineTo(x, 24);
        } else {
          ctx.moveTo(x + 20, 24);
          ctx.lineTo(x - 20, 64);
          ctx.lineTo(x + 20, 104);
          ctx.lineTo(x, 104);
          ctx.lineTo(x - 40, 64);
          ctx.lineTo(x, 24);
        }
        ctx.closePath();
        ctx.fill();
      };

      drawChevron(60);
      drawChevron(128);
      drawChevron(196);

      return new THREE.CanvasTexture(cv);
    };

    const rightTex = makeSignCanvas(true);
    const leftTex = makeSignCanvas(false);

    const signMatR = new THREE.MeshStandardMaterial({ map: rightTex, roughness: 0.4 });
    const signMatL = new THREE.MeshStandardMaterial({ map: leftTex, roughness: 0.4 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });

    const boardGeom = new THREE.BoxGeometry(4.2, 2.1, 0.2);
    const postGeom = new THREE.CylinderGeometry(0.12, 0.12, 3.5, 8);

    // Key sharp turns to place signs
    const turnSpots = [
      { sampleIdx: 45, isRight: true },   // Turn 1
      { sampleIdx: 95, isRight: true },   // Ridge turn
      { sampleIdx: 135, isRight: false }, // Downhill sweep
      { sampleIdx: 195, isRight: false }, // Chicane
      { sampleIdx: 245, isRight: true },  // Hairpin
      { sampleIdx: 290, isRight: false }  // Canyon sweep
    ];

    turnSpots.forEach(ts => {
      const sample = this.trackSamples[ts.sampleIdx];
      const signGroup = new THREE.Group();

      const board = new THREE.Mesh(boardGeom, ts.isRight ? signMatR : signMatL);
      board.position.y = 2.4;
      board.castShadow = true;
      signGroup.add(board);

      const post1 = new THREE.Mesh(postGeom, postMat);
      post1.position.set(-1.4, 1.75, 0);
      signGroup.add(post1);

      const post2 = new THREE.Mesh(postGeom, postMat);
      post2.position.set(1.4, 1.75, 0);
      signGroup.add(post2);

      // Place along outer guardrail
      const offsetPos = ts.isRight ? sample.left : sample.right;
      signGroup.position.copy(offsetPos);
      signGroup.position.y = sample.p.y;

      // Face oncoming cars correctly! (+ Math.PI prevents back-face mirroring)
      const angle = Math.atan2(sample.tangent.x, sample.tangent.z);
      signGroup.rotation.y = angle + Math.PI + (ts.isRight ? -0.28 : 0.28);

      this.scene.add(signGroup);
    });
  }

  // 📢 Bangun Spanduk & Papan Reklame Pinggir Jalan dari CUSTOM_BILLBOARDS (Ukuran Raksasa & Tajam)
  buildCustomBillboards() {
    this.billboardMeshes = [];
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.85,
      roughness: 0.25
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.35
    });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.8
    });

    CUSTOM_BILLBOARDS.forEach(cfg => {
      const sample = this.trackSamples[cfg.sampleIdx];
      if (!sample) return;

      const group = new THREE.Group();
      const isLeft = cfg.side === 'left';

      // UKURAN PROPORSIONAL: Lebar 10.5m, Tinggi 4.8m
      const boardWidth = 10.5;
      const boardHeight = 4.8;

      // Jarak offset dihitung agar seluruh papan berdiri AMAN di luar guardrail (tidak pernah masuk jalur)
      const offsetDist = boardWidth / 2 + 1.8;
      const offsetPos = isLeft ? sample.left.clone().addScaledVector(sample.binormal, -offsetDist)
                               : sample.right.clone().addScaledVector(sample.binormal, offsetDist);

      group.position.copy(offsetPos);
      group.position.y = sample.p.y;

      // Putar papan reklame langsung menghadap mobil yang melaju (+ Math.PI)
      const trackAngle = Math.atan2(sample.tangent.x, sample.tangent.z);
      group.rotation.y = trackAngle + Math.PI + (isLeft ? 0.22 : -0.22);

      // 1. Tiang Baja Silinder
      const postGeom = new THREE.CylinderGeometry(0.24, 0.24, 5.8, 12);
      const postL = new THREE.Mesh(postGeom, postMat);
      postL.position.set(-3.8, 2.9, 0);
      postL.castShadow = true;
      group.add(postL);

      const postR = new THREE.Mesh(postGeom, postMat);
      postR.position.set(3.8, 2.9, 0);
      postR.castShadow = true;
      group.add(postR);

      // 2. Bingkai Luar Solid (Frame)
      const frameGeom = new THREE.BoxGeometry(boardWidth + 0.4, boardHeight + 0.4, 0.35);
      const frame = new THREE.Mesh(frameGeom, frameMat);
      frame.position.set(0, 4.8, 0);
      frame.castShadow = true;
      group.add(frame);

      // Lampu Sorot di Atas Reklame
      for (let lx of [-3.2, 3.2]) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.5), lampMat);
        lamp.position.set(lx, 4.8 + boardHeight / 2 + 0.2, 0.25);
        group.add(lamp);
      }

      // 3. Kanvas Proporsional (1600 x 720) - Tulisan Penuh Memenuhi Bidang & Sangat Rapi
      const cv = document.createElement('canvas');
      cv.width = 1600;
      cv.height = 720;
      const ctx = cv.getContext('2d');

      // Background
      ctx.fillStyle = cfg.bgColor || '#0f2b5c';
      ctx.fillRect(0, 0, 1600, 720);

      // Garis Aksen Balap Atas & Bawah
      ctx.fillStyle = cfg.accentColor || '#f59e0b';
      ctx.fillRect(0, 0, 1600, 26);
      ctx.fillRect(0, 694, 1600, 26);

      // Pola Kotak-kotak Balap di Tepi Kiri & Kanan
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      for (let y = 35; y < 680; y += 35) {
        ctx.fillRect(25, y, 20, 20);
        ctx.fillRect(1555, y, 20, 20);
      }

      // Badge Pill (Label Kategori di Sudut)
      if (cfg.badge) {
        ctx.fillStyle = cfg.accentColor || '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(65, 45, 300, 58, 12);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = '900 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cfg.badge, 215, 74);
      }

      // Shadow bayangan teks agar kontras & terbaca jelas
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 5;

      // JUDUL UTAMA BESAR & MEMENUHI BIDANG (Font 88px Bold)
      ctx.fillStyle = cfg.textColor || '#ffffff';
      ctx.font = '900 88px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.title, 800, 280);

      // SUBTEKS BESAR & PADAT (Font 48px)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = '700 48px sans-serif';
      ctx.fillText(cfg.subtitle, 800, 440);

      // Garis pemisah bawah aksen
      ctx.shadowBlur = 0;
      ctx.strokeStyle = cfg.accentColor || '#f59e0b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(300, 545);
      ctx.lineTo(1300, 545);
      ctx.stroke();

      const tex = new THREE.CanvasTexture(cv);
      // Muka depan (+Z) langsung menghadap pengemudi, tidak terbalik
      const boardMat = new THREE.MeshBasicMaterial({ map: tex });
      const boardMesh = new THREE.Mesh(
        new THREE.BoxGeometry(boardWidth, boardHeight, 0.2),
        [
          frameMat, // right
          frameMat, // left
          frameMat, // top
          frameMat, // bottom
          boardMat, // front (+Z)
          frameMat  // back (-Z)
        ]
      );
      boardMesh.position.set(0, 4.8, 0.2);
      group.add(boardMesh);

      this.scene.add(group);
      this.billboardMeshes.push(group);
    });
  }

  buildGuardrailBarriers() {
    const yellowHazardMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.3,
      roughness: 0.4
    });
    const blackMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.5,
      roughness: 0.6
    });

    const barrierGeom = new THREE.BoxGeometry(0.5, 1.1, 1.8);

    for (let i = 0; i < this.trackSamples.length; i += 2) {
      const sample = this.trackSamples[i];
      const mat = (Math.floor(i / 2) % 2 === 0) ? yellowHazardMat : blackMat;
      const angle = Math.atan2(sample.tangent.x, sample.tangent.z);

      // Left Guardrail
      const barL = new THREE.Mesh(barrierGeom, mat);
      barL.position.copy(sample.left);
      barL.position.y += 0.55;
      barL.rotation.y = angle;
      barL.castShadow = true;
      barL.receiveShadow = true;
      this.scene.add(barL);

      // Right Guardrail
      const barR = new THREE.Mesh(barrierGeom, mat);
      barR.position.copy(sample.right);
      barR.position.y += 0.55;
      barR.rotation.y = angle;
      barR.castShadow = true;
      barR.receiveShadow = true;
      this.scene.add(barR);
    }
  }

  buildSandDunesAlongTrack() {
    const duneMat = new THREE.MeshStandardMaterial({
      color: 0xdfa05d,
      roughness: 0.95,
      flatShading: true
    });
    const duneGeom = new THREE.ConeGeometry(5.2, 3.2, 7);

    // Place rolling sand dunes along the sand sector
    for (let i = 0; i < this.trackSamples.length; i += 5) {
      const sample = this.trackSamples[i];
      if (!sample.isSand) continue;

      // Left dune mound
      const dL = new THREE.Mesh(duneGeom, duneMat);
      dL.position.copy(sample.left).addScaledVector(sample.binormal, -3.2);
      dL.position.y += 0.8;
      dL.rotation.y = Math.random() * 3;
      dL.scale.set(1.0 + Math.random() * 0.5, 0.7 + Math.random() * 0.5, 1.0 + Math.random() * 0.5);
      dL.castShadow = true;
      dL.receiveShadow = true;
      this.scene.add(dL);

      // Right dune mound
      const dR = new THREE.Mesh(duneGeom, duneMat);
      dR.position.copy(sample.right).addScaledVector(sample.binormal, 3.2);
      dR.position.y += 0.8;
      dR.rotation.y = Math.random() * 3;
      dR.scale.set(1.0 + Math.random() * 0.5, 0.7 + Math.random() * 0.5, 1.0 + Math.random() * 0.5);
      dR.castShadow = true;
      dR.receiveShadow = true;
      this.scene.add(dR);
    }

    // 🏜️ Entry Arch for Sand Sector (around sample 135)
    const entrySample = this.trackSamples[135];
    if (entrySample) {
      const arch = new THREE.Group();
      const colGeom = new THREE.BoxGeometry(0.8, 7.5, 0.8);
      const mat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.4 });

      const pL = new THREE.Mesh(colGeom, mat);
      pL.position.copy(entrySample.left).addScaledVector(entrySample.binormal, -1.8);
      pL.position.y += 3.75;
      arch.add(pL);

      const pR = new THREE.Mesh(colGeom, mat);
      pR.position.copy(entrySample.right).addScaledVector(entrySample.binormal, 1.8);
      pR.position.y += 3.75;
      arch.add(pR);

      const cv = document.createElement('canvas');
      cv.width = 1024;
      cv.height = 180;
      const c = cv.getContext('2d');
      c.fillStyle = '#f59e0b';
      c.fillRect(0, 0, 1024, 180);
      c.fillStyle = '#0f172a';
      c.fillRect(12, 12, 1000, 156);
      c.fillStyle = '#f59e0b';
      c.font = '900 48px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('🏜️ ZONA PASIR - DUNE SECTOR ⚠️', 512, 90);

      const signTex = new THREE.CanvasTexture(cv);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex });
      const frameBeamMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });

      // Solid Box Beam - Muka depan (+Z) langsung menghadap mobil (+ Math.PI)
      const signBox = new THREE.Mesh(
        new THREE.BoxGeometry(this.trackWidth + 3.2, 2.2, 0.4),
        [
          frameBeamMat, // right
          frameBeamMat, // left
          frameBeamMat, // top
          frameBeamMat, // bottom
          signMat,      // Front (+Z)
          signMat       // Back (-Z)
        ]
      );
      signBox.position.copy(entrySample.p);
      signBox.position.y += 7.2;
      const angle = Math.atan2(entrySample.tangent.x, entrySample.tangent.z);
      signBox.rotation.y = angle + Math.PI; // Menghadap langsung mobil yang melaju!
      arch.add(signBox);

      this.scene.add(arch);
    }
  }

  generateGravelTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base crushed slate background
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, 0, 512, 512);

    // Multi-colored aggregate pebble speckles
    const stoneColors = [
      '#1f2937', '#111827', '#4b5563', '#6b7280', '#9ca3af',
      '#cbd5e1', '#e2e8f0', '#78350f', '#92400e', '#b45309'
    ];

    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const rad = 1.2 + Math.random() * 3.6;
      ctx.fillStyle = stoneColors[Math.floor(Math.random() * stoneColors.length)];
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();

      // Top-left highlight on pebble
      if (Math.random() > 0.45) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(x - rad * 0.4, y - rad * 0.4, rad * 0.6, rad * 0.6);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 18);
    return tex;
  }

  generateWaterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Deep vibrant royal ocean blue gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#1d4ed8');   // Cobalt blue
    grad.addColorStop(0.5, '#2563eb'); // Royal blue
    grad.addColorStop(1, '#1e3a8a');   // Deep ocean blue
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Dynamic wave caustic loops and foam ripples
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 75; i++) {
      ctx.beginPath();
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      const rx = 15 + Math.random() * 35;
      const ry = 8 + Math.random() * 18;
      ctx.ellipse(cx, cy, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }

    // White foam streaks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (let i = 0; i < 45; i++) {
      const fx = Math.random() * 512;
      const fy = Math.random() * 512;
      ctx.fillRect(fx, fy, 20 + Math.random() * 40, 2 + Math.random() * 3);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 14);
    return tex;
  }

  buildGravelAndWaterZones() {
    // ==========================================
    // 1. 🪨 GRAVEL RIDGE ZONE (Jalur Kerikil & Bebatuan)
    // ==========================================
    const gravelSamples = this.trackSamples.filter(s => s.isGravel);
    if (gravelSamples.length > 1) {
      const gGeom = new THREE.BufferGeometry();
      const gPos = [];
      const gUvs = [];
      const gIdxs = [];

      for (let i = 0; i < gravelSamples.length; i++) {
        const s = gravelSamples[i];
        const left = s.left.clone().addScaledVector(s.binormal, 0.1);
        const right = s.right.clone().addScaledVector(s.binormal, -0.1);
        const yElev = s.p.y + 0.05;

        gPos.push(left.x, yElev, left.z);
        gPos.push(right.x, yElev, right.z);

        const v = (i / (gravelSamples.length - 1)) * 18;
        gUvs.push(0, v);
        gUvs.push(1, v);

        if (i < gravelSamples.length - 1) {
          const b = i * 2;
          gIdxs.push(b, b + 1, b + 2);
          gIdxs.push(b + 1, b + 3, b + 2);
        }
      }

      gGeom.setAttribute('position', new THREE.Float32BufferAttribute(gPos, 3));
      gGeom.setAttribute('uv', new THREE.Float32BufferAttribute(gUvs, 2));
      gGeom.setIndex(gIdxs);
      gGeom.computeVertexNormals();

      this.gravelTexture = this.generateGravelTexture();
      const gMat = new THREE.MeshStandardMaterial({
        map: this.gravelTexture,
        roughness: 0.95,
        metalness: 0.15,
        side: THREE.DoubleSide
      });

      this.gravelMesh = new THREE.Mesh(gGeom, gMat);
      this.gravelMesh.receiveShadow = true;
      this.scene.add(this.gravelMesh);

      // Scatter 150+ 3D Rocks & Pebbles directly across the drivable track road!
      const rockColors = [0x64748b, 0x475569, 0x334155, 0x94a3b8, 0x78350f, 0x1e293b];
      const rockMats = rockColors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true }));
      const smallGeom = new THREE.DodecahedronGeometry(0.28, 0);
      const medGeom = new THREE.TetrahedronGeometry(0.48, 0);
      const boulderGeom = new THREE.DodecahedronGeometry(0.9, 0);

      for (let i = 0; i < gravelSamples.length; i += 2) {
        const s = gravelSamples[i];

        // 3-4 small/medium stones scattered across the full track width!
        for (let k = 0; k < 3; k++) {
          const isMed = Math.random() > 0.65;
          const rMesh = new THREE.Mesh(isMed ? medGeom : smallGeom, rockMats[Math.floor(Math.random() * rockMats.length)]);
          const lateral = (Math.random() - 0.5) * (this.trackWidth - 3.2);
          rMesh.position.copy(s.p).addScaledVector(s.binormal, lateral);
          rMesh.position.y += (isMed ? 0.22 : 0.12);
          rMesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
          const sc = 0.6 + Math.random() * 0.8;
          rMesh.scale.set(sc, sc * 0.7, sc);
          rMesh.castShadow = true;
          rMesh.receiveShadow = true;
          this.scene.add(rMesh);
        }

        // Occasional large boulder along edges/curbs
        if (i % 6 === 0) {
          const side = Math.random() > 0.5 ? -1 : 1;
          const bMesh = new THREE.Mesh(boulderGeom, rockMats[0]);
          bMesh.position.copy(s.p).addScaledVector(s.binormal, side * (this.halfW - 0.8));
          bMesh.position.y += 0.45;
          bMesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
          bMesh.scale.set(0.9 + Math.random() * 0.5, 0.7 + Math.random() * 0.5, 0.9 + Math.random() * 0.5);
          bMesh.castShadow = true;
          this.scene.add(bMesh);
        }
      }
    }

    const gravelEntry = this.trackSamples[80];
    if (gravelEntry) {
      this.createSectorArch(gravelEntry, '🪨 GRAVEL RIDGE - JALUR KERIKIL 🪨', '#38bdf8');
    }

    // ==========================================
    // 2. 🌊 WATER SPLASH ZONE (Genangan Air & Rawa Banjir)
    // ==========================================
    const waterSamples = this.trackSamples.filter(s => s.isWater);
    if (waterSamples.length > 1) {
      const wGeom = new THREE.BufferGeometry();
      const pos = [];
      const uvs = [];
      const idxs = [];

      for (let i = 0; i < waterSamples.length; i++) {
        const s = waterSamples[i];
        const left = s.left.clone().addScaledVector(s.binormal, 0.4);
        const right = s.right.clone().addScaledVector(s.binormal, -0.4);
        const yElev = s.p.y + 0.16;

        pos.push(left.x, yElev, left.z);
        pos.push(right.x, yElev, right.z);

        const v = (i / (waterSamples.length - 1)) * 14;
        uvs.push(0, v);
        uvs.push(1, v);

        if (i < waterSamples.length - 1) {
          const base = i * 2;
          idxs.push(base, base + 1, base + 2);
          idxs.push(base + 1, base + 3, base + 2);
        }
      }

      wGeom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      wGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      wGeom.setIndex(idxs);
      wGeom.computeVertexNormals();

      this.waterTexture = this.generateWaterTexture();
      const wMat = new THREE.MeshStandardMaterial({
        map: this.waterTexture,
        color: 0x2563eb,
        transparent: true,
        opacity: 0.88,
        roughness: 0.04,
        metalness: 0.80,
        side: THREE.DoubleSide
      });

      this.waterMesh = new THREE.Mesh(wGeom, wMat);
      this.waterMesh.receiveShadow = true;
      this.scene.add(this.waterMesh);

      // Foam strips along the banks of water
      const foamMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide
      });
      // Left foam bank
      const foamGeomL = new THREE.BufferGeometry();
      const fPosL = [];
      const fIdxL = [];
      for (let i = 0; i < waterSamples.length; i++) {
        const s = waterSamples[i];
        const outL = s.left.clone().addScaledVector(s.binormal, 0.1);
        const inL = s.left.clone().addScaledVector(s.binormal, 0.9);
        fPosL.push(outL.x, s.p.y + 0.17, outL.z);
        fPosL.push(inL.x, s.p.y + 0.17, inL.z);
        if (i < waterSamples.length - 1) {
          const b = i * 2;
          fIdxL.push(b, b + 1, b + 2);
          fIdxL.push(b + 1, b + 3, b + 2);
        }
      }
      foamGeomL.setAttribute('position', new THREE.Float32BufferAttribute(fPosL, 3));
      foamGeomL.setIndex(fIdxL);
      this.scene.add(new THREE.Mesh(foamGeomL, foamMat));

      // Right foam bank
      const foamGeomR = new THREE.BufferGeometry();
      const fPosR = [];
      const fIdxR = [];
      for (let i = 0; i < waterSamples.length; i++) {
        const s = waterSamples[i];
        const outR = s.right.clone().addScaledVector(s.binormal, -0.1);
        const inR = s.right.clone().addScaledVector(s.binormal, -0.9);
        fPosR.push(outR.x, s.p.y + 0.17, outR.z);
        fPosR.push(inR.x, s.p.y + 0.17, inR.z);
        if (i < waterSamples.length - 1) {
          const b = i * 2;
          fIdxR.push(b, b + 1, b + 2);
          fIdxR.push(b + 1, b + 3, b + 2);
        }
      }
      foamGeomR.setAttribute('position', new THREE.Float32BufferAttribute(fPosR, 3));
      foamGeomR.setIndex(fIdxR);
      this.scene.add(new THREE.Mesh(foamGeomR, foamMat));
    }

    const waterEntry = this.trackSamples[225];
    if (waterEntry) {
      this.createSectorArch(waterEntry, '🌊 WATER SPLASH - GENANGAN AIR 🌊', '#00f2fe');
    }
  }

  createSectorArch(sample, text, accentColor) {
    const arch = new THREE.Group();
    const colGeom = new THREE.BoxGeometry(0.8, 7.5, 0.8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });

    const pL = new THREE.Mesh(colGeom, mat);
    pL.position.copy(sample.left).addScaledVector(sample.binormal, -1.8);
    pL.position.y += 3.75;
    arch.add(pL);

    const pR = new THREE.Mesh(colGeom, mat);
    pR.position.copy(sample.right).addScaledVector(sample.binormal, 1.8);
    pR.position.y += 3.75;
    arch.add(pR);

    const cv = document.createElement('canvas');
    cv.width = 1024;
    cv.height = 180;
    const c = cv.getContext('2d');
    c.fillStyle = accentColor;
    c.fillRect(0, 0, 1024, 180);
    c.fillStyle = '#0f172a';
    c.fillRect(12, 12, 1000, 156);
    c.fillStyle = accentColor;
    c.font = '900 44px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 512, 90);

    const signTex = new THREE.CanvasTexture(cv);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const frameBeamMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });

    // Solid Box Beam - Muka depan (+Z) langsung menghadap mobil (+ Math.PI)
    const signBox = new THREE.Mesh(
      new THREE.BoxGeometry(this.trackWidth + 3.2, 2.2, 0.4),
      [
        frameBeamMat, // right
        frameBeamMat, // left
        frameBeamMat, // top
        frameBeamMat, // bottom
        signMat,      // Front (+Z)
        signMat       // Back (-Z)
      ]
    );
    signBox.position.copy(sample.p);
    signBox.position.y += 7.2;
    const angle = Math.atan2(sample.tangent.x, sample.tangent.z);
    signBox.rotation.y = angle + Math.PI; // Menghadap langsung mobil yang melaju!
    arch.add(signBox);

    this.scene.add(arch);
  }

  buildFinishLineArch() {
    const archGroup = new THREE.Group();

    const yellowSteelMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.5,
      roughness: 0.35
    });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.25
    });

    const pillarClearance = this.halfW + 2.5;

    // Left Pillar (Z = -10)
    const colGeom = new THREE.BoxGeometry(1.0, 8.5, 1.0);
    const pLeft = new THREE.Mesh(colGeom, yellowSteelMat);
    pLeft.position.set(0, 4.25, -pillarClearance);
    pLeft.castShadow = true;
    archGroup.add(pLeft);

    // Right Pillar (Z = +10)
    const pRight = new THREE.Mesh(colGeom, yellowSteelMat);
    pRight.position.set(0, 4.25, pillarClearance);
    pRight.castShadow = true;
    archGroup.add(pRight);

    // Top Beam
    const topGeom = new THREE.BoxGeometry(1.6, 1.6, pillarClearance * 2 + 2.0);
    const topBeam = new THREE.Mesh(topGeom, darkSteelMat);
    topBeam.position.set(0, 8.0, 0);
    topBeam.castShadow = true;
    archGroup.add(topBeam);

    // Front Sign
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 96;
    const sctx = signCanvas.getContext('2d');

    sctx.fillStyle = '#f59e0b';
    sctx.fillRect(0, 0, 512, 96);
    sctx.fillStyle = '#1e293b';
    for (let x = -96; x < 512 + 96; x += 40) {
      sctx.beginPath();
      sctx.moveTo(x, 0);
      sctx.lineTo(x + 24, 0);
      sctx.lineTo(x - 16, 96);
      sctx.lineTo(x - 40, 96);
      sctx.fill();
    }

    sctx.fillStyle = '#0f172a';
    sctx.fillRect(35, 14, 442, 68);
    sctx.fillStyle = '#ffcc00';
    sctx.font = '900 28px sans-serif';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText('🚜 MINING RALLY - FINISH 🏁', 256, 48);

    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(pillarClearance * 2 - 2, 1.5), signMat);
    signMesh.rotation.y = -Math.PI / 2;
    signMesh.position.set(-0.85, 8.0, 0);
    archGroup.add(signMesh);

    // Checkerboard line on the ground
    const checkCanvas = document.createElement('canvas');
    checkCanvas.width = 128;
    checkCanvas.height = 32;
    const cctx = checkCanvas.getContext('2d');
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 8; c++) {
        cctx.fillStyle = (r + c) % 2 === 0 ? '#f59e0b' : '#111111';
        cctx.fillRect(c * 16, r * 16, 16, 16);
      }
    }
    const checkTex = new THREE.CanvasTexture(checkCanvas);
    const groundCheck = new THREE.Mesh(
      new THREE.PlaneGeometry(this.trackWidth, 3.0),
      new THREE.MeshStandardMaterial({ map: checkTex, roughness: 0.8 })
    );
    groundCheck.rotation.x = -Math.PI / 2;
    groundCheck.position.set(0, 0.05, 0);
    archGroup.add(groundCheck);

    this.scene.add(archGroup);
  }

  buildBoostPads() {
    this.boostMeshes = [];
    for (let bp of this.boostPads) {
      const padGroup = new THREE.Group();
      padGroup.position.copy(bp.pos);

      const padMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 4),
        new THREE.MeshBasicMaterial({ color: 0x00f2fe, side: THREE.DoubleSide })
      );
      padMesh.rotation.x = -Math.PI / 2;
      padGroup.add(padMesh);

      this.scene.add(padGroup);
      this.boostMeshes.push(padMesh);
    }
  }

  buildMiningEnvironment() {
    const groundGeom = new THREE.PlaneGeometry(700, 700, 48, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xc98748,
      roughness: 0.95,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const rockMat = new THREE.MeshStandardMaterial({ color: 0xa46838, roughness: 0.9, flatShading: true });
    const darkRockMat = new THREE.MeshStandardMaterial({ color: 0x824e26, roughness: 0.95, flatShading: true });

    const envGroup = new THREE.Group();

    for (let i = 0; i < 75; i++) {
      const rx = (Math.random() - 0.5) * 440;
      const rz = (Math.random() - 0.5) * 440;
      if (this.isNearTrack(rx, rz, 22)) continue;

      const rockRadius = 3.5 + Math.random() * 8.5;
      const rockGeom = new THREE.DodecahedronGeometry(rockRadius, 1);
      const rock = new THREE.Mesh(rockGeom, Math.random() > 0.5 ? rockMat : darkRockMat);
      rock.position.set(rx, rockRadius * 0.45, rz);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      envGroup.add(rock);
    }

    const cranePositions = [
      { x: 55, z: -70 },
      { x: -50, z: -85 },
      { x: -75, z: 45 }
    ];
    cranePositions.forEach(cp => {
      const crane = this.createMiningCrane();
      crane.position.set(cp.x, 0, cp.z);
      envGroup.add(crane);
    });

    const truckPositions = [
      { x: 35, z: -25, rot: 0.8 },
      { x: 105, z: -75, rot: -1.2 },
      { x: -65, z: -170, rot: 2.1 },
      { x: -135, z: -60, rot: -0.4 }
    ];
    truckPositions.forEach(tp => {
      const truck = this.createMiningDumpTruck();
      truck.position.set(tp.x, 0, tp.z);
      truck.rotation.y = tp.rot;
      envGroup.add(truck);
    });

    this.scene.add(envGroup);
  }

  createMiningCrane() {
    const craneGroup = new THREE.Group();
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });

    const mast = new THREE.Mesh(new THREE.BoxGeometry(2.2, 42, 2.2), yellowMat);
    mast.position.y = 21;
    mast.castShadow = true;
    craneGroup.add(mast);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.5, 4), darkMat);
    cab.position.set(1.5, 39, 0);
    cab.castShadow = true;
    craneGroup.add(cab);

    const boom = new THREE.Mesh(new THREE.BoxGeometry(50, 1.8, 1.8), yellowMat);
    boom.position.set(17, 41.5, 0);
    boom.castShadow = true;
    craneGroup.add(boom);

    const cw = new THREE.Mesh(new THREE.BoxGeometry(6.5, 4.5, 3.2), darkMat);
    cw.position.set(-8.5, 41.5, 0);
    cw.castShadow = true;
    craneGroup.add(cw);

    return craneGroup;
  }

  createMiningDumpTruck() {
    const truck = new THREE.Group();
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.3, roughness: 0.5 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.5, 12), darkMat);
    chassis.position.y = 3.5;
    chassis.castShadow = true;
    truck.add(chassis);

    const bed = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.2, 9), yellowMat);
    bed.position.set(0, 6.2, -1.5);
    bed.castShadow = true;
    truck.add(bed);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 3.5), yellowMat);
    cab.position.set(-1.8, 6.2, 4.2);
    cab.castShadow = true;
    truck.add(cab);

    const tireGeom = new THREE.CylinderGeometry(2.4, 2.4, 1.8, 16);
    const addTire = (x, z) => {
      const t = new THREE.Mesh(tireGeom, tireMat);
      t.rotation.z = Math.PI / 2;
      t.position.set(x, 2.4, z);
      t.castShadow = true;
      truck.add(t);
    };
    addTire(-3.8, 4);
    addTire(3.8, 4);
    addTire(-3.8, -3.5);
    addTire(3.8, -3.5);

    truck.scale.set(0.9, 0.9, 0.9);
    return truck;
  }

  isNearTrack(x, z, minDist) {
    const p = new THREE.Vector3(x, 0, z);
    for (let sample of this.trackSamples) {
      if (Math.hypot(p.x - sample.p.x, p.z - sample.p.z) < minDist) return true;
    }
    return false;
  }

  getClosestTrackSample(pos) {
    let closest = this.trackSamples[0];
    let minDistSq = Infinity;
    for (let i = 0; i < this.trackSamples.length; i++) {
      const s = this.trackSamples[i];
      const dSq = (pos.x - s.p.x) ** 2 + (pos.z - s.p.z) ** 2;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        closest = s;
      }
    }
    return closest;
  }

  createCarMesh(colorHex, playerName, isLocal = false) {
    const carRoot = new THREE.Group();

    const bodyColor = new THREE.Color(colorHex);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.32,
      metalness: 0.68
    });

    const bodyGroup = new THREE.Group();

    // Lower Chassis
    const lowerGeom = new THREE.BoxGeometry(2.1, 0.45, 4.4);
    const lowerBody = new THREE.Mesh(lowerGeom, bodyMat);
    lowerBody.position.y = 0.45;
    lowerBody.castShadow = true;
    bodyGroup.add(lowerBody);

    // Cockpit
    const cabinGeom = new THREE.BoxGeometry(1.6, 0.48, 2.2);
    const cabin = new THREE.Mesh(cabinGeom, bodyMat);
    cabin.position.set(0, 0.85, -0.2);
    cabin.castShadow = true;
    bodyGroup.add(cabin);

    // Windshield
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.1,
      metalness: 0.9
    });
    const windGeom = new THREE.BoxGeometry(1.5, 0.42, 1.1);
    const windshield = new THREE.Mesh(windGeom, glassMat);
    windshield.position.set(0, 0.86, 0.6);
    bodyGroup.add(windshield);

    // Rear GT Wing
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const wingGeom = new THREE.BoxGeometry(2.2, 0.08, 0.6);
    const wing = new THREE.Mesh(wingGeom, wingMat);
    wing.position.set(0, 1.25, -2.0);
    wing.castShadow = true;
    bodyGroup.add(wing);

    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), wingMat);
    postL.position.set(-0.7, 1.0, -2.0);
    bodyGroup.add(postL);

    const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), wingMat);
    postR.position.set(0.7, 1.0, -2.0);
    bodyGroup.add(postR);

    // Headlights
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), headlightMat);
    hlL.position.set(-0.75, 0.45, 2.21);
    bodyGroup.add(hlL);
    const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), headlightMat);
    hlR.position.set(0.75, 0.45, 2.21);
    bodyGroup.add(hlR);

    // Taillights
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.1), tailMat);
    tlL.position.set(-0.75, 0.48, -2.21);
    bodyGroup.add(tlL);
    const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.1), tailMat);
    tlR.position.set(0.75, 0.48, -2.21);
    bodyGroup.add(tlR);

    // Exhaust Nitro Flames
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const flameGeom = new THREE.ConeGeometry(0.18, 0.8, 8);
    const flameL = new THREE.Mesh(flameGeom, flameMat);
    flameL.rotation.x = -Math.PI / 2;
    flameL.position.set(-0.45, 0.35, -2.5);
    flameL.visible = false;
    bodyGroup.add(flameL);

    const flameR = new THREE.Mesh(flameGeom, flameMat);
    flameR.rotation.x = -Math.PI / 2;
    flameR.position.set(0.45, 0.35, -2.5);
    flameR.visible = false;
    bodyGroup.add(flameR);

    carRoot.add(bodyGroup);

    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.30, 14);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const rimGeom = new THREE.CylinderGeometry(0.25, 0.25, 0.32, 8);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 });

    const createWheel = () => {
      const wGroup = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeom, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wGroup.add(tire);
      const rim = new THREE.Mesh(rimGeom, rimMat);
      rim.rotation.z = Math.PI / 2;
      wGroup.add(rim);
      return wGroup;
    };

    const frontLeftWheel = createWheel();
    frontLeftWheel.position.set(-1.12, 0.38, 1.3);
    carRoot.add(frontLeftWheel);

    const frontRightWheel = createWheel();
    frontRightWheel.position.set(1.12, 0.38, 1.3);
    carRoot.add(frontRightWheel);

    const rearLeftWheel = createWheel();
    rearLeftWheel.position.set(-1.12, 0.38, -1.3);
    carRoot.add(rearLeftWheel);

    const rearRightWheel = createWheel();
    rearRightWheel.position.set(1.12, 0.38, -1.3);
    carRoot.add(rearRightWheel);

    // Billboard only for REMOTE players
    let sprite = null;
    if (!isLocal) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      this.roundRectCanvas(ctx, 10, 10, 236, 44, 12);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(playerName, 128, 32);

      const tagTex = new THREE.CanvasTexture(canvas);
      const tagMat = new THREE.SpriteMaterial({ map: tagTex });
      sprite = new THREE.Sprite(tagMat);
      sprite.position.set(0, 2.6, 0);
      sprite.scale.set(3.2, 0.8, 1);
      carRoot.add(sprite);
    }

    return {
      root: carRoot,
      bodyGroup,
      wheels: [frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel],
      frontWheels: [frontLeftWheel, frontRightWheel],
      flames: [flameL, flameR],
      sprite
    };
  }

  roundRectCanvas(ctx, x, y, w, h, r) {
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

  buildLocalCar() {
    const playerArr = Object.keys(this.roomInfo.players);
    const myIndex = playerArr.indexOf(this.selfId);

    const gridPositions = [
      { x: -10, y: 0.0, z: -3.0 },
      { x: -10, y: 0.0, z: 3.0 },
      { x: -18, y: 0.0, z: -3.0 },
      { x: -18, y: 0.0, z: 3.0 },
      { x: -26, y: 0.0, z: -3.0 },
      { x: -26, y: 0.0, z: 3.0 }
    ];
    const pos = gridPositions[myIndex >= 0 ? myIndex % gridPositions.length : 0];

    const myColor = this.roomInfo.players[this.selfId]?.color || '#ff3366';
    const myName = this.roomInfo.players[this.selfId]?.name || 'Pembalap';

    this.carObj = this.createCarMesh(myColor, myName, true);
    this.scene.add(this.carObj.root);

    this.carState = {
      pos: new THREE.Vector3(pos.x, pos.y, pos.z),
      angle: Math.PI / 2,
      pitch: 0,
      speed: 0,
      steerAngle: 0,
      steerInput: 0,
      nitro: 100,
      isBoosting: false,
      lap: 1,
      passedCheckpoints: new Set([0])
    };

    this.carObj.root.position.copy(this.carState.pos);
    this.carObj.root.rotation.y = this.carState.angle;
  }

  buildHUD() {
    this.hudContainer = document.createElement('div');
    this.hudContainer.id = 'hud3D';
    this.hudContainer.innerHTML = `
      <style>
        #hud3D {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 12px;
          z-index: 10;
          pointer-events: none;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .hud-left {
          display: flex;
          gap: 10px;
        }
        .hud-card {
          background: rgba(15, 23, 42, 0.88);
          backdrop-filter: blur(8px);
          border: 1px solid #f59e0b;
          border-radius: 12px;
          padding: 8px 16px;
          color: #fff;
          font-family: inherit;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.35);
        }
        .hud-title { font-size: 11px; font-weight: 800; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px; }
        .hud-val { font-size: 24px; font-weight: 900; color: #ffffff; }
        .nitro-bar-wrap {
          width: 85px;
          height: 8px;
          background: #334155;
          border-radius: 4px;
          margin-top: 6px;
          overflow: hidden;
        }
        .nitro-fill {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, #f59e0b, #00f2fe);
          transition: width 0.1s linear;
        }
        /* 📱 CLEAN & SLEEK MOBILE OVERRIDES */
        @media (max-width: 768px) {
          #hud3D {
            top: 8px;
            left: 8px;
            right: 8px;
          }
          .hud-left {
            background: rgba(15, 23, 42, 0.88);
            backdrop-filter: blur(8px);
            border: 1px solid #f59e0b;
            border-radius: 20px;
            padding: 6px 14px;
            gap: 12px;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          }
          .hud-card {
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
            display: flex;
            align-items: center;
            gap: 5px;
          }
          .hud-title {
            font-size: 11px !important;
            font-weight: 700 !important;
          }
          .hud-title .hint-key {
            display: none !important;
          }
          .hud-val {
            font-size: 15px !important;
            font-weight: 900 !important;
          }
          .nitro-bar-wrap {
            width: 48px !important;
            height: 7px !important;
            margin-top: 0 !important;
          }
          .minimap-wrap {
            padding: 4px !important;
            border-radius: 10px !important;
          }
          #minimapCanvas {
            width: 65px !important;
            height: 65px !important;
          }
        }
        #countdown3D {
          position: absolute;
          top: 45%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 110px;
          font-weight: 900;
          color: #f59e0b;
          text-shadow: 0 0 30px rgba(245, 158, 11, 0.8), 0 0 10px #000;
          pointer-events: none;
          z-index: 20;
        }
        /* 🗺️ MINIMAP HUD */
        .minimap-wrap {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(8px);
          border: 2px solid #f59e0b;
          border-radius: 14px;
          padding: 6px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
        }
        #minimapCanvas {
          display: block;
          border-radius: 8px;
        }
        /* ⚠️ WRONG WAY WARNING */
        #wrongWayAlert {
          display: none;
          position: absolute;
          top: 38%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(220, 38, 38, 0.92);
          border: 3px solid #ffffff;
          border-radius: 16px;
          padding: 16px 32px;
          color: #ffffff;
          font-weight: 900;
          font-size: 24px;
          text-align: center;
          box-shadow: 0 0 30px rgba(239, 68, 68, 0.9);
          animation: pulseAlert 0.4s infinite alternate;
          z-index: 30;
        }
        @keyframes pulseAlert {
          from { transform: translate(-50%, -50%) scale(0.95); opacity: 0.9; }
          to { transform: translate(-50%, -50%) scale(1.05); opacity: 1.0; }
        }
        /* 🎥 CAMERA CONTROLS BAR */
        .cam-controls-bar {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
          z-index: 25;
          pointer-events: auto;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(8px);
          padding: 4px 8px;
          border-radius: 12px;
          border: 1px solid rgba(245, 158, 11, 0.4);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
        }
        .cam-btn {
          background: rgba(30, 41, 59, 0.85);
          border: 1px solid rgba(245, 158, 11, 0.5);
          color: #f8fafc;
          font-weight: 700;
          font-size: 12px;
          padding: 6px 11px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
          -webkit-user-select: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .cam-btn:hover, .cam-btn:active {
          background: rgba(245, 158, 11, 0.3);
          border-color: #f59e0b;
          transform: scale(0.96);
        }
        .cam-btn.active {
          background: #f59e0b;
          color: #0f172a;
          font-weight: 800;
        }
        @media (max-width: 768px) {
          .cam-controls-bar {
            bottom: unset;
            top: 76px;
            right: 8px;
            left: unset;
            transform: none;
            flex-direction: column;
            gap: 4px;
            padding: 4px;
            border-radius: 10px;
          }
          .cam-btn {
            padding: 5px 8px;
            font-size: 10px;
            border-radius: 6px;
            min-width: 48px;
          }
          .cam-mode-btn {
            font-size: 9px;
            padding: 4px 6px;
          }
        }
      </style>
      <div class="hud-left">
        <div class="hud-card">
          <div class="hud-title">🏁 <span class="hud-lbl">Lap</span></div>
          <div class="hud-val" id="hudLap">1 / 3</div>
        </div>
        <div class="hud-card">
          <div class="hud-title">⚡</div>
          <div class="hud-val" id="hudSpeed">0 <span style="font-size: 11px; color: #94a3b8;">KM/H</span></div>
        </div>
        <div class="hud-card" id="hudTerrainCard">
          <div class="hud-title">🌍 MEDAN</div>
          <div class="hud-val" id="hudTerrain" style="font-size: 13px !important; color: #00ff88;">🏁 ASPAL</div>
        </div>
        <div class="hud-card">
          <div class="hud-title">🔥 <span class="hint-key">Nitro [Shift / Spasi]</span></div>
          <div class="nitro-bar-wrap"><div class="nitro-fill" id="hudNitro"></div></div>
        </div>
      </div>
      <div class="minimap-wrap">
        <canvas id="minimapCanvas" width="130" height="130"></canvas>
      </div>
      <div class="cam-controls-bar">
        <button id="camLookLeftBtn" class="cam-btn" title="Intip Kiri / Papan Reklame (Tahan Q)">◀ 👁️</button>
        <button id="camModeBtn" class="cam-btn cam-mode-btn" title="Ganti Mode Kamera (C)">🎥 CHASE</button>
        <button id="camLookRightBtn" class="cam-btn" title="Intip Kanan / Papan Reklame (Tahan E)">👁️ ▶</button>
        <button id="camResetBtn" class="cam-btn" title="Reset Kamera">🔄</button>
      </div>
      <div id="countdown3D">3</div>
      <div id="wrongWayAlert">⚠️ SALAH ARAH! PUTAR BALIK 🔄</div>
      <canvas id="screenDropsCanvas" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 12;"></canvas>
    `;
    this.container.appendChild(this.hudContainer);

    this.hudLapEl = document.getElementById('hudLap');
    this.hudSpeedEl = document.getElementById('hudSpeed');
    this.hudTerrainEl = document.getElementById('hudTerrain');
    this.hudNitroEl = document.getElementById('hudNitro');
    this.countdownEl = document.getElementById('countdown3D');
    this.wrongWayEl = document.getElementById('wrongWayAlert');

    // Setup Screen Water Drops Canvas
    this.screenDropsCanvas = document.getElementById('screenDropsCanvas');
    if (this.screenDropsCanvas) {
      this.screenDropsCtx = this.screenDropsCanvas.getContext('2d');
    }

    // Setup Minimap
    this.minimapCanvas = document.getElementById('minimapCanvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    // Setup Camera Controls
    this.camModeBtn = document.getElementById('camModeBtn');
    this.camLookLeftBtn = document.getElementById('camLookLeftBtn');
    this.camLookRightBtn = document.getElementById('camLookRightBtn');
    this.camResetBtn = document.getElementById('camResetBtn');

    if (this.camModeBtn) {
      this.camModeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cycleCameraMode();
      });
    }
    if (this.camResetBtn) {
      this.camResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resetCamera();
      });
    }

    const setupPeekBtn = (btn, yawAngle) => {
      if (!btn) return;
      const start = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.targetCameraYaw = yawAngle;
        btn.classList.add('active');
      };
      const end = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.targetCameraYaw === yawAngle) {
          this.targetCameraYaw = 0;
        }
        btn.classList.remove('active');
      };
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', end);
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('touchcancel', end, { passive: false });
    };

    setupPeekBtn(this.camLookLeftBtn, Math.PI * 0.42);
    setupPeekBtn(this.camLookRightBtn, -Math.PI * 0.42);
  }

  cycleCameraMode() {
    this.cameraMode = (this.cameraMode + 1) % this.cameraModeNames.length;
    if (this.camModeBtn) {
      this.camModeBtn.textContent = `🎥 ${this.cameraModeNames[this.cameraMode]}`;
    }
  }

  resetCamera() {
    this.targetCameraYaw = 0;
    this.manualCameraYaw = 0;
    this.manualCameraPitch = 0;
    this.isDraggingCamera = false;
    this.cameraTouchId = null;
  }

  // Render Real-Time Minimap Radar
  drawMinimap() {
    if (!this.minimapCtx) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Dark semi-transparent background
    ctx.fillStyle = '#0b1322';
    ctx.fillRect(0, 0, w, h);

    // Track bounds mapping: Track X is [-130, 140], Z is [-170, 20]
    const mapX = (x) => 15 + ((x + 130) / 270) * (w - 30);
    const mapZ = (z) => 15 + ((z + 170) / 190) * (h - 30);

    // Draw Track Path
    ctx.beginPath();
    const pts = this.trackPoints;
    ctx.moveTo(mapX(pts[0].x), mapZ(pts[0].z));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(mapX(pts[i].x), mapZ(pts[i].z));
    }
    ctx.closePath();

    ctx.lineWidth = 6;
    ctx.strokeStyle = '#334155';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    // Start / Finish Line Icon
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(mapX(0) - 3, mapZ(0) - 3, 6, 6);

    // Draw Remote Players
    for (let id in this.remotePlayers) {
      const rp = this.remotePlayers[id];
      ctx.fillStyle = '#00d2ff';
      ctx.beginPath();
      ctx.arc(mapX(rp.root.position.x), mapZ(rp.root.position.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Local Car (Pulsing Red/Orange dot with Direction Pointer)
    const myX = mapX(this.carState.pos.x);
    const myZ = mapZ(this.carState.pos.z);

    ctx.fillStyle = '#ff3366';
    ctx.beginPath();
    ctx.arc(myX, myZ, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Small heading pointer
    const forwardX = Math.sin(this.carState.angle);
    const forwardZ = Math.cos(this.carState.angle);
    ctx.beginPath();
    ctx.moveTo(myX, myZ);
    ctx.lineTo(myX + forwardX * 7, myZ + forwardZ * 7);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  bindInputs() {
    this.keyDownHandler = (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = true;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = true;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = true;
      if (['ShiftLeft', 'ShiftRight', 'Space'].includes(e.code)) this.keys.nitro = true;

      // 🎥 Shortcut Kamera & Intip Papan Reklame
      if (e.code === 'KeyQ') this.targetCameraYaw = Math.PI * 0.42; // Intip Kiri
      if (e.code === 'KeyE') this.targetCameraYaw = -Math.PI * 0.42; // Intip Kanan
      if (e.code === 'KeyR') this.targetCameraYaw = Math.PI; // Kaca Spion / Belakang
      if (e.code === 'KeyC') this.cycleCameraMode(); // Ganti Mode Kamera
    };

    this.keyUpHandler = (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = false;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = false;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = false;
      if (['ShiftLeft', 'ShiftRight', 'Space'].includes(e.code)) this.keys.nitro = false;

      // Lepas tombol intip -> kamera kembali ke depan dengan halus
      if (e.code === 'KeyQ' && this.targetCameraYaw === Math.PI * 0.42) this.targetCameraYaw = 0;
      if (e.code === 'KeyE' && this.targetCameraYaw === -Math.PI * 0.42) this.targetCameraYaw = 0;
      if (e.code === 'KeyR' && this.targetCameraYaw === Math.PI) this.targetCameraYaw = 0;
    };

    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);

    // 🖱️ Mouse Drag Orbit (PC: Klik & Geser untuk memutar kamera 360°)
    this.onMouseDown = (e) => {
      if (e.target.closest('#mobileControls, .touch-btn, .cam-btn, .hud-card, .minimap-wrap, button, a')) return;
      this.isDraggingCamera = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    };

    this.onMouseMove = (e) => {
      if (!this.isDraggingCamera) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.manualCameraYaw -= dx * 0.007;
      this.manualCameraPitch = Math.max(-0.35, Math.min(0.65, this.manualCameraPitch + dy * 0.005));
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.lastDragTime = Date.now();
    };

    this.onMouseUp = () => {
      if (this.isDraggingCamera) {
        this.isDraggingCamera = false;
        this.lastDragTime = Date.now();
      }
    };

    // 📱 Touch Swipe Orbit (Mobile: Usap layar di luar tombol untuk melihat pemandangan / papan)
    this.onTouchStart = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el && el.closest('#mobileControls, .touch-btn, .cam-btn, .hud-card, .minimap-wrap, button, a')) {
          continue;
        }
        if (this.cameraTouchId === null) {
          this.cameraTouchId = t.identifier;
          this.lastPointerX = t.clientX;
          this.lastPointerY = t.clientY;
          this.isDraggingCamera = true;
          break;
        }
      }
    };

    this.onTouchMove = (e) => {
      if (!this.isDraggingCamera || this.cameraTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.cameraTouchId) {
          const dx = t.clientX - this.lastPointerX;
          const dy = t.clientY - this.lastPointerY;
          this.manualCameraYaw -= dx * 0.009;
          this.manualCameraPitch = Math.max(-0.35, Math.min(0.65, this.manualCameraPitch + dy * 0.007));
          this.lastPointerX = t.clientX;
          this.lastPointerY = t.clientY;
          this.lastDragTime = Date.now();
          break;
        }
      }
    };

    this.onTouchEnd = (e) => {
      if (this.cameraTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.cameraTouchId) {
          this.cameraTouchId = null;
          this.isDraggingCamera = false;
          this.lastDragTime = Date.now();
          break;
        }
      }
    };

    this.container.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);

    this.container.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
  }

  bindSocketEvents() {
    this.playerUpdateHandler = ({ id, state }) => {
      if (id === this.selfId) return;

      if (!this.remotePlayers[id]) {
        const rColor = state.color || '#00d2ff';
        const rName = state.name || 'Rival';
        const newCar = this.createCarMesh(rColor, rName, false);
        this.scene.add(newCar.root);

        this.remotePlayers[id] = {
          ...newCar,
          targetPos: new THREE.Vector3(state.x, state.y || 0, state.z),
          targetRotY: state.rotY || 0,
          targetRotX: state.rotX || 0,
          speed: state.speed || 0,
          isBoosting: state.isBoosting || false
        };
      }

      const rp = this.remotePlayers[id];
      rp.targetPos.set(state.x, state.y || 0, state.z);
      rp.targetRotY = state.rotY;
      rp.targetRotX = state.rotX || 0;
      rp.speed = state.speed;
      rp.isBoosting = state.isBoosting;

      rp.flames.forEach(f => f.visible = !!state.isBoosting);
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
        this.countdownEl.textContent = this.countdown.toString();
        if (window.soundManager) window.soundManager.countdownBeep(false);
      } else if (this.countdown === 0) {
        this.countdownEl.textContent = 'GO! 🚜';
        this.countdownEl.style.color = '#00ff88';
        if (window.soundManager) window.soundManager.countdownBeep(true);
        this.raceStarted = true;
        this.startTime = Date.now();
      } else {
        clearInterval(interval);
        this.countdownEl.style.display = 'none';
      }
    }, 1000);

    // Sync broadcast timer: ~30 times / sec
    this.syncInterval = setInterval(() => {
      if (!this.active) return;
      this.socket.emit('racing:update', {
        x: Number(this.carState.pos.x.toFixed(2)),
        y: Number(this.carState.pos.y.toFixed(2)),
        z: Number(this.carState.pos.z.toFixed(2)),
        rotY: Number(this.carState.angle.toFixed(3)),
        rotX: Number(this.carState.pitch.toFixed(3)),
        speed: Number(this.carState.speed.toFixed(3)),
        isBoosting: this.carState.isBoosting,
        color: this.roomInfo.players[this.selfId]?.color,
        name: this.roomInfo.players[this.selfId]?.name,
        lap: this.carState.lap
      });
    }, 33);

    this.loop();
  }

  // 💥 Percikan Api Benturan Mobil & Guardrail (Collision Sparks)
  spawnSparks(x, y, z, nx = 0, nz = 0, count = 10) {
    if (this.sparkParticles.length > 70) return;
    const geom = new THREE.SphereGeometry(0.12, 4, 4);
    for (let i = 0; i < count; i++) {
      const color = Math.random() > 0.35 ? 0xffcc00 : 0xff3b00;
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.4,
        y + (Math.random() - 0.5) * 0.25,
        z + (Math.random() - 0.5) * 0.4
      );
      this.scene.add(mesh);

      const speed = 0.22 + Math.random() * 0.45;
      const angle = Math.random() * Math.PI * 2;
      this.sparkParticles.push({
        mesh,
        vx: (nx * 0.5 + Math.cos(angle) * 0.5) * speed,
        vy: 0.12 + Math.random() * 0.32,
        vz: (nz * 0.5 + Math.sin(angle) * 0.5) * speed,
        life: 1.0
      });
    }
  }

  // 💥 Tabrakan Fisik Antar Mobil (Benturan Nyata, Terpental & Tidak Tembus)
  checkCarCollisions() {
    const s = this.carState;
    const fAx = Math.sin(s.angle);
    const fAz = Math.cos(s.angle);

    // Titik bounding capsule mobil lokal (Depan & Belakang)
    const cL1 = { x: s.pos.x + fAx * 1.15, z: s.pos.z + fAz * 1.15 };
    const cL2 = { x: s.pos.x - fAx * 1.15, z: s.pos.z - fAz * 1.15 };
    const localCircles = [cL1, cL2];
    const minDist = 2.25; // Jarak minimal aman antar bodi mobil

    for (let id in this.remotePlayers) {
      const rp = this.remotePlayers[id];
      if (!rp || !rp.root) continue;

      const rPos = rp.root.position;
      const distToCenter = Math.hypot(s.pos.x - rPos.x, s.pos.z - rPos.z);
      if (distToCenter > 6.0) continue; // Di luar jangkauan tabrakan

      const rRotY = rp.root.rotation.y;
      const fRx = Math.sin(rRotY);
      const fRz = Math.cos(rRotY);
      const cR1 = { x: rPos.x + fRx * 1.15, z: rPos.z + fRz * 1.15 };
      const cR2 = { x: rPos.x - fRx * 1.15, z: rPos.z - fRz * 1.15 };
      const remoteCircles = [cR1, cR2];

      let maxOverlap = 0;
      let bestPair = null;

      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const dx = localCircles[i].x - remoteCircles[j].x;
          const dz = localCircles[i].z - remoteCircles[j].z;
          const d = Math.hypot(dx, dz);
          if (d < minDist) {
            const overlap = minDist - d;
            if (overlap > maxOverlap) {
              maxOverlap = overlap;
              bestPair = { i, j, dx, dz, dist: Math.max(0.001, d) };
            }
          }
        }
      }

      if (bestPair) {
        const nx = bestPair.dx / bestPair.dist; // Normal tabrakan mengarah ke mobil lokal
        const nz = bestPair.dz / bestPair.dist;

        // 1. PISAHKAN POSISI SECARA MUTLAK (ZERO PENETRATION - GAK BISA NEMBUS)
        const separation = maxOverlap + 0.08;
        s.pos.x += nx * (separation * 0.65);
        s.pos.z += nz * (separation * 0.65);

        // Dorong mobil lawan ke arah berlawanan
        rPos.x -= nx * (separation * 0.35);
        rPos.z -= nz * (separation * 0.35);

        // 2. MOMENTUM & ELASTIC BOUNCE
        const vAx = fAx * s.speed;
        const vAz = fAz * s.speed;
        const rSpeed = rp.speed || 0;
        const vRx = fRx * rSpeed;
        const vRz = fRz * rSpeed;

        const relVelX = vAx - vRx;
        const relVelZ = vAz - vRz;
        const relNormal = relVelX * nx + relVelZ * nz;

        if (relNormal < 0) {
          const restitution = 0.45;
          const impulse = -(1 + restitution) * relNormal;

          const newVAx = vAx + nx * impulse * 0.8;
          const newVAz = vAz + nz * impulse * 0.8;
          s.speed = (newVAx * fAx + newVAz * fAz) * 0.60; // Hentakan dan reduksi kecepatan akibat benturan

          // 3. DEFLEKSI PUTARAN & GUNCANGAN BODI (TORQUE)
          const hitCircle = localCircles[bestPair.i];
          const armX = hitCircle.x - s.pos.x;
          const armZ = hitCircle.z - s.pos.z;
          const torque = armX * nz - armZ * nx;
          s.angle += torque * 0.12;

          if (this.carObj && this.carObj.bodyGroup) {
            this.carObj.bodyGroup.rotation.z += (Math.random() - 0.5) * 0.35;
            this.carObj.bodyGroup.rotation.x += (Math.random() - 0.5) * 0.25;
          }

          // 4. SCREEN SHAKE & AUDIO
          this.camShake = Math.min(0.65, Math.abs(relNormal) * 0.85 + 0.2);

          const now = Date.now();
          if (now - this.lastCrashSoundTime > 180 && window.soundManager) {
            window.soundManager.crash();
            this.lastCrashSoundTime = now;
          }

          // 5. PERCIKAN API & DEBU TABRAKAN
          const contactX = (localCircles[bestPair.i].x + remoteCircles[bestPair.j].x) * 0.5;
          const contactZ = (localCircles[bestPair.i].z + remoteCircles[bestPair.j].z) * 0.5;
          this.spawnSparks(contactX, s.pos.y + 0.45, contactZ, nx, nz, 10);
          this.spawnDustParticle(contactX, s.pos.y + 0.2, contactZ);
        }
      }
    }
  }

  spawnDustParticle(x, y, z, isSand = false) {
    if (this.dustParticles.length > 55) return;
    const baseRadius = isSand ? (0.5 + Math.random() * 0.45) : (0.35 + Math.random() * 0.35);
    const pGeom = new THREE.SphereGeometry(baseRadius, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({
      color: isSand ? 0xdfa05d : 0xdeb887,
      transparent: true,
      opacity: isSand ? 0.78 : 0.65
    });
    const pMesh = new THREE.Mesh(pGeom, pMat);
    const spread = isSand ? 2.0 : 1.5;
    pMesh.position.set(x + (Math.random() - 0.5) * spread, y + 0.3, z + (Math.random() - 0.5) * spread);
    this.scene.add(pMesh);
    this.dustParticles.push({ mesh: pMesh, life: isSand ? 1.2 : 1.0 });
  }

  // 🌊 Semburan Air Realistis (Rooster-Tails, Bow Spray & Surface Ripples)
  spawnWaterSplash(s, binormal) {
    if (this.waterParticles.length > 95) return;

    const forwardX = Math.sin(s.angle);
    const forwardZ = Math.cos(s.angle);
    const boostMult = s.isBoosting ? 1.7 : 1.0;
    const speedMag = Math.max(0.25, Math.abs(s.speed));

    // 1. Dual Rear Wheels Rooster-Tails (Fountain tinggi menyembur ke atas dan ke belakang)
    const rearDist = 1.35;
    const halfTrack = 0.95;
    const wheelOffsets = [-halfTrack, halfTrack];

    wheelOffsets.forEach(offset => {
      const rx = s.pos.x - forwardX * rearDist + binormal.x * offset;
      const rz = s.pos.z - forwardZ * rearDist + binormal.z * offset;

      for (let k = 0; k < 2; k++) {
        const pGeom = new THREE.SphereGeometry(0.28 + Math.random() * 0.38, 6, 6);
        const pMat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.35 ? 0x60a5fa : 0xffffff,
          transparent: true,
          opacity: 0.88
        });
        const pMesh = new THREE.Mesh(pGeom, pMat);
        pMesh.position.set(rx + (Math.random() - 0.5) * 0.5, s.pos.y + 0.2, rz + (Math.random() - 0.5) * 0.5);
        this.scene.add(pMesh);

        this.waterParticles.push({
          mesh: pMesh,
          vy: (0.36 + Math.random() * 0.46) * boostMult,
          vx: -forwardX * speedMag * 0.55 + (Math.random() - 0.5) * 0.18,
          vz: -forwardZ * speedMag * 0.55 + (Math.random() - 0.5) * 0.18,
          life: 1.0
        });
      }
    });

    // 2. Front Wheels Bow Spray (Tirai semprotan air samping ke kiri & kanan)
    const frontDist = 1.25;
    wheelOffsets.forEach(offset => {
      const fx = s.pos.x + forwardX * frontDist + binormal.x * offset;
      const fz = s.pos.z + forwardZ * frontDist + binormal.z * offset;
      const sideDir = Math.sign(offset);

      const pGeom = new THREE.SphereGeometry(0.24 + Math.random() * 0.28, 5, 5);
      const pMat = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.76
      });
      const pMesh = new THREE.Mesh(pGeom, pMat);
      pMesh.position.set(fx, s.pos.y + 0.15, fz);
      this.scene.add(pMesh);

      this.waterParticles.push({
        mesh: pMesh,
        vy: (0.24 + Math.random() * 0.28) * boostMult,
        vx: binormal.x * sideDir * 0.30 + (Math.random() - 0.5) * 0.1,
        vz: binormal.z * sideDir * 0.30 + (Math.random() - 0.5) * 0.1,
        life: 0.85
      });
    });

    // 3. Lingkaran Gelombang Riak Air di Permukaan (Expanding Surface Ripple Rings)
    if (this.waterRipples.length < 25 && Math.random() < 0.4) {
      const rGeom = new THREE.RingGeometry(0.5, 0.75, 14);
      const rMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });
      const rMesh = new THREE.Mesh(rGeom, rMat);
      rMesh.position.set(s.pos.x, s.pos.y + 0.18, s.pos.z);
      rMesh.rotation.x = -Math.PI / 2;
      this.scene.add(rMesh);
      this.waterRipples.push({ mesh: rMesh, life: 1.0 });
    }
  }

  // 🪨 Hamburan Kerikil Halus Saat Melaju (Subtle Gravel Kick-up)
  spawnGravelParticle(x, y, z, angle, speed) {
    if (this.gravelParticles.length > 18) return;
    const forwardX = Math.sin(angle);
    const forwardZ = Math.cos(angle);

    const pGeom = new THREE.DodecahedronGeometry(0.09 + Math.random() * 0.09, 0);
    const stoneColors = [0x64748b, 0x475569, 0x94a3b8, 0x334155];
    const pMat = new THREE.MeshStandardMaterial({
      color: stoneColors[Math.floor(Math.random() * stoneColors.length)],
      roughness: 0.95
    });
    const pMesh = new THREE.Mesh(pGeom, pMat);
    const side = (Math.random() - 0.5) * 1.1;
    pMesh.position.set(x - forwardX * 1.1 + side, y + 0.15, z - forwardZ * 1.1 + side);
    pMesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    this.scene.add(pMesh);

    this.gravelParticles.push({
      mesh: pMesh,
      vy: 0.10 + Math.random() * 0.12,
      vx: -forwardX * Math.abs(speed) * 0.3 + (Math.random() - 0.5) * 0.08,
      vz: -forwardZ * Math.abs(speed) * 0.3 + (Math.random() - 0.5) * 0.08,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      life: 0.55
    });
  }

  // 💦 Efek Cipratan Air di Layar / Kamera (Screen Water Droplets)
  addScreenWaterDrops(count = 3) {
    if (!this.screenDropsCanvas) return;
    const w = this.screenDropsCanvas.width || 1200;
    const h = this.screenDropsCanvas.height || 750;
    for (let i = 0; i < count; i++) {
      if (this.screenDrops.length > 25) break;
      this.screenDrops.push({
        x: Math.random() * w,
        y: Math.random() * (h * 0.75),
        r: 6 + Math.random() * 12,
        vy: 1.2 + Math.random() * 2.5,
        life: 1.0
      });
    }
  }

  updateScreenWaterDrops() {
    if (!this.screenDropsCanvas || !this.screenDropsCtx) return;
    const w = this.container.clientWidth || 1200;
    const h = this.container.clientHeight || 750;
    if (this.screenDropsCanvas.width !== w || this.screenDropsCanvas.height !== h) {
      this.screenDropsCanvas.width = w;
      this.screenDropsCanvas.height = h;
    }
    const ctx = this.screenDropsCtx;
    ctx.clearRect(0, 0, w, h);

    if (this.screenDrops.length === 0) return;

    for (let i = this.screenDrops.length - 1; i >= 0; i--) {
      const d = this.screenDrops[i];
      d.y += d.vy;
      d.life -= 0.018;

      if (d.life <= 0 || d.y > h) {
        this.screenDrops.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, d.life * 0.75);

      // Droplet shadow rim
      ctx.fillStyle = 'rgba(0, 30, 60, 0.25)';
      ctx.beginPath();
      ctx.arc(d.x + 1, d.y + 1, d.r, 0, Math.PI * 2);
      ctx.fill();

      // Droplet transparent body
      ctx.fillStyle = 'rgba(215, 240, 255, 0.38)';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();

      // Top-left specular sunlight reflection
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(d.x - d.r * 0.32, d.y - d.r * 0.32, d.r * 0.28, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  updatePhysics() {
    if (!this.raceStarted || this.raceFinished) return;

    const s = this.carState;
    const phys = this.physics;
    let closestSample = this.getClosestTrackSample(s.pos);
    const inSand = !!closestSample.isSand;
    const inWater = !!closestSample.isWater;
    const inGravel = !!closestSample.isGravel;

    // Dynamic Multi-Terrain Handling
    let topSpeed = phys.maxSpeed;
    if (inWater) {
      // 🌊 Water Splash & Deep Riverbed
      if (!this.keys.nitro) {
        topSpeed = phys.maxSpeed * 0.85;
      }
      phys.turnSpeed = 0.027;
      if (Math.abs(s.speed) > 0.16) {
        this.spawnWaterSplash(s, closestSample.binormal);
        this.addScreenWaterDrops(s.isBoosting ? 4 : 2);
        if (Math.random() < 0.35 && window.soundManager) window.soundManager.waterSplash();
      }
      if (this.hudTerrainEl) {
        this.hudTerrainEl.textContent = '🌊 AIR';
        this.hudTerrainEl.style.color = '#38bdf8';
      }
      this.carObj.bodyGroup.position.y = 0;
    } else if (inGravel) {
      // 🪨 Gravel Ridge: Bebatuan & Chassis Shudder
      if (!this.keys.nitro) {
        topSpeed = phys.maxSpeed * 0.88;
      }
      phys.turnSpeed = 0.028;
      if (Math.abs(s.speed) > 0.18) {
        if (Math.random() < 0.28) {
          this.spawnGravelParticle(s.pos.x, s.pos.y, s.pos.z, s.angle, s.speed);
        }
        // Chassis rumble / subtle suspension jitter over rocks
        const rumble = (Math.sin(Date.now() * 0.08) * 0.035 + (Math.random() - 0.5) * 0.02) * Math.min(1.0, Math.abs(s.speed));
        this.carObj.bodyGroup.position.y = rumble;
        this.carObj.bodyGroup.rotation.z = -s.steerAngle * 0.18 + (Math.random() - 0.5) * 0.02 * s.speed;

        if (Math.random() < 0.22 && window.soundManager) window.soundManager.gravelCrunch();
        if (navigator.vibrate && Math.random() < 0.15) navigator.vibrate(12);
      }
      if (this.hudTerrainEl) {
        this.hudTerrainEl.textContent = '🪨 KERIKIL';
        this.hudTerrainEl.style.color = '#94a3b8';
      }
    } else if (inSand) {
      // 🏜️ Sand Dunes Drift
      if (!this.keys.nitro) {
        topSpeed = phys.maxSpeed * 0.90;
      }
      phys.turnSpeed = 0.030;
      if (Math.abs(s.speed) > 0.20) {
        this.spawnDustParticle(s.pos.x, s.pos.y, s.pos.z, true);
        if (Math.random() < 0.15 && window.soundManager) window.soundManager.skid();
      }
      if (this.hudTerrainEl) {
        this.hudTerrainEl.textContent = '🏜️ PASIR';
        this.hudTerrainEl.style.color = '#f59e0b';
      }
      this.carObj.bodyGroup.position.y = 0;
    } else {
      phys.turnSpeed = 0.026;
      if (this.hudTerrainEl) {
        this.hudTerrainEl.textContent = '🏁 ASPAL';
        this.hudTerrainEl.style.color = '#00ff88';
      }
      this.carObj.bodyGroup.position.y = 0;
    }

    // Nitro handling
    s.isBoosting = false;
    if (this.keys.nitro && s.nitro > 0 && s.speed > 0.4) {
      s.isBoosting = true;
      topSpeed = phys.nitroSpeed;
      s.nitro = Math.max(0, s.nitro - 0.7);
      if (Math.random() < 0.25 && window.soundManager) window.soundManager.boost();
      this.spawnDustParticle(s.pos.x, s.pos.y, s.pos.z, inSand);
    } else {
      s.nitro = Math.min(100, s.nitro + 0.18);
    }

    this.carObj.flames.forEach(f => f.visible = s.isBoosting);

    // Boost pads
    for (let bp of this.boostPads) {
      if (Math.hypot(s.pos.x - bp.pos.x, s.pos.z - bp.pos.z) < bp.radius) {
        s.speed = Math.min(s.speed + 0.45, phys.nitroSpeed);
        if (window.soundManager) window.soundManager.boost();
      }
    }

    // Acceleration & Braking
    if (this.keys.up) {
      if (s.speed < topSpeed) {
        s.speed += phys.accel;
      }
    } else if (this.keys.down) {
      if (s.speed > 0) {
        s.speed -= phys.brake;
      } else if (s.speed > phys.reverseSpeed) {
        s.speed -= phys.accel * 0.5;
      }
    } else {
      s.speed *= phys.friction;
      if (Math.abs(s.speed) < 0.005) s.speed = 0;
    }

    // Steering (Progressive Input & Speed-Sensitive Stability agar stir berbobot & tidak over-sensitif)
    let targetInput = 0;
    if (this.keys.left) targetInput += 1;
    if (this.keys.right) targetInput -= 1;

    // Gradual steering build-up (tekanan singkat = koreksi halus, tahan tombol = belok penuh)
    const steerBuildRate = 0.14;
    const steerReturnRate = 0.26;
    const inputRate = (targetInput === 0) ? steerReturnRate : steerBuildRate;
    s.steerInput = (s.steerInput || 0) + (targetInput - (s.steerInput || 0)) * inputRate;
    if (Math.abs(s.steerInput) < 0.004 && targetInput === 0) s.steerInput = 0;

    if (Math.abs(s.speed) > 0.05 && Math.abs(s.steerInput) > 0.005) {
      const dir = s.speed > 0 ? 1 : -1;
      const speedMag = Math.abs(s.speed);

      // Speed-sensitive steering: mobil stabil di trek lurus berkecepatan tinggi, lincah di tikungan
      let speedFactor = 1.0;
      if (speedMag < 0.35) {
        speedFactor = speedMag / 0.35;
      } else if (speedMag > 0.95) {
        // Redam sedikit sensitivitas saat kencang agar mobil tidak membanting liar ke pembatas
        speedFactor = Math.max(0.72, 1.0 - (speedMag - 0.95) * 0.30);
      }

      const turnAmount = phys.turnSpeed * speedFactor * s.steerInput * dir;
      s.angle += turnAmount;
    }

    const targetSteerAngle = s.steerInput * 0.28;
    s.steerAngle += (targetSteerAngle - s.steerAngle) * 0.22;
    this.carObj.frontWheels.forEach(w => w.rotation.y = s.steerAngle);
    this.carObj.wheels.forEach(w => w.children[0].rotation.x += s.speed * 1.5);
    if (!inGravel) {
      this.carObj.bodyGroup.rotation.z = -s.steerAngle * 0.18;
    }

    // Displacement
    const forwardX = Math.sin(s.angle);
    const forwardZ = Math.cos(s.angle);
    s.pos.x += forwardX * s.speed;
    s.pos.z += forwardZ * s.speed;

    // 💥 Tabrakan Fisik Antar Mobil (Benturan Nyata, Terpental & Tidak Tembus)
    this.checkCarCollisions();

    // 🛡️ HARD GUARDRAIL COLLISION & ELEVATION MATCHING
    closestSample = this.getClosestTrackSample(s.pos);
    const toCar = new THREE.Vector3().subVectors(s.pos, closestSample.p);

    const lateralDist = toCar.dot(closestSample.binormal);
    const maxAllowedLateral = this.halfW - 1.1;

    if (Math.abs(lateralDist) > maxAllowedLateral) {
      const sign = Math.sign(lateralDist);
      const clampedLateral = sign * maxAllowedLateral;

      const correctedPos = new THREE.Vector3()
        .copy(closestSample.p)
        .addScaledVector(closestSample.binormal, clampedLateral);

      s.pos.x = correctedPos.x;
      s.pos.z = correctedPos.z;

      const impactSpeed = Math.abs(s.speed);
      s.speed *= 0.65; // Reduksi kecepatan akibat tabrak pembatas

      const trackAngle = Math.atan2(closestSample.tangent.x, closestSample.tangent.z);
      s.angle += (trackAngle - s.angle) * 0.16;

      // Percikan api, guncangan kamera & suara benturan jika tabrak pembatas kencang
      if (impactSpeed > 0.22) {
        this.spawnSparks(s.pos.x, s.pos.y + 0.45, s.pos.z, -sign * closestSample.binormal.x, -sign * closestSample.binormal.z, 8);
        this.camShake = Math.max(this.camShake, 0.35);
        const now = Date.now();
        if (now - this.lastCrashSoundTime > 180 && window.soundManager) {
          window.soundManager.crash();
          this.lastCrashSoundTime = now;
        }
      }

      this.spawnDustParticle(s.pos.x, s.pos.y, s.pos.z);
      if (Math.random() < 0.2 && window.soundManager) window.soundManager.skid();
    }

    // ⚠️ WRONG WAY DETECTION
    const carHeading = new THREE.Vector3(forwardX, 0, forwardZ).normalize();
    const alignment = carHeading.dot(closestSample.tangent);

    if (alignment < -0.35 && Math.abs(s.speed) > 0.2) {
      this.wrongWayEl.style.display = 'block';
    } else {
      this.wrongWayEl.style.display = 'none';
    }

    // 🎢 Elevation Matching
    s.pos.y += (closestSample.p.y - s.pos.y) * 0.25;

    // Pitch tilt according to slope
    const slope = closestSample.tangent.y;
    s.pitch += (-slope * 0.8 - s.pitch) * 0.2;

    this.carObj.root.position.copy(s.pos);
    this.carObj.root.rotation.y = s.angle;
    this.carObj.root.rotation.x = s.pitch;

    // Checkpoints & Laps
    for (let cp of this.checkpoints) {
      if (Math.hypot(s.pos.x - cp.pos.x, s.pos.z - cp.pos.z) < cp.radius) {
        if (cp.isFinish) {
          if (s.passedCheckpoints.size >= this.checkpoints.length - 1) {
            s.lap++;
            s.passedCheckpoints = new Set([0]);

            const timeNow = Date.now() - this.startTime;
            this.socket.emit('racing:finishedLap', {
              lap: s.lap - 1,
              totalLaps: this.totalLaps,
              timeMs: timeNow
            });

            if (s.lap > this.totalLaps) {
              this.raceFinished = true;
              this.myFinishTime = timeNow;
              if (window.soundManager) window.soundManager.winFanfare();
            }
          }
        } else {
          s.passedCheckpoints.add(cp.id);
        }
      }
    }

    // Update Dust particles
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const dp = this.dustParticles[i];
      dp.life -= 0.04;
      dp.mesh.scale.multiplyScalar(1.06);
      dp.mesh.material.opacity = dp.life * 0.6;
      dp.mesh.position.y += 0.05;
      if (dp.life <= 0) {
        this.scene.remove(dp.mesh);
        dp.mesh.geometry.dispose();
        dp.mesh.material.dispose();
        this.dustParticles.splice(i, 1);
      }
    }

    // Update Water Splash particles
    for (let i = this.waterParticles.length - 1; i >= 0; i--) {
      const wp = this.waterParticles[i];
      wp.life -= 0.045;
      wp.mesh.position.y += wp.vy;
      wp.mesh.position.x += wp.vx;
      wp.mesh.position.z += wp.vz;
      wp.vy -= 0.016; // gravity
      wp.mesh.scale.multiplyScalar(1.03);
      wp.mesh.material.opacity = Math.max(0, wp.life * 0.85);
      if (wp.life <= 0) {
        this.scene.remove(wp.mesh);
        wp.mesh.geometry.dispose();
        wp.mesh.material.dispose();
        this.waterParticles.splice(i, 1);
      }
    }

    // Update Water Surface Ripple Rings
    for (let i = this.waterRipples.length - 1; i >= 0; i--) {
      const rip = this.waterRipples[i];
      rip.life -= 0.04;
      rip.mesh.scale.multiplyScalar(1.08);
      rip.mesh.material.opacity = rip.life * 0.65;
      if (rip.life <= 0) {
        this.scene.remove(rip.mesh);
        rip.mesh.geometry.dispose();
        rip.mesh.material.dispose();
        this.waterRipples.splice(i, 1);
      }
    }

    // Update Gravel scattering particles
    for (let i = this.gravelParticles.length - 1; i >= 0; i--) {
      const gp = this.gravelParticles[i];
      gp.life -= 0.055;
      gp.mesh.position.y += gp.vy;
      gp.mesh.position.x += gp.vx;
      gp.mesh.position.z += gp.vz;
      gp.vy -= 0.024; // gravity
      gp.mesh.rotation.x += gp.rotSpeed || 0.12;
      gp.mesh.rotation.z += gp.rotSpeed || 0.12;
      if (gp.life <= 0) {
        this.scene.remove(gp.mesh);
        gp.mesh.geometry.dispose();
        gp.mesh.material.dispose();
        this.gravelParticles.splice(i, 1);
      }
    }

    // Update Collision Spark particles
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const sp = this.sparkParticles[i];
      sp.life -= 0.08;
      sp.mesh.position.x += sp.vx;
      sp.mesh.position.y += sp.vy;
      sp.mesh.position.z += sp.vz;
      sp.vy -= 0.022; // gravity
      sp.mesh.scale.multiplyScalar(0.91);
      sp.mesh.material.opacity = Math.max(0, sp.life);
      if (sp.life <= 0) {
        this.scene.remove(sp.mesh);
        sp.mesh.geometry.dispose();
        sp.mesh.material.dispose();
        this.sparkParticles.splice(i, 1);
      }
    }

    // Update HUD
    const speedKmh = Math.abs(Math.round(s.speed * 85));
    this.hudSpeedEl.innerHTML = `${speedKmh} <span style="font-size: 13px; color: #94a3b8;">KM/H</span>`;
    this.hudLapEl.textContent = `${Math.min(s.lap, this.totalLaps)} / ${this.totalLaps}`;
    this.hudNitroEl.style.width = `${s.nitro}%`;

    // Draw Real-Time Minimap
    this.drawMinimap();
  }

  updateCamera() {
    const s = this.carState;

    // 🔄 Auto-recenter: Jika sedang melaju kencang & tidak sedang menggeser selama > 1.5 detik,
    // kamera perlahan kembali lurus ke depan agar navigasi tetap nyaman.
    if (!this.isDraggingCamera && (Date.now() - this.lastDragTime > 1500) && Math.abs(s.speed) > 0.25) {
      this.manualCameraYaw *= 0.94;
      this.manualCameraPitch *= 0.94;
      if (Math.abs(this.manualCameraYaw) < 0.004) this.manualCameraYaw = 0;
      if (Math.abs(this.manualCameraPitch) < 0.004) this.manualCameraPitch = 0;
    }

    // Preset Jarak & Ketinggian Kamera sesuai Mode
    let camDist = 7.8;
    let camHeight = 3.4;
    let lookHeight = 1.2;
    let lookDist = 3.8;

    if (this.cameraMode === 1) {
      // 🎥 PANORAMA / WIDE (Tinggi & luas, sangat cocok untuk melihat pemandangan & papan reklame)
      camDist = 14.0;
      camHeight = 6.8;
      lookHeight = 1.0;
      lookDist = 2.0;
    } else if (this.cameraMode === 2) {
      // 🎥 KAP MOBIL / HOOD VIEW (Dekat kap mesin)
      camDist = 2.0;
      camHeight = 1.4;
      lookHeight = 1.2;
      lookDist = 8.0;
    }

    const totalYaw = s.angle + this.targetCameraYaw + this.manualCameraYaw;
    const totalPitch = this.manualCameraPitch;

    const cosPitch = Math.cos(totalPitch);
    const sinPitch = Math.sin(totalPitch);

    const forwardX = Math.sin(totalYaw);
    const forwardZ = Math.cos(totalYaw);

    const targetCamX = s.pos.x - forwardX * (camDist * cosPitch);
    const targetCamZ = s.pos.z - forwardZ * (camDist * cosPitch);
    const targetCamY = Math.max(s.pos.y + 0.6, s.pos.y + camHeight + (camDist * sinPitch));

    const lerpFactor = this.cameraMode === 2 ? 0.35 : 0.16;
    this.camera.position.x += (targetCamX - this.camera.position.x) * lerpFactor;
    this.camera.position.z += (targetCamZ - this.camera.position.z) * lerpFactor;
    this.camera.position.y += (targetCamY - this.camera.position.y) * lerpFactor;

    const lookTarget = new THREE.Vector3(
      s.pos.x + forwardX * lookDist,
      s.pos.y + lookHeight,
      s.pos.z + forwardZ * lookDist
    );

    // 💥 Guncangan Kamera saat Benturan / Tabrakan (Camera Shake Impact)
    if (this.camShake > 0.008) {
      this.camera.position.x += (Math.random() - 0.5) * this.camShake;
      this.camera.position.y += (Math.random() - 0.5) * this.camShake * 0.7;
      this.camera.position.z += (Math.random() - 0.5) * this.camShake;
      this.camShake *= 0.83;
    } else {
      this.camShake = 0;
    }

    this.camera.lookAt(lookTarget);

    const baseFOV = this.cameraMode === 1 ? 64 : 58;
    const targetFOV = s.isBoosting ? (baseFOV + 10) : baseFOV;
    this.camera.fov += (targetFOV - this.camera.fov) * 0.08;
    this.camera.updateProjectionMatrix();
  }

  updateRemotePlayers() {
    for (let id in this.remotePlayers) {
      const rp = this.remotePlayers[id];
      rp.root.position.lerp(rp.targetPos, 0.2);

      let diff = rp.targetRotY - rp.root.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      rp.root.rotation.y += diff * 0.2;
      rp.root.rotation.x += (rp.targetRotX - rp.root.rotation.x) * 0.2;

      rp.wheels.forEach(w => w.children[0].rotation.x += rp.speed * 1.5);
    }

    // Hindari rival-rival saling tembus satu sama lain
    const rIds = Object.keys(this.remotePlayers);
    for (let a = 0; a < rIds.length; a++) {
      for (let b = a + 1; b < rIds.length; b++) {
        const rpA = this.remotePlayers[rIds[a]];
        const rpB = this.remotePlayers[rIds[b]];
        const dist = Math.hypot(rpA.root.position.x - rpB.root.position.x, rpA.root.position.z - rpB.root.position.z);
        if (dist < 2.25 && dist > 0.001) {
          const overlap = (2.25 - dist) * 0.5;
          const nx = (rpA.root.position.x - rpB.root.position.x) / dist;
          const nz = (rpA.root.position.z - rpB.root.position.z) / dist;
          rpA.root.position.x += nx * overlap;
          rpA.root.position.z += nz * overlap;
          rpB.root.position.x -= nx * overlap;
          rpB.root.position.z -= nz * overlap;
        }
      }
    }
  }

  loop() {
    if (!this.active) return;
    if (this.waterTexture) {
      this.waterTexture.offset.y += 0.005;
    }
    this.updateRemotePlayers();
    this.updatePhysics();
    this.updateCamera();
    this.updateScreenWaterDrops();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.loop());
  }

  destroy() {
    this.active = false;
    clearInterval(this.syncInterval);
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    window.removeEventListener('resize', this.resizeHandler);

    if (this.container && this.onMouseDown) {
      this.container.removeEventListener('mousedown', this.onMouseDown);
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mouseup', this.onMouseUp);

      this.container.removeEventListener('touchstart', this.onTouchStart);
      window.removeEventListener('touchmove', this.onTouchMove);
      window.removeEventListener('touchend', this.onTouchEnd);
      window.removeEventListener('touchcancel', this.onTouchEnd);
    }

    this.socket.off('racing:playerUpdate', this.playerUpdateHandler);
    this.socket.off('racing:lapAnnounce', this.lapAnnounceHandler);
    this.socket.off('racing:playerFinished', this.playerFinishedHandler);

    if (this.waterMesh) {
      this.scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      this.waterMesh.material.dispose();
    }
    if (this.gravelMesh) {
      this.scene.remove(this.gravelMesh);
      this.gravelMesh.geometry.dispose();
      this.gravelMesh.material.dispose();
    }
    if (this.billboardMeshes) {
      this.billboardMeshes.forEach(b => this.scene.remove(b));
      this.billboardMeshes = [];
    }

    this.sparkParticles.forEach(sp => {
      this.scene.remove(sp.mesh);
      sp.mesh.geometry.dispose();
      sp.mesh.material.dispose();
    });
    this.sparkParticles = [];

    this.dustParticles.forEach(dp => {
      this.scene.remove(dp.mesh);
      dp.mesh.geometry.dispose();
      dp.mesh.material.dispose();
    });
    this.dustParticles = [];

    this.waterParticles.forEach(wp => {
      this.scene.remove(wp.mesh);
      wp.mesh.geometry.dispose();
      wp.mesh.material.dispose();
    });
    this.waterParticles = [];

    this.waterRipples.forEach(rip => {
      this.scene.remove(rip.mesh);
      rip.mesh.geometry.dispose();
      rip.mesh.material.dispose();
    });
    this.waterRipples = [];

    this.gravelParticles.forEach(gp => {
      this.scene.remove(gp.mesh);
      gp.mesh.geometry.dispose();
      gp.mesh.material.dispose();
    });
    this.gravelParticles = [];
    this.screenDrops = [];

    if (this.hudContainer && this.hudContainer.parentNode) {
      this.hudContainer.parentNode.removeChild(this.hudContainer);
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

window.RacingGame3D = RacingGame3D;
