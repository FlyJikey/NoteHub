'use client';

import React, { useState } from 'react';
import { NoteItem, ChecklistItem } from '@/types';
import { 
  X, CheckSquare, Square, Plus, Trash2, Tag, 
  Image as ImageIcon, Pin, Calendar, Link2, Sparkles 
} from 'lucide-react';
import { formatDate, generateId } from '@/lib/utils';

interface NoteModalProps {
  note: NoteItem;
  allNotes: NoteItem[];
  isEditable: boolean;
  onClose: () => void;
  onUpdate: (updated: NoteItem) => void;
  onDelete: (id: string) => void;
}

const COLOR_PRESETS = [
  { name: 'Желтый', hex: '#fef08a', bg: 'bg-amber-100', border: 'border-amber-300' },
  { name: 'Зеленый', hex: '#bbf7d0', bg: 'bg-emerald-100', border: 'border-emerald-300' },
  { name: 'Голубой', hex: '#bae6fd', bg: 'bg-sky-100', border: 'border-sky-300' },
  { name: 'Лавандовый', hex: '#e9d5ff', bg: 'bg-purple-100', border: 'border-purple-300' },
  { name: 'Розовый', hex: '#fbcfe8', bg: 'bg-pink-100', border: 'border-pink-300' },
  { name: 'Коралловый', hex: '#fecaca', bg: 'bg-rose-100', border: 'border-rose-300' },
  { name: 'Нейтральный', hex: '#f3f4f6', bg: 'bg-neutral-100', border: 'border-neutral-300' },
];

export const NoteModal: React.FC<NoteModalProps> = ({
  note,
  allNotes,
  isEditable,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [color, setColor] = useState(note.color);
  const [tags, setTags] = useState<string[]>(note.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [checklists, setChecklists] = useState<ChecklistItem[]>(note.checklists || []);
  const [newChecklistInput, setNewChecklistInput] = useState('');
  const [images, setImages] = useState<string[]>(note.images || []);
  const [pinned, setPinned] = useState(note.pinned || false);
  const [isUploading, setIsUploading] = useState(false);

  const handleSave = (overrides?: Partial<NoteItem>) => {
    const updated: NoteItem = {
      ...note,
      title: title.trim() || 'Без названия',
      content,
      color,
      tags,
      checklists,
      images,
      pinned,
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    onUpdate(updated);
  };

  const handleAddTag = () => {
    const tag = newTagInput.trim().replace(/^#/, '');
    if (tag && !tags.includes(tag)) {
      const updatedTags = [...tags, tag];
      setTags(updatedTags);
      setNewTagInput('');
      handleSave({ tags: updatedTags });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = tags.filter((t) => t !== tagToRemove);
    setTags(updated);
    handleSave({ tags: updated });
  };

  const handleAddChecklist = () => {
    if (!newChecklistInput.trim()) return;
    const newItem: ChecklistItem = {
      id: generateId('cl'),
      text: newChecklistInput.trim(),
      done: false,
    };
    const updated = [...checklists, newItem];
    setChecklists(updated);
    setNewChecklistInput('');
    handleSave({ checklists: updated });
  };

  const handleToggleChecklist = (itemId: string) => {
    const updated = checklists.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    setChecklists(updated);
    handleSave({ checklists: updated });
  };

  const handleRemoveChecklist = (itemId: string) => {
    const updated = checklists.filter((item) => item.id !== itemId);
    setChecklists(updated);
    handleSave({ checklists: updated });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        const updatedImages = [...images, data.url];
        setImages(updatedImages);
        handleSave({ images: updatedImages });
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (imgUrl: string) => {
    const updatedImages = images.filter((img) => img !== imgUrl);
    setImages(updatedImages);
    handleSave({ images: updatedImages });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden flex flex-col max-h-[92vh]"
        style={{ borderTop: `6px solid ${color}` }}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newPinned = !pinned;
                setPinned(newPinned);
                handleSave({ pinned: newPinned });
              }}
              title={pinned ? 'Открепить' : 'Закрепить'}
              className={`p-1.5 rounded-lg transition-colors ${
                pinned
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Pin className={`w-4 h-4 ${pinned ? 'fill-current' : ''}`} />
            </button>

            {/* Color selector */}
            {isEditable && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-neutral-200 dark:border-neutral-700">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => {
                      setColor(c.hex);
                      handleSave({ color: c.hex });
                    }}
                    title={c.name}
                    className={`w-5 h-5 rounded-full transition-transform border ${
                      color === c.hex
                        ? 'scale-125 ring-2 ring-neutral-400 dark:ring-neutral-300 ring-offset-1 dark:ring-offset-neutral-900'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex, borderColor: '#00000020' }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {note.author && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
                @{note.author}
              </span>
            )}
            <span className="text-xs text-neutral-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(note.updatedAt)}
            </span>
            {isEditable && (
              <button
                onClick={() => {
                  if (confirm('Удалить эту заметку со стола?')) {
                    onDelete(note.id);
                  }
                }}
                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                title="Удалить заметку"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Note Title */}
          <div>
            <input
              type="text"
              value={title}
              disabled={!isEditable}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => handleSave()}
              placeholder="Заголовок заметки..."
              className="w-full text-2xl font-bold bg-transparent text-neutral-900 dark:text-neutral-50 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 focus:outline-none"
            />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
              >
                <Tag className="w-3 h-3 text-neutral-400" />
                #{t}
                {isEditable && (
                  <button
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-rose-500 ml-0.5"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {isEditable && (
              <div className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="+ тег"
                  className="px-2 py-0.5 text-xs rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 bg-transparent text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-500 w-20"
                />
              </div>
            )}
          </div>

          {/* Main Document Content */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Содержимое документа (Markdown)
            </label>
            <textarea
              value={content}
              disabled={!isEditable}
              onChange={(e) => setContent(e.target.value)}
              onBlur={() => handleSave()}
              rows={8}
              placeholder="Запишите мысли, договорённости, идеи или детали по проекту..."
              className="w-full p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>

          {/* Checklists / Action Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-emerald-500" />
                Чеклист / Задачи
              </label>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                {checklists.filter((c) => c.done).length} из {checklists.length} выполнено
              </span>
            </div>

            <div className="space-y-2">
              {checklists.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60"
                >
                  <button
                    disabled={!isEditable}
                    onClick={() => handleToggleChecklist(item.id)}
                    className="flex items-center gap-3 text-left flex-1 text-sm group"
                  >
                    {item.done ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200 shrink-0" />
                    )}
                    <span
                      className={`${
                        item.done
                          ? 'line-through text-neutral-400 dark:text-neutral-500'
                          : 'text-neutral-900 dark:text-neutral-50 font-medium'
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>
                  {isEditable && (
                    <button
                      onClick={() => handleRemoveChecklist(item.id)}
                      className="text-neutral-400 hover:text-rose-500 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {isEditable && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newChecklistInput}
                    onChange={(e) => setNewChecklistInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddChecklist()}
                    placeholder="Добавить пункт чеклиста..."
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  />
                  <button
                    onClick={handleAddChecklist}
                    className="px-3 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium hover:opacity-90 flex items-center gap-1 transition-opacity"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Media & Images */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-sky-500" />
                Прикреплённые изображения и графика
              </label>
              {isEditable && (
                <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline">
                  <Plus className="w-3.5 h-3.5" />
                  {isUploading ? 'Загрузка...' : 'Загрузить фото'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 aspect-video bg-neutral-100 dark:bg-neutral-800"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`Note attachment ${idx}`}
                      className="w-full h-full object-cover"
                    />
                    {isEditable && (
                      <button
                        onClick={() => handleRemoveImage(img)}
                        className="absolute top-2 right-2 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Удалить картинку"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">
                Нет прикрепленных изображений. Вы можете загрузить макеты, фото документов или графику.
              </p>
            )}
          </div>

          {/* Obsidian-like Connections */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
              <Link2 className="w-3.5 h-3.5 text-indigo-500" />
              Другие заметки на столе ({allNotes.length - 1}):
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {allNotes
                .filter((n) => n.id !== note.id)
                .map((other) => (
                  <span
                    key={other.id}
                    className="px-2 py-1 rounded text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 truncate max-w-[200px]"
                    title={other.title}
                  >
                    {other.title}
                  </span>
                ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Автоматически синхронизируется с памятью ИИ
          </div>
          <button
            onClick={() => {
              handleSave();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
