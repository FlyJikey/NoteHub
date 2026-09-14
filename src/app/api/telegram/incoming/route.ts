import { NextResponse } from 'next/server';
import { getBoardById } from '@/lib/db';
import { appendTelegramNote } from '@/lib/telegramNotes';
import { checkRateLimit, sanitizeText, safeErrorResponse } from '@/lib/security';

// Used by the in-app Telegram simulator (TelegramModal) to preview the flow without a real bot.
// This is a real, deployed endpoint (not gated behind dev-only tooling), so it must not let an
// anonymous caller who merely knows/guesses a boardId write notes and trigger LLM calls on it —
// require the board's own (secret, unguessable) invite code as proof the caller already has
// legitimate access to that board's Telegram tab.
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rateCheck = checkRateLimit(ip, 'telegram_incoming', 10, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Слишком много запросов. Пожалуйста, подождите.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { boardId, text, sender, audioUrl, imageUrl, inviteCode } = body;

    if (!boardId) {
      return NextResponse.json({ error: 'boardId обязателен' }, { status: 400 });
    }

    const board = await getBoardById(boardId);
    if (!board) {
      return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
    }

    const expectedCode = board.telegramConfig?.inviteCode;
    if (!expectedCode || inviteCode !== expectedCode) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
    }

    const contentText = text ? sanitizeText(text, 4000) : (audioUrl ? '[Голосовое сообщение из Telegram]' : '');
    if (!contentText && !imageUrl) {
      return NextResponse.json({ error: 'Пустое сообщение' }, { status: 400 });
    }

    const { note, aiMemory } = await appendTelegramNote(board, {
      title: `💬 Telegram от ${sender || 'коллеги'}`,
      content: contentText,
      tags: ['telegram', 'входящие'],
      author: sender ? `tg_${sender}` : 'telegram',
      images: imageUrl ? [imageUrl] : [],
    });

    return NextResponse.json({ success: true, note, aiMemory });
  } catch (err) {
    return safeErrorResponse(err, 'Telegram incoming route error:');
  }
}
