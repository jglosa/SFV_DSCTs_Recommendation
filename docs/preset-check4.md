# preset-check4.md — 2026-09-15

osMatchCount(개수) / envScore OS항 제거 / scopeScore inAppPlatforms 기반 재정의 후 검증

변경 비교 기준: preset-check3.md

## P1 · 최소 응답

기능: `notify-entry|path-guide|visual-demotion`  ← 이전과 동일
앱:   12_SZ / 1_S / 4_A  ← 이전과 동일

상위 5개 점수 (OS|C|S|E|Sc|B):
  `12_SZ`  OS2|C2|S1|E3|Sc1|B2
  `1_S`  OS2|C1|S1|E3|Sc1|B1
  `4_A`  OS2|C1|S1|E3|Sc1|B0
  `2_SF`  OS2|C0|S1|E3|Sc1|B2
  `9_WH`  OS2|C0|S1|E3|Sc1|B2

## P2 · 전부 수용

기능: `mission-exercise|mission-capture|mission-simple`  ← 이전과 동일
앱:   2_SF / 12_SZ / 4_A  ← 이전과 동일

상위 5개 점수 (OS|C|S|E|Sc|B):
  `2_SF`  OS2|C2|S1|E3|Sc1|B2
  `12_SZ`  OS2|C1|S1|E3|Sc1|B2
  `4_A`  OS2|C1|S1|E3|Sc1|B0
  `9_WH`  OS2|C0|S1|E3|Sc1|B2
  `1_S`  OS2|C0|S1|E3|Sc1|B1

## P3 · 전부 과함

기능: `mission-exercise|mission-capture|mission-simple`  ← 이전과 동일
앱:   2_SF / 12_SZ / 4_A  ← 이전과 동일

상위 5개 점수 (OS|C|S|E|Sc|B):
  `2_SF`  OS2|C2|S1|E3|Sc1|B2
  `12_SZ`  OS2|C1|S1|E3|Sc1|B2
  `4_A`  OS2|C1|S1|E3|Sc1|B0
  `9_WH`  OS2|C0|S1|E3|Sc1|B2
  `1_S`  OS2|C0|S1|E3|Sc1|B1

## P4 · 완전 차단

기능: `block-app|block-content|block-scroll`  ← 이전과 동일
앱:   2_SF / 1_S / 12_SZ  ← 이전과 동일

상위 5개 점수 (OS|C|S|E|Sc|B):
  `2_SF`  OS2|C2|S1|E3|Sc1|B2
  `1_S`  OS2|C2|S1|E3|Sc1|B1
  `12_SZ`  OS2|C1|S1|E3|Sc1|B2
  `9_WH`  OS2|C1|S1|E3|Sc1|B2
  `4_A`  OS2|C0|S1|E3|Sc1|B0

## P5 · 평가 최소

기능: `confirm|mission-exercise|mission-capture`  ← 이전과 동일
앱:   4_A / 12_SZ / 2_SF  ← 이전과 동일

상위 5개 점수 (OS|C|S|E|Sc|B):
  `4_A`  OS2|C2|S1|E3|Sc1|B0
  `12_SZ`  OS2|C1|S1|E3|Sc1|B2
  `2_SF`  OS2|C1|S1|E3|Sc1|B2
  `9_WH`  OS2|C0|S1|E3|Sc1|B2
  `1_S`  OS2|C0|S1|E3|Sc1|B1

## P6 · 지원 없는 환경

기능: `path-guide|visual-demotion|notify-entry`  ← 이전과 동일
앱:   12_SZ / 1_S / 13_M  ← 이전과 동일

상위 5개 점수 (OS|C|S|E|Sc|B):
  `12_SZ`  OS1|C2|S1|E2|Sc1|B2
  `1_S`  OS1|C1|S1|E2|Sc1|B1
  `13_M`  OS1|C1|S1|E2|Sc1|B1
  `4_A`  OS1|C1|S1|E2|Sc1|B0
  `2_SF`  OS1|C0|S1|E2|Sc1|B2

## 전체 점수표

| 프리셋 | 앱1 | OS | C | S | E | Sc | B | 앱2 | OS | C | S | E | Sc | B | 앱3 | OS | C | S | E | Sc | B |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|P1 · 최소 응답|12_SZ|2|2|1|3|1|2|1_S|2|1|1|3|1|1|4_A|2|1|1|3|1|0|
|P2 · 전부 수용|2_SF|2|2|1|3|1|2|12_SZ|2|1|1|3|1|2|4_A|2|1|1|3|1|0|
|P3 · 전부 과함|2_SF|2|2|1|3|1|2|12_SZ|2|1|1|3|1|2|4_A|2|1|1|3|1|0|
|P4 · 완전 차단|2_SF|2|2|1|3|1|2|1_S|2|2|1|3|1|1|12_SZ|2|1|1|3|1|2|
|P5 · 평가 최소|4_A|2|2|1|3|1|0|12_SZ|2|1|1|3|1|2|2_SF|2|1|1|3|1|2|
|P6 · 지원 없는 환경|12_SZ|1|2|1|2|1|2|1_S|1|1|1|2|1|1|13_M|1|1|1|2|1|1|