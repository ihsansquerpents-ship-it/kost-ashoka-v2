require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const connection = await mysql.createConnection(
    process.env.DATABASE_URL || 'mysql://avnadmin:AVNS_8XnsZ5HCCE0Go9nej_Q@mysql-bbc3332-ihsansquerpents-b7f4.a.aivencloud.com:21620/defaultdb?ssl-mode=REQUIRED'
  );

  const adminHash = await bcrypt.hash('admin123', 12);
  const userHash = await bcrypt.hash('rani123', 12);
  const bimaHash = await bcrypt.hash('bima123', 12);

  // Masukkan Admin
  await connection.query(`
    INSERT INTO users (nomor_kamar, nama, password_hash, role) 
    VALUES ('ADMIN', 'Pengelola Utama', ?, 'admin')
    ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), role=VALUES(role);
  `, [adminHash]);

  // Masukkan Penghuni Contoh
  await connection.query(`
    INSERT INTO users (nomor_kamar, nama, password_hash, tipe_kamar, role) 
    VALUES ('D01', 'Rani Wulandari', ?, 'Deluxe', 'penghuni')
    ON DUPLICATE KEY UPDATE nama=VALUES(nama), password_hash=VALUES(password_hash), tipe_kamar=VALUES(tipe_kamar);
  `, [userHash]);

  await connection.query(`
    INSERT INTO users (nomor_kamar, nama, password_hash, tipe_kamar, role) 
    VALUES ('S02', 'Bima Arya', ?, 'Standard', 'penghuni')
    ON DUPLICATE KEY UPDATE nama=VALUES(nama), password_hash=VALUES(password_hash), tipe_kamar=VALUES(tipe_kamar);
  `, [bimaHash]);

  console.log('✔ Data akun berhasil dimasukkan/diperbarui!');
  process.exit();
})();