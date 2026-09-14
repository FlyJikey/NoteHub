import { NextResponse } from 'next/server';
import { getAllBoards, saveBoard } from '@/lib/db';
import { appendTelegramNote } from '@/lib/telegramNotes';
import { sendTelegramMessage, getTelegramFileDataUri, transcribeAudioDataUri } from '@/lib/telegram';

// Telegram calls this endpoint for every update once the webhook is registered (see /api/telegram/setup).
export async function POST(req: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (expectedSecret) {
    const receivedSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (receivedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update?.message;
  const chatId: number | undefined = message?.chat?.id;
  if (!message || !chatId) {
    return NextResponse.json({ ok: true });
  }

  const senderName: string = message.from?.first_name || message.from?.username || 'коллега';
  const text: string | undefined = message.text;

  try {
    const boards = await getAllBoards();

    // /connect CODE (works in DMs and groups) or /start CODE (Telegram deep-link payload)
    const connectMatch = text?.match(/^\/(connect|start)(?:@\w+)?\s*(\S+)?/i);
    if (connectMatch) {
      const code = connectMatch[2];
      if (!code) {
        await sendTelegramMessage(
          chatId,
          'Пришлите команду в формате:\n/connect КОД_СТОЛА\n\nКод показан во вкладке Telegram на нужном столе в NoteHub.'
        );
        return NextResponse.json({ ok: true });
      }

      const board = boards.find((b) => b.telegramConfig?.inviteCode === code);
      if (!board) {
        await sendTelegramMessage(chatId, '❌ Код не найден. Проверьте код в NoteHub и попробуйте снова.');
        return NextResponse.json({ ok: true });
      }

      board.telegramConfig = {
        ...board.telegramConfig,
        connected: true,
        chatId,
      };
      await saveBoard(board);
      await sendTelegramMessage(
        chatId,
        `✅ Этот чат подключен к столу «${board.title}».\nПрисылайте текст, голосовые или фото — они появятся на столе автоматически.`
      );
      return NextResponse.json({ ok: true });
    }

    const board = boards.find((b) => b.telegramConfig?.connected && b.telegramConfig?.chatId === chatId);
    if (!board) {
      await sendTelegramMessage(
        chatId,
        'Этот чат ещё не подключен ни к одному столу.\nОткройте нужный стол в NoteHub → кнопка Telegram, и отправьте сюда команду /connect с показанным кодом.'
      );
      return NextResponse.json({ ok: true });
    }

    if (message.voice || message.audio) {
      const fileId = message.voice?.file_id || message.audio?.file_id;
      const file = await getTelegramFileDataUri(fileId);
      if (!file) {
        await sendTelegramMessage(chatId, '⚠️ Не получилось скачать голосовое сообщение.');
        return NextResponse.json({ ok: true });
      }

      const transcript = await transcribeAudioDataUri(file.dataUri);
      if (!transcript || !transcript.trim()) {
        await sendTelegramMessage(chatId, '⚠️ Не получилось распознать голосовое сообщение.');
        return NextResponse.json({ ok: true });
      }

      await appendTelegramNote(board, {
        title: `🎤 Голосовое от ${senderName}`,
        content: transcript,
        tags: ['telegram', 'voice'],
        author: `tg_${senderName}`,
      });
      await sendTelegramMessage(chatId, `✅ Распознано и добавлено на стол «${board.title}»:\n«${transcript}»`);
      return NextResponse.json({ ok: true });
    }

    if (message.photo?.length) {
      const largestPhoto = message.photo[message.photo.length - 1];
      const file = await getTelegramFileDataUri(largestPhoto.file_id);
      await appendTelegramNote(board, {
        title: `📷 Фото от ${senderName}`,
        content: message.caption || '',
        tags: ['telegram', 'photo'],
        author: `tg_${senderName}`,
        images: file ? [file.dataUri] : [],
      });
      await sendTelegramMessage(chatId, `✅ Фото добавлено на стол «${board.title}»`);
      return NextResponse.json({ ok: true });
    }

    if (text && text.trim()) {
      await appendTelegramNote(board, {
        title: `💬 Telegram от ${senderName}`,
        content: text,
        tags: ['telegram', 'входящие'],
        author: `tg_${senderName}`,
      });
      await sendTelegramMessage(chatId, `✅ Добавлено на стол «${board.title}»`);
    }
  } catch (err) {
    console.error('[Telegram webhook] error:', err);
  }

  return NextResponse.json({ ok: true });
}
