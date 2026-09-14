import { NextResponse } from 'next/server';
import { getTelegramBotToken, getBotUsername } from '@/lib/telegram';

let cachedUsername: string | null = null;

export async function GET() {
  if (!getTelegramBotToken()) {
    return NextResponse.json({ configured: false, username: null });
  }

  if (!cachedUsername) {
    cachedUsername = await getBotUsername();
  }

  return NextResponse.json({ configured: true, username: cachedUsername });
}
