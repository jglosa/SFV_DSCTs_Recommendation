# preset-check2.md — 2026-09-14

engine 수정(OS 필터 + scope+timing 범위별 독립 처리 + items 정렬) 후 검증 결과

## P4 완전 차단 — L10 범위별 판정 과정

- scope="app": 후보=[block-app]  → timing="At" 선택=[block-app]
- scope="shorts-row": 후보=[block-shortform,block-entry,block-scroll]  → timing="InUse" 선택=[block-scroll]
- scope="shorts-tab": 후보=[block-shortform,block-entry,block-scroll]  → timing="InUse" 선택=[block-scroll]
- scope="content": 후보=[block-content]  → timing="At" 선택=[block-content]

**생존:** block-app(At), block-content(At), block-scroll(InUse)
**탈락:** block-shortform[timing 밀림], block-entry[timing 밀림]
**추천 기능:** block-app(L10,G1), block-content(L10,G1), block-scroll(L10,G1)
**추천 앱:**   2_SF(os=[android,ios]), 1_S(os=[android,ios]), 14_R(os=[android])

## P6 지원 없는 환경 — 앱 Android 지원

env.os=['android'], userMobileOs=['android']
- 앱 필터 후보: 14개 (Android 지원)
- 1. 12_SZ os=[android,ios] → Android지원: O
- 2. 1_S os=[android,ios] → Android지원: O
- 3. 13_M os=[android] → Android지원: O
- **3개 모두 Android 지원: O**
- 추천 기능: path-guide(L3,G1), visual-demotion(L2,G1), notify-entry(L1,G1)

## P1/P2/P3/P5 — 변경 전후 비교

이전 결과(preset-check.md 기준) vs 현재:

### P1·최소응답
기능: notify-entry(L1,G1) | path-guide(L3,G7) | visual-demotion(L2,G7)
앱:   12_SZ|16_UT|17_NL

### P2·전부수용
기능: mission-exercise(L9,G1) | mission-capture(L8,G1) | mission-simple(L8,G1)
앱:   2_SF|20_J|12_SZ

### P3·전부과함
기능: mission-exercise(L9,G5) | mission-capture(L8,G5) | mission-simple(L8,G5)
앱:   2_SF|20_J|12_SZ

### P5·평가최소
기능: confirm(L4,G1) | mission-exercise(L9,G7) | mission-capture(L8,G7)
앱:   4_A|20_J|18_CR

## 특수 케이스: scopes=[content], timing=[InUse,Pre,At]

scopes=['content'], timingRank=['InUse','Pre','At']
L10 후보 중 scope=[content]: block-content(At)
생존: block-content(At)  fallback:none
탈락: block-shortform[scope 불일치], block-app[scope 불일치], block-entry[scope 불일치], block-scroll[scope 불일치]
추천 기능: block-content(L10,G1), mission-exercise(L9,G7), mission-capture(L8,G7)

## 특수 케이스: os=[desktop] 만 — 앱 필터 미적용

userMobileOs=[] → 길이 0 → 필터 적용: X
앱 3개: 12_SZ(os=[android,ios]), 16_UT(os=[ios]), 17_NL(os=[ios])
에러 없이 3개 반환: O

## 등급표 items 정렬 확인 (L8 = flexible, decideParams=null, 3개 항목)

L8 analyzeLevel items 순서: mission-capture(n=3) → mission-simple(n=2) → mission-altapp(n=1)
기대: mission-capture(n=3) → mission-simple(n=2) → mission-altapp(n=1)
일치: O

## 전체 프리셋 결과표

| 프리셋 | 아키타입 | 기능1 | 기능2 | 기능3 | 앱1 | 앱2 | 앱3 |
|---|---|---|---|---|---|---|---|
|P1·최소응답|supported_At|notify-entry(L1,G1)|path-guide(L3,G7)|visual-demotion(L2,G7)|12_SZ[android+ios]|16_UT[ios]|17_NL[ios]|
|P2·전부수용|flexible_At|mission-exercise(L9,G1)|mission-capture(L8,G1)|mission-simple(L8,G1)|2_SF[android+ios]|20_J[ios]|12_SZ[android+ios]|
|P3·전부과함|flexible_InUse|mission-exercise(L9,G5)|mission-capture(L8,G5)|mission-simple(L8,G5)|2_SF[android+ios]|20_J[ios]|12_SZ[android+ios]|
|P4·완전차단|limited_InUse|block-app(L10,G1)|block-content(L10,G1)|block-scroll(L10,G1)|2_SF[android+ios]|1_S[android+ios]|14_R[android]|
|P5·평가최소|flexible_At|confirm(L4,G1)|mission-exercise(L9,G7)|mission-capture(L8,G7)|4_A[android+ios]|20_J[ios]|18_CR[ios]|
|P6·지원없는환경|supported_Pre|path-guide(L3,G1)|visual-demotion(L2,G1)|notify-entry(L1,G1)|12_SZ[android+ios]|1_S[android+ios]|13_M[android]|
