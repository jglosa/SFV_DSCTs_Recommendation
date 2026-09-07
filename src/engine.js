// ─────────────────────────────────────────────────────────────
// 규칙 기반 추천 엔진 v3
//
// 입력: store.js initialState 형태의 state 객체
// 출력: { features, apps, archetype, rationale, envGaps, warnings, trace, … }
//
// 핵심 흐름:
//   featureAccepted / oxStatus / agencyRank  →  9등급 rung 후보풀
//     → resolveRungCode                      →  기능 코드 3개
//     → 5점수 앱 점수화                       →  앱 3개
//
// 기능·앱은 언제나 정확히 3개를 반환한다 (§8).
// featureAccepted 값: 'weak' | 'ok' | 'strong'
// ─────────────────────────────────────────────────────────────

import { LADDER, FEATURE_BY_ID, RESISTANCE_LABEL, description } from './data/features.js'
import { APPS } from './data/apps.js'
import { oxStatus, resolveRungCode, recommendationKey, displayName } from './store.js'

// ── 아키타입 (agencyRank[0] × timingRank[0]) ───────────────────
// ResultCard.jsx 가 archetype.code / tagline / body 를 읽는다.
const ARCHETYPE_MAP = {
  // ── supported (알아차림·알림 중심) ────────────────────────────
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
  // ── flexible (조건부 마찰 중심) ────────────────────────────────
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
  // ── limited (경로 차단 중심) ────────────────────────────────────
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
  // ── 기본값 ───────────────────────────────────────────────────
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

// ── 경로 정규화 (한국어 → 'app'|'web') ──────────────────────────
const ROUTE_MAP = {
  '앱': 'app',
  '웹브라우저': 'web',
}

// ── 우회 방지 기능 매핑 ───────────────────────────────────────────
const BYPASS_FEAT_MAP = {
  B1: ['4.1.1', '4.1.2'],
  B2: ['4.1.1'],
  B3: ['4.2'],
  B4: ['4.3'],
}

// ─────────────────────────────────────────────────────────────
// 기능 3개 확정
// ─────────────────────────────────────────────────────────────

/**
 * exploreVisible=false rung의 부모를 반환한다.
 * 부모: 같은 order + 같은 agency + exploreVisible=true 인 rung.
 */
function findParentRung(rung) {
  if (rung.exploreVisible) return rung
  return (
    LADDER.find(
      (r) =>
        r.id !== rung.id &&
        r.agency === rung.agency &&
        r.order === rung.order &&
        r.exploreVisible,
    ) ?? rung
  )
}

/**
 * rung의 9등급을 결정한다.
 *
 *   G1: agencyRank[0] + 'ok'  또는 limited가 1순위
 *   G2: agencyRank[0] + 'weak'
 *   G3: agencyRank[1] + 'ok'
 *   G4: agencyRank[1] + 'weak'
 *   G5: agencyRank[2] + 'ok'
 *   G6: agencyRank[2] + 'weak'
 *   G7: oxStatus='skipped' 또는 limited가 2·3순위 (판단하지 않음)
 *   G8: oxStatus='unvisited' agency의 rung
 *   G9: 'strong'(거부)을 준 rung — 레벨과 무관하게 최하위
 *
 * limited 처리:
 *   - agencyRank[0](1순위): 참가자가 명시적으로 선택한 것 → G1
 *   - agencyRank[1] 또는 [2]: OX가 없어 판단 근거가 없음 → G7(skipped와 동일)
 *   자동 ok 취급이 아니다. 1순위 선택이 유일한 수용 근거다.
 *
 * 레벨 순위가 응답 값보다 앞선다.
 * exploreVisible=false rung은 부모 rung 기준으로 판정한다.
 */
function rungGrade(rung, state) {
  const agencyRank = state.agencyRank ?? []
  const accepted = state.featureAccepted ?? {}

  // exploreVisible=false rung은 부모 rung 기준으로 등급 결정
  const ref = rung.exploreVisible ? rung : findParentRung(rung)
  const fa = accepted[ref.id]

  // G1~G6: agencyRank[i] × ('ok' | 'weak')
  for (let i = 0; i < 3; i++) {
    const agencyAtRank = agencyRank[i]
    if (!agencyAtRank) break
    if (ref.agency === agencyAtRank) {
      if (fa === 'ok') return i * 2 + 1              // G1, G3, G5
      if (fa === 'weak') return i * 2 + 2            // G2, G4, G6
      // limited: OX 없음. 1순위 선택 → G1. 2·3순위 → G7(skipped 동급)
      if (ref.agency === 'limited') return i === 0 ? 1 : 7
    }
  }

  // G9: 명시적 거부 ('strong' = 너무 강하다, 레벨 순위 밖에서 최하위)
  if (fa === 'strong') return 9

  // G7 / G8: oxStatus 기반
  const st = oxStatus(state, ref.agency)
  if (st === 'skipped') return 7
  // 'unvisited' 또는 answered이지만 이 rung은 값 없음 → G8
  return 8
}

// ── 정렬 가중치 — 조정할 때 이 두 값만 바꾼다 ──────────────────
const SORT_WEIGHT_ORDER    = 0.6   // 강도(order) 가중치
const SORT_WEIGHT_COVERAGE = 0.4   // 앱 지원 수(coverage.n) 가중치

/**
 * rung 정렬 함수 팩토리.
 * 같은 등급 안에서 아래 점수로 내림차순 정렬한다.
 *   score = SORT_WEIGHT_ORDER × (order / maxOrder)
 *         + SORT_WEIGHT_COVERAGE × (coverage.n / maxCoverage)
 *
 * maxOrder / maxCoverage 는 전달받은 rungs 집합 안에서 계산한다(하드코딩 없음).
 * 동점이면 order 내림차순 → id 오름차순(안정 정렬).
 *
 * 주의: exploreVisible=false rung(L8+capture, L8+altapp 등)은
 *   등급(grade) 판정은 부모 rung 기준으로 받지만(findParentRung 참조),
 *   정렬 점수는 자기 자신의 coverage.n을 사용한다. 의도된 불일치.
 */
function makeSortFn(rungs) {
  const maxOrder    = Math.max(...rungs.map((r) => r.order), 1)
  const maxCoverage = Math.max(...rungs.map((r) => r.coverage?.n ?? 0), 1)
  const score = (r) =>
    SORT_WEIGHT_ORDER    * (r.order            / maxOrder) +
    SORT_WEIGHT_COVERAGE * ((r.coverage?.n ?? 0) / maxCoverage)
  return (a, b) => {
    const ds = score(b) - score(a)
    if (Math.abs(ds) > 1e-9) return ds           // 점수 내림차순
    if (b.order !== a.order) return b.order - a.order  // 동점 시 order 내림차순
    return a.id.localeCompare(b.id)              // 마지막 tie-break: id 오름차순
  }
}

/**
 * G7~G9용 정렬: agencyRank 순서로 묶고, 그 안에서 가중합 정렬.
 * agencyRank에 없는 agency는 맨 뒤.
 * maxOrder / maxCoverage 는 전체 rungs 집합 기준(동일 척도로 비교).
 */
function sortByAgencyRank(rungs, agencyRank) {
  const rankIndex = (agency) => {
    const i = agencyRank.indexOf(agency)
    return i === -1 ? 99 : i
  }
  const sortFn = makeSortFn(rungs)   // 전체 집합 기준 max
  const byAgency = {}
  for (const r of rungs) {
    ;(byAgency[r.agency] ??= []).push(r)
  }
  const sortedAgencies = Object.keys(byAgency).sort(
    (a, b) => rankIndex(a) - rankIndex(b),
  )
  const result = []
  for (const agency of sortedAgencies) {
    result.push(...byAgency[agency].sort(sortFn))
  }
  return result
}

/**
 * rung → 추천 item 배열로 변환.
 * item: { rung, code, scope, taskGroup, key }
 *
 * resolveBy='scope+timing' → scopes 순서대로 1개씩.
 * 그 외 → 단일 code.
 */
function resolveRungToItems(rung, state) {
  const scopes = state.scopes ?? []
  const timingRank = state.timingRank ?? []
  const items = []

  try {
    if (rung.resolveBy === 'scope+timing') {
      const codes = resolveRungCode(rung, scopes, timingRank)
      const codeArr = Array.isArray(codes) ? codes : [codes]
      for (let i = 0; i < codeArr.length; i++) {
        const code = codeArr[i]
        const scope = scopes[i] ?? null
        const taskGroup = rung.taskGroup ?? null
        const key = recommendationKey({ code, scope, taskGroup })
        if (FEATURE_BY_ID[code]) items.push({ rung, code, scope, taskGroup, key })
      }
    } else {
      const result = resolveRungCode(rung, scopes, timingRank)
      const code = Array.isArray(result) ? result[0] : result
      const taskGroup = rung.taskGroup ?? null
      const key = recommendationKey({ code, scope: null, taskGroup })
      if (FEATURE_BY_ID[code]) items.push({ rung, code, scope: null, taskGroup, key })
    }
  } catch (e) {
    // resolve 실패 — 개발 중에 드러나도록 경고를 남긴다
    console.warn(`[engine] resolveRungToItems ${rung.id} 실패:`, e.message)
  }

  return items
}

/**
 * 기능 3개 확정.
 *
 * G1 → G2 → … → G9 순으로 후보를 쌓는다.
 * 각 등급 안에서는 가중합 점수(SORT_WEIGHT_ORDER × order + SORT_WEIGHT_COVERAGE × coverage.n)로 정렬.
 *   - G1~G6: 등급 자체가 agency를 특정하므로 단순 가중합 정렬
 *   - G7~G9: agencyRank 순서로 agency 묶기, 그 안에서 가중합 정렬
 * 3개가 채워지면 더 낮은 등급은 보지 않는다.
 */
function buildFeaturePicks(state, trace) {
  const agencyRank = state.agencyRank ?? []
  const rungs = LADDER.map((rung) => ({ rung, grade: rungGrade(rung, state) }))

  const candidates = []
  const usedKeys = new Set()

  for (const grade of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const gradeRungs = rungs.filter((r) => r.grade === grade).map((r) => r.rung)

    const sorted =
      grade >= 7
        ? sortByAgencyRank(gradeRungs, agencyRank)
        : [...gradeRungs].sort(makeSortFn(gradeRungs))

    for (const rung of sorted) {
      for (const item of resolveRungToItems(rung, state)) {
        if (!usedKeys.has(item.key)) {
          usedKeys.add(item.key)
          candidates.push({ ...item, grade })
        }
      }
    }

    if (candidates.length >= 3) break
  }

  trace.push({
    rule: 'F · 기능 후보 (상위 6)',
    detail: candidates
      .slice(0, 6)
      .map((c) => `${c.rung.id}(G${c.grade})→${c.code}`)
      .join(', '),
  })

  // §8: 항상 3개. 데이터 이상으로 3개 미만이면 있는 것만 반환.
  return candidates.slice(0, 3)
}

// ─────────────────────────────────────────────────────────────
// 앱 3개 확정
// ─────────────────────────────────────────────────────────────

function computeAppScore(app, state, featureCodes) {
  const env = state.env ?? {}
  const userOs = env.os ?? []
  const userPlatforms = env.platforms ?? []
  const userRoute = env.route ?? []
  const scopes = state.scopes ?? []
  const bypass = state.bypassWanted ?? {}

  // (1) 커버리지: 추천 기능 코드 중 앱이 지원하는 수
  const coveredCodes = featureCodes.filter((c) => app.features.includes(c))
  const coverageScore = coveredCodes.length

  // (2) 범위 적합도: 사용자 플랫폼 × scope → full=2, partial=1
  let scopeScore = 0
  for (const p of userPlatforms) {
    const ps = app.scope?.[p]
    if (!ps) continue
    for (const s of scopes) {
      const lv = ps[s]
      if (lv === 'full') scopeScore += 2
      else if (lv === 'partial') scopeScore += 1
    }
  }

  // (3) 환경 적합도: OS 교집합 + 경로 일치 + 인앱 플랫폼 교집합 + devices
  let envScore = 0
  envScore += userOs.filter((o) => app.os.includes(o)).length
  const normalRoutes = [...new Set(userRoute.map((r) => ROUTE_MAP[r]).filter(Boolean))]
  for (const rt of normalRoutes) {
    if (app.route === rt || app.route === 'app+web') envScore += 1
  }
  if (app.inAppPlatforms.length > 0) {
    envScore += userPlatforms.filter((p) => app.inAppPlatforms.includes(p)).length
  }
  // S0 devices 에 PC·노트북 선택 + 앱이 PC 지원 → 가점
  if (userOs.includes('desktop') && (app.devices ?? '').includes('PC')) envScore += 1

  // (4) 스케줄: 사용자가 시간 지정 방식 원하고 앱이 1.2.1 지원
  const hasSchedule = state.dayType === 'daily' || state.dayType === 'split'
  const scheduleScore = hasSchedule && app.features.includes('1.2.1') ? 1 : 0

  // (5) 우회 방지 tie-break: bypassWanted=true 항목 중 대응 기능 보유
  let bypassScore = 0
  for (const [bk, bv] of Object.entries(bypass)) {
    if (bv === true && (BYPASS_FEAT_MAP[bk] ?? []).some((f) => app.features.includes(f))) {
      bypassScore++
    }
  }

  return { coverageScore, coveredCodes, scopeScore, envScore, scheduleScore, bypassScore }
}

/**
 * 앱 3개 확정.
 * 정렬: coverageScore↓ → scopeScore↓ → envScore↓ → scheduleScore↓ → bypassScore↓ → id↑
 * §8: 항상 3개 반환.
 */
function buildAppPicks(state, featureCodes, trace) {
  const scored = APPS.map((app) => ({
    ...app,
    ...computeAppScore(app, state, featureCodes),
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

  // content 범위 선택 경고 (§5)
  if (scopes.includes('content')) {
    warnings.push({
      title: '콘텐츠 단위 통제',
      body: '채널·주제·키워드 단위 통제는 현재 상용 도구에서 지원이 얇습니다. 가장 근접한 대안은 키워드·채널 필터이며, 놓치는 영상이 생깁니다.',
    })
  }

  // OS 갭
  for (const os of userOs) {
    if (!apps.some((a) => a.os.includes(os))) {
      const label = { ios: 'iOS', android: 'Android', desktop: 'PC' }[os] ?? os
      envGaps.push({ code: os, reason: `추천 앱 중 ${label} 지원 앱이 없습니다` })
    }
  }

  // 플랫폼 갭
  for (const p of userPlatforms) {
    const covered = apps.some(
      (a) => a.inAppPlatforms.length === 0 || a.inAppPlatforms.includes(p),
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
// rationale (한국어 서술 — 코드·ID·점수 미노출)
// ─────────────────────────────────────────────────────────────

// 등급별 rationale 문구 — 3단 척도(weak/ok/strong) 기반
const GRADE_REASON = {
  1: '직접 괜찮다고 하신 기능이에요.',                              // agencyRank[0] + ok
  2: '조금 약하다고 하셨지만, 가장 선호한 방식에 속해요.',           // agencyRank[0] + weak
  3: '직접 괜찮다고 하신 기능이에요.',                              // agencyRank[1] + ok
  4: '조금 약하다고 하셨지만, 선호하신 방식에 속해요.',             // agencyRank[1] + weak
  5: '직접 괜찮다고 하신 기능이에요.',                              // agencyRank[2] + ok
  6: '조금 약하다고 하셨지만, 선호하신 방식에 속해요.',             // agencyRank[2] + weak
  7: '건너뛴 레벨에서 가져온 방식입니다.',
  8: '아직 확인하지 않은 레벨에서 가져온 방식입니다.',
  9: '선호보다 센 편이지만 세 가지를 채우기 위해 넣었어요.',         // strong
}

function buildRationale(featureItems, apps) {
  const featureReasons = featureItems.map((item) => ({
    code: item.code,
    nameKo: displayName(item),
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
      reason: parts.length
        ? parts.join(', ') + '.'
        : '전반적인 적합도를 고려했습니다.',
    }
  })

  return { features: featureReasons, apps: appReasons }
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

export function recommend(state) {
  const trace = []

  // ── R0: 아키타입 ────────────────────────────────────────────
  const archetype = resolveArchetype(state)
  trace.push({
    rule: 'R0 · 아키타입',
    detail: `agency=${(state.agencyRank ?? [])[0] ?? '?'} × timing=${(state.timingRank ?? [])[0] ?? '?'} → 「${archetype.keyword}」`,
  })

  // ── F: 기능 3개 ─────────────────────────────────────────────
  const featureItems = buildFeaturePicks(state, trace)

  // item → 결과 객체 (nameKo는 variant 우선)
  const features = featureItems.map((item) => {
    const f = FEATURE_BY_ID[item.code]
    return {
      code:      item.code,
      nameKo:    displayName(item),
      descKo:    description(item),
      agency:    item.rung.agency,
      order:     item.rung.order,
      scope:     item.scope,
      taskGroup: item.taskGroup,
      grade:     item.grade,
    }
  })

  const featureCodes = features.map((f) => f.code)

  // ── A: 앱 3개 ───────────────────────────────────────────────
  const apps = buildAppPicks(state, featureCodes, trace)

  // ── W: 경고·갭 ──────────────────────────────────────────────
  const { warnings, envGaps } = buildWarnings(state, apps, trace)

  // ── rationale ───────────────────────────────────────────────
  const rationale = buildRationale(featureItems, apps)

  return {
    // ── 기능 ──
    features,
    picks: features,      // ResultCard 하위 호환 별칭

    // ── 앱 ──
    apps,
    appRecs: apps,        // ResultCard 하위 호환 별칭

    // ── 아키타입 ──
    archetype,

    // ── 서술 ──
    rationale,

    // ── 부가 정보 ──
    envGaps,
    warnings,
    trace,

    // ── ResultCard 하위 호환 stub ──
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
    protections: [], // Continuous는 추천 슬롯이 아니라 tie-break (§3)
  }
}

// ── 하위 호환 export ──────────────────────────────────────────
// ResultCard.jsx 등이 참조할 수 있으므로 유지한다.
export const LABELS = {
  WHEN_LABEL:   { Pre: '진입 전', At: '진입 시점', InUse: '사용 중' },
  AGENCY_LABEL: { limited: '제한형', flexible: '유연형', supported: '지원형' },
}
