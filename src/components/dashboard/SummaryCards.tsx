import { Card, CardContent } from '@/components/ui/card';
import { FileText, CheckCircle, AlertTriangle, AlertCircle, SearchX, MapPin } from 'lucide-react';
import type { ProcessingSummary } from '@/lib/types';

interface Props {
  summary: ProcessingSummary;
}

const items = (s: ProcessingSummary) => [
  { label: '전체', value: s.total_rows, icon: FileText, cls: 'text-foreground bg-muted' },
  { label: 'HIGH', value: s.high_count, icon: CheckCircle, cls: 'text-success bg-success/10' },
  { label: 'MEDIUM', value: s.medium_count, icon: AlertTriangle, cls: 'text-warning bg-warning/10' },
  { label: 'REVIEW', value: s.review_count, icon: AlertCircle, cls: 'text-review bg-review/10' },
  { label: 'Not Found', value: s.not_found_count, icon: SearchX, cls: 'text-destructive bg-destructive/10' },
  { label: '매핑 사용', value: s.used_map_item_code + s.used_map_ingredient + s.used_map_name, icon: MapPin, cls: 'text-accent bg-accent/10' },
];

export default function SummaryCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items(summary).map(({ label, value, icon: Icon, cls }) => (
        <Card key={label} className="card-hover">
          <CardContent className="pt-4 pb-4 flex flex-col items-center gap-1.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${cls}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
