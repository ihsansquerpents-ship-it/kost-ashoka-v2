require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  const connection = await mysql.createConnection(
    process.env.DATABASE_URL || 'mysql://avnadmin:AVNS_8XnsZ5HCCE0Go9nej_Q@mysql-bbc3332-ihsansquerpents-b7f4.a.aivencloud.com:21620/defaultdb?ssl-mode=REQUIRED'
  );
  
  const sql = fs.readFileSync('./db.sql', 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean);

  for (let statement of statements) {
    if (statement.toUpperCase().startsWith('CREATE DATABASE') || statement.toUpperCase().startsWith('USE')) continue;
    await connection.query(statement);
  }

  console.log('✔ Semua tabel berhasil dibuat di database Aiven!');
  process.exit();
})();