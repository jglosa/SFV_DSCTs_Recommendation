# preset-check.md — 2026-09-14

> 코드로 recommend() 를 직접 호출한 결과. 화면 조작 없음.

## 1. 반영 확인

- PRESETS 개수: **6개** (P1~P6)
- PRESETS 이름: P1 · 최소 응답 / P2 · 전부 수용 / P3 · 전부 과함 / P4 · 완전 차단 / P5 · 평가 최소 / P6 · 지원 없는 환경
- 주입 후 결과 화면 이동: injectPreset() 내 findIndex(c=>c.type==='result') → onJump 호출 ✓
- activePreset 표시: useState(null) + sc-tiny span 에서 "현재: {activePreset}" 렌더링 ✓

## 2. 여섯 세트 결과

### P1 · 최소 응답

**아키타입:** `supported_At`

**추천 기능 3개:**

| # | id | level | G | 앱 수 |
|---|---|---|---|---|
| 1 | notify-entry | L1 | G1 | 4 |
| 2 | path-guide | L3 | G7 | 3 |
| 3 | visual-demotion | L2 | G7 | 4 |

**추천 앱 3개:**

| # | id | C/S/E/Sc/B | scope지원 | os | inAppPlatforms | schedule | bypass |
|---|---|---|---|---|---|---|---|
| 1 | 12_SZ | 2/1/5/1/2 | 1 | android,ios | YouTube,Instagram,Facebook | ○ | lock-settings,prevent-uninstall |
| 2 | 16_UT | 2/1/2/1/1 | 1 | ios | YouTube | ○ | lock-settings |
| 3 | 17_NL | 2/0/2/1/1 | 0 | ios | — | ○ | lock-settings |

### P2 · 전부 수용

**아키타입:** `flexible_At`

**추천 기능 3개:**

| # | id | level | G | 앱 수 |
|---|---|---|---|---|
| 1 | mission-exercise | L9 | G1 | 2 |
| 2 | mission-capture | L8 | G1 | 3 |
| 3 | mission-simple | L8 | G1 | 2 |

**추천 앱 3개:**

| # | id | C/S/E/Sc/B | scope지원 | os | inAppPlatforms | schedule | bypass |
|---|---|---|---|---|---|---|---|
| 1 | 2_SF | 2/4/5/1/2 | 4 | android,ios | YouTube,Instagram,Snapchat | ○ | lock-settings,prevent-uninstall |
| 2 | 20_J | 2/1/2/1/2 | 1 | ios | — | ○ | lock-settings,prevent-uninstall |
| 3 | 12_SZ | 1/3/5/1/2 | 3 | android,ios | YouTube,Instagram,Facebook | ○ | lock-settings,prevent-uninstall |

### P3 · 전부 과함

**아키타입:** `flexible_InUse`

**추천 기능 3개:**

| # | id | level | G | 앱 수 |
|---|---|---|---|---|
| 1 | mission-exercise | L9 | G5 | 2 |
| 2 | mission-capture | L8 | G5 | 3 |
| 3 | mission-simple | L8 | G5 | 2 |

**추천 앱 3개:**

| # | id | C/S/E/Sc/B | scope지원 | os | inAppPlatforms | schedule | bypass |
|---|---|---|---|---|---|---|---|
| 1 | 2_SF | 2/1/5/1/2 | 1 | android,ios | YouTube,Instagram,Snapchat | ○ | lock-settings,prevent-uninstall |
| 2 | 20_J | 2/0/2/1/2 | 0 | ios | — | ○ | lock-settings,prevent-uninstall |
| 3 | 12_SZ | 1/1/5/1/2 | 1 | android,ios | YouTube,Instagram,Facebook | ○ | lock-settings,prevent-uninstall |

### P4 · 완전 차단

**아키타입:** `limited_InUse`

**추천 기능 3개:**

| # | id | level | G | 앱 수 |
|---|---|---|---|---|
| 1 | block-scroll | L10 | G1 | 3 |
| 2 | mission-exercise | L9 | G7 | 2 |
| 3 | mission-capture | L8 | G7 | 3 |

**추천 앱 3개:**

| # | id | C/S/E/Sc/B | scope지원 | os | inAppPlatforms | schedule | bypass |
|---|---|---|---|---|---|---|---|
| 1 | 20_J | 2/1/2/1/2 | 1 | ios | — | ○ | lock-settings,prevent-uninstall |
| 2 | 2_SF | 1/4/5/1/2 | 4 | android,ios | YouTube,Instagram,Snapchat | ○ | lock-settings,prevent-uninstall |
| 3 | 5_N | 1/3/4/0/1 | 3 | android | YouTube,Instagram,Facebook,TikTok | — | lock-settings |

### P5 · 평가 최소

**아키타입:** `flexible_At`

**추천 기능 3개:**

| # | id | level | G | 앱 수 |
|---|---|---|---|---|
| 1 | confirm | L4 | G1 | 3 |
| 2 | mission-exercise | L9 | G7 | 2 |
| 3 | mission-capture | L8 | G7 | 3 |

**추천 앱 3개:**

| # | id | C/S/E/Sc/B | scope지원 | os | inAppPlatforms | schedule | bypass |
|---|---|---|---|---|---|---|---|
| 1 | 4_A | 2/1/5/1/0 | 1 | android,ios | Instagram,YouTube,Snapchat,Facebook | ○ | — |
| 2 | 20_J | 2/0/2/1/2 | 0 | ios | — | ○ | lock-settings,prevent-uninstall |
| 3 | 18_CR | 2/0/2/0/0 | 0 | ios | — | — | — |

### P6 · 지원 없는 환경

**아키타입:** `supported_Pre`

**추천 기능 3개:**

| # | id | level | G | 앱 수 |
|---|---|---|---|---|
| 1 | path-guide | L3 | G1 | 3 |
| 2 | visual-demotion | L2 | G1 | 4 |
| 3 | notify-entry | L1 | G1 | 4 |

**추천 앱 3개:**

| # | id | C/S/E/Sc/B | scope지원 | os | inAppPlatforms | schedule | bypass |
|---|---|---|---|---|---|---|---|
| 1 | 12_SZ | 2/1/3/1/2 | 1 | android,ios | YouTube,Instagram,Facebook | ○ | lock-settings,prevent-uninstall |
| 2 | 16_UT | 2/1/1/1/1 | 1 | ios | YouTube | ○ | lock-settings |
| 3 | 17_NL | 2/0/1/1/1 | 0 | ios | — | ○ | lock-settings |

## 3. 규칙 확인

### P1 최소 응답 규칙

- G1 이 L1 하나인지: **O** (G1 rows: L1)
- 2번째 기능: path-guide (G7, L3)
- 3번째 기능: visual-demotion (G7, L2)

### P2 전부 수용 규칙

- G1 후보 개수: **8개** (기대: 8)
  - G1 rows: L9, L8, L7, L6, L5, L4
  - 후보 ids: mission-exercise, mission-altapp, mission-capture, mission-simple, mission-hold, intention-input, timed-wait, confirm
- 추천 기능: mission-exercise(L9), mission-capture(L8), mission-simple(L8)
- 레벨 순서: 9→8→8 (기대: 9→8→8 or 9→8→7)
- L8 항목: mission-capture, mission-simple (기대: 촬영(mission-capture,n=3) > 간단(mission-simple,n=2) > 대체(mission-altapp,n=1))

### P3 전부 과함 규칙

- 등급 분포: G5×6 G6×3 G7×1
- G1~G4 비어 있는지: **O**
- 1번째 기능 (최고 등급): mission-exercise (G5, L9)
- L4 (flexible, G5) timingRank=[InUse,At,Pre]:
  - itemsForLevel → interrupt(InUse) (기대: interrupt(InUse))
- L10 (limited) 등급: G7 (기대: G7)

### P4 완전 차단 규칙

- L10 analyzeLevel (scopes=[app,shorts-row,shorts-tab,content], timing=[InUse,At,Pre]):
  - ✗ block-app(At, scope=[app]) [timing 밀림]
  - ✗ block-shortform(At, scope=[shorts-row,shorts-tab]) [timing 밀림]
  - ✗ block-content(At, scope=[content]) [timing 밀림]
  - ✗ block-entry(Pre, scope=[shorts-row,shorts-tab]) [timing 밀림]
  - ✓ block-scroll(InUse, scope=[shorts-row,shorts-tab])
  - fallback: none
- 살아남은 항목: block-scroll
- 추천된 기능: block-scroll(L10,G1), mission-exercise(L9,G7), mission-capture(L8,G7)

### P5 평가 최소 규칙

- supported 가 G7 인지: **O** (grades: L3:G7, L2:G7, L1:G7)
- flexible L5~L9 가 G7 인지: **O**
- G7 agency 순서 (gradeTable): flexible → supported → limited (기대: flexible → supported → limited)
- G7 첫 번째 행: L9 flexible
- 추천 기능: confirm(G1,L4,flexible), mission-exercise(G7,L9,flexible), mission-capture(G7,L8,flexible)

### P6 지원 없는 환경 규칙

- visual-demotion 추천 여부: **O** (추천 기능: path-guide, visual-demotion, notify-entry)
- visual-demotion coverage: n=4, ios=4, android=0

- 추천 앱 3개 모두 Android 지원 여부: **X**
  - 1. 12_SZ (os=[android,ios])
  - 2. 16_UT (os=[ios])
  - 3. 17_NL (os=[ios])

## 4. 전체 등급표 (디버그용)

### P1 · 최소 응답 — 등급표

| G | L | agency | rank | answer | decideParams | fallback | items(passed) |
|---|---|---|---|---|---|---|---|
| G1 | L1 | supported | 0 | ok | "timing" | — | notify-entry(At)★ |
| G7 | L3 | supported | 0 | — | null | — | path-guide(Pre)★ |
| G7 | L2 | supported | 0 | — | null | — | visual-demotion(Pre)★ |
| G7 | L9 | flexible | 1 | — | null | — | mission-exercise(At) |
| G7 | L8 | flexible | 1 | — | null | — | mission-altapp(At), mission-capture(At), mission-simple(At) |
| G7 | L7 | flexible | 1 | — | null | — | mission-hold(At) |
| G7 | L6 | flexible | 1 | — | null | — | intention-input(At) |
| G7 | L5 | flexible | 1 | — | null | — | timed-wait(At) |
| G7 | L4 | flexible | 1 | — | "timing" | — | confirm(At) |
| G7 | L10 | limited | 2 | — | ["timing","scope"] | — | block-shortform(At) |

### P2 · 전부 수용 — 등급표

| G | L | agency | rank | answer | decideParams | fallback | items(passed) |
|---|---|---|---|---|---|---|---|
| G1 | L9 | flexible | 0 | ok | null | — | mission-exercise(At)★ |
| G1 | L8 | flexible | 0 | ok | null | — | mission-altapp(At), mission-capture(At)★, mission-simple(At)★ |
| G1 | L7 | flexible | 0 | ok | null | — | mission-hold(At) |
| G1 | L6 | flexible | 0 | ok | null | — | intention-input(At) |
| G1 | L5 | flexible | 0 | ok | null | — | timed-wait(At) |
| G1 | L4 | flexible | 0 | ok | "timing" | — | confirm(At) |
| G7 | L10 | limited | 1 | — | ["timing","scope"] | — | block-app(At), block-shortform(At), block-content(At) |
| G7 | L3 | supported | 2 | — | null | — | path-guide(Pre) |
| G7 | L2 | supported | 2 | — | null | — | visual-demotion(Pre) |
| G7 | L1 | supported | 2 | — | "timing" | — | notify-entry(At) |

### P3 · 전부 과함 — 등급표

| G | L | agency | rank | answer | decideParams | fallback | items(passed) |
|---|---|---|---|---|---|---|---|
| G5 | L9 | flexible | 0 | strong | null | — | mission-exercise(At)★ |
| G5 | L8 | flexible | 0 | strong | null | — | mission-altapp(At), mission-capture(At)★, mission-simple(At)★ |
| G5 | L7 | flexible | 0 | strong | null | — | mission-hold(At) |
| G5 | L6 | flexible | 0 | strong | null | — | intention-input(At) |
| G5 | L5 | flexible | 0 | strong | null | — | timed-wait(At) |
| G5 | L4 | flexible | 0 | strong | "timing" | — | interrupt(InUse) |
| G6 | L3 | supported | 1 | strong | null | — | path-guide(Pre) |
| G6 | L2 | supported | 1 | strong | null | — | visual-demotion(Pre) |
| G6 | L1 | supported | 1 | strong | "timing" | — | notify-usage(InUse) |
| G7 | L10 | limited | 2 | — | ["timing","scope"] | — | block-scroll(InUse) |

### P4 · 완전 차단 — 등급표

| G | L | agency | rank | answer | decideParams | fallback | items(passed) |
|---|---|---|---|---|---|---|---|
| G1 | L10 | limited | 0 | ok | ["timing","scope"] | — | block-scroll(InUse)★ |
| G7 | L9 | flexible | 1 | — | null | — | mission-exercise(At)★ |
| G7 | L8 | flexible | 1 | — | null | — | mission-altapp(At), mission-capture(At)★, mission-simple(At) |
| G7 | L7 | flexible | 1 | — | null | — | mission-hold(At) |
| G7 | L6 | flexible | 1 | — | null | — | intention-input(At) |
| G7 | L5 | flexible | 1 | — | null | — | timed-wait(At) |
| G7 | L4 | flexible | 1 | — | "timing" | — | interrupt(InUse) |
| G7 | L3 | supported | 2 | — | null | — | path-guide(Pre) |
| G7 | L2 | supported | 2 | — | null | — | visual-demotion(Pre) |
| G7 | L1 | supported | 2 | — | "timing" | — | notify-usage(InUse) |

### P5 · 평가 최소 — 등급표

| G | L | agency | rank | answer | decideParams | fallback | items(passed) |
|---|---|---|---|---|---|---|---|
| G1 | L4 | flexible | 0 | ok | "timing" | — | confirm(At)★ |
| G7 | L9 | flexible | 0 | — | null | — | mission-exercise(At)★ |
| G7 | L8 | flexible | 0 | — | null | — | mission-altapp(At), mission-capture(At)★, mission-simple(At) |
| G7 | L7 | flexible | 0 | — | null | — | mission-hold(At) |
| G7 | L6 | flexible | 0 | — | null | — | intention-input(At) |
| G7 | L5 | flexible | 0 | — | null | — | timed-wait(At) |
| G7 | L3 | supported | 1 | — | null | — | path-guide(Pre) |
| G7 | L2 | supported | 1 | — | null | — | visual-demotion(Pre) |
| G7 | L1 | supported | 1 | — | "timing" | — | notify-entry(At) |
| G7 | L10 | limited | 2 | — | ["timing","scope"] | — | block-shortform(At) |

### P6 · 지원 없는 환경 — 등급표

| G | L | agency | rank | answer | decideParams | fallback | items(passed) |
|---|---|---|---|---|---|---|---|
| G1 | L3 | supported | 0 | ok | null | — | path-guide(Pre)★ |
| G1 | L2 | supported | 0 | ok | null | — | visual-demotion(Pre)★ |
| G1 | L1 | supported | 0 | ok | "timing" | — | notify-entry(At)★ |
| G7 | L9 | flexible | 1 | — | null | — | mission-exercise(At) |
| G7 | L8 | flexible | 1 | — | null | — | mission-altapp(At), mission-capture(At), mission-simple(At) |
| G7 | L7 | flexible | 1 | — | null | — | mission-hold(At) |
| G7 | L6 | flexible | 1 | — | null | — | intention-input(At) |
| G7 | L5 | flexible | 1 | — | null | — | timed-wait(At) |
| G7 | L4 | flexible | 1 | — | "timing" | — | confirm(At) |
| G7 | L10 | limited | 2 | — | ["timing","scope"] | — | block-entry(Pre) |
