<div align="center">

# 🎮 GameVault

**Digital Game Storefront & Multi-Mirror Distribution Hub**

Platform etalase game digital modern dengan pencarian real-time, distribusi multi-mirror terverifikasi, ulasan komunitas 5-bintang, wishlist visual, perbandingan game berdampingan, serta dashboard aktivitas berbasis React, Express, dan Firebase.

[![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_%26_Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)

</div>

---

## ✨ Fitur Utama

### 🕹️ Storefront, Pencarian & Filter Multi-Tag
- **Spotlight Hero & Katalog Kurasi**: Menampilkan rilisan unggulan dengan preview screenshot interaktif dan kartu game responsif.
- **Badge `Popular`**: Menyorot judul trending yang telah melampaui `1.000+` unduhan secara otomatis.
- **Pencarian Real-Time & Multi-Tag**: Cari game berdasarkan judul, studio, deskripsi, genre (`Action RPG`, `Tactical Shooter`, `Motorsport Sim`, `Strategy`, `Sci-Fi Adventure`, `Survival`, `Indie`), atau filter kombinasi beberapa tag sekaligus (`Open World`, `Co-op`, `Soulslike`, dll.), lengkap dengan pengurutan *Top Rated*, *Most Downloaded*, dan *Newest Year*.

### ⚖️ Side-by-Side Game Comparison
- Pilih dua judul langsung dari katalog untuk dibandingkan dalam tabel berdampingan (`CompareGamesModal`), mencakup **Genre**, **Ukuran File**, **Rating**, **Developer**, **Tahun Rilis**, **Total Unduhan**, **Jumlah Mirror**, dan **Tags**.

### 📦 Detail Game, Multi-Mirror & Notifikasi *What's New*
- **Galeri Media & Poster 3:4**: Dilengkapi wide banner cover, switcher screenshot interaktif, dan fallback visual aman (`SafeImage`).
- **Multi-Mirror Download & Link Verifier**: Mendukung berbagai sumber mirror (`GitHub Releases`, `SourceForge`, `Itch.io`, `Flathub`, `Official CDN`, `Official Site`, `DataNodes`, `Google Drive`, `MediaFire`, `Mega.nz`, `PixelDrain`, `GoFile`, `1Fichier`, `Dropbox`, `Direct CDN`) dengan validasi URL server-side yang memblokir alamat jaringan privat/SSRF.
- **What's New Banner & Toast**: Menampilkan notifikasi otomatis saat pengguna membuka halaman game yang diperbarui admin dalam 48 jam terakhir.
- **Tombol Share**: Menyalin URL halaman game ke clipboard disertai feedback toast instan.

### 💬 Ulasan Transaksional & Komentar dengan Role Badge
- **5-Star Rating Breakdown**: Perhitungan rata-rata rating dan distribusi bintang secara atomik menggunakan Firestore Transaction.
- **Role Badge Komunitas**: Menampilkan lencana **`Admin`** untuk administrator/kreator game dan **`Verified`** untuk anggota lama berdasarkan metadata publik akun.

### 👤 Wishlist, Profil & Retro Character Avatars
- **Wishlist Galeri Cover**: Koleksi poster `3:4` pribadi beserta *empty state* ilustratif dengan CTA **Discover Games**.
- **Retro Avatar Picker**: Pengguna dapat memilih karakter avatar bergaya retro langsung di Dashboard dan menyimpannya ke profil Firestore.
- **Activity Monitor**: Mencatat riwayat unduhan mirror, wishlist, komentar, dan pembaruan katalog admin.

### 🌗 Light / Dark Mode & Global Toast
- **Theme Toggle Persisten**: Tombol Light/Dark mode di `TopBar` yang menyimpan preferensi ke `localStorage` (`gamevault-theme`) dan menerapkannya sebelum render pertama agar bebas kedipan (*flash-free*).
- **Global Toast System**: Feedback non-intrusif untuk setiap aksi (wishlist, profil, salin tautan, verifikasi mirror, ulasan, dan admin).

---

## 🛠️ Arsitektur & Tech Stack

| Layer | Teknologi | Peran |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8 | SPA storefront, modal perbandingan, dashboard, dan manajemen state |
| **Styling & UI** | Tailwind CSS v4, Lucide React, Motion | Dual-theme (`light` / `dark`) dengan `@custom-variant dark` dan ikonografi konsisten |
| **Backend Server** | Node.js, Express (`server.ts`) | Hosting port `3000`, Vite dev middleware, verifikasi token admin, & mirror validator |
| **Database & Auth** | Cloud Firestore, Firebase Auth, Firebase Admin | Autentikasi Google Sign-In, koleksi real-time, transaksi rating, & Firestore Rules |

---

## 🗂️ Struktur Proyek

```text
├── index.html                  # Entry HTML, font setup, & pre-hydration theme script
├── metadata.json               # Metadata aplikasi GameVault
├── server.ts                   # Express API server & Vite SSR/SPA middleware (port 3000)
├── firebase-blueprint.json     # Blueprint skema koleksi & validasi entity Firestore
├── firestore.rules             # Aturan keamanan Firestore (RBAC admin & isolasi data user)
├── firestore.rules.test.ts     # Pengujian aturan keamanan Firestore
└── src/
    ├── App.tsx                 # Orkestrasi storefront, katalog, filter, wishlist, & theme state
    ├── index.css               # Konfigurasi Tailwind CSS v4 & variabel light/dark mode
    ├── data/
    │   └── starterCatalog.ts   # Data katalog awal & aset avatar retro
    ├── lib/
    │   └── firebase.ts         # Inisialisasi client Firebase Auth & Firestore
    ├── types/
    │   └── game.ts             # Definisi tipe TypeScript & batasan validasi blueprint
    └── components/
        ├── TopBar.tsx          # Header navigasi, theme toggle, & menu akun
        ├── CompareGamesModal.tsx   # Tabel perbandingan 2 game berdampingan
        ├── DashboardView.tsx   # Profil pengguna, pemilih avatar retro, & panel admin
        ├── GameDetailModal.tsx # Galeri media, mirror unduhan, What's New, & rating 5-bintang
        ├── GameCommentsSection.tsx # Komentar komunitas dengan badge Admin/Verified
        ├── GameFormModal.tsx   # Form tambah/edit game, tags, screenshot, & mirror (Admin)
        ├── SafeImage.tsx       # Komponen gambar dengan fallback bersih
        ├── ToastProvider.tsx   # Sistem notifikasi toast global
        └── ErrorBoundary.tsx   # Penangkap error boundary aplikasi
```

---

## 🗄️ Model Data Firestore

| Koleksi | Deskripsi |
| :--- | :--- |
| `/games/{gameId}` | Katalog game, genre, `tags`, agregat rating (`rating`, `ratingSum`, `reviewCount`), `downloadLinks`, dan `adminUpdatedAt` |
| `/reviews/{reviewId}` | Ulasan & rating bintang 1–5 per pengguna (key deterministik `{gameId}_{userId}`) |
| `/comments/{commentId}` | Komentar diskusi komunitas per `gameId` |
| `/users/{userId}` | Profil privat pengguna (email, displayName, photoURL, role) |
| `/users/{userId}/public/{docId}` | Metadata publik non-PII untuk badge role & masa keanggotaan |
| `/users/{userId}/wishlist/{gameId}` | Daftar wishlist privat pengguna dengan poster cover `3:4` |
| `/activities/{activityId}` | Log aktivitas unduhan, wishlist, komentar, dan publikasi katalog |

---

## 🔌 Endpoint API Server

| Method | Endpoint | Akses | Deskripsi |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Publik | Mengecek status server & konfigurasi project Firebase |
| `POST` | `/api/auth/verify` | Authenticated | Memverifikasi ID token Firebase dan status role Admin |
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

### 3. Build, Type-Check & Produksi
```bash
# Cek tipe TypeScript
npm run lint

# Build bundle frontend ke dist/
npm run build

# Jalankan server produksi
NODE_ENV=production npm start
```

---

<div align="center">
  <sub>Dibangun dengan React, Node.js, Tailwind CSS, dan Firebase.</sub>
</div>
