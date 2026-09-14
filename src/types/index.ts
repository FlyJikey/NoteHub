export type Role = 'editor' | 'viewer';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface UserProfile {
  nickname: string;
  displayName: string;
  avatarColor: string;
  pin?: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface NoteItem {
  id: string;
  boardId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  content: string;
  color: string;
  tags: string[];
  checklists: ChecklistItem[];
  images: string[];
  pinned?: boolean;
  author?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DrawingPath {
  id: string;
  boardId: string;
  type: 'freehand' | 'arrow' | 'rect' | 'circle' | 'line';
  points: Array<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
  fromNoteId?: string;
  toNoteId?: string;
  label?: string;
  createdAt: string;
}

export interface RestrictionItem {
  id: string;
  text: string;
  active: boolean;
  noteId?: string;
  createdAt: string;
}

export interface ClientQuestionItem {
  id: string;
  text: string;
  answered: boolean;
  answer?: string;
  noteId?: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  text: string;
  status: 'pending' | 'in_progress' | 'done';
  assignedTo?: string;
  noteId?: string;
  createdAt: string;
}

export interface DecisionItem {
  id: string;
  text: string;
  createdAt: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface AiMemoryState {
  summary: string;
  restrictions: RestrictionItem[];
  clientQuestions: ClientQuestionItem[];
  tasks: TaskItem[];
  decisions: DecisionItem[];
  lastSyncedAt?: string;
}

export interface Board {
  id: string;
  title: string;
  description?: string;
  colorTheme?: string;
  shareToken: string;
  defaultRole: Role;
  createdBy?: string;
  members?: string[];
  createdAt: string;
  updatedAt: string;
  notes: NoteItem[];
  drawings: DrawingPath[];
  aiMemory: AiMemoryState;
  telegramConfig?: {
    connected: boolean;
    botUsername?: string;
    inviteCode?: string;
    chatId?: number;
  };
}
