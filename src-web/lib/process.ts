import { spawn } from 'node:child_process'

export function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(globalThis.process.env.FFMPEG_PATH ?? 'ffmpeg', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let errorOutput = ''

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      errorOutput = `${errorOutput}${chunk}`.slice(-8000)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(errorOutput || `ffmpeg 退出，状态码 ${code}`))
      }
    })
  })
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '服务器处理失败'
}
