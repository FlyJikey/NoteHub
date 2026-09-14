import { NextResponse } from 'next/server';
import { getBoardById, saveBoard } from '@/lib/db';
import { safeErrorResponse } from '@/lib/security';

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
  } catch (err) {
    return safeErrorResponse(err, 'Telegram disconnect error:');
  }
}
