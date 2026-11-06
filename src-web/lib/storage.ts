import path from 'node:path'

export const faceDataDir = path.resolve(
  process.env.DUIX_FACE_DATA_DIR ?? path.join(process.cwd(), '..', 'duix_avatar_data', 'face2face'),
)
export const ttsDataDir = path.resolve(
  process.env.DUIX_TTS_DATA_DIR ??
    path.join(process.cwd(), '..', 'duix_avatar_data', 'voice', 'data'),
)
export const uploadDir = path.join(faceDataDir, 'web', 'uploads')
export const avatarDir = path.join(faceDataDir, 'web', 'models')
export const synthesisAudioDir = path.join(faceDataDir, 'temp')

export const ttsApiUrl = (process.env.TTS_API_URL ?? 'http://127.0.0.1:18180').replace(/\/$/, '')
export const f2fApiUrl = (process.env.F2F_API_URL ?? 'http://127.0.0.1:8383/easy').replace(
  /\/$/,
  '',
)

export function resolveFacePath(relativePath: string) {
  const normalized = relativePath.replaceAll('\\', '/')
  const containerPrefix = '/code/data/'
  const safeRelative = normalized.startsWith(containerPrefix)
    ? normalized.slice(containerPrefix.length)
    : normalized.replace(/^\/+/, '')
  const resolved = path.resolve(faceDataDir, safeRelative)

  if (resolved !== faceDataDir && !resolved.startsWith(`${faceDataDir}${path.sep}`)) {
    throw new Error('文件路径无效')
  }

  return resolved
}
