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
        // 服务返回的结果通常是 \文件名.mp4 这类容器侧相对名，实际文件落在
        // /code/data/temp/ 下；统一成宿主机可解析的 temp/文件名.mp4。
        const normalizedResult = data.result.replaceAll('\\', '/')
        const outputPath = normalizedResult.startsWith('/code/data/')
          ? normalizedResult.slice('/code/data/'.length)
          : `temp/${normalizedResult.replace(/^\/+/, '').split('/').pop()}`
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
    const relativeAudioPath = audioName
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

    // 视频合成服务运行在 Linux 容器内，路径必须是正斜杠。
    // Windows 上 path.join 会拼出 \code\data\... ，ffprobe 读不到视频后
    // get_video_info 会因 fps/duration 为 0 抛出 ZeroDivisionError。
    const containerVideoPath = path.posix.join(
      '/code/data',
      avatar.videoPath
        .replaceAll('\\', '/')
        .replace(/^\/?code\/data\//, '')
        .replace(/^\/+/, ''),
    )

    const submitResponse = await fetch(`${f2fApiUrl}/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        audio_url: relativeAudioPath,
        video_url: containerVideoPath,
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
