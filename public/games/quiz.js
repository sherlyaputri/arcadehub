// Quiz Trivia Multiplayer Game Module - 7 Kategori Lengkap & 10 Soal per Kategori
const QUIZ_CATEGORIES = {
  matematika: {
    id: 'matematika',
    title: '📐 Matematika',
    color: '#06b6d4',
    questions: [
      {
        q: "Nilai dari 3³ + 4² - 5 adalah...",
        options: ["38", "35", "30", "42"],
        correct: 0
      },
      {
        q: "Jika 2x + 7 = 19, berapakah nilai x?",
        options: ["5", "6", "7", "8"],
        correct: 1
      },
      {
        q: "Berapakah luas segitiga dengan alas 12 cm dan tinggi 8 cm?",
        options: ["96 cm²", "48 cm²", "64 cm²", "54 cm²"],
        correct: 1
      },
      {
        q: "Nilai dari 5! (5 faktorial) adalah...",
        options: ["60", "100", "120", "150"],
        correct: 2
      },
      {
        q: "Berapakah 25% dari 480?",
        options: ["110", "120", "130", "140"],
        correct: 1
      },
      {
        q: "Sebuah dadu bermata 6 dilempar sekali. Peluang munculnya angka prima (2, 3, 5) adalah...",
        options: ["1/6", "1/3", "1/2", "2/3"],
        correct: 2
      },
      {
        q: "Bentuk sederhana dari √144 + √81 adalah...",
        options: ["19", "21", "23", "25"],
        correct: 1
      },
      {
        q: "Jumlah total ketiga sudut dalam sebuah bangun segitiga selalu sama dengan...",
        options: ["90°", "180°", "270°", "360°"],
        correct: 1
      },
      {
        q: "Berapakah hasil dari 7 × 8 - 15 ÷ 3?",
        options: ["49", "51", "53", "55"],
        correct: 1
      },
      {
        q: "Jika rata-rata dari angka 4, 8, 12, dan X adalah 10, berapakah nilai X?",
        options: ["14", "16", "18", "20"],
        correct: 1
      }
    ]
  },

  umum: {
    id: 'umum',
    title: '🌍 Pengetahuan Umum',
    color: '#3b82f6',
    questions: [
      {
        q: "Benua terbesar di dunia berdasarkan luas wilayah adalah...",
        options: ["Afrika", "Asia", "Amerika Utara", "Eropa"],
        correct: 1
      },
      {
        q: "Ibukota resmi negara Australia adalah...",
        options: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
        correct: 2
      },
      {
        q: "Samudra terluas dan terdalam di muka bumi adalah Samudra...",
        options: ["Atlantik", "Hindia", "Pasifik", "Arktik"],
        correct: 2
      },
      {
        q: "Piramida Giza yang megah dan bersejarah terletak di negara...",
        options: ["Mesir", "Yunani", "Turki", "Yordania"],
        correct: 0
      },
      {
        q: "Siapakah tokoh penemu lampu pijar listrik praktis yang terkenal di dunia?",
        options: ["Nikola Tesla", "Thomas Alva Edison", "Alexander Graham Bell", "Albert Einstein"],
        correct: 1
      },
      {
        q: "Menara Eiffel yang menjadi ikon pariwisata dunia berada di kota...",
        options: ["London", "Roma", "Paris", "Berlin"],
        correct: 2
      },
      {
        q: "Negara kepulauan terbesar di dunia dengan belasan ribu pulau adalah...",
        options: ["Filipina", "Indonesia", "Jepang", "Madagaskar"],
        correct: 1
      },
      {
        q: "Gunung tertinggi di atas permukaan laut di dunia adalah Gunung...",
        options: ["Gunung Fuji", "Gunung Kilimanjaro", "Gunung Everest", "Gunung Elbrus"],
        correct: 2
      },
      {
        q: "Mata uang resmi yang digunakan oleh negara Jepang adalah...",
        options: ["Won", "Yuan", "Yen", "Ringgit"],
        correct: 2
      },
      {
        q: "Planet keempat dari Matahari yang terkenal dijuluki sebagai 'Planet Merah' adalah...",
        options: ["Venus", "Mars", "Jupiter", "Merkurius"],
        correct: 1
      }
    ]
  },

  kuliah: {
    id: 'kuliah',
    title: '🎓 Tingkat Kuliah',
    color: '#8b5cf6',
    questions: [
      {
        q: "Titik pertemuan antara kurva permintaan dan penawaran di pasar disebut...",
        options: ["Titik Deflasi", "Titik Equilibrium (Keseimbangan)", "Titik Monopoli", "Margin Elastisitas"],
        correct: 1
      },
      {
        q: "Teori pemisahan kekuasaan negara menjadi Legislatif, Eksekutif, dan Yudikatif disebut...",
        options: ["Otonomi Daerah", "Trias Politica", "Aristokrasi", "Merkantilisme"],
        correct: 1
      },
      {
        q: "Dalam metodologi riset, hipotesis yang menyatakan tidak adanya pengaruh antar variabel disebut...",
        options: ["Hipotesis Alternatif (Ha)", "Hipotesis Nol (H0)", "Hipotesis Kausal", "Hipotesis Induktif"],
        correct: 1
      },
      {
        q: "Bapak Sosiologi Dunia yang mencetuskan istilah sosiologi dan hukum tiga tahap adalah...",
        options: ["Max Weber", "Karl Marx", "Auguste Comte", "Emile Durkheim"],
        correct: 2
      },
      {
        q: "Dalam ilmu statistika, nilai tengah dari sekumpulan data yang telah diurutkan disebut...",
        options: ["Mean", "Median", "Modus", "Standar Deviasi"],
        correct: 1
      },
      {
        q: "Teori hierarki kebutuhan manusia dari biologis hingga aktualisasi diri digagas oleh...",
        options: ["Sigmund Freud", "Abraham Maslow", "B.F. Skinner", "Jean Piaget"],
        correct: 1
      },
      {
        q: "Asas hukum yang menyatakan bahwa suatu undang-undang tidak boleh berlaku surut disebut asas...",
        options: ["Legalitas / Non-Retroaktif", "Lex Superior Derogat Legi Inferiori", "Pacta Sunt Servanda", "Presumption of Innocence"],
        correct: 0
      },
      {
        q: "Reaksi termodinamika yang menyerap energi panas/kalor dari lingkungan ke sistem adalah...",
        options: ["Eksoterm", "Endoterm", "Katalisis", "Adiabatik"],
        correct: 1
      },
      {
        q: "Pencetus teori ekonomi mekanisme pasar bebas 'Invisible Hand' dalam buku The Wealth of Nations adalah...",
        options: ["John Maynard Keynes", "Adam Smith", "David Ricardo", "Milton Friedman"],
        correct: 1
      },
      {
        q: "Dalam rekayasa perangkat lunak, singkatan resmi API adalah kepanjangan dari...",
        options: ["Advanced Program Interface", "Application Programming Interface", "Automated Protocol Integration", "Application Process Instruction"],
        correct: 1
      }
    ]
  },

  smp: {
    id: 'smp',
    title: '🎒 Tingkat SMP',
    color: '#10b981',
    questions: [
      {
        q: "Organ tubuh manusia yang bertugas memompa darah ke seluruh tubuh adalah...",
        options: ["Paru-paru", "Hati", "Jantung", "Ginjal"],
        correct: 2
      },
      {
        q: "Proses pembuatan zat makanan pada tumbuhan hijau dengan bantuan sinar matahari disebut...",
        options: ["Respirasi", "Fotosintesis", "Fermentasi", "Transpirasi"],
        correct: 1
      },
      {
        q: "Perubahan wujud zat dari benda gas menjadi benda cair disebut peristiwa...",
        options: ["Menguap", "Mengembun", "Menyublim", "Membeku"],
        correct: 1
      },
      {
        q: "Satuan Internasional (SI) baku untuk besaran suhu adalah...",
        options: ["Celcius", "Reamur", "Fahrenheit", "Kelvin"],
        correct: 3
      },
      {
        q: "Kerajaan Hindu tertua di Nusantara yang dibuktikan dengan penemuan prasasti Yupa adalah...",
        options: ["Kerajaan Kutai", "Kerajaan Tarumanegara", "Kerajaan Majapahit", "Kerajaan Sriwijaya"],
        correct: 0
      },
      {
        q: "Rumus kimia dari senyawa air yang kita konsumsi sehari-hari adalah...",
        options: ["CO2", "NaCl", "H2O", "O2"],
        correct: 2
      },
      {
        q: "Planet yang memiliki ukuran volume terbesar dalam sistem tata surya kita adalah...",
        options: ["Saturnus", "Neptunus", "Jupiter", "Uranus"],
        correct: 2
      },
      {
        q: "Bunyi sila ke-3 dalam rumusan dasar negara Pancasila adalah...",
        options: ["Keadilan Sosial bagi Seluruh Rakyat Indonesia", "Persatuan Indonesia", "Kemanusiaan yang Adil dan Beradab", "Ketuhanan Yang Maha Esa"],
        correct: 1
      },
      {
        q: "Satuan besaran gaya dalam Sistem Satuan Internasional (SI) adalah...",
        options: ["Joule", "Watt", "Newton", "Pascal"],
        correct: 2
      },
      {
        q: "Hubungan timbal balik antara lebah madu dan bunga yang saling menguntungkan adalah simbiosis...",
        options: ["Parasitisme", "Komensalisme", "Mutualisme", "Amensalisme"],
        correct: 2
      }
    ]
  },

  sma: {
    id: 'sma',
    title: '📚 Tingkat SMA',
    color: '#f59e0b',
    questions: [
      {
        q: "Partikel subatomik penyusun inti atom (nukleus) terdiri atas...",
        options: ["Proton dan Elektron", "Proton dan Neutron", "Elektron dan Positron", "Neutron dan Foton"],
        correct: 1
      },
      {
        q: "Organel sel yang berfungsi sebagai pusat pembangkit energi (the powerhouse) adalah...",
        options: ["Ribosom", "Mitokondria", "Lisosom", "Badan Golgi"],
        correct: 1
      },
      {
        q: "Nilai perbandingan trigonometri dari sin 30° adalah...",
        options: ["0", "1/2", "1/2 √3", "1"],
        correct: 1
      },
      {
        q: "Hukum dasar gerak benda yang dirumuskan secara matematis dengan F = m × a adalah...",
        options: ["Hukum Newton I", "Hukum Newton II", "Hukum Newton III", "Hukum Gravitasi Semesta"],
        correct: 1
      },
      {
        q: "Unsur kimia dengan simbol atom 'Fe' dan nomor atom 26 adalah...",
        options: ["Perak", "Emas", "Besi", "Tembaga"],
        correct: 2
      },
      {
        q: "Hukum pewarisan sifat genetika (pemisahan alel secara bebas) pertama kali digagas oleh...",
        options: ["Charles Darwin", "Gregor Mendel", "Louis Pasteur", "James Watson"],
        correct: 1
      },
      {
        q: "Suatu larutan kimia yang memiliki nilai derajat keasaman pH kurang dari 7 tergolong...",
        options: ["Basa", "Asam", "Netral", "Garam"],
        correct: 1
      },
      {
        q: "Turunan pertama f'(x) dari fungsi aljabar f(x) = 3x² + 5x - 7 adalah...",
        options: ["6x + 5", "3x + 5", "6x² + 5", "6x - 7"],
        correct: 0
      },
      {
        q: "Gelombang elektromagnetik yang memiliki energi dan frekuensi tertinggi adalah...",
        options: ["Sinar Inframerah", "Sinar Ultraviolet", "Sinar Gamma", "Gelombang Mikro"],
        correct: 2
      },
      {
        q: "Pembelahan sel yang menghasilkan 4 sel anak dengan jumlah kromosom haploid (n) adalah...",
        options: ["Mitosis", "Meiosis", "Amitosis", "Sitokinesis"],
        correct: 1
      }
    ]
  },

  olahraga: {
    id: 'olahraga',
    title: '⚽ Olahraga',
    color: '#ec4899',
    questions: [
      {
        q: "Berapa jumlah pemain dalam satu tim sepak bola yang bertanding di lapangan?",
        options: ["9 orang", "10 orang", "11 orang", "12 orang"],
        correct: 2
      },
      {
        q: "Kejuaraan bulutangkis beregu putra paling bergengsi di dunia dinamakan...",
        options: ["Uber Cup", "Thomas Cup", "Sudirman Cup", "All England"],
        correct: 1
      },
      {
        q: "Negara yang berhasil meraih gelar juara Piala Dunia FIFA tahun 2022 di Qatar adalah...",
        options: ["Prancis", "Argentina", "Brasil", "Jerman"],
        correct: 1
      },
      {
        q: "Panjang lintasan lari standar untuk 1 putaran penuh pada stadion atletik internasional adalah...",
        options: ["200 meter", "300 meter", "400 meter", "500 meter"],
        correct: 2
      },
      {
        q: "Tembakan bola basket yang berhasil masuk dari luar garis lengkung (three-point arc) bernilai...",
        options: ["1 Poin", "2 Poin", "3 Poin", "4 Poin"],
        correct: 2
      },
      {
        q: "Induk federasi organisasi sepak bola tingkat dunia adalah...",
        options: ["FIFA", "UEFA", "FIBA", "BWF"],
        correct: 0
      },
      {
        q: "Legenda bulutangkis tunggal putra Indonesia peraih medali emas Olimpiade Athena 2004 adalah...",
        options: ["Alan Budikusuma", "Taufik Hidayat", "Hendra Setiawan", "Jonatan Christie"],
        correct: 1
      },
      {
        q: "Turnamen tenis tertua di dunia yang diadakan di atas lapangan rumput adalah...",
        options: ["Wimbledon (Inggris)", "Roland Garros (Prancis)", "US Open (Amerika)", "Australian Open"],
        correct: 0
      },
      {
        q: "Berapa ronde batas waktu normal dalam satu laga tinju profesional kejuaraan dunia?",
        options: ["10 Ronde", "12 Ronde", "15 Ronde", "8 Ronde"],
        correct: 1
      },
      {
        q: "Gaya renang yang gerakannya menyerupai cara katak mengayuh di air disebut gaya...",
        options: ["Gaya Bebas", "Gaya Dada (Katak)", "Gaya Punggung", "Gaya Kupu-kupu"],
        correct: 1
      }
    ]
  },

  teknologi: {
    id: 'teknologi',
    title: '💻 Teknologi & Komputer',
    color: '#6366f1',
    questions: [
      {
        q: "Tokoh legendaris pendiri perusahaan Microsoft dan pelopor OS Windows adalah...",
        options: ["Steve Jobs", "Bill Gates", "Mark Zuckerberg", "Elon Musk"],
        correct: 1
      },
      {
        q: "Singkatan dari CPU dalam arsitektur perangkat keras komputer adalah...",
        options: ["Central Processing Unit", "Computer Power Unit", "Core Process Utility", "Central Peripheral Unit"],
        correct: 0
      },
      {
        q: "Protokol transmisi data web yang aman dan terenkripsi menggunakan awalan...",
        options: ["HTTP", "HTTPS", "FTP", "SMTP"],
        correct: 1
      },
      {
        q: "Bahasa pemrograman populer yang menggunakan maskot ular piton adalah...",
        options: ["Java", "Python", "Ruby", "Rust"],
        correct: 1
      },
      {
        q: "Media penyimpanan komputer berbasis chip memori flash yang jauh lebih cepat dari HDD adalah...",
        options: ["CD-ROM", "Floppy Disk", "SSD (Solid State Drive)", "Kaset Pita"],
        correct: 2
      },
      {
        q: "Sistem operasi open-source berlogo maskot pinguin yang mendominasi server dunia adalah...",
        options: ["Windows", "macOS", "Linux", "Solaris"],
        correct: 2
      },
      {
        q: "Istilah teknologi kecerdasan buatan dalam bahasa Inggris disingkat dengan...",
        options: ["IoT", "AI (Artificial Intelligence)", "VR", "AR"],
        correct: 1
      },
      {
        q: "Komponen komputer yang bertugas khusus merender grafis visual dan kalkulasi 3D adalah...",
        options: ["RAM", "GPU / VGA Card", "Power Supply", "Motherboard"],
        correct: 1
      },
      {
        q: "Satuan kecepatan jaringan internet yang setara dengan 1.000 Megabit per detik (Mbps) adalah...",
        options: ["1 Kilobit", "1 Gigabit (Gbps)", "1 Terabit", "1 Petabit"],
        correct: 1
      },
      {
        q: "Simbol '@' pertama kali digunakan untuk memisahkan nama user dan host email oleh...",
        options: ["Ray Tomlinson", "Tim Berners-Lee", "Alan Turing", "Linus Torvalds"],
        correct: 0
      }
    ]
  }
};

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

    // Load category from room or default to 'umum'
    this.categoryKey = (roomInfo && roomInfo.quizCategory) ? roomInfo.quizCategory : 'umum';
    if (!QUIZ_CATEGORIES[this.categoryKey]) this.categoryKey = 'umum';
    this.activeCategory = QUIZ_CATEGORIES[this.categoryKey];
    this.questions = this.activeCategory.questions;

    this.setupUI();
    this.bindSocket();
    this.loadQuestion(0);
  }

  setupUI() {
    this.container.innerHTML = `
      <div class="quiz-wrapper">
        <div class="quiz-header">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div class="quiz-category-badge" style="background: ${this.activeCategory.color}22; border: 1px solid ${this.activeCategory.color}; color: ${this.activeCategory.color}; font-weight: 800; font-size: 13px; padding: 4px 14px; border-radius: 20px;">
              ${this.activeCategory.title}
            </div>
            <div class="quiz-progress" id="quizProgress" style="font-size: 14px; font-weight: 700; color: #94a3b8;">
              Pertanyaan 1 / ${this.questions.length}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <div class="quiz-timer" id="quizTimer" style="font-size: 20px; font-weight: 900;">⏱️ 15s</div>
            <div class="quiz-score" id="quizScore" style="font-size: 18px; font-weight: 800; color: #f59e0b;">Skor: 0</div>
          </div>
        </div>

        <div class="quiz-question-box">
          <h2 id="quizQuestion" style="font-size: 20px; line-height: 1.5; color: #ffffff; min-height: 60px;">Memuat pertanyaan...</h2>
        </div>

        <div class="quiz-options" id="quizOptions"></div>

        <div class="quiz-leaderboard" id="quizLeaderboard" style="margin-top: 20px;">
          <h4 style="font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">📊 Papan Skor Sementara</h4>
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
        <div class="score-row ${p.id === this.selfId ? 'self-row' : ''}" style="display: flex; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.04); border-radius: 6px; margin-bottom: 4px;">
          <span>#${idx + 1} ${p.name}</span>
          <strong style="color: #fbbf24;">${p.score} Poin</strong>
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

    // Next question after 2.8 seconds
    setTimeout(() => {
      this.loadQuestion(this.currentIndex + 1);
    }, 2800);
  }

  finishQuiz() {
    clearInterval(this.timerInterval);
    const catTitle = this.activeCategory.title;
    this.container.innerHTML = `
      <div class="quiz-finished" style="text-align: center; padding: 40px 20px; background: #101626; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
        <h2 style="font-size: 28px; margin-bottom: 12px; color: #fff;">🎉 Kuis Selesai!</h2>
        <div style="display: inline-block; padding: 4px 16px; border-radius: 20px; background: ${this.activeCategory.color}22; border: 1px solid ${this.activeCategory.color}; color: ${this.activeCategory.color}; font-weight: 800; font-size: 14px; margin-bottom: 20px;">
          Kategori: ${catTitle}
        </div>
        <div class="final-score" style="font-size: 20px; color: #94a3b8; margin-bottom: 24px;">
          Total Skor Kamu: <strong style="color: #fbbf24; font-size: 32px; display: block; margin-top: 8px;">${this.score} Poin</strong>
        </div>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">Hebat! Kamu telah menyelesaikan seluruh 10 soal di kategori ini.</p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-primary" id="btnRestartQuizCategory" style="padding: 12px 20px; font-size: 15px; font-weight: 700;">
            🔄 Main Lagi di Kategori Ini
          </button>
          <button class="btn btn-secondary" id="btnQuizBackToLobby" style="padding: 12px 20px; font-size: 15px; font-weight: 700; background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 10px; cursor: pointer;">
            🏠 Kembali ke Room
          </button>
        </div>
      </div>
    `;

    const restartBtn = document.getElementById('btnRestartQuizCategory');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.score = 0;
        this.setupUI();
        this.loadQuestion(0);
      });
    }

    const lobbyBtn = document.getElementById('btnQuizBackToLobby');
    if (lobbyBtn) {
      lobbyBtn.addEventListener('click', () => {
        this.socket.emit('backToLobby');
      });
    }

    if (window.soundManager) window.soundManager.winFanfare();
  }

  destroy() {
    clearInterval(this.timerInterval);
    this.socket.off('quiz:scoreBoard', this.scoreBoardHandler);
    this.container.innerHTML = '';
  }
}

window.QuizGame = QuizGame;
window.QUIZ_CATEGORIES = QUIZ_CATEGORIES;
