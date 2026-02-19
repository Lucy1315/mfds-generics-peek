# MFDS Matching Dashboard — 워크플로우 및 사용방법

## 1. 개요

MFDS Matching Dashboard는 의약품 허가 품목 데이터(Raw Excel)와 식약처(MFDS) 마스터 데이터를 자동으로 매칭하여, 각 품목의 허가 여부 및 제네릭(후발) 의약품 수를 산출하는 도구입니다.

---

## 2. 워크플로우

```
┌─────────────────────┐
│  1. 파일 업로드      │
│  (Raw + MFDS + Map) │
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  2. 파일 진단        │
│  (컬럼 확인/시트선택)│
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  3. 옵션 설정        │
│  (제네릭 기준 등)    │
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  4. Process 실행     │
│  (매칭 + 집계)       │
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  5. 결과 확인        │
│  (테이블 + 제네릭)   │
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  6. Excel 다운로드   │
│  (5개 시트 출력)     │
└─────────────────────┘
```

---

## 3. 입력 파일 설명

### 3.1 Raw Excel (필수)

| 필수 컬럼 | 설명 |
|-----------|------|
| `Product` | 제품명 (영문 또는 한글) |
| `순번` | 고유 식별번호 |

- 기타 컬럼은 그대로 결과에 포함됩니다.

### 3.2 MFDS Master Excel (필수)

| 필수 컬럼 | 설명 |
|-----------|------|
| `제품명` | 한글 제품명 |
| `제품영문명` | 영문 제품명 |
| `주성분` | 성분명 (한글+영문) |
| `신약구분` | 'Y' = 신약 |
| `취소취하` | 취소/취하 여부 |
| `허가일자` | 허가 날짜 |
| `제형` | 제형 (정제, 캡슐 등) |

- 선택 컬럼: `품목기준코드`, `업체명`

### 3.3 Mapping Excel (선택)

사전 매핑 테이블로, 자동 매칭 정확도를 높입니다.

| 컬럼 | 설명 |
|------|------|
| `Product_code_token` | Raw Product에서 추출한 코드 토큰 |
| `mapped_mfds_item_code` | MFDS 품목기준코드 |
| `mapped_ingredient_base` | 매핑된 성분 base key |
| `mapped_mfds_product_name` | 매핑된 MFDS 제품명 |

---

## 4. 옵션 설정

### Generic Count Basis (제네릭 집계 기준)
- **Base ingredient only** (`base`): 주성분 기준으로만 집계
- **Base + Dosage form** (`base_form`): 주성분 + 제형 기준으로 집계

### Generic Definition (제네릭 정의)
- **Exclude original** (`excl_original`): 원개발 의약품 제외
- **Total minus original** (`total_minus_original`): 전체에서 원개발 차감

### Cancel Filter (취소/취하 필터)
- **Active only** (`active_only`): 취소/취하된 품목 제외
- **All** (`all`): 취소/취하 포함

### Review Threshold (검토 임계값)
- 매칭 점수가 이 값 미만이면 "검토필요"로 표시 (기본: 0.90)

---

## 5. 결과 해석

### 5.1 Summary Cards
- **Total**: 처리된 총 행 수
- **High**: 매칭 신뢰도 높음
- **Medium**: 중간 신뢰도
- **Review**: 검토 필요
- **Not Found**: 매칭 실패
- **Generic Items**: 식별된 제네릭 품목 총 수

### 5.2 Results Table 컬럼

| 컬럼 | 설명 |
|------|------|
| 순번 | 원본 식별번호 |
| Product | 원본 제품명 |
| MFDS_제품명 | 매칭된 MFDS 제품명 |
| Ingredient (Eng) | 영문 성분명 |
| Ingredient_base | 정규화된 성분 base key |
| 허가여부 | 원개발 의약품 여부 (Y/N) |
| Generic 수 | 해당 성분의 제네릭 품목 수 |
| 매칭상태 | high / medium / review / not_found |
| 매칭점수 | 0~1 범위의 유사도 점수 |

### 5.3 Generic Items 탭
- Results 테이블에서 행을 클릭하면 해당 품목의 제네릭 목록이 표시됩니다.
- 각 제네릭의 제품명, 영문명, 업체명, 제형, 허가일 등을 확인할 수 있습니다.

---

## 6. Excel 출력 시트 구성

| 시트명 | 내용 |
|--------|------|
| `results` | 전체 매칭 결과 (1행 = 1 소스 품목) |
| `summary` | 요약 통계 |
| `generic_items` | 제네릭 품목 상세 (1행 = 1 제네릭 제품) |
| `generic_list_compact` | 소스별 제네릭 요약 (제품명 join) |
| `mapping_used` | 사용된 매핑 데이터 (매핑 파일 업로드 시) |

---

## 7. 검증 로직

- **Consistency Check**: `generic_제품수`와 `generic_items` 시트의 실제 행 수가 일치하는지 자동 검증
- 불일치 발견 시 오류 토스트 및 콘솔 로그 출력
- Summary에 `total_generic_item_rows`, `max_generic_per_source`, `average_generic_per_source` 포함

---

## 8. 주의사항

1. Excel 파일은 `.xlsx` 또는 `.xls` 형식만 지원합니다.
2. 대용량 파일(10만 행 이상)은 처리 시간이 길어질 수 있습니다.
3. 주성분 정규화는 괄호, 특수문자, 농도 정보를 제거하여 수행됩니다.
4. Mapping 파일은 선택사항이지만, 사용 시 매칭 정확도가 크게 향상됩니다.
5. 취소/취하 필터 변경 시 MFDS 파일이 자동으로 재진단됩니다.
