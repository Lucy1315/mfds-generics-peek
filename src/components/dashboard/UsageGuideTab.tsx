import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSpreadsheet, Settings, Play, Download, Search, AlertTriangle } from 'lucide-react';

const Section = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
      <Icon className="w-4 h-4 text-primary" />
      {title}
    </h3>
    <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
  </div>
);

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="overflow-x-auto rounded border border-border">
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-muted">
          {headers.map(h => <th key={h} className="px-3 py-1.5 text-left font-medium text-foreground">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-border">
            {row.map((cell, j) => <td key={j} className="px-3 py-1.5">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function UsageGuideTab() {
  return (
    <ScrollArea className="h-[70vh]">
      <div className="space-y-6 p-4 max-w-3xl">
        {/* Workflow */}
        <Section icon={Play} title="워크플로우">
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>파일 업로드</strong> — Raw Excel (필수), MFDS Master (필수), Mapping (선택)</li>
            <li><strong>파일 진단</strong> — 필수 컬럼 확인, 시트 선택 (자동)</li>
            <li><strong>옵션 설정</strong> — 제네릭 기준, 취소/취하 필터, 검토 임계값</li>
            <li><strong>Process</strong> — 매칭 실행 및 제네릭 집계</li>
            <li><strong>결과 확인</strong> — Results 탭 + Generic Items 탭</li>
            <li><strong>Excel 다운로드</strong> — 5개 시트 포함 출력</li>
          </ol>
        </Section>

        {/* Input Files */}
        <Section icon={FileSpreadsheet} title="입력 파일">
          <p className="mb-2 font-medium text-foreground">Raw Excel (필수)</p>
          <Table
            headers={['컬럼', '설명']}
            rows={[
              ['Product', '제품명 (영문 또는 한글)'],
              ['순번', '고유 식별번호'],
            ]}
          />
          <p className="mt-3 mb-2 font-medium text-foreground">MFDS Master (필수)</p>
          <Table
            headers={['컬럼', '설명']}
            rows={[
              ['제품명', '한글 제품명'],
              ['제품영문명', '영문 제품명'],
              ['주성분', '성분명 (한글+영문)'],
              ['신약구분', "'Y' = 신약"],
              ['취소취하', '취소/취하 여부'],
              ['허가일자', '허가 날짜'],
              ['제형', '제형 (정제, 캡슐 등)'],
            ]}
          />
          <p className="mt-3 mb-2 font-medium text-foreground">Mapping Excel (선택)</p>
          <Table
            headers={['컬럼', '설명']}
            rows={[
              ['Product_code_token', 'Raw Product에서 추출한 코드 토큰'],
              ['mapped_mfds_item_code', 'MFDS 품목기준코드'],
              ['mapped_ingredient_base', '매핑된 성분 base key'],
              ['mapped_mfds_product_name', '매핑된 MFDS 제품명'],
            ]}
          />
        </Section>

        {/* Options */}
        <Section icon={Settings} title="옵션 설정">
          <Table
            headers={['옵션', '값', '설명']}
            rows={[
              ['Generic Count Basis', 'base', '주성분 기준으로만 집계'],
              ['', 'base+form', '주성분 + 제형 기준으로 집계'],
              ['Generic Definition', 'excl_original', '원개발 의약품 제외'],
              ['', 'total_minus_original', '전체에서 원개발 차감'],
              ['Cancel Filter', 'active_only', '취소/취하된 품목 제외'],
              ['', 'all', '취소/취하 포함'],
              ['Review Threshold', '0.90', '이 값 미만이면 검토필요 표시'],
            ]}
          />
        </Section>

        {/* Results */}
        <Section icon={Search} title="결과 해석">
          <p className="mb-2 font-medium text-foreground">매칭 상태</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li><strong>High</strong> — 신뢰도 높음 (직접 매칭 또는 매핑 활용)</li>
            <li><strong>Medium</strong> — 중간 신뢰도 (유사도 기반 매칭)</li>
            <li><strong>Review</strong> — 검토 필요 (임계값 미만)</li>
            <li><strong>Not Found</strong> — 매칭 실패</li>
          </ul>
          <p className="mt-3 mb-2 font-medium text-foreground">Generic Items 탭</p>
          <p>Results 테이블에서 행을 클릭하면 해당 품목의 제네릭 목록을 확인할 수 있습니다. 각 제네릭의 제품명, 영문명, 업체명, 제형, 허가일을 포함합니다.</p>
        </Section>

        {/* Output */}
        <Section icon={Download} title="Excel 출력 시트">
          <Table
            headers={['시트명', '내용']}
            rows={[
              ['results', '전체 매칭 결과 (1행 = 1 소스 품목)'],
              ['summary', '요약 통계'],
              ['generic_items', '제네릭 품목 상세 (1행 = 1 제네릭 제품)'],
              ['generic_list_compact', '소스별 제네릭 요약 (제품명 join)'],
              ['mapping_used', '사용된 매핑 데이터'],
            ]}
          />
        </Section>

        {/* Notes */}
        <Section icon={AlertTriangle} title="주의사항">
          <ul className="list-disc list-inside space-y-1">
            <li>Excel 파일은 <code>.xlsx</code> 또는 <code>.xls</code> 형식만 지원</li>
            <li>대용량 파일(10만 행 이상)은 처리 시간이 길어질 수 있음</li>
            <li>주성분 정규화 시 괄호, 특수문자, 농도 정보가 제거됨</li>
            <li>Mapping 파일 사용 시 매칭 정확도가 크게 향상됨</li>
            <li>Consistency Check에서 불일치 발견 시 오류 토스트 및 콘솔 로그 출력</li>
          </ul>
        </Section>
      </div>
    </ScrollArea>
  );
}
