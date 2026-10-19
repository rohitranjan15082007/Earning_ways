import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ENV from '../config/env.js';

/**
 * Image storage for payout QR uploads.
 *
 * Cloudinary is the project convention and is used whenever it is configured.
 * A placeholder or broken Cloudinary account must never stop a member from
 * finishing a withdrawal, so the helper falls back to the API's own disk
 * (served read-only from /uploads — see src/index.ts).
 */

// Vercel's bundle is read-only; only /tmp is writable (and it is per-instance).
// Cloudinary is the durable option there — this keeps uploads working in dev.
const UPLOADS_ROOT = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

export function imageExtension(mimetype: string): string | null {
  return EXTENSION_BY_MIME[(mimetype || '').toLowerCase()] ?? null;
}

export type StoredImage = { url: string; storage: 'cloudinary' | 'local' };

const cloudinaryConfigured = () =>
  Boolean(ENV.cloud_name && ENV.cloud_api_key && ENV.cloud_api_secret);

async function storeLocally(file: Express.Multer.File, folder: string, baseUrl: string): Promise<string> {
  const extension = imageExtension(file.mimetype) ?? 'png';
  const name = `${randomUUID()}.${extension}`;
  const directory = path.join(UPLOADS_ROOT, folder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, name), file.buffer);
  return `${baseUrl}/uploads/${folder}/${name}`;
}

export async function storeImage(
  file: Express.Multer.File,
  folder: string,
  baseUrl: string,
): Promise<StoredImage> {
  if (cloudinaryConfigured()) {
    try {
      const { uploadToCloudinary } = await import('../config/cloudinary.js');
      const uploaded = await uploadToCloudinary(file.buffer, ENV.cloud_folder || folder);
      if (uploaded?.secure_url) return { url: uploaded.secure_url, storage: 'cloudinary' };
    } catch (error) {
      console.error(
        'Cloudinary upload failed; storing the image locally instead:',
        error instanceof Error ? error.message : error,
      );
    }
  }
  return { url: await storeLocally(file, folder, baseUrl), storage: 'local' };
}
