import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import Busboy from 'busboy'

const maxVideoBytes = 1024 * 1024 * 1024
const acceptedVideoExtensions = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi'])

export async function receiveVideo(request: Request, destination: string) {
  const contentType = request.headers.get('content-type')
  const contentLength = Number(request.headers.get('content-length') ?? 0)

  if (!contentType?.includes('multipart/form-data')) {
    throw new Error('请使用 multipart/form-data 上传视频')
  }
  if (contentLength > maxVideoBytes + 1024 * 1024) {
    throw new Error('视频文件不能超过 1 GB')
  }
  if (!request.body) {
    throw new Error('上传内容为空')
  }

  await mkdir(destination, { recursive: true })

  return new Promise<{ filePath: string; fields: Record<string, string> }>((resolve, reject) => {
    const fields: Record<string, string> = {}
    let filePath = ''
    let writePromise: Promise<void> | undefined
    let uploadError: Error | undefined
    const parser = Busboy({
      headers: { 'content-type': contentType },
      limits: { files: 1, fields: 8, fileSize: maxVideoBytes },
    })

    parser.on('field', (name, value) => {
      fields[name] = value
    })
    parser.on('file', (fieldName, stream, info) => {
      if (fieldName !== 'video') {
        stream.resume()
        return
      }

      const extension = path.extname(info.filename ?? '').toLowerCase()
      if (!acceptedVideoExtensions.has(extension)) {
        uploadError = new Error('支持 MP4、MOV、MKV、WebM 或 AVI 视频')
        stream.resume()
        return
      }

      filePath = path.join(destination, `${randomUUID()}${extension}`)
      stream.on('limit', () => {
        uploadError = new Error('视频文件不能超过 1 GB')
      })
      writePromise = pipeline(stream, createWriteStream(filePath, { flags: 'wx' }))
    })
    parser.on('filesLimit', () => {
      uploadError = new Error('一次只能上传一个视频')
    })
    parser.on('fieldsLimit', () => {
      uploadError = new Error('表单字段过多')
    })

    const parsePromise = pipeline(
      Readable.fromWeb(request.body as import('node:stream/web').ReadableStream<Uint8Array>),
      parser,
    )

    parsePromise
      .then(async () => {
        await writePromise
        if (uploadError) throw uploadError
        if (!filePath) throw new Error('请选择一个视频文件')
        resolve({ filePath, fields })
      })
      .catch(async (error: unknown) => {
        if (filePath) await rm(filePath, { force: true }).catch(() => undefined)
        reject(error)
      })
  })
}
