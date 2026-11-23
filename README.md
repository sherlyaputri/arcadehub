# 🕹️ ArcadeHub - Multi-Game Platform & Balap Mobil 3D Multiplayer

Platform game web multiplayer real-time berbasis **Node.js**, **Express**, **Three.js (WebGL)**, dan **Socket.IO**. Menggunakan sistem **Room & Lobby** sehingga pemain bisa membuat room, mengundang teman menggunakan kode room, dan memilih beberapa variasi game untuk dimainkan bersama.

---

## 🎮 Game yang Tersedia

1. **🏎️ 3D Turbo Racers (Balap Mobil 3D Multiplayer)**
   - **Grafis 3D (Three.js WebGL)**: Model mobil sport 3D lengkap dengan kabin, spoiler GT wing, lampu depan/belakang, serta 4 roda yang berputar dan berbelok dinamis.
   - **Kamera 3rd Person Dinamis**: Kamera mengejar di belakang mobil dengan efek *FOV zoom punch* saat menggunakan Nitro!
   - **Sirkuit Balap 3D**: Lintasan aspal lebar dengan curbs pinggir merah-putih, gapura start/finish gantry 3D, pepohonan lanskap, dan bantalan turbo 3D (*Boost Pads*).
   - **Fisika Real-time**: Akselerasi, drifting, body roll (kemiringan mobil saat menikung tajam), dan efek exhaust nitro berapi!
   - **Fitur Balap**: Sistem putaran (3 Laps), deteksi checkpoint anti-cheat, speedometer KM/H real-time, podium juara, dan kontrol sentuh untuk HP/mobile.
   - **Kontrol**:
     - Gas: Panah Atas / `W`
     - Rem / Mundur: Panah Bawah / `S`
     - Setir: Panah Kiri-Kanan / `A` & `D`
     - Nitro Boost: `Shift` atau `Spasi`

2. **🧠 Quiz Trivia Showdown**
   - Kuis multiplayer asah otak dengan timer hitung mundur.
   - Skor dinamis (semakin cepat menjawab dengan benar, semakin tinggi skor yang didapat).
   - Papan peringkat skor live antar pemain.

3. **❌ Tic-Tac-Toe Online**
   - Game strategi klasik 2 pemain secara turn-based dengan visual glowing neon.
   - Sinkronisasi giliran langkah dan deteksi otomatis kemenangan/seri.

---

## 🚀 Cara Menjalankan Project

1. Jalankan server:
   ```bash
   npm start
   ```
2. Buka browser dan akses:
   ```
   http://localhost:3000
   ```
3. Untuk mengetes multiplayer di satu komputer:
   - Buka satu tab sebagai **Host** (klik "Buat Room").
   - Salin **Kode Room** (4 huruf/angka).
   - Buka tab browser baru (atau Incognito / jendela kedua), lalu klik "Gabung ke Room" menggunakan kode tersebut!

---

## 📁 Struktur Project

```text
├── server.js              # Server Express + Socket.IO (Room manager, game sync, chat)
├── package.json           # Dependensi project (express, socket.io, three)
└── public/
    ├── index.html         # Tampilan UI Lobby, Room, & Game Arena
    ├── style.css          # Desain tema Dark Arcade & Responsive Mobile
    ├── sound.js           # Sound synthesizer otomatis via Web Audio API
    ├── client.js          # Pengatur logika client & transisi layar
    └── games/
        ├── racing3d.js    # Engine Balap Mobil 3D (Three.js WebGL)
        ├── racing.js      # Engine Balap Mobil 2D (Fallback)
        ├── tictactoe.js   # Modul game Tic-Tac-Toe
        └── quiz.js        # Modul game Quiz Trivia
```
