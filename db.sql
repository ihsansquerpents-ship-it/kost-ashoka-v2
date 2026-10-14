CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nomor_kamar   VARCHAR(10)  NOT NULL UNIQUE,        -- dipakai sebagai "username"
  nama          VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,               -- bcrypt, TIDAK pernah plaintext
  tipe_kamar    VARCHAR(20)  NULL,                   -- Standard/Superior/Deluxe/Premium
  role          ENUM('admin','penghuni') NOT NULL DEFAULT 'penghuni',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,     -- admin bisa menonaktifkan akun
  last_login    DATETIME     NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============ TABEL REVIEWS (ulasan penghuni) ============
CREATE TABLE reviews (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  rating       TINYINT UNSIGNED NOT NULL,            -- 1 s/d 5 bintang
  isi          TEXT NOT NULL,                        -- teks testimoni
  is_published TINYINT(1) NOT NULL DEFAULT 1,        -- moderasi admin
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5),
  UNIQUE KEY uq_one_review_per_user (user_id)        -- 1 penghuni = 1 ulasan (bisa diedit)
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id varchar(128) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  expires int(11) unsigned NOT NULL,
  data mediumtext COLLATE utf8mb4_bin
);