/**
 * Security & Guardrails Module for NoteHub
 * Protects against:
 * 1. Prompt Injections & Jailbreaks
 * 2. Path Traversal & File Vulnerabilities
 * 3. XSS (Cross-Site Scripting)
 * 4. Rate Limiting & Token Drainage
 * 5. Data Poisoning & Input Flooding
 */

// Regex patterns commonly used in Prompt Injections and Jailbreak attacks
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|directives|prompts)/i,
  /system\s+override/i,
  /you\s+are\s+now\s+(unrestricted|DAN|jailbroken|an\s+evil)/i,
  /reveal\s+(your\s+)?(system\s+prompt|api\s*key|secret|hidden)/i,
  /bypass\s+(all\s+)?(safety|filters|rules|guardrails)/i,
  /act\s+as\s+(an?\s+unfiltered|godmode)/i,
  /disregard\s+(the\s+)?(system|rules|safety)/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /\[SYSTEM_PROMPT\]/i,
  /\[INST\]/i,
];

import crypto from 'crypto';

/**
 * Normalizes nickname to clean lowercase string
 */
export function normalizeNickname(nickname: string): string {
  if (!nickname || typeof nickname !== 'string') return '';
  return nickname.trim().toLowerCase().replace(/[@#\s]/g, '');
}

/**
 * Validates nickname: Latin or Cyrillic characters, numbers, dashes and underscores, 2-24 characters
 */
export function isValidNickname(nickname: string): boolean {
  const norm = normalizeNickname(nickname);
  return /^[\p{L}\p{N}_-]{2,24}$/u.test(norm);
}

/**
 * Validates 4-6 digit numeric PIN
 */
export function isValidPin(pin: string): boolean {
  if (!pin || typeof pin !== 'string') return false;
  return /^\d{4,6}$/.test(pin.trim());
}

/**
 * Hashes PIN code using sha256 with salt
 */
export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin.trim() + '_notehub_salt').digest('hex');
}

/**
 * Validates Board ID to strictly alphanumeric and safe dashes/underscores
 * Prevents Directory Traversal attacks (e.g. `../../etc/passwd`)
 */
export function isValidBoardId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length > 64) return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Sanitizes generic user text input:
 * - Trims and normalizes unicode
 * - Limits maximum length
 * - Neutralizes raw HTML script tags and javascript: links
 */
export function sanitizeText(input: string, maxLength: number = 10000): string {
  if (!input || typeof input !== 'string') return '';
  
  let cleaned = input.normalize('NFKC');
  
  // Truncate to maximum allowed length to prevent memory/token flooding
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }

  // Neutralize dangerous HTML tags & javascript: pseudo-protocols
  cleaned = cleaned
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, 'blocked-script:');

  return cleaned;
}

/**
 * Detects potential prompt injection attempts in user content
 */
export function analyzePromptInjection(text: string): { isSuspicious: boolean; reason?: string } {
  if (!text) return { isSuspicious: false };

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isSuspicious: true,
        reason: 'Обнаружен паттерн попытки сброса инструкций модели (Prompt Injection)',
      };
    }
  }

  return { isSuspicious: false };
}

/**
 * Safely encloses untrusted user notes before feeding to LLM
 * Uses structured XML-style delimiters and explicit non-execution boundary markers
 */
export function wrapUntrustedContext(text: string, label: string = 'untrusted_content'): string {
  const sanitized = sanitizeText(text);
  // Neutralize closing tags inside content to avoid delimiter injection
  const escaped = sanitized.replace(new RegExp(`</${label}>`, 'gi'), `[escaped_tag]`);
  return `<${label}>\n${escaped}\n</${label}>`;
}

/**
 * Allowed safe image MIME types and extensions for file uploads
 */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

export function isAllowedUploadType(mimeType: string, extension: string): boolean {
  const cleanExt = extension.toLowerCase();
  return ALLOWED_MIME_TYPES.has(mimeType) && ALLOWED_EXTENSIONS.has(cleanExt);
}

/**
 * In-memory sliding window rate limiter
 * Protects against brute-force, DoS and expensive LLM API token drainage
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  identifier: string,
  action: string,
  limit: number = 30,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; retryAfterSec?: number } {
  const key = `${action}:${identifier}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
}
