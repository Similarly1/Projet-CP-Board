import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'app.db');
export const db = new Database(dbPath);

// Enable WAL mode for performance
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meeting_folders (
    meeting_date TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL,
    folder_name TEXT NOT NULL,
    odj_file_id TEXT,
    pv_file_id TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export const cacheService = {
  get<T>(key: string): T | null {
    try {
      const now = Date.now();
      const row = db.prepare('SELECT value, expires_at FROM cache WHERE key = ?').get(key) as { value: string; expires_at: number } | undefined;
      if (!row) return null;
      if (row.expires_at < now) {
        db.prepare('DELETE FROM cache WHERE key = ?').run(key);
        return null;
      }
      return JSON.parse(row.value) as T;
    } catch (err) {
      console.error(`Cache get error for key ${key}:`, err);
      return null;
    }
  },

  set(key: string, value: any, ttlMs: number): void {
    try {
      const expiresAt = Date.now() + ttlMs;
      const stmt = db.prepare(`
        INSERT INTO cache (key, value, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
      `);
      stmt.run(key, JSON.stringify(value), expiresAt);
    } catch (err) {
      console.error(`Cache set error for key ${key}:`, err);
    }
  },

  invalidate(keyPrefix: string): void {
    try {
      db.prepare('DELETE FROM cache WHERE key LIKE ?').run(`${keyPrefix}%`);
    } catch (err) {
      console.error(`Cache invalidate error for prefix ${keyPrefix}:`, err);
    }
  },
};

export interface MeetingFolderRecord {
  meeting_date: string;
  folder_id: string;
  folder_name: string;
  folder_url?: string;
  odj_file_id?: string;
  odj_name?: string;
  odj_url?: string;
  pv_file_id?: string;
  pv_name?: string;
  pv_url?: string;
  created_at?: number;
}

export const meetingDbService = {
  getByDate(meetingDate: string): MeetingFolderRecord | undefined {
    return db.prepare('SELECT * FROM meeting_folders WHERE meeting_date = ?').get(meetingDate) as MeetingFolderRecord | undefined;
  },

  save(data: MeetingFolderRecord) {
    const stmt = db.prepare(`
      INSERT INTO meeting_folders (meeting_date, folder_id, folder_name, odj_file_id, pv_file_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(meeting_date) DO UPDATE SET
        folder_id = excluded.folder_id,
        folder_name = excluded.folder_name,
        odj_file_id = COALESCE(excluded.odj_file_id, meeting_folders.odj_file_id),
        pv_file_id = COALESCE(excluded.pv_file_id, meeting_folders.pv_file_id)
    `);
    stmt.run(data.meeting_date, data.folder_id, data.folder_name, data.odj_file_id || null, data.pv_file_id || null, Date.now());
  },

  updatePvFileId(meetingDate: string, pvFileId: string) {
    db.prepare('UPDATE meeting_folders SET pv_file_id = ? WHERE meeting_date = ?').run(pvFileId, meetingDate);
  },

  updateOdjFileId(meetingDate: string, odjFileId: string) {
    db.prepare('UPDATE meeting_folders SET odj_file_id = ? WHERE meeting_date = ?').run(odjFileId, meetingDate);
  },

  getAll() {
    return db.prepare('SELECT * FROM meeting_folders ORDER BY meeting_date DESC').all();
  }
};
