import fs from 'fs';
import path from 'path';
import { Board, NoteItem, DrawingPath, AiMemoryState, Role } from '@/types';
import { generateId } from './utils';

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'boards.json');

function ensureDirectoryExistence() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getInitialDemoBoard(): Board {
  const boardId = 'demo-project';
  const note1Id = generateId('note');
  const note2Id = generateId('note');
  const note3Id = generateId('note');

  return {
    id: boardId,
    title: 'Запуск проекта с клиентом (Demo)',
    description: 'Интерактивный стол с заметками, задачами, ограничениями и памятью ИИ',
    shareToken: 'share-demo-12345',
    defaultRole: 'editor',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: [
      {
        id: note1Id,
        boardId,
        x: 120,
        y: 140,
        width: 320,
        height: 260,
        title: '💡 Общая идея и концепция',
        content: 'Делаем сервис совместных заметок NoteHub. Главный акцент — визуальный холст и ИИ-память, которая ничего не забывает из обсуждений в чатах.',
        color: '#fef08a', // warm yellow
        tags: ['концепция', 'MVP', 'идея'],
        checklists: [
          { id: 'c1', text: 'Собрать требования от команды', done: true },
          { id: 'c2', text: 'Выбрать стек и архитектуру', done: true },
          { id: 'c3', text: 'Подключить Polza.ai API', done: false },
        ],
        images: [],
        pinned: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: note2Id,
        boardId,
        x: 500,
        y: 140,
        width: 340,
        height: 280,
        title: '⚠️ Ограничения и табу',
        content: 'То, о чем договорились: НЕ перегружать интерфейс сложными меню. Не запускать ничего лишнего. Не менять темную тему навязчиво.',
        color: '#fecaca', // soft red/coral
        tags: ['табу', 'клиент', 'правила'],
        checklists: [
          { id: 'c4', text: 'Не ломать дизайн сайта', done: true },
          { id: 'c5', text: 'Только чистый минимализм', done: false },
        ],
        images: [],
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: note3Id,
        boardId,
        x: 310,
        y: 460,
        width: 340,
        height: 260,
        title: '❓ Вопросы на созвон в понедельник',
        content: 'Созвон с заказчиком в 14:00 по МСК.\nНужно уточнить:\n1. Финальный формат ссылок для шеринга\n2. Лимиты на объем загружаемых фото\n3. Предпочтительная модель в Polza.ai',
        color: '#bae6fd', // sky blue
        tags: ['созвон', 'вопросы', 'клиент'],
        checklists: [
          { id: 'c6', text: 'Спросить про Polza.ai токен', done: false },
          { id: 'c7', text: 'Согласовать Telegram-бота', done: false },
        ],
        images: [],
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    drawings: [
      {
        id: generateId('draw'),
        boardId,
        type: 'arrow',
        points: [
          { x: 440, y: 270 },
          { x: 500, y: 270 },
        ],
        color: '#6366f1',
        strokeWidth: 2,
        fromNoteId: note1Id,
        toNoteId: note2Id,
        label: 'влияет на',
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId('draw'),
        boardId,
        type: 'arrow',
        points: [
          { x: 280, y: 400 },
          { x: 310, y: 460 },
        ],
        color: '#0284c7',
        strokeWidth: 2,
        fromNoteId: note1Id,
        toNoteId: note3Id,
        label: 'порождает вопросы',
        createdAt: new Date().toISOString(),
      },
    ],
    aiMemory: {
      summary: 'Проект NoteHub: совместное пространство с холстом, связями и ИИ-секретарем на базе Polza.ai.',
      restrictions: [
        {
          id: generateId('restr'),
          text: 'Не ломать функционал и дизайн сайта',
          active: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: generateId('restr'),
          text: 'Не запускать dev-сервер без явного запроса пользователя',
          active: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: generateId('restr'),
          text: 'Не использовать переусложненные фреймворки канваса, отдавать приоритет стабильности',
          active: true,
          createdAt: new Date().toISOString(),
        },
      ],
      clientQuestions: [
        {
          id: generateId('q'),
          text: 'Уточнить у заказчика формат доступа к Polza.ai (какие модели разрешены)',
          answered: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: generateId('q'),
          text: 'Будет ли Telegram-бот общим или личным для каждого стола?',
          answered: false,
          createdAt: new Date().toISOString(),
        },
      ],
      tasks: [
        {
          id: generateId('task'),
          text: 'Реализовать бесконечный холст с перемещением и масштабированием',
          status: 'done',
          createdAt: new Date().toISOString(),
        },
        {
          id: generateId('task'),
          text: 'Добавить создание и редактирование карточек с открытием в полный документ',
          status: 'done',
          createdAt: new Date().toISOString(),
        },
        {
          id: generateId('task'),
          text: 'Интегрировать Polza.ai для сканирования заметок и авто-наполнения памяти',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        {
          id: generateId('task'),
          text: 'Сделать шеринг стола по ссылке с выбором роли (редактор / читатель)',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ],
      decisions: [
        {
          id: generateId('dec'),
          text: 'Используем Polza.ai как единый LLM-провайдер с OpenAI SDK',
          createdAt: new Date().toISOString(),
        },
        {
          id: generateId('dec'),
          text: 'Карточки на столе могут открываться в полноценный полноразмерный документ',
          createdAt: new Date().toISOString(),
        },
      ],
      lastSyncedAt: new Date().toISOString(),
    },
    telegramConfig: {
      connected: false,
      botUsername: 'NoteHubAssistBot',
      inviteCode: 'nh_tg_78942',
    },
  };
}

export function getAllBoards(): Board[] {
  ensureDirectoryExistence();
  if (!fs.existsSync(DB_FILE)) {
    const initial = [getInitialDemoBoard()];
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const boards = JSON.parse(raw) as Board[];
    return boards;
  } catch (err) {
    console.error('Error reading boards db:', err);
    return [getInitialDemoBoard()];
  }
}

export function getBoardById(id: string): Board | null {
  const boards = getAllBoards();
  return boards.find((b) => b.id === id) || null;
}

export function saveBoard(board: Board): Board {
  ensureDirectoryExistence();
  const boards = getAllBoards();
  const index = boards.findIndex((b) => b.id === board.id);

  board.updatedAt = new Date().toISOString();

  if (index >= 0) {
    boards[index] = board;
  } else {
    boards.unshift(board);
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(boards, null, 2), 'utf-8');
  return board;
}

export function createBoard(title: string, description?: string): Board {
  const newBoard: Board = {
    id: generateId('board'),
    title: title.trim() || 'Новый стол заметок',
    description: description || '',
    shareToken: generateId('share'),
    defaultRole: 'editor',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: [],
    drawings: [],
    aiMemory: {
      summary: 'Новый проект. Заметки еще не проанализированы.',
      restrictions: [],
      clientQuestions: [],
      tasks: [],
      decisions: [],
      lastSyncedAt: new Date().toISOString(),
    },
    telegramConfig: {
      connected: false,
      inviteCode: generateId('tg'),
    },
  };

  return saveBoard(newBoard);
}

export function deleteBoard(id: string): boolean {
  ensureDirectoryExistence();
  const boards = getAllBoards();
  const filtered = boards.filter((b) => b.id !== id);
  if (filtered.length !== boards.length) {
    fs.writeFileSync(DB_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  }
  return false;
}
