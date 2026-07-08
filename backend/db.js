const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'boxing.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('coach', 'boxer')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS boxer_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boxer_id INTEGER NOT NULL REFERENCES boxer_profiles(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    paid INTEGER DEFAULT 0,
    paid_at DATETIME,
    amount REAL DEFAULT 0,
    UNIQUE(boxer_id, month, year)
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS event_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    boxer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notified_at DATETIME,
    UNIQUE(event_id, boxer_id)
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boxer_id INTEGER NOT NULL REFERENCES boxer_profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    document_type TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS training_sheets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'muscu',
    description TEXT,
    notes TEXT,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS training_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sheet_id INTEGER NOT NULL REFERENCES training_sheets(id) ON DELETE CASCADE,
    boxer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(sheet_id, boxer_id)
  );

  CREATE TABLE IF NOT EXISTS training_performances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sheet_id INTEGER NOT NULL REFERENCES training_sheets(id) ON DELETE CASCADE,
    boxer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_date TEXT NOT NULL,
    exercise_id INTEGER REFERENCES training_exercises(id) ON DELETE CASCADE,
    achieved TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrations
try { db.exec(`ALTER TABLE event_invitations ADD COLUMN rsvp_status TEXT DEFAULT 'pending'`); } catch(e) {}
try { db.exec(`ALTER TABLE training_sheets ADD COLUMN is_public INTEGER DEFAULT 0`); } catch(e) {}

module.exports = db;
