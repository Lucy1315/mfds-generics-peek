import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { RawRow, MappingRow, MatchResult, ProcessingSummary, SheetInfo, FileDiagnostics, GenericItem, GenericListCompact } from './types';

// ── BOM + hidden char cleanup ──
function cleanHeader(h: unknown): string {
  if (h == null) return '';
  return String(h).replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();
}

// ── Alias tables ──
const RAW_PRODUCT_ALIASES = ['product', 'PRODUCT', 'Product', '제품', '제품명', '품목', '품목명'];
const RAW_SEQ_ALIASES = ['순번', 'No', 'NO', 'no', 'index', 'Index', 'INDEX', 'no.', 'No.', '번호'];

const MFDS_COL_ALIASES: Record<string, string[]> = {
  '제품명': ['제품명', '제품 명', 'product_name', 'productname'],
  '제품영문명': ['제품영문명', '제품 영문명', '영문제품명', 'english_name', 'eng_name', 'englishname', 'product_english_name'],
  '주성분': ['주성분', '주성분명', '성분명', '성분', 'ingredient', 'ingredients', 'active_ingredient'],
  '신약구분': ['신약구분', '신약여부', '신약', 'new_drug', 'newdrug'],
  '취소취하': ['취소취하', '취소/취하', '취소일자', '취소/취하일자', '상태', '변경구분', 'cancel', 'status'],
  '허가일자': ['허가일자', '허가일', '허가 일자', 'approval_date', 'approvaldate'],
  '제형': ['제형', '제형명', 'dosage_form', 'dosageform', 'form'],
  '품목기준코드': ['품목기준코드', '품목코드', 'item_code', 'itemcode', 'code'],
};

const MFDS_REQUIRED = ['제품명', '제품영문명', '주성분', '신약구분', '취소취하', '허가일자', '제형'];

function normAlias(s: string): string {
  return s.toLowerCase().replace(/[\s_\-./\\]/g, '');
}

function findByAlias(headers: string[], aliases: string[]): string | null {
  const normAliases = aliases.map(normAlias);
  for (const h of headers) {
    if (aliases.includes(h)) return h;
  }
  for (const h of headers) {
    const nh = normAlias(h);
    if (normAliases.includes(nh)) return h;
  }
  for (const h of headers) {
    const nh = normAlias(h);
    for (const na of normAliases) {
      if (nh.includes(na) || na.includes(nh)) return h;
    }
  }
  return null;
}

function getSheetInfos(wb: XLSX.WorkBook, requiredAliases: Record<string, string[]>): SheetInfo[] {
  const requiredKeys = Object.keys(requiredAliases);
  return wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    if (!ws) return { name, rowCount: 0, headers: [], matchedRequiredCount: 0 };
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
    const rawHeaders = data.length > 0 ? Object.keys(data[0]).map(cleanHeader) : [];
    let matched = 0;
    for (const key of requiredKeys) {
      if (findByAlias(rawHeaders, requiredAliases[key])) matched++;
    }
    return { name, rowCount: data.length, headers: rawHeaders, matchedRequiredCount: matched };
  });
}

function bestSheet(sheets: SheetInfo[]): SheetInfo {
  return sheets.reduce((best, s) =>
    s.matchedRequiredCount > best.matchedRequiredCount ? s :
    s.matchedRequiredCount === best.matchedRequiredCount && s.rowCount > best.rowCount ? s : best
  , sheets[0]);
}

export function diagnoseRawFile(buffer: ArrayBuffer, fileName: string): FileDiagnostics {
  const errors: string[] = [];
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    const rawRequired: Record<string, string[]> = {
      'Product': RAW_PRODUCT_ALIASES,
      '순번': RAW_SEQ_ALIASES,
    };
    const sheets = getSheetInfos(wb, rawRequired);
    const best = bestSheet(sheets);
    const headers = best.headers;
    const productCol = findByAlias(headers, RAW_PRODUCT_ALIASES);
    const seqCol = findByAlias(headers, RAW_SEQ_ALIASES);
    const columnMap: Record<string, string | null> = { 'Product': productCol, '순번': seqCol };
    const missing: string[] = [];
    if (!productCol) missing.push('Product');
    if (!seqCol) missing.push('순번');
    if (missing.length > 0) {
      errors.push(`필수 컬럼을 찾지 못했습니다: ${missing.join(', ')}. 현재 감지된 컬럼: ${headers.join(', ')}`);
    }
    return { fileName, sheets, selectedSheet: best.name, rowCount: best.rowCount, detectedHeaders: headers, columnMap, missingColumns: missing, errors };
  } catch (e: any) {
    return { fileName, sheets: [], selectedSheet: '', rowCount: 0, detectedHeaders: [], columnMap: {}, missingColumns: ['Product', '순번'], errors: [`파일 파싱 실패: ${e.message || '알 수 없는 오류'}`] };
  }
}

export function diagnoseMfdsFile(buffer: ArrayBuffer, fileName: string, filterActiveOnly: boolean): FileDiagnostics {
  const errors: string[] = [];
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheets = getSheetInfos(wb, MFDS_COL_ALIASES);
    const best = bestSheet(sheets);
    const headers = best.headers;
    const columnMap: Record<string, string | null> = {};
    const missing: string[] = [];
    for (const key of MFDS_REQUIRED) {
      const found = findByAlias(headers, MFDS_COL_ALIASES[key]);
      columnMap[key] = found;
      if (!found) missing.push(key);
    }
    columnMap['품목기준코드'] = findByAlias(headers, MFDS_COL_ALIASES['품목기준코드']);
    if (missing.length > 0) {
      errors.push(`MFDS 파일에서 다음 컬럼을 찾지 못했습니다: ${missing.join(', ')}. 현재 감지된 컬럼: ${headers.join(', ')}`);
    }
    let activeRowCount: number | undefined;
    if (filterActiveOnly && missing.length === 0) {
      const ws = wb.Sheets[best.name];
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      const cancelCol = columnMap['취소취하'];
      if (cancelCol) {
        activeRowCount = data.filter(row => {
          const v = cleanHeader(row[cancelCol]);
          return !v || v === '정상' || v === '';
        }).length;
      } else {
        activeRowCount = data.length;
      }
    }
    return { fileName, sheets, selectedSheet: best.name, rowCount: best.rowCount, detectedHeaders: headers, columnMap, missingColumns: missing, errors, activeRowCount };
  } catch (e: any) {
    return { fileName, sheets: [], selectedSheet: '', rowCount: 0, detectedHeaders: [], columnMap: {}, missingColumns: MFDS_REQUIRED, errors: [`MFDS 파일 파싱 실패: ${e.message || '알 수 없는 오류'}`] };
  }
}

export function parseRawExcel(buffer: ArrayBuffer, sheetName?: string): RawRow[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const wsName = sheetName || wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
  if (data.length === 0) throw new Error('Raw 파일이 비어 있습니다.');
  const headers = Object.keys(data[0]).map(cleanHeader);
  const productCol = findByAlias(headers, RAW_PRODUCT_ALIASES);
  const seqCol = findByAlias(headers, RAW_SEQ_ALIASES);
  if (!productCol) throw new Error(`필수 컬럼 "Product"를 찾지 못했습니다. 감지된 컬럼: ${headers.join(', ')}`);
  return data.map(row => {
    const normalized: any = {};
    for (const [k, v] of Object.entries(row)) {
      const ck = cleanHeader(k);
      if (seqCol && ck === seqCol) normalized['순번'] = v;
      else if (ck === productCol) normalized['Product'] = v;
      else normalized[ck] = v;
    }
    if (!normalized['순번']) normalized['순번'] = '';
    return normalized as RawRow;
  });
}

export function parseMfdsExcel(buffer: ArrayBuffer, sheetName?: string): Record<string, any>[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const wsName = sheetName || wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
  if (data.length === 0) throw new Error('MFDS 마스터 파일이 비어 있습니다.');
  const origHeaders = Object.keys(data[0]);
  const cleanHeaders = origHeaders.map(cleanHeader);
  const headerMap: Record<string, string> = {};
  for (const [stdName, aliases] of Object.entries(MFDS_COL_ALIASES)) {
    const found = findByAlias(cleanHeaders, aliases);
    if (found) {
      const origIdx = cleanHeaders.indexOf(found);
      if (origIdx >= 0) headerMap[origHeaders[origIdx]] = stdName;
    }
  }
  return data.map(row => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      const std = headerMap[k];
      out[std || cleanHeader(k)] = v;
    }
    return out;
  });
}

export function parseMappingExcel(buffer: ArrayBuffer): MappingRow[] | null {
  const wb = XLSX.read(buffer, { type: 'array' });
  const targetSheet = wb.SheetNames.find(n => n.includes('mapping_table_to_fill')) || wb.SheetNames[0];
  const ws = wb.Sheets[targetSheet];
  if (!ws) return null;
  const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
  if (data.length === 0) return null;
  return data.map(row => {
    const keys = Object.keys(row).map(cleanHeader);
    const origKeys = Object.keys(row);
    const findKey = (search: string) => {
      const ns = normAlias(search);
      const idx = keys.findIndex(k => normAlias(k).includes(ns));
      return idx >= 0 ? origKeys[idx] : '';
    };
    return {
      Product_code_token: String(row[findKey('Product_code_token') || findKey('code_token')] ?? ''),
      mapped_mfds_item_code: String(row[findKey('mapped_mfds_item_code') || findKey('item_code')] ?? ''),
      mapped_ingredient_base: String(row[findKey('mapped_ingredient_base') || findKey('ingredient')] ?? ''),
      mapped_mfds_product_name: String(row[findKey('mapped_mfds_product_name') || findKey('product_name')] ?? ''),
    };
  }).filter(r => r.Product_code_token);
}

// ── Excel output with generic items sheets ──

function addStyledHeader(ws: ExcelJS.Worksheet, cols: string[], color: string) {
  ws.addRow(cols);
  const row = ws.getRow(1);
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
    cell.alignment = { horizontal: 'center' };
  });
}

export async function generateOutputExcel(
  results: MatchResult[],
  summary: ProcessingSummary,
  mappingRows: MappingRow[] | null,
  genericItems: GenericItem[],
  genericListCompact: GenericListCompact[],
): Promise<void> {
  const wb = new ExcelJS.Workbook();

  const cols = [
    '순번', 'Product', 'MFDS_제품명', 'MFDS_제품영문명', 'MFDS_품목기준코드', 'MFDS_제형',
    'Ingredient_raw', 'Ingredient_eng', 'Ingredient_base', 'original_허가여부', 'generic_제품수',
    '매칭상태', '매칭신뢰도', '매칭점수', '검토필요',
    'total_count_by_base', 'total_count_by_base_form', 'original_count_by_base',
    'generic_incl_original_by_base', 'generic_excl_original_by_base',
  ];

  // Sheet 1: filled
  const wsFilled = wb.addWorksheet('filled');
  addStyledHeader(wsFilled, cols, 'FF1B3A5C');
  for (const r of results) wsFilled.addRow(cols.map(c => r[c] ?? ''));
  wsFilled.columns.forEach(col => { col.width = 18; });

  // Sheet 2: review_needed
  const wsReview = wb.addWorksheet('review_needed');
  addStyledHeader(wsReview, cols, 'FFD97706');
  for (const r of results.filter(r => r.검토필요 === 'Y')) wsReview.addRow(cols.map(c => r[c] ?? ''));
  wsReview.columns.forEach(col => { col.width = 18; });

  // Sheet 3: summary
  const wsSummary = wb.addWorksheet('summary');
  wsSummary.addRow(['항목', '값']);
  const summaryHeader = wsSummary.getRow(1);
  summaryHeader.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A5C' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
  });
  const entries: [string, number][] = [
    ['전체 행 수', summary.total_rows],
    ['HIGH', summary.high_count],
    ['MEDIUM', summary.medium_count],
    ['REVIEW', summary.review_count],
    ['Not Found', summary.not_found_count],
    ['매핑(품목코드) 사용', summary.used_map_item_code],
    ['매핑(성분) 사용', summary.used_map_ingredient],
    ['매핑(제품명) 사용', summary.used_map_name],
    ['total_generic_item_rows', summary.total_generic_item_rows],
    ['max_generic_per_source', summary.max_generic_per_source],
    ['average_generic_per_source', summary.average_generic_per_source],
  ];
  for (const [k, v] of entries) wsSummary.addRow([k, v]);
  wsSummary.columns.forEach(col => { col.width = 25; });

  // Sheet 4: mapping_snapshot
  if (mappingRows && mappingRows.length > 0) {
    const wsMap = wb.addWorksheet('mapping_snapshot');
    const mapCols = ['Product_code_token', 'mapped_mfds_item_code', 'mapped_ingredient_base', 'mapped_mfds_product_name'];
    wsMap.addRow(mapCols);
    for (const m of mappingRows) wsMap.addRow(mapCols.map(c => (m as any)[c] ?? ''));
    wsMap.columns.forEach(col => { col.width = 25; });
  }

  // Sheet 5: generic_items
  const giCols = [
    'source_순번', 'source_Product', 'Ingredient_eng', 'Ingredient_base',
    'generic_품목기준코드', 'generic_제품명', 'generic_제품영문명',
    'generic_업체명', 'generic_제형', 'generic_허가일', 'generic_취소/취하',
    'matching_criteria',
  ];
  const wsGeneric = wb.addWorksheet('generic_items');
  addStyledHeader(wsGeneric, giCols, 'FF2563EB');
  for (const gi of genericItems) wsGeneric.addRow(giCols.map(c => (gi as any)[c] ?? ''));
  wsGeneric.columns.forEach(col => { col.width = 20; });

  // Sheet 6: generic_list_compact
  const gcCols = ['순번', 'Product', 'Ingredient_base', 'generic_count', 'generic_product_names_joined'];
  const wsCompact = wb.addWorksheet('generic_list_compact');
  addStyledHeader(wsCompact, gcCols, 'FF059669');
  for (const gc of genericListCompact) wsCompact.addRow(gcCols.map(c => (gc as any)[c] ?? ''));
  wsCompact.columns.forEach(col => { col.width = 25; });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `mfds_matching_result_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function generateGenericItemsExcel(genericItems: GenericItem[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const giCols = [
    'source_순번', 'source_Product', 'Ingredient_eng', 'Ingredient_base',
    'generic_품목기준코드', 'generic_제품명', 'generic_제품영문명',
    'generic_업체명', 'generic_제형', 'generic_허가일', 'generic_취소/취하',
    'matching_criteria',
  ];
  const ws = wb.addWorksheet('generic_items');
  addStyledHeader(ws, giCols, 'FF2563EB');
  for (const gi of genericItems) ws.addRow(giCols.map(c => (gi as any)[c] ?? ''));
  ws.columns.forEach(col => { col.width = 20; });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `generic_items_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
