'use client';

import React from 'react';
import { DrawingPath, NoteItem } from '@/types';

interface DrawingLayerProps {
  drawings: DrawingPath[];
  notes: NoteItem[];
  activeDrawing: DrawingPath | null;
  isEditable: boolean;
  isEraserMode?: boolean;
  onDeleteDrawing: (id: string) => void;
}

export const DrawingLayer: React.FC<DrawingLayerProps> = ({
  drawings,
  notes,
  activeDrawing,
  isEditable,
  isEraserMode,
  onDeleteDrawing,
}) => {
  // Helper to get note center coordinates
  const getNoteCenter = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return null;
    return {
      x: note.x + (note.width || 320) / 2,
      y: note.y + (note.height || 240) / 2,
    };
  };

  const renderPath = (drawing: DrawingPath, isActive: boolean = false) => {
    if (drawing.type === 'arrow' && drawing.fromNoteId && drawing.toNoteId) {
      const fromCenter = getNoteCenter(drawing.fromNoteId);
      const toCenter = getNoteCenter(drawing.toNoteId);
      if (fromCenter && toCenter) {
        const dx = toCenter.x - fromCenter.x;
        const dy = toCenter.y - fromCenter.y;
        const midX = (fromCenter.x + toCenter.x) / 2;
        const midY = (fromCenter.y + toCenter.y) / 2;
        const curveControlX = midX - dy * 0.15;
        const curveControlY = midY + dx * 0.15;

        return (
          <g key={drawing.id} className="group/arrow pointer-events-auto">
            <defs>
              <marker
                id={`arrow-${drawing.id}`}
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill={drawing.color || '#6366f1'} />
              </marker>
            </defs>

            {/* Invisible thick path for easy clicking/erasing */}
            <path
              d={`M ${fromCenter.x} ${fromCenter.y} Q ${curveControlX} ${curveControlY} ${toCenter.x} ${toCenter.y}`}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              className={`cursor-pointer ${isEraserMode ? 'cursor-no-drop' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isEditable) onDeleteDrawing(drawing.id);
              }}
            />

            {/* Visible arrow line */}
            <path
              d={`M ${fromCenter.x} ${fromCenter.y} Q ${curveControlX} ${curveControlY} ${toCenter.x} ${toCenter.y}`}
              fill="none"
              stroke={drawing.color || '#6366f1'}
              strokeWidth={drawing.strokeWidth || 2.5}
              markerEnd={`url(#arrow-${drawing.id})`}
              className={`transition-all opacity-85 group-hover/arrow:opacity-100 group-hover/arrow:stroke-rose-500 group-hover/arrow:stroke-[3.5px] ${
                isEraserMode ? 'stroke-rose-400' : ''
              }`}
            />

            {/* Arrow label */}
            {drawing.label && (
              <text
                x={curveControlX}
                y={curveControlY - 10}
                fill={drawing.color || '#4338ca'}
                fontSize="11"
                fontWeight="600"
                textAnchor="middle"
                className="select-none bg-white px-1 font-sans"
              >
                {drawing.label}
              </text>
            )}

            {/* Hover delete button icon on the arrow midpoint */}
            {isEditable && !isActive && (
              <g
                className="opacity-0 group-hover/arrow:opacity-100 cursor-pointer transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDrawing(drawing.id);
                }}
              >
                <circle cx={midX} cy={midY} r="10" className="fill-rose-500 shadow-md" />
                <text
                  x={midX}
                  y={midY + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                >
                  ×
                </text>
              </g>
            )}
          </g>
        );
      }
    }

    // Points-based drawing (freehand or straight arrows)
    if (!drawing.points || drawing.points.length < 2) return null;

    if (drawing.type === 'freehand') {
      const d = drawing.points.reduce(
        (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
        ''
      );

      return (
        <g key={drawing.id} className="group/line pointer-events-auto">
          {/* Thick invisible hit target for erasing */}
          <path
            d={d}
            fill="none"
            stroke="transparent"
            strokeWidth={18}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`cursor-pointer ${isEraserMode ? 'cursor-no-drop' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isEditable) onDeleteDrawing(drawing.id);
            }}
          />
          {/* Visible line */}
          <path
            d={d}
            fill="none"
            stroke={drawing.color || '#6366f1'}
            strokeWidth={drawing.strokeWidth || 3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`opacity-90 group-hover/line:stroke-rose-500 group-hover/line:opacity-100 transition-colors ${
              isEraserMode ? 'stroke-rose-400' : ''
            }`}
          />
        </g>
      );
    }

    if (drawing.type === 'arrow') {
      const start = drawing.points[0];
      const end = drawing.points[drawing.points.length - 1];

      return (
        <g key={drawing.id} className="group/straight-arrow pointer-events-auto">
          <defs>
            <marker
              id={`arrowhead-${drawing.id}`}
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill={drawing.color || '#3b82f6'} />
            </marker>
          </defs>
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="transparent"
            strokeWidth={18}
            strokeLinecap="round"
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (isEditable) onDeleteDrawing(drawing.id);
            }}
          />
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={drawing.color || '#3b82f6'}
            strokeWidth={drawing.strokeWidth || 2.5}
            markerEnd={`url(#arrowhead-${drawing.id})`}
            strokeLinecap="round"
            className="group-hover/straight-arrow:stroke-rose-500 transition-colors"
          />
        </g>
      );
    }

    return null;
  };

  return (
    <svg
      className="absolute top-0 left-0 w-[10000px] h-[10000px] pointer-events-none overflow-visible z-10"
      style={{ overflow: 'visible' }}
    >
      {drawings.map((d) => renderPath(d))}
      {activeDrawing && renderPath(activeDrawing, true)}
    </svg>
  );
};
