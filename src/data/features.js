// ─────────────────────────────────────────────────────────────
// features.js — features.json v3.0 어댑터
//
// JSON이 단일 진실 공급원이다. 데이터를 여기에 다시 적지 않는다.
// ─────────────────────────────────────────────────────────────

import raw from './features.json'

// ── 기능 배열 (27개, role: intervention / trigger / bypass / exclude) ──
export const FEATURES = raw.features

export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f]))

// ── 개입 기능 (role: intervention, 18개) — 추천 후보 풀 ────────
export const INTERVENTIONS = FEATURES.filter((f) => f.role === 'intervention')

// ── 강도 레벨 10단 (level 1~10) ────────────────────────────────
export const LEVELS = raw.levels

export const LEVEL_BY_NUM = Object.fromEntries(LEVELS.map((l) => [l.level, l]))

// ── agency 레벨 3단 (supported / flexible / limited), order 오름차순 ──
export const AGENCY_LEVELS = [...raw.agencyLevels].sort((a, b) => a.order - b.order)

// ── 통제 범위: id → 한국어 레이블 ──────────────────────────────
// ResultCard.jsx 등에서 SCOPE_LEVELS[s] 형태로 사용
export const SCOPE_LEVELS = Object.fromEntries(
  raw.scopeLevels.map((s) => [s.id, s.nameKo])
)

// ── 통제 범위 참가자용 배지 표현 — S1 화면·기능 상세 공통 사용 ──
export const SCOPE_DISPLAY = Object.fromEntries(
  raw.scopeLevels.map((s) => [s.id, s.badge])
)

// ── 우회 시나리오 UI 문구 (JSON에 없으므로 JS 레이어에서 관리) ──
// 키: bypassTargets[].featureId
const BYPASS_SCENE = {
  'lock-app-settings': {
    scene:    '카페에서 공부하다 지쳤습니다. 차단 앱 설정으로 들어가 차단 시간대를 바꾸려 합니다.',
    action:   '차단 앱 설정 변경',
    question: '이 우회는 막혀 있어야 한다고 생각하세요?',
  },
  'lock-device-settings': {
    scene:    '기기 날짜·시간 설정을 바꾸거나 계정에서 로그아웃하면 차단이 풀릴 수도 있습니다.',
    action:   'OS 설정 변경으로 차단 우회',
    question: '이 우회는 막혀 있어야 한다고 생각하세요?',
  },
  'prevent-uninstall': {
    scene:    '새벽 1시. 차단이 번거롭게 느껴져 차단 앱을 지워버릴까 생각합니다.',
    action:   '차단 앱 삭제 후 재설치',
    question: '이 우회는 막혀 있어야 한다고 생각하세요?',
  },
  'prevent-multiwindow': {
    scene:    '차단이 걸려 있지만 PIP(화면 속 화면)나 분할화면을 쓰면 옆에서 볼 수 있습니다.',
    action:   'PIP·분할화면으로 계속 보기',
    question: '이 우회는 막혀 있어야 한다고 생각하세요?',
  },
}

export const BYPASS_TARGETS = raw.bypassTargets.map((b) => ({
  ...b,
  ...BYPASS_SCENE[b.featureId],
}))

// 저항 레이블 — featureId 키
export const RESISTANCE_LABEL = Object.fromEntries(
  raw.bypassTargets.map((b) => [b.featureId, b.nameKo])
)

// ── 범위 → level-10 개입 기능 id 배열 (scopeScore 계산용) ────
// 하드코딩 금지. features.json 의 level=10, role=intervention 항목에서 도출.
export const SCOPE_TO_L10_FEATS = (() => {
  const map = {}
  for (const f of raw.features) {
    if (f.role !== 'intervention' || f.level !== 10) continue
    for (const s of (Array.isArray(f.scope) ? f.scope : f.scope ? [f.scope] : [])) {
      if (!map[s]) map[s] = []
      map[s].push(f.id)
    }
  }
  return map
})()

// ── scope 정규화 헬퍼 ─────────────────────────────────────────
// features.json 에서 scope 가 string 또는 배열 양쪽으로 올 수 있다.
// (mission-altapp, block-app, block-content 는 단일 문자열)
// 모든 참조가 이 함수를 통해 배열로 정규화한다. JSON 을 고치지 않는다.
export function normalizeScope(v) {
  if (v === null || v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

// ── 시뮬레이션 레지스트리 ──────────────────────────────────────
// levels[].sim + features[].sim 에 등장하는 모든 sim id → true
// v3.0 에서는 등록된 sim 이 모두 구현되어 있다.
const allSimIds = new Set([
  ...raw.levels.map((l) => l.sim),
  ...raw.features.map((f) => f.sim),
].filter(Boolean))
export const SIMULATIONS = Object.fromEntries([...allSimIds].map((id) => [id, true]))
