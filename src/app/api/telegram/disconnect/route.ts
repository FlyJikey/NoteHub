import { NextResponse } from 'next/server';
import { getBoardById, saveBoard } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { boardId } = await req.json();
    if (!boardId) {
      return NextResponse.json({ error: 'boardId обязателен' }, { status: 400 });
    }

    const board = await getBoardById(boardId);
    if (!board) {
      return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
    }

    board.telegramConfig = {
      ...board.telegramConfig,
      connected: false,
      chatId: undefined,
    };
    await saveBoard(board);

    return NextResponse.json({ success: true, telegramConfig: board.telegramConfig });
  } catch (err: any) {
    console.error('Telegram disconnect error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
