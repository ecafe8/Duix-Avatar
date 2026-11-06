import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { errorMessage } from '@/lib/process'
import { avatars, tasks } from '@/lib/schema'
import { resolveFacePath } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const db = getDb()
    const search = new URL(request.url).searchParams
    const modelId = search.get('modelId')
    const taskId = search.get('taskId')
    const avatar = modelId ? db.select().from(avatars).where(eq(avatars.id, modelId)).get() : null
    const task = taskId ? db.select().from(tasks).where(eq(tasks.id, taskId)).get() : null
    const relativePath = avatar?.videoPath ?? task?.outputPath
    if (!relativePath) return Response.json({ error: '找不到视频文件' }, { status: 404 })

    const filePath = resolveFacePath(relativePath)
    const fileInfo = await stat(filePath)
    if (!fileInfo.isFile()) return Response.json({ error: '找不到视频文件' }, { status: 404 })
    const range = request.headers.get('range')
    const rangeMatch = range?.match(/^bytes=(\d*)-(\d*)$/)
    let start = 0
    let end = fileInfo.size - 1
    let status = 200

    if (range) {
      if (!rangeMatch || fileInfo.size === 0) {
        return new Response(null, {
          status: 416,
          headers: { 'content-range': `bytes */${fileInfo.size}` },
        })
      }

      if (rangeMatch[1] === '') {
        const suffixLength = Number(rangeMatch[2])
        start = Math.max(fileInfo.size - suffixLength, 0)
      } else {
        start = Number(rangeMatch[1])
        if (rangeMatch[2]) end = Math.min(Number(rangeMatch[2]), end)
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= fileInfo.size
      ) {
        return new Response(null, {
          status: 416,
          headers: { 'content-range': `bytes */${fileInfo.size}` },
        })
      }
      status = 206
    }

    const nodeStream = range
      ? createReadStream(filePath, { start, end })
      : createReadStream(filePath)
    const stream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>
    const headers: Record<string, string> = {
      'content-type': 'video/mp4',
      'content-length': String(end - start + 1),
      'content-disposition': `inline; filename="${task ? 'duix-avatar-video' : 'duix-avatar-model'}.mp4"`,
      'cache-control': 'private, max-age=60',
      'accept-ranges': 'bytes',
      'x-content-type-options': 'nosniff',
    }
    if (status === 206) headers['content-range'] = `bytes ${start}-${end}/${fileInfo.size}`

    return new Response(stream, { status, headers })
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 404 })
  }
}
