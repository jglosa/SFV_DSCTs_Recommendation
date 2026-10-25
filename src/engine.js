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
    code:    '길목 안내자',
    tagline: '숏폼은 덜 끌리게, 다른 길은 더 잘 보이게 해드리는 기능',
    body: '저는 숏폼으로 가는 길목의 풍경을 바꿔요. 화면을 흑백으로 바꾸거나 썸네일을 가려서 숏폼이 덜 끌리게 하고, 지금 할 수 있는 일들이 눈에 들어오게 해요. 숏폼으로 손이 가는 건 그게 제일 하고 싶어서라기보다 그 순간 가장 눈에 띄는 게 그것뿐이어서일 때가 많거든요. 무엇을 고를지는 언제나 여러분이 정해요. 저는 고르기 좋은 풍경을 만들어둘 뿐이에요.',
    image:   archetypeImagePath('supported_Pre'),
  },
  supported_At: {
    code:    '문턱 안내자',
    tagline: '문이 열리는 순간 지금 무엇을 열었는지 알려드리는 기능', 
    body: '저는 숏폼이 열리는 문턱에 서 있어요. 확인할게 있어서 폰을 들었는데 어느새 숏폼을 보려 할 때, 짧은 메시지로 지금 무엇을 하고 있는지 알려드려요. 강제적으로 막지 않아도 무엇을 하려고 하는지 알아차리는 순간을 만들어드리면, 계속 볼지 말지는 여러분이 정할 수 있으니까요!',
    image:   archetypeImagePath('supported_At'),
  },
  supported_InUse: {
    code:    '흐름 안내자',
    tagline: '보는 동안 얼마나 왔는지 곁에서 보여드리는 기능',
    body: '저는 숏폼을 보는 흐름 옆을 함께 걸어요. 지금까지 본 시간이나 넘긴 영상 수를 화면 한쪽에 띄워두는 식이에요. 십 분쯤 지났겠지 싶었는데 한 시간이 흘러 있는 건, 영상보다 시간 감각이 흐려져서일 때가 많아요. 저는 영상을 끊지 않아요. 지금 어디쯤인지 보여드리면, 멈출 자리는 여러분이 찾아요.',
    image:   archetypeImagePath('supported_InUse'),
  },
  flexible_Pre: {
    code:    '길목 설계자',
    tagline: '숏폼까지 가는 길을 보다 복잡하게 만드는 기능',
    body: '저는 숏폼으로 가는 길이 조금 길어지도록 만들어요. 숏폼으로 곧장 갈 수 없도록 해서, 무의식적으로 향하는 발걸음을 방해해요. 길을 아예 막지는 않지만 돌아가는 길을 지나며, 지금 정말 보고 싶은건지 생각해볼 수 있어요.',
    image:   archetypeImagePath('flexible_Pre'),
  },
  flexible_At: {
    code:    '문턱 설계자',
    tagline: '숏폼이 바로 열리지 않도록 입구에 조건을 거는 기능',
    body: '저는 숏폼이 쉽게 열리지 않도록 조건을 걸어요. 몇 초를 기다리거나, 시청 이유를 적게 하는 식이에요. 조건을 충족하기 위해 멈춰선 순간이 판단의 기회가 돼요. 문을 잠그지는 않지만 쉽게 열리지 않는다면, 결정의 주체는 여러분이 될거에요.',
    image:   archetypeImagePath('flexible_At'),
  },
  flexible_InUse: {
    code:    '흐름 설계자',
    tagline: '이어지는 흐름 중간에 쉼표를 찍어주는 기능',
    body: '저는 끝없이 이어지는 영상의 흐름에 쉼표를 하나 찍어요. 보는 중간에 잠시 멈춰 세워서 무의식적으로 계속 보고있지는 않았는지 생각하게 만들어요. 강제로 끝내지는 않지만, 멈춘 자리에서 시청을 이어갈지 결정하는건 여러분의 몫이에요.',
    image:   archetypeImagePath('flexible_InUse'),
  },
  limited_Pre: {
    code:    '길목 관리자',
    tagline: '숏폼으로 들어가는 길을 아예 지워두는 기능',
    body: '저는 숏폼으로 가는 길 자체를 지워요. 쇼츠 탭이나 릴스 버튼처럼 숏폼으로 들어가는 입구를 화면에서 없애버리는 식이에요. 보이는 길은 언젠가 가게 되지만, 보이지 않는 길은 고민할 필요조차 없어요. 의지의 문제가 아니에요. 유혹이 눈앞에 나타날 일 자체를 없애두면, 그 순간마다 버티지 않아도 돼요.',
    image:   archetypeImagePath('limited_Pre'),
  },
  limited_At: {
    code:    '문턱 관리자',
    tagline: '열리지 않게 문을 잠가두는 기능',
    body: '저는 숏폼의 문을 잠가둬요. 숏폼을 보려고 클릭해도 화면이 열리지 않고, 건너뛰기나 미루기같은 예외도 두지 않아요. 유혹적인 예외 상황 없이 단호하게 잠궈두어 고민할 일 자체가 없어져요.',
    image:   archetypeImagePath('limited_At'),
  },
  limited_InUse: {
    code:    '흐름 관리자',
    tagline: '정해둔 끝에 닿으면 흐름을 확실하게 끊어내는 기능',
    body: '저는 시작할 때 정해둔 끝 지점을 지켜요. 오늘 볼 시간이나 영상 수를 정해두면, 거기에 도달하는 순간 화면을 닫아요. 그때 가서 미루자고 해도 들어드리지 않아요. 보기 시작하는 것은 자유에요. 흐름이 끝나는 자리만 미리 맡겨주시면, 마무리는 제가 확실하게 지을게요.',
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
  const hasSchedule = state.dayType === 'daily'
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
