'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Board, AiMemoryState, TaskItem, RestrictionItem, ClientQuestionItem } from '@/types';
import { 
  X, Brain, Sparkles, AlertTriangle, HelpCircle, 
  CheckCircle2, Plus, RefreshCw, Send, 
  MessageSquare, Check, ShieldAlert
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { generateId } from '@/lib/utils';

interface AiMemoryDrawerProps {
  board: Board;
  isOpen: boolean;
  onClose: () => void;
  onUpdateMemory: (newMemory: AiMemoryState) => void;
}

type TabType = 'memory' | 'chat';

// Server only ever looks at the last 10 turns (see askProjectAssistant in
// src/lib/polza.ts), so there's no point sending — or keeping in memory —
// more than that plus a little headroom for what's currently on screen.
const MAX_CHAT_HISTORY = 40;
const CHAT_TURNS_TO_SEND = 10;

export const AiMemoryDrawer: React.FC<AiMemoryDrawerProps> = ({
  board,
  isOpen,
  onClose,
  onUpdateMemory,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('memory');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [memory, setMemory] = useState<AiMemoryState>(board.aiMemory);

  // New item inputs
  const [newRestrictionText, setNewRestrictionText] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newTaskText, setNewTaskText] = useState('');

  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; text: string }>>([
    {
      id: 'init',
      role: 'assistant',
      text: `Привет! Я ИИ-ассистент проекта "${board.title}". Я помню все карточки со стола, открытые вопросы к заказчику и жесткие табу "что НЕ делать". Спросите меня о чем угодно!`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMemory(board.aiMemory);
  }, [board.aiMemory]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chatMessages, activeTab, isChatSending]);

  // Sync memory via Polza.ai
  const handleSyncMemory = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(`/api/boards/${board.id}/sync-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.aiMemory) {
        setMemory(data.aiMemory);
        onUpdateMemory(data.aiMemory);
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        } catch {
          // ignore
        }
      } else {
        setSyncError(data.error || 'Не удалось синхронизировать память проекта.');
      }
    } catch (err) {
      console.error('Failed to sync memory:', err);
      setSyncError('Сетевая ошибка при синхронизации памяти.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Restrictions handlers
  const handleToggleRestriction = (id: string) => {
    const updated = memory.restrictions.map((r) =>
      r.id === id ? { ...r, active: !r.active } : r
    );
    const newMem = { ...memory, restrictions: updated };
    setMemory(newMem);
    onUpdateMemory(newMem);
  };

  const handleAddRestriction = () => {
    if (!newRestrictionText.trim()) return;
    const newItem: RestrictionItem = {
      id: generateId('restr'),
      text: newRestrictionText.trim(),
      active: true,
      createdAt: new Date().toISOString(),
    };
    const newMem = {
      ...memory,
      restrictions: [newItem, ...memory.restrictions],
    };
    setMemory(newMem);
    onUpdateMemory(newMem);
    setNewRestrictionText('');
  };

  const handleRemoveRestriction = (id: string) => {
    const newMem = {
      ...memory,
      restrictions: memory.restrictions.filter((r) => r.id !== id),
    };
    setMemory(newMem);
    onUpdateMemory(newMem);
  };

  // Client Questions handlers
  const handleToggleQuestionAnswered = (id: string) => {
    const updated = memory.clientQuestions.map((q) =>
      q.id === id ? { ...q, answered: !q.answered } : q
    );
    const newMem = { ...memory, clientQuestions: updated };
    setMemory(newMem);
    onUpdateMemory(newMem);
  };

  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return;
    const newItem: ClientQuestionItem = {
      id: generateId('q'),
      text: newQuestionText.trim(),
      answered: false,
      createdAt: new Date().toISOString(),
    };
    const newMem = {
      ...memory,
      clientQuestions: [newItem, ...memory.clientQuestions],
    };
    setMemory(newMem);
    onUpdateMemory(newMem);
    setNewQuestionText('');
  };

  // Tasks handlers
  const handleToggleTaskStatus = (id: string) => {
    const task = memory.tasks.find((t) => t.id === id);
    if (!task) return;

    const nextStatus: 'pending' | 'in_progress' | 'done' =
      task.status === 'done' ? 'pending' : 'done';
    if (nextStatus === 'done') {
      try {
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
      } catch {
        // ignore
      }
    }

    const updated: TaskItem[] = memory.tasks.map((t) =>
      t.id === id ? { ...t, status: nextStatus } : t
    );
    const newMem: AiMemoryState = { ...memory, tasks: updated };
    setMemory(newMem);
    onUpdateMemory(newMem);
  };

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    const newItem: TaskItem = {
      id: generateId('task'),
      text: newTaskText.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const newMem = {
      ...memory,
      tasks: [newItem, ...memory.tasks],
    };
    setMemory(newMem);
    onUpdateMemory(newMem);
    setNewTaskText('');
  };

  // Chat message handler
  const handleSendChatMessage = async (presetText?: string) => {
    const textToSend = presetText || chatInput.trim();
    if (!textToSend || isChatSending) return;

    const userMsg = { id: generateId('msg'), role: 'user' as const, text: textToSend };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages.slice(-MAX_CHAT_HISTORY));
    if (!presetText) setChatInput('');
    setIsChatSending(true);

    try {
      const res = await fetch(`/api/boards/${board.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The server only looks at the last CHAT_TURNS_TO_SEND turns anyway
          // (see askProjectAssistant) — sending the full history would just be
          // a growing payload for no benefit.
          messages: updatedMessages
            .slice(-CHAT_TURNS_TO_SEND)
            .map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await res.json();
      setChatMessages((prev) =>
        [
          ...prev,
          {
            id: generateId('msg'),
            role: 'assistant' as const,
            text: data.reply || 'Ответ не получен',
          },
        ].slice(-MAX_CHAT_HISTORY)
      );
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages((prev) =>
        [
          ...prev,
          {
            id: generateId('msg'),
            role: 'assistant' as const,
            text: 'Ошибка связи с ИИ-сервером. Проверьте POLZA_AI_API_KEY в .env.local.',
          },
        ].slice(-MAX_CHAT_HISTORY)
      );
    } finally {
      setIsChatSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-900/70">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-md">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              ИИ-Память Проекта
            </h2>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Хранит договоренности, задачи и табу
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

      {/* Tabs */}
      <div className="flex items-center border-b border-neutral-100 dark:border-neutral-800 px-4 bg-white dark:bg-neutral-900 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('memory')}
          className={`flex items-center gap-1.5 py-3 px-3 border-b-2 transition-colors ${
            activeTab === 'memory'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Память и Табу
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-1.5 py-3 px-3 border-b-2 transition-colors ${
            activeTab === 'chat'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Чат с Ассистентом
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {activeTab === 'memory' && (
          <>
            {/* Action Button: Re-scan with AI */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50 to-amber-50 dark:from-indigo-950/30 dark:to-amber-950/20 border border-indigo-100 dark:border-indigo-900/40">
              <div className="text-xs">
                <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                  Синхронизация мыслей
                </span>
                <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">
                  Сканирует все карточки стола и обновляет память
                </span>
              </div>
              <button
                disabled={isSyncing}
                onClick={handleSyncMemory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Анализ...' : 'Синхронизировать'}
              </button>
            </div>

            {syncError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
                {syncError}
              </div>
            )}

            {/* Project Summary */}
            {memory.summary && (
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Сводка проекта
                </span>
                <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {memory.summary}
                </p>
              </div>
            )}

            {/* BLOCK 1: ОГРАНИЧЕНИЯ & ЧТО НЕ ДЕЛАТЬ (Negative Constraints) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Ограничения & Что НЕ делать ({memory.restrictions.filter((r) => r.active).length})
                </label>
                <span className="text-[10px] text-neutral-400">Табу проекта</span>
              </div>

              <div className="space-y-1.5">
                {memory.restrictions.map((restr) => (
                  <div
                    key={restr.id}
                    className={`flex items-start justify-between gap-2 p-2.5 rounded-xl border text-xs transition-all ${
                      restr.active
                        ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40 text-rose-900 dark:text-rose-200 font-medium'
                        : 'bg-neutral-50 dark:bg-neutral-800/30 border-neutral-100 dark:border-neutral-800 text-neutral-400 line-through'
                    }`}
                  >
                    <button
                      onClick={() => handleToggleRestriction(restr.id)}
                      className="text-left flex-1 flex items-center gap-2"
                    >
                      <AlertTriangle
                        className={`w-3.5 h-3.5 shrink-0 ${
                          restr.active ? 'text-rose-500' : 'text-neutral-400'
                        }`}
                      />
                      <span>{restr.text}</span>
                    </button>
                    <button
                      onClick={() => handleRemoveRestriction(restr.id)}
                      className="text-neutral-400 hover:text-rose-500 p-0.5"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newRestrictionText}
                    onChange={(e) => setNewRestrictionText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddRestriction()}
                    placeholder="Добавить табу (напр. 'Не менять цвет шапки')..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none"
                  />
                  <button
                    onClick={handleAddRestriction}
                    className="p-1.5 rounded-lg bg-rose-600 text-white text-xs hover:bg-rose-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* BLOCK 2: ВОПРОСЫ К ЗАКАЗЧИКУ (Client Questions) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" />
                  Вопросы к заказчику / Блокеры (
                  {memory.clientQuestions.filter((q) => !q.answered).length} открыто)
                </label>
                <span className="text-[10px] text-neutral-400">К созвону</span>
              </div>

              <div className="space-y-1.5">
                {memory.clientQuestions.map((q) => (
                  <div
                    key={q.id}
                    className={`flex items-start justify-between gap-2 p-2.5 rounded-xl border text-xs transition-all ${
                      q.answered
                        ? 'bg-neutral-50 dark:bg-neutral-800/30 border-neutral-100 dark:border-neutral-800 text-neutral-400 line-through'
                        : 'bg-sky-50/70 dark:bg-sky-950/20 border-sky-200/80 dark:border-sky-900/40 text-sky-950 dark:text-sky-200'
                    }`}
                  >
                    <button
                      onClick={() => handleToggleQuestionAnswered(q.id)}
                      className="text-left flex-1 flex items-center gap-2"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          q.answered
                            ? 'bg-sky-600 border-sky-600 text-white'
                            : 'border-sky-300 dark:border-sky-700 bg-white dark:bg-neutral-900'
                        }`}
                      >
                        {q.answered && <Check className="w-3 h-3" />}
                      </div>
                      <span>{q.text}</span>
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
                    placeholder="Что спросить у клиента на созвоне?..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none"
                  />
                  <button
                    onClick={handleAddQuestion}
                    className="p-1.5 rounded-lg bg-sky-600 text-white text-xs hover:bg-sky-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* BLOCK 3: ЗАДАЧИ В РАБОТЕ (Tasks & Action Items) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Задачи & План ({memory.tasks.filter((t) => t.status === 'done').length}/
                  {memory.tasks.length})
                </label>
                <span className="text-[10px] text-neutral-400">Action items</span>
              </div>

              <div className="space-y-1.5">
                {memory.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs transition-all ${
                      task.status === 'done'
                        ? 'bg-neutral-50 dark:bg-neutral-800/30 border-neutral-100 dark:border-neutral-800 text-neutral-400 line-through'
                        : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40 text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    <button
                      onClick={() => handleToggleTaskStatus(task.id)}
                      className="text-left flex-1 flex items-center gap-2"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          task.status === 'done'
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900'
                        }`}
                      >
                        {task.status === 'done' && <Check className="w-3 h-3" />}
                      </div>
                      <span>{task.text}</span>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.assignedTo && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/40">
                          @{task.assignedTo}
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                          task.status === 'done'
                            ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {task.status === 'done' ? 'Сделано' : 'В работе'}
                      </span>
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    placeholder="Добавить новую задачу проекта..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none"
                  />
                  <button
                    onClick={handleAddTask}
                    className="p-1.5 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Tab 2: AI Assistant Chat */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full space-y-4">
            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'Что мы решили по проекту?',
                'Что спросить у заказчика?',
                'Какие у нас табу и ограничения?',
                'Что сейчас нужно сделать?',
              ].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleSendChatMessage(preset)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-[11px] text-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Chat Messages */}
            <div className="flex-1 space-y-3 min-h-[300px] overflow-y-auto pr-1">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-none whitespace-pre-line'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isChatSending && (
                <div className="flex justify-start">
                  <div className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl px-3.5 py-2 text-xs text-neutral-500 animate-pulse">
                    ИИ думает...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="pt-2">
              <div className="flex items-center gap-2 p-1.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                  placeholder="Спросите или сообщите что сделали..."
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none"
                />
                <button
                  disabled={isChatSending || !chatInput.trim()}
                  onClick={() => handleSendChatMessage()}
                  className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
