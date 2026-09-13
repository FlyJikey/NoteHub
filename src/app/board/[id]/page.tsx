import React from 'react';
import { notFound } from 'next/navigation';
import { getBoardById } from '@/lib/db';
import { Canvas } from '@/components/canvas/Canvas';
import { Metadata } from 'next';
import { Role } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string; token?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const board = getBoardById(id);
  return {
    title: board ? `${board.title} — NoteHub` : 'Стол заметок — NoteHub',
    description: 'Интерактивный стол совместных заметок с ИИ-памятью и связями',
  };
}

export default async function BoardPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { role } = await searchParams;

  const board = getBoardById(id);
  if (!board) {
    notFound();
  }

  const userRole: Role = role === 'viewer' ? 'viewer' : 'editor';

  return (
    <main className="w-screen h-screen overflow-hidden">
      <Canvas initialBoard={board} userRole={userRole} />
    </main>
  );
}
