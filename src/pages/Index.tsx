import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/dashboard/Header';
import FileUploadZone from '@/components/dashboard/FileUploadZone';
import OptionsPanel from '@/components/dashboard/OptionsPanel';
import SummaryCards from '@/components/dashboard/SummaryCards';
import ResultsTable from '@/components/dashboard/ResultsTable';
import FileDiagnosticsPanel from '@/components/dashboard/FileDiagnostics';
import type { ProcessingOptions, ProcessingState, MappingRow, FileDiagnostics } from '@/lib/types';
import { parseRawExcel, parseMfdsExcel, parseMappingExcel, diagnoseRawFile, diagnoseMfdsFile } from '@/lib/excel-io';
import { processMatching } from '@/lib/matching';

const DEFAULT_OPTIONS: ProcessingOptions = {
  genericCountBasis: 'base',
  genericDefinition: 'excl_original',
  cancelFilter: 'active_only',
  reviewThreshold: 0.90,
};

const RAW_REQUIRED = ['Product', '순번'];
const MFDS_REQUIRED = ['제품명', '제품영문명', '주성분', '신약구분', '취소취하', '허가일자', '제형'];

export default function Index() {
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [mfdsFile, setMfdsFile] = useState<File | null>(null);
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [options, setOptions] = useState<ProcessingOptions>(DEFAULT_OPTIONS);
  const [mappingRows, setMappingRows] = useState<MappingRow[] | null>(null);

  const [rawDiag, setRawDiag] = useState<FileDiagnostics | null>(null);
  const [mfdsDiag, setMfdsDiag] = useState<FileDiagnostics | null>(null);
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [mfdsBuffer, setMfdsBuffer] = useState<ArrayBuffer | null>(null);

  const [state, setState] = useState<ProcessingState>({
    status: 'idle', progress: 0, progressLabel: '', results: [], genericItems: [], genericListCompact: [], summary: null, error: null,
  });

  useEffect(() => {
    if (!rawFile) { setRawDiag(null); setRawBuffer(null); return; }
    rawFile.arrayBuffer().then(buf => {
      setRawBuffer(buf);
      const diag = diagnoseRawFile(buf, rawFile.name);
      setRawDiag(diag);
      if (diag.errors.length > 0) toast.error(diag.errors[0]);
    }).catch(e => {
      setRawDiag({ fileName: rawFile.name, sheets: [], selectedSheet: '', rowCount: 0, detectedHeaders: [], columnMap: {}, missingColumns: RAW_REQUIRED, errors: [e.message] });
    });
  }, [rawFile]);

  useEffect(() => {
    if (!mfdsFile) { setMfdsDiag(null); setMfdsBuffer(null); return; }
    mfdsFile.arrayBuffer().then(buf => {
      setMfdsBuffer(buf);
      const diag = diagnoseMfdsFile(buf, mfdsFile.name, options.cancelFilter === 'active_only');
      setMfdsDiag(diag);
      if (diag.errors.length > 0) toast.error(diag.errors[0]);
    }).catch(e => {
      setMfdsDiag({ fileName: mfdsFile.name, sheets: [], selectedSheet: '', rowCount: 0, detectedHeaders: [], columnMap: {}, missingColumns: MFDS_REQUIRED, errors: [e.message] });
    });
  }, [mfdsFile, options.cancelFilter]);

  const handleRawSheetChange = useCallback((sheet: string) => {
    setRawDiag(prev => prev ? { ...prev, selectedSheet: sheet } : prev);
  }, []);

  const handleMfdsSheetChange = useCallback((sheet: string) => {
    setMfdsDiag(prev => prev ? { ...prev, selectedSheet: sheet } : prev);
  }, []);

  const rawValid = rawDiag && rawDiag.missingColumns.length === 0 && rawDiag.rowCount > 0;
  const mfdsValid = mfdsDiag && mfdsDiag.missingColumns.length === 0 && mfdsDiag.rowCount > 0;
  const isProcessing = state.status === 'processing';
  const canProcess = rawValid && mfdsValid && !isProcessing;

  const handleProcess = useCallback(async () => {
    if (!rawBuffer || !mfdsBuffer || !rawDiag || !mfdsDiag) {
      toast.error('Raw Excel 파일과 MFDS Master 파일을 모두 업로드해 주세요.');
      return;
    }

    setState({ status: 'processing', progress: 0, progressLabel: '파일 읽는 중...', results: [], genericItems: [], genericListCompact: [], summary: null, error: null });

    try {
      const mapBuf = mappingFile ? await mappingFile.arrayBuffer() : null;

      setState(s => ({ ...s, progress: 5, progressLabel: 'Raw 파일 파싱 중...' }));
      const rawRows = parseRawExcel(rawBuffer, rawDiag.selectedSheet);

      setState(s => ({ ...s, progress: 10, progressLabel: 'MFDS 파일 파싱 중...' }));
      const mfdsData = parseMfdsExcel(mfdsBuffer, mfdsDiag.selectedSheet);

      let parsedMapping: MappingRow[] | null = null;
      if (mapBuf) parsedMapping = parseMappingExcel(mapBuf);
      setMappingRows(parsedMapping);

      const { results, summary, genericItems, genericListCompact } = processMatching(rawRows, mfdsData, parsedMapping, options, (pct, label) => {
        setState(s => ({ ...s, progress: pct, progressLabel: label }));
      });

      // Consistency validation
      const discrepancies: string[] = [];
      for (const r of results) {
        const itemCount = genericItems.filter(g => String(g.source_순번) === String(r.순번)).length;
        if (itemCount !== r.generic_제품수) {
          discrepancies.push(`순번 ${r.순번}: expected ${r.generic_제품수}, got ${itemCount}`);
        }
      }
      if (discrepancies.length > 0) {
        console.error('[VALIDATION] Discrepancies found:', discrepancies);
        toast.error(`Consistency check: ${discrepancies.length}건의 불일치 발견. 콘솔 로그를 확인하세요.`);
      }

      setState({ status: 'done', progress: 100, progressLabel: '완료!', results, genericItems, genericListCompact, summary, error: null });
      toast.success(`매칭 완료! ${summary.total_rows}건 처리됨, Generic: ${genericItems.length}건`);
    } catch (err: any) {
      setState(s => ({ ...s, status: 'error', error: err.message || '처리 중 오류 발생', progress: 0, progressLabel: '' }));
      toast.error(err.message || '처리 중 오류가 발생했습니다.');
    }
  }, [rawBuffer, mfdsBuffer, rawDiag, mfdsDiag, mappingFile, options]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <FileUploadZone
          rawFile={rawFile} mfdsFile={mfdsFile} mappingFile={mappingFile}
          onRawFile={setRawFile} onMfdsFile={setMfdsFile} onMappingFile={setMappingFile}
        />

        {rawDiag && (
          <FileDiagnosticsPanel
            label={`Raw: ${rawDiag.fileName}`}
            diag={rawDiag}
            requiredCols={RAW_REQUIRED}
            onSheetChange={rawDiag.sheets.length > 1 ? handleRawSheetChange : undefined}
          />
        )}
        {mfdsDiag && (
          <FileDiagnosticsPanel
            label={`MFDS: ${mfdsDiag.fileName}`}
            diag={mfdsDiag}
            requiredCols={MFDS_REQUIRED}
            onSheetChange={mfdsDiag.sheets.length > 1 ? handleMfdsSheetChange : undefined}
          />
        )}

        <OptionsPanel options={options} onChange={setOptions} />

        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={handleProcess}
            disabled={!canProcess}
            size="lg"
            className="gap-2 px-8 text-base font-semibold"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {isProcessing ? '처리 중...' : 'Process'}
          </Button>

          {(rawFile || mfdsFile) && !canProcess && !isProcessing && (
            <div className="text-xs text-muted-foreground text-center space-y-0.5">
              {!rawFile && <p>⚠ Raw Excel 파일을 업로드해 주세요.</p>}
              {!mfdsFile && <p>⚠ MFDS Master 파일을 업로드해 주세요.</p>}
              {rawDiag && rawDiag.missingColumns.length > 0 && (
                <p className="text-destructive">❌ Raw 파일 필수 컬럼 누락: {rawDiag.missingColumns.join(', ')}</p>
              )}
              {mfdsDiag && mfdsDiag.missingColumns.length > 0 && (
                <p className="text-destructive">❌ MFDS 파일 필수 컬럼 누락: {mfdsDiag.missingColumns.join(', ')}</p>
              )}
            </div>
          )}

          {isProcessing && (
            <div className="w-full max-w-md space-y-1.5">
              <Progress value={state.progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">{state.progressLabel}</p>
            </div>
          )}

          {state.error && (
            <div className="w-full max-w-lg bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive">
              ❌ {state.error}
            </div>
          )}
        </div>

        {state.summary && (
          <>
            <SummaryCards summary={state.summary} />
            <ResultsTable
              results={state.results}
              summary={state.summary}
              mappingRows={mappingRows}
              genericItems={state.genericItems}
              genericListCompact={state.genericListCompact}
            />
          </>
        )}
      </main>
    </div>
  );
}
