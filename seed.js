/* Jalankan SEKALI: node seed.js */
require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async ()=>{
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kost_ashoka'
  });
  const hash = pw => bcrypt.hash(pw, 12);

  // Akun admin — ⚠️ SEGERA GANTI sandi setelah login pertama
  await db.query(
    `INSERT INTO users (nomor_kamar,nama,password_hash,role)
     VALUES ('ADMIN','Pengelola Pondok Ashoka',?,'admin')
     ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)`,
    [await hash('admin123')]);

  // 2 akun + ulasan contoh (sesuai testimoni yang sudah ada di landing page)
  await db.query(`INSERT INTO users (nomor_kamar,nama,password_hash,tipe_kamar)
    VALUES ('D01','Rani Wulandari',?,'Deluxe')`, [await hash('rani123')]);
  await db.query(`INSERT INTO users (nomor_kamar,nama,password_hash,tipe_kamar)
    VALUES ('S02','Bima Prasetya',?,'Superior')`, [await hash('bima123')]);

  await db.query(`INSERT INTO reviews (user_id,rating,isi)
    SELECT id,5,'Dua tahun tinggal di sini dan rasanya seperti rumah sendiri. Pengelola ramah, dapur selalu bersih, dan taman depannya bikin betah pulang lebih sore.'
    FROM users WHERE nomor_kamar='D01'`);
  await db.query(`INSERT INTO reviews (user_id,rating,isi)
    SELECT id,5,'Awalnya cari yang paling murah, ternyata ambil Superior — sewa 6 bulan dapat diskon 10%, jadi jauh lebih masuk akal daripada kos lain.'
    FROM users WHERE nomor_kamar='S02'`);

  console.log('✔ Admin: kamar ADMIN / sandi admin123  (segera ganti!)');
  console.log('✔ Contoh penghuni: D01/rani123, S02/bima123');
  process.exit();
})();