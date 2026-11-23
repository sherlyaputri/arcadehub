// Quiz Trivia Multiplayer Game Module
class QuizGame {
  constructor(container, socket, roomInfo, selfId) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.selfId = selfId;

    this.currentIndex = 0;
    this.score = 0;
    this.timer = 15;
    this.timerInterval = null;
    this.answered = false;

    this.questions = [
      {
        q: "Benua terbesar di dunia berdasarkan luas daratan adalah...",
        options: ["Afrika", "Asia", "Amerika Utara", "Eropa"],
        correct: 1
      },
      {
        q: "Ibukota negara Australia yang resmi adalah...",
        options: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
        correct: 2
      },
      {
        q: "Mobil Formula 1 tercepat digerakkan oleh mesin berbahan bakar...",
        options: ["Bensin Khusus & Hybrid", "Baterai Penuh 100%", "Solar Murni", "Nitrogen Cair"],
        correct: 0
      },
      {
        q: "Planet manakah yang terkenal dijuluki sebagai 'Planet Merah'?",
        options: ["Venus", "Mars", "Jupiter", "Saturnus"],
        correct: 1
      },
      {
        q: "Bahasa pemrograman yang sering digunakan untuk interaktivitas web adalah...",
        options: ["JavaScript", "HTML", "C++", "Assembly"],
        correct: 0
      }
    ];

    this.setupUI();
    this.bindSocket();
    this.loadQuestion(0);
  }

  setupUI() {
    this.container.innerHTML = `
      <div class="quiz-wrapper">
        <div class="quiz-header">
          <div class="quiz-progress" id="quizProgress">Pertanyaan 1 / ${this.questions.length}</div>
          <div class="quiz-timer" id="quizTimer">⏱️ 15s</div>
          <div class="quiz-score" id="quizScore">Skor: 0</div>
        </div>
        <div class="quiz-question-box">
          <h2 id="quizQuestion">Memuat pertanyaan...</h2>
        </div>
        <div class="quiz-options" id="quizOptions"></div>
        <div class="quiz-leaderboard" id="quizLeaderboard">
          <h4>Papan Skor Sementara</h4>
          <div id="quizScoreList"></div>
        </div>
      </div>
    `;

    this.questionEl = document.getElementById('quizQuestion');
    this.optionsEl = document.getElementById('quizOptions');
    this.progressEl = document.getElementById('quizProgress');
    this.timerEl = document.getElementById('quizTimer');
    this.scoreEl = document.getElementById('quizScore');
    this.scoreListEl = document.getElementById('quizScoreList');
  }

  bindSocket() {
    this.scoreBoardHandler = ({ players }) => {
      players.sort((a, b) => b.score - a.score);
      this.scoreListEl.innerHTML = players.map((p, idx) => `
        <div class="score-row ${p.id === this.selfId ? 'self-row' : ''}">
          <span>#${idx + 1} ${p.name}</span>
          <strong>${p.score} Poin</strong>
        </div>
      `).join('');
    };

    this.socket.on('quiz:scoreBoard', this.scoreBoardHandler);
  }

  loadQuestion(index) {
    if (index >= this.questions.length) {
      this.finishQuiz();
      return;
    }

    this.currentIndex = index;
    this.answered = false;
    this.timer = 15;

    const qData = this.questions[index];
    this.progressEl.textContent = `Pertanyaan ${index + 1} / ${this.questions.length}`;
    this.questionEl.textContent = qData.q;
    this.timerEl.textContent = `⏱️ ${this.timer}s`;
    this.timerEl.classList.remove('urgent');

    this.optionsEl.innerHTML = qData.options.map((opt, i) => `
      <button class="quiz-opt-btn" data-opt="${i}">
        <span class="opt-label">${String.fromCharCode(65 + i)}</span>
        <span class="opt-text">${opt}</span>
      </button>
    `).join('');

    const btns = this.optionsEl.querySelectorAll('.quiz-opt-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.answered) return;
        const chosen = parseInt(btn.getAttribute('data-opt'));
        this.selectAnswer(chosen, btns);
      });
    });

    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timer--;
      this.timerEl.textContent = `⏱️ ${this.timer}s`;
      if (this.timer <= 5) this.timerEl.classList.add('urgent');

      if (this.timer <= 0) {
        clearInterval(this.timerInterval);
        if (!this.answered) {
          this.selectAnswer(-1, btns);
        }
      }
    }, 1000);
  }

  selectAnswer(chosenIdx, btns) {
    this.answered = true;
    clearInterval(this.timerInterval);

    const qData = this.questions[this.currentIndex];
    const isCorrect = chosenIdx === qData.correct;

    if (isCorrect) {
      const earned = 100 + (this.timer * 10);
      this.score += earned;
      this.scoreEl.textContent = `Skor: ${this.score}`;
      if (window.soundManager) window.soundManager.playBeep(784, 0.2, 'sine');
    } else {
      if (window.soundManager) window.soundManager.playBeep(220, 0.25, 'sawtooth');
    }

    btns.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === qData.correct) {
        btn.classList.add('correct');
      } else if (idx === chosenIdx) {
        btn.classList.add('wrong');
      }
    });

    this.socket.emit('quiz:syncScore', { score: this.score });

    // Next question after 3 seconds
    setTimeout(() => {
      this.loadQuestion(this.currentIndex + 1);
    }, 2800);
  }

  finishQuiz() {
    clearInterval(this.timerInterval);
    this.container.innerHTML = `
      <div class="quiz-finished">
        <h2>🎉 Kuis Selesai!</h2>
        <div class="final-score">Total Skor Kamu: <strong>${this.score}</strong></div>
        <p>Lihat papan peringkat akhir di sebelah kanan atau ruang obrolan!</p>
      </div>
    `;
    if (window.soundManager) window.soundManager.winFanfare();
  }

  destroy() {
    clearInterval(this.timerInterval);
    this.socket.off('quiz:scoreBoard', this.scoreBoardHandler);
    this.container.innerHTML = '';
  }
}

window.QuizGame = QuizGame;
