import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { errorMessage } from '@/lib/process'
import { avatars, tasks } from '@/lib/schema'
import { f2fApiUrl, synthesisAudioDir, ttsApiUrl } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type VideoStatus = {
  code?: number
  msg?: string
  data?: { status?: number; progress?: number; msg?: string; result?: string }
}

export async function GET() {
  const db = getDb()
  const list = db.select().from(tasks).orderBy(desc(tasks.createdAt)).all()

  for (const task of list) {
    if (task.status !== 'processing' || !task.code) continue
    try {
      const response = await fetch(`${f2fApiUrl}/query?code=${encodeURIComponent(task.code)}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) continue
      const result = (await response.json()) as VideoStatus
      const data = result.data

      if ([9999, 10002, 10003].includes(result.code ?? -1) || data?.status === 3) {
        db.update(tasks)
          .set({
            status: 'failed',
            message: data?.msg ?? result.msg ?? '视频合成失败',
            updatedAt: Date.now(),
          })
          .where(eq(tasks.id, task.id))
          .run()
      } else if (result.code === 10000 && data?.status === 2 && data.result) {
        const outputPath = data.result.replaceAll('\\', '/').replace(/^\/code\/data\//, '')
        db.update(tasks)
          .set({
            status: 'completed',
            message: data.msg ?? '合成完成',
            progress: 100,
            outputPath,
            updatedAt: Date.now(),
          })
          .where(eq(tasks.id, task.id))
          .run()
      } else if (result.code === 10000 && data?.status === 1) {
        db.update(tasks)
          .set({
            status: 'processing',
            message: data.msg ?? '视频处理中',
            progress: data.progress ?? 0,
            updatedAt: Date.now(),
          })
          .where(eq(tasks.id, task.id))
          .run()
      }
    } catch {
      // Keep the last known task state when the generator is temporarily unavailable.
    }
  }

  return Response.json({ list: db.select().from(tasks).orderBy(desc(tasks.createdAt)).all() })
}

export async function POST(request: Request) {
  let audioPath = ''
  const db = getDb()
  try {
    const body = (await request.json()) as { avatarId?: string; name?: string; text?: string }
    const avatarId = body.avatarId?.trim()
    const text = body.text?.trim()
    const name = body.name?.trim() || '未命名作品'
    if (!avatarId || !text) throw new Error('请选择数字人并填写合成文本')
    if (text.length > 5000) throw new Error('文本不能超过 5000 个字符')

    const avatar = db.select().from(avatars).where(eq(avatars.id, avatarId)).get()
    if (!avatar) throw new Error('找不到所选数字人')

    const id = randomUUID()
    const code = randomUUID()
    const audioName = `web-${id}.wav`
    const relativeAudioPath = `temp/${audioName}`
    audioPath = path.join(synthesisAudioDir, audioName)
    await mkdir(synthesisAudioDir, { recursive: true })

    const audioResponse = await fetch(`${ttsApiUrl}/v1/invoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        speaker: id,
        text,
        format: 'wav',
        topP: 0.7,
        max_new_tokens: 1024,
        chunk_length: 100,
        repetition_penalty: 1.2,
        temperature: 0.7,
        need_asr: false,
        streaming: false,
        is_fixed_seed: 0,
        is_norm: 1,
        reference_audio: avatar.voiceAudio,
        reference_text: avatar.voiceText,
      }),
      signal: AbortSignal.timeout(10 * 60 * 1000),
    })
    if (!audioResponse.ok) throw new Error(`TTS 音频生成失败 (${audioResponse.status})`)
    await writeFile(audioPath, Buffer.from(await audioResponse.arrayBuffer()))

    const submitResponse = await fetch(`${f2fApiUrl}/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        audio_url: relativeAudioPath,
        video_url: avatar.videoPath,
        code,
        chaofen: 0,
        watermark_switch: 0,
        pn: 1,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    const submitResult = (await submitResponse.json()) as { code?: number; msg?: string }
    const accepted = submitResponse.ok && submitResult.code === 10000
    const now = Date.now()
    const task = {
      id,
      name,
      avatarId,
      text,
      status: accepted ? 'processing' : 'failed',
      message: accepted ? '任务已提交' : (submitResult.msg ?? '视频任务提交失败'),
      progress: 0,
      code,
      outputPath: null,
      createdAt: now,
      updatedAt: now,
    }
    db.insert(tasks).values(task).run()
    return Response.json({ task }, { status: accepted ? 201 : 502 })
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 })
  }
}
