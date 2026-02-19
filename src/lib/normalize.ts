const SALT_TERMS = [
  '수화물', '무수물', '염산염', '황산염', '나트륨', '칼륨', '칼슘',
  '마그네슘', '인산염', '질산염', '초산염', '구연산염', '주석산염',
  '메실산염', '말레산염', '푸마르산염', '숙신산염', '베실산염',
  'HYDROCHLORIDE', 'SULFATE', 'SODIUM', 'POTASSIUM', 'CALCIUM',
  'MAGNESIUM', 'PHOSPHATE', 'NITRATE', 'ACETATE', 'CITRATE',
  'TARTRATE', 'MESYLATE', 'MALEATE', 'FUMARATE', 'SUCCINATE',
  'BESYLATE', 'HYDRATE', 'ANHYDROUS', 'DIHYDRATE', 'MONOHYDRATE',
  'TRIHYDRATE', 'HEMIHYDRATE',
];

export function normText(text: string): string {
  if (!text) return '';
  let s = String(text).split('>>')[0].trim().toUpperCase();
  s = s.replace(/[.\-_/\\,+&()[\]{}<>:;'"!@#$%^*=|~`]/g, ' ');
  s = s.replace(/[^\uAC00-\uD7AF\u3131-\u3163A-Z0-9\s]/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function extractCodeToken(product: string): string {
  if (!product) return '';
  let s = String(product).split('>>')[0].trim();
  let token = s.split(/\s+/)[0] || '';
  token = token.split('.')[0];
  token = token.replace(/[^\uAC00-\uD7AF\u3131-\u3163A-Za-z0-9]/g, '');
  token = token.replace(/\d+$/, '');
  return token.toUpperCase();
}

export function ingKeyBase(ingredient: string): string {
  if (!ingredient) return '';
  let s = String(ingredient);
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/\[[^\]]*\]/g, '');
  s = s.replace(/[.\-_/\\,+&;:'"]/g, ' ');
  s = s.toUpperCase();
  for (const term of SALT_TERMS) {
    s = s.replace(new RegExp(term, 'gi'), '');
  }
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function sequenceMatcherRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (m > 500 || n > 500) {
    const shorter = m < n ? a : b;
    const longer = m < n ? b : a;
    if (longer.includes(shorter)) return (2 * shorter.length) / (m + n);
    return 0;
  }
  const prev = new Uint16Array(n + 1);
  const curr = new Uint16Array(n + 1);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) curr[j] = prev[j - 1] + 1;
      else curr[j] = Math.max(prev[j], curr[j - 1]);
    }
    prev.set(curr);
    curr.fill(0);
  }
  return (2 * prev[n]) / (m + n);
}

export function getFirstToken(normStr: string): string {
  if (!normStr) return '';
  return normStr.split(/\s+/)[0] || '';
}

export function getPrefix(s: string, len: number): string {
  return s.substring(0, len);
}

/** Extract English ingredient name from 주성분 field (often contains English in parentheses or mixed) */
export function extractIngEng(ingredient: string): string {
  if (!ingredient) return '';
  const s = String(ingredient);
  // Try extracting from parentheses first: e.g. "아세트아미노펜(Acetaminophen)"
  const parenMatch = s.match(/\(([A-Za-z][A-Za-z0-9\s\-,.']+)\)/);
  if (parenMatch) return parenMatch[1].trim();
  // Try extracting after >> separator
  const parts = s.split('>>');
  for (const p of parts) {
    const trimmed = p.trim();
    if (/^[A-Za-z]/.test(trimmed) && /[A-Za-z]{3,}/.test(trimmed)) return trimmed;
  }
  // Try extracting English tokens from the string
  const engTokens = s.match(/[A-Za-z][A-Za-z0-9\-'.]{2,}/g);
  if (engTokens && engTokens.length > 0) {
    return engTokens.join(' ');
  }
  return '';
}
