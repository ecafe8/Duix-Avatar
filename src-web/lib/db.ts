import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let database: ReturnType<typeof drizzle> | undefined

export function getDb() {
  if (!database) {
    const databasePath = path.resolve(
      process.env.DUIX_WEB_DB_PATH ?? path.join(process.cwd(), 'data', 'duix-web.sqlite'),
    )
    mkdirSync(path.dirname(databasePath), { recursive: true })

    const sqlite = new Database(databasePath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS web_avatar (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        video_path TEXT NOT NULL,
        voice_audio TEXT NOT NULL,
        voice_text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS web_task (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar_id TEXT NOT NULL,
        text TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        progress INTEGER NOT NULL DEFAULT 0,
        code TEXT,
        output_path TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)
    database = drizzle(sqlite, { schema })
  }

  return database
}
