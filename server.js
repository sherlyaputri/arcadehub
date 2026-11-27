const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/three', express.static(path.join(__dirname, 'node_modules', 'three', 'build')));

// Database Kamus Resmi KBBI (71.000+ Kosakata Bahasa Indonesia Baku & Sehari-hari)
let KBBI_SET = new Set();
let KBBI_PREFIX_SET = new Set();
try {
  const kbbiPath = path.join(__dirname, 'data', 'kbbi_words.json');
  if (fs.existsSync(kbbiPath)) {
    const rawWords = JSON.parse(fs.readFileSync(kbbiPath, 'utf8'));
    KBBI_SET = new Set(rawWords);
    KBBI_PREFIX_SET = new Set(rawWords.map(w => w.slice(0, 2)));
    console.log(`📖 Berhasil memuat ${KBBI_SET.size} kosakata resmi KBBI untuk Sambung Kata 3D!`);
  }
} catch (err) {
  console.error('Gagal memuat kamus KBBI:', err);
}

// Room storage
// roomId -> { id, hostId, game: 'racing', state: 'lobby', players: {}, gameData: {} }
const rooms = {};

const AVAILABLE_GAMES = [
  { id: 'racing', name: '🚜 Mining Rally 3D (Balap Tambang & Konstruksi)', minPlayers: 1, maxPlayers: 8 },
  { id: 'quiz', name: '🧠 Quiz Trivia Showdown', minPlayers: 1, maxPlayers: 12 },
  { id: 'tennis', name: '🎾 Tennis Duel (1v1 Real-time)', minPlayers: 1, maxPlayers: 2 },
  { id: 'territory', name: '⚔️ Territory Conquest (Perebutan Wilayah)', minPlayers: 2, maxPlayers: 2 },
  { id: 'sambungkata', name: '🔤 Sambung Kata 3D (Roblox Style)', minPlayers: 1, maxPlayers: 8 },
  { id: 'tictactoe', name: '⚔️ Territory Conquest (Perebutan Wilayah)', minPlayers: 2, maxPlayers: 2 }
];

const DEFAULT_COLORS = ['#ff3366', '#00d2ff', '#00ff88', '#ffcc00', '#b537f2', '#ff8800', '#ec4899', '#00ffff'];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms[code] ? generateRoomCode() : code;
}

// =================== SAMBUNG KATA 3D HELPERS ===================
const skTimers = {};

function clearSkTimer(roomId) {
  if (skTimers[roomId]) {
    clearInterval(skTimers[roomId]);
    delete skTimers[roomId];
  }
}

function setSkTimer(roomId, timer) {
  clearSkTimer(roomId);
  skTimers[roomId] = timer;
}

const SK_STARTING_SYLLABLES = [
  'AN', 'BA', 'CA', 'DA', 'GA', 'HA', 'JA', 'KA', 'LA', 'MA',
  'PA', 'RA', 'SA', 'TA', 'BE', 'DE', 'GE', 'KE', 'ME', 'PE',
  'SE', 'TE', 'BI', 'DI', 'GI', 'LI', 'MI', 'PI', 'SI', 'TI',
  'BO', 'DO', 'GO', 'KO', 'PO', 'RO', 'TO', 'BU', 'DU', 'GU',
  'KU', 'LU', 'MU', 'PU', 'RU', 'SU', 'TU'
];

function initSambungKataGame(room) {
  clearSkTimer(room.id);

  const playerIds = Object.keys(room.players);
  const playerData = {};
  playerIds.forEach(id => {
    playerData[id] = {
      id,
      name: room.players[id].name,
      color: room.players[id].color,
      lives: 3,
      score: 0,
      isAlive: true
    };
  });

  const firstPrompt = SK_STARTING_SYLLABLES[Math.floor(Math.random() * SK_STARTING_SYLLABLES.length)];

  room.gameData = {
    turnIndex: 0,
    currentTurnId: playerIds[0],
    prompt: firstPrompt,
    mode: 'chain2',
    timeLeft: 15,
    usedWords: [],
    lastWord: '',
    playerData,
    winner: null,
    status: 'playing',
    history: [`🎮 Game Dimulai! Giliran ${playerData[playerIds[0]]?.name} (Awalan: "${firstPrompt}")`]
  };

  startSambungKataTimer(room);
}

function startSambungKataTimer(room) {
  clearSkTimer(room.id);
  const interval = setInterval(() => {
    const gd = room.gameData;
    if (!gd || gd.status !== 'playing') {
      clearSkTimer(room.id);
      return;
    }

    gd.timeLeft--;
    io.to(room.id).emit('sambungkata:update', gd);

    if (gd.timeLeft <= 0) {
      const currP = gd.playerData[gd.currentTurnId];
      if (currP) {
        currP.lives = Math.max(0, currP.lives - 1);
        if (currP.lives <= 0) {
          currP.isAlive = false;
        }
        io.to(room.id).emit('sambungkata:timeout', {
          playerId: gd.currentTurnId,
          remainingLives: currP.lives
        });
      }
      // Saat timeout, pilih awalan baru agar permainan tidak macet
      advanceSambungKataTurn(room, null);
    }
  }, 1000);

  setSkTimer(room.id, interval);
}

function advanceSambungKataTurn(room, nextPrompt = null) {
  const gd = room.gameData;
  if (!gd) return;

  const playerIds = Object.keys(gd.playerData);
  const alivePlayers = playerIds.filter(id => gd.playerData[id].lives > 0);

  // 1 Pemain (Solo Mode): Jika 3 nyawanya habis -> KALAH / GAME OVER
  if (playerIds.length === 1) {
    if (alivePlayers.length === 0) {
      gd.status = 'finished';
      gd.winner = null; // Kalah karena nyawa habis
      clearSkTimer(room.id);
      io.to(room.id).emit('sambungkata:update', gd);
      return;
    }
  } else {
    // 2 Pemain atau Lebih: Jika tersisa 1 atau 0 orang -> GAME SELESAI
    if (alivePlayers.length <= 1) {
      gd.status = 'finished';
      gd.winner = alivePlayers.length === 1 ? gd.playerData[alivePlayers[0]] : null;
      clearSkTimer(room.id);
      io.to(room.id).emit('sambungkata:update', gd);
      return;
    }
  }

  // Next alive player
  let nextIdx = (gd.turnIndex + 1) % playerIds.length;
  for (let i = 0; i < playerIds.length; i++) {
    const candidateId = playerIds[(nextIdx + i) % playerIds.length];
    if (gd.playerData[candidateId].lives > 0) {
      nextIdx = (nextIdx + i) % playerIds.length;
      break;
    }
  }

  gd.turnIndex = nextIdx;
  gd.currentTurnId = playerIds[nextIdx];
  gd.timeLeft = 15;

  // Jika ada nextPrompt dari 2 huruf akhir kata pemain sebelumnya dan ada kelanjutannya di KBBI, gunakan itu!
  if (nextPrompt && nextPrompt.length === 2 && (KBBI_PREFIX_SET.size === 0 || KBBI_PREFIX_SET.has(nextPrompt))) {
    gd.prompt = nextPrompt;
  } else {
    gd.prompt = SK_STARTING_SYLLABLES[Math.floor(Math.random() * SK_STARTING_SYLLABLES.length)];
    if (nextPrompt) {
      gd.history.unshift(`⚠️ Akhiran [${nextPrompt}] tidak memiliki kata sambungan di KBBI. Huruf baru diacak: "${gd.prompt}"`);
    }
  }

  const pName = gd.playerData[gd.currentTurnId]?.name || 'Pemain';
  gd.history.unshift(`👉 Giliran ${pName}! Awalan 2 huruf: "${gd.prompt}"`);
  if (gd.history.length > 25) gd.history.pop();

  io.to(room.id).emit('sambungkata:update', gd);
}

io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('createRoom', ({ name, color }) => {
    const roomId = generateRoomCode();
    currentRoomId = roomId;

    const playerColor = DEFAULT_COLORS[0];
    const player = {
      id: socket.id,
      name: (name || 'Pembalap ' + Math.floor(Math.random() * 100)).trim(),
      color: playerColor,
      ready: true,
      score: 0,
      isHost: true
    };

    rooms[roomId] = {
      id: roomId,
      hostId: socket.id,
      game: 'racing',
      quizCategory: 'umum',
      state: 'lobby',
      players: { [socket.id]: player },
      gameData: {}
    };

    socket.join(roomId);
    socket.emit('roomJoined', { room: rooms[roomId], selfId: socket.id });
  });

  socket.on('joinRoom', ({ roomId, name, color }) => {
    const cleanRoomId = (roomId || '').trim().toUpperCase();
    const room = rooms[cleanRoomId];

    if (!room) {
      return socket.emit('errorMsg', 'Room tidak ditemukan!');
    }

    const playerCount = Object.keys(room.players).length;
    const gameMeta = AVAILABLE_GAMES.find(g => g.id === room.game);
    if (gameMeta && playerCount >= gameMeta.maxPlayers && room.state !== 'lobby') {
      return socket.emit('errorMsg', 'Room sudah penuh atau game sedang berlangsung!');
    }

    currentRoomId = cleanRoomId;
    const assignedColor = DEFAULT_COLORS[playerCount % DEFAULT_COLORS.length];

    const player = {
      id: socket.id,
      name: (name || 'Player ' + (playerCount + 1)).trim(),
      color: assignedColor,
      ready: false,
      score: 0,
      isHost: false
    };

    room.players[socket.id] = player;
    socket.join(cleanRoomId);

    socket.emit('roomJoined', { room, selfId: socket.id });
    socket.to(cleanRoomId).emit('playerJoined', { player, room });
  });

  socket.on('updateProfile', ({ name, color }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const player = room.players[socket.id];
    if (!player) return;

    if (name) player.name = name.trim();
    if (color) player.color = color;

    io.to(currentRoomId).emit('roomUpdated', room);
  });

  socket.on('toggleReady', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const player = room.players[socket.id];
    if (!player) return;

    player.ready = !player.ready;
    io.to(currentRoomId).emit('roomUpdated', room);
  });

  socket.on('changeGame', (gameId) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (room.hostId !== socket.id) return; // Only host

    if (AVAILABLE_GAMES.some(g => g.id === gameId)) {
      room.game = gameId;
      room.state = 'lobby';
      room.gameData = {};
      io.to(currentRoomId).emit('gameChanged', { game: gameId, room });
    }
  });

  socket.on('startGame', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (room.hostId !== socket.id) return;

    room.state = 'playing';
    if (room.game === 'sambungkata') {
      initSambungKataGame(room);
    } else {
      room.gameData = {
        startTime: Date.now(),
        leaderboard: []
      };
    }

    io.to(currentRoomId).emit('gameStarted', {
      game: room.game,
      room,
      countdown: 3
    });
  });

  socket.on('backToLobby', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];

    clearSkTimer(room.id);

    room.state = 'lobby';
    room.gameData = {};
    // reset ready states except host
    Object.values(room.players).forEach(p => {
      p.ready = p.id === room.hostId;
    });

    io.to(currentRoomId).emit('returnedToLobby', room);
  });

  socket.on('chatMessage', (message) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const player = room.players[socket.id];
    if (!player || !message) return;

    const chatData = {
      id: Math.random().toString(36).substr(2, 9),
      sender: player.name,
      color: player.color,
      text: message.slice(0, 150),
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    io.to(currentRoomId).emit('chatMessage', chatData);
  });

  // =================== TURBO RACERS SPECIFIC ===================
  socket.on('racing:update', (carState) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    // Broadcast car state directly to others in the room
    socket.to(currentRoomId).emit('racing:playerUpdate', {
      id: socket.id,
      state: carState
    });
  });

  socket.on('racing:finishedLap', ({ lap, totalLaps, timeMs }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const player = room.players[socket.id];
    if (!player) return;

    io.to(currentRoomId).emit('racing:lapAnnounce', {
      playerName: player.name,
      playerColor: player.color,
      lap,
      totalLaps
    });

    if (lap >= totalLaps) {
      if (!room.gameData.leaderboard) room.gameData.leaderboard = [];
      const alreadyFinished = room.gameData.leaderboard.find(e => e.id === socket.id);
      if (!alreadyFinished) {
        const rank = room.gameData.leaderboard.length + 1;
        room.gameData.leaderboard.push({
          id: socket.id,
          name: player.name,
          color: player.color,
          rank,
          timeMs
        });

        io.to(currentRoomId).emit('racing:playerFinished', {
          id: socket.id,
          name: player.name,
          color: player.color,
          rank,
          timeMs,
          leaderboard: room.gameData.leaderboard
        });
      }
    }
  });

  // =================== TERRITORY CONQUEST (WORLD MAP 32 TERRITORIES) ===================
  const WORLD_TERRITORIES_DEF = [
    // --- AMERIKA UTARA (7) ---
    { id: 'alaska', name: 'Alaska & Yukon', continent: 'North America', x: 80, y: 85, defaultOwner: null, defaultTroops: 1, maxTroops: 2 },
    { id: 'nw_terr', name: 'Barat Laut & Alberta', continent: 'North America', x: 180, y: 80, defaultOwner: null, defaultTroops: 1, maxTroops: 3 },
    { id: 'quebec', name: 'Quebec & Ontario', continent: 'North America', x: 285, y: 85, defaultOwner: null, defaultTroops: 1, maxTroops: 3 },
    { id: 'greenland', name: 'Greenland', continent: 'North America', x: 395, y: 50, defaultOwner: null, defaultTroops: 1, maxTroops: 3 },
    { id: 'usa_w', name: 'Amerika Barat', continent: 'North America', x: 135, y: 185, defaultOwner: 'p1', defaultTroops: 1, maxTroops: 4 },
    { id: 'usa_e', name: 'Amerika Timur', continent: 'North America', x: 250, y: 195, defaultOwner: 'p1', defaultTroops: 1, maxTroops: 4 },
    { id: 'mexico', name: 'Meksiko & Karibia', continent: 'North America', x: 185, y: 290, defaultOwner: 'p1', defaultTroops: 1, maxTroops: 2 },

    // --- AMERIKA SELATAN (4) ---
    { id: 'venezuela', name: 'Venezuela & Kolombia', continent: 'South America', x: 285, y: 350, defaultOwner: 'p1', defaultTroops: 1, maxTroops: 3 },
    { id: 'brazil', name: 'Brasil & Amazon', continent: 'South America', x: 355, y: 385, defaultOwner: 'p1', defaultTroops: 2, maxTroops: 4 },
    { id: 'peru', name: 'Peru & Andes', continent: 'South America', x: 270, y: 415, defaultOwner: null, defaultTroops: 1, maxTroops: 3 },
    { id: 'argentina', name: 'Argentina & Chili', continent: 'South America', x: 295, y: 505, defaultOwner: 'p1', defaultTroops: 1, maxTroops: 3 },

    // --- EROPA (6) ---
    { id: 'iceland', name: 'Islandia', continent: 'Europe', x: 398, y: 92, defaultOwner: null, defaultTroops: 1, maxTroops: 2 },
    { id: 'uk', name: 'Britania Raya', continent: 'Europe', x: 410, y: 150, defaultOwner: null, defaultTroops: 1, maxTroops: 3 },
    { id: 'scandinavia', name: 'Skandinavia & Nordik', continent: 'Europe', x: 505, y: 85, defaultOwner: null, defaultTroops: 1, maxTroops: 3 },
    { id: 'w_europe', name: 'Eropa Barat', continent: 'Europe', x: 445, y: 215, defaultOwner: 'p1', defaultTroops: 4, maxTroops: 4 }, // Markas Induk P1
    { id: 's_europe', name: 'Eropa Selatan & Italia', continent: 'Europe', x: 480, y: 280, defaultOwner: 'p1', defaultTroops: 1, maxTroops: 3 },
    { id: 'e_europe', name: 'Eropa Timur & Ukraina', continent: 'Europe', x: 540, y: 190, defaultOwner: null, defaultTroops: 1, maxTroops: 4 },

    // --- AFRIKA (5) ---
    { id: 'n_africa', name: 'Afrika Utara / Maghreb', continent: 'Africa', x: 450, y: 330, defaultOwner: 'p2', defaultTroops: 4, maxTroops: 4 }, // Markas Induk P2
    { id: 'egypt', name: 'Mesir & Nil', continent: 'Africa', x: 545, y: 325, defaultOwner: null, defaultTroops: 1, maxTroops: 3 },
    { id: 'e_africa', name: 'Afrika Timur', continent: 'Africa', x: 565, y: 410, defaultOwner: null, defaultTroops: 1, maxTroops: 3 },
    { id: 's_africa', name: 'Afrika Selatan', continent: 'Africa', x: 500, y: 465, defaultOwner: 'p2', defaultTroops: 1, maxTroops: 3 },
    { id: 'madagascar', name: 'Madagaskar', continent: 'Africa', x: 635, y: 465, defaultOwner: null, defaultTroops: 1, maxTroops: 2 },

    // --- ASIA (8) ---
    { id: 'russia_w', name: 'Rusia Barat & Ural', continent: 'Asia', x: 635, y: 105, defaultOwner: 'p2', defaultTroops: 1, maxTroops: 4 },
    { id: 'siberia', name: 'Siberia Tengah', continent: 'Asia', x: 760, y: 100, defaultOwner: 'p2', defaultTroops: 1, maxTroops: 3 },
    { id: 'kamchatka', name: 'Kamchatka & Far East', continent: 'Asia', x: 895, y: 95, defaultOwner: null, defaultTroops: 1, maxTroops: 3 },
    { id: 'm_east', name: 'Timur Tengah & Persia', continent: 'Asia', x: 630, y: 290, defaultOwner: 'p2', defaultTroops: 1, maxTroops: 4 },
    { id: 'india', name: 'India & Asia Selatan', continent: 'Asia', x: 710, y: 310, defaultOwner: 'p2', defaultTroops: 1, maxTroops: 3 },
    { id: 'china', name: 'Tiongkok & Asia Timur', continent: 'Asia', x: 775, y: 215, defaultOwner: 'p2', defaultTroops: 1, maxTroops: 4 },
    { id: 'japan', name: 'Kepulauan Jepang', continent: 'Asia', x: 910, y: 210, defaultOwner: null, defaultTroops: 1, maxTroops: 3 },
    { id: 'se_asia', name: 'Asia Tenggara & Nusantara', continent: 'Asia', x: 795, y: 335, defaultOwner: 'p2', defaultTroops: 1, maxTroops: 3 },

    // --- OSEANIA (2) ---
    { id: 'w_australia', name: 'Australia Barat', continent: 'Oceania', x: 845, y: 475, defaultOwner: null, defaultTroops: 1, maxTroops: 3 },
    { id: 'e_australia', name: 'Australia Timur & NZ', continent: 'Oceania', x: 915, y: 475, defaultOwner: null, defaultTroops: 1, maxTroops: 3 }
  ];

  const WORLD_CONNECTIONS = {
    alaska: ['nw_terr', 'kamchatka'],
    nw_terr: ['alaska', 'quebec', 'usa_w', 'greenland'],
    quebec: ['nw_terr', 'greenland', 'usa_e'],
    greenland: ['nw_terr', 'quebec', 'iceland'],
    usa_w: ['alaska', 'nw_terr', 'usa_e', 'mexico'],
    usa_e: ['nw_terr', 'quebec', 'usa_w', 'mexico'],
    mexico: ['usa_w', 'usa_e', 'venezuela'],
    venezuela: ['mexico', 'brazil', 'peru'],
    brazil: ['venezuela', 'peru', 'argentina', 'n_africa'],
    peru: ['venezuela', 'brazil', 'argentina'],
    argentina: ['peru', 'brazil'],
    iceland: ['greenland', 'uk', 'scandinavia'],
    uk: ['iceland', 'scandinavia', 'w_europe'],
    scandinavia: ['iceland', 'uk', 'w_europe', 'e_europe', 'russia_w'],
    w_europe: ['uk', 'scandinavia', 's_europe', 'e_europe', 'n_africa'],
    s_europe: ['w_europe', 'e_europe', 'n_africa', 'egypt'],
    e_europe: ['w_europe', 's_europe', 'scandinavia', 'russia_w', 'm_east'],
    n_africa: ['w_europe', 's_europe', 'brazil', 'egypt', 's_africa'],
    egypt: ['n_africa', 's_europe', 'e_africa', 'm_east'],
    e_africa: ['egypt', 's_africa', 'madagascar', 'm_east'],
    s_africa: ['n_africa', 'e_africa', 'madagascar'],
    madagascar: ['e_africa', 's_africa', 'w_australia'],
    russia_w: ['scandinavia', 'e_europe', 'siberia', 'm_east'],
    siberia: ['russia_w', 'kamchatka', 'china'],
    kamchatka: ['siberia', 'alaska', 'japan', 'china'],
    m_east: ['e_europe', 'egypt', 'e_africa', 'russia_w', 'india'],
    india: ['m_east', 'china', 'se_asia'],
    china: ['russia_w', 'siberia', 'kamchatka', 'india', 'se_asia', 'japan'],
    japan: ['kamchatka', 'china'],
    se_asia: ['india', 'china', 'w_australia'],
    w_australia: ['se_asia', 'madagascar', 'e_australia'],
    e_australia: ['w_australia']
  };

  function initTerritoryGame(room) {
    const playerIds = Object.keys(room.players);
    const p1Id = playerIds[0];
    const p2Id = playerIds[1] || 'ai_rival';
    const p1Name = room.players[p1Id]?.name || 'Panglima Merah';
    const p2Name = room.players[p2Id]?.name || 'Panglima Oranye';

    const territories = {};
    // Randomize initial points & strongholds per territory!
    const p1Terrs = WORLD_TERRITORIES_DEF.filter(d => d.defaultOwner === 'p1');
    const p2Terrs = WORLD_TERRITORIES_DEF.filter(d => d.defaultOwner === 'p2');
    const p1Stronghold = p1Terrs[Math.floor(Math.random() * p1Terrs.length)].id;
    const p2Stronghold = p2Terrs[Math.floor(Math.random() * p2Terrs.length)].id;

    WORLD_TERRITORIES_DEF.forEach(def => {
      let owner = null;
      if (def.defaultOwner === 'p1') owner = p1Id;
      if (def.defaultOwner === 'p2') owner = p2Id;

      const maxTroops = def.maxTroops || 4;
      let troops = 1;

      if (owner) {
        if (def.id === p1Stronghold || def.id === p2Stronghold) {
          // Stronghold territory gets full capacity (e.g. 4/4 or 3/3)
          troops = maxTroops;
        } else {
          // Other player territories get random troops: 1, 2, or 3 (e.g. 1/4, 2/4, 1/3, 2/3, 1/2)
          const maxPossible = Math.max(1, maxTroops - 1);
          troops = Math.floor(Math.random() * maxPossible) + 1;
        }
      } else {
        // Neutral territories have random 1 or 2 troops (e.g. 1/3, 2/3, 1/4, 1/2)
        troops = Math.floor(Math.random() * 2) + 1;
      }

      territories[def.id] = {
        id: def.id,
        name: def.name,
        continent: def.continent,
        x: def.x,
        y: def.y,
        troops,
        maxTroops,
        owner
      };
    });

    room.gameData = {
      territories,
      connections: WORLD_CONNECTIONS,
      turn: p1Id,
      phase: 'attack', // 'attack' then 'reinforce'
      turnNumber: 1,
      winner: null,
      winReason: null,
      history: [
        `⚔️ Penaklukan Dunia Dimulai! Pasukan Merah (${p1Name}) vs Pasukan Oranye (${p2Name}).`
      ],
      players: {
        [p1Id]: {
          id: p1Id,
          name: p1Name,
          color: '#ef4444', // Red
          reinforcements: 0, // Starts at 0, reinforcements given at end of attack!
          avatar: '👧'
        },
        [p2Id]: {
          id: p2Id,
          name: p2Name,
          color: '#f97316', // Orange
          reinforcements: 0,
          avatar: '🧑'
        }
      }
    };
  }

  function canPlayerAttack(gd, playerId) {
    return Object.values(gd.territories).some(t => t.owner === playerId && t.troops >= 2);
  }

  function transitionToReinforce(gd, socketId) {
    const player = gd.players[socketId];
    if (!player || gd.phase === 'reinforce') return;
    gd.phase = 'reinforce';
    const owned = Object.values(gd.territories).filter(t => t.owner === socketId).length;
    const newTroops = Math.max(3, Math.floor(owned / 3));
    player.reinforcements = newTroops;
    gd.history.unshift(`🛡️ Fase Serang selesai! ${player.name} mendapatkan +${newTroops} Pasukan Cadangan untuk memperkuat wilayah.`);
  }

  socket.on('territory:init', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (!['territory', 'tictactoe'].includes(room.game)) return;
    if (!room.gameData.territories) {
      initTerritoryGame(room);
    }
    io.to(currentRoomId).emit('territory:update', room.gameData);
  });

  socket.on('territory:deploy', ({ territoryId }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (!['territory', 'tictactoe'].includes(room.game) || !room.gameData.territories) return;

    const gd = room.gameData;
    if (gd.turn !== socket.id || gd.winner) return;

    const player = gd.players[socket.id];
    const terr = gd.territories[territoryId];
    if (!player || !terr) return;
    if (player.reinforcements <= 0) return;

    // Reinforce owned territory (clamp to maxTroops so no overflow, e.g. 4/4)
    if (terr.owner === socket.id) {
      if (terr.troops >= (terr.maxTroops || 4)) return; // Already full capacity!
      player.reinforcements -= 1;
      terr.troops += 1;
      gd.history.unshift(`🛡️ ${player.name} memperkuat ${terr.name} (${terr.troops}/${terr.maxTroops}). Sisa cadangan: ${player.reinforcements}.`);
      if (gd.history.length > 25) gd.history.pop();
      io.to(currentRoomId).emit('territory:update', gd);
      return;
    }
  });

  socket.on('territory:attack', ({ fromId, toId }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (!['territory', 'tictactoe'].includes(room.game) || !room.gameData.territories) return;

    const gd = room.gameData;
    if (gd.turn !== socket.id || gd.winner) return;
    if (gd.phase !== 'attack') return; // Can only attack in attack phase!

    const player = gd.players[socket.id];
    const fromTerr = gd.territories[fromId];
    const toTerr = gd.territories[toId];
    if (!player || !fromTerr || !toTerr) return;
    if (fromTerr.owner !== socket.id || fromTerr.troops < 2) return;

    // Check valid connection (land border or sea route)
    const validNeighbors = WORLD_CONNECTIONS[fromId] || [];
    if (!validNeighbors.includes(toId)) return;

    // Case 1: Transfer troops to own connected territory
    if (toTerr.owner === socket.id) {
      const transferCount = fromTerr.troops - 1;
      fromTerr.troops = 1;
      toTerr.troops = Math.min(toTerr.maxTroops || 4, toTerr.troops + transferCount);
      gd.history.unshift(`🚚 ${player.name} memindahkan ${transferCount} pasukan dari ${fromTerr.name} ke ${toTerr.name}.`);
      if (gd.history.length > 25) gd.history.pop();
      io.to(currentRoomId).emit('territory:update', gd);
      return;
    }

    // Case 2: Invade NEUTRAL territory (Expansive Claiming!)
    if (toTerr.owner === null) {
      const invaders = fromTerr.troops - 1;
      if (invaders >= toTerr.troops) {
        toTerr.owner = socket.id;
        toTerr.troops = Math.min(toTerr.maxTroops || 4, Math.max(1, invaders - Math.floor(toTerr.troops * 0.5)));
        fromTerr.troops = 1;
        gd.history.unshift(`🚩 ${player.name} BERHASIL MEREBUT WILAYAH ${toTerr.name}!`);
      } else {
        toTerr.troops -= invaders;
        fromTerr.troops = 1;
        gd.history.unshift(`⚔️ ${player.name} menyerang wilayah netral ${toTerr.name} (Sisa pertahanan: ${toTerr.troops}).`);
      }

      // Check Victory Condition:
      const allTerrs = Object.values(gd.territories);
      const myTerrCount = allTerrs.filter(t => t.owner === socket.id).length;
      const opponentId = Object.keys(gd.players).find(id => id !== socket.id);
      const oppTerrCount = opponentId ? allTerrs.filter(t => t.owner === opponentId).length : 0;

      if (myTerrCount >= 18 || oppTerrCount === 0) {
        gd.winner = socket.id;
        gd.winReason = `Penaklukan Dunia Mutlak (${myTerrCount} dari 32 Wilayah Berhasil Dikuasai)!`;
        gd.history.unshift(`👑 KEMENANGAN MUTLAK! ${player.name} telah menaklukkan peta dunia!`);
      }

      // Check if player has no more attack troops left -> auto transition to reinforce phase!
      if (!gd.winner && !canPlayerAttack(gd, socket.id)) {
        transitionToReinforce(gd, socket.id);
      }

      if (gd.history.length > 25) gd.history.pop();
      io.to(currentRoomId).emit('territory:update', gd);
      return;
    }

    // Case 3: Invade ENEMY territory (Player vs Player Battle!)
    const invaders = fromTerr.troops - 1;
    const attRoll = Math.floor(Math.random() * 6) + 1;
    const defRoll = Math.floor(Math.random() * 6) + 1;
    const attPower = invaders + attRoll;
    const defPower = toTerr.troops + defRoll;

    if (attPower >= defPower) {
      // 🏆 ATTACKER CONQUERS ENEMY TERRITORY!
      toTerr.owner = socket.id;
      const casualties = Math.floor(toTerr.troops * 0.4);
      const remainingInvaders = Math.max(1, invaders - casualties);
      toTerr.troops = Math.min(toTerr.maxTroops || 4, remainingInvaders);
      fromTerr.troops = 1;

      gd.history.unshift(
        `💥 ${player.name} BERHASIL MEREBUT ${toTerr.name}! [⚔️ ${attPower} (Dadu ${attRoll}) vs 🛡️ ${defPower} (Dadu ${defRoll})]`
      );

      // Check Victory Condition:
      const allTerrs = Object.values(gd.territories);
      const myTerrCount = allTerrs.filter(t => t.owner === socket.id).length;
      const opponentId = Object.keys(gd.players).find(id => id !== socket.id);
      const oppTerrCount = opponentId ? allTerrs.filter(t => t.owner === opponentId).length : 0;

      if (myTerrCount >= 18 || oppTerrCount === 0) {
        gd.winner = socket.id;
        gd.winReason = `Penaklukan Dunia Mutlak (${myTerrCount} dari 32 Wilayah Berhasil Dikuasai)!`;
        gd.history.unshift(`👑 KEMENANGAN MUTLAK! ${player.name} telah menaklukkan peta dunia!`);
      }
    } else {
      // 🛡️ ATTACKER REPELLED!
      fromTerr.troops = 1;
      const defCasualties = Math.max(0, Math.floor(invaders * 0.35));
      toTerr.troops = Math.max(1, toTerr.troops - defCasualties);

      gd.history.unshift(
        `🛡️ Serangan ${player.name} ke ${toTerr.name} TERTAHAN! [⚔️ ${attPower} (Dadu ${attRoll}) vs 🛡️ ${defPower} (Dadu ${defRoll})]`
      );
    }

    // Check if player has no more attack troops left -> auto transition to reinforce phase!
    if (!gd.winner && !canPlayerAttack(gd, socket.id)) {
      transitionToReinforce(gd, socket.id);
    }

    if (gd.history.length > 25) gd.history.pop();
    io.to(currentRoomId).emit('territory:update', gd);
  });

  socket.on('territory:endTurn', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (!['territory', 'tictactoe'].includes(room.game) || !room.gameData.territories) return;

    const gd = room.gameData;
    if (gd.turn !== socket.id || gd.winner) return;

    if (gd.phase === 'attack') {
      // End attack phase -> enter reinforce phase!
      transitionToReinforce(gd, socket.id);
      if (gd.history.length > 25) gd.history.pop();
      io.to(currentRoomId).emit('territory:update', gd);
      return;
    }

    // Currently in 'reinforce' phase -> Finish turn and hand over to next player!
    const playerIds = Object.keys(gd.players);
    const nextTurnId = playerIds.find(id => id !== socket.id) || socket.id;
    const nextPlayer = gd.players[nextTurnId];
    const currentPlayer = gd.players[socket.id];
    if (currentPlayer) currentPlayer.reinforcements = 0;

    gd.turn = nextTurnId;
    gd.phase = 'attack';
    if (nextPlayer) nextPlayer.reinforcements = 0;
    gd.turnNumber++;
    gd.history.unshift(`⚔️ Giliran berganti ke ${nextPlayer?.name || 'Lawan'} (Fase Serang Dimulai!).`);
    if (gd.history.length > 25) gd.history.pop();

    io.to(currentRoomId).emit('territory:update', gd);
  });

  socket.on('territory:restart', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    initTerritoryGame(room);
    io.to(currentRoomId).emit('territory:update', room.gameData);
  });

  // Backward compatibility alias for ttt
  socket.on('ttt:move', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (!room.gameData.tiles) initTerritoryGame(room);
    io.to(currentRoomId).emit('territory:update', room.gameData);
  });
  socket.on('ttt:restart', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    initTerritoryGame(room);
    io.to(currentRoomId).emit('territory:update', room.gameData);
  });

  // =================== QUIZ SPECIFIC ===================
  socket.on('quiz:setCategory', ({ category }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (room.hostId !== socket.id) return;
    room.quizCategory = category;
    io.to(currentRoomId).emit('quiz:categoryUpdated', { category });
  });

  socket.on('quiz:answer', ({ questionIndex, answerIndex, timeLeft }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (room.game !== 'quiz') return;

    const player = room.players[socket.id];
    if (!player) return;

    io.to(currentRoomId).emit('quiz:playerAnswered', {
      playerId: socket.id,
      questionIndex,
      answerIndex,
      timeLeft
    });
  });

  socket.on('quiz:syncScore', ({ score }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const player = room.players[socket.id];
    if (player) {
      player.score = score;
      io.to(currentRoomId).emit('quiz:scoreBoard', {
        players: Object.values(room.players).map(p => ({ id: p.id, name: p.name, color: p.color, score: p.score }))
      });
    }
  });

  // =================== SAMBUNG KATA 3D (ROBLOX STYLE) ===================
  socket.on('sambungkata:ready', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (room.game === 'sambungkata' && room.gameData) {
      socket.emit('sambungkata:update', room.gameData);
    }
  });

  socket.on('sambungkata:typing', ({ text }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (room.game !== 'sambungkata' || !room.gameData) return;
    // Siarkan kata yang sedang diketik lawan ke seluruh pemain di dalam room
    socket.to(currentRoomId).emit('sambungkata:playerTyping', {
      playerId: socket.id,
      text: (text || '').slice(0, 35)
    });
  });

  socket.on('sambungkata:submit', ({ word }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (room.game !== 'sambungkata' || !room.gameData) return;
    const gd = room.gameData;
    if (gd.currentTurnId !== socket.id || gd.status !== 'playing') return;

    const cleanWord = (word || '').trim().toUpperCase();
    if (cleanWord.length < 3) {
      return socket.emit('sambungkata:invalid', 'Kata minimal 3 huruf!');
    }

    if (!/^[A-Z]+$/.test(cleanWord)) {
      return socket.emit('sambungkata:invalid', 'Hanya boleh berisi huruf!');
    }

    if (gd.usedWords.includes(cleanWord)) {
      return socket.emit('sambungkata:invalid', `Kata "${cleanWord}" sudah pernah digunakan!`);
    }

    // ATURAN RESMI: Kata HARUS BERAWALAN dengan 2 huruf prompt di kartu!
    if (!cleanWord.startsWith(gd.prompt)) {
      return socket.emit('sambungkata:invalid', `Kata harus BERAWALAN dengan "${gd.prompt}"!`);
    }

    // CEK VALIDASI KAMUS KATA (KBBI & Bahasa Sehari-hari / Slang Gaul)
    if (KBBI_SET.size > 0 && !KBBI_SET.has(cleanWord)) {
      return socket.emit('sambungkata:invalid', `Kata "${cleanWord}" tidak ditemukan dalam kamus kata!`);
    }

    // Ambil 2 huruf TERAKHIR dari kata ini untuk dioper ke pemain berikutnya!
    const nextPrompt = cleanWord.slice(-2);

    // Word is accepted!
    gd.usedWords.push(cleanWord);
    gd.lastWord = cleanWord;
    const p = gd.playerData[socket.id];
    if (p) {
      const earned = 100 + (gd.timeLeft * 10) + (cleanWord.length * 15);
      p.score += earned;
    }

    io.to(currentRoomId).emit('sambungkata:wordAccepted', {
      playerId: socket.id,
      playerName: p ? p.name : 'Pemain',
      word: cleanWord,
      score: p ? p.score : 0,
      nextPrompt
    });

    advanceSambungKataTurn(room, nextPrompt);
  });

  socket.on('sambungkata:restart', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    initSambungKataGame(room);
    io.to(currentRoomId).emit('sambungkata:update', room.gameData);
  });

  // =================== TENNIS 1v1 ===================
  socket.on('tennis:state', (data) => {
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit('tennis:state', data);
  });

  socket.on('tennis:paddle', (data) => {
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit('tennis:paddle', data);
  });

  socket.on('tennis:point', (data) => {
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit('tennis:point', data);
  });

  socket.on('tennis:gameover', (data) => {
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit('tennis:gameover', data);
  });

  socket.on('tennis:restart', () => {
    if (!currentRoomId) return;
    io.to(currentRoomId).emit('tennis:restart');
  });

  // =================== DISCONNECT ===================
  socket.on('disconnect', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];

    delete room.players[socket.id];
    const remainingPlayers = Object.keys(room.players);

    if (remainingPlayers.length === 0) {
      clearSkTimer(currentRoomId);
      delete rooms[currentRoomId];
    } else {
      // If host left, transfer host
      if (room.hostId === socket.id) {
        room.hostId = remainingPlayers[0];
        room.players[room.hostId].isHost = true;
        room.players[room.hostId].ready = true;
      }
      io.to(currentRoomId).emit('playerLeft', {
        leftId: socket.id,
        newHostId: room.hostId,
        room
      });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 Multi-Game Hub Server Berjalan di:`);
  console.log(`💻 Laptop / PC : http://localhost:${PORT}`);
  console.log(`📱 HP / Mobile : http://192.168.2.85:${PORT}`);
  console.log(`===============================================`);
});
