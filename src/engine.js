// ─────────────────────────────────────────────────────────────
// 규칙 기반 추천 엔진 v4 (features.json v3.0 대응)
//
// 입력: store.js initialState 형태의 state 객체
// 출력: { features, apps, archetype, rationale, envGaps, warnings, trace, … }
//
// 핵심 흐름:
//   featureAccepted(level 번호) / oxStatus / agencyRank  →  10 레벨 등급화
//     → itemsForLevel                                    →  기능 후보
//     → 가중합 정렬                                       →  기능 3개
//     → 5점수 앱 점수화                                   →  앱 3개
//
// 기능·앱은 언제나 정확히 3개를 반환한다 (§8).
// featureAccepted 키: level 번호 (1-10), 값: 'weak' | 'ok' | 'strong'
// ─────────────────────────────────────────────────────────────

import { LEVELS, INTERVENTIONS, RESISTANCE_LABEL, SCOPE_TO_L10_FEATS } from './data/features.js'
import { APPS, ROUTE_MAP, inAppPlatforms } from './data/apps.js'
import { oxStatus, itemsForLevel } from './store.js'

// ── 아키타입 (agencyRank[0] × timingRank[0]) ───────────────────
const ARCHETYPE_MAP = {
  supported_Pre: {
    code:    '사전 감지형',
    tagline: '시작하기 전부터 어디로 향하는지 알아채려 합니다',
    body:    '화면이 덜 눈에 띄거나 경로가 바뀌면 충분합니다. 강제가 아니라 환경을 바꾸는 방식을 선호합니다.',
  },
  supported_At: {
    code:    '진입 알림형',
    tagline: '들어가는 순간 한 번 알려주는 것으로 충분합니다',
    body:    '알림을 무시하고도 볼 수 있지만, 순간을 알아채는 것이 결정에 영향을 줍니다. 결정은 내가 합니다.',
  },
  supported_InUse: {
    code:    '사후 성찰가',
    tagline: '강제보다 알아차림을 택합니다',
    body:    '지금 무엇을 얼마나 하는지 눈에 보이면 스스로 멈출 수 있습니다. 강한 개입은 오히려 반발을 만든다고 느낍니다.',
  },
  flexible_Pre: {
    code:    '유연한 경계형',
    tagline: '진입 전 작은 마찰이 자동 흐름을 끊어줍니다',
    body:    '완전히 막기보다, 조건을 채우면 들어갈 수 있습니다. 선택의 여지를 남기되 무의식적 접근만 막는 방식입니다.',
  },
  flexible_At: {
    code:    '문턱 조율자',
    tagline: '열려는 순간에 잠깐 멈추는 쪽이 맞습니다',
    body:    '완전히 못 보게 하는 것보다, 열려는 순간에 잠깐 멈추는 쪽이 맞다고 봅니다. 자동으로 손이 가는 흐름만 끊어지면 충분합니다.',
  },
  flexible_InUse: {
    code:    '유연한 조율자',
    tagline: '보되, 길어지는 걸 막는 쪽입니다',
    body:    '숏폼을 보는 것 자체는 문제로 보지 않습니다. 문제는 길이입니다. 사용 중에 상황을 알려주고 스스로 끊을 여지를 주는 방식을 선호합니다.',
  },
  limited_Pre: {
    code:    '경계 설계자',
    tagline: '틈이 생기기 전에 막아두는 쪽입니다',
    body:    '유혹이 시작되기 전 단계에서 경로 자체를 닫아두는 방식을 선호합니다. 지금 판단을 믿기보다, 여유 있을 때 정한 규칙이 나중까지 버텨주기를 기대합니다.',
  },
  limited_At: {
    code:    '문턱 관리자',
    tagline: '들어가는 순간에 한 번 걸리게 하는 쪽입니다',
    body:    '완전히 못 보게 하는 것보다, 열려는 순간에 잠깐 멈추는 쪽이 맞다고 봅니다. 자동으로 손이 가는 흐름만 끊어지면 충분하다고 느낍니다.',
  },
  limited_InUse: {
    code:    '사용 중 제한형',
    tagline: '보다가도 멈출 수 있어야 합니다',
    body:    '사용 중 강제 개입이 가장 현실적인 방어선입니다. 시작을 막지 않아도, 길어질 때 끊어주는 것이 더 현실적이라고 봅니다.',
  },
  _default: {
    code:    '자기통제 탐색형',
    tagline: '아직 선호하는 방식을 찾는 중입니다',
    body:    '추천된 기능을 하나씩 시도해보세요. 사용해보면서 나에게 맞는 방식이 드러납니다.',
  },
}

function resolveArchetype(state) {
  const agency = (state.agencyRank ?? [])[0] ?? null
  const timing = (state.timingRank ?? [])[0] ?? null
  if (!agency || !timing) return ARCHETYPE_MAP._default
  return ARCHETYPE_MAP[`${agency}_${timing}`] ?? ARCHETYPE_MAP._default
}

// ── 경로 정규화 — ROUTE_MAP 은 apps.js 에서 import ────────────

// ─────────────────────────────────────────────────────────────
// 기능 3개 확정
// ─────────────────────────────────────────────────────────────

/**
 * 레벨의 9등급을 결정한다.
 *
 *   G1: agencyRank[0] + 'ok'  또는 limited 가 1순위
 *   G2: agencyRank[0] + 'weak'
 *   G3~G6: agencyRank[1·2] × 'ok'·'weak'
 *   G7: skipped 또는 limited 2·3순위
 *   G8: unvisited
 *   G9: 'strong'(거부)
 *
 * featureAccepted 키: level.level 번호 (1-10)
 */
function levelGrade(level, state) {
  const agencyRank = state.agencyRank ?? []
  const accepted = state.featureAccepted ?? {}
  const fa = accepted[level.level]

  for (let i = 0; i < 3; i++) {
    const agencyAtRank = agencyRank[i]
    if (!agencyAtRank) break
    if (level.agency === agencyAtRank) {
      if (fa === 'ok')   return i * 2 + 1
      if (fa === 'weak') return i * 2 + 2
      if (level.agency === 'limited') return i === 0 ? 1 : 7
    }
  }

  if (fa === 'strong') return 9

  const st = oxStatus(state, level.agency)
  if (st === 'skipped') return 7
  return 8
}

// ── 정렬 가중치 ──────────────────────────────────────────────
const SORT_WEIGHT_LEVEL    = 0.6
const SORT_WEIGHT_COVERAGE = 0.4
const MAX_LEVEL            = 10

function makeScoreFn(items) {
  const maxCoverage = Math.max(...items.map((f) => f.coverage?.n ?? 0), 1)
  return (item) =>
    SORT_WEIGHT_LEVEL    * (item.level / MAX_LEVEL) +
    SORT_WEIGHT_COVERAGE * ((item.coverage?.n ?? 0) / maxCoverage)
}

function sortByAgencyRankItems(items, agencyRank, scoreFn) {
  const rankIndex = (agency) => {
    const i = (agencyRank ?? []).indexOf(agency)
    return i === -1 ? 99 : i
  }
  return [...items].sort((a, b) => {
    const ra = rankIndex(a.agency)
    const rb = rankIndex(b.agency)
    if (ra !== rb) return ra - rb
    return scoreFn(b) - scoreFn(a)
  })
}

/**
 * 기능 3개 확정.
 * G1→G9 순으로 레벨을 순회하며 itemsForLevel 로 후보를 수집.
 * 점수 = 0.6×(level/10) + 0.4×(coverage.n/max)
 */
function buildFeaturePicks(state, trace) {
  const agencyRank = state.agencyRank ?? []
  const scopes = state.scopes ?? []
  const timingRank = state.timingRank ?? []

  const levelsWithGrade = LEVELS.map((level) => ({ level, grade: levelGrade(level, state) }))
  const scoreFn = makeScoreFn(INTERVENTIONS)

  const candidates = []
  const usedIds = new Set()

  for (const grade of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const gradeLevels = levelsWithGrade
      .filter((g) => g.grade === grade)
      .map((g) => g.level)

    const gradeItems = gradeLevels.flatMap((level) =>
      itemsForLevel(level, scopes, timingRank)
    )

    const sorted =
      grade >= 7
        ? sortByAgencyRankItems(gradeItems, agencyRank, scoreFn)
        : [...gradeItems].sort((a, b) => scoreFn(b) - scoreFn(a))

    for (const item of sorted) {
      if (!usedIds.has(item.id)) {
        usedIds.add(item.id)
        candidates.push({ ...item, grade })
      }
    }

    if (candidates.length >= 3) break
  }

  trace.push({
    rule: 'F · 기능 후보 (상위 6)',
    detail: candidates
      .slice(0, 6)
      .map((c) => `L${c.level}:${c.id}(G${c.grade})`)
      .join(', '),
  })

  if (candidates.length < 3) {
    console.error(
      `[engine] buildFeaturePicks: 후보 ${candidates.length}개 — 3개 미만 (데이터 오류).`,
    )
  }

  return candidates.slice(0, 3)
}

// ─────────────────────────────────────────────────────────────
// 앱 3개 확정
// ─────────────────────────────────────────────────────────────

function computeAppScore(app, state, featureIds) {
  const env = state.env ?? {}
  const userOs = env.os ?? []
  const userPlatforms = env.platforms ?? []
  const userRoute = env.route ?? []
  const scopes = state.scopes ?? []
  const bypass = state.bypassWanted ?? {}

  // (1) 커버리지: 추천 기능 id 중 app.features 에 포함된 수 (직접 대응)
  const coveredIds = featureIds.filter((fid) => (app.features ?? []).includes(fid))
  const coverageScore = coveredIds.length

  // (2) 범위 적합도: 참가자 선택 범위 중 앱이 커버하는 범위 수
  // level-10 개입 기능 보유 여부로 판단. 하나라도 있으면 +1, 중복 가산 없음.
  let scopeScore = 0
  for (const s of scopes) {
    const featsForScope = SCOPE_TO_L10_FEATS[s] ?? []
    if (featsForScope.some((fid) => (app.features ?? []).includes(fid))) {
      scopeScore += 1
    }
  }

  // (3) 환경 적합도
  let envScore = 0
  envScore += userOs.filter((o) => app.os.includes(o)).length
  const normalRoutes = [...new Set(userRoute.map((r) => ROUTE_MAP[r]).filter(Boolean))]
  for (const rt of normalRoutes) {
    if ((app.worksOn ?? []).includes(rt)) envScore += 1
  }
  const iap = inAppPlatforms(app)
  if (iap.length > 0) {
    envScore += userPlatforms.filter((p) => iap.includes(p)).length
  }
  if (userOs.includes('desktop') && (app.devices ?? []).includes('pc')) envScore += 1

  // (4) 스케줄
  const hasSchedule = state.dayType === 'daily' || state.dayType === 'split'
  const scheduleScore =
    hasSchedule && (app.features ?? []).includes('schedule-window') ? 1 : 0

  // (5) 우회 방지 tie-break: featureId 가 app.features 에 있으면 +1
  let bypassScore = 0
  for (const [featureId, bv] of Object.entries(bypass)) {
    if (bv !== true) continue
    if ((app.features ?? []).includes(featureId)) bypassScore++
  }

  return { coverageScore, coveredIds, scopeScore, envScore, scheduleScore, bypassScore }
}

function buildAppPicks(state, featureIds, trace) {
  const scored = APPS.map((app) => ({
    ...app,
    ...computeAppScore(app, state, featureIds),
  }))

  scored.sort((a, b) => {
    if (b.coverageScore !== a.coverageScore) return b.coverageScore - a.coverageScore
    if (b.scopeScore !== a.scopeScore)       return b.scopeScore - a.scopeScore
    if (b.envScore !== a.envScore)           return b.envScore - a.envScore
    if (b.scheduleScore !== a.scheduleScore) return b.scheduleScore - a.scheduleScore
    if (b.bypassScore !== a.bypassScore)     return b.bypassScore - a.bypassScore
    return a.id.localeCompare(b.id)
  })

  trace.push({
    rule: 'A · 앱 점수 상위 5',
    detail: scored
      .slice(0, 5)
      .map(
        (a) =>
          `${a.id}(C${a.coverageScore}|S${a.scopeScore}|E${a.envScore}|Sc${a.scheduleScore}|B${a.bypassScore})`,
      )
      .join(' | '),
  })

  return scored.slice(0, 3)
}

// ─────────────────────────────────────────────────────────────
// 경고·환경 갭
// ─────────────────────────────────────────────────────────────

function buildWarnings(state, apps, trace) {
  const warnings = []
  const envGaps = []
  const scopes = state.scopes ?? []
  const userOs = state.env?.os ?? []
  const userPlatforms = state.env?.platforms ?? []

  if (scopes.includes('content')) {
    warnings.push({
      title: '콘텐츠 단위 통제',
      body: '채널·주제·키워드 단위 통제는 현재 상용 도구에서 지원이 얇습니다. 가장 근접한 대안은 키워드·채널 필터이며, 놓치는 영상이 생깁니다.',
    })
  }

  for (const os of userOs) {
    if (!apps.some((a) => a.os.includes(os))) {
      const label = { ios: 'iOS', android: 'Android', desktop: 'PC' }[os] ?? os
      envGaps.push({ code: os, reason: `추천 앱 중 ${label} 지원 앱이 없습니다` })
    }
  }

  for (const p of userPlatforms) {
    const covered = apps.some(
      (a) => inAppPlatforms(a).length === 0 || inAppPlatforms(a).includes(p),
    )
    if (!covered) envGaps.push({ code: p, reason: `추천 앱 중 ${p} 지원 앱이 없습니다` })
  }

  if (warnings.length || envGaps.length) {
    trace.push({
      rule: 'W · 경고·갭',
      detail: `경고 ${warnings.length}건, 환경 갭 ${envGaps.length}건`,
    })
  }

  return { warnings, envGaps }
}

// ─────────────────────────────────────────────────────────────
// rationale
// ─────────────────────────────────────────────────────────────

const GRADE_REASON = {
  1: '1순위로 고르신 방식이고, 괜찮다고 하신 개입이에요',
  2: '1순위로 고르신 방식이에요. 조금 약하다고 하셨어요',
  3: '세 가지를 채우기 위해 함께 넣었어요',
  4: '세 가지를 채우기 위해 함께 넣었어요',
  5: '세 가지를 채우기 위해 함께 넣었어요',
  6: '세 가지를 채우기 위해 함께 넣었어요',
  7: '세 가지를 채우기 위해 함께 넣었어요',
  8: '세 가지를 채우기 위해 함께 넣었어요',
  9: '세 가지를 채우기 위해 함께 넣었어요',
}

function buildRationale(featureItems, apps) {
  const featureReasons = featureItems.map((item) => ({
    code:   item.id,
    nameKo: item.nameKo,
    reason: GRADE_REASON[item.grade] ?? '',
  }))

  const appReasons = apps.map((app) => {
    const parts = []
    if (app.coverageScore > 0) parts.push(`추천 기능을 ${app.coverageScore}개 지원합니다`)
    if (app.scopeScore > 0)    parts.push('선택한 범위를 잘 지원합니다')
    if (app.envScore > 0)      parts.push('사용 환경과 잘 맞습니다')
    if (app.scheduleScore > 0) parts.push('시간 지정 기능도 있습니다')
    if (app.bypassScore > 0)   parts.push('우회 방지 기능도 갖추고 있습니다')
    return {
      id: app.id,
      shortName: app.shortName,
      reason: parts.length ? parts.join(', ') + '.' : '전반적인 적합도를 고려했습니다.',
    }
  })

  return { features: featureReasons, apps: appReasons }
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

export function recommend(state) {
  const trace = []

  const archetype = resolveArchetype(state)
  trace.push({
    rule: 'R0 · 아키타입',
    detail: `agency=${(state.agencyRank ?? [])[0] ?? '?'} × timing=${(state.timingRank ?? [])[0] ?? '?'} → 「${archetype.code}」`,
  })

  // ── F: 기능 3개 ─────────────────────────────────────────────
  const featureItems = buildFeaturePicks(state, trace)

  // feature 출력: 기능 객체 전체 + grade + code(=id 별칭, ResultCard/DetailPanel 호환)
  const features = featureItems.map((item) => ({
    ...item,
    code: item.id,
  }))

  const featureIds = features.map((f) => f.id)

  // ── A: 앱 3개 ───────────────────────────────────────────────
  const apps = buildAppPicks(state, featureIds, trace)

  // ── W: 경고·갭 ──────────────────────────────────────────────
  const { warnings, envGaps } = buildWarnings(state, apps, trace)

  const rationale = buildRationale(featureItems, apps)

  return {
    features,
    picks:   features,   // ResultCard 하위 호환

    apps,
    appRecs: apps,       // ResultCard 하위 호환

    archetype,
    rationale,
    envGaps,
    warnings,
    trace,

    resistanceLabel: RESISTANCE_LABEL,
    params: {},
    profile: {
      topWhen:       (state.timingRank ?? [])[0] ?? null,
      whenRank:      state.timingRank ?? [],
      agency:        (state.agencyRank ?? [])[0] ?? null,
      scopes:        state.scopes ?? [],
      blockedBypass: Object.entries(state.bypassWanted ?? {})
        .filter(([, v]) => v === true)
        .map(([k]) => k),
    },
    protections: [],
  }
}

// ── 하위 호환 export ──────────────────────────────────────────
export const LABELS = {
  WHEN_LABEL:   { Pre: '진입 전', At: '진입 시점', InUse: '사용 중' },
  AGENCY_LABEL: { limited: '제한형', flexible: '유연형', supported: '지원형' },
}
