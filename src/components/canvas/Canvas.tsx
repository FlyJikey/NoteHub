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
  const [activeTool, setActiveTool] = useState<ToolType>('hand');

  // History stack for Undo / Redo. Kept as a single state object (stack + index
  // updated together) so pushHistory never has to read a stale `historyIndex`
  // out of its closure — two pushes queued in the same batch would otherwise
  // both trim against the same pre-batch index and one of them would be lost.
  const MAX_HISTORY = 50;
  const [historyState, setHistoryState] = useState<{ stack: HistorySnapshot[]; index: number }>({
    stack: [{ notes: initialBoard.notes, drawings: initialBoard.drawings }],
    index: 0,
  });
  const { stack: history, index: historyIndex } = historyState;

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

  // Active touch/pen/mouse contacts, keyed by pointerId — lets us tell a
  // single-finger pan/draw gesture apart from a two-finger pinch without
  // separate touch-event plumbing (Pointer Events unify mouse & touch).
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    startDistance: number;
    startScale: number;
    startPan: { x: number; y: number };
    startMid: { x: number; y: number };
  } | null>(null);

  // Ids removed locally since the last save. Sent alongside every save so the
  // server can tell "I deleted this" apart from "my local copy doesn't know
  // about this yet" when merging concurrent edits from other collaborators
  // (see mergeById in the boards/[id] PUT route). Never cleared on our own —
  // resending an already-applied deletion is harmless — except when undo/redo
  // brings an item back (see reconcileDeletedIds).
  const deletedNoteIdsRef = useRef<Set<string>>(new Set());
  const deletedDrawingIdsRef = useRef<Set<string>>(new Set());

  const reconcileDeletedIds = useCallback((notes: NoteItem[], drawings: DrawingPath[]) => {
    for (const n of notes) deletedNoteIdsRef.current.delete(n.id);
    for (const d of drawings) deletedDrawingIdsRef.current.delete(d.id);
  }, []);

  // Save board to server (debounced)
  const triggerSave = useCallback((updatedBoard: Board) => {
    if (!isEditable) return;
    setIsSaving(true);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/boards/${updatedBoard.id}?token=${encodeURIComponent(updatedBoard.shareToken)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: updatedBoard.notes,
            drawings: updatedBoard.drawings,
            aiMemory: updatedBoard.aiMemory,
            title: updatedBoard.title,
            updaterNickname: user?.nickname,
            deletedNoteIds: Array.from(deletedNoteIdsRef.current),
            deletedDrawingIds: Array.from(deletedDrawingIdsRef.current),
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
    setHistoryState((prev) => {
      const trimmed = prev.stack.slice(0, prev.index + 1);
      trimmed.push({ notes, drawings });
      // Cap the stack so a long editing session doesn't grow it unboundedly.
      const overflow = trimmed.length - MAX_HISTORY;
      const stack = overflow > 0 ? trimmed.slice(overflow) : trimmed;
      return { stack, index: stack.length - 1 };
    });
  }, []);

  // Undo / Redo are only ever invoked once per discrete user action (a single
  // keypress or button click), never twice within the same tick, so — unlike
  // pushHistory — there's no closure-staleness hazard in reading historyState
  // directly here. Keep setBoard/triggerSave as plain calls in the handler
  // body: a setState updater must stay a pure function of its previous state,
  // and React may invoke it more than once (e.g. Strict Mode), which would
  // silently double-fire those side effects if they lived inside one.
  // The server merges concurrent saves per-item by `updatedAt` (see mergeById
  // in the boards/[id] PUT route) so one collaborator's edit can't stomp
  // another's — whichever note version has the newer timestamp wins. A
  // restored snapshot's notes still carry their *original* updatedAt, which
  // is now older than what the server already has stored (the change undo/redo
  // is reverting). Sent as-is, the merge would keep the server's newer-but-
  // undone version and silently drop the undo/redo. Stamping "now" onto every
  // note in the snapshot makes the revert itself the newest write, so it wins.
  const restampNotesNow = (notes: NoteItem[]): NoteItem[] => {
    const now = new Date().toISOString();
    return notes.map((n) => ({ ...n, updatedAt: now }));
  };

  const handleUndo = useCallback(() => {
    if (historyState.index <= 0) return;
    const targetIndex = historyState.index - 1;
    const snapshot = historyState.stack[targetIndex];
    if (!snapshot) return;

    const restampedNotes = restampNotesNow(snapshot.notes);
    const updated = { ...board, notes: restampedNotes, drawings: snapshot.drawings };
    reconcileDeletedIds(restampedNotes, snapshot.drawings);
    setBoard(updated);
    setHistoryState((prev) => ({ ...prev, index: targetIndex }));
    triggerSave(updated);
  }, [historyState, board, triggerSave, reconcileDeletedIds]);

  const handleRedo = useCallback(() => {
    if (historyState.index >= historyState.stack.length - 1) return;
    const targetIndex = historyState.index + 1;
    const snapshot = historyState.stack[targetIndex];
    if (!snapshot) return;

    const restampedNotes = restampNotesNow(snapshot.notes);
    const updated = { ...board, notes: restampedNotes, drawings: snapshot.drawings };
    reconcileDeletedIds(restampedNotes, snapshot.drawings);
    setBoard(updated);
    setHistoryState((prev) => ({ ...prev, index: targetIndex }));
    triggerSave(updated);
  }, [historyState, board, triggerSave, reconcileDeletedIds]);

  // Any modal/drawer that owns its own keyboard input (typing, Escape-to-close)
  // should fully own the keyboard while it's open — canvas shortcuts must not
  // fire underneath it (e.g. typing "n" in the share-modal shouldn't spawn a note).
  const isAnyOverlayOpen =
    modalNote !== null || isShareModalOpen || isTelegramModalOpen || isAiDrawerOpen;

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (isAnyOverlayOpen) return;

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
        if (isEditable) setActiveTool('freehand');
      } else if (e.key === 'a' || e.key === 'A') {
        if (isEditable) setActiveTool('arrow');
      } else if (e.key === 'e' || e.key === 'E') {
        if (isEditable) setActiveTool('eraser');
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
  }, [isEditable, isAnyOverlayOpen, handleUndo, handleRedo]);

  // Mouse Wheel: Zoom.
  // React attaches wheel listeners as passive by default (it delegates to a
  // root listener registered with passive: true for scroll performance), so
  // e.preventDefault() inside a JSX onWheel handler is silently ignored and
  // the page scrolls/zooms underneath the canvas along with our own zoom.
  // A native listener registered with { passive: false } is the only way to
  // actually block the default scroll/zoom behavior.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      // Any overlay (AI memory drawer, note modal, share/telegram modals)
      // owns its own scrollable lists. Without this guard, preventDefault()
      // below blocks their native scroll too and zooms the canvas
      // underneath instead of letting the list scroll.
      if (isAnyOverlayOpen) return;
      e.preventDefault();
      const zoomFactor = 1.08;
      const newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
      const clampedScale = Math.min(Math.max(newScale, 0.2), 2.5);

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - pan.x) * (clampedScale / scale);
      const newPanY = mouseY - (mouseY - pan.y) * (clampedScale / scale);

      setScale(clampedScale);
      setPan({ x: newPanX, y: newPanY });
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [pan, scale, isAnyOverlayOpen]);

  const screenToWorld = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / scale,
      y: (clientY - rect.top - pan.y) / scale,
    };
  };

  const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const getMidpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    // Ignore right-click / secondary mouse buttons, but allow the middle
    // button (used for pan-by-scroll-click) and any touch/pen contact.
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // A second finger landing mid-gesture always means "start pinch-zoom" —
    // abort whatever single-pointer interaction (pan/drag/draw) was in
    // flight so the two gestures never fight over the same state.
    if (pointersRef.current.size === 2) {
      setIsPanning(false);
      setDraggingNoteId(null);
      setActiveDrawing(null);

      const pts = Array.from(pointersRef.current.values());
      pinchRef.current = {
        startDistance: getDistance(pts[0], pts[1]),
        startScale: scale,
        startPan: pan,
        startMid: getMidpoint(pts[0], pts[1]),
      };
      return;
    }

    if (pointersRef.current.size > 2) return;

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

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointersRef.current.size === 2 && pinchRef.current && containerRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const distance = getDistance(pts[0], pts[1]);
      const mid = getMidpoint(pts[0], pts[1]);
      const { startDistance, startScale, startPan, startMid } = pinchRef.current;

      const newScale = Math.min(Math.max(startScale * (distance / startDistance), 0.2), 2.5);

      // Keep the world point that was under the fingers at pinch-start
      // pinned under wherever the fingers currently are — this is what
      // makes the zoom feel anchored to the gesture instead of the origin.
      const rect = containerRef.current.getBoundingClientRect();
      const startMidLocal = { x: startMid.x - rect.left, y: startMid.y - rect.top };
      const anchorWorld = {
        x: (startMidLocal.x - startPan.x) / startScale,
        y: (startMidLocal.y - startPan.y) / startScale,
      };
      const midLocal = { x: mid.x - rect.left, y: mid.y - rect.top };

      setScale(newScale);
      setPan({
        x: midLocal.x - anchorWorld.x * newScale,
        y: midLocal.y - anchorWorld.y * newScale,
      });
      return;
    }

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
            updatedAt: new Date().toISOString(),
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

  // Finds the note (if any) whose bounding box contains a world-space point.
  // Used to "drop" an arrow started from a note onto whatever note it's
  // released over, so it links the two cards instead of just pointing at
  // fixed canvas coordinates.
  const findNoteAtWorldPoint = (pt: { x: number; y: number }, excludeId?: string) => {
    return board.notes.find(
      (n) =>
        n.id !== excludeId &&
        pt.x >= n.x &&
        pt.x <= n.x + (n.width || 320) &&
        pt.y >= n.y &&
        pt.y <= n.y + (n.height || 240)
    );
  };

  const finalizePointerInteraction = () => {
    if (isPanning) {
      setIsPanning(false);
    }

    if (draggingNoteId) {
      pushHistory(board.notes, board.drawings);
      setDraggingNoteId(null);
    }

    if (activeDrawing) {
      // A plain tap (no movement) with the arrow tool active still produces
      // two identical points — without this check it would save a
      // zero-length, invisible arrow. Mice rarely trigger this (a click
      // is unlikely to have literally zero mouse-move events), but a touch
      // tap does it every time, so this only shows up once touch is wired up.
      const [start, end] = activeDrawing.points || [];
      const isDegenerateArrow =
        activeDrawing.type === 'arrow' &&
        start &&
        end &&
        Math.hypot(end.x - start.x, end.y - start.y) < 4;

      if (activeDrawing.points && activeDrawing.points.length > 1 && !isDegenerateArrow) {
        let finalDrawing = activeDrawing;

        // An arrow dragged out from a note's edge (see handleStartDragNote)
        // carries fromNoteId but no toNoteId yet — set it here if the arrow
        // was released on top of another note, so DrawingLayer renders it as
        // a live connector between the two cards' centers (which stays
        // attached and follows either card when it's moved) instead of a
        // straight line pinned to the coordinates where it was drawn.
        if (activeDrawing.type === 'arrow' && activeDrawing.fromNoteId && !activeDrawing.toNoteId) {
          const endPt = activeDrawing.points[activeDrawing.points.length - 1];
          const targetNote = findNoteAtWorldPoint(endPt, activeDrawing.fromNoteId);
          if (targetNote) {
            finalDrawing = { ...activeDrawing, toNoteId: targetNote.id };
          }
        }

        const updatedDrawings = [...board.drawings, finalDrawing];
        const updated = { ...board, drawings: updatedDrawings };
        setBoard(updated);
        pushHistory(board.notes, updatedDrawings);
        triggerSave(updated);
      }
      setActiveDrawing(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    // Only finalize once every finger/button has been released — with a
    // pointer still down (e.g. one finger lifted mid-pinch), there's no
    // single-pointer gesture in flight to finalize yet.
    if (pointersRef.current.size === 0) {
      finalizePointerInteraction();
    }
  };

  const handleStartDragNote = (e: React.PointerEvent, noteId: string) => {
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
    const removedDrawings = board.drawings.filter(
      (d) => d.fromNoteId === noteId || d.toNoteId === noteId
    );
    const newNotes = board.notes.filter((n) => n.id !== noteId);
    const newDrawings = board.drawings.filter(
      (d) => d.fromNoteId !== noteId && d.toNoteId !== noteId
    );
    deletedNoteIdsRef.current.add(noteId);
    for (const d of removedDrawings) deletedDrawingIdsRef.current.add(d.id);
    const updated = { ...board, notes: newNotes, drawings: newDrawings };
    setBoard(updated);
    pushHistory(newNotes, newDrawings);
    if (modalNote?.id === noteId) setModalNote(null);
    triggerSave(updated);
  };

  // Delete Drawing (single line or arrow)
  const handleDeleteDrawing = (drawingId: string) => {
    deletedDrawingIdsRef.current.add(drawingId);
    const newDrawings = board.drawings.filter((d) => d.id !== drawingId);
    const updated = { ...board, drawings: newDrawings };
    setBoard(updated);
    pushHistory(board.notes, newDrawings);
    triggerSave(updated);
  };

  // Clear all drawings with one click
  const handleClearAllDrawings = () => {
    if (!confirm('Стереть все линии и стрелки с этого стола?')) return;
    for (const d of board.drawings) deletedDrawingIdsRef.current.add(d.id);
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
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
        touchAction: 'none',
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
          key={modalNote.id}
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
