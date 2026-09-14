import { NextResponse } from 'next/server';
import { getBoardById } from '@/lib/db';
import { appendTelegramNote } from '@/lib/telegramNotes';

// Used by the in-app Telegram simulator (TelegramModal) to preview the flow without a real bot.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { boardId, text, sender, audioUrl, imageUrl } = body;

    if (!boardId) {
      return NextResponse.json({ error: 'boardId обязателен' }, { status: 400 });
    }

    const board = await getBoardById(boardId);
    if (!board) {
      return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
    }

    const contentText = text || (audioUrl ? '[Голосовое сообщение из Telegram]' : '');
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
  } catch (err: any) {
    console.error('Telegram incoming route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
