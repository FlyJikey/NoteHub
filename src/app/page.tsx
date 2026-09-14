'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, LayoutGrid, Brain, Shield, Send, ArrowRight, 
  Trash2, Calendar, FileText, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { Board } from '@/types';
import { formatDate } from '@/lib/utils';
import { UserBadge } from '@/components/user/UserBadge';
import { useCurrentUser } from '@/lib/user';

export default function HomePage() {
  const { user } = useCurrentUser();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const fetchBoards = async () => {
    try {
      const res = await fetch('/api/boards');
      const data = await res.json();
      if (data.boards) {
        setBoards(data.boards);
      }
    } catch (err) {
      console.error('Failed to load boards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim(),
          createdBy: user?.nickname,
        }),
      });
      const data = await res.json();
      if (data.board) {
        setBoards((prev) => [data.board, ...prev]);
        setIsCreating(false);
        setNewTitle('');
        setNewDesc('');
      }
    } catch (err) {
      console.error('Failed to create board:', err);
    }
  };

  const handleDeleteBoard = async (e: React.MouseEvent, board: Board) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить этот стол?')) return;

    try {
      await fetch(`/api/boards/${board.id}?token=${encodeURIComponent(board.shareToken)}`, { method: 'DELETE' });
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
    } catch (err) {
      console.error('Failed to delete board:', err);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-500 flex items-center justify-center text-white shadow-md">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight block leading-none">
                NoteHub
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">
                Canvas + Obsidian + AI Brain
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <UserBadge />
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Создать стол</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-1 space-y-12">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            <Brain className="w-3.5 h-3.5 text-amber-500" />
            <span>Интеллектуальная память проектов на базе Polza.ai</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50 leading-[1.15]">
            Стол для заметок, который{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 bg-clip-text text-transparent">
              никогда ничего не забывает
            </span>
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Создавайте бесконечные холсты с напарником, прикрепляйте стикеры, чеклисты и фото.
            ИИ-секретарь держит в памяти все договоренности, вопросы к заказчику и жесткие табу «что НЕ делать».
          </p>

          {/* Key Feature Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-left">
            <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-xs text-neutral-900 dark:text-neutral-100">
                <LayoutGrid className="w-4 h-4 text-indigo-500" />
                Визуальный стол & Документы
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Свободный холст (Miro / Obsidian Canvas) с возможностью открыть каждую карточку в большой полнотекстовый документ.
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-xs text-neutral-900 dark:text-neutral-100">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Табу «Что НЕ делать» & Задачи
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                ИИ автоматически отслеживает договоренности, формирует список открытых вопросов к созвону и запретов.
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-xs text-neutral-900 dark:text-neutral-100">
                <Send className="w-4 h-4 text-sky-500" />
                Telegram-мост & Совместный доступ
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Сбрасывайте мысли и войсы прямо из Telegram. Делитесь доской по ссылке с выбором прав (редактор / читатель).
              </p>
            </div>
          </div>
        </div>

        {/* Boards Grid */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Ваши рабочие столы</h2>
              <p className="text-xs text-neutral-500">
                Проекты и доски с сохранённой памятью
              </p>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              + Новый стол
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 rounded-2xl bg-neutral-200/60 dark:bg-neutral-800/60 animate-pulse"
                />
              ))}
            </div>
          ) : boards.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 space-y-3">
              <LayoutGrid className="w-8 h-8 text-neutral-400 mx-auto" />
              <p className="text-sm text-neutral-500 font-medium">
                У вас пока нет столов заметок
              </p>
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
              >
                Создать первый стол
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {boards.map((b) => (
                <Link
                  key={b.id}
                  href={`/board/${b.id}`}
                  className="group relative flex flex-col justify-between p-6 rounded-3xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-xl transition-all duration-200 hover:-translate-y-1 overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-base text-neutral-950 dark:text-neutral-50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {b.title}
                      </h3>
                      <button
                        onClick={(e) => handleDeleteBoard(e, b)}
                        className="p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Удалить доску"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {b.description && (
                      <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                        {b.description}
                      </p>
                    )}

                    {/* Stats pills */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {b.createdBy && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-100 dark:border-indigo-900/50">
                          @{b.createdBy}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
                        <FileText className="w-3 h-3 text-amber-500" />
                        {b.notes.length} заметок
                      </span>

                      {b.aiMemory.tasks.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {b.aiMemory.tasks.filter((t) => t.status === 'done').length}/
                          {b.aiMemory.tasks.length} задач
                        </span>
                      )}

                      {b.aiMemory.restrictions.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-medium">
                          <ShieldAlert className="w-3 h-3 text-rose-500" />
                          {b.aiMemory.restrictions.filter((r) => r.active).length} табу
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-5 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 mt-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(b.updatedAt)}
                    </span>
                    <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                      Открыть стол
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Board Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateBoard}
            className="w-full max-w-md rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-lg text-neutral-950 dark:text-neutral-50">
              Создать новый стол заметок
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Название стола / Проекта *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Например: Редизайн мобильного приложения"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Краткое описание (опционально)
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="О чем этот проект, ключевая цель..."
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm"
              >
                Создать
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
