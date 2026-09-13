import { NextResponse } from 'next/server';
import { getAllBoards, createBoard } from '@/lib/db';

export async function GET() {
  try {
    const boards = await getAllBoards();
    return NextResponse.json({ boards });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, createdBy } = body;
    const newBoard = await createBoard(title, description, createdBy);
    return NextResponse.json({ board: newBoard }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
