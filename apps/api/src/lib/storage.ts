import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, open, rm, stat } from "node:fs/promises"
import path from "node:path"
import { pipeline } from "node:stream/promises"
import type { Readable } from "node:stream"
import { fileURLToPath } from "node:url"
import { env } from "../env.js"

/**
 * Storage adapter supporting both S3-compatible object storage (RustFS,
 * MinIO, Cloudflare R2, AWS S3) and local disk fallback for zero-dependency
 * local development.
 */
const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

export const storageDirectory = env.UPLOAD_STORAGE_DIR
  ? path.resolve(appDirectory, env.UPLOAD_STORAGE_DIR)
  : path.join(appDirectory, "storage", "uploads")

function storagePathFor(storageKey: string): string {
  return path.join(storageDirectory, storageKey)
}

const s3Client = env.S3_BUCKET
  ? new S3Client({
      endpoint: env.S3_ENDPOINT || undefined,
      region: env.S3_REGION,
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
          : undefined,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    })
  : null

export async function writeStoredFile(storageKey: string, source: NodeJS.ReadableStream | Readable): Promise<void> {
  if (s3Client && env.S3_BUCKET) {
    const parallelUpload = new Upload({
      client: s3Client,
      params: {
        Bucket: env.S3_BUCKET,
        Key: storageKey,
        Body: source as Readable,
      },
    })
    await parallelUpload.done()
    return
  }

  await mkdir(storageDirectory, { recursive: true })
  await pipeline(source, createWriteStream(storagePathFor(storageKey)))
}

export async function readStoredFile(storageKey: string): Promise<NodeJS.ReadableStream> {
  if (s3Client && env.S3_BUCKET) {
    const res = await s3Client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey }))
    return res.Body as NodeJS.ReadableStream
  }
  return createReadStream(storagePathFor(storageKey))
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  if (s3Client && env.S3_BUCKET) {
    await s3Client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey }))
    return
  }
  await rm(storagePathFor(storageKey), { force: true })
}

export async function statStoredFile(storageKey: string): Promise<{ size: number }> {
  if (s3Client && env.S3_BUCKET) {
    const res = await s3Client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey }))
    return { size: res.ContentLength ?? 0 }
  }
  const s = await stat(storagePathFor(storageKey))
  return { size: s.size }
}

export async function readStoredFileHeader(storageKey: string, bytes = 32): Promise<Buffer> {
  if (s3Client && env.S3_BUCKET) {
    const res = await s3Client.send(
      new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: storageKey,
        Range: `bytes=0-${bytes - 1}`,
      })
    )
    const stream = res.Body as NodeJS.ReadableStream
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks).subarray(0, bytes)
  }

  const handle = await open(storagePathFor(storageKey), "r")
  try {
    const buffer = Buffer.alloc(bytes)
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}
