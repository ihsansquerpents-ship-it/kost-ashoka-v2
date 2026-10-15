/* ============================================================
   server.js — Backend Kost Pondok Ashoka (Fixed for Vercel)
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
app.use(express.static(path.join(__dirname, 'public')));   // index/login/admin.html

// URL Database (Mengutamakan environment variable Vercel/Production)
const DB_URI = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/kost_ashoka';

/* ---------- Pool koneksi MySQL ---------- */
const pool = mysql.createPool({
  uri: DB_URI,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: {
    rejectUnauthorized: false
  }
});

/* ---------- Sesi disimpan di MySQL (Mendukung Cloud Database URI) ---------- */
app.use(session({
  name: 'ashoka_sid',
  secret: process.env.SESSION_SECRET || 'super-elit-secret-085220',
  resave: false,
  saveUninitialized: false,
  store: new MySQLStore({
    uri: DB_URI,
    ssl: { rejectUnauthorized: false }
  }),
  cookie: {
    httpOnly: true,            // cookie tak terbaca JavaScript → anti-XSS
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // Otomatis true di Vercel (HTTPS)
    maxAge: 1000*60*60*24*7    // 7 hari
  }
}));

/* ---------- Middleware ---------- */
const requireAuth = (req,res,next) =>
  req.session.userId ? next() : res.status(401).json({ok:false,msg:'Silakan login dulu.'});

const requireAdmin = (req,res,next) =>
  (req.session.userId && req.session.role === 'admin')
    ? next() : res.status(403).json({ok:false,msg:'Khusus admin.'});

async function currentUser(req){
  if (!req.session.userId) return null;
  const [rows] = await pool.query(
    'SELECT id, nomor_kamar, nama, tipe_kamar, role FROM users WHERE id=? AND is_active=1',
    [req.session.userId]);
  return rows[0] || null;
}

/* ============================================================
   1) AUTENTIKASI
   ============================================================ */
const loginLimiter = rateLimit({
  windowMs: 10*60*1000, limit: 8,   // maks 8 percobaan / 10 menit / IP
  message: {ok:false, msg:'Terlalu banyak percobaan. Coba lagi dalam 10 menit.'}
});

app.post('/api/login', loginLimiter, async (req,res)=>{
  try{
    const { nomor_kamar='', password='' } = req.body || {};
    if (!nomor_kamar.trim() || !password)
      return res.status(400).json({ok:false,msg:'Nomor kamar dan sandi wajib diisi.'});

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE nomor_kamar=?', [nomor_kamar.trim().toUpperCase()]);
    const user = rows[0];

    const hash  = user ? user.password_hash
      : '$2a$10$C6UzMDM.H6dfI/f/IKcEeO7VTgxjrpU8k95Lxvtqk1PGCvXnLBDF6';
    const match = await bcrypt.compare(password, hash);

    if (!user || !match)
      return res.status(401).json({ok:false,msg:'Nomor kamar atau sandi salah.'});
    if (!user.is_active)
      return res.status(403).json({ok:false,msg:'Akun dinonaktifkan. Hubungi pengelola.'});

    req.session.regenerate(err=>{
      if (err) return res.status(500).json({ok:false,msg:'Gagal membuat sesi.'});
      req.session.userId = user.id;
      req.session.role   = user.role;
      pool.query('UPDATE users SET last_login=NOW() WHERE id=?',[user.id]).catch(()=>{});
      res.json({ok:true, user:{
        id:user.id, nama:user.nama, nomor_kamar:user.nomor_kamar,
        tipe_kamar:user.tipe_kamar, role:user.role
      }});
    });
  }catch(e){ console.error(e); res.status(500).json({ok:false,msg:'Terjadi kesalahan server.'}); }
});

app.get('/api/me', async (req,res)=>{
  try{
    const user = await currentUser(req);
    res.json({ok: !!user, user});
  }catch{ res.json({ok:false, user:null}); }
});

app.post('/api/logout', (req,res)=>{
  req.session.destroy(()=> res.clearCookie('ashoka_sid').json({ok:true}));
});

/* ============================================================
   2) ULASAN / TESTIMONI
   ============================================================ */
app.get('/api/reviews', async (req,res)=>{
  try{
    const [rows] = await pool.query(`
      SELECT r.id, r.rating, r.isi, r.created_at, u.nama, u.nomor_kamar, u.tipe_kamar
      FROM reviews r JOIN users u ON u.id = r.user_id
      WHERE r.is_published = 1
      ORDER BY r.created_at DESC LIMIT 24`);
    res.json({ok:true, reviews: rows});
  }catch(e){ console.error(e); res.status(500).json({ok:false, reviews:[]}); }
});

app.get('/api/stats', async (req,res)=>{
  try{
    const [[row]] = await pool.query(`
      SELECT ROUND(AVG(rating),1) AS avg_rating, COUNT(*) AS total
      FROM reviews WHERE is_published = 1`);

    res.json({
      ok: true,
      avg:   row.avg_rating !== null ? Number(row.avg_rating) : null,
      total: row.total
    });
  }catch(e){
    console.error(e);
    res.json({ok:false, avg:null, total:0});
  }
});

app.get('/api/my-review', requireAuth, async (req,res)=>{
  const [rows] = await pool.query(
    'SELECT rating, isi FROM reviews WHERE user_id=?', [req.session.userId]);
  res.json({ok:true, review: rows[0] || null});
});

app.post('/api/reviews', requireAuth, async (req,res)=>{
  try{
    const rating = parseInt(req.body?.rating, 10);
    const isi    = (req.body?.isi || '').trim();
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ok:false,msg:'Rating harus 1–5 bintang.'});
    if (isi.length < 10)  return res.status(400).json({ok:false,msg:'Ulasan minimal 10 karakter.'});
    if (isi.length > 600) return res.status(400).json({ok:false,msg:'Ulasan maksimal 600 karakter.'});

    await pool.query(`
      INSERT INTO reviews (user_id, rating, isi) VALUES (?,?,?)
      ON DUPLICATE KEY UPDATE rating=VALUES(rating), isi=VALUES(isi), is_published=1`,
      [req.session.userId, rating, isi]);
    res.json({ok:true, msg:'Terima kasih! Ulasanmu sudah tayang di halaman depan.'});
  }catch(e){ console.error(e); res.status(500).json({ok:false,msg:'Gagal menyimpan ulasan.'}); }
});

/* ============================================================
   3) ADMIN — kelola akun & moderasi ulasan
   ============================================================ */
app.get('/api/admin/users', requireAdmin, async (req,res)=>{
  const [users] = await pool.query(`
    SELECT u.id, u.nomor_kamar, u.nama, u.tipe_kamar, u.role, u.is_active,
           u.last_login, u.created_at,
           (SELECT COUNT(*) FROM reviews r WHERE r.user_id=u.id) AS jml_review
    FROM users u ORDER BY u.nomor_kamar`);
  res.json({ok:true, users});
});

app.post('/api/admin/users', requireAdmin, async (req,res)=>{
  try{
    const { nomor_kamar='', nama='', password='', tipe_kamar=null } = req.body || {};
    if (!nomor_kamar.trim() || !nama.trim() || !password)
      return res.status(400).json({ok:false,msg:'Nomor kamar, nama, dan sandi wajib diisi.'});
    if (password.length < 6)
      return res.status(400).json({ok:false,msg:'Sandi minimal 6 karakter.'});

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO users (nomor_kamar, nama, password_hash, tipe_kamar) VALUES (?,?,?,?)',
      [nomor_kamar.trim().toUpperCase(), nama.trim(), hash, tipe_kamar || null]);
    res.json({ok:true, msg:`Akun kamar ${nomor_kamar.trim().toUpperCase()} berhasil dibuat.`});
  }catch(e){
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ok:false,msg:'Nomor kamar sudah terdaftar.'});
    console.error(e); res.status(500).json({ok:false,msg:'Gagal membuat akun.'});
  }
});

app.patch('/api/admin/users/:id/active', requireAdmin, async (req,res)=>{
  await pool.query('UPDATE users SET is_active=? WHERE id=? AND role="penghuni"',
    [req.body?.active ? 1 : 0, req.params.id]);
  res.json({ok:true});
});

app.patch('/api/admin/users/:id/password', requireAdmin, async (req,res)=>{
  const pw = req.body?.password || '';
  if (pw.length < 6) return res.status(400).json({ok:false,msg:'Sandi minimal 6 karakter.'});
  const hash = await bcrypt.hash(pw, 12);
  await pool.query('UPDATE users SET password_hash=? WHERE id=? AND role="penghuni"',
    [hash, req.params.id]);
  res.json({ok:true, msg:'Sandi diperbarui.'});
});

app.get('/api/admin/reviews', requireAdmin, async (req,res)=>{
  const [reviews] = await pool.query(`
    SELECT r.*, u.nama, u.nomor_kamar
    FROM reviews r JOIN users u ON u.id=r.user_id
    ORDER BY r.created_at DESC`);
  res.json({ok:true, reviews});
});

app.patch('/api/admin/reviews/:id/publish', requireAdmin, async (req,res)=>{
  await pool.query('UPDATE reviews SET is_published=? WHERE id=?',
    [req.body?.published ? 1 : 0, req.params.id]);
  res.json({ok:true});
});

app.delete('/api/admin/reviews/:id', requireAdmin, async (req,res)=>{
  await pool.query('DELETE FROM reviews WHERE id=?', [req.params.id]);
  res.json({ok:true});
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
  });
}

module.exports = app;