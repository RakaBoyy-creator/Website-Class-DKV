const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
// Port default untuk Pterodactyl (menggunakan environment variable PORT)
const PORT = process.env.PORT || 50028;

// Middleware untuk memproses data JSON dan CORS
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Melayani file statis dari folder 'public' (tempat index.html berada)
app.use(express.static(path.join(__dirname, 'public')));
// Melayani file gambar, video, dan musik yang diunggah agar bisa diakses oleh browser
app.use('/upload', express.static(path.join(__dirname, 'upload')));
app.use('/music', express.static(path.join(__dirname, 'music')));

// Struktur folder database dan penyimpanan file
const folders = [
  './database',
  './upload',
  './upload/foto',
  './upload/video',
  './music'
];

// Membuat folder secara otomatis jika belum ada di server Pterodactyl
folders.forEach(folder => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
});

// Fungsi untuk mencatat aktivitas log ke folder `./database/logs.txt`
function writeLog(activity) {
  const time = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const logMessage = `[${time}] ${activity}\n`;
  fs.appendFileSync(path.join(__dirname, 'database', 'logs.txt'), logMessage);
}

// Fungsi untuk membaca database JSON lokal dengan aman
function loadJSON(filename, defaultData = []) {
  const filePath = path.join(__dirname, 'database', filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`Gagal membaca berkas ${filename}:`, error);
    return defaultData;
  }
}

// Fungsi untuk menyimpan data ke file database JSON lokal
function saveJSON(filename, data) {
  const filePath = path.join(__dirname, 'database', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Menyiapkan data bawaan (default) saat pertama kali dijalankan
const defaultSettings = {
  title: 'Website Class DKV',
  sekolah: 'SMK Muhammadiyah 7 Kedumpring',
  namaKelas: 'X DKV',
  nomorKelas: 'Angkatan 25',
  waliKelas: 'Bpk. Aris Abdul Ghofur',
  desc: 'Selamat datang di website kenangan kelas kami. Tempat di mana setiap momen indah diabadikan dalam kedamaian guguran dkv.',
  logo: 'https://files.catbox.moe/lyxkgp.png',
  bgImage: 'https://files.catbox.moe/8j780a.jpg',
  themeColor: 'rgb(29, 50, 156)',
  bgMusic: ''
};

// Inisialisasi awal seluruh berkas database JSON lokal
loadJSON('settings.json', defaultSettings);
loadJSON('comments.json', []);
loadJSON('uploads.json', []);
loadJSON('joined_users.json', []); // Melacak data Unique User Sessions

// --- KONFIGURASI PENYIMPANAN BERKAS (MULTER) ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'bgMusicFile') {
      cb(null, './music'); // Folder untuk lagu MP3
    } else if (file.fieldname === 'logoFile') {
      cb(null, './upload/foto'); // Folder untuk Logo
    } else if (file.mimetype.startsWith('video/')) {
      cb(null, './upload/video'); // Folder untuk video MP4
    } else {
      cb(null, './upload/foto'); // Folder untuk foto JPG, PNG, JPEG, dll.
    }
  },
  filename: function (req, file, cb) {
    const fileExtension = path.extname(file.originalname);
    cb(null, `${uuidv4()}${fileExtension}`); // Nama unik menggunakan UUID agar tidak tabrakan
  }
});

const upload = multer({ storage: storage });

// ================= API ENDPOINTS =================

// Endpoint: Mengambil Pengaturan Website
app.get('/api/settings', (req, res) => {
  const currentSettings = loadJSON('settings.json', defaultSettings);
  res.json(currentSettings);
});

// Endpoint: Memperbarui Pengaturan Website, Logo, Background, dan Musik Latar Belakang
app.post('/api/settings', upload.fields([
  { name: 'logoFile', maxCount: 1 },
  { name: 'bgImageFile', maxCount: 1 },
  { name: 'bgMusicFile', maxCount: 1 }
]), (req, res) => {
  const currentSettings = loadJSON('settings.json', defaultSettings);

  // Memperbarui data teks pengaturan
  currentSettings.title = req.body.title || currentSettings.title;
  currentSettings.sekolah = req.body.sekolah || currentSettings.sekolah;
  currentSettings.namaKelas = req.body.namaKelas || currentSettings.namaKelas;
  currentSettings.nomorKelas = req.body.nomorKelas || currentSettings.nomorKelas;
  currentSettings.waliKelas = req.body.waliKelas || currentSettings.waliKelas;
  currentSettings.desc = req.body.desc || currentSettings.desc;
  currentSettings.themeColor = req.body.themeColor || currentSettings.themeColor;

  // Jika ada unggahan gambar logo baru
  if (req.files && req.files['logoFile']) {
    currentSettings.logo = `/upload/foto/${req.files['logoFile'][0].filename}`;
    writeLog(`Admin mengubah logo utama website.`);
  }

  // Jika ada unggahan gambar background baru
  if (req.files && req.files['bgImageFile']) {
    currentSettings.bgImage = `/upload/foto/${req.files['bgImageFile'][0].filename}`;
    writeLog(`Admin mengubah gambar latar belakang website.`);
  }

  // Jika ada unggahan musik latar belakang baru
  if (req.files && req.files['bgMusicFile']) {
    currentSettings.bgMusic = `/music/${req.files['bgMusicFile'][0].filename}`;
    writeLog(`Admin mengubah musik latar belakang website.`);
  }

  saveJSON('settings.json', currentSettings);
  res.json({ success: true, settings: currentSettings });
});

// Endpoint: Menghapus Musik Latar Belakang
app.delete('/api/settings/music', (req, res) => {
  const currentSettings = loadJSON('settings.json', defaultSettings);
  currentSettings.bgMusic = "";
  saveJSON('settings.json', currentSettings);
  writeLog(`Admin menghapus musik latar belakang website.`);
  res.json({ success: true, settings: currentSettings });
});

// Endpoint: Mengambil Semua Media Galeri
app.get('/api/media', (req, res) => {
  const mediaList = loadJSON('uploads.json', []);
  res.json(mediaList);
});

// Endpoint: Mengunggah Media Foto atau Video Baru ke Galeri
app.post('/api/media', upload.single('mediaFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada berkas yang dipilih' });
  }

  const mediaType = req.body.type; // 'foto' atau 'video'
  const fileUrl = mediaType === 'video' 
    ? `/upload/video/${req.file.filename}` 
    : `/upload/foto/${req.file.filename}`;

  const mediaList = loadJSON('uploads.json', []);
  const newMedia = {
    id: uuidv4(),
    type: mediaType,
    url: fileUrl,
    likes: [],
    createdAt: Date.now()
  };

  mediaList.push(newMedia);
  saveJSON('uploads.json', mediaList);

  writeLog(`Unggah media baru berhasil: ${mediaType} - ${fileUrl}`);
  res.json({ success: true, media: newMedia });
});

// Endpoint: Menghapus Media Galeri secara Permanen
app.delete('/api/media/:id', (req, res) => {
  const { id } = req.params;
  let mediaList = loadJSON('uploads.json', []);
  const foundMedia = mediaList.find(m => m.id === id);

  if (!foundMedia) {
    return res.status(404).json({ error: 'Media tidak ditemukan' });
  }

  // Hapus berkas fisiknya dari server secara aman
  const filePathOnServer = path.join(__dirname, foundMedia.url);
  if (fs.existsSync(filePathOnServer)) {
    try {
      fs.unlinkSync(filePathOnServer);
    } catch (err) {
      console.error(`Gagal menghapus berkas fisik: ${foundMedia.url}`, err);
    }
  }

  // Perbarui database uploads.json
  mediaList = mediaList.filter(m => m.id !== id);
  saveJSON('uploads.json', mediaList);

  // Hapus juga komentar-komentar yang berkaitan dengan media tersebut
  let commentsList = loadJSON('comments.json', []);
  commentsList = commentsList.filter(c => c.targetId !== id);
  saveJSON('comments.json', commentsList);

  writeLog(`Admin menghapus media permanen: ${foundMedia.url}`);
  res.json({ success: true });
});

// Endpoint: Mengambil Seluruh Komentar & Buku Tamu
app.get('/api/comments', (req, res) => {
  const commentsList = loadJSON('comments.json', []);
  res.json(commentsList);
});

// Endpoint: Menambahkan Komentar / Buku Tamu Baru
app.post('/api/comments', (req, res) => {
  const { targetId, userName, text, role, ownerId } = req.body;
  if (!targetId || !userName || !text) {
    return res.status(400).json({ error: 'Data yang dikirimkan tidak lengkap' });
  }

  const commentsList = loadJSON('comments.json', []);
  const newComment = {
    id: uuidv4(),
    targetId, // 'website' atau ID media tertentu
    userName,
    role: role || '',
    text,
    ownerId: ownerId || '', // Melacak identitas unik pembuat komentar
    createdAt: Date.now()
  };

  commentsList.push(newComment);
  saveJSON('comments.json', commentsList);

  if (targetId === 'website') {
    writeLog(`Buku tamu baru ditambahkan oleh ${userName}`);
  } else {
    writeLog(`Komentar galeri baru ditambahkan oleh ${userName}`);
  }

  res.json({ success: true, comment: newComment });
});

// Endpoint: Mengedit Komentar (Hanya pemilik atau admin)
app.put('/api/comments/:id', (req, res) => {
  const { id } = req.params;
  const { text, userId } = req.body;
  const commentsList = loadJSON('comments.json', []);
  const foundIndex = commentsList.findIndex(c => c.id === id);

  if (foundIndex === -1) {
    return res.status(404).json({ error: 'Komentar tidak ditemukan' });
  }

  // Proteksi Keamanan: Validasi Kepemilikan (Sama dengan ownerId, kecuali jika diakses admin dari backend)
  const comment = commentsList[foundIndex];
  if (comment.ownerId && comment.ownerId !== userId && userId !== 'admin') {
    return res.status(403).json({ success: false, error: 'Akses Ditolak: Anda bukan pemilik pesan ini!' });
  }

  commentsList[foundIndex].text = text;
  saveJSON('comments.json', commentsList);
  writeLog(`Pesan/Komentar ID ${id} berhasil diperbarui.`);

  res.json({ success: true, comment: commentsList[foundIndex] });
});

// Endpoint: Menghapus Komentar (Hanya pemilik atau admin)
app.delete('/api/comments/:id', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  let commentsList = loadJSON('comments.json', []);
  const foundComment = commentsList.find(c => c.id === id);

  if (!foundComment) {
    return res.status(404).json({ error: 'Komentar tidak ditemukan' });
  }

  // Proteksi Keamanan: Validasi Kepemilikan
  if (foundComment.ownerId && foundComment.ownerId !== userId && userId !== 'admin') {
    return res.status(403).json({ success: false, error: 'Akses Ditolak: Anda bukan pemilik pesan ini!' });
  }

  commentsList = commentsList.filter(c => c.id !== id);
  saveJSON('comments.json', commentsList);
  writeLog(`Pesan/Komentar milik ${foundComment.userName} telah dihapus.`);

  res.json({ success: true });
});

// Endpoint: Like dan Unlike Media (Foto/Video)
app.post('/api/media/:id/like', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID tidak valid' });
  }

  const mediaList = loadJSON('uploads.json', []);
  const foundIndex = mediaList.findIndex(m => m.id === id);

  if (foundIndex === -1) {
    return res.status(404).json({ error: 'Media tidak ditemukan' });
  }

  let currentLikes = mediaList[foundIndex].likes || [];
  const likedUserIndex = currentLikes.indexOf(userId);

  if (likedUserIndex > -1) {
    currentLikes.splice(likedUserIndex, 1); // Unlike
    writeLog(`Seseorang melakukan Unlike pada media ID: ${id}`);
  } else {
    currentLikes.push(userId); // Like
    writeLog(`Seseorang menyukai media ID: ${id}`);
  }

  mediaList[foundIndex].likes = currentLikes;
  saveJSON('uploads.json', mediaList);

  res.json({ success: true, likes: currentLikes });
});

// Endpoint: Melacak Aktivitas User Bergabung
app.post('/api/stats/join', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID kosong' });

  const joined = loadJSON('joined_users.json', []);
  if (!joined.includes(userId)) {
    joined.push(userId);
    saveJSON('joined_users.json', joined);
    writeLog(`Siswa/User baru bergabung ke website. ID: ${userId}`);
  }
  res.json({ success: true });
});

// Endpoint: Mengambil Statistik Admin Panel Ter-update
app.get('/api/stats', (req, res) => {
  const joinedUsers = loadJSON('joined_users.json', []);
  const mediaList = loadJSON('uploads.json', []);
  const commentsList = loadJSON('comments.json', []);
  
  // Total Log baris
  let logLines = 0;
  const logPath = path.join(__dirname, 'database', 'logs.txt');
  if (fs.existsSync(logPath)) {
    const fileContent = fs.readFileSync(logPath, 'utf-8');
    logLines = fileContent.split('\n').filter(Boolean).length;
  }

  const photos = mediaList.filter(m => m.type === 'foto').length;
  const videos = mediaList.filter(m => m.type === 'video').length;
  const guestbook = commentsList.filter(c => c.targetId === 'website').length;
  
  // Hitung akumulasi like di seluruh foto dan video
  const totalLikes = mediaList.reduce((sum, item) => sum + (item.likes ? item.likes.length : 0), 0);

  res.json({
    users: joinedUsers.length,
    logs: logLines,
    photos: photos,
    videos: videos,
    guestbook: guestbook,
    likes: totalLikes
  });
});

// Jalankan Server Web Express
app.listen(PORT, () => {
  console.log(`[OK] Server Website Kelas Sakura aktif di Port ${PORT}`);
  writeLog(`Server dimulai pada Port ${PORT}`);
});