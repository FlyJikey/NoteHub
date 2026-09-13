'use client';

import React from 'react';
import { NoteItem } from '@/types';
import { 
  Maximize2, Pin, CheckSquare, 
  Tag, Image as ImageIcon, Trash2 
} from 'lucide-react';

interface NoteCardProps {
  note: NoteItem;
  scale: number;
  isSelected?: boolean;
  isEditable: boolean;
  isDimmed?: boolean;
  isMyNote?: boolean;
  onSelect: () => void;
  onOpenModal: () => void;
  onStartDrag: (e: React.MouseEvent, noteId: string) => void;
  onDelete: (noteId: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isSelected,
  isEditable,
  isDimmed,
  isMyNote,
  onSelect,
  onOpenModal,
  onStartDrag,
  onDelete,
}) => {
  const completedChecklistCount = note.checklists.filter((c) => c.done).length;
  const totalChecklistCount = note.checklists.length;

  return (
    <div
      onClick={onSelect}
      onMouseDown={(e) => {
        if (isEditable) {
          onStartDrag(e, note.id);
        }
      }}
      style={{
        transform: `translate(${note.x}px, ${note.y}px)`,
        width: `${note.width || 320}px`,
      }}
      className={`absolute select-none cursor-grab active:cursor-grabbing rounded-2xl shadow-md transition-all duration-200 group overflow-hidden bg-white dark:bg-neutral-900 border ${
        isDimmed
          ? 'opacity-25 blur-[0.3px] hover:opacity-100 hover:blur-none hover:z-20'
          : isSelected
          ? 'ring-2 ring-indigo-500 shadow-xl border-indigo-400 dark:border-indigo-500 z-10'
          : isMyNote
          ? 'border-indigo-300 dark:border-indigo-700 shadow-lg ring-1 ring-indigo-400/40 hover:shadow-xl'
          : 'border-neutral-200/90 dark:border-neutral-800 hover:shadow-xl hover:border-neutral-300 dark:hover:border-neutral-700'
      }`}
    >
      {/* Top accent color banner */}
      <div
        className="h-3 w-full flex items-center justify-end px-3"
        style={{ backgroundColor: note.color || '#fef08a' }}
      >
        {note.pinned && (
          <Pin className="w-3 h-3 text-neutral-900 fill-current -mt-0.5 drop-shadow-sm" />
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Card Header: High Contrast Title */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-50 leading-snug line-clamp-2 tracking-tight">
            {note.title || 'Без названия'}
          </h3>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenModal();
              }}
              title="Открыть в полный документ"
              className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            {isEditable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Удалить заметку?')) {
                    onDelete(note.id);
                  }
                }}
                title="Удалить"
                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Content snippet: High Contrast Text */}
        {note.content && (
          <p className="text-xs text-neutral-700 dark:text-neutral-300 line-clamp-3 leading-relaxed whitespace-pre-line font-normal">
            {note.content}
          </p>
        )}

        {/* Image thumbnail if any */}
        {note.images && note.images.length > 0 && (
          <div className="rounded-xl overflow-hidden aspect-video relative bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={note.images[0]}
              alt={note.title}
              className="w-full h-full object-cover"
            />
            {note.images.length > 1 && (
              <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/75 rounded text-[10px] text-white flex items-center gap-1 font-medium">
                <ImageIcon className="w-2.5 h-2.5" />+{note.images.length - 1}
              </div>
            )}
          </div>
        )}

        {/* Checklist summary bar */}
        {totalChecklistCount > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-100 dark:border-neutral-700/60">
            <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="flex-1">
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{
                    width: `${(completedChecklistCount / totalChecklistCount) * 100}%`,
                  }}
                />
              </div>
            </div>
            <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
              {completedChecklistCount}/{totalChecklistCount}
            </span>
          </div>
        )}

        {/* Tags: High Contrast Pills */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {note.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700/50"
              >
                <Tag className="w-2.5 h-2.5 text-neutral-500 dark:text-neutral-400" />
                {t}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium px-1">
                +{note.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Card Footer: Always High Contrast */}
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-1.5 truncate max-w-[180px]">
            {note.author ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 truncate" title={`Создал: @${note.author}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                @{note.author}
              </span>
            ) : (
              <span>Нажмите для открытия</span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal();
            }}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold shrink-0"
          >
            Развернуть →
          </button>
        </div>
      </div>
    </div>
  );
};
