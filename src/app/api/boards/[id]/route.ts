import { NextResponse } from 'next/server';
import { getBoardById, saveBoard, deleteBoard } from '@/lib/db';
import { isValidBoardId, checkRateLimit, normalizeNickname, sanitizeText, safeErrorResponse } from '@/lib/security';
import { NoteItem, DrawingPath, AiMemoryState } from '@/types';

/**
 * Merges an incoming array of notes/drawings from one client with what is
 * currently stored, instead of blindly replacing the stored array.
 *
 * The client always sends its whole local notes/drawings array, but that array
 * can be stale relative to what other collaborators have since added — the
 * board is edited concurrently by multiple people. A plain overwrite is
 * last-write-wins at the whole-array level: whichever save lands last wipes
 * out any items a different editor added or changed in between the two saves.
 *
 * Instead: upsert each incoming item into the existing list (only replacing an
 * existing item when the incoming version is at least as new, by updatedAt),
 * keep existing items the incoming payload doesn't mention (so another
 * editor's concurrent additions survive), and only actually remove an item
 * when its id is explicitly listed in `deletedIds` — i.e. this client itself
 * deleted it.
 */
function mergeById<T extends { id: string; updatedAt?: string }>(
  existing: T[],
  incoming: T[],
  deletedIds: Set<string>
): T[] {
  const merged = new Map<string, T>(existing.map((item) => [item.id, item]));

  for (const item of incoming) {
    if (!item || typeof item.id !== 'string') continue;
    const current = merged.get(item.id);
    if (!current || !current.updatedAt || !item.updatedAt || item.updatedAt >= current.updatedAt) {
      merged.set(item.id, item);
    }
  }

  for (const id of deletedIds) {
    merged.delete(id);
  }

  return Array.from(merged.values());
}

function hasValidShareToken(req: Request, board: { shareToken: string }, body: any): boolean {
  const url = new URL(req.url);
  const tokenFromQuery = url.searchParams.get('token');
  const tokenFromBody = typeof body?.shareToken === 'string' ? body.shareToken : null;
  const provided = tokenFromQuery || tokenFromBody;
  return Boolean(provided && board.shareToken && provided === board.shareToken);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isValidBoardId(id)) {
      return NextResponse.json({ error: 'Неверный идентификатор доски' }, { status: 400 });
    }

    const board = await getBoardById(id);
    if (!board) {
      return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
    }
    return NextResponse.json({ board });
  } catch (err) {
    return safeErrorResponse(err, 'Error fetching board:');
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rateCheck = checkRateLimit(ip, 'board_update', 120, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Слишком много сохранений. Пожалуйста, подождите.' },
        { status: 429 }
      );
    }

    const { id } = await params;
    if (!isValidBoardId(id)) {
      return NextResponse.json({ error: 'Неверный идентификатор доски' }, { status: 400 });
    }

    const existing = await getBoardById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
    }

    let updates: any;
    try {
      updates = await req.json();
    } catch {
      return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
    }

    if (!hasValidShareToken(req, existing, updates)) {
      return NextResponse.json(
        { error: 'Требуется корректный токен доступа к доске (shareToken)' },
        { status: 403 }
      );
    }

    // Only a known, type-checked subset of fields may be written by clients.
    // Never allow overwriting id/shareToken/createdBy/telegramConfig/members via this path.
    const updatedBoard = { ...existing };

    // Explicit deletion lists let us tell "this client removed item X" apart
    // from "this client's local copy simply doesn't know about item Y yet"
    // (e.g. Y was just added by another collaborator) — see mergeById above.
    const deletedNoteIds = new Set<string>(
      Array.isArray(updates.deletedNoteIds) ? updates.deletedNoteIds.filter((x: unknown) => typeof x === 'string') : []
    );
    const deletedDrawingIds = new Set<string>(
      Array.isArray(updates.deletedDrawingIds) ? updates.deletedDrawingIds.filter((x: unknown) => typeof x === 'string') : []
    );

    if (updates.notes !== undefined) {
      if (!Array.isArray(updates.notes)) {
        return NextResponse.json({ error: 'Поле notes должно быть массивом' }, { status: 400 });
      }
      updatedBoard.notes = mergeById(existing.notes, updates.notes as NoteItem[], deletedNoteIds);
    }

    if (updates.drawings !== undefined) {
      if (!Array.isArray(updates.drawings)) {
        return NextResponse.json({ error: 'Поле drawings должно быть массивом' }, { status: 400 });
      }
      updatedBoard.drawings = mergeById(existing.drawings, updates.drawings as DrawingPath[], deletedDrawingIds);
    }

    if (updates.aiMemory !== undefined) {
      if (typeof updates.aiMemory !== 'object' || updates.aiMemory === null || Array.isArray(updates.aiMemory)) {
        return NextResponse.json({ error: 'Поле aiMemory должно быть объектом' }, { status: 400 });
      }
      updatedBoard.aiMemory = updates.aiMemory as AiMemoryState;
    }

    if (updates.title !== undefined) {
      if (typeof updates.title !== 'string') {
        return NextResponse.json({ error: 'Поле title должно быть строкой' }, { status: 400 });
      }
      updatedBoard.title = sanitizeText(updates.title, 200) || existing.title;
    }

    if (updates.description !== undefined) {
      if (typeof updates.description !== 'string') {
        return NextResponse.json({ error: 'Поле description должно быть строкой' }, { status: 400 });
      }
      updatedBoard.description = sanitizeText(updates.description, 2000);
    }

    // Auto-maintain members list if updater is provided
    if (updates.updaterNickname && typeof updates.updaterNickname === 'string') {
      const cleanUpdater = normalizeNickname(updates.updaterNickname);
      if (cleanUpdater) {
        const currentMembers = new Set(updatedBoard.members || []);
        currentMembers.add(cleanUpdater);
        updatedBoard.members = Array.from(currentMembers);
      }
    }

    await saveBoard(updatedBoard);
    return NextResponse.json({ board: updatedBoard });
  } catch (err) {
    return safeErrorResponse(err, 'Error updating board:');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isValidBoardId(id)) {
      return NextResponse.json({ error: 'Неверный идентификатор доски' }, { status: 400 });
    }

    const existing = await getBoardById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
    }

    if (!hasValidShareToken(req, existing, null)) {
      return NextResponse.json(
        { error: 'Требуется корректный токен доступа к доске (shareToken)' },
        { status: 403 }
      );
    }

    const deleted = await deleteBoard(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return safeErrorResponse(err, 'Error deleting board:');
  }
}
