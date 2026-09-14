import { NextResponse } from 'next/server';
import { getAllBoards, createBoard } from '@/lib/db';
import { safeErrorResponse } from '@/lib/security';

export async function GET() {
  try {
    const boards = await getAllBoards();
    return NextResponse.json({ boards });
  } catch (err) {
    return safeErrorResponse(err, 'Error listing boards:');
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { title, description, createdBy } = body || {};

    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Название стола обязательно' }, { status: 400 });
    }

    const newBoard = await createBoard(title, description, createdBy);
    return NextResponse.json({ board: newBoard }, { status: 201 });
  } catch (err) {
    return safeErrorResponse(err, 'Error creating board:');
  }
}
