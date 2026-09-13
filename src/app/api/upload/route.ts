import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isAllowedUploadType, checkRateLimit } from '@/lib/security';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
      return NextResponse.json({ error: 'Размер файла превышает 10 МБ' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!isAllowedUploadType(file.type, ext)) {
      return NextResponse.json(
        { error: 'Недопустимый тип файла. Разрешены только изображения (PNG, JPG, WEBP, GIF, SVG)' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Secure randomized filename
    const safeFilename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(uploadsDir, safeFilename);

    fs.writeFileSync(filePath, buffer);

    const url = `/uploads/${safeFilename}`;
    return NextResponse.json({ url });
  } catch (err: any) {
    console.error('Upload security error:', err);
    return NextResponse.json({ error: 'Ошибка при сохранении файла' }, { status: 500 });
  }
}
