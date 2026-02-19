import { useCallback, useState, type DragEvent } from 'react';
import { Upload, FileSpreadsheet, X, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface FileSlot {
  label: string;
  description: string;
  required: boolean;
  accept: string;
  file: File | null;
  onSet: (f: File | null) => void;
}

interface Props {
  rawFile: File | null;
  mfdsFile: File | null;
  mappingFile: File | null;
  onRawFile: (f: File | null) => void;
  onMfdsFile: (f: File | null) => void;
  onMappingFile: (f: File | null) => void;
}

function DropSlot({ label, description, required, file, onSet }: FileSlot) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.xlsx')) onSet(f);
  }, [onSet]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onSet(f);
  }, [onSet]);

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-5 text-center transition-all cursor-pointer
        ${dragOver ? 'border-accent bg-accent/10 scale-[1.02]' : file ? 'border-success/50 bg-success/5' : 'border-border hover:border-accent/50 hover:bg-muted/50'}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => document.getElementById(`file-${label}`)?.click()}
    >
      <input id={`file-${label}`} type="file" accept=".xlsx" className="hidden" onChange={handleChange} />
      {file ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center">
            <Check className="w-5 h-5 text-success" />
          </div>
          <p className="text-sm font-medium text-foreground truncate max-w-full">{file.name}</p>
          <button
            onClick={e => { e.stopPropagation(); onSet(null); }}
            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
          >
            <X className="w-3 h-3" /> 제거
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            {required ? <Upload className="w-5 h-5 text-muted-foreground" /> : <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{label} {required && <span className="text-destructive">*</span>}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FileUploadZone({ rawFile, mfdsFile, mappingFile, onRawFile, onMfdsFile, onMappingFile }: Props) {
  return (
    <Card className="card-hover">
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold mb-4 text-foreground">📁 파일 업로드</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DropSlot label="Raw Excel" description=".xlsx (순번, Product 컬럼 필수)" required accept=".xlsx" file={rawFile} onSet={onRawFile} />
          <DropSlot label="MFDS Master" description="mfds-data.xlsx" required accept=".xlsx" file={mfdsFile} onSet={onMfdsFile} />
          <DropSlot label="Code Token Mapping" description="선택 사항 (mapping_table_to_fill 시트)" required={false} accept=".xlsx" file={mappingFile} onSet={onMappingFile} />
        </div>
      </CardContent>
    </Card>
  );
}
