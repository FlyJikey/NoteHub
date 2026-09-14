const TELEGRAM_API = 'https://api.telegram.org';

export function getTelegramBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined;
}

async function telegramApiCall(method: string, payload: Record<string, unknown>) {
  const token = getTelegramBotToken();
  if (!token) return null;

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error(`[Telegram] ${method} failed:`, err);
    return null;
  }
}

export async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> {
  await telegramApiCall('sendMessage', { chat_id: chatId, text });
}

export async function getBotUsername(): Promise<string | null> {
  const token = getTelegramBotToken();
  if (!token) return null;
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/getMe`);
    const data = await res.json();
    return data?.ok ? data.result?.username || null : null;
  } catch (err) {
    console.error('[Telegram] getMe failed:', err);
    return null;
  }
}

export async function setTelegramWebhook(webhookUrl: string, secretToken?: string) {
  return telegramApiCall('setWebhook', {
    url: webhookUrl,
    secret_token: secretToken,
    allowed_updates: ['message'],
  });
}

function guessMimeFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.oga') || lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

/** Downloads a Telegram file by file_id and returns it as a base64 data URI (never exposes the bot token to the client). */
export async function getTelegramFileDataUri(
  fileId: string
): Promise<{ dataUri: string; mime: string } | null> {
  const token = getTelegramBotToken();
  if (!token) return null;

  try {
    const fileRes = await fetch(`${TELEGRAM_API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const fileData = await fileRes.json();
    const filePath = fileData?.result?.file_path;
    if (!filePath) return null;

    const bytesRes = await fetch(`${TELEGRAM_API}/file/bot${token}/${filePath}`);
    if (!bytesRes.ok) return null;

    const buffer = Buffer.from(await bytesRes.arrayBuffer());
    const mime = bytesRes.headers.get('content-type') || guessMimeFromPath(filePath);
    return { dataUri: `data:${mime};base64,${buffer.toString('base64')}`, mime };
  } catch (err) {
    console.error('[Telegram] Failed to download file:', err);
    return null;
  }
}

/** Transcribes a voice/audio data URI via Polza.ai's Whisper-compatible endpoint. */
export async function transcribeAudioDataUri(dataUri: string): Promise<string | null> {
  const apiKey = process.env.POLZA_AI_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await fetch('https://polza.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/whisper-1',
        file: dataUri,
        response_format: 'json',
      }),
    });

    if (!res.ok) {
      console.error('[Telegram] Transcription request failed:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return typeof data?.text === 'string' ? data.text : null;
  } catch (err) {
    console.error('[Telegram] Transcription error:', err);
    return null;
  }
}
