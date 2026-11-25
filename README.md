<div align="center">

# 🎮 GameVault

**Digital Game Storefront & Multi-Mirror Distribution Hub**

Platform etalase game digital modern dengan pencarian real-time, distribusi multi-mirror terverifikasi dengan pemantauan kesehatan tautan & pelaporan link mati, visualisasi distribusi rating Recharts, wishlist offline cache, ekspor backup JSON, perbandingan game berdampingan, serta dashboard aktivitas & audit admin berbasis React, Express, dan Firebase.

[![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Recharts](https://img.shields.io/badge/Recharts-3.x-22B5BF?style=flat-square)](https://recharts.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_%26_Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)

</div>

---

## ✨ Fitur Utama

### 🕹️ Storefront, Pencarian, Filter Popular & Ekspor JSON
- **Spotlight Hero & Katalog Kurasi**: Menampilkan rilisan unggulan dengan preview screenshot interaktif dan kartu game responsif.
- **Filter Tab `Popular` & Badge Trending**: Tab filter khusus untuk menampilkan game dengan ambang batas `downloadsCount > 1.000`, lengkap dengan penghitung jumlah judul populer dan badge `Popular` pada kartu.
- **Pencarian Real-Time & Multi-Tag**: Cari game berdasarkan judul, studio, deskripsi, genre (`Action RPG`, `Tactical Shooter`, `Motorsport Sim`, `Strategy`, `Sci-Fi Adventure`, `Survival`, `Indie`), atau kombinasi beberapa tag sekaligus (`Open World`, `Co-op`, `Soulslike`, dll.), lengkap dengan pengurutan *Top Rated*, *Most Downloaded*, dan *Newest Year*.
- **Ekspor Katalog ke JSON**: Tombol **Export JSON** di Storefront dan **Export Catalog** di Dashboard untuk mengunduh cadangan katalog ke file `.json` lokal.

### ⚖️ Side-by-Side Game Comparison
- Pilih dua judul langsung dari katalog untuk dibandingkan dalam tabel berdampingan (`CompareGamesModal`), mencakup **Genre**, **Ukuran File**, **Rating**, **Developer**, **Tahun Rilis**, **Total Unduhan**, **Jumlah Mirror**, dan **Tags**.

### 📦 Detail Game, Multi-Mirror Health & Pelaporan Link Mati
- **Animasi Modal & Deep-Link Share**: `GameDetailModal` hadir dengan animasi CSS `fade-in` dan `slide-up` (serta dukungan `prefers-reduced-motion`), sinkronisasi parameter URL `?game=<id>`, dan tombol **Share** yang menyalin tautan game ke clipboard disertai toast notifikasi.
- **Galeri Media & Poster 3:4**: Dilengkapi wide banner cover, switcher screenshot interaktif, dan fallback visual aman (`SafeImage`).
- **Multi-Mirror Download**: Mendukung sumber mirror asli termasuk `GitHub Releases`, `SourceForge`, `Itch.io`, `Flathub`, `Official CDN`, `Official Site`, `DataNodes`, `Google Drive`, `MediaFire`, `Mega.nz`, `PixelDrain`, `GoFile`, `1Fichier`, `Dropbox`, dan `Direct CDN` dengan validasi anti-SSRF di server.
- **Sistem Mirror Health Check (`Online`, `Degraded`, `Offline`, `Issue Reported`)**:
  - Pemeriksaan live HTTP via `POST /api/mirrors/health` (timeout 3 detik, cache 60 detik, fallback `GET Range: bytes=0-0`) dan tombol **Check Mirror Health**.
  - Pembaruan status kesehatan periodik otomatis setiap 15 detik menggunakan helper `checkMirrorHealth` (`src/lib/mirrorUtils.ts`).
- **Tombol `Report Dead Link` & Notifikasi Admin**: Pengguna yang masuk dapat melaporkan mirror rusak langsung dari setiap kartu mirror dengan alasan preset atau catatan kustom; status mirror langsung berubah menjadi **`Issue Reported`** dan laporan masuk ke antrean admin serta log aktivitas.
- **What's New Banner & Toast**: Menampilkan notifikasi otomatis saat pengguna membuka game yang diperbarui admin dalam 48 jam terakhir.

### 💬 Ulasan, Distribusi Rating Recharts & Komentar
- **Visualisasi Distribusi Rating (`GameRatingDistribution`)**: Grafik batang horizontal interaktif berbasis **Recharts** untuk breakdown bintang 1 sampai 5 beserta ringkasan sentimen komunitas.
- **Transaksi Rating Atomik & Foto Profil**: Perhitungan rating rata-rata menggunakan Firestore Transaction, dilengkapi foto profil pengguna (`userPhoto`) dengan fallback inisial pada ulasan dan komentar.
- **Role Badge Komunitas**: Menampilkan lencana **`Admin`** untuk administrator/kreator game dan **`Verified`** untuk anggota berdasarkan metadata publik akun.

### 👤 Wishlist Offline Cache, Profil & Dashboard
- **Wishlist Galeri Cover & Offline Caching**: Koleksi poster `3:4` pribadi yang dicache ke `localStorage` (`src/lib/wishlistCache.ts`) dengan indikator `Offline Cache` / `Cached` agar tetap dapat dilihat saat offline, ditambah tombol **Export JSON** (`exportWishlistToJson`) dan *empty state* ilustratif dengan CTA **Discover Games**.
- **Retro Avatar Picker**: Pengguna dapat memilih karakter avatar bergaya retro (`src/data/retroAvatars.ts`) atau foto Google dan menyimpannya ke profil Firestore.
- **Activity Monitor Berpaginasi**: Menampilkan riwayat unduhan mirror, wishlist, ulasan, dan laporan link mati dengan paginasi (5 item per halaman) dan filter tipe aktivitas.
- **Library Directory Berpaginasi & Audit Link Massal**:
  - Tabel direktori katalog dengan paginasi (5 item per halaman), pencarian instan, dan indikator status mirror per baris (`All OK`, `slow`, `dead`, `issue reported`).
  - Tombol **Check All Links** yang memeriksa seluruh tautan mirror secara batch (maksimal 12 URL per permintaan) dan langsung memunculkan toast notifikasi serta panel alert daftar link yang mati lengkap dengan tombol **Fix Link**.
- **Panel Admin (`Reported Dead Mirrors` & `Admin Audit Log`)**:
  - **Reported Dead Mirrors**: Kotak masuk notifikasi khusus admin berisi daftar mirror yang dilaporkan rusak oleh pengguna dengan tombol **Fix Link** dan **Mark Resolved**.
  - **Admin Audit Log**: Sub-tampilan khusus admin yang mengambil aksi berdampak tinggi (`game_publish`, `game_update`, `game_delete`, `catalog_seed`) langsung dari koleksi Firestore `activities` dengan filter dan paginasi.

### 🌗 Light / Dark Mode & Global Toast
- **Theme Toggle Persisten**: Tombol Light/Dark mode di `TopBar` yang menyimpan preferensi ke `localStorage` (`gamevault-theme`) dan menerapkannya sebelum render pertama agar bebas kedipan (*flash-free*).
- **Global Toast System**: Feedback non-intrusif untuk setiap aksi (wishlist, profil, salin tautan, health check, laporan link mati, ekspor JSON, ulasan, dan aksi admin).

---

## 🛠️ Arsitektur & Tech Stack

| Layer | Teknologi | Peran |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8 | SPA storefront, modal detail & perbandingan, dashboard, dan manajemen state |
| **Styling & Visualisasi** | Tailwind CSS v4, Lucide React, Recharts, Motion | Dual-theme (`light` / `dark`), ikonografi konsisten, animasi modal, & chart rating |
| **Backend Server** | Node.js, Express (`server.ts`) | Hosting port `3000`, Vite dev middleware, verifikasi token admin, & mirror health probe |
| **Database & Auth** | Cloud Firestore, Firebase Auth, Firebase Admin | Google Sign-In, koleksi real-time, transaksi rating, & Firestore Rules |

---

## 🗂️ Struktur Proyek

```text
├── index.html                  # Entry HTML, font setup, & pre-hydration theme script
├── metadata.json               # Metadata aplikasi GameVault
├── server.ts                   # Express API server & Vite SPA middleware (port 3000)
├── eslint.config.mjs           # Konfigurasi ESLint + @firebase/eslint-plugin-security-rules
├── firebase-blueprint.json     # Blueprint skema koleksi & validasi entity Firestore
├── firestore.rules             # Aturan keamanan Firestore (RBAC admin, mirrorReports, & isolasi user)
├── firestore.rules.test.ts     # Pengujian aturan keamanan Firestore
└── src/
    ├── App.tsx                 # Orkestrasi storefront, katalog, filter, wishlist cache, health polling, & laporan mirror
    ├── index.css               # Konfigurasi Tailwind CSS v4, variabel tema, & animasi modal
    ├── data/
    │   ├── retroAvatars.ts     # Daftar preset avatar karakter retro
    │   └── starterCatalog.ts   # Data katalog awal dengan tautan mirror terverifikasi
    ├── lib/
    │   ├── exportUtils.ts      # Helper ekspor katalog & wishlist ke file JSON
    │   ├── firebase.ts         # Inisialisasi client Firebase Auth & Firestore
    │   ├── mirrorUtils.ts      # Helper simulasi & evaluasi status kesehatan mirror
    │   └── wishlistCache.ts    # Strategi caching wishlist di localStorage untuk mode offline
    ├── types/
    │   └── game.ts             # Definisi tipe TypeScript, MirrorReport, & batasan validasi blueprint
    └── components/
        ├── TopBar.tsx              # Header navigasi, theme toggle, & menu akun
        ├── CompareGamesModal.tsx   # Tabel perbandingan 2 game berdampingan
        ├── DashboardView.tsx       # Profil, Activity Monitor, Library Directory (paginasi + cek semua link), & Admin Audit Log
        ├── GameDetailModal.tsx     # Galeri media, mirror health, Report Dead Link, Share, & rating
        ├── GameRatingDistribution.tsx # Grafik distribusi rating bintang 1–5 berbasis Recharts
        ├── GameCommentsSection.tsx # Komentar komunitas dengan foto profil & badge Admin/Verified
        ├── GameFormModal.tsx       # Form tambah/edit game, tags, screenshot, & health status mirror (Admin)
        ├── SafeImage.tsx           # Komponen gambar dengan fallback bersih
        ├── ToastProvider.tsx       # Sistem notifikasi toast global
        └── ErrorBoundary.tsx       # Penangkap error boundary aplikasi
```

---

## 🗄️ Model Data Firestore

| Koleksi | Deskripsi |
| :--- | :--- |
| `/games/{gameId}` | Katalog game, genre, `tags`, agregat rating (`rating`, `ratingSum`, `reviewCount`), `downloadLinks` (termasuk `healthStatus`: `online \| degraded \| offline \| issue_reported`), dan `adminUpdatedAt` |
| `/reviews/{reviewId}` | Ulasan & rating bintang 1–5 per pengguna (key deterministik `{gameId}_{userId}`) beserta `userPhoto` |
| `/comments/{commentId}` | Komentar diskusi komunitas per `gameId` beserta `userPhoto` |
| `/users/{userId}` | Profil privat pengguna (`email`, `displayName`, `photoURL`, `role`) |
| `/users/{userId}/public/{docId}` | Metadata publik non-PII untuk badge role & masa keanggotaan |
| `/users/{userId}/wishlist/{gameId}` | Daftar wishlist privat pengguna dengan poster cover `3:4` |
| `/activities/{activityId}` | Log aktivitas (`wishlist_add`, `wishlist_remove`, `download`, `comment`, `mirror_report`, `game_publish`, `game_update`, `game_delete`, `catalog_seed`) |
| `/mirrorReports/{reportId}` | Laporan link mirror mati oleh pengguna terverifikasi (`status`: `open \| resolved`, alasan, info mirror) |

---

## 🔌 Endpoint API Server

| Method | Endpoint | Akses | Deskripsi |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Publik | Mengecek status server & konfigurasi project Firebase |
| `POST` | `/api/auth/verify` | Authenticated | Memverifikasi ID token Firebase dan status role Admin |
| `POST` | `/api/mirrors/health` | Publik | Probe kesehatan URL mirror (maks 12 URL/request, anti-SSRF, cache 60s, mendukung `reportedUrls` untuk status `issue_reported`) |
| `POST` | `/api/mirrors/validate` | Authenticated | Memvalidasi format, protokol HTTP/HTTPS, & jangkauan URL mirror |
| `POST` | `/api/admin/mirrors/validate` | Admin Only | Validasi batch URL mirror khusus administrator terdaftar |

---

## 🚀 Menjalankan Secara Lokal

### 1. Prasyarat
- **Node.js** v20+
- Konfigurasi Firebase (`firebase-applet-config.json`) dan variabel environment sesuai `.env.example`

### 2. Instalasi & Development
```bash
# Install dependensi
npm install

# Jalankan server Express + Vite di http://localhost:3000
npm run dev
```

### 3. Build, Lint & Produksi
```bash
# Cek tipe TypeScript
npm run lint

# Audit ESLint untuk Firestore Security Rules
npx eslint firestore.rules

# Build bundle frontend ke dist/
npm run build

# Jalankan server produksi
NODE_ENV=production npm start
```

---

<div align="center">
  <sub>Dibangun dengan React, Node.js, Tailwind CSS, Recharts, dan Firebase.</sub>
</div>
