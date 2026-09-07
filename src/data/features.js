// ─────────────────────────────────────────────────────────────
// features.js — features.json v2.0 어댑터
//
// JSON이 단일 진실 공급원이다. 데이터를 여기에 다시 적지 않는다.
// ─────────────────────────────────────────────────────────────

import raw from './features.json'

// ── 기능 배열 ─────────────────────────────────────────────────
// scopeLevels: addressableScope 별칭 (engine.js 호환)
export const FEATURES = raw.features.map((f) => ({
  ...f,
  scopeLevels: f.addressableScope,
}))

export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f]))

// ── [하위호환 스텁] Cards.jsx 모듈 초기화 의존성 ────────────────
// Cards.jsx:581이 모듈 레벨에서 ENFORCEMENT.map()을 호출한다.
// Cards.jsx 교체 전까지 빈 배열로 유지. ENF_BY_ID = {} 가 되어 무해하다.
export const ENFORCEMENT = []

// ── 통제 범위: id → 한국어 레이블 ──────────────────────────────
export const SCOPE_LEVELS = Object.fromEntries(
  raw.scopeLevels.map((s) => [s.id, s.ko])
)

// ── agency 레벨 3단 (supported / flexible / limited), order 오름차순 ──
export const AGENCY_LEVELS = [...raw.agencyLevels].sort((a, b) => a.order - b.order)

// ── 사다리 전체 12행 ──────────────────────────────────────────
export const LADDER = raw.ladder

// ── 탐색 대상 10행 (exploreVisible: true), order 오름차순 ──────
export const EXPLORE_RUNGS = raw.ladder
  .filter((r) => r.exploreVisible)
  .sort((a, b) => a.order - b.order)

// ── agency id → rung 배열 (order 오름차순, exploreVisible 무관) ──
// non-explore 항목(L8+capture 등)도 포함한다. engine.js가 추천 후보로 씀.
export const RUNGS_BY_AGENCY = raw.ladder.reduce((acc, r) => {
  if (!acc[r.agency]) acc[r.agency] = []
  acc[r.agency].push(r)
  return acc
}, {})

// ── [하위호환 스텁] Deck.jsx / deck.js / ResultCard.jsx 의존성 ──
// Rollup이 named export 존재를 정적으로 검증한다. 실제 동작은 없다.
// 해당 파일들이 교체되기 전까지 빈 값으로 유지한다.
export const LADDER_INDIVIDUAL = []   // deck.js:120 buildScript()
export const LADDER_RUNGS = []        // Deck.jsx:165,189 / ResultCard.jsx:72,213
export const LADDER_START_ORDER = 0   // Deck.jsx:165

// ── 우회 시나리오 UI 문구 (JSON에 없으므로 JS 레이어에서 관리) ──
const BYPASS_SCENE = {
  B1: {
    scene:    '카페에서 공부하다 지쳤습니다. 차단 앱 설정으로 들어가 차단 시간대를 바꾸려 합니다.',
    action:   '차단 앱 설정 변경',
    question: '이 우회는 막혀 있어야 한다고 생각하세요?',
  },
  B2: {
    scene:    '기기 날짜·시간 설정을 바꾸거나 계정에서 로그아웃하면 차단이 풀릴 수도 있습니다.',
    action:   'OS 설정 변경으로 차단 우회',
    question: '이 우회는 막혀 있어야 한다고 생각하세요?',
  },
  B3: {
    scene:    '새벽 1시. 차단이 번거롭게 느껴져 차단 앱을 지워버릴까 생각합니다.',
    action:   '차단 앱 삭제 후 재설치',
    question: '이 우회는 막혀 있어야 한다고 생각하세요?',
  },
  B4: {
    scene:    '차단이 걸려 있지만 PIP(화면 속 화면)나 분할화면을 쓰면 옆에서 볼 수 있습니다.',
    action:   'PIP·분할화면으로 계속 보기',
    question: '이 우회는 막혀 있어야 한다고 생각하세요?',
  },
}

export const BYPASS_TARGETS = raw.bypassTargets.map((b) => ({
  ...b,
  ...BYPASS_SCENE[b.id],
}))

// 저항 레이블 — v1.3에서 b.ko → b.nameKo
export const RESISTANCE_LABEL = Object.fromEntries(
  raw.bypassTargets.map((b) => [b.id, b.nameKo])
)

// ── 기능 설명 — displayName 과 같은 규칙 ──────────────────────
// descKoVariants.byScope (1.1.2) / byTaskGroup (2.1.3) 를 먼저 보고
// 없으면 descKo 를 반환. item 은 { code, scope?, taskGroup? } 형태.
export function description(item) {
  const f = FEATURE_BY_ID[item.code]
  if (!f) return ''
  if (f.descKoVariants?.byScope && item.scope) {
    const v = f.descKoVariants.byScope[item.scope]
    if (v !== undefined) return v
  }
  if (f.descKoVariants?.byTaskGroup && item.taskGroup) {
    const v = f.descKoVariants.byTaskGroup[item.taskGroup]
    if (v !== undefined) return v
  }
  return f.descKo ?? ''
}

// ── 시뮬레이션 레지스트리 ──────────────────────────────────────
// null  → 준비 중 (호출하는 쪽에서 "준비 중" 오버레이 표시)
// true  → 구현 완료 (InterventionSim 이 SIM_COMPONENTS 를 통해 실제 컴포넌트 선택)
const LIVE_SIM_IDS = new Set([
  'confirm', 'timed_wait', 'intention_input',
  'mission_hold', 'mission_simple', 'mission_exercise', 'mission_capture', 'mission_altapp',
  'grayscale', 'push_notification', 'redirect_productivity', 'hard_block',
])
// 모든 11개 키 구현 완료 — null 없음
export const SIMULATIONS = Object.fromEntries([
  ...raw.sims.map((s) => [s.id, LIVE_SIM_IDS.has(s.id) ? true : null]),
  ['mission_hold', true],  // ladder L7이 참조하지만 sims 배열에 없음
])
