import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Search, ChevronLeft, ChevronRight, List } from 'lucide-react';
import type { GenericItem } from '@/lib/types';
import { generateGenericItemsExcel } from '@/lib/excel-io';

interface Props {
  genericItems: GenericItem[];
  selectedSeq: string | number | null;
}

const PAGE_SIZE = 20;
const DISPLAY_COLS: { key: keyof GenericItem; label: string }[] = [
  { key: 'source_순번', label: '순번' },
  { key: 'source_Product', label: 'Source Product' },
  { key: 'Ingredient_base', label: 'Ingredient Base' },
  { key: 'generic_품목기준코드', label: '품목기준코드' },
  { key: 'generic_제품명', label: '제품명' },
  { key: 'generic_제품영문명', label: '영문명' },
  { key: 'generic_제형', label: '제형' },
  { key: 'generic_허가일', label: '허가일' },
  { key: 'generic_취소/취하', label: '취소/취하' },
  { key: 'matching_criteria', label: '기준' },
];

export default function GenericItemsPanel({ genericItems, selectedSeq }: Props) {
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState(false);

  const filtered = useMemo(() => {
    let data = genericItems;
    if (selectedSeq !== null) {
      data = data.filter(g => String(g.source_순번) === String(selectedSeq));
    }
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(g =>
      DISPLAY_COLS.some(c => String(g[c.key] ?? '').toLowerCase().includes(q))
    );
  }, [genericItems, selectedSeq, search]);

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useMemo(() => setPage(0), [search, selectedSeq]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await generateGenericItemsExcel(selectedSeq !== null ? filtered : genericItems);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-accent" />
            <h2 className="text-base font-semibold text-foreground">Generic Items</h2>
            <Badge variant="outline" className="text-xs">
              {filtered.length.toLocaleString()}건
              {selectedSeq !== null && ` (순번: ${selectedSeq})`}
            </Badge>
          </div>
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
              {downloading ? '생성 중...' : 'Generic 엑셀'}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {DISPLAY_COLS.map(c => (
                  <TableHead key={c.key} className="text-xs font-semibold whitespace-nowrap px-3 py-2">{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={DISPLAY_COLS.length} className="text-center py-8 text-muted-foreground">
                    {selectedSeq !== null ? '선택된 행에 대한 Generic 제품이 없습니다.' : 'Generic 제품 데이터 없음'}
                  </TableCell>
                </TableRow>
              ) : pageData.map((g, i) => (
                <TableRow key={i} className="hover:bg-muted/30">
                  {DISPLAY_COLS.map(c => (
                    <TableCell key={c.key} className="text-xs px-3 py-2 max-w-[200px] truncate">
                      {c.key === 'matching_criteria' ? (
                        <Badge variant="outline" className="text-[10px]">{String(g[c.key])}</Badge>
                      ) : String(g[c.key] ?? '')}
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
      </CardContent>
    </Card>
  );
}
