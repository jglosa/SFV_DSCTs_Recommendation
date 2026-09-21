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

import { LEVELS, INTERVENTIONS, RESISTANCE_LABEL } from './data/features.js'
import { APPS, ROUTE_MAP, inAppPlatforms } from './data/apps.js'
import { itemsForLevel } from './store.js'

// ── 아키타입 (agencyRank[0] × timingRank[0]) ───────────────────
// 키에서 이미지 경로 생성: 소문자 + InUse→in, _default→default
// 예) supported_InUse → archetypes/supported_in.png
function archetypeImagePath(key) {
  const slug = key === '_default'
    ? 'default'
    : key.toLowerCase().replace('inuse', 'in')
  return `${import.meta.env.BASE_URL}archetypes/${slug}.png`
}

const ARCHETYPE_MAP = {
  supported_Pre: {
    code:    '배치 조정가',
    tagline: '손에 덜 닿는 곳에 두면 덜 집게 됩니다',
    body:    '당신은 의지로 참기보다 환경을 바꾸는 쪽을 택합니다. 눈에 덜 띄고 손이 덜 가면 그걸로 충분하다고 봅니다. 강제로 막는건 오히려 반발을 만든다고 생각합니다.',
    image:   archetypeImagePath('supported_Pre'),
  },
  supported_At: {
    code:    '입구 안내자',
    tagline: '들어갈 때 한 번 소리가 나면 됩니다',
    body:    '당신은 강제로 막히는 것을 원하지 않습니다. 다만 무심코 열었다는 걸 그 순간에 알고 싶어 합니다. 알아차리기만 하면 그다음은 스스로 정할 수 있다고 믿습니다.',
    image:   archetypeImagePath('supported_At'),
  },
  supported_InUse: {
    code:    '시간 감지자',
    tagline: '얼마나 지났는지 알면 멈출 수 있습니다',
    body:    '당신은 숏폼을 보는 것 자체를 문제로 보지 않습니다. 문제는 시간 감각을 잃는 것입니다. 지금 얼마나 왔는지 보이면 스스로 끊을 수 있다고 생각합니다.',
    image:   archetypeImagePath('supported_InUse'),
  },
  flexible_Pre: {
    code:    '거리 설계가',
    tagline: '한 번 더 돌아가게 하면 발길이 줄어듭니다',
    body:    '당신은 길을 막기보다 멀게 만드는 쪽을 택합니다. 가려면 갈 수 있지만 한 번 더 거쳐야 한다면, 그 사이에 마음이 바뀔 여지가 생긴다고 봅니다.',
    image:   archetypeImagePath('flexible_Pre'),
  },
  flexible_At: {
    code:    '관문 설계자',
    tagline: '열리긴 하되 그냥 열리진 않아야 합니다',
    body:    '당신은 완전히 잠그는 것까지는 원하지 않습니다. 다만 손이 저절로 가는 흐름은 끊겨야 한다고 봅니다. 한 번 힘을 들여야 열린다면 그 자체가 판단의 순간이 됩니다.',
    image:   archetypeImagePath('flexible_At'),
  },
  flexible_InUse: {
    code:    '중간 점검자',
    tagline: '보다가도 한 번은 멈춰 세워져야 합니다',
    body:    '당신은 시작을 막는 것보다 이어지는 것을 끊는 데 관심이 있습니다. 한 편이 열 편이 되기 전에 누군가 물어봐 주기를 바랍니다.',
    image:   archetypeImagePath('flexible_InUse'),
  },
  limited_Pre: {
    code:    '경계 차단자',
    tagline: '애초에 길이 없으면 고민할 일도 없습니다',
    body:    '당신은 그 순간의 자신을 믿지 않습니다. 대신 여유 있을 때 정한 규칙이 나중까지 버텨주기를 기대합니다. 유혹 앞에서 고르는 것보다 고를 일이 없는 편이 낫다고 봅니다.',
    image:   archetypeImagePath('limited_Pre'),
  },
  limited_At: {
    code:    '입구 봉쇄자',
    tagline: '열려고 하면 열리지 않아야 합니다',
    body:    '당신은 통과할 수 있는 절차라면 결국 통과하게 된다고 봅니다. 손이 가는 건 막을 수 없더라도, 그 손이 닿는 곳이 닫혀 있어야 한다고 생각합니다.',
    image:   archetypeImagePath('limited_At'),
  },
  limited_InUse: {
    code:    '종료 집행자',
    tagline: '시작은 몰라도 끝은 정해져 있어야 합니다',
    body:    '당신은 보기 시작하는 것까지는 막지 않아도 된다고 봅니다. 다만 한번 시작하면 스스로 멈추기 어렵다는 것을 알기에, 정해진 지점에서 끊기기를 바랍니다.',
    image:   archetypeImagePath('limited_InUse'),
  },
  _default: {
    code:    '방향 탐색자',
    tagline: '아직 어느 쪽이 맞는지 고르는 중입니다',
    body:    '추천된 기능을 하나씩 겪어보세요. 써보면서 나에게 맞는 방식이 드러납니다.',
    image:   archetypeImagePath('_default'),
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
 *   Level의 Grade 결정
 *
 *   i = agencyRank.indexOf(level.agency) -> agency level 순위
 *   i=0: ok→1, weak→2, strong→5 -> 1순위
 *   i=1: ok→3, weak→4, strong→6 -> 2순위 
 *   i>=2 또는 -1 또는 응답 없음: 7 -> 3순위 혹은 응답 없음
 *
 * featureAccepted 키: level.level 번호 (1-10)
 */
function levelGrade(level, state) {
  const agencyRank = state.agencyRank ?? []
  const fa = (state.featureAccepted ?? {})[level.level] // feature accepted 응답

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

// ── intervention ordering: level 내림차순 → coverage.n 내림차순 → id 오름차순 ──
// 한 Grade 안의 모든 features를 받아서 정렬 
function lexSort(items) {
  return [...items].sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level // level 내림차순 -> 강한 개입 먼저
    const ca = a.coverage?.n ?? 0
    const cb = b.coverage?.n ?? 0
    if (cb !== ca) return cb - ca // 같은 레벨 안에서는 지원 앱 수 많은것 먼저
    return a.id.localeCompare(b.id) // 전부 같으면 id 오름차순 
  })
}

// ── G7만 agencyRank 순으로 정렬하는 단계 가장 앞에 추가 + 이후는 lexSort와 같음 ────────
function sortG7(items, agencyRank) {
  const rankIndex = (agency) => {
    const i = (agencyRank ?? []).indexOf(agency)
    return i === -1 ? 99 : i
  }
  return [...items].sort((a, b) => {
    const ra = rankIndex(a.agency)
    const rb = rankIndex(b.agency)
    if (ra !== rb) return ra - rb // agencyRank순으로 먼저 묶음
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
 * G1→G7 순으로 Grade를 순회하며 itemsForLevel 로 후보를 수집.
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

  for (const grade of [1, 2, 3, 4, 5, 6, 7]) { // Grade 순회하며 내부 featuer 후보 수집
    const gradeLevels = levelsWithGrade
      .filter((g) => g.grade === grade)
      .map((g) => g.level)

    const gradeItems = gradeLevels.flatMap((level) =>
      itemsForLevel(level, scopes, timingRank)
    )

    const sorted = grade === 7 // 각 Grade 내부 feature의 sorting. G7의 경우에만 다른 sorting 함수 사용
      ? sortG7(gradeItems, agencyRank)
      : lexSort(gradeItems)

    for (const item of sorted) { // 중복제거
      if (!usedIds.has(item.id)) {
        usedIds.add(item.id)
        candidates.push({ ...item, grade })
      }
    }

    if (candidates.length >= 3) break // 3개 이상이면 Grade 순회 종료
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

  // (0) OS 매칭 수: userMobileOs 중 app.os 에 포함된 개수.
  // userMobileOs 가 비어 있으면 0 으로 통일 — 모바일 OS 미선택 시 갈림 없음.
  const osMatchCount = userMobileOs.length === 0
    ? 0
    : userMobileOs.filter((o) => app.os.includes(o)).length

  // (1) 커버리지: 추천 기능 id 중 app.features 에 포함된 수 
  const coveredIds = featureIds.filter((fid) => (app.features ?? []).includes(fid))
  const coverageScore = coveredIds.length

  // (2) 범위 적합도: 참가자가 고른 범위 중 app 이외의 범위가 하나라도 있고
  // inAppPlatforms(app) 가 비어 있지 않으면 1, 아니면 0.
  // app 범위만 선택한 경우 모든 앱에 1 (갈림 없음).
  const nonAppScopes = scopes.filter((s) => s !== 'app')
  const scopeScore =
    scopes.length > 0 && nonAppScopes.length === 0
      ? 1  // app 만 선택 → 모든 앱 동점
      : nonAppScopes.length > 0 && inAppPlatforms(app).length > 0
        ? 1
        : 0

  // (3) 환경 적합도
  let envScore = 0
  const normalRoutes = [...new Set(userRoute.map((r) => ROUTE_MAP[r]).filter(Boolean))]
  envScore += normalRoutes.filter((rt) => (app.worksOn ?? []).includes(rt)).length
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

  return { osMatchCount, coverageScore, coveredIds, scopeScore, envScore, scheduleScore, bypassScore }
}

function buildAppPicks(state, featureIds, trace) {
  // App 정렬해 상위 3개를 선택한다.
  const userMobileOs = (state.env?.os ?? []).filter((o) => o === 'ios' || o === 'android') // 참가자가 고른 OS 중 하나라도 지원하는 앱만 남김
  const pool = userMobileOs.length > 0
    ? APPS.filter((app) => app.os.some((o) => userMobileOs.includes(o)))
    : APPS

  const scored = pool.map((app) => ({ // 각 앱의 점수 계산 
    ...app,
    ...computeAppScore(app, state, featureIds, userMobileOs),
  }))

  scored.sort((a, b) => { // 점수별로 앱 내림차순 정렬
    if (b.coverageScore  !== a.coverageScore)  return b.coverageScore  - a.coverageScore
    if (b.osMatchCount   !== a.osMatchCount)   return b.osMatchCount   - a.osMatchCount
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

  const picks = scored.slice(0, 3)
  const pickedIds = new Set(picks.map((a) => a.id))

  trace.push({
    rule: 'A · 앱 점수 상위 5',
    detail: scored
      .slice(0, 5)
      .map(
        (a) =>
          `${a.id}(OS${a.osMatchCount}|C${a.coverageScore}|S${a.scopeScore}|E${a.envScore}|Sc${a.scheduleScore}|B${a.bypassScore})`,
      )
      .join(' | '),
  })

  // appTable: 필터 통과 앱 전체를 정렬 순서대로 (DebugPanel 전용)
  const appTable = {
    userMobileOs,
    poolSize: pool.length,
    excludedIds: APPS.filter((a) => !pool.includes(a)).map((a) => a.id),
    rows: scored.map((a) => ({
      id:            a.id,
      shortName:     a.shortName,
      os:            a.os,
      osMatchCount:  a.osMatchCount,
      coverageScore: a.coverageScore,
      scopeScore:    a.scopeScore,
      envScore:      a.envScore,
      scheduleScore: a.scheduleScore,
      bypassScore:   a.bypassScore,
      picked:        pickedIds.has(a.id),
    })),
  }

  return { picks, appTable }
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

  // 플랫폼 갭: 참가자가 app 이외 범위를 고른 경우 inAppPlatforms 에 실제로 포함된 앱만 커버로 본다.
  // app 범위만 선택하거나 범위를 고르지 않았으면 앱 단위 차단으로 커버된다고 본다 (기존 로직 유지).
  const nonAppScopes = scopes.filter((s) => s !== 'app')
  for (const p of userPlatforms) {
    const covered = apps.some((a) => {
      if (nonAppScopes.length === 0) {
        // app 범위만 or 범위 미선택: inAppPlatforms 비어도 커버 (앱 단위 차단)
        return inAppPlatforms(a).length === 0 || inAppPlatforms(a).includes(p)
      }
      // app 이외 범위 있음: 인앱 필터가 실제로 그 플랫폼을 지원해야 커버
      return inAppPlatforms(a).includes(p)
    })
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

  // ── A: 앱 3개 + appTable ──────────────────────────────────────
  const { picks: apps, appTable } = buildAppPicks(state, featureIds, trace)

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
    appTable,

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
