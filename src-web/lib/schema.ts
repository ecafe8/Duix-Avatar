import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const avatars = sqliteTable('web_avatar', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  videoPath: text('video_path').notNull(),
  voiceAudio: text('voice_audio').notNull(),
  voiceText: text('voice_text').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const tasks = sqliteTable('web_task', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  avatarId: text('avatar_id').notNull(),
  text: text('text').notNull(),
  status: text('status').notNull(),
  message: text('message'),
  progress: integer('progress').notNull().default(0),
  code: text('code'),
  outputPath: text('output_path'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})
