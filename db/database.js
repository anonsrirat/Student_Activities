const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'activities.db'));

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    student_id TEXT,
    role TEXT DEFAULT 'student',
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    min_hours REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES activity_categories(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    location TEXT,
    capacity INTEGER DEFAULT 0,
    hours_credit REAL DEFAULT 0,
    status TEXT DEFAULT 'open',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'registered',
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    checked_in_at DATETIME,
    UNIQUE(activity_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS evidence_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    file_path TEXT,
    file_type TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending',
    reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewer_note TEXT,
    reviewed_at DATETIME,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default categories if empty
const catCount = db.prepare('SELECT COUNT(*) as count FROM activity_categories').get();
if (catCount.count === 0) {
  const ins = db.prepare('INSERT INTO activity_categories (name, description, min_hours) VALUES (?, ?, ?)');
  ins.run('กิจกรรมบำเพ็ญประโยชน์', 'กิจกรรมจิตอาสาและบำเพ็ญประโยชน์ต่อสังคม', 6);
  ins.run('กิจกรรมพัฒนาทักษะ', 'กิจกรรมพัฒนาทักษะวิชาชีพและวิชาการ', 8);
  ins.run('กิจกรรมนันทนาการ', 'กิจกรรมกีฬา ดนตรี ศิลปะ และวัฒนธรรม', 4);
  ins.run('กิจกรรมวิชาการ', 'สัมมนา อบรม การประกวดวิชาการ', 6);
  ins.run('กิจกรรมนิสิตสัมพันธ์', 'กิจกรรมเสริมสร้างความสัมพันธ์และความเป็นผู้นำ', 4);
}

module.exports = db;
