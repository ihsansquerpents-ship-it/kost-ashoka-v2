/* ============================================================
   server.js — Backend Kost Pondok Ashoka
   ============================================================ */
require('dotenv').config();
const path      = require('path');
const express   = require('express');
const session   = require('express-session');
const MySQLStore= require('express-mysql-session')(session);
const mysql     = require('mysql2/promise');
const bcrypt    = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// URL Database utama (digunakan oleh pool koneksi)
const DB_URI = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/kost_ashoka';

/* ---------- Pool koneksi MySQL (JANGAN DIHAPUS) ---------- */
const pool = mysql.createPool({
  uri: DB_URI,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: {
    rejectUnauthorized: false
  }
});

// Parsing URL database secara manual khusus untuk session store agar stabil di cloud
const dbUrl = new URL(DB_URI);

/* ---------- Sesi disimpan di MySQL ---------- */
app.use(session({
  name: 'ashoka_sid',
  secret: process.env.SESSION_SECRET || 'super-elit-secret-085220',
  resave: false,
  saveUninitialized: false,
  store: new MySQLStore({
    host: dbUrl.hostname,
    port: dbUrl.port || 3306,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.replace('/', ''),
    ssl: { rejectUnauthorized: false },
    clearExpired: true,
    checkExpirationInterval: 900000
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000*60*60*24*7
  }
}));