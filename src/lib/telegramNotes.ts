import { Board, NoteItem, AiMemoryState } from '@/types';
import { generateId } from './utils';
import { syncBoardMemoryWithAI } from './polza';
import { saveBoard } from './db';

export async function appendTelegramNote(
  board: Board,
  opts: { title: string; content: string; tags: string[]; author?: string; images?: string[] }
): Promise<{ note: NoteItem; aiMemory: AiMemoryState }> {
  const noteCount = board.notes.length;
  const x = 80 + (noteCount % 4) * 360;
  const y = 80 + Math.floor(noteCount / 4) * 300;

  const newNote: NoteItem = {
    id: generateId('note_tg'),
    boardId: board.id,
    x,
    y,
    width: 320,
    height: 240,
    title: opts.title,
    content: opts.content,
    color: '#e0e7ff', // soft indigo
    tags: opts.tags,
    checklists: [],
    images: opts.images || [],
    pinned: false,
    author: opts.author,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  board.notes.push(newNote);

  const updatedMemory = await syncBoardMemoryWithAI(board.notes, board.aiMemory);
  board.aiMemory = updatedMemory;

  await saveBoard(board);

  return { note: newNote, aiMemory: updatedMemory };
}
