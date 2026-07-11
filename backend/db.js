const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function query(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('coach', 'boxer')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS boxer_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      first_name TEXT,
      last_name TEXT,
      physical_address TEXT,
      license_number TEXT,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      draws INTEGER DEFAULT 0,
      weight REAL,
      weight_category TEXT,
      phone TEXT,
      date_of_birth TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      boxer_id INTEGER NOT NULL REFERENCES boxer_profiles(id) ON DELETE CASCADE,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      paid INTEGER DEFAULT 0,
      paid_at TIMESTAMP,
      amount REAL DEFAULT 0,
      UNIQUE(boxer_id, month, year)
    );

    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'boxe',
      description TEXT,
      location TEXT,
      country TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      is_private INTEGER DEFAULT 0,
      invite_all INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_invitations (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      boxer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rsvp_status TEXT DEFAULT 'pending',
      notified_at TIMESTAMP,
      UNIQUE(event_id, boxer_id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      boxer_id INTEGER NOT NULL REFERENCES boxer_profiles(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      document_type TEXT,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_credentials (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS training_sheets (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'muscu',
      description TEXT,
      notes TEXT,
      is_public INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS training_exercises (
      id SERIAL PRIMARY KEY,
      sheet_id INTEGER NOT NULL REFERENCES training_sheets(id) ON DELETE CASCADE,
      order_idx INTEGER DEFAULT 0,
      name TEXT NOT NULL,
      sets INTEGER,
      reps TEXT,
      duration TEXT,
      rest TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS training_assignments (
      id SERIAL PRIMARY KEY,
      sheet_id INTEGER NOT NULL REFERENCES training_sheets(id) ON DELETE CASCADE,
      boxer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(sheet_id, boxer_id)
    );

    CREATE TABLE IF NOT EXISTS training_performances (
      id SERIAL PRIMARY KEY,
      sheet_id INTEGER NOT NULL REFERENCES training_sheets(id) ON DELETE CASCADE,
      boxer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_date TEXT NOT NULL,
      exercise_id INTEGER REFERENCES training_exercises(id) ON DELETE CASCADE,
      achieved TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default coach
  const [coachExists] = await query("SELECT id FROM users WHERE role='coach' LIMIT 1");
  if (!coachExists) {
    const hash = bcrypt.hashSync('coach123', 10);
    await query("INSERT INTO users (email, password, role) VALUES ($1, $2, 'coach')", ['coach@boxing.fr', hash]);
    console.log('Compte coach créé : coach@boxing.fr / coach123');
  }

  // Seed default admin
  const [adminExists] = await query('SELECT id FROM admin_credentials LIMIT 1');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    await query('INSERT INTO admin_credentials (email, password) VALUES ($1, $2)', ['admin@snatch.fr', hash]);
    console.log('Compte admin créé : admin@snatch.fr / admin123');
  }
}

module.exports = { query, initDb };
