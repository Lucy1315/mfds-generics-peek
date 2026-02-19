import { CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FileDiagnostics as DiagType } from '@/lib/types';

interface Props {
  label: string;
  diag: DiagType;
  requiredCols: string[];
  onSheetChange?: (sheet: string) => void;
}

function ColBadge({ name, found }: { name: string; found: boolean }) {
  return (
    <Badge variant={found ? 'default' : 'destructive'} className="gap-1 text-xs">
      {found ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {name}
    </Badge>
  );
}

export default function FileDiagnosticsPanel({ label, diag, requiredCols, onSheetChange }: Props) {
  const hasErrors = diag.errors.length > 0;
  const allFound = diag.missingColumns.length === 0;

  return (
    <Card className={`border ${hasErrors ? 'border-destructive/40 bg-destructive/5' : allFound ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'}`}>
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <Badge variant="outline" className="text-xs">{diag.rowCount.toLocaleString()} rows</Badge>
            {diag.activeRowCount != null && (
              <Badge variant="outline" className="text-xs">active: {diag.activeRowCount.toLocaleString()}</Badge>
            )}
          </div>
          {diag.sheets.length > 1 && onSheetChange && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">시트:</span>
              <Select value={diag.selectedSheet} onValueChange={onSheetChange}>
                <SelectTrigger className="h-7 text-xs w-auto min-w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {diag.sheets.map(s => (
                    <SelectItem key={s.name} value={s.name} className="text-xs">
                      {s.name} ({s.rowCount}행, 필수 {s.matchedRequiredCount}개)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">컬럼 인식:</p>
          <div className="flex flex-wrap gap-1.5">
            {requiredCols.map(col => (
              <ColBadge key={col} name={col} found={!!diag.columnMap[col]} />
            ))}
          </div>
        </div>
        <details className="text-xs">
          <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
            감지된 헤더 ({diag.detectedHeaders.length}개)
          </summary>
          <p className="mt-1 text-muted-foreground leading-relaxed break-all">
            {diag.detectedHeaders.join(' · ') || '(없음)'}
          </p>
        </details>
        {hasErrors && (
          <div className="space-y-1">
            {diag.errors.map((err, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
