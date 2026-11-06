import { f2fApiUrl, ttsApiUrl } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function probe(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500), cache: 'no-store' })
    return { online: true, status: response.status }
  } catch {
    return { online: false, status: null }
  }
}

export async function GET() {
  const [tts, video] = await Promise.all([probe(ttsApiUrl), probe(f2fApiUrl)])
  return Response.json({ tts, video })
}
