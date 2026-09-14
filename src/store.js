import { useReducer } from 'react'
import { LEVELS, INTERVENTIONS, FEATURE_BY_ID } from './data/features.js'

// ─────────────────────────────────────────────────────────────
// 단일 진실 상태. S0~S5 흐름에 맞춰 필드가 정렬되어 있다.
// ─────────────────────────────────────────────────────────────

export const initialState = {
  screen: 'S0',

  // S0 — 사용 환경
  env: { devices: [], os: [], route: [], platforms: [] },
  envOther: {},

  // S1 — scopeLevels id 배열 (app / shorts-row / shorts-tab / content)
  scopes: [],

  // S2 — 스케줄 (dayType: null | 'none' | 'daily' | 'split')
  hours: {},
  dayType: null,

  // S3 — 개입 시점
  timingRank: [],
  timingSeen: [],

  // S4 — 개입 강도 (자율 탐색 구조)
  agencyVisited: [],        // 탐색한 agency id. 중복 없이 방문 순서대로. 로그용
  simsPlayed: [],           // 실행한 sim id. 중복 허용. 로그용
  agencyRank: [],           // ['flexible','supported','limited'] 세 개 순위
  featureAccepted: {},      // level 번호(1-10) → 'weak' | 'ok' | 'strong'

  // S5 — 우회 방지
  bypassScenario: null,     // 시나리오 id (분석용, 추천 계산 미사용)
  bypassMethods: {},        // featureId → true | false  우회에 쓸 것 같다고 답한 방법 (분석용)
  bypassWanted: {},         // featureId → true | false  막혀 있기를 바라는지 (추천 tie-break 용)
  oxSkipped: [],            // O/X 를 건너뛰겠다고 선택한 agency id 배열

  // 수집 데이터
  log: [],
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET': {
      const next = {
        ...state,
        ...action.patch,
        log: [...state.log, { t: Date.now(), ev: 'set', keys: Object.keys(action.patch) }],
      }
      return next
    }
    case 'LOG':
      return { ...state, log: [...state.log, { t: Date.now(), ...action.entry }] }
    case 'RESET':
      return { ...initialState, nonce: (state.nonce ?? 0) + 1 }
    default:
      return state
  }
}

export function useStore() {
  const [state, dispatch] = useReducer(reducer, initialState)
  return [
    state,
    {
      set: (patch) => dispatch({ type: 'SET', patch }),
      log: (entry) => dispatch({ type: 'LOG', entry }),
      reset: () => dispatch({ type: 'RESET' }),
    },
  ]
}

// ── 순수 셀렉터 ───────────────────────────────────────────────

/** S3 1순위 시점 */
export function topWhen(state) {
  return (state.timingRank ?? [])[0] ?? null
}

/** S0 환경 조건 요약 */
export function envQuery(state) {
  const { os, route, platforms } = state.env ?? {}
  return { os: os ?? null, route: route ?? null, platforms: platforms ?? [] }
}

// ── [하위호환 스텁] Deck.jsx useEffect 의존성 ────────────────────
/** @deprecated 이분 탐색 폐기. Deck.jsx 교체 전 스텁. */
export function nextProbeOrder() { return null }
/** @deprecated 이분 탐색 폐기. Deck.jsx 교체 전 스텁. */
export function computeThreshold() { return null }

/**
 * S4 탐색 진행 가능 여부.
 * agencyVisited 가 2개 이상이어야 다음으로 넘어갈 수 있다.
 */
export function canProceedFromExplore(state) {
  return (state.agencyVisited ?? []).length >= 2
}

/**
 * O/X 를 받아야 할 agency id 배열 (최대 2개).
 *   agencyRank[0] (1순위) 와 agencyRank[1] (2순위) 만 반환한다.
 *   3순위는 묻지 않는다. limited 제외 없음.
 */
export function oxTargets(state) {
  return (state.agencyRank ?? []).slice(0, 2).filter(Boolean)
}

/**
 * 특정 agency 의 레벨 배열을 level 오름차순으로 반환한다.
 * limited 는 level 10 하나를 반환한다 (항목 한 개짜리 O/X 카드).
 * 반환 객체에 id: l.level 을 추가해 Cards.jsx 와 호환한다.
 */
export function rungsForOX(state, agencyId) {
  if (!agencyId) return []
  return LEVELS
    .filter((l) => l.agency === agencyId)
    .sort((a, b) => a.level - b.level)
    .map((l) => ({ ...l, id: l.level }))   // id 별칭: Cards.jsx 호환
}

/**
 * 특정 agency 에 대한 O/X 진행 상태.
 *   featureAccepted 에 해당 레벨 번호 키가 하나라도 있으면 'answered'
 *   oxSkipped 에 있으면 'skipped'
 *   그 외 'unvisited'
 */
export function oxStatus(state, agencyId) {
  const rungs = rungsForOX(state, agencyId)
  const accepted = state.featureAccepted ?? {}
  if (rungs.some((r) => accepted[r.level] !== undefined)) return 'answered'
  if ((state.oxSkipped ?? []).includes(agencyId)) return 'skipped'
  return 'unvisited'
}

/**
 * featureAccepted 가 'ok' 또는 'weak' 인 레벨 (수용한 것). level 내림차순.
 * 'strong'(거부)은 포함하지 않는다.
 */
export function acceptedRungs(state) {
  const accepted = state.featureAccepted ?? {}
  return LEVELS
    .filter((l) => accepted[l.level] === 'ok' || accepted[l.level] === 'weak')
    .sort((a, b) => b.level - a.level)
}

/**
 * 특정 레벨에서 조건에 맞는 개입 기능 배열을 반환한다.
 *
 * level.decideParams 에 따라 필터링한다:
 *   null                → 전부 반환 (L8: 세 항목 모두 후보)
 *   'timing'            → timingRank 순으로 첫 시점 항목만
 *   ['timing','scope']  → scope 교집합 → timing 첫 시점 항목만
 *
 * 시점 폴백: timingRank 1순위에 없으면 2순위, 3순위 순으로 시도.
 *            세 시점 모두 없으면 timing 조건 무시하고 pool 그대로 반환.
 * scopes 가 비어 있으면 scope 조건을 무시한다.
 * engine.js 가 호출한다.
 */
export function itemsForLevel(level, scopes, timingRank) {
  const dp = level.decideParams   // null | 'timing' | ['timing','scope']
  const candidates = INTERVENTIONS.filter((f) => f.level === level.level)

  if (candidates.length === 0) return []

  // decideParams = null → 전부 후보, 필터 없음
  if (dp === null) return candidates

  const useScope  = Array.isArray(dp) && dp.includes('scope')
  const useTiming = dp === 'timing'   || (Array.isArray(dp) && dp.includes('timing'))

  // ── scope + timing 복합: 범위별 독립 처리 (L10 전용) ─────────
  // 범위는 '막아달라' 는 요구, 시점은 순위. 범위가 시점보다 우선한다.
  // 각 범위를 독립적으로 처리하고 결과를 합친다.
  if (useScope && useTiming && (scopes ?? []).length > 0) {
    const seenIds = new Set()
    const results = []
    for (const scope of (scopes ?? [])) {
      const byScope = candidates.filter((f) => {
        const fs = f.scope ?? []
        return fs.length === 0 || fs.includes(scope)
      })
      if (byScope.length === 0) continue
      let picked = null
      for (const when of (timingRank ?? [])) {
        const hit = byScope.filter((f) => f.when === when)
        if (hit.length > 0) { picked = hit; break }
      }
      if (!picked) picked = byScope   // 세 시점 모두 없으면 폴백
      for (const item of picked) {
        if (!seenIds.has(item.id)) { seenIds.add(item.id); results.push(item) }
      }
    }
    return results
  }

  // ── scope 필터 ──────────────────────────────────────────────
  let pool = candidates
  if (useScope && (scopes ?? []).length > 0) {
    const filtered = candidates.filter((f) => {
      const fs = f.scope ?? []
      if (fs.length === 0) return true   // scope null/[] 항목은 무조건 통과
      return fs.some((s) => (scopes ?? []).includes(s))
    })
    // 교집합이 있으면 적용, 없으면 scope 조건 무시
    if (filtered.length > 0) pool = filtered
  }

  // ── timing 필터 (폴백 포함) ──────────────────────────────────
  if (useTiming) {
    const ranks = timingRank ?? []
    for (const when of ranks) {
      const byTiming = pool.filter((f) => f.when === when)
      if (byTiming.length > 0) return byTiming
    }
    // 세 시점 모두 없으면 timing 조건 무시하고 pool 반환
    return pool
  }

  return pool
}
