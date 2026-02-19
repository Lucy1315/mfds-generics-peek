import type { RawRow, MfdsRow, MappingRow, MatchResult, ProcessingOptions, ProcessingSummary, GenericItem, GenericListCompact } from './types';
import { normText, extractCodeToken, ingKeyBase, sequenceMatcherRatio, getFirstToken, getPrefix } from './normalize';

interface MfdsIndices {
  exactEn: Map<string, MfdsRow[]>;
  exactKo: Map<string, MfdsRow[]>;
  tokenEn: Map<string, Set<number>>;
  tokenKo: Map<string, Set<number>>;
  itemCode: Map<string, number[]>;
  ingBaseIndex: Map<string, number[]>;
  ingBaseFormIndex: Map<string, number[]>;
  allTokensEn: Map<string, Set<number>>;
  allTokensKo: Map<string, Set<number>>;
  rows: MfdsRow[];
}

function parseDate(s: string): number {
  if (!s) return 0;
  const d = new Date(String(s));
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function findCol(headers: string[], candidates: string[]): string | null {
  const h = headers.map(x => x?.trim?.() || '');
  for (const c of candidates) {
    const exact = h.find(x => x === c);
    if (exact) return exact;
  }
  for (const c of candidates) {
    const found = h.find(x => x.includes(c));
    if (found) return found;
  }
  const normH = h.map(x => x.replace(/[\s_\-]/g, '').toLowerCase());
  for (const c of candidates) {
    const nc = c.replace(/[\s_\-]/g, '').toLowerCase();
    const idx = normH.findIndex(x => x.includes(nc));
    if (idx >= 0) return h[idx];
  }
  return null;
}

export function parseMfdsData(data: Record<string, any>[]): MfdsRow[] {
  if (!data.length) return [];
  const headers = Object.keys(data[0]);

  const col = (cs: string[]) => findCol(headers, cs) || '';
  const cItemCode = col(['품목기준코드', 'item_code']);
  const cName = col(['제품명', 'product_name']);
  const cEngName = col(['제품영문명', 'english_name', 'eng_name']);
  const cIng = col(['주성분', '주성분명', '성분명', '성분', 'ingredient']);
  const cForm = col(['제형']);
  const cNew = col(['신약구분', '신약여부', '신약', 'new_drug']);
  const cDate = col(['허가일자', '허가일', 'approval_date']);
  const cCancel = col(['취소취하', '취소/취하', '취소일자', '상태', '변경구분', 'cancel', 'status']);

  return data.map((row, i) => {
    const name = String(row[cName] ?? '');
    const engName = String(row[cEngName] ?? '');
    const ing = String(row[cIng] ?? '');
    const cancelVal = String(row[cCancel] ?? '');
    const isActive = !cancelVal || cancelVal === '정상' || cancelVal === '' || cancelVal === 'undefined';
    return {
      _idx: i,
      품목기준코드: String(row[cItemCode] ?? ''),
      제품명: name,
      제품영문명: engName,
      주성분: ing,
      제형: String(row[cForm] ?? ''),
      신약구분: String(row[cNew] ?? ''),
      허가일자: String(row[cDate] ?? ''),
      취소취하: cancelVal,
      제품명_norm: normText(name),
      제품영문명_norm: normText(engName),
      is_active: isActive,
      주성분_base_key: ingKeyBase(ing),
      제형_key: String(row[cForm] ?? '').trim(),
      허가일_date: parseDate(String(row[cDate] ?? '')),
    };
  });
}

function getAllTokens(s: string): string[] {
  if (!s) return [];
  return s.split(/\s+/).filter(Boolean);
}

function buildIndices(rows: MfdsRow[]): MfdsIndices {
  const exactEn = new Map<string, MfdsRow[]>();
  const exactKo = new Map<string, MfdsRow[]>();
  const tokenEn = new Map<string, Set<number>>();
  const tokenKo = new Map<string, Set<number>>();
  const allTokensEn = new Map<string, Set<number>>();
  const allTokensKo = new Map<string, Set<number>>();
  const itemCode = new Map<string, number[]>();
  const ingBaseIndex = new Map<string, number[]>();
  const ingBaseFormIndex = new Map<string, number[]>();

  for (const r of rows) {
    if (r.제품영문명_norm) {
      if (!exactEn.has(r.제품영문명_norm)) exactEn.set(r.제품영문명_norm, []);
      exactEn.get(r.제품영문명_norm)!.push(r);
    }
    if (r.제품명_norm) {
      if (!exactKo.has(r.제품명_norm)) exactKo.set(r.제품명_norm, []);
      exactKo.get(r.제품명_norm)!.push(r);
    }
    const tEn = getFirstToken(r.제품영문명_norm);
    if (tEn) {
      if (!tokenEn.has(tEn)) tokenEn.set(tEn, new Set());
      tokenEn.get(tEn)!.add(r._idx);
    }
    const tKo = getFirstToken(r.제품명_norm);
    if (tKo) {
      if (!tokenKo.has(tKo)) tokenKo.set(tKo, new Set());
      tokenKo.get(tKo)!.add(r._idx);
    }
    for (const tok of getAllTokens(r.제품영문명_norm)) {
      if (tok.length >= 3) {
        if (!allTokensEn.has(tok)) allTokensEn.set(tok, new Set());
        allTokensEn.get(tok)!.add(r._idx);
      }
    }
    for (const tok of getAllTokens(r.제품명_norm)) {
      if (tok.length >= 2) {
        if (!allTokensKo.has(tok)) allTokensKo.set(tok, new Set());
        allTokensKo.get(tok)!.add(r._idx);
      }
    }
    if (r.품목기준코드) {
      if (!itemCode.has(r.품목기준코드)) itemCode.set(r.품목기준코드, []);
      itemCode.get(r.품목기준코드)!.push(r._idx);
    }
    if (r.주성분_base_key) {
      if (!ingBaseIndex.has(r.주성분_base_key)) ingBaseIndex.set(r.주성분_base_key, []);
      ingBaseIndex.get(r.주성분_base_key)!.push(r._idx);
      const formKey = `${r.주성분_base_key}||${r.제형_key}`;
      if (!ingBaseFormIndex.has(formKey)) ingBaseFormIndex.set(formKey, []);
      ingBaseFormIndex.get(formKey)!.push(r._idx);
    }
  }

  const sortRows = (arr: MfdsRow[]) => arr.sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return b.허가일_date - a.허가일_date;
  });
  exactEn.forEach((v) => sortRows(v));
  exactKo.forEach((v) => sortRows(v));

  return { exactEn, exactKo, tokenEn, tokenKo, allTokensEn, allTokensKo, itemCode, ingBaseIndex, ingBaseFormIndex, rows };
}

function bestFromCandidates(
  candidates: number[], queryNorm: string, indices: MfdsIndices, filterActive: boolean, topK = 20
): { row: MfdsRow; score: number } | null {
  let cands = candidates.map(i => indices.rows[i]);
  if (filterActive) {
    const active = cands.filter(r => r.is_active);
    if (active.length > 0) cands = active;
  }
  cands.sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return b.허가일_date - a.허가일_date;
  });
  const topCands = cands.slice(0, topK);
  let bestRow: MfdsRow | null = null;
  let bestScore = -1;
  for (const r of topCands) {
    const sEn = sequenceMatcherRatio(queryNorm, r.제품영문명_norm);
    const sKo = sequenceMatcherRatio(queryNorm, r.제품명_norm);
    const s = Math.max(sEn, sKo);
    if (s > bestScore) { bestScore = s; bestRow = r; }
  }
  return bestRow ? { row: bestRow, score: bestScore } : null;
}

function getGenericCount(
  ingBase: string, formKey: string, opts: ProcessingOptions, indices: MfdsIndices
): { count: number; total_base: number; total_base_form: number; orig_base: number } {
  const baseIdxs = indices.ingBaseIndex.get(ingBase) || [];
  const formIdxKey = `${ingBase}||${formKey}`;
  const formIdxs = indices.ingBaseFormIndex.get(formIdxKey) || [];

  const activeFilter = opts.cancelFilter === 'active_only';
  const filterFn = (idxs: number[]) => {
    let rows = idxs.map(i => indices.rows[i]);
    if (activeFilter) rows = rows.filter(r => r.is_active);
    return rows;
  };

  const baseRows = filterFn(baseIdxs);
  const formRows = filterFn(formIdxs);
  const total_base = baseRows.length;
  const total_base_form = formRows.length;
  const orig_base = baseRows.filter(r => r.신약구분 === 'Y').length;

  let count: number;
  if (opts.genericCountBasis === 'base') {
    const genExclOrig = baseRows.filter(r => r.신약구분 !== 'Y').length;
    count = opts.genericDefinition === 'excl_original' ? genExclOrig : total_base - orig_base;
  } else {
    const genFormExcl = formRows.filter(r => r.신약구분 !== 'Y').length;
    count = opts.genericDefinition === 'excl_original' ? genFormExcl : total_base_form - orig_base;
  }

  return { count, total_base, total_base_form, orig_base };
}

/**
 * Retrieve actual generic product rows for a given ingredient base / form key.
 * These are the MFDS rows counted in generic_제품수.
 */
export function getGenericItems(
  ingBase: string,
  formKey: string,
  opts: ProcessingOptions,
  indices: MfdsIndices,
  sourceSeq: string | number,
  sourceProduct: string,
): GenericItem[] {
  if (!ingBase) return [];

  const activeFilter = opts.cancelFilter === 'active_only';
  const useBaseForm = opts.genericCountBasis === 'base_form';

  let idxs: number[];
  if (useBaseForm) {
    const formIdxKey = `${ingBase}||${formKey}`;
    idxs = indices.ingBaseFormIndex.get(formIdxKey) || [];
  } else {
    idxs = indices.ingBaseIndex.get(ingBase) || [];
  }

  let rows = idxs.map(i => indices.rows[i]);
  if (activeFilter) rows = rows.filter(r => r.is_active);
  // Exclude 신약 (original drugs)
  rows = rows.filter(r => r.신약구분 !== 'Y');

  return rows.map(r => ({
    source_순번: sourceSeq,
    source_Product: sourceProduct,
    Ingredient_base: ingBase,
    generic_품목기준코드: r.품목기준코드,
    generic_제품명: r.제품명,
    generic_제품영문명: r.제품영문명,
    generic_업체명: '', // Not available in current MFDS data structure
    generic_제형: r.제형,
    generic_허가일: r.허가일자,
    'generic_취소/취하': r.취소취하,
    matching_criteria: useBaseForm ? 'base+form' : 'base',
  }));
}

function assignConfidence(matchStatus: string, score: number, threshold: number): { 신뢰도: string; 검토필요: string } {
  switch (matchStatus) {
    case 'exact_en': case 'exact_ko': case 'map_item_code': case 'map_product_name':
      return { 신뢰도: 'HIGH', 검토필요: 'N' };
    case 'map_ingredient_base':
      return score >= 0.85
        ? { 신뢰도: 'HIGH', 검토필요: 'N' }
        : { 신뢰도: 'MEDIUM', 검토필요: 'N' };
    case 'token_ing_converged':
      return score >= 0.85
        ? { 신뢰도: 'HIGH', 검토필요: 'N' }
        : { 신뢰도: 'MEDIUM', 검토필요: 'N' };
    case 'token_multi_ing':
      return score < threshold
        ? { 신뢰도: 'REVIEW', 검토필요: 'Y' }
        : { 신뢰도: 'MEDIUM', 검토필요: 'N' };
    case 'prefix_match':
      return score >= 0.70
        ? { 신뢰도: 'MEDIUM', 검토필요: 'N' }
        : { 신뢰도: 'REVIEW', 검토필요: 'Y' };
    case 'fuzzy_broad':
      return score >= 0.75
        ? { 신뢰도: 'MEDIUM', 검토필요: 'N' }
        : { 신뢰도: 'REVIEW', 검토필요: 'Y' };
    case 'not_found':
      return { 신뢰도: 'REVIEW', 검토필요: 'Y' };
    default:
      return { 신뢰도: 'REVIEW', 검토필요: 'Y' };
  }
}

function collectCandidates(
  prodNorm: string, codeToken: string, indices: MfdsIndices
): { candSet: Set<number>; strategy: string } {
  const candSet = new Set<number>();
  const prodTokens = getAllTokens(prodNorm);
  const firstToken = prodTokens[0] || '';

  const addFromMap = (map: Map<string, Set<number>>, key: string) => {
    const s = map.get(key);
    if (s) s.forEach(v => candSet.add(v));
  };

  if (firstToken) {
    addFromMap(indices.tokenEn, firstToken);
    addFromMap(indices.tokenKo, firstToken);
  }

  if (codeToken && codeToken !== firstToken) {
    addFromMap(indices.tokenEn, codeToken);
    addFromMap(indices.tokenKo, codeToken);
  }

  if (candSet.size > 0) return { candSet, strategy: 'first_token' };

  for (const tok of prodTokens) {
    if (tok.length >= 3) addFromMap(indices.allTokensEn, tok);
    if (tok.length >= 2) addFromMap(indices.allTokensKo, tok);
  }

  if (candSet.size > 0) return { candSet, strategy: 'any_token' };

  for (const prefixLen of [6, 5, 4, 3]) {
    const prefix = getPrefix(prodNorm, prefixLen);
    if (!prefix || prefix.length < prefixLen) continue;
    for (const [k, s] of indices.tokenEn) {
      if (k.startsWith(prefix) || prefix.startsWith(k)) s.forEach(v => candSet.add(v));
    }
    for (const [k, s] of indices.tokenKo) {
      if (k.startsWith(prefix) || prefix.startsWith(k)) s.forEach(v => candSet.add(v));
    }
    if (candSet.size > 0) return { candSet, strategy: 'prefix' };
  }

  if (firstToken && firstToken.length >= 3) {
    for (const r of indices.rows) {
      if (r.제품영문명_norm.includes(firstToken) || r.제품명_norm.includes(firstToken)) {
        candSet.add(r._idx);
      }
      if (firstToken.length >= 4 && (firstToken.includes(getFirstToken(r.제품영문명_norm)) || firstToken.includes(getFirstToken(r.제품명_norm)))) {
        if (getFirstToken(r.제품영문명_norm).length >= 3 || getFirstToken(r.제품명_norm).length >= 2) {
          candSet.add(r._idx);
        }
      }
    }
  }

  if (candSet.size > 0) return { candSet, strategy: 'substring' };
  return { candSet, strategy: 'none' };
}

function fuzzyBroadSearch(
  prodNorm: string, indices: MfdsIndices, filterActive: boolean, sampleSize = 500
): { row: MfdsRow; score: number } | null {
  let pool = indices.rows;
  if (filterActive) {
    const active = pool.filter(r => r.is_active);
    if (active.length > 0) pool = active;
  }

  let sampled = pool;
  if (pool.length > sampleSize) {
    const step = Math.floor(pool.length / sampleSize);
    sampled = [];
    for (let i = 0; i < pool.length; i += step) {
      sampled.push(pool[i]);
      if (sampled.length >= sampleSize) break;
    }
  }

  let bestRow: MfdsRow | null = null;
  let bestScore = 0;
  for (const r of sampled) {
    const sEn = sequenceMatcherRatio(prodNorm, r.제품영문명_norm);
    const sKo = sequenceMatcherRatio(prodNorm, r.제품명_norm);
    const s = Math.max(sEn, sKo);
    if (s > bestScore) { bestScore = s; bestRow = r; }
  }

  if (bestRow && bestScore >= 0.4) return { row: bestRow, score: bestScore };
  return null;
}

export function processMatching(
  rawRows: RawRow[],
  mfdsData: Record<string, any>[],
  mappingRows: MappingRow[] | null,
  opts: ProcessingOptions,
  onProgress: (pct: number, label: string) => void
): { results: MatchResult[]; summary: ProcessingSummary; genericItems: GenericItem[]; genericListCompact: GenericListCompact[] } {
  onProgress(5, 'MFDS 데이터 정규화 중...');
  const mfdsRows = parseMfdsData(mfdsData);

  onProgress(15, '인덱스 구축 중...');
  const indices = buildIndices(mfdsRows);

  // Build mapping index
  const mappingIndex = new Map<string, MappingRow>();
  if (mappingRows) {
    for (const m of mappingRows) {
      if (m.Product_code_token) mappingIndex.set(m.Product_code_token.toUpperCase(), m);
    }
  }

  const filterActive = opts.cancelFilter === 'active_only';
  const results: MatchResult[] = [];
  const allGenericItems: GenericItem[] = [];
  const genericListCompact: GenericListCompact[] = [];

  const summary: ProcessingSummary = {
    total_rows: rawRows.length,
    high_count: 0, medium_count: 0, review_count: 0, not_found_count: 0,
    used_map_item_code: 0, used_map_ingredient: 0, used_map_name: 0,
    total_generic_item_rows: 0,
    max_generic_per_source: 0,
    average_generic_per_source: 0,
  };

  // Cache: ingBase -> GenericItem[] (without source info)
  const genericCache = new Map<string, MfdsRow[]>();

  for (let i = 0; i < rawRows.length; i++) {
    if (i % 50 === 0) {
      const pct = 20 + Math.floor((i / rawRows.length) * 70);
      onProgress(pct, `매칭 처리 중... (${i}/${rawRows.length})`);
    }

    const raw = rawRows[i];
    const productStr = String(raw.Product ?? '');
    const prodNorm = normText(productStr);
    const codeToken = extractCodeToken(productStr);

    let matchedRow: MfdsRow | null = null;
    let matchStatus = 'not_found';
    let matchScore = 0;

    // 1. Try mapping table
    if (mappingIndex.size > 0 && codeToken) {
      const mapEntry = mappingIndex.get(codeToken);
      if (mapEntry) {
        if (mapEntry.mapped_mfds_item_code) {
          const idxs = indices.itemCode.get(String(mapEntry.mapped_mfds_item_code)) || [];
          if (idxs.length > 0) {
            matchedRow = indices.rows[idxs[0]];
            matchStatus = 'map_item_code';
            matchScore = 1.0;
            summary.used_map_item_code++;
          }
        }
        if (!matchedRow && mapEntry.mapped_ingredient_base) {
          const ingKey = ingKeyBase(mapEntry.mapped_ingredient_base);
          const idxs = indices.ingBaseIndex.get(ingKey) || [];
          if (idxs.length > 0) {
            const best = bestFromCandidates(idxs, prodNorm, indices, filterActive);
            if (best) {
              matchedRow = best.row;
              matchStatus = 'map_ingredient_base';
              matchScore = best.score;
              summary.used_map_ingredient++;
            }
          }
        }
        if (!matchedRow && mapEntry.mapped_mfds_product_name) {
          const mapNorm = normText(mapEntry.mapped_mfds_product_name);
          const enMatch = indices.exactEn.get(mapNorm);
          const koMatch = indices.exactKo.get(mapNorm);
          const found = enMatch?.[0] || koMatch?.[0];
          if (found) {
            matchedRow = found;
            matchStatus = 'map_product_name';
            matchScore = 1.0;
            summary.used_map_name++;
          }
        }
      }
    }

    // 2. Exact match
    if (!matchedRow) {
      const enMatch = indices.exactEn.get(prodNorm);
      if (enMatch && enMatch.length > 0) {
        matchedRow = enMatch[0];
        matchStatus = 'exact_en';
        matchScore = 1.0;
      }
    }
    if (!matchedRow) {
      const koMatch = indices.exactKo.get(prodNorm);
      if (koMatch && koMatch.length > 0) {
        matchedRow = koMatch[0];
        matchStatus = 'exact_ko';
        matchScore = 1.0;
      }
    }

    // 3. Token-based matching
    if (!matchedRow) {
      const { candSet, strategy } = collectCandidates(prodNorm, codeToken, indices);
      if (candSet.size > 0) {
        const candIdxs = Array.from(candSet);
        const ingKeys = new Set(candIdxs.map(ci => indices.rows[ci].주성분_base_key).filter(Boolean));
        const converged = ingKeys.size <= 1;
        const best = bestFromCandidates(candIdxs, prodNorm, indices, filterActive);
        if (best) {
          matchedRow = best.row;
          matchScore = best.score;
          matchStatus = (strategy === 'prefix' || strategy === 'substring') ? 'prefix_match' : (converged ? 'token_ing_converged' : 'token_multi_ing');
        }
      }
    }

    // 4. Fuzzy broad fallback
    if (!matchedRow && prodNorm.length >= 3) {
      const fuzzy = fuzzyBroadSearch(prodNorm, indices, filterActive);
      if (fuzzy) {
        matchedRow = fuzzy.row;
        matchScore = fuzzy.score;
        matchStatus = 'fuzzy_broad';
      }
    }

    // Build result
    const { 신뢰도, 검토필요 } = assignConfidence(matchStatus, matchScore, opts.reviewThreshold);
    const ingBase = matchedRow?.주성분_base_key ?? '';
    const formKey = matchedRow?.제형_key ?? '';
    const gc = matchedRow ? getGenericCount(ingBase, formKey, opts, indices) : { count: 0, total_base: 0, total_base_form: 0, orig_base: 0 };

    // Collect generic items for this source row
    const items = matchedRow
      ? getGenericItems(ingBase, formKey, opts, indices, raw.순번, productStr)
      : [];

    // Consistency validation
    if (items.length !== gc.count) {
      console.error(`[VALIDATION] Discrepancy for row ${raw.순번}: generic_제품수=${gc.count}, actual generic_items=${items.length}`);
    }

    allGenericItems.push(...items);

    // Build compact row
    const names = items.map(it => it.generic_제품명).join(' | ');
    genericListCompact.push({
      순번: raw.순번,
      Product: productStr,
      Ingredient_base: ingBase,
      generic_count: gc.count,
      generic_product_names_joined: names.substring(0, 5000),
    });

    // Track max
    if (gc.count > summary.max_generic_per_source) summary.max_generic_per_source = gc.count;

    const result: MatchResult = {
      순번: raw.순번,
      Product: productStr,
      MFDS_제품명: matchedRow?.제품명 ?? '',
      MFDS_제품영문명: matchedRow?.제품영문명 ?? '',
      MFDS_품목기준코드: matchedRow?.품목기준코드 ?? '',
      MFDS_제형: matchedRow?.제형 ?? '',
      Ingredient_raw: matchedRow?.주성분 ?? '',
      Ingredient_base: ingBase,
      original_허가여부: matchedRow?.신약구분 === 'Y' ? 'Y' : '',
      generic_제품수: gc.count,
      매칭상태: matchStatus,
      매칭신뢰도: 신뢰도,
      매칭점수: Math.round(matchScore * 1000) / 1000,
      검토필요: 검토필요,
      total_count_by_base: gc.total_base,
      total_count_by_base_form: gc.total_base_form,
      original_count_by_base: gc.orig_base,
      generic_incl_original_by_base: gc.total_base,
      generic_excl_original_by_base: gc.total_base - gc.orig_base,
    };

    for (const key of Object.keys(raw)) {
      if (!(key in result)) result[key] = raw[key];
    }

    results.push(result);

    if (신뢰도 === 'HIGH') summary.high_count++;
    else if (신뢰도 === 'MEDIUM') summary.medium_count++;
    else summary.review_count++;
    if (matchStatus === 'not_found') summary.not_found_count++;
  }

  summary.total_generic_item_rows = allGenericItems.length;
  summary.average_generic_per_source = rawRows.length > 0
    ? Math.round((allGenericItems.length / rawRows.length) * 100) / 100
    : 0;

  onProgress(95, '결과 정리 중...');
  return { results, summary, genericItems: allGenericItems, genericListCompact };
}
