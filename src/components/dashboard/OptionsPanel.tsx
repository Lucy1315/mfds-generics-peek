import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { ProcessingOptions } from '@/lib/types';

interface Props {
  options: ProcessingOptions;
  onChange: (opts: ProcessingOptions) => void;
}

export default function OptionsPanel({ options, onChange }: Props) {
  const set = <K extends keyof ProcessingOptions>(key: K, val: ProcessingOptions[K]) =>
    onChange({ ...options, [key]: val });

  return (
    <Card className="card-hover">
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold mb-4 text-foreground">⚙️ 옵션 설정</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Generic 카운트 기준</Label>
            <Select value={options.genericCountBasis} onValueChange={v => set('genericCountBasis', v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="base">Base Ingredient 기준</SelectItem>
                <SelectItem value="base_form">Base + 제형 기준</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Generic 정의</Label>
            <Select value={options.genericDefinition} onValueChange={v => set('genericDefinition', v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="excl_original">신약 제외 제네릭수</SelectItem>
                <SelectItem value="total_minus_original">Total - Original (참고)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">취소/취하 필터</Label>
            <Select value={options.cancelFilter} onValueChange={v => set('cancelFilter', v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active_only">정상만 포함</SelectItem>
                <SelectItem value="all">전체</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Review 임계치: {options.reviewThreshold.toFixed(2)}</Label>
            <Slider
              value={[options.reviewThreshold]}
              min={0.80}
              max={0.95}
              step={0.01}
              onValueChange={([v]) => set('reviewThreshold', v)}
              className="mt-3"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0.80</span><span>0.95</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
