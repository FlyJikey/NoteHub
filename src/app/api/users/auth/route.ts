import { NextResponse } from 'next/server';
import { authenticateOrRegisterUser, getUserByNickname } from '@/lib/db';
import { normalizeNickname } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const nickname = searchParams.get('nickname');

    if (!nickname) {
      return NextResponse.json({ error: 'Параметр nickname обязателен' }, { status: 400 });
    }

    const clean = normalizeNickname(nickname);
    const user = await getUserByNickname(clean);

    if (!user) {
      return NextResponse.json({ exists: false, hasPin: false });
    }

    return NextResponse.json({
      exists: true,
      hasPin: Boolean(user.pin),
      nickname: user.nickname,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nickname, pin, displayName } = body;

    if (!nickname) {
      return NextResponse.json({ error: 'Никнейм обязателен' }, { status: 400 });
    }

    const result = await authenticateOrRegisterUser({
      nickname,
      pin,
      displayName,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: result.user,
      isNew: result.isNew,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
