import fs from 'fs';
import path from 'path';
import { Board, NoteItem, DrawingPath, AiMemoryState, Role, UserProfile } from '@/types';
import { generateId } from './utils';
import { normalizeNickname, isValidNickname, isValidPin, hashPin } from './security';

// GitHub Contents API storage adapter
interface GitHubConfig {
  token?: string;
  repo?: string;
  branch: string;
}

function getGitHubConfig(): GitHubConfig {
  return {
    token: process.env.GITHUB_TOKEN?.trim(),
    repo: process.env.GITHUB_REPO?.trim(),
    branch: process.env.GITHUB_BRANCH?.trim() || 'main',
  };
}

const shaCache: Record<string, string> = {};

async function fetchFromGitHub(fileName: string): Promise<string | null> {
  const { token, repo, branch } = getGitHubConfig();
  if (!token || !repo) return null;

  try {
    const url = `https://api.github.com/repos/${repo}/contents/.data/${fileName}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'NoteHub-App',
      },
      cache: 'no-store',
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[GitHub API] GET .data/${fileName} returned status ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.sha) {
      shaCache[fileName] = data.sha;
    }
    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  } catch (err) {
    console.error(`[GitHub API] Failed to fetch .data/${fileName}:`, err);
    return null;
  }
}

async function saveToGitHub(fileName: string, contentStr: string, commitMsg: string): Promise<boolean> {
  const { token, repo, branch } = getGitHubConfig();
  if (!token || !repo) return false;

  try {
    let currentSha = shaCache[fileName];
    if (!currentSha) {
      await fetchFromGitHub(fileName);
      currentSha = shaCache[fileName];
    }

    const url = `https://api.github.com/repos/${repo}/contents/.data/${fileName}`;
    const payload: any = {
      message: commitMsg,
      content: Buffer.from(contentStr, 'utf-8').toString('base64'),
      branch,
    };
    if (currentSha) {
      payload.sha = currentSha;
    }

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'NoteHub-App',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[GitHub API] PUT .data/${fileName} failed (${res.status}):`, errText);
      return false;
    }

    const resData = await res.json();
    if (resData?.content?.sha) {
      shaCache[fileName] = resData.content.sha;
    }
    return true;
  } catch (err) {
    console.error(`[GitHub API] Failed to save .data/${fileName}:`, err);
    return false;
  }
}

// Vercel KV / Upstash Redis Storage Adapter (Fast REST API alternative)
function getKVConfig() {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.STORAGE_REST_API_URL?.trim() ||
    process.env.STORAGE_URL?.trim();

  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.STORAGE_REST_API_TOKEN?.trim() ||
    process.env.STORAGE_TOKEN?.trim();

  return { url, token };
}

async function fetchFromKV(key: string): Promise<string | null> {
  const { url, token } = getKVConfig();
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}/get/notehub_${key}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.result === null || data.result === undefined) return null;
    return typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
  } catch (err) {
    console.error(`[KV Storage] Failed to fetch notehub_${key}:`, err);
    return null;
  }
}

async function saveToKV(key: string, contentStr: string): Promise<boolean> {
  const { url, token } = getKVConfig();
  if (!url || !token) return false;

  try {
    const res = await fetch(`${url}/set/notehub_${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contentStr),
    });
    return res.ok;
  } catch (err) {
    console.error(`[KV Storage] Failed to save notehub_${key}:`, err);
    return false;
  }
}

// Local filesystem adapter
const LOCAL_DATA_DIR = path.join(process.cwd(), '.data');
const TMP_DATA_DIR = path.join('/tmp', '.data');

function getWritableDataDir(): string {
  if (process.env.VERCEL) {
    if (!fs.existsSync(TMP_DATA_DIR)) {
      try {
        fs.mkdirSync(TMP_DATA_DIR, { recursive: true });
      } catch (e) {}
    }
    return TMP_DATA_DIR;
  }

  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    try {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    } catch (e) {}
  }
  return LOCAL_DATA_DIR;
}

function readLocalFile(fileName: string): string | null {
  const primaryPath = path.join(getWritableDataDir(), fileName);
  if (fs.existsSync(primaryPath)) {
    try {
      return fs.readFileSync(primaryPath, 'utf-8');
    } catch (e) {}
  }

  const repoDataPath = path.join(LOCAL_DATA_DIR, fileName);
  if (fs.existsSync(repoDataPath)) {
    try {
      return fs.readFileSync(repoDataPath, 'utf-8');
    } catch (e) {}
  }

  return null;
}

function writeLocalFile(fileName: string, content: string): void {
  try {
    const dir = getWritableDataDir();
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (err) {
    console.warn(`Could not write local file ${fileName}:`, err);
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

// In-memory cache
let memoryBoards: Board[] | null = null;
let memoryUsers: UserProfile[] | null = null;
let lastBoardsFetchTime = 0;
let lastUsersFetchTime = 0;
const CACHE_TTL_MS = 3000;

// Board CRUD
export async function getAllBoards(): Promise<Board[]> {
  const now = Date.now();
  if (memoryBoards && now - lastBoardsFetchTime < CACHE_TTL_MS) {
    return memoryBoards;
  }

  // 1. Try Vercel KV / Upstash Redis if configured (ultra-fast ~15ms)
  const kvContent = await fetchFromKV('boards');
  if (kvContent) {
    try {
      const parsed = JSON.parse(kvContent) as Board[];
      memoryBoards = parsed;
      lastBoardsFetchTime = now;
      writeLocalFile('boards.json', kvContent);
      return memoryBoards;
    } catch (e) {}
  }

  // 2. Try GitHub Contents API
  const githubContent = await fetchFromGitHub('boards.json');
  if (githubContent) {
    try {
      const parsed = JSON.parse(githubContent) as Board[];
      memoryBoards = parsed;
      lastBoardsFetchTime = now;
      writeLocalFile('boards.json', githubContent);
      return memoryBoards;
    } catch (e) {}
  }

  // 3. Try local filesystem
  const localContent = readLocalFile('boards.json');
  if (localContent) {
    try {
      const parsed = JSON.parse(localContent) as Board[];
      memoryBoards = parsed;
      lastBoardsFetchTime = now;
      return memoryBoards;
    } catch (e) {}
  }

  // 4. Fallback to initial demo board
  const initial = [getInitialDemoBoard()];
  memoryBoards = initial;
  lastBoardsFetchTime = now;
  writeLocalFile('boards.json', JSON.stringify(initial, null, 2));
  return memoryBoards;
}

export async function getBoardById(id: string): Promise<Board | null> {
  const boards = await getAllBoards();
  return boards.find((b) => b.id === id) || null;
}

export async function saveBoard(board: Board): Promise<Board> {
  const boards = await getAllBoards();
  board.updatedAt = new Date().toISOString();

  const index = boards.findIndex((b) => b.id === board.id);
  if (index >= 0) {
    boards[index] = board;
  } else {
    boards.unshift(board);
  }

  memoryBoards = boards;
  lastBoardsFetchTime = Date.now();

  const jsonStr = JSON.stringify(boards, null, 2);
  writeLocalFile('boards.json', jsonStr);

  // Sync to Vercel KV if configured
  saveToKV('boards', jsonStr).catch((err) => {
    console.error('Error saving board to KV:', err);
  });

  // Sync to GitHub if configured
  saveToGitHub('boards.json', jsonStr, `Update board: ${board.title || board.id}`).catch((err) => {
    console.error('Error saving board to GitHub:', err);
  });

  return board;
}

export async function createBoard(
  title: string,
  description?: string,
  creatorNickname?: string
): Promise<Board> {
  const cleanCreator = creatorNickname ? normalizeNickname(creatorNickname) : undefined;
  const newBoard: Board = {
    id: generateId('board'),
    title: title.trim() || 'Новый стол заметок',
    description: description || '',
    shareToken: generateId('share'),
    defaultRole: 'editor',
    createdBy: cleanCreator,
    members: cleanCreator ? [cleanCreator] : [],
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

export async function deleteBoard(id: string): Promise<boolean> {
  const boards = await getAllBoards();
  const filtered = boards.filter((b) => b.id !== id);
  if (filtered.length !== boards.length) {
    memoryBoards = filtered;
    lastBoardsFetchTime = Date.now();
    const jsonStr = JSON.stringify(filtered, null, 2);
    writeLocalFile('boards.json', jsonStr);
    saveToKV('boards', jsonStr).catch((err) => {
      console.error('Error deleting board from KV:', err);
    });
    saveToGitHub('boards.json', jsonStr, `Delete board: ${id}`).catch((err) => {
      console.error('Error deleting board on GitHub:', err);
    });
    return true;
  }
  return false;
}

// User Management
const AVATAR_COLORS = [
  '#6366f1', // indigo
  '#0284c7', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
];

export function getAvatarColorForNickname(nickname: string): string {
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) {
    hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const now = Date.now();
  if (memoryUsers && now - lastUsersFetchTime < CACHE_TTL_MS) {
    return memoryUsers;
  }

  // 1. Try Vercel KV / Upstash Redis
  const kvUsers = await fetchFromKV('users');
  if (kvUsers) {
    try {
      const parsed = JSON.parse(kvUsers) as UserProfile[];
      memoryUsers = parsed;
      lastUsersFetchTime = now;
      writeLocalFile('users.json', kvUsers);
      return memoryUsers;
    } catch (e) {}
  }

  // 2. Try GitHub Contents API
  const githubContent = await fetchFromGitHub('users.json');
  if (githubContent) {
    try {
      const parsed = JSON.parse(githubContent) as UserProfile[];
      memoryUsers = parsed;
      lastUsersFetchTime = now;
      writeLocalFile('users.json', githubContent);
      return memoryUsers;
    } catch (e) {}
  }

  // 3. Try local filesystem
  const localContent = readLocalFile('users.json');
  if (localContent) {
    try {
      const parsed = JSON.parse(localContent) as UserProfile[];
      memoryUsers = parsed;
      lastUsersFetchTime = now;
      return memoryUsers;
    } catch (e) {}
  }

  memoryUsers = [];
  lastUsersFetchTime = now;
  return [];
}

export async function getUserByNickname(nickname: string): Promise<UserProfile | null> {
  const clean = normalizeNickname(nickname);
  if (!clean) return null;
  const users = await getAllUsers();
  return users.find((u) => u.nickname === clean) || null;
}

export async function saveUser(user: UserProfile): Promise<UserProfile> {
  const users = await getAllUsers();
  const clean = normalizeNickname(user.nickname);
  const index = users.findIndex((u) => u.nickname === clean);

  user.nickname = clean;
  user.lastActiveAt = new Date().toISOString();

  if (index >= 0) {
    users[index] = { ...users[index], ...user };
  } else {
    users.push(user);
  }

  memoryUsers = users;
  lastUsersFetchTime = Date.now();

  const jsonStr = JSON.stringify(users, null, 2);
  writeLocalFile('users.json', jsonStr);

  saveToKV('users', jsonStr).catch((err) => {
    console.error('Error saving user to KV:', err);
  });

  saveToGitHub('users.json', jsonStr, `Update user: ${clean}`).catch((err) => {
    console.error('Error saving user to GitHub:', err);
  });

  return user;
}

export async function authenticateOrRegisterUser(params: {
  nickname: string;
  pin?: string;
  displayName?: string;
}): Promise<{ success: boolean; user?: UserProfile; error?: string; isNew?: boolean }> {
  const clean = normalizeNickname(params.nickname);
  if (!clean) {
    return { success: false, error: 'Никнейм не может быть пустым' };
  }

  if (!isValidNickname(clean)) {
    return {
      success: false,
      error: 'Никнейм должен содержать от 2 до 24 символов (буквы, цифры, дефис, подчеркивание)',
    };
  }

  const existing = await getUserByNickname(clean);

  // If user already exists, verify PIN if set
  if (existing) {
    if (existing.pin) {
      if (!params.pin) {
        return { success: false, error: 'Для этого никнейма требуется PIN-код' };
      }
      const hashed = hashPin(params.pin);
      if (hashed !== existing.pin) {
        return { success: false, error: 'Неверный PIN-код для этого никнейма' };
      }
    } else if (params.pin) {
      if (!isValidPin(params.pin)) {
        return { success: false, error: 'PIN-код должен состоять из 4–6 цифр' };
      }
      existing.pin = hashPin(params.pin);
    }

    if (params.displayName && params.displayName.trim()) {
      existing.displayName = params.displayName.trim();
    }
    existing.lastActiveAt = new Date().toISOString();
    await saveUser(existing);

    const safeUser = { ...existing };
    delete safeUser.pin;

    return { success: true, user: safeUser, isNew: false };
  }

  // Create new user
  if (params.pin && !isValidPin(params.pin)) {
    return { success: false, error: 'PIN-код должен состоять из 4–6 цифр' };
  }

  const newUser: UserProfile = {
    nickname: clean,
    displayName: params.displayName?.trim() || params.nickname.trim(),
    avatarColor: getAvatarColorForNickname(clean),
    pin: params.pin ? hashPin(params.pin) : undefined,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  await saveUser(newUser);

  const safeUser = { ...newUser };
  delete safeUser.pin;

  return { success: true, user: safeUser, isNew: true };
}
