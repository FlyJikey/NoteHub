'use client';

import React from 'react';
import { 
  MousePointer, Hand, Plus, PenTool, 
  ArrowUpRight, Eraser, Undo2, Redo2,
  ZoomIn, ZoomOut, RotateCcw, 
  Share2, Send, Brain, ChevronLeft, CheckCircle2, Users, UserCheck
} from 'lucide-react';
import Link from 'next/link';
import { UserBadge } from '../user/UserBadge';

export type ToolType = 'select' | 'hand' | 'freehand' | 'arrow' | 'eraser';

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  onAddNote: () => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onOpenShareModal: () => void;
  onOpenTelegramModal: () => void;
  onToggleAiMemory: () => void;
  isAiDrawerOpen: boolean;
  activeTasksCount: number;
  restrictionsCount: number;
  isSaving?: boolean;
  boardTitle: string;
  isEditable: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearAllDrawings: () => void;
  drawingsCount: number;
  members?: string[];
  filterMyNotes?: boolean;
  onToggleFilterMyNotes?: () => void;
  myNotesCount?: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setActiveTool,
  onAddNote,
  scale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onOpenShareModal,
  onOpenTelegramModal,
  onToggleAiMemory,
  isAiDrawerOpen,
  activeTasksCount,
  restrictionsCount,
  isSaving,
  boardTitle,
  isEditable,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearAllDrawings,
  drawingsCount,
  members,
  filterMyNotes = false,
  onToggleFilterMyNotes,
  myNotesCount = 0,
}) => {
  return (
    <>
      {/* Top Header Bar: Clean & Minimal */}
      <header className="fixed top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        {/* Left Side: Back & Title */}
        <div className="flex items-center gap-2 pointer-events-auto bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-lg border border-neutral-200/90 dark:border-neutral-800">
          <Link
            href="/"
            title="Все столы"
            className="p-1.5 text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
          <h1 className="font-bold text-sm text-neutral-900 dark:text-neutral-50 max-w-[200px] sm:max-w-[320px] truncate">
            {boardTitle}
          </h1>
          <div className="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400 pl-1">
            {isSaving ? (
              <span className="animate-pulse text-amber-500 font-medium">Сохранение...</span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Сохранено
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Telegram, Share, User, and AI Memory Drawer Toggle */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Members list if any */}
          {members && members.length > 0 && (
            <div className="hidden lg:flex items-center -space-x-1.5 px-1 py-1 rounded-xl bg-white/80 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
              {members.slice(0, 3).map((m) => (
                <div
                  key={m}
                  className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 border border-white dark:border-neutral-900 text-white flex items-center justify-center text-[9px] font-bold uppercase shadow-sm"
                  title={`Участник проекта: @${m}`}
                >
                  {m.slice(0, 1)}
                </div>
              ))}
              {members.length > 3 && (
                <span className="text-[10px] text-neutral-500 font-bold px-1.5">
                  +{members.length - 3}
                </span>
              )}
            </div>
          )}

          {/* User profile / nickname badge */}
          <UserBadge compact={false} />

          {/* Telegram bridge button */}
          <button
            onClick={onOpenTelegramModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl shadow-lg border border-neutral-200/90 dark:border-neutral-800 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
            title="Интеграция с Telegram"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Telegram</span>
          </button>

          {/* Share Button */}
          <button
            onClick={onOpenShareModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl shadow-lg border border-neutral-200/90 dark:border-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Поделиться</span>
          </button>

          {/* AI Memory Button */}
          <button
            onClick={onToggleAiMemory}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-lg border text-xs font-bold transition-all ${
              isAiDrawerOpen
                ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-300 dark:ring-indigo-800'
                : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900 dark:border-neutral-100 hover:opacity-95'
            }`}
          >
            <Brain className="w-4 h-4 text-amber-300 dark:text-amber-500" />
            <span>ИИ-Память</span>
            {(activeTasksCount > 0 || restrictionsCount > 0) && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 dark:bg-black/20 font-bold">
                {activeTasksCount} зад.
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Bottom Floating Canvas Tools: Clean, Functional, Fast */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-1.5 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-3 py-2 rounded-2xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800">
        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo || !isEditable}
          title="Шаг назад (Ctrl+Z / Cmd+Z)"
          className="p-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo || !isEditable}
          title="Шаг вперед (Ctrl+Shift+Z / Cmd+Shift+Z)"
          className="p-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700 mx-0.5" />

        {/* Tool Selectors */}
        <button
          onClick={() => setActiveTool('hand')}
          title="Рука / Перемещение холста (H или Пробел)"
          className={`p-2 rounded-xl transition-colors ${
            activeTool === 'hand'
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>

        <button
          onClick={() => setActiveTool('select')}
          title="Выбор и перемещение (V)"
          className={`p-2 rounded-xl transition-colors ${
            activeTool === 'select'
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {isEditable && (
          <>
            <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700 mx-0.5" />

            {/* Add Note Button */}
            <button
              onClick={onAddNote}
              title="Создать заметку-стикер (N)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-950 dark:bg-amber-950/80 dark:text-amber-200 font-semibold text-xs hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Заметка</span>
            </button>

            {/* Filter My Notes Toggle */}
            {onToggleFilterMyNotes && (
              <button
                onClick={onToggleFilterMyNotes}
                title={
                  filterMyNotes
                    ? 'Фильтр активен: подсвечиваются только ваши заметки (клик для сброса)'
                    : `Подсветить только мои заметки (${myNotesCount})`
                }
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filterMyNotes
                    ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 dark:ring-indigo-800'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Мои</span>
                {myNotesCount > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      filterMyNotes
                        ? 'bg-white/20 text-white'
                        : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    {myNotesCount}
                  </span>
                )}
              </button>
            )}

            {/* Freehand Pencil Tool */}
            <button
              onClick={() => setActiveTool(activeTool === 'freehand' ? 'select' : 'freehand')}
              title="Карандаш для рисования (P)"
              className={`p-2 rounded-xl transition-colors ${
                activeTool === 'freehand'
                  ? 'bg-indigo-600 text-white'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <PenTool className="w-4 h-4" />
            </button>

            {/* Arrow / Connector Tool */}
            <button
              onClick={() => setActiveTool(activeTool === 'arrow' ? 'select' : 'arrow')}
              title="Стрелка связи между карточками (A)"
              className={`p-2 rounded-xl transition-colors ${
                activeTool === 'arrow'
                  ? 'bg-indigo-600 text-white'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>

            {/* Eraser Tool */}
            <button
              onClick={() => setActiveTool(activeTool === 'eraser' ? 'select' : 'eraser')}
              title="Ластик — кликните по линии или стрелке, чтобы стереть (E)"
              className={`p-2 rounded-xl transition-colors ${
                activeTool === 'eraser'
                  ? 'bg-rose-600 text-white'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Eraser className="w-4 h-4" />
            </button>

            {/* Clear all drawings button (if any exist) */}
            {drawingsCount > 0 && (
              <button
                onClick={onClearAllDrawings}
                title="Очистить все линии и стрелки со стола"
                className="px-2 py-1 text-[11px] font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
              >
                Очистить линии
              </button>
            )}
          </>
        )}

        <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700 mx-0.5" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onZoomOut}
            title="Уменьшить"
            className="p-1.5 text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onResetZoom}
            title="Сбросить масштаб"
            className="px-1.5 py-1 text-xs font-mono text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors font-medium"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            title="Увеличить"
            className="p-1.5 text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onResetZoom}
            title="Центрировать стол"
            className="p-1.5 text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
};
