# preset-check3.md — 2026-09-14

osFullScore(OS 완전 지원) 추가 후 검증

## P1 추천 앱 변경 확인

1. 12_SZ(ScreenZen)  os=[android,ios]  osFullScore=1  coverageScore=2  iOS+Android양쪽:O
2. 1_S(StayFree)  os=[android,ios]  osFullScore=1  coverageScore=1  iOS+Android양쪽:O
3. 4_A(Ascent)  os=[android,ios]  osFullScore=1  coverageScore=1  iOS+Android양쪽:O
앱 목록: 12_SZ / 1_S / 4_A
기대:    12_SZ / 1_S / 4_A
일치: O

## P6 Android 결과 유지 확인

1. 12_SZ  os=[android,ios]  osFullScore=1  Android:O
2. 1_S  os=[android,ios]  osFullScore=1  Android:O
3. 13_M  os=[android]  osFullScore=1  Android:O
이전과 동일: O

## os=[desktop] — osFullScore 모두 1 확인

userMobileOs=[] → 전체 21개 앱 모두 osFullScore=1: O
추천 앱 3개: 12_SZ(OS1), 16_UT(OS1), 17_NL(OS1)
에러 없이 3개 반환: O

## P2/P3/P4/P5 — 변경 여부

### P2·전부수용
기능: 동일  mission-exercise|mission-capture|mission-simple
앱:   **변경**  2_SF(OS1|C2) / 12_SZ(OS1|C1) / 4_A(OS1|C1)
  이전: 2_SF|20_J|12_SZ

### P3·전부과함
기능: 동일  mission-exercise|mission-capture|mission-simple
앱:   **변경**  2_SF(OS1|C2) / 12_SZ(OS1|C1) / 4_A(OS1|C1)
  이전: 2_SF|20_J|12_SZ

### P4·완전차단
기능: 동일  block-app|block-content|block-scroll
앱:   **변경**  2_SF(OS1|C2) / 1_S(OS1|C2) / 12_SZ(OS1|C1)
  이전: 20_J|2_SF|5_N

### P5·평가최소
기능: 동일  confirm|mission-exercise|mission-capture
앱:   **변경**  4_A(OS1|C2) / 12_SZ(OS1|C1) / 2_SF(OS1|C1)
  이전: 4_A|20_J|18_CR

## 전체 프리셋 기능 추천 — 변경 없음 확인

P1·최소응답: 동일  notify-entry|path-guide|visual-demotion
P2·전부수용: 동일  mission-exercise|mission-capture|mission-simple
P3·전부과함: 동일  mission-exercise|mission-capture|mission-simple
P4·완전차단: 동일  block-app|block-content|block-scroll
P5·평가최소: 동일  confirm|mission-exercise|mission-capture
P6·지원없는환경: 동일  path-guide|visual-demotion|notify-entry

## 전체 프리셋 앱 점수표

| 프리셋 | 앱1 | OS1 | C1 | 앱2 | OS2 | C2 | 앱3 | OS3 | C3 |
|---|---|---|---|---|---|---|---|---|---|
|P1·최소응답|12_SZ|1|2|1_S|1|1|4_A|1|1|
|P2·전부수용|2_SF|1|2|12_SZ|1|1|4_A|1|1|
|P3·전부과함|2_SF|1|2|12_SZ|1|1|4_A|1|1|
|P4·완전차단|2_SF|1|2|1_S|1|2|12_SZ|1|1|
|P5·평가최소|4_A|1|2|12_SZ|1|1|2_SF|1|1|
|P6·지원없는환경|12_SZ|1|2|1_S|1|1|13_M|1|1|