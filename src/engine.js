// ─────────────────────────────────────────────────────────────
// 규칙 기반 추천 엔진 v4 (features.json v3.0 대응)
//
// 입력: store.js initialState 형태의 state 객체
// 출력: { features, apps, archetype, rationale, envGaps, warnings, trace, gradeTable, … }
//
// 핵심 흐름:
//   featureAccepted(level 번호) / agencyRank  →  7등급 등급화
//     → itemsForLevel                         →  기능 후보
//     → 사전식 정렬                             →  기능 3개
//     → 5점수 앱 점수화                         →  앱 3개
//
// 기능·앱은 언제나 정확히 3개를 반환한다 (§8).
// featureAccepted 키: level 번호 (1-10), 값: 'weak' | 'ok' | 'strong'
// ─────────────────────────────────────────────────────────────

import { LEVELS, INTERVENTIONS, RESISTANCE_LABEL, SCOPE_TO_L10_FEATS } from './data/features.js'
import { APPS, ROUTE_MAP, inAppPlatforms } from './data/apps.js'
import { itemsForLevel } from './store.js'

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

// ─────────────────────────────────────────────────────────────
// 기능 3개 확정
// ─────────────────────────────────────────────────────────────

/**
 * 레벨의 7등급을 결정한다. 조회표 방식.
 *
 *   i = agencyRank.indexOf(level.agency)
 *   i=0: ok→1, weak→2, strong→5
 *   i=1: ok→3, weak→4, strong→6
 *   i>=2 또는 -1 또는 응답 없음: 7
 *
 * featureAccepted 키: level.level 번호 (1-10)
 */
function levelGrade(level, state) {
  const agencyRank = state.agencyRank ?? []
  const fa = (state.featureAccepted ?? {})[level.level]

  if (fa === undefined) return 7

  const i = agencyRank.indexOf(level.agency)
  if (i === 0) {
    if (fa === 'ok')     return 1
    if (fa === 'weak')   return 2
    if (fa === 'strong') return 5
  }
  if (i === 1) {
    if (fa === 'ok')     return 3
    if (fa === 'weak')   return 4
    if (fa === 'strong') return 6
  }
  return 7
}

// ── 사전식 정렬: level 내림차순 → coverage.n 내림차순 → id 오름차순 ──
function lexSort(items) {
  return [...items].sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level
    const ca = a.coverage?.n ?? 0
    const cb = b.coverage?.n ?? 0
    if (cb !== ca) return cb - ca
    return a.id.localeCompare(b.id)
  })
}

// ── G7: agencyRank 순으로 먼저 묶고, 그 안에서 사전식 ──────────
function sortG7(items, agencyRank) {
  const rankIndex = (agency) => {
    const i = (agencyRank ?? []).indexOf(agency)
    return i === -1 ? 99 : i
  }
  return [...items].sort((a, b) => {
    const ra = rankIndex(a.agency)
    const rb = rankIndex(b.agency)
    if (ra !== rb) return ra - rb
    if (b.level !== a.level) return b.level - a.level
    const ca = a.coverage?.n ?? 0
    const cb = b.coverage?.n ?? 0
    if (cb !== ca) return cb - ca
    return a.id.localeCompare(b.id)
  })
}

/**
 * 한 레벨의 모든 후보 항목을 분석한다. DebugPanel gradeTable 전용.
 * 통과·탈락 이유까지 포함해 반환한다.
 *   items: [{ id, nameKo, when, scope, coverage, passed, dropReason }]
 *   fallback: null | 'scope' | 'timing' | 'both'
 */
function analyzeLevel(level, scopes, timingRank) {
  const dp = level.decideParams
  const candidates = INTERVENTIONS.filter((f) => f.level === level.level)

  if (candidates.length === 0) return { items: [], fallback: null }

  const makeItem = (f, passed, dropReason) => ({
    id:         f.id,
    nameKo:     f.nameKo,
    when:       f.when,
    scope:      f.scope ?? [],
    coverage:   f.coverage?.n ?? 0,
    passed,
    dropReason,
  })

  // items 를 엔진 후보 순서(coverage.n 내림차순 → id 오름차순)와 동일하게 정렬
  const sortItems = (items) =>
    [...items].sort((a, b) => {
      if (b.coverage !== a.coverage) return b.coverage - a.coverage
      return a.id.localeCompare(b.id)
    })

  // decideParams = null → 전부 통과
  if (dp === null) {
    return { items: sortItems(candidates.map((f) => makeItem(f, true, null))), fallback: null }
  }

  const useScope  = Array.isArray(dp) && dp.includes('scope')
  const useTiming = dp === 'timing' || (Array.isArray(dp) && dp.includes('timing'))

  // ── scope + timing 복합: 범위별 독립 처리 (itemsForLevel 와 동일 로직) ───
  if (useScope && useTiming && (scopes ?? []).length > 0) {
    const passedIds     = new Set()
    const timingLostIds = new Set()
    let anyTimingFallback = false

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
      if (!picked) { picked = byScope; anyTimingFallback = true }

      const pickedIds = new Set(picked.map((f) => f.id))
      byScope.forEach((f) => { if (!pickedIds.has(f.id)) timingLostIds.add(f.id) })
      picked.forEach((f) => passedIds.add(f.id))
    }

    const items = sortItems(candidates.map((f) => {
      const passed = passedIds.has(f.id)
      let dropReason = null
      if (!passed) {
        const fs = f.scope ?? []
        const matchesAnyScope = fs.length === 0 || fs.some((s) => (scopes ?? []).includes(s))
        dropReason = matchesAnyScope ? 'timing 밀림' : 'scope 불일치'
      }
      return makeItem(f, passed, dropReason)
    }))

    return { items, fallback: anyTimingFallback ? 'timing' : null }
  }

  // ── scope 필터 ──────────────────────────────────────────────
  let pool = candidates
  const scopeDropped = new Set()
  let scopeFallback = false

  if (useScope && (scopes ?? []).length > 0) {
    const filtered = candidates.filter((f) => {
      const fs = f.scope ?? []
      return fs.length === 0 || fs.some((s) => (scopes ?? []).includes(s))
    })
    if (filtered.length > 0) {
      const passedIds = new Set(filtered.map((f) => f.id))
      candidates.forEach((f) => { if (!passedIds.has(f.id)) scopeDropped.add(f.id) })
      pool = filtered
    } else {
      scopeFallback = true
    }
  }

  // ── timing 필터 ─────────────────────────────────────────────
  const timingDropped = new Set()
  let timingFallback = false

  if (useTiming) {
    const ranks = timingRank ?? []
    let found = false
    for (const when of ranks) {
      const byTiming = pool.filter((f) => f.when === when)
      if (byTiming.length > 0) {
        const passedIds = new Set(byTiming.map((f) => f.id))
        pool.forEach((f) => { if (!passedIds.has(f.id)) timingDropped.add(f.id) })
        pool = byTiming
        found = true
        break
      }
    }
    if (!found) timingFallback = true
  }

  const passedIds = new Set(pool.map((f) => f.id))

  const items = sortItems(candidates.map((f) => {
    const passed = passedIds.has(f.id)
    let dropReason = null
    if (!passed) {
      if (scopeDropped.has(f.id))       dropReason = 'scope 불일치'
      else if (timingDropped.has(f.id)) dropReason = 'timing 밀림'
    }
    return makeItem(f, passed, dropReason)
  }))

  let fallback = null
  if (scopeFallback && timingFallback) fallback = 'both'
  else if (scopeFallback)              fallback = 'scope'
  else if (timingFallback)             fallback = 'timing'

  return { items, fallback }
}

/**
 * 레벨 10개의 등급표를 생성한다. DebugPanel 전용.
 * gradeTable: [{level, nameKo, agency, rank, answer, grade, decideParams,
 *               items:[{id,nameKo,when,scope,coverage,passed,dropReason,picked}],
 *               fallback}]
 * G 오름차순. G7은 agencyRank 순 우선, 나머지는 level 내림차순.
 */
function buildGradeTable(state, pickedIds) {
  const agencyRank = state.agencyRank ?? []
  const scopes = state.scopes ?? []
  const timingRank = state.timingRank ?? []
  const accepted = state.featureAccepted ?? {}

  const rankIndex = (agency) => {
    const i = agencyRank.indexOf(agency)
    return i === -1 ? 99 : i
  }

  const rows = LEVELS.map((level) => {
    const grade = levelGrade(level, state)
    const rank = agencyRank.indexOf(level.agency)
    const answer = accepted[level.level] ?? null
    const { items: rawItems, fallback } = analyzeLevel(level, scopes, timingRank)
    const items = rawItems.map((it) => ({ ...it, picked: pickedIds.includes(it.id) }))

    return {
      level:        level.level,
      nameKo:       level.nameKo,
      agency:       level.agency,
      rank,
      answer,
      grade,
      decideParams: level.decideParams,
      items,
      fallback,
    }
  })

  // G7 은 agencyRank 순 우선, 나머지는 level 내림차순
  return rows.sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade
    if (a.grade === 7) {
      const ra = rankIndex(a.agency)
      const rb = rankIndex(b.agency)
      if (ra !== rb) return ra - rb
    }
    return b.level - a.level
  })
}

/**
 * 기능 3개 확정.
 * G1→G7 순으로 레벨을 순회하며 itemsForLevel 로 후보를 수집.
 * 동일 등급 내 정렬: level 내림차순 → coverage.n 내림차순 → id 오름차순.
 * G7 은 agencyRank 순으로 먼저 묶은 뒤 사전식 정렬.
 */
function buildFeaturePicks(state, trace) {
  const agencyRank = state.agencyRank ?? []
  const scopes = state.scopes ?? []
  const timingRank = state.timingRank ?? []

  const levelsWithGrade = LEVELS.map((level) => ({ level, grade: levelGrade(level, state) }))

  const candidates = []
  const usedIds = new Set()

  for (const grade of [1, 2, 3, 4, 5, 6, 7]) {
    const gradeLevels = levelsWithGrade
      .filter((g) => g.grade === grade)
      .map((g) => g.level)

    const gradeItems = gradeLevels.flatMap((level) =>
      itemsForLevel(level, scopes, timingRank)
    )

    const sorted = grade === 7
      ? sortG7(gradeItems, agencyRank)
      : lexSort(gradeItems)

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

function computeAppScore(app, state, featureIds, userMobileOs) {
  const env = state.env ?? {}
  const userOs = env.os ?? []
  const userPlatforms = env.platforms ?? []
  const userRoute = env.route ?? []
  const scopes = state.scopes ?? []
  const bypass = state.bypassWanted ?? {}

  // (0) OS 완전 지원: userMobileOs 의 모든 OS 를 앱이 지원하면 1, 아니면 0
  // userMobileOs 가 비어 있으면(desktop 만 등) 모든 앱에 1 — 갈림을 만들지 않는다
  const osFullScore =
    userMobileOs.length === 0 || userMobileOs.every((o) => app.os.includes(o)) ? 1 : 0

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

  return { osFullScore, coverageScore, coveredIds, scopeScore, envScore, scheduleScore, bypassScore }
}

function buildAppPicks(state, featureIds, trace) {
  // OS 필터: ios / android 를 하나라도 고른 경우에만 교집합이 있는 앱만 후보로 둔다.
  // 'desktop' 은 app.os 에 없으므로 비교 대상에서 제외한다.
  // ios / android 가 하나도 없으면(desktop 만 선택 등) 필터를 적용하지 않는다.
  const userMobileOs = (state.env?.os ?? []).filter((o) => o === 'ios' || o === 'android')
  const pool = userMobileOs.length > 0
    ? APPS.filter((app) => app.os.some((o) => userMobileOs.includes(o)))
    : APPS

  const scored = pool.map((app) => ({
    ...app,
    ...computeAppScore(app, state, featureIds, userMobileOs),
  }))

  scored.sort((a, b) => {
    if (b.osFullScore    !== a.osFullScore)    return b.osFullScore    - a.osFullScore
    if (b.coverageScore  !== a.coverageScore)  return b.coverageScore  - a.coverageScore
    if (b.scopeScore     !== a.scopeScore)     return b.scopeScore     - a.scopeScore
    if (b.envScore       !== a.envScore)       return b.envScore       - a.envScore
    if (b.scheduleScore  !== a.scheduleScore)  return b.scheduleScore  - a.scheduleScore
    if (b.bypassScore    !== a.bypassScore)    return b.bypassScore    - a.bypassScore
    return a.id.localeCompare(b.id)
  })

  if (scored.length < 3) {
    console.error(
      `[engine] buildAppPicks: 후보 ${scored.length}개 — 3개 미만 (OS 필터 결과).`,
    )
  }

  trace.push({
    rule: 'A · 앱 점수 상위 5',
    detail: scored
      .slice(0, 5)
      .map(
        (a) =>
          `${a.id}(OS${a.osFullScore}|C${a.coverageScore}|S${a.scopeScore}|E${a.envScore}|Sc${a.scheduleScore}|B${a.bypassScore})`,
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
// rationale — 앱 쪽만 유지
// ─────────────────────────────────────────────────────────────

function buildRationale(apps) {
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

  return { features: [], apps: appReasons }
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

  // ── 등급표 (DebugPanel 전용) ─────────────────────────────────
  const gradeTable = buildGradeTable(state, featureIds)

  // ── A: 앱 3개 ───────────────────────────────────────────────
  const apps = buildAppPicks(state, featureIds, trace)

  // ── W: 경고·갭 ──────────────────────────────────────────────
  const { warnings, envGaps } = buildWarnings(state, apps, trace)

  const rationale = buildRationale(apps)

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

    gradeTable,

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
