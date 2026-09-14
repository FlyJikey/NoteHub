'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Board, NoteItem, DrawingPath } from '@/types';
import { NoteCard } from './NoteCard';
import { NoteModal } from './NoteModal';
import { DrawingLayer } from './DrawingLayer';
import { Toolbar, ToolType } from './Toolbar';
import { AiMemoryDrawer } from '../ai/AiMemoryDrawer';
import { ShareModal } from '../sharing/ShareModal';
import { TelegramModal } from '../telegram/TelegramModal';
import { generateId } from '@/lib/utils';
import { useCurrentUser } from '@/lib/user';

interface CanvasProps {
  initialBoard: Board;
  userRole?: 'editor' | 'viewer';
}

interface HistorySnapshot {
  notes: NoteItem[];
  drawings: DrawingPath[];
}

export const Canvas: React.FC<CanvasProps> = ({
  initialBoard,
  userRole = 'editor',
}) => {
  const { user } = useCurrentUser();
  const [board, setBoard] = useState<Board>(initialBoard);
  const isEditable = userRole === 'editor';

  // Canvas Viewport transform (pan & zoom)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [activeTool, setActiveTool] = useState<ToolType>('select');

  // History stack for Undo / Redo
  const [history, setHistory] = useState<HistorySnapshot[]>([
    { notes: initialBoard.notes, drawings: initialBoard.drawings },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Interaction states
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  // Dragging note
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Selected note & Document Modal
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [modalNote, setModalNote] = useState<NoteItem | null>(null);

  // Active Drawing
  const [activeDrawing, setActiveDrawing] = useState<DrawingPath | null>(null);

  // Modals & Drawers
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filterMyNotes, setFilterMyNotes] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save board to server (debounced)
  const triggerSave = useCallback((updatedBoard: Board) => {
    if (!isEditable) return;
    setIsSaving(true);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/boards/${updatedBoard.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: updatedBoard.notes,
            drawings: updatedBoard.drawings,
            aiMemory: updatedBoard.aiMemory,
            title: updatedBoard.title,
            updaterNickname: user?.nickname,
          }),
        });
      } catch (err) {
        console.error('Failed to save board:', err);
      } finally {
        setIsSaving(false);
      }
    }, 600);
  }, [isEditable, user]);

  // Push new state to history for Undo / Redo
  const pushHistory = useCallback((notes: NoteItem[], drawings: DrawingPath[]) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, { notes, drawings }];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const targetIndex = historyIndex - 1;
    const snapshot = history[targetIndex];
    if (!snapshot) return;

    const updated = { ...board, notes: snapshot.notes, drawings: snapshot.drawings };
    setBoard(updated);
    setHistoryIndex(targetIndex);
    triggerSave(updated);
  }, [history, historyIndex, board, triggerSave]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const targetIndex = historyIndex + 1;
    const snapshot = history[targetIndex];
    if (!snapshot) return;

    const updated = { ...board, notes: snapshot.notes, drawings: snapshot.drawings };
    setBoard(updated);
    setHistoryIndex(targetIndex);
    triggerSave(updated);
  }, [history, historyIndex, board, triggerSave]);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Undo / Redo shortcuts (Ctrl+Z / Cmd+Z / Cmd+Shift+Z / Ctrl+Y)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) ||
        ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y'))
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('hand');
      } else if (e.key === 'p' || e.key === 'P') {
        setActiveTool('freehand');
      } else if (e.key === 'a' || e.key === 'A') {
        setActiveTool('arrow');
      } else if (e.key === 'e' || e.key === 'E') {
        setActiveTool('eraser');
      } else if (e.key === 'n' || e.key === 'N') {
        if (isEditable) handleAddNote();
      } else if (e.key === 'Escape') {
        setSelectedNoteId(null);
        setActiveDrawing(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isEditable, handleUndo, handleRedo]);

  // Mouse Wheel: Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.08;
    const newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
    const clampedScale = Math.min(Math.max(newScale, 0.2), 2.5);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - pan.x) * (clampedScale / scale);
      const newPanY = mouseY - (mouseY - pan.y) * (clampedScale / scale);

      setScale(clampedScale);
      setPan({ x: newPanX, y: newPanY });
    }
  };

  const screenToWorld = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / scale,
      y: (clientY - rect.top - pan.y) / scale,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'hand' || spacePressed || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (activeTool === 'freehand' && isEditable) {
      const pt = screenToWorld(e.clientX, e.clientY);
      setActiveDrawing({
        id: generateId('draw'),
        boardId: board.id,
        type: 'freehand',
        points: [pt],
        color: '#6366f1',
        strokeWidth: 3,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    if (activeTool === 'arrow' && isEditable) {
      const pt = screenToWorld(e.clientX, e.clientY);
      setActiveDrawing({
        id: generateId('draw'),
        boardId: board.id,
        type: 'arrow',
        points: [pt, pt],
        color: '#3b82f6',
        strokeWidth: 2.5,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    setSelectedNoteId(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (draggingNoteId && isEditable) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const newNotes = board.notes.map((n) => {
        if (n.id === draggingNoteId) {
          return {
            ...n,
            x: Math.round(worldPos.x - dragOffset.x),
            y: Math.round(worldPos.y - dragOffset.y),
          };
        }
        return n;
      });

      const updated = { ...board, notes: newNotes };
      setBoard(updated);
      triggerSave(updated);
      return;
    }

    if (activeDrawing && activeDrawing.type === 'freehand') {
      const pt = screenToWorld(e.clientX, e.clientY);
      setActiveDrawing({
        ...activeDrawing,
        points: [...activeDrawing.points, pt],
      });
      return;
    }

    if (activeDrawing && activeDrawing.type === 'arrow') {
      const pt = screenToWorld(e.clientX, e.clientY);
      setActiveDrawing({
        ...activeDrawing,
        points: [activeDrawing.points[0], pt],
      });
      return;
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }

    if (draggingNoteId) {
      pushHistory(board.notes, board.drawings);
      setDraggingNoteId(null);
    }

    if (activeDrawing) {
      if (activeDrawing.points && activeDrawing.points.length > 1) {
        const updatedDrawings = [...board.drawings, activeDrawing];
        const updated = { ...board, drawings: updatedDrawings };
        setBoard(updated);
        pushHistory(board.notes, updatedDrawings);
        triggerSave(updated);
      }
      setActiveDrawing(null);
    }
  };

  const handleStartDragNote = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    if (!isEditable || activeTool === 'hand' || spacePressed || activeTool === 'eraser') return;

    const note = board.notes.find((n) => n.id === noteId);
    if (!note) return;

    setSelectedNoteId(noteId);

    if (activeTool === 'arrow') {
      const pt = { x: note.x + note.width / 2, y: note.y + 100 };
      setActiveDrawing({
        id: generateId('draw'),
        boardId: board.id,
        type: 'arrow',
        points: [pt, pt],
        color: '#6366f1',
        strokeWidth: 2.5,
        fromNoteId: note.id,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    const worldPos = screenToWorld(e.clientX, e.clientY);
    setDraggingNoteId(noteId);
    setDragOffset({
      x: worldPos.x - note.x,
      y: worldPos.y - note.y,
    });
  };

  const handleAddNote = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerWorld = screenToWorld(rect.width / 2, rect.height / 2);

    const colors = ['#bbf7d0', '#bae6fd', '#fef08a', '#e9d5ff', '#fecaca'];
    const randomColor = colors[board.notes.length % colors.length];

    const newNote: NoteItem = {
      id: generateId('note'),
      boardId: board.id,
      x: Math.round(centerWorld.x - 160),
      y: Math.round(centerWorld.y - 120),
      width: 320,
      height: 240,
      title: 'Новая мысль',
      content: '',
      color: randomColor,
      tags: [],
      checklists: [],
      images: [],
      author: user?.nickname || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newNotes = [...board.notes, newNote];
    const updated = { ...board, notes: newNotes };
    setBoard(updated);
    pushHistory(newNotes, board.drawings);
    setSelectedNoteId(newNote.id);
    triggerSave(updated);
    setModalNote(newNote);
  };

  const handleUpdateNote = (updatedNote: NoteItem) => {
    const stampedNote = {
      ...updatedNote,
      updatedBy: user?.nickname || updatedNote.updatedBy,
    };
    const newNotes = board.notes.map((n) => (n.id === updatedNote.id ? stampedNote : n));
    const updated = { ...board, notes: newNotes };
    setBoard(updated);
    pushHistory(newNotes, board.drawings);
    setModalNote(stampedNote);
    triggerSave(updated);
  };

  const handleDeleteNote = (noteId: string) => {
    const newNotes = board.notes.filter((n) => n.id !== noteId);
    const newDrawings = board.drawings.filter(
      (d) => d.fromNoteId !== noteId && d.toNoteId !== noteId
    );
    const updated = { ...board, notes: newNotes, drawings: newDrawings };
    setBoard(updated);
    pushHistory(newNotes, newDrawings);
    if (modalNote?.id === noteId) setModalNote(null);
    triggerSave(updated);
  };

  // Delete Drawing (single line or arrow)
  const handleDeleteDrawing = (drawingId: string) => {
    const newDrawings = board.drawings.filter((d) => d.id !== drawingId);
    const updated = { ...board, drawings: newDrawings };
    setBoard(updated);
    pushHistory(board.notes, newDrawings);
    triggerSave(updated);
  };

  // Clear all drawings with one click
  const handleClearAllDrawings = () => {
    if (!confirm('Стереть все линии и стрелки с этого стола?')) return;
    const updated = { ...board, drawings: [] };
    setBoard(updated);
    pushHistory(board.notes, []);
    triggerSave(updated);
  };

  const handleUpdateMemory = (newMemory: any) => {
    const updated = { ...board, aiMemory: newMemory };
    setBoard(updated);
    triggerSave(updated);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className={`relative w-screen h-screen overflow-hidden select-none bg-neutral-100 dark:bg-neutral-950 ${
        isPanning || spacePressed || activeTool === 'hand'
          ? 'cursor-grab active:cursor-grabbing'
          : activeTool === 'eraser'
          ? 'cursor-pointer'
          : activeTool === 'freehand' || activeTool === 'arrow'
          ? 'cursor-crosshair'
          : 'cursor-default'
      }`}
      style={{
        backgroundImage: `radial-gradient(circle, rgba(150, 150, 150, 0.25) 1px, transparent 1px)`,
        backgroundSize: `${24 * scale}px ${24 * scale}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* Transformed World Layer */}
      <div
        className="absolute top-0 left-0 w-full h-full origin-top-left pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
        }}
      >
        {/* SVG Drawing Layer (connectors, arrows, freehand) */}
        <DrawingLayer
          drawings={board.drawings}
          notes={board.notes}
          activeDrawing={activeDrawing}
          isEditable={isEditable}
          isEraserMode={activeTool === 'eraser'}
          onDeleteDrawing={handleDeleteDrawing}
        />

        {/* Notes Cards Layer */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-auto">
          {board.notes.map((note) => {
            const isMyNote = Boolean(user) && note.author === user?.nickname;
            const isDimmed = filterMyNotes && Boolean(user) && !isMyNote;
            return (
              <NoteCard
                key={note.id}
                note={note}
                scale={scale}
                isSelected={selectedNoteId === note.id}
                isEditable={isEditable}
                isDimmed={isDimmed}
                isMyNote={isMyNote}
                onSelect={() => setSelectedNoteId(note.id)}
                onOpenModal={() => setModalNote(note)}
                onStartDrag={handleStartDragNote}
                onDelete={handleDeleteNote}
              />
            );
          })}
        </div>
      </div>

      {/* Floating Toolbar & Header Controls */}
      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onAddNote={handleAddNote}
        scale={scale}
        onZoomIn={() => setScale((s) => Math.min(s * 1.15, 2.5))}
        onZoomOut={() => setScale((s) => Math.max(s / 1.15, 0.2))}
        onResetZoom={() => {
          setScale(1);
          setPan({ x: 0, y: 0 });
        }}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
        onToggleAiMemory={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
        isAiDrawerOpen={isAiDrawerOpen}
        activeTasksCount={board.aiMemory.tasks.filter((t) => t.status !== 'done').length}
        restrictionsCount={board.aiMemory.restrictions.filter((r) => r.active).length}
        isSaving={isSaving}
        boardTitle={board.title}
        isEditable={isEditable}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClearAllDrawings={handleClearAllDrawings}
        drawingsCount={board.drawings.length}
        members={board.members}
        filterMyNotes={filterMyNotes}
        onToggleFilterMyNotes={() => setFilterMyNotes(!filterMyNotes)}
        myNotesCount={user ? board.notes.filter((n) => n.author === user.nickname).length : 0}
      />

      {/* Full Document View Modal (Notion/Obsidian style) */}
      {modalNote && (
        <NoteModal
          note={modalNote}
          allNotes={board.notes}
          isEditable={isEditable}
          onClose={() => setModalNote(null)}
          onUpdate={handleUpdateNote}
          onDelete={handleDeleteNote}
        />
      )}

      {/* AI Memory Drawer (Right Slide-over) */}
      <AiMemoryDrawer
        board={board}
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        onUpdateMemory={handleUpdateMemory}
      />

      {/* Share Modal */}
      <ShareModal
        board={board}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Telegram Bridge Modal */}
      <TelegramModal
        board={board}
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        onNoteAdded={(newNote, updatedMemory) => {
          setBoard((prev) => ({
            ...prev,
            notes: [...prev.notes, newNote],
            aiMemory: updatedMemory || prev.aiMemory,
          }));
        }}
        onTelegramConfigChange={(config) => {
          setBoard((prev) => ({ ...prev, telegramConfig: config }));
        }}
      />
    </div>
  );
};
