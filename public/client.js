// ArcadeHub Client Orchestrator
const socket = io();

// State
let selfId = null;
let currentRoom = null;
let activeGameInstance = null;

// DOM Elements
const screenHome = document.getElementById('screenHome');
const screenLobby = document.getElementById('screenLobby');
const screenGame = document.getElementById('screenGame');

const navRoomCode = document.getElementById('navRoomCode');
const displayRoomCode = document.getElementById('displayRoomCode');
const btnSoundToggle = document.getElementById('btnSoundToggle');

// Home Inputs
const createPlayerName = document.getElementById('createPlayerName');
const btnCreateRoom = document.getElementById('btnCreateRoom');

const joinRoomCode = document.getElementById('joinRoomCode');
const joinPlayerName = document.getElementById('joinPlayerName');
const btnJoinRoom = document.getElementById('btnJoinRoom');

// Lobby Elements
const currentGameLabel = document.getElementById('currentGameLabel');
const hostGameSelector = document.getElementById('hostGameSelector');
const selectGame = document.getElementById('selectGame');
const quizCategoryDisplay = document.getElementById('quizCategoryDisplay');
const quizCategoryCurrentLabel = document.getElementById('quizCategoryCurrentLabel');
const hostQuizCategoryWrap = document.getElementById('hostQuizCategoryWrap');
const selectQuizCategory = document.getElementById('selectQuizCategory');
const playersList = document.getElementById('playersList');
const playerCount = document.getElementById('playerCount');
const btnCopyRoomLink = document.getElementById('btnCopyRoomLink');
const btnToggleReady = document.getElementById('btnToggleReady');
const btnStartGame = document.getElementById('btnStartGame');

// Chat Elements
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

// Game Arena Elements
const arenaGameTitle = document.getElementById('arenaGameTitle');
const arenaViewport = document.getElementById('arenaViewport');
const btnBackToLobby = document.getElementById('btnBackToLobby');
const racingCanvas = document.getElementById('racingCanvas');
const domGameContainer = document.getElementById('domGameContainer');
const mobileControls = document.getElementById('mobileControls');

// Podium Modal
const podiumModal = document.getElementById('podiumModal');
const podiumList = document.getElementById('podiumList');
const btnClosePodium = document.getElementById('btnClosePodium');

function initDefaultName() {
  const randomNum = Math.floor(100 + Math.random() * 900);
  createPlayerName.value = 'Racer_' + randomNum;
  joinPlayerName.value = 'Challenger_' + randomNum;
}

// ==================== SCREEN SWITCHER ====================
function showScreen(screen) {
  [screenHome, screenLobby, screenGame].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

// ==================== HOME EVENTS ====================
btnCreateRoom.addEventListener('click', () => {
  if (window.soundManager) window.soundManager.init();
  const name = createPlayerName.value.trim() || 'Host';
  socket.emit('createRoom', { name });
});

btnJoinRoom.addEventListener('click', () => {
  if (window.soundManager) window.soundManager.init();
  const roomId = joinRoomCode.value.trim();
  const name = joinPlayerName.value.trim() || 'Player';
  if (!roomId) {
    alert('Masukkan kode room terlebih dahulu!');
    return;
  }
  socket.emit('joinRoom', { roomId, name });
});

// Sound Toggle
btnSoundToggle.addEventListener('click', () => {
  if (!window.soundManager) return;
  window.soundManager.toggleMute();
  btnSoundToggle.textContent = window.soundManager.muted ? '🔇' : '🔊';
});

// Copy Room Code
btnCopyRoomLink.addEventListener('click', () => {
  if (!currentRoom) return;
  navigator.clipboard.writeText(currentRoom.id).then(() => {
    btnCopyRoomLink.textContent = '✅ Disalin!';
    setTimeout(() => { btnCopyRoomLink.textContent = '📋 Salin Kode Room'; }, 1500);
  });
});

// ==================== LOBBY EVENTS ====================
selectGame.addEventListener('change', () => {
  const newGame = selectGame.value;
  socket.emit('changeGame', newGame);
});

if (selectQuizCategory) {
  selectQuizCategory.addEventListener('change', () => {
    const newCat = selectQuizCategory.value;
    socket.emit('quiz:setCategory', { category: newCat });
  });
}

btnToggleReady.addEventListener('click', () => {
  if (window.soundManager) window.soundManager.click();
  socket.emit('toggleReady');
});

btnStartGame.addEventListener('click', () => {
  if (window.soundManager) window.soundManager.click();
  socket.emit('startGame');
});

btnBackToLobby.addEventListener('click', () => {
  socket.emit('backToLobby');
});

// Chat Send
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    socket.emit('chatMessage', text);
    chatInput.value = '';
  }
});

// ==================== SOCKET EVENT LISTENERS ====================
socket.on('connect', () => {
  selfId = socket.id;
});

socket.on('errorMsg', (msg) => {
  alert(msg);
});

socket.on('roomJoined', ({ room, selfId: myId }) => {
  selfId = myId;
  currentRoom = room;
  navRoomCode.style.display = 'block';
  displayRoomCode.textContent = room.id;
  showScreen(screenLobby);
  renderLobby();
});

socket.on('playerJoined', ({ player, room }) => {
  currentRoom = room;
  renderLobby();
  addChatMessage({
    sender: 'Sistem',
    color: '#00ff88',
    text: `${player.name} bergabung ke room!`
  });
});

socket.on('playerLeft', ({ leftId, newHostId, room }) => {
  currentRoom = room;
  renderLobby();
  addChatMessage({
    sender: 'Sistem',
    color: '#ff3366',
    text: `Seorang pemain meninggalkan room.`
  });
});

socket.on('roomUpdated', (room) => {
  currentRoom = room;
  renderLobby();
});

socket.on('gameChanged', ({ game, room }) => {
  currentRoom = room;
  renderLobby();
  if (window.soundManager) window.soundManager.click();
});

socket.on('quiz:categoryUpdated', ({ category }) => {
  if (currentRoom) {
    currentRoom.quizCategory = category;
    renderLobby();
  }
});

socket.on('chatMessage', (msg) => {
  addChatMessage(msg);
});

socket.on('gameStarted', ({ game, room }) => {
  currentRoom = room;
  launchGame(game);
});

socket.on('returnedToLobby', (room) => {
  currentRoom = room;
  if (activeGameInstance && activeGameInstance.destroy) {
    activeGameInstance.destroy();
    activeGameInstance = null;
  }
  if (window.soundManager) {
    window.soundManager.stopBGM();
  }
  podiumModal.style.display = 'none';
  showScreen(screenLobby);
  renderLobby();
});

// ==================== LOBBY RENDER ====================
function renderLobby() {
  if (!currentRoom) return;

  const isHost = currentRoom.hostId === selfId;
  const gameNames = {
    racing: '🚜 Mining Rally 3D (Balap Tambang & Konstruksi)',
    sambungkata: '🔤 Sambung Kata 3D (Roblox Style)',
    quiz: '🧠 Quiz Trivia Showdown',
    territory: '⚔️ Territory Conquest (Perebutan Wilayah)',
    tictactoe: '⚔️ Territory Conquest (Perebutan Wilayah)'
  };

  const categoryTitles = {
    matematika: '📐 Matematika (10 Soal)',
    umum: '🌍 Pengetahuan Umum (10 Soal)',
    kuliah: '🎓 Tingkat Kuliah (10 Soal)',
    smp: '🎒 Tingkat SMP (10 Soal)',
    sma: '📚 Tingkat SMA (10 Soal)',
    olahraga: '⚽ Olahraga (10 Soal)',
    teknologi: '💻 Teknologi & Komputer (10 Soal)'
  };

  currentGameLabel.textContent = gameNames[currentRoom.game] || currentRoom.game;
  hostGameSelector.style.display = isHost ? 'block' : 'none';
  selectGame.value = currentRoom.game;

  // Quiz category visibility & sync
  const isQuiz = currentRoom.game === 'quiz';
  if (quizCategoryDisplay) {
    quizCategoryDisplay.style.display = isQuiz ? 'block' : 'none';
    const currentCat = currentRoom.quizCategory || 'umum';
    if (quizCategoryCurrentLabel) {
      quizCategoryCurrentLabel.textContent = categoryTitles[currentCat] || currentCat;
    }
  }
  if (hostQuizCategoryWrap) {
    hostQuizCategoryWrap.style.display = (isQuiz && isHost) ? 'block' : 'none';
    if (selectQuizCategory) {
      selectQuizCategory.value = currentRoom.quizCategory || 'umum';
    }
  }

  const playersArr = Object.values(currentRoom.players);
  playerCount.textContent = playersArr.length;

  playersList.innerHTML = playersArr.map(p => `
    <div class="player-card">
      <div class="player-avatar" style="background-color: ${p.color};">
        ${p.name.charAt(0).toUpperCase()}
      </div>
      <div class="player-info">
        <div class="player-name">
          ${p.name}
          ${p.isHost ? '<span class="host-tag">HOST</span>' : ''}
        </div>
        <div class="ready-tag ${p.ready ? 'is-ready' : 'not-ready'}">
          ${p.ready ? '✅ Siap' : '⏳ Belum Siap'}
        </div>
      </div>
    </div>
  `).join('');

  // Host start game button logic
  btnStartGame.style.display = isHost ? 'block' : 'none';
  const myPlayer = currentRoom.players[selfId];
  if (myPlayer) {
    btnToggleReady.textContent = myPlayer.ready ? 'Batalkan Siap' : 'Siap (Ready)';
    btnToggleReady.className = myPlayer.ready ? 'btn btn-secondary' : 'btn btn-success';
  }
}

function addChatMessage({ sender, color, text, time }) {
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-msg';
  msgEl.innerHTML = `
    <span class="chat-sender" style="color: ${color || '#fff'}">${sender}:</span>
    <span>${text}</span>
    ${time ? `<span class="chat-time">${time}</span>` : ''}
  `;
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==================== GAME LAUNCHER ====================
function launchGame(gameId) {
  if (activeGameInstance && activeGameInstance.destroy) {
    activeGameInstance.destroy();
    activeGameInstance = null;
  }

  // Putar BGM musik yang pas untuk game ini
  if (window.soundManager) {
    window.soundManager.playBGM(gameId);
  }

  showScreen(screenGame);

  const isHost = currentRoom.hostId === selfId;
  btnBackToLobby.style.display = isHost ? 'block' : 'none';

  racingCanvas.style.display = 'none';
  domGameContainer.style.display = 'none';
  mobileControls.style.display = 'none';

  if (gameId === 'racing') {
    arenaGameTitle.textContent = '🚜 Mining Rally 3D (Balap Tambang & Konstruksi)';
    mobileControls.style.display = 'flex';

    if (window.RacingGame3D && typeof THREE !== 'undefined') {
      activeGameInstance = new window.RacingGame3D(arenaViewport, socket, currentRoom, selfId);
      activeGameInstance.startCountdown();
    } else {
      racingCanvas.style.display = 'block';
      activeGameInstance = new window.RacingGame(racingCanvas, socket, currentRoom, selfId);
      activeGameInstance.startCountdown();
    }

    setupTouchControls(activeGameInstance);

  } else if (gameId === 'territory' || gameId === 'tictactoe') {
    arenaGameTitle.textContent = '⚔️ Territory Conquest (Perebutan Wilayah)';
    domGameContainer.style.display = 'flex';
    if (window.TerritoryGame) {
      activeGameInstance = new window.TerritoryGame(domGameContainer, socket, currentRoom, selfId);
    } else if (window.TicTacToeGame) {
      activeGameInstance = new window.TicTacToeGame(domGameContainer, socket, currentRoom, selfId);
    }

  } else if (gameId === 'sambungkata') {
    arenaGameTitle.textContent = '🔤 Sambung Kata 3D (Roblox Style)';
    if (window.SambungKataGame3D) {
      activeGameInstance = new window.SambungKataGame3D(arenaViewport, socket, currentRoom, selfId);
    }
  } else if (gameId === 'quiz') {
    arenaGameTitle.textContent = '🧠 Quiz Trivia Showdown';
    domGameContainer.style.display = 'flex';
    activeGameInstance = new window.QuizGame(domGameContainer, socket, currentRoom, selfId);
  }
}

// Touch controls for mobile
function setupTouchControls(game) {
  const bindTouch = (id, keyName) => {
    const el = document.getElementById(id);
    if (!el) return;

    const start = (e) => {
      e.preventDefault();
      game.keys[keyName] = true;
      el.classList.add('active');
      if (navigator.vibrate) {
        try { navigator.vibrate(12); } catch (err) {}
      }
    };

    const end = (e) => {
      e.preventDefault();
      game.keys[keyName] = false;
      el.classList.remove('active');
    };

    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  bindTouch('btnTouchUp', 'up');
  bindTouch('btnTouchDown', 'down');
  bindTouch('btnTouchLeft', 'left');
  bindTouch('btnTouchRight', 'right');
  bindTouch('btnTouchNitro', 'nitro');
}

// Podium Result Handler
window.renderPodium = function(leaderboard) {
  if (!leaderboard || !leaderboard.length) return;
  podiumModal.style.display = 'flex';
  podiumList.innerHTML = leaderboard.map(item => `
    <div class="podium-item ${item.rank === 1 ? 'first' : ''}">
      <div style="display: flex; align-items: center; gap: 10px;">
        <strong style="font-size: 18px; color: ${item.rank === 1 ? '#ffd700' : '#fff'}">#${item.rank}</strong>
        <span style="font-weight: 700; color: ${item.color || '#fff'}">${item.name}</span>
      </div>
      <span style="font-size: 13px; color: var(--text-muted);">${(item.timeMs / 1000).toFixed(2)}s</span>
    </div>
  `).join('');
};

btnClosePodium.addEventListener('click', () => {
  podiumModal.style.display = 'none';
});

// Initialize on start
initDefaultName();
