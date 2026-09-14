import { NextResponse } from 'next/server';
import { getBoardById } from '@/lib/db';
import { askProjectAssistant } from '@/lib/polza';
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

    const body = await req.json();
    const { messages, apiKey, model } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Не переданы сообщения' }, { status: 400 });
    }

    const reply = await askProjectAssistant(board, messages, apiKey, model);
    return NextResponse.json({ reply });
  } catch (err) {
    return safeErrorResponse(err, 'Error in chat API:');
  }
}
