import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { desc } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { errorMessage, runFfmpeg } from '@/lib/process'
import { avatars } from '@/lib/schema'
import { avatarDir, ttsApiUrl, ttsDataDir, uploadDir } from '@/lib/storage'
import { receiveVideo } from '@/lib/upload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getDb()
  const list = db.select().from(avatars).orderBy(desc(avatars.createdAt)).all()
  return Response.json({ list })
}

export async function POST(request: Request) {
  let uploadedPath = ''
  let videoPath = ''
  let audioPath = ''
  const db = getDb()

  try {
    const upload = await receiveVideo(request, uploadDir)
    uploadedPath = upload.filePath
    const name = upload.fields.name?.trim()
    if (!name) throw new Error('请填写模特名称')

    const id = randomUUID()
    const relativeVideoPath = `web/models/${id}.mp4`
    const relativeAudioPath = `origin_audio/web/${id}.wav`
    videoPath = path.join(avatarDir, `${id}.mp4`)
    audioPath = path.join(ttsDataDir, relativeAudioPath)
    await mkdir(avatarDir, { recursive: true })
    await mkdir(path.dirname(audioPath), { recursive: true })

    await runFfmpeg([
      '-y',
      '-i',
      uploadedPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-an',
      videoPath,
    ])
    await runFfmpeg(['-y', '-i', uploadedPath, '-vn', '-acodec', 'pcm_s16le', audioPath])

    const trainResponse = await fetch(`${ttsApiUrl}/v1/preprocess_and_tran`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ format: 'wav', reference_audio: relativeAudioPath, lang: 'zh' }),
      signal: AbortSignal.timeout(10 * 60 * 1000),
    })
    const trainResult = (await trainResponse.json()) as {
      code?: number
      msg?: string
      asr_format_audio_url?: string
      reference_audio_text?: string
    }

    if (!trainResponse.ok || trainResult.code !== 0 || !trainResult.asr_format_audio_url) {
      throw new Error(trainResult.msg || '语音模型训练失败，请检查 TTS 服务')
    }

    const avatar = {
      id,
      name,
      videoPath: relativeVideoPath,
      voiceAudio: trainResult.asr_format_audio_url,
      voiceText: trainResult.reference_audio_text ?? '',
      createdAt: Date.now(),
    }
    db.insert(avatars).values(avatar).run()
    return Response.json({ avatar }, { status: 201 })
  } catch (error) {
    if (videoPath) await rm(videoPath, { force: true }).catch(() => undefined)
    if (audioPath) await rm(audioPath, { force: true }).catch(() => undefined)
    return Response.json({ error: errorMessage(error) }, { status: 400 })
  } finally {
    if (uploadedPath) await rm(uploadedPath, { force: true }).catch(() => undefined)
  }
}
