/**
 * Normalize a restaurant/lead name for cross-sheet deduplication:
 * - NFKD Unicode compatibility decomposition (converts styled math fonts like 𝐓𝐀𝐑𝐑𝐈𝐊𝐎 -> TARRIKO)
 * - Strip combining diacritical marks
 * - Lowercase
 * - Strip apostrophes without adding spaces, replace remaining punctuation with space
 * - Collapse whitespace and trim
 */
export function normalizeLeadName(raw: string): string {
  if (!raw) return '';
  const decomposed = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return decomposed
    .replace(/['’`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean HTML anchor tags or noisy formatting from AI Result strings while keeping URLs intact.
 */
export function cleanEvidenceText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (_m, href, text) => {
      const cleanText = String(text || '').trim();
      if (!cleanText || cleanText === href) return href;
      return `${cleanText} (${href})`;
    })
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi, '$1')
    .replace(/<\/a>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Score candidate display names so the cleanest human-readable name wins
 * (e.g., "Tarriko" beats "𝐓𝐀𝐑𝐑𝐈𝐊𝐎" and "  tarriko  ").
 */
export function pickCleanestDisplayName(candidates: string[]): string {
  const valid = candidates.map((c) => c.trim()).filter(Boolean);
  if (valid.length === 0) return '';

  const scoreName = (name: string): number => {
    let score = 0;
    const nfkc = name.normalize('NFKC');
    // Strongly penalize fancy Unicode math/styled characters (e.g. 𝐓𝐀𝐑𝐑𝐈𝐊𝐎)
    if (name !== nfkc) {
      score -= 100;
    }
    // Prefer mixed / Title Case over ALL CAPS or all lowercase
    const hasUpper = /[A-Z]/.test(name);
    const hasLower = /[a-z]/.test(name);
    if (hasUpper && hasLower) score += 30;
    else if (hasUpper) score += 10;

    // Prefer clean single-spaced names without trailing symbols
    if (!/\s{2,}/.test(name)) score += 10;
    if (/^[A-Za-z0-9]/.test(name)) score += 5;

    // Slight preference for slightly fuller name if same base (e.g., "Joe's Pizza" vs "Joes Pizza")
    score += Math.min(name.length, 40) * 0.1;
    return score;
  };

  const sorted = [...valid].sort((a, b) => scoreName(b) - scoreName(a));
  // If best candidate still contains styled Unicode math characters, normalize it to NFKC
  const best = sorted[0];
  if (best !== best.normalize('NFKC')) {
    return toTitleCaseIfUpper(best.normalize('NFKC').trim());
  }
  return best.replace(/\s+/g, ' ').trim();
}

function toTitleCaseIfUpper(text: string): string {
  if (text === text.toUpperCase() && /[A-Z]/.test(text)) {
    return text
      .toLowerCase()
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return text;
}

/**
 * Deduplicate URLs / social handles across sheets while keeping distinct links.
 */
export function mergeUrls(urls: string[]): string {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of urls) {
    if (!raw) continue;
    const parts = raw
      .split(/[\n|,;]+/)
      .map((p) => p.trim())
      .filter((p) => p && p !== '—' && p !== '-' && p.toLowerCase() !== 'n/a');

    for (const part of parts) {
      const key = part
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/+$/, '');
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(part);
      }
    }
  }

  return result.join(' | ');
}

const FINE_DINING_REGEX =
  /\b(never\s+commission|fine[\s-]?dining|michelin|tasting\s+menu|omakase|white[\s-]?tablecloth|prix\s+fixe|sommelier|haute\s+cuisine)\b/i;

export function detectFineDiningOrNeverCommission(texts: string[]): boolean {
  return texts.some((t) => t && FINE_DINING_REGEX.test(t));
}

/**
 * Ensure a synthesized pitch angle never pitches commission fees for fine-dining leads.
 */
export function sanitizePitchForFineDining(pitch: string, isFineDining: boolean): string {
  if (!isFineDining) return pitch;
  const mentionsCommission = /\bcommission(s)?\b/i.test(pitch);
  if (!mentionsCommission) {
    return pitch;
  }
  return (
    'Direct guest booking & white-glove digital presence enhancement — focus on brand storytelling, private dining / reservation flow, and menu accuracy without third-party delivery friction. [Fine-Dining Rule: NEVER pitch commission]'
  );
}
