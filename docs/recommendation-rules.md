# 추천 규칙 문서 — sfv-dsct-recommend

> 이 문서는 **코드에 구현된 실제 동작**을 기록한다.
> 설계 의도(`CLAUDE.md`)와 어긋난 곳은 §5에 별도 정리했다.
> apps.json v1.2 기준.

---

## §1. 파일과 함수 지도

| 파일 | 주요 역할 |
|---|---|
| `src/engine.js` | 추천 메인 로직. `recommend(state)` 단일 진입점. |
| `src/store.js` | 상태 스키마(`initialState`), 셀렉터, `resolveRungCode` |
| `src/data/features.js` | `features.json` 어댑터. LADDER·FEATURES·BYPASS_TARGETS 등 |
| `src/data/features.json` | 기능 DB 단일 진실 공급원 (이 문서에서 직접 인용하지 않음) |
| `src/data/apps.js` | 앱 DB (`APPS` 배열) |

### engine.js 함수 호출 구조

```
recommend(state)
  ├─ resolveArchetype(state)          → ARCHETYPE_MAP 룩업
  ├─ buildFeaturePicks(state, trace)  → 기능 3개
  │    ├─ rungGrade(rung, state)      → G1~G9 등급 결정
  │    ├─ makeSortFn(rungs)           → 등급 내 정렬 팩토리
  │    ├─ sortByAgencyRank(...)       → G7~G9 전용 정렬
  │    └─ resolveRungToItems(rung)    → rung → { code, scope, taskGroup, key }
  │         └─ resolveRungCode(...)   → store.js, feature 코드 결정
  ├─ buildAppPicks(state, codes, trace) → 앱 3개
  │    └─ computeAppScore(app, state, codes) → 5점수
  ├─ buildWarnings(state, apps, trace) → warnings + envGaps
  └─ buildRationale(featureItems, apps) → 한국어 서술
```

---

## §2. 기능 추천 흐름

### 2-1. 아키타입 결정 (`resolveArchetype`)

`engine.js:79–84`

- 입력: `state.agencyRank[0]` × `state.timingRank[0]`
- 출력: `ARCHETYPE_MAP` 에서 일치하는 항목 (`code`, `tagline`, `body`)
- 9가지 조합 (`supported/flexible/limited` × `Pre/At/InUse`) + `_default` 폴백
- `agencyRank` 또는 `timingRank` 가 비어 있으면 → `_default` ("자기통제 탐색형")

### 2-2. 후보 등급 부여 (`rungGrade`)

`engine.js:142–170`

LADDER의 각 rung에 G1~G9 등급을 매긴다.

**등급 결정 기준**

| 등급 | 조건 |
|---|---|
| **G1** | `agencyRank[0]` 일치 + `featureAccepted='ok'` — 또는 1순위가 `limited` |
| **G2** | `agencyRank[0]` 일치 + `featureAccepted='weak'` |
| **G3** | `agencyRank[1]` 일치 + `featureAccepted='ok'` |
| **G4** | `agencyRank[1]` 일치 + `featureAccepted='weak'` |
| **G5** | `agencyRank[2]` 일치 + `featureAccepted='ok'` |
| **G6** | `agencyRank[2]` 일치 + `featureAccepted='weak'` |
| **G7** | `oxStatus='skipped'` — 또는 `limited`가 2·3순위 (OX 근거 없음) |
| **G8** | `oxStatus='unvisited'` (아직 탐색하지 않은 agency) |
| **G9** | `featureAccepted='strong'` (명시적 거부) — 레벨 순위와 무관하게 최하위 |

**`featureAccepted` 값 출처**

- 참가자가 S4(개입 강도) 카드에서 기능 항목마다 '약해요(weak)' / '괜찮아요(ok)' / '너무 강해요(strong)'를 선택 → `state.featureAccepted[rungId]` 에 저장
- `limited` agency는 OX를 받지 않는다. 참가자가 1순위로 선택한 경우에만 G1, 나머지는 G7

**`exploreVisible=false` 처리** (`findParentRung`, `engine.js:108–119`)

- `L8+capture`, `L8+altapp` 등 일부 rung은 탐색 화면에 노출되지 않는다.
- 이 rung의 등급은 같은 `agency·order`를 공유하는 `exploreVisible=true` 부모 rung 기준으로 결정.
- 단, 정렬 점수는 자기 자신의 `coverage.n` 사용 (의도된 불일치, `engine.js:183–188` 주석 참조).

### 2-3. 등급 내 정렬 (`makeSortFn`, `sortByAgencyRank`)

`engine.js:189–226`

**G1~G6 정렬 (등급 자체가 agency를 특정)**

```
score = 0.6 × (rung.order / maxOrder)
      + 0.4 × (rung.coverage.n / maxCoverage)
```

점수 내림차순 → 동점 시 `order` 내림차순 → `id` 오름차순

**G7~G9 정렬 (`sortByAgencyRank`)**

1. `agencyRank` 순서로 agency 묶기 (없는 agency는 맨 뒤)
2. 각 agency 그룹 안에서 위 가중합 정렬

### 2-4. 기능 3개 확정 (`buildFeaturePicks`)

`engine.js:275–312`

1. LADDER 전체 rung에 등급 부여
2. G1→G2→…→G9 순으로 순회하면서 후보 배열 쌓기
3. 중복 키(`code|scope|taskGroup`) 제거
4. 3개가 채워지면 더 낮은 등급은 건너뜀
5. §8 규칙: 3개 미만은 데이터 오류이며 `console.error`로 보고되고 `trace`에 실패 rung이 기록된다

### 2-5. feature 코드 결정 (`resolveRungCode`)

`store.js:174–222`

rung의 `resolveBy` 값에 따라 feature 코드가 달라진다.

| `resolveBy` | 동작 |
|---|---|
| `null` (또는 없음) | `rung.resolve.fixed` → 단일 코드 반환 |
| `'timing'` | `resolve.byTiming[timingRank[0]]` 순으로 첫 일치. 없으면 `resolve.default` |
| `'scope+timing'` | `state.scopes` 각 항목에 대해: `byScope[scope].any` 우선, 없으면 `byTiming[timingRank[i]]`, 없으면 `entry.default` 또는 전체 `default`. 코드 배열 반환 |

실패 시 예외를 던짐 (조용히 폴백하지 않음).

---

## §3. 앱 추천 흐름

### 3-1. 5점수 계산 (`computeAppScore`)

`engine.js:318–368`

| 점수 필드 | 계산 방법 |
|---|---|
| `coverageScore` | 추천된 기능 코드 중 앱이 `features` 배열에 갖고 있는 수 |
| `scopeScore` | `env.platforms` × `state.scopes` 조합별로: `app.scope[platform][scope]='full'` → +2, `'partial'` → +1 |
| `envScore` | OS 교집합(+1/개) + 경로 일치(+1/경로) + `inAppPlatforms` 교집합(+1/개) + desktop+PC 보너스(+1) |
| `scheduleScore` | `dayType='daily'` 또는 `'split'` 이고 앱이 기능 `1.2.1` 지원 → 1, 아니면 0 |
| `bypassScore` | `bypassWanted[Bk]=true` 항목 중 `app.bypassSupport[Bk]=true` 인 수 |

**bypassSupport 지원 앱 수 (apps.json v1.2)**

| 시나리오 | 설명 | 지원 앱 수 |
|---|---|---|
| B1 (설정 변경 우회) | 개입 앱 설정을 직접 변경 | 13개 |
| B2 (OS 설정 우회) | 기기 날짜·시각 변경으로 차단 우회 | **2개** (2_SF, 20_J) |
| B3 (앱 삭제 우회) | 차단 앱 삭제 후 재설치 | 7개 |
| B4 (PIP 우회) | PIP·분할화면으로 우회 시청 | 3개 |

이전 `BYPASS_FEAT_MAP`은 기능 코드(`4.1.1` 등)를 매핑해 B2에 12개 앱이 점수를 받았으나, apps.json v1.2의 `bypassSupport` 필드로 교체해 정확히 2개만 받는다.

### 3-2. 앱 3개 확정 (`buildAppPicks`)

`engine.js:375–401`

정렬 우선순위: `coverageScore↓ → scopeScore↓ → envScore↓ → scheduleScore↓ → bypassScore↓ → id↑`

상위 3개 반환. §8 규칙: 점수가 낮아도 3개 채움.

**경로 정규화** (`engine.js:87–90`)

`env.route` 한국어 값을 앱 DB 키와 맞춤: `'앱'→'app'`, `'웹브라우저'→'web'`

---

## §4. 상태 필드 → 추천 사용 대응표

| 상태 필드 | 기능 추천 | 앱 추천 | 경고/갭 | 아키타입 | 비고 |
|---|---|---|---|---|---|
| `env.os` | — | `envScore` (+1/OS 일치) | OS 갭 감지 | — | |
| `env.platforms` | — | `scopeScore`, `envScore` | 플랫폼 갭 감지 | — | |
| `env.route` | — | `envScore` | — | — | 한국어→'app'/'web' 변환 |
| `env.devices` | — | `envScore` (+1 desktop+PC) | — | — | |
| `scopes` | `resolveRungCode` 입력 | `scopeScore` 계산 | content 경고 | — | |
| `timingRank` | `resolveRungCode` 입력 | — | — | `timingRank[0]` | |
| `agencyRank` | 등급 G1~G6 기준, G7~G9 정렬 | — | — | `agencyRank[0]` | |
| `featureAccepted` | rung 등급 G1~G6·G9 결정 | — | — | — | |
| `oxSkipped` | → `oxStatus='skipped'` → G7 | — | — | — | |
| `dayType` | — | `scheduleScore` | — | — | 'daily'/'split'만 반응 |
| `bypassWanted` | — | `bypassScore` (tie-break) | — | — | `profile.blockedBypass`에도 복사 |
| `bypassScenario` | **미사용** | **미사용** | **미사용** | — | 분석 전용 (§5 참조) |
| `bypassMethods` | **미사용** | **미사용** | **미사용** | — | 분석 전용 (§5 참조) |
| `hours` | **미사용** | **미사용** | **미사용** | — | 분석 전용 (§5 참조) |
| `timingSeen` | **미사용** | **미사용** | **미사용** | — | 분석 전용 (§5 참조) |
| `agencyVisited` | **미사용** | **미사용** | **미사용** | — | 로그 전용 (§5 참조) |
| `simsPlayed` | **미사용** | **미사용** | **미사용** | — | 로그 전용 (§5 참조) |
| `envOther` | **미사용** | **미사용** | **미사용** | — | 분석 전용 (§5 참조) |

---

## §5. 설계 의도와 구현 사이의 주목할 점

### 5-1. 의도적 미사용 필드

아래 필드는 **추천 계산에 쓰지 않도록 설계된 것**이며, 코드 버그가 아니다.

- `bypassScenario`: `store.js:34` 주석 "분석용, 추천 계산 미사용"
- `bypassMethods`: `store.js:35` 주석 동일
- `agencyVisited`, `simsPlayed`: `store.js:29-30` 주석 "로그용"
- `CLAUDE.md §3`: Continuous 기능은 추천 슬롯이 아니라 tie-break — `protections: []` 반환

### 5-2. `hours`, `timingSeen` 미사용

이 두 필드는 S2(시계 카드)·S3(시뮬레이션 진행)에서 수집되지만, `recommend()` 내 어디서도 참조하지 않는다. `dayType`만 `scheduleScore`에 사용된다.

- `hours`: 원형 시계로 선택한 구간. 추천 앱에 시간대 설정 기능이 있는지는 체크하지 않음 (scheduleScore는 기능 지원 여부만 확인).
- `timingSeen`: S3에서 어떤 시뮬을 실제 화면에서 본 기록. 분석용.

`scheduleNeeded`는 코드에서 한 번도 SET되지 않아(`initialState: null`에서 변하지 않음) `dayType`이 단독 진실 공급원임이 확인됐고, 중복 필드로 store.js에서 제거했다.

### 5-3. `envOther` 미사용

S0에서 "기타" 기기·경로를 주관식으로 입력한 경우 `envOther`에 저장된다. 추천 계산에는 반영되지 않는다. 오픈 응답 분석 전용.

### 5-4. `agencyRank` 3순위까지 실제로 쓰인다

`agencyRank`는 `[flexible, supported, limited]` 같은 3개 배열이다. G1~G6가 각각 1·2·3순위를 구분해 사용한다(`rungGrade`, `engine.js:151–159`). 3순위 agency의 `'ok'` rung은 G5, `'weak'`는 G6가 된다. 후보가 부족할 때 실제로 끌어올려질 수 있다.

### 5-5. `limited` agency는 OX를 거치지 않는다

`oxTargets(state)` (`store.js:108–122`) 가 `limited`를 명시적으로 제외한다. 따라서 `limited` rung은 `featureAccepted` 값이 생기지 않는다. `rungGrade`에서 `agencyRank[0]=limited`이면 G1, `agencyRank[1]=limited`이면 G7로 직행한다(`engine.js:158`).

### 5-6. 기능 코드 중복 제거 단위

중복 키는 `code|scope|taskGroup` 3-tuple로 판단한다(`recommendationKey`, `store.js:229–231`). 예를 들어 `1.1.2` 기능은 scope(`app-tab`, `content` 등)에 따라 별도 이름과 설명을 가지므로, 같은 코드라도 scope가 다르면 별개 추천 슬롯을 차지할 수 있다.

---

## §6. 반환 구조 (`recommend()` 출력)

`engine.js:535–569`

```js
{
  features: [{ code, nameKo, descKo, agency, order, scope, taskGroup, grade }],  // 기능 3개
  picks: features,      // ResultCard 하위 호환 별칭

  apps: [{ ...appData, coverageScore, scopeScore, envScore, scheduleScore, bypassScore }],  // 앱 3개
  appRecs: apps,        // 하위 호환 별칭

  archetype: { code, tagline, body },

  rationale: {
    features: [{ code, nameKo, reason }],
    apps:     [{ id, shortName, reason }],
  },

  envGaps:  [{ code, reason }],  // OS·플랫폼 갭
  warnings: [{ title, body }],   // content 범위 경고 등

  trace:    [{ rule, detail }],  // 판정 과정 로그

  // ResultCard 하위 호환 스텁
  resistanceLabel: { B1: ..., B2: ..., ... },
  params: {},
  profile: { topWhen, whenRank, agency, scopes, blockedBypass },
  protections: [],   // Continuous는 여기 없음 (§3 CLAUDE.md)
}
```

---

*최종 갱신: 2026-09-08 → 2026-09-08 (apps.json v1.2: bypassSupport 필드 적용, scheduleNeeded 제거, 3개 미만 error 보고)*
