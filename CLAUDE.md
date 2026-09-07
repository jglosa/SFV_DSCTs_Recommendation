# CLAUDE.md — sfv-elicit-demo

숏폼 비디오 과사용을 다루는 디지털 자기통제 도구(DSCT)에 대한 사용자 선호를
유도하는 연구용 프로토타입. 설문을 숏폼 사용 환경 안으로 집어넣는 것이 방법론적 주장이다.

---

## 절대 바꾸면 안 되는 설계 결정

### 1. "다음" 버튼 없음

**무엇을:** `Deck.jsx`의 `cards` state는 초기에 첫 카드 1개만 담긴다 (`useState(() => [{ ...script[0], cid: 'c0' }])`, line 46). 답이 들어오면 `useEffect`(line 89)가 마지막 카드의 `answered` 상태를 감지해 `pushNextFromScript()`로 카드를 append한다.

**왜:** 스크롤로 답하고 스크롤로 넘어가는 흐름 자체가 "설문을 숏폼 환경 안에 집어넣는다"는 방법론적 주장이다.

**어기면:** 버튼을 추가하면 scroll-snap 피드와 설문지가 분리된다. in-context 유도의 이점이 사라지고 연구 주장이 무너진다.

---

### 2. 카드는 답한 뒤에만 append된다

**무엇을:** `Deck.jsx:89-96`의 `useEffect`가 `answered`와 `cards.length`를 watch한다. 마지막 카드(`cards[cards.length - 1]`)가 `answered[last.cid]`인 경우에만 다음 카드를 append한다. 전체 스크립트(`script`)는 `deck.js`의 `buildScript()`로 메모리에 있지만, DOM에는 존재하지 않는다.

**왜:** 스크롤을 막는 것이 아니라 넘길 대상이 아직 없는 방식이다 (`Deck.jsx:26` 주석). `ScopeShortsCard`처럼 선택이 필수가 아닌 카드는 마운트 시 즉시 `onAnswer(true)`를 호출해(`Cards.jsx:149-151`) 다음 카드를 미리 생성한다 — 이 패턴은 게이팅 원칙의 예외가 아니라 "답 없이 넘길 수 있는 카드"를 구현하는 방법이다.

**어기면:** 전체 카드 배열을 미리 DOM에 만들어두면 참가자가 아직 답하지 않은 카드를 스크롤로 건너뛸 수 있게 된다.

---

### 3. Continuous는 개입 시점이 아니라 tie-break 신호다

**무엇을:** `features.js:151` 주석과 f10~f13의 `when: 'Continuous'`가 이를 선언한다. `engine.js:86`에서 일반 추천 후보를 만들 때 `f.when !== 'Continuous'`로 명시적으로 제외한다. S5 우회 응답(`blockedBypass`)은 보호층 기능을 직접 추천하는 데 쓰이지 않는다 — 앱 후보가 3개를 초과할 때 `resistance` 필드 일치 여부로 tie-break 우선순위를 조정하는 데만 사용된다. `Intervention.jsx:5` 주석에도 "Continuous는 여기 없음"이라고 명시되어 있다.

**왜:** Continuous는 개입 타이밍이 아니라 설정 위에 얹히는 우회 방지 속성이다. 시점 컬럼(Pre / At / InUse)에 추가하면 분류 체계가 틀린다. S5 답으로 별도 보호층 기능을 생성하면 추천 로직이 두 갈래로 갈라져 결과 해석이 어려워진다.

**어기면:** `VARIANTS`에 `Continuous` 항목을 추가하면 오버레이가 뜨려 한다. S5 답을 독립적인 추천 근거로 쓰면 "앱이 3개를 넘을 때만 쓰인다"는 단순한 계약이 깨진다.

---

### 4. 시뮬레이션 전에 어느 시점의 개입인지 명시한다

**무엇을:** `Cards.jsx`의 `SIM_META` 객체(Pre/At/InUse)에 `badge`(시점명), `desc`(한 줄 설명), `todo`(행동 지시)가 정의되어 있다. `SimIntroCard`가 이를 표시하고, `SimSceneCard`는 `sim-hud` 오버레이로 체험 내내 시점 배지를 화면 상단에 유지한다.

**왜:** 세 시뮬레이션이 모두 동일한 시나리오("MyTube 홈에서 숏폼 탭 누르기")를 공유하므로, 사전에 어느 지점에서 개입이 걸리는지를 알려줘야 체험이 의미 있다. 특히 Pre-Access는 개입 오버레이가 뜨지 않으므로(탭이 그냥 막혀 있음), 화면 안에서 "이것이 개입이다"를 알 수 없으면 오류로 오인된다.

**어기면:** `sim-hud`를 제거하거나 `SimIntroCard`에서 시점 정보를 감추면, Pre-Access에서 참가자가 탭 차단을 버그로 오인하고 그냥 넘어간다.

---

### 5. 지원되지 않는 범위도 선택할 수 있어야 한다

**무엇을:** `Cards.jsx:197-205`에서 `content-category`를 선택했을 때 차단하지 않고 경고 문구만 표시한다("이 수준의 통제는 현재 도구에서 지원이 얇습니다"). `engine.js:133-139`(R5)에서도 결과 화면에 `warnings`로 전달한다.

**왜:** "몇 %의 참가자가 시장에 없는 통제를 원했는가"라는 데이터를 수집하기 위해서다. 유효성 검사로 막으면 이 데이터가 사라진다.

**어기면:** 선택을 막으면 수요 조사 데이터의 일부가 영구적으로 소실된다.

---

### 6. 우회 차단 질문은 우회 방지 기능이 실제로 존재하는 경로에만

**무엇을:** `features.js:254-256` 주석과 `BYPASS_SCENARIOS`(line 256) 4개가 각각 `resistance` 메커니즘(`uninstall-block`, `settings-lock`, `snooze-limit`, `reboot-persist`)에 1:1 대응한다. `engine.js:122-123`에서 앱 tie-break를 할 때 `f.resistance.some(r => blockedBypass.includes(r))`로 연결한다.

**왜:** 막을 수단이 없는 우회를 질문해도 결과에서 참조할 기능이 없다. 질문 자체가 참가자에게 기능이 있다는 오해를 줄 수 있다.

**어기면:** 대응 기능 없이 우회 시나리오를 추가하면 tie-break 로직이 빈 교집합을 참조하거나, 존재하지 않는 기능을 가리킨다.

---

### 7. S4는 탐색이 아니라 일괄 제시다

**무엇을:** S4는 enforcement 4단계(Free Pass / One-Tap Pass / Task to Pass / No Pass)를 시점 구분 없이 한 번에 카드로 나열하고, 항목별로 수용 여부를 받는다. 유일한 분기는 Task to Pass 안의 Physical Action이다 — Math problem solve를 먼저 제시해 수용하면 High Effort, 거부하면 Low Effort를 이어서 보여준다.

**왜:** enforcement 단계는 taxonomy 안에서 이미 정렬되어 있고, 어느 시점이든 동일한 friction이 적용된다. 시점별로 따로 탐색할 이유가 없으며, 참가자가 모든 단계를 명시적으로 평가해야 선호 임계값이 데이터로 남는다.

**어기면:** 이분 탐색으로 되돌리면 참가자가 평가하지 않은 단계가 생긴다. 시점별 사다리를 부활시키면 동일한 friction을 시점마다 다시 물어야 해 세션이 3배 길어진다.

---

### 8. 기능 3개와 앱 3개는 무조건 채운다

**무엇을:** `engine.js`의 추천 로직은 사용자 환경(플랫폼, 기기)과 무관하게 항상 기능 3개를 반환한다. 앱도 적합도 점수가 낮더라도 3개를 채운다. 환경 미지원으로 후보가 부족하면 차순위 항목을 끌어올린다.

**왜:** 결과가 비어 있으면 참가자가 설문 오류로 오인한다. 추천 개수를 고정해야 결과 화면 레이아웃이 일정하고, 연구자가 "지원 환경 밖에서 선택된 항목"을 별도로 분석할 수 있다.

**어기면:** 후보 부족을 이유로 빈 슬롯을 남기면 레이아웃이 무너지고, 미지원 항목에 대한 수요 데이터가 소실된다.

---

### 9. 결과 화면은 이름만, 상세는 탭 안에

**무엇을:** `ResultCard.jsx`의 메인 뷰에는 추천된 기능과 앱의 이름(및 아이콘)만 표시한다. 동작 방식, 지원 환경, 증거 등급(`evidenceTier`) 등은 각 항목을 탭했을 때 열리는 상세 화면(모달 또는 인라인 확장)에서 설명한다.

**왜:** 결과 화면을 한눈에 파악할 수 있어야 참가자가 전체 추천을 비교할 수 있다. 세부 정보를 메인 뷰에 펼치면 스크롤이 길어지고 중요한 항목이 묻힌다.

**어기면:** 모든 정보를 메인 뷰에 나열하면 결과 카드가 스크롤 피드를 압도하고, 숏폼 환경 안에 있다는 맥락이 깨진다.

---

### 10. 미지원 기능은 결과 후반부에 별도 영역으로

**무엇을:** 참가자 환경(플랫폼/기기)에서 지원되지 않는 기능은 메인 추천 영역 아래에 별도 섹션("현재 환경에서 지원되지 않지만 선호와 맞는 기능")으로 표시한다. `engine.js`의 `warnings` 배열과는 별개로, 미지원 항목 목록을 `unsupported[]`로 따로 반환한다.

**왜:** §8에 따라 추천 3개는 환경 무관하게 채우지만, 참가자가 자신의 환경에서 실제로 쓸 수 없는 항목을 인지해야 한다. 미지원 항목을 숨기면 실용적 가치가 없는 추천이 되고, 메인 뷰에 섞으면 §9의 간결함이 깨진다.

**어기면:** 미지원 항목을 메인 추천 슬롯에 포함시키되 표시만 다르게 하면, 참가자가 "왜 내가 못 쓰는 게 추천됐지?"라는 혼란을 겪는다.

---

## 임시값이지만 스키마는 고정인 것

`src/data/features.js`의 `FEATURES` 배열(13개)은 값이 전부 placeholder이지만,
필드 구조는 capability 매트릭스 컬럼과 맞춰져 있다.
나중에 Google Sheets → JSON 빌드 결과를 이 파일에 덮어쓰면 시스템이 그대로 동작한다.

**유지해야 하는 필드명:**
`id`, `tool`, `name`, `when`, `agency`, `enforcement`,
`scopeLevels`, `frictionRange`, `resistance`, `platforms`, `evidenceTier`, `blurb`

값은 바꿔도 되지만 필드 이름과 형태(배열인지 스칼라인지)는 바꾸면 안 된다.

---

## 파일별 역할

| 파일 | 역할 |
|---|---|
| `src/App.jsx` | 무대(phone 프레임) + `Deck` + `DebugPanel` 연결. `nonce`가 바뀌면 덱 전체 리셋. |
| `src/store.js` | 단일 상태 객체(`initialState`) + `useReducer` 기반 리듀서. `SET` / `LOG` / `RESET` 세 액션. `log[]`가 실제 수집 데이터 자리. |
| `src/deck.js` | 카드 시퀀스 정의(`buildScript`). S0~S5 전체 흐름, 고정 제시 순서(`FIXED_ORDER`), 카드 제목 헬퍼(`cardTitle`). |
| `src/engine.js` | 규칙 기반 추천 엔진. 기능 3개·앱 3개 고정 반환. `trace[]`를 함께 반환해 판정 근거를 추적할 수 있게 함. |
| `src/data/features.js` | 기능 DB(`FEATURES`), 우회 시나리오(`BYPASS_SCENARIOS`), 저항 레이블(`RESISTANCE_LABEL`). |
| `src/data/videos.js` | 영상 풀(`VIDEO_POOL`), 카테고리 목록(`CATEGORIES`), 시드 기반 셔플(`shuffled`). 그라디언트 카드가 실제 영상 대체. |
| `src/components/Deck.jsx` | scroll-snap 피드 전체. 카드 append 로직, IntersectionObserver 기반 활성 카드 추적. |
| `src/components/Cards.jsx` | 카드 렌더러 전부(IntroCard, MultiCard, ScopeHomeCard, ScopeShortsCard, ScheduleTypeCard, ScheduleCard, SimIntroCard, SimSceneCard, RankCard, IntensityCard, BypassCard). |
| `src/components/MockYouTube.jsx` | 모의 앱 UI. `MockHome`(홈 피드 + 탭 타겟 2개, `preBlocked` prop으로 Pre-Access 차단 상태 표시)과 `MockShorts`(재생 화면 + 탭 타겟 2개). 탭 타겟 id가 `scopeLevels`와 1:1 대응. |
| `src/components/Clock24.jsx` | 원형 24시간 시계(1~24시, 0시 없음). 24시가 위(자정), 12시가 아래(정오). 탭·드래그 입력, 구간 순환 처리. |
| `src/components/Intervention.jsx` | 개입 오버레이 3종(Pre / At / InUse). `VARIANTS` 객체에 각 시점의 배지, 설명, 대기 시간, 버튼 레이블 정의. Continuous 없음. |
| `src/components/ResultCard.jsx` | 결과 화면. `engine.js`의 `recommend()`를 호출해 아키타입·추천 기능(이름+아이콘)·미지원 기능·판정 근거를 렌더링. 상세 정보는 탭 시 열리는 상세 화면에서. |
| `src/components/DebugPanel.jsx` | 실시간 모니터 패널(노트북에서만 표시). 현재 위치, 카드 목록, 입력 현황, 응답 프리셋 주입. |

---

## S0~S5 단계 구성

| 단계 | 내용 | 대응 컴포넌트 |
|---|---|---|
| 인트로 | 시작 버튼 | `IntroCard` |
| **S0** | SFV 사용 환경 — 기기/경로/플랫폼 복수 선택 + 기타 주관식 | `MultiCard` × 3 |
| **S1** | 통제 범위 — 모의 앱 UI에서 직접 탭 | `ScopeHomeCard`, `ScopeShortsCard` |
| **S2** | 통제 규칙 — 원형 24시간 시계 | `ScheduleCard` + `Clock24` |
| **S3** | 개입 시점 — 고정 순서(Pre→At→InUse) 시뮬레이션 × 3 + 순위. 모두 "MyTube 홈에서 숏폼 탭 누르기" 동일 상황 | `SimIntroCard` × 3 + `SimSceneCard` × 3 + `RankCard` |
| **S4** | 개입 강도 — enforcement 4단(Free Pass / One-Tap Pass / Task to Pass / No Pass) 일괄 제시, 항목별 수용 여부. Task to Pass 안에서 High/Low Effort 분기 1회. | `IntensityCard` |
| **S5** | 우회·임시해제 — 시나리오 4개 yes/no | `BypassCard` × 4 |
| 결과 | 아키타입·추천 기능(이름)·추천 앱(이름)·미지원 기능·판정 근거 | `ResultCard` |

---

## 남은 작업

| 항목 | 현재 | 할 일 |
|---|---|---|
| `src/engine.js` | 아키타입 4개 버킷 하드코딩 | 좌표 조합별 규칙 + 사전 생성 결과 텍스트, 기능 3개·앱 3개 고정 반환, `unsupported[]` 분리 |
| `src/data/videos.js` | 그라디언트 카드 16개 | `src: '/clips/xxx.mp4'` 추가. `category` 필드 유지 필수. |
| `src/components/MockYouTube.jsx` | `.sp-visual` div | `<video muted loop playsInline>` + 활성 카드에서만 `play()` |
| `src/store.js` `log[]` | 메모리에만 쌓임 | 서버 전송 또는 파일 내보내기 |
| `src/components/ResultCard.jsx` | 전체 정보 메인 뷰 표시 | 이름·아이콘만 메인, 상세는 탭 시 열리는 화면으로 분리. `unsupported[]` 영역 추가. |
| `src/components/Cards.jsx` `IntensityCard` | 이분 탐색 기반 단일 카드 | enforcement 4단 일괄 제시 + High/Low Effort 분기로 교체 |

---

## 작업 언어 규칙

- 나와의 소통: 한국어
- UI 문자열: 한국어
- 코드 주석: 한국어
- 변수·함수명: 영어
