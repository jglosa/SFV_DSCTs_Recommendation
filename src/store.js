import { useReducer } from 'react'
import { FEATURE_BY_ID, EXPLORE_RUNGS, RUNGS_BY_AGENCY } from './data/features.js'

// ─────────────────────────────────────────────────────────────
// 단일 진실 상태. S0~S5 흐름에 맞춰 필드가 정렬되어 있다.
// ─────────────────────────────────────────────────────────────

export const initialState = {
  screen: 'S0',

  // S0 — 사용 환경
  env: { devices: [], os: [], route: [], platforms: [] },
  envOther: {},

  // S1 — scopeLevels id 배열 (app / entry-point / app-tab / content)
  scopes: [],

  // S2 — 스케줄 (scheduleNeeded 제거: 항상 null이며 dayType 이 동일 의미를 담는다)
  hours: {},
  dayType: null,

  // S3 — 개입 시점
  timingRank: [],
  timingSeen: [],

  // S4 — 개입 강도 (자율 탐색 구조)
  agencyVisited: [],        // 탐색한 agency id. 중복 없이 방문 순서대로. 로그용
  simsPlayed: [],           // 실행한 sim id. 중복 허용. 로그용
  agencyRank: [],           // ['flexible','supported','limited'] 세 개 순위
  featureAccepted: {},      // L id → 'weak' | 'ok' | 'strong'

  // S5 — 우회 방지
  bypassScenario: null,     // 시나리오 id (분석용, 추천 계산 미사용)
  bypassMethods: {},        // 'B1'~'B4' → true | false  우회에 쓸 것 같다고 답한 방법 (분석용)
  bypassWanted: {},         // 'B1'~'B4' → true | false  막혀 있기를 바라는지 (추천 tie-break 용)
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
// Rollup이 정적으로 검증하므로 export 선언은 유지한다.
// LADDER_INDIVIDUAL=[]이므로 intensity-indiv 카드 0장 → 실제 호출 없음.
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
 * O/X 를 받아야 할 agency id 배열 (순서 있음).
 *   1) agencyRank[0] — limited 면 제외
 *   2) agencyVisited 중 1순위가 아니고 limited 가 아닌 레벨
 */
export function oxTargets(state) {
  const rank = state.agencyRank ?? []
  const visited = state.agencyVisited ?? []
  const top = rank[0]
  const targets = []

  if (top && top !== 'limited') targets.push(top)

  for (const id of visited) {
    if (id !== top && id !== 'limited' && !targets.includes(id)) {
      targets.push(id)
    }
  }
  return targets
}

/**
 * 특정 agency 레벨의 exploreVisible rung 을 order 오름차순으로 반환한다.
 * limited 는 항상 빈 배열.
 */
export function rungsForOX(state, agencyId) {
  if (!agencyId || agencyId === 'limited') return []
  return (RUNGS_BY_AGENCY[agencyId] ?? [])
    .filter((r) => r.exploreVisible)
    .sort((a, b) => a.order - b.order)
}

/**
 * 특정 agency 에 대한 O/X 진행 상태.
 *   featureAccepted 에 해당 레벨 rung 키가 하나라도 있으면 'answered'
 *   oxSkipped 에 있으면 'skipped'
 *   그 외 'unvisited'
 */
export function oxStatus(state, agencyId) {
  const rungs = rungsForOX(state, agencyId)
  const accepted = state.featureAccepted ?? {}
  if (rungs.some((r) => accepted[r.id] !== undefined)) return 'answered'
  if ((state.oxSkipped ?? []).includes(agencyId)) return 'skipped'
  return 'unvisited'
}

/**
 * featureAccepted 가 'ok' 또는 'weak' 인 rung (수용한 것). order 내림차순.
 * 'strong'(거부)은 포함하지 않는다.
 */
export function acceptedRungs(state) {
  const accepted = state.featureAccepted ?? {}
  return EXPLORE_RUNGS
    .filter((r) => accepted[r.id] === 'ok' || accepted[r.id] === 'weak')
    .sort((a, b) => b.order - a.order)
}

/**
 * rung의 resolveBy 테이블에 따라 feature 코드(또는 코드 배열)를 해석한다.
 *
 *   null:          featureIds[0] 하나를 반환
 *   'timing':      resolve.byTiming에서 timingRank 순으로 첫 일치.
 *                  없으면 resolve.default.
 *   'scope+timing': scopes 각각에 대해 resolve.byScope를 해석.
 *                  항목에 any가 있으면 그 코드,
 *                  byTiming이 있으면 timingRank 순으로 첫 일치,
 *                  없으면 항목의 default (또는 최상위 default).
 *                  결과는 코드 배열이다.
 *
 * 테이블에 없는 값을 만나면 예외를 던진다. 조용히 기본값으로 넘기지 않는다.
 */
export function resolveRungCode(rung, scopes, timingRank) {
  if (!rung.resolveBy) {
    const fixed = rung.resolve?.fixed
    if (!fixed) throw new Error(`rung ${rung.id}: resolve.fixed 비어 있음`)
    return fixed
  }

  if (rung.resolveBy === 'timing') {
    const { byTiming, default: def } = rung.resolve
    for (const t of (timingRank ?? [])) {
      if (byTiming?.[t] !== undefined) return byTiming[t]
    }
    if (def !== undefined) return def
    throw new Error(`rung ${rung.id}: byTiming 일치 없음, default 없음 (timingRank=${JSON.stringify(timingRank)})`)
  }

  if (rung.resolveBy === 'scope+timing') {
    const { byScope, default: def } = rung.resolve
    const results = []
    for (const scope of (scopes ?? [])) {
      const entry = byScope?.[scope]
      if (entry === undefined) throw new Error(`rung ${rung.id}: scope '${scope}' 테이블 없음`)
      if (entry.any !== undefined) {
        results.push(entry.any)
      } else if (entry.byTiming) {
        let found = false
        for (const t of (timingRank ?? [])) {
          if (entry.byTiming[t] !== undefined) {
            results.push(entry.byTiming[t])
            found = true
            break
          }
        }
        if (!found) {
          const fallback = entry.default ?? def
          if (fallback === undefined) {
            throw new Error(`rung ${rung.id}, scope '${scope}': byTiming 일치 없음, default 없음 (timingRank=${JSON.stringify(timingRank)})`)
          }
          results.push(fallback)
        }
      } else {
        throw new Error(`rung ${rung.id}, scope '${scope}': any/byTiming 모두 없음`)
      }
    }
    return results
  }

  throw new Error(`rung ${rung.id}: 알 수 없는 resolveBy '${rung.resolveBy}'`)
}

/**
 * 중복 제거용 키. code + scope + taskGroup 조합.
 * 1.1.2는 scope에 따라 다른 추천, 2.1.3은 taskGroup에 따라 다른 추천이므로
 * 코드만으로 dedupe하면 항목이 사라진다.
 */
export function recommendationKey(item) {
  return `${item.code}|${item.scope ?? ''}|${item.taskGroup ?? ''}`
}

/**
 * 화면에 표시할 이름. nameKoVariants를 먼저 보고, 없으면 nameKo를 반환한다.
 *   1.1.2: nameKoVariants.byScope
 *   2.1.3: nameKoVariants.byTaskGroup
 */
export function displayName(item) {
  const f = FEATURE_BY_ID[item.code]
  if (!f) return item.code
  if (f.nameKoVariants?.byScope && item.scope) {
    const v = f.nameKoVariants.byScope[item.scope]
    if (v !== undefined) return v
  }
  if (f.nameKoVariants?.byTaskGroup && item.taskGroup) {
    const v = f.nameKoVariants.byTaskGroup[item.taskGroup]
    if (v !== undefined) return v
  }
  return f.nameKo
}

