import { NextResponse } from 'next/server';
import { getBoardById, saveBoard } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { syncBoardMemoryWithAI } from '@/lib/polza';
import { NoteItem } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { boardId, text, sender, audioUrl, imageUrl } = body;

    if (!boardId) {
      return NextResponse.json({ error: 'boardId обязателен' }, { status: 400 });
    }

    const board = getBoardById(boardId);
    if (!board) {
      return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
    }

    const contentText = text || (audioUrl ? '[Голосовое сообщение из Telegram]' : '');
    if (!contentText && !imageUrl) {
      return NextResponse.json({ error: 'Пустое сообщение' }, { status: 400 });
    }

    // Position new telegram note nicely on canvas
    const noteCount = board.notes.length;
    const x = 80 + (noteCount % 4) * 360;
    const y = 80 + Math.floor(noteCount / 4) * 300;

    const newNote: NoteItem = {
      id: generateId('note_tg'),
      boardId,
      x,
      y,
      width: 320,
      height: 240,
      title: `💬 Telegram от ${sender || 'коллеги'}`,
      content: contentText,
      color: '#e0e7ff', // soft indigo
      tags: ['telegram', 'входящие'],
      checklists: [],
      images: imageUrl ? [imageUrl] : [],
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    board.notes.push(newNote);

    // Trigger AI memory update with the new thoughts
    const updatedMemory = await syncBoardMemoryWithAI(board.notes, board.aiMemory);
    board.aiMemory = updatedMemory;

    saveBoard(board);

    return NextResponse.json({ success: true, note: newNote, aiMemory: updatedMemory });
  } catch (err: any) {
    console.error('Telegram incoming route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
