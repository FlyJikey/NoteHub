import { NextResponse } from 'next/server';
import { getTelegramBotToken, setTelegramWebhook } from '@/lib/telegram';

// Visit this endpoint once after deploying (and whenever the deployment URL changes)
// to point the Telegram bot's webhook at this app. Uses the request's own origin,
// so it can't be redirected to point the webhook somewhere else.
export async function GET(req: Request) {
  const token = getTelegramBotToken();
  if (!token) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN не настроен в переменных окружения' },
      { status: 400 }
    );
  }

  const origin = new URL(req.url).origin;
  const webhookUrl = `${origin}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  const result = await setTelegramWebhook(webhookUrl, secret);
  return NextResponse.json({ webhookUrl, secretConfigured: !!secret, telegram: result });
}
