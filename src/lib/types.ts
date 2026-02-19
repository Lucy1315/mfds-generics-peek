export interface ProcessingOptions {
  genericCountBasis: 'base' | 'base_form';
  genericDefinition: 'excl_original' | 'total_minus_original';
  cancelFilter: 'active_only' | 'all';
  reviewThreshold: number;
}

export interface RawRow {
  순번: string | number;
  Product: string;
  [key: string]: any;
}

export interface MfdsRow {
  _idx: number;
  품목기준코드: string;
  제품명: string;
  제품영문명: string;
  주성분: string;
  제형: string;
  신약구분: string;
  허가일자: string;
  취소취하: string;
  제품명_norm: string;
  제품영문명_norm: string;
  is_active: boolean;
  주성분_base_key: string;
  제형_key: string;
  허가일_date: number;
}

export interface MappingRow {
  Product_code_token: string;
  mapped_mfds_item_code?: string;
  mapped_ingredient_base?: string;
  mapped_mfds_product_name?: string;
}

export interface GenericItem {
  source_순번: string | number;
  source_Product: string;
  Ingredient_base: string;
  generic_품목기준코드: string;
  generic_제품명: string;
  generic_제품영문명: string;
  generic_업체명: string;
  generic_제형: string;
  generic_허가일: string;
  'generic_취소/취하': string;
  matching_criteria: 'base' | 'base+form';
}

export interface GenericListCompact {
  순번: string | number;
  Product: string;
  Ingredient_base: string;
  generic_count: number;
  generic_product_names_joined: string;
}

export interface MatchResult {
  순번: string | number;
  Product: string;
  MFDS_제품명: string;
  MFDS_제품영문명: string;
  MFDS_품목기준코드: string;
  MFDS_제형: string;
  Ingredient_raw: string;
  Ingredient_base: string;
  original_허가여부: string;
  generic_제품수: number;
  매칭상태: string;
  매칭신뢰도: string;
  매칭점수: number;
  검토필요: string;
  total_count_by_base: number;
  total_count_by_base_form: number;
  original_count_by_base: number;
  generic_incl_original_by_base: number;
  generic_excl_original_by_base: number;
  [key: string]: any;
}

export interface ProcessingSummary {
  total_rows: number;
  high_count: number;
  medium_count: number;
  review_count: number;
  not_found_count: number;
  used_map_item_code: number;
  used_map_ingredient: number;
  used_map_name: number;
  total_generic_item_rows: number;
  max_generic_per_source: number;
  average_generic_per_source: number;
}

export interface ProcessingState {
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number;
  progressLabel: string;
  results: MatchResult[];
  genericItems: GenericItem[];
  genericListCompact: GenericListCompact[];
  summary: ProcessingSummary | null;
  error: string | null;
}

export interface SheetInfo {
  name: string;
  rowCount: number;
  headers: string[];
  matchedRequiredCount: number;
}

export interface FileDiagnostics {
  fileName: string;
  sheets: SheetInfo[];
  selectedSheet: string;
  rowCount: number;
  detectedHeaders: string[];
  columnMap: Record<string, string | null>;
  missingColumns: string[];
  errors: string[];
  activeRowCount?: number;
}
