import path from 'path'
import os from 'os'
import fs from 'fs'

const localModels = path.resolve(process.cwd(), 'models')
const fallbackRoot =
  process.platform === 'win32'
    ? path.join('D:', 'duix_avatar_data')
    : path.join(os.homedir(), 'duix_avatar_data')

// 优先用 DUIX_DATA_DIR；开发时项目内存在 models/ 就自动使用它，避免模型与产物散落到用户目录
const dataRoot =
  process.env.DUIX_DATA_DIR || (fs.existsSync(localModels) ? localModels : fallbackRoot)

// DUIX_API_HOST 可指向局域网服务，默认本机 Docker 服务
const apiHost = (process.env.DUIX_API_HOST || 'http://127.0.0.1').replace(/\/$/, '')

export const serviceUrl = {
  face2face: `${apiHost}:8383/easy`,
  tts: `${apiHost}:18180`
}

export const assetPath = {
  model: path.join(dataRoot, 'face2face', 'temp'), // 模特视频
  ttsProduct: path.join(dataRoot, 'face2face', 'temp'), // TTS 产物
  ttsRoot: path.join(dataRoot, 'voice', 'data'), // TTS 服务根目录
  ttsTrain: path.join(dataRoot, 'voice', 'data', 'origin_audio') // TTS 训练产物
}
