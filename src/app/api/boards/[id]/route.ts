import { NextResponse } from 'next/server';
import { getBoardById, saveBoard, deleteBoard } from '@/lib/db';
import { isValidBoardId, checkRateLimit } from '@/lib/security';

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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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

    const updates = await req.json();
    const updatedBoard = {
      ...existing,
      ...updates,
      id: existing.id, // prevent id overwrite
    };

    // Auto-maintain members list if updater is provided
    if (updates.updaterNickname) {
      const cleanUpdater = updates.updaterNickname.toLowerCase().trim();
      const currentMembers = new Set(updatedBoard.members || []);
      currentMembers.add(cleanUpdater);
      updatedBoard.members = Array.from(currentMembers);
    }

    await saveBoard(updatedBoard);
    return NextResponse.json({ board: updatedBoard });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isValidBoardId(id)) {
      return NextResponse.json({ error: 'Неверный идентификатор доски' }, { status: 400 });
    }

    const deleted = await deleteBoard(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
