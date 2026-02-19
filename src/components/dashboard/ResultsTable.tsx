import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MatchResult, ProcessingSummary, MappingRow, GenericItem, GenericListCompact } from '@/lib/types';
import { generateOutputExcel } from '@/lib/excel-io';
import GenericItemsPanel from './GenericItemsPanel';
import UsageGuideTab from './UsageGuideTab';

interface Props {
  results: MatchResult[];
  summary: ProcessingSummary;
  mappingRows: MappingRow[] | null;
  genericItems: GenericItem[];
  genericListCompact: GenericListCompact[];
}

const PAGE_SIZE = 20;
const DISPLAY_COLS = ['순번', 'Product', 'MFDS_제품명', 'Ingredient_raw', 'Ingredient_eng', 'Ingredient_base', 'original_허가여부', 'generic_제품수', '매칭상태', '매칭신뢰도', '매칭점수', '검토필요'];

function ConfidenceBadge({ level }: { level: string }) {
  const cls = level === 'HIGH' ? 'status-high' : level === 'MEDIUM' ? 'status-medium' : 'status-review';
  return <Badge variant="outline" className={`${cls} text-[10px] px-1.5 py-0.5 font-semibold`}>{level}</Badge>;
}

function DataTable({ data, search, onSelectRow, selectedSeq }: { data: MatchResult[]; search: string; onSelectRow: (seq: string | number) => void; selectedSeq: string | number | null }) {
  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(r => DISPLAY_COLS.some(c => String(r[c] ?? '').toLowerCase().includes(q)));
  }, [data, search]);

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useMemo(() => setPage(0), [search]);

  return (
    <div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {DISPLAY_COLS.map(c => (
                <TableHead key={c} className="text-xs font-semibold whitespace-nowrap px-3 py-2">{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow><TableCell colSpan={DISPLAY_COLS.length} className="text-center py-8 text-muted-foreground">데이터 없음</TableCell></TableRow>
            ) : pageData.map((r, i) => (
              <TableRow
                key={i}
                className={`cursor-pointer transition-colors ${String(r.순번) === String(selectedSeq) ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-muted/30'}`}
                onClick={() => onSelectRow(r.순번)}
              >
                {DISPLAY_COLS.map(c => (
                  <TableCell key={c} className="text-xs px-3 py-2 max-w-[200px] truncate">
                    {c === '매칭신뢰도' ? <ConfidenceBadge level={String(r[c])} /> : String(r[c] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-muted-foreground">{filtered.length.toLocaleString()}건 중 {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs flex items-center px-2 text-muted-foreground">{page + 1}/{totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsTable({ results, summary, mappingRows, genericItems, genericListCompact }: Props) {
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [selectedSeq, setSelectedSeq] = useState<string | number | null>(null);
  const reviewResults = useMemo(() => results.filter(r => r.검토필요 === 'Y'), [results]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await generateOutputExcel(results, summary, mappingRows, genericItems, genericListCompact);
    } finally {
      setDownloading(false);
    }
  };

  const handleSelectRow = (seq: string | number) => {
    setSelectedSeq(prev => String(prev) === String(seq) ? null : seq);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-foreground">📊 매칭 결과</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 w-full sm:w-56 text-sm"
              />
            </div>
            <Button onClick={handleDownload} disabled={downloading} size="sm" className="gap-1.5">
              <Download className="w-3.5 h-3.5" />
              {downloading ? '생성 중...' : '엑셀 다운로드'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all">
          <TabsList className="mb-3">
            <TabsTrigger value="all" className="text-xs">전체 결과 ({results.length})</TabsTrigger>
            <TabsTrigger value="review" className="text-xs">Review Needed ({reviewResults.length})</TabsTrigger>
            <TabsTrigger value="generic" className="text-xs">Generic Items ({genericItems.length})</TabsTrigger>
            <TabsTrigger value="guide" className="text-xs">📖 사용방법</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <DataTable data={results} search={search} onSelectRow={handleSelectRow} selectedSeq={selectedSeq} />
            {selectedSeq !== null && (
              <div className="mt-4">
                <GenericItemsPanel genericItems={genericItems} selectedSeq={selectedSeq} />
              </div>
            )}
          </TabsContent>
          <TabsContent value="review">
            <DataTable data={reviewResults} search={search} onSelectRow={handleSelectRow} selectedSeq={selectedSeq} />
          </TabsContent>
          <TabsContent value="generic">
            <GenericItemsPanel genericItems={genericItems} selectedSeq={null} />
          </TabsContent>
          <TabsContent value="guide">
            <UsageGuideTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
