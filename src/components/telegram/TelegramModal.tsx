'use client';

import React, { useState, useEffect } from 'react';
import { Board, NoteItem, AiMemoryState } from '@/types';
import { X, Send, Bot, Sparkles, Mic, Copy, Check, Link2, Unlink } from 'lucide-react';

interface TelegramModalProps {
  board: Board;
  isOpen: boolean;
  onClose: () => void;
  onNoteAdded: (note: NoteItem, updatedMemory?: AiMemoryState) => void;
  onTelegramConfigChange: (config: Board['telegramConfig']) => void;
}

export const TelegramModal: React.FC<TelegramModalProps> = ({
  board,
  isOpen,
  onClose,
  onNoteAdded,
  onTelegramConfigChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [botConfigured, setBotConfigured] = useState<boolean | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [testSender, setTestSender] = useState('Алексей (напарник)');
  const [testText, setTestText] = useState(
    'Заказчик просил не использовать синий цвет в интерфейсе. И нужно спросить в понедельник про формат выгрузки отчетов.'
  );
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/telegram/bot-info')
      .then((res) => res.json())
      .then((data) => {
        setBotConfigured(!!data.configured);
        setBotUsername(data.username || null);
      })
      .catch(() => setBotConfigured(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const inviteCode = board.telegramConfig?.inviteCode || 'nh_tg_default';
  const isConnected = !!board.telegramConfig?.connected && !!board.telegramConfig?.chatId;
  const deepLink = botUsername ? `https://t.me/${botUsername}?start=${inviteCode}` : null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(`/connect ${inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/telegram/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: board.id }),
      });
      const data = await res.json();
      if (data.telegramConfig) {
        onTelegramConfigChange(data.telegramConfig);
      }
    } catch (err) {
      console.error('Failed to disconnect Telegram:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSimulateIncoming = async () => {
    if (!testText.trim()) return;
    setIsSending(true);
    setSendSuccess(false);

    try {
      const res = await fetch('/api/telegram/incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: board.id,
          text: testText,
          sender: testSender,
          inviteCode: board.telegramConfig?.inviteCode,
        }),
      });
      const data = await res.json();
      if (data.note) {
        onNoteAdded(data.note, data.aiMemory);
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to simulate telegram message:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                Telegram-Мост для мыслей
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Сбрасывайте войсы и текст из Telegram прямо на этот стол
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connection status */}
        {botConfigured === false ? (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            Бот ещё не настроен на сервере: нужно задать переменную окружения{' '}
            <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 font-mono">TELEGRAM_BOT_TOKEN</code>{' '}
            и один раз открыть <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 font-mono">/api/telegram/setup</code> после деплоя.
          </div>
        ) : isConnected ? (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
              <Check className="w-4 h-4 shrink-0" />
              <span>Этот стол подключен к Telegram-чату. Присылайте текст, голосовые и фото боту.</span>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 text-[11px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
            >
              <Unlink className="w-3 h-3" />
              {isDisconnecting ? '...' : 'Отключить'}
            </button>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 text-xs space-y-2.5">
            <span className="font-bold text-sky-950 dark:text-sky-200 block">
              Как это решает проблему «забытых чатов»:
            </span>
            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed text-[11px]">
              Вы общаетесь в Telegram, пересылаете важную мысль боту — бот автоматически создает стикер на столе и передает его в память Polza.ai. ИИ сам извлекает запреты, задачи и вопросы. Поддерживаются текст, голосовые сообщения (с распознаванием речи) и фото.
            </p>

            {deepLink && (
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" />
                Открыть бота и подключить стол
              </a>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-sky-200/50 dark:border-sky-900/30">
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                Или команда для группового чата:
              </span>
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-neutral-800 text-[11px] font-mono text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                /connect {inviteCode}
              </button>
            </div>
          </div>
        )}

        {/* Live Simulator for testing right away */}
        <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Симулятор (без реального Telegram)
            </label>
            <span className="text-[10px] text-neutral-400">Для быстрого теста</span>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={testSender}
              onChange={(e) => setTestSender(e.target.value)}
              placeholder="Имя отправителя..."
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none"
            />
            <textarea
              rows={3}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Текст сообщения..."
              className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-neutral-400 flex items-center gap-1">
              <Mic className="w-3 h-3 text-rose-500" />
              В реальном боте войсы распознаются автоматически
            </span>

            <button
              disabled={isSending || !testText.trim()}
              onClick={handleSimulateIncoming}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isSending ? 'Отправка на стол...' : 'Отправить на стол'}
            </button>
          </div>

          {sendSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-500" />
              Мысль успешно добавлена на стол и проанализирована ИИ-памятью!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
