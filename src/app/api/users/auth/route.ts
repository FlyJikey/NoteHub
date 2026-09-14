import { NextResponse } from 'next/server';
import { authenticateOrRegisterUser, getUserByNickname } from '@/lib/db';
import { normalizeNickname, checkRateLimit, safeErrorResponse } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rateCheck = checkRateLimit(ip, 'user_lookup', 20, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Слишком много запросов. Пожалуйста, подождите.' },
        { status: 429 }
      );
    }

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
  } catch (err) {
    return safeErrorResponse(err, 'Error in user auth GET:');
  }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const ipRateCheck = checkRateLimit(ip, 'user_auth_ip', 20, 60000);
    if (!ipRateCheck.allowed) {
      return NextResponse.json(
        { error: 'Слишком много попыток входа. Пожалуйста, подождите.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { nickname, pin, displayName } = body;

    if (!nickname) {
      return NextResponse.json({ error: 'Никнейм обязателен' }, { status: 400 });
    }

    // Per-nickname limit blocks PIN brute-forcing even from many IPs/rotated proxies.
    const nicknameRateCheck = checkRateLimit(normalizeNickname(nickname), 'user_auth_nickname', 8, 60000);
    if (!nicknameRateCheck.allowed) {
      return NextResponse.json(
        { error: 'Слишком много попыток для этого никнейма. Пожалуйста, подождите.' },
        { status: 429 }
      );
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
  } catch (err) {
    return safeErrorResponse(err, 'Error in user auth POST:');
  }
}
