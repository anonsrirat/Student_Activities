const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_activities',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+07:00',
  dateStrings: ['DATE', 'DATETIME']
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    student_id VARCHAR(50),
    role VARCHAR(20) DEFAULT 'student',
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS activity_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    min_hours DECIMAL(5,1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INT,
    date DATE NOT NULL,
    end_date DATE NULL,
    start_time TIME,
    end_time TIME,
    registration_start_at DATETIME NULL,
    registration_end_at DATETIME NULL,
    location VARCHAR(255),
    capacity INT DEFAULT 0,
    hours_credit DECIMAL(5,1) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'open',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES activity_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_date (date),
    INDEX idx_date_range (date, end_date),
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS activity_registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    user_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'registered',
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checked_in_at TIMESTAMP NULL,
    FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_reg (activity_id, user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS evidence_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    activity_id INT NOT NULL,
    file_path VARCHAR(500),
    file_type VARCHAR(20),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    reviewer_id INT,
    reviewer_note TEXT,
    reviewed_at TIMESTAMP NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'info',
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, is_read)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function ensureColumn(conn, table, column, definition) {
  const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (!cols.length) await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
}

async function init() {
  const conn = await pool.getConnection();
  try {
    const statements = SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) await conn.query(stmt);

    await ensureColumn(conn, 'activities', 'end_date', 'end_date DATE NULL AFTER date');
    await ensureColumn(conn, 'activities', 'registration_start_at', 'registration_start_at DATETIME NULL AFTER end_time');
    await ensureColumn(conn, 'activities', 'registration_end_at', 'registration_end_at DATETIME NULL AFTER registration_start_at');

    const [cats] = await conn.query('SELECT COUNT(*) as c FROM activity_categories');
    if (cats[0].c === 0) {
      const seeds = [
        ['กิจกรรมบำเพ็ญประโยชน์', 'กิจกรรมจิตอาสาและบำเพ็ญประโยชน์ต่อสังคม', 6],
        ['กิจกรรมพัฒนาทักษะ', 'กิจกรรมพัฒนาทักษะวิชาชีพและวิชาการ', 8],
        ['กิจกรรมนันทนาการ', 'กิจกรรมกีฬา ดนตรี ศิลปะ และวัฒนธรรม', 4],
        ['กิจกรรมวิชาการ', 'สัมมนา อบรม การประกวดวิชาการ', 6],
        ['กิจกรรมนิสิตสัมพันธ์', 'กิจกรรมเสริมสร้างความสัมพันธ์และความเป็นผู้นำ', 4],
      ];
      for (const s of seeds) {
        await conn.query('INSERT INTO activity_categories (name, description, min_hours) VALUES (?, ?, ?)', s);
      }
    }
    console.log('[OK] Database initialized');
  } finally {
    conn.release();
  }
}

module.exports = { pool, init };
