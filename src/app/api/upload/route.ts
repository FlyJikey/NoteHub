import { NextResponse } from 'next/server';
import path from 'path';
import { isAllowedUploadType, matchesImageMagicBytes, checkRateLimit } from '@/lib/security';

// Images are inlined as base64 data URIs and stored alongside board data
// (KV/GitHub/local JSON), the same way Telegram photo uploads already are.
// Writing to public/uploads at runtime doesn't survive a Vercel deploy
// (read-only filesystem) or even a `next start` restart (public/ is
// snapshotted at build time), so keep the limit conservative for inline storage.
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: Request) {
  try {
    // Rate limit uploads (max 20 uploads per minute per IP)
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rateCheck = checkRateLimit(ip, 'upload', 20, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Слишком много загрузок. Повторите через ${rateCheck.retryAfterSec} сек.` },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Размер файла превышает 2 МБ' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!isAllowedUploadType(file.type, ext)) {
      return NextResponse.json(
        { error: 'Недопустимый тип файла. Разрешены только изображения (PNG, JPG, WEBP, GIF)' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!matchesImageMagicBytes(file.type, buffer)) {
      return NextResponse.json(
        { error: 'Содержимое файла не соответствует заявленному типу изображения' },
        { status: 400 }
      );
    }

    const url = `data:${file.type};base64,${buffer.toString('base64')}`;
    return NextResponse.json({ url });
  } catch (err: any) {
    console.error('Upload security error:', err);
    return NextResponse.json({ error: 'Ошибка при сохранении файла' }, { status: 500 });
  }
}
