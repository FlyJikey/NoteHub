import { NextResponse } from 'next/server';
import { getBoardById, saveBoard } from '@/lib/db';
import { syncBoardMemoryWithAI } from '@/lib/polza';
import { safeErrorResponse } from '@/lib/security';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const board = await getBoardById(id);
    if (!board) {
      return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { apiKey, model } = body;

    // Run AI memory synchronization
    const newAiMemory = await syncBoardMemoryWithAI(
      board.notes,
      board.aiMemory,
      apiKey,
      model
    );

    board.aiMemory = newAiMemory;
    await saveBoard(board);

    return NextResponse.json({ board, aiMemory: newAiMemory });
  } catch (err) {
    return safeErrorResponse(err, 'Error syncing board memory:');
  }
}
