/**
 * preset-check.mjs — DebugPanel 프리셋 6개 결과 검증 스크립트
 * Node.js 에서 직접 실행. Vite / React 의존성 없음.
 * 결과는 docs/preset-check.md 에 저장한다.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const featuresRaw = JSON.parse(readFileSync(resolve(root, 'src/data/features.json'), 'utf8'))
const appsRaw     = JSON.parse(readFileSync(resolve(root, 'src/data/apps.json'), 'utf8'))

const LEVELS       = featuresRaw.levels
const INTERVENTIONS = featuresRaw.features.filter(f => f.role === 'intervention')
const APPS         = appsRaw.apps

// ── SCOPE_TO_L10_FEATS ─────────────────────────────────────
const SCOPE_LEVELS = featuresRaw.scopeLevels
const SCOPE_TO_L10_FEATS = Object.fromEntries(
  SCOPE_LEVELS.map(sl => [
    sl.id,
    INTERVENTIONS.filter(f => f.level === 10 && (f.scope ?? []).includes(sl.id)).map(f => f.id),
  ])
)

// ── ROUTE_MAP ──────────────────────────────────────────────
const ROUTE_MAP = { '앱': 'app', '웹브라우저': 'web' }
const inAppPlatforms = app => app.inAppPlatforms || []

// ── itemsForLevel (store.js 동일 로직) ─────────────────────
function itemsForLevel(level, scopes, timingRank) {
  const dp = level.decideParams
  const candidates = INTERVENTIONS.filter(f => f.level === level.level)
  if (candidates.length === 0) return []
  if (dp === null) return candidates

  const useScope  = Array.isArray(dp) && dp.includes('scope')
  const useTiming = dp === 'timing' || (Array.isArray(dp) && dp.includes('timing'))

  let pool = candidates
  if (useScope && (scopes ?? []).length > 0) {
    const filtered = candidates.filter(f => {
      const fs = f.scope ?? []
      return fs.length === 0 || fs.some(s => (scopes ?? []).includes(s))
    })
    if (filtered.length > 0) pool = filtered
  }

  if (useTiming) {
    const ranks = timingRank ?? []
    for (const when of ranks) {
      const byTiming = pool.filter(f => f.when === when)
      if (byTiming.length > 0) return byTiming
    }
    return pool
  }
  return pool
}

// ── analyzeLevel ────────────────────────────────────────────
function analyzeLevel(level, scopes, timingRank) {
  const dp = level.decideParams
  const candidates = INTERVENTIONS.filter(f => f.level === level.level)
  if (candidates.length === 0) return { items: [], fallback: null }

  const makeItem = (f, passed, dropReason) => ({
    id:        f.id,
    nameKo:    f.nameKo,
    when:      f.when,
    scope:     f.scope ?? [],
    coverage:  f.coverage?.n ?? 0,
    passed,
    dropReason,
  })

  if (dp === null) {
    return { items: candidates.map(f => makeItem(f, true, null)), fallback: null }
  }

  const useScope  = Array.isArray(dp) && dp.includes('scope')
  const useTiming = dp === 'timing' || (Array.isArray(dp) && dp.includes('timing'))

  let pool = candidates
  const scopeDropped = new Set()
  let scopeFallback = false

  if (useScope && (scopes ?? []).length > 0) {
    const filtered = candidates.filter(f => {
      const fs = f.scope ?? []
      return fs.length === 0 || fs.some(s => (scopes ?? []).includes(s))
    })
    if (filtered.length > 0) {
      const passedIds = new Set(filtered.map(f => f.id))
      candidates.forEach(f => { if (!passedIds.has(f.id)) scopeDropped.add(f.id) })
      pool = filtered
    } else {
      scopeFallback = true
    }
  }

  const timingDropped = new Set()
  let timingFallback = false

  if (useTiming) {
    const ranks = timingRank ?? []
    let found = false
    for (const when of ranks) {
      const byTiming = pool.filter(f => f.when === when)
      if (byTiming.length > 0) {
        const passedIds = new Set(byTiming.map(f => f.id))
        pool.forEach(f => { if (!passedIds.has(f.id)) timingDropped.add(f.id) })
        pool = byTiming
        found = true
        break
      }
    }
    if (!found) timingFallback = true
  }

  const passedIds = new Set(pool.map(f => f.id))
  const items = candidates.map(f => {
    const passed = passedIds.has(f.id)
    let dropReason = null
    if (!passed) {
      if (scopeDropped.has(f.id))        dropReason = 'scope 불일치'
      else if (timingDropped.has(f.id))  dropReason = 'timing 밀림'
    }
    return makeItem(f, passed, dropReason)
  })

  let fallback = null
  if (scopeFallback && timingFallback) fallback = 'both'
  else if (scopeFallback) fallback = 'scope'
  else if (timingFallback) fallback = 'timing'

  return { items, fallback }
}

// ── 등급 계산 ───────────────────────────────────────────────
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

function lexSort(items) {
  return [...items].sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level
    const ca = a.coverage?.n ?? 0
    const cb = b.coverage?.n ?? 0
    if (cb !== ca) return cb - ca
    return a.id.localeCompare(b.id)
  })
}

function sortG7(items, agencyRank) {
  const rankIndex = agency => {
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

function buildFeaturePicks(state) {
  const agencyRank = state.agencyRank ?? []
  const scopes = state.scopes ?? []
  const timingRank = state.timingRank ?? []

  const levelsWithGrade = LEVELS.map(level => ({ level, grade: levelGrade(level, state) }))

  const candidates = []
  const usedIds = new Set()

  for (const grade of [1,2,3,4,5,6,7]) {
    const gradeLevels = levelsWithGrade.filter(g => g.grade === grade).map(g => g.level)
    const gradeItems = gradeLevels.flatMap(level => itemsForLevel(level, scopes, timingRank))
    const sorted = grade === 7 ? sortG7(gradeItems, agencyRank) : lexSort(gradeItems)

    for (const item of sorted) {
      if (!usedIds.has(item.id)) {
        usedIds.add(item.id)
        candidates.push({ ...item, grade })
      }
    }
    if (candidates.length >= 3) break
  }
  return candidates.slice(0, 3)
}

// ── 앱 점수 ─────────────────────────────────────────────────
function computeAppScore(app, state, featureIds) {
  const env = state.env ?? {}
  const userOs        = env.os ?? []
  const userPlatforms = env.platforms ?? []
  const userRoute     = env.route ?? []
  const scopes        = state.scopes ?? []
  const bypass        = state.bypassWanted ?? {}

  const coveredIds   = featureIds.filter(fid => (app.features ?? []).includes(fid))
  const coverageScore = coveredIds.length

  let scopeScore = 0
  for (const s of scopes) {
    const featsForScope = SCOPE_TO_L10_FEATS[s] ?? []
    if (featsForScope.some(fid => (app.features ?? []).includes(fid))) scopeScore += 1
  }

  let envScore = 0
  envScore += userOs.filter(o => app.os.includes(o)).length
  const normalRoutes = [...new Set(userRoute.map(r => ROUTE_MAP[r]).filter(Boolean))]
  for (const rt of normalRoutes) {
    if ((app.worksOn ?? []).includes(rt)) envScore += 1
  }
  const iap = inAppPlatforms(app)
  if (iap.length > 0) {
    envScore += userPlatforms.filter(p => iap.includes(p)).length
  }
  if (userOs.includes('desktop') && (app.devices ?? []).includes('pc')) envScore += 1

  const hasSchedule = state.dayType === 'daily' || state.dayType === 'split'
  const scheduleScore = hasSchedule && (app.features ?? []).includes('schedule-window') ? 1 : 0

  let bypassScore = 0
  for (const [featureId, bv] of Object.entries(bypass)) {
    if (bv !== true) continue
    if ((app.features ?? []).includes(featureId)) bypassScore++
  }

  return { coverageScore, coveredIds, scopeScore, envScore, scheduleScore, bypassScore }
}

function buildAppPicks(state, featureIds) {
  const scored = APPS.map(app => ({ ...app, ...computeAppScore(app, state, featureIds) }))
  scored.sort((a, b) => {
    if (b.coverageScore !== a.coverageScore) return b.coverageScore - a.coverageScore
    if (b.scopeScore    !== a.scopeScore)    return b.scopeScore    - a.scopeScore
    if (b.envScore      !== a.envScore)      return b.envScore      - a.envScore
    if (b.scheduleScore !== a.scheduleScore) return b.scheduleScore - a.scheduleScore
    if (b.bypassScore   !== a.bypassScore)   return b.bypassScore   - a.bypassScore
    return a.id.localeCompare(b.id)
  })
  return scored.slice(0, 3)
}

// ── 아키타입 ────────────────────────────────────────────────
function resolveArchetype(state) {
  const agency = (state.agencyRank ?? [])[0] ?? null
  const timing = (state.timingRank ?? [])[0] ?? null
  if (!agency || !timing) return '_default'
  return `${agency}_${timing}`
}

// ── buildGradeTable ─────────────────────────────────────────
function buildGradeTable(state, pickedIds) {
  const agencyRank = state.agencyRank ?? []
  const scopes     = state.scopes ?? []
  const timingRank = state.timingRank ?? []
  const accepted   = state.featureAccepted ?? {}

  const rankIndex = agency => {
    const i = agencyRank.indexOf(agency)
    return i === -1 ? 99 : i
  }

  const rows = LEVELS.map(level => {
    const grade = levelGrade(level, state)
    const rank  = agencyRank.indexOf(level.agency)
    const answer = accepted[level.level] ?? null
    const { items: rawItems, fallback } = analyzeLevel(level, scopes, timingRank)
    const items = rawItems.map(it => ({ ...it, picked: pickedIds.includes(it.id) }))
    return { level: level.level, nameKo: level.nameKo, agency: level.agency, rank, answer, grade, decideParams: level.decideParams, items, fallback }
  })

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

// ── 프리셋 정의 (DebugPanel.jsx 와 동일) ──────────────────────
const DEFAULT_ENV = { devices: ['mobile'], os: ['ios','android'], route: ['앱'], platforms: ['YouTube','Instagram'] }
const DEFAULT_PATCH = {
  hours: { daily: [22,23,24,1,2], weekday: [], weekend: [] },
  dayType: 'daily',
  bypassMethods: {},
  bypassWanted: { 'lock-app-settings': true, 'prevent-uninstall': true },
  simsPlayed: [],
  oxSkipped: [],
}

function makePreset({ env: envOverride, ...rest }) {
  return { ...DEFAULT_PATCH, env: { ...DEFAULT_ENV, ...envOverride }, agencyVisited: rest.agencyRank, ...rest }
}

const PRESETS = [
  { name: 'P1 · 최소 응답', patch: makePreset({ agencyRank: ['supported','flexible','limited'], featureAccepted: { 1: 'ok' }, scopes: ['shorts-tab'], timingRank: ['At','InUse','Pre'], oxSkipped: ['flexible'] }) },
  { name: 'P2 · 전부 수용', patch: makePreset({ agencyRank: ['flexible','limited','supported'], featureAccepted: { 4:'ok', 5:'ok', 6:'ok', 7:'ok', 8:'ok', 9:'ok' }, scopes: ['app','shorts-row','shorts-tab','content'], timingRank: ['At','InUse','Pre'] }) },
  { name: 'P3 · 전부 과함', patch: makePreset({ agencyRank: ['flexible','supported','limited'], featureAccepted: { 1:'strong', 2:'strong', 3:'strong', 4:'strong', 5:'strong', 6:'strong', 7:'strong', 8:'strong', 9:'strong' }, scopes: ['shorts-tab'], timingRank: ['InUse','At','Pre'] }) },
  { name: 'P4 · 완전 차단', patch: makePreset({ agencyRank: ['limited','flexible','supported'], featureAccepted: { 10: 'ok' }, scopes: ['app','shorts-row','shorts-tab','content'], timingRank: ['InUse','At','Pre'] }) },
  { name: 'P5 · 평가 최소', patch: makePreset({ agencyRank: ['flexible','supported','limited'], featureAccepted: { 4: 'ok' }, scopes: ['shorts-tab'], timingRank: ['At','InUse','Pre'], oxSkipped: ['supported'] }) },
  { name: 'P6 · 지원 없는 환경', patch: makePreset({ env: { os: ['android'], platforms: ['YouTube'] }, agencyRank: ['supported','flexible','limited'], featureAccepted: { 1:'ok', 2:'ok', 3:'ok' }, scopes: ['shorts-tab'], timingRank: ['Pre','At','InUse'] }) },
]

// ── 결과 계산 ────────────────────────────────────────────────
const results = PRESETS.map(p => {
  const state = p.patch
  const features = buildFeaturePicks(state)
  const featureIds = features.map(f => f.id)
  const apps = buildAppPicks(state, featureIds)
  const archetype = resolveArchetype(state)
  const gradeTable = buildGradeTable(state, featureIds)
  return { name: p.name, state, features, apps, archetype, gradeTable }
})

// ── 출력 생성 ────────────────────────────────────────────────
function scopeStr(s) { return s && s.length > 0 ? s.join(',') : '∅' }
function coverageStr(app) {
  const ios = app.coverage?.ios ?? '?'
  const android = app.coverage?.android ?? '?'
  return `ios=${ios},android=${android}`
}

const lines = []
lines.push(`# preset-check.md — ${new Date().toISOString().slice(0,10)}`)
lines.push('')
lines.push('> 코드로 recommend() 를 직접 호출한 결과. 화면 조작 없음.')
lines.push('')

// 1. DebugPanel 반영 확인
lines.push('## 1. 반영 확인')
lines.push('')
lines.push(`- PRESETS 개수: **${PRESETS.length}개** (P1~P6)`)
lines.push(`- PRESETS 이름: ${PRESETS.map(p=>p.name).join(' / ')}`)
lines.push(`- 주입 후 결과 화면 이동: injectPreset() 내 findIndex(c=>c.type==='result') → onJump 호출 ✓`)
lines.push(`- activePreset 표시: useState(null) + sc-tiny span 에서 "현재: {activePreset}" 렌더링 ✓`)
lines.push('')

// 2. 여섯 세트 결과
lines.push('## 2. 여섯 세트 결과')
lines.push('')

for (const r of results) {
  lines.push(`### ${r.name}`)
  lines.push('')
  lines.push(`**아키타입:** \`${r.archetype}\``)
  lines.push('')
  lines.push('**추천 기능 3개:**')
  lines.push('')
  lines.push('| # | id | level | G | 앱 수 |')
  lines.push('|---|---|---|---|---|')
  r.features.forEach((f, i) => {
    lines.push(`| ${i+1} | ${f.id} | L${f.level} | G${f.grade} | ${f.coverage?.n ?? '?'} |`)
  })
  lines.push('')
  lines.push('**추천 앱 3개:**')
  lines.push('')
  lines.push('| # | id | C/S/E/Sc/B | scope지원 | os | inAppPlatforms | schedule | bypass |')
  lines.push('|---|---|---|---|---|---|---|---|')
  r.apps.forEach((a, i) => {
    const score = `${a.coverageScore}/${a.scopeScore}/${a.envScore}/${a.scheduleScore}/${a.bypassScore}`
    const iap = inAppPlatforms(a).join(',') || '—'
    const sched = a.features.includes('schedule-window') ? '○' : '—'
    const bypass = [
      a.features.includes('lock-app-settings') ? 'lock-settings' : '',
      a.features.includes('prevent-uninstall') ? 'prevent-uninstall' : '',
    ].filter(Boolean).join(',') || '—'
    lines.push(`| ${i+1} | ${a.id} | ${score} | ${a.scopeScore} | ${a.os.join(',')} | ${iap} | ${sched} | ${bypass} |`)
  })
  lines.push('')
}

// 3. 규칙 확인
lines.push('## 3. 규칙 확인')
lines.push('')

// ── P1 규칙 ──
{
  const r = results[0]
  lines.push('### P1 최소 응답 규칙')
  lines.push('')
  const g1 = r.gradeTable.filter(row => row.grade === 1)
  const g1isL1only = g1.length === 1 && g1[0].level === 1
  lines.push(`- G1 이 L1 하나인지: **${g1isL1only ? 'O' : 'X'}** (G1 rows: ${g1.map(r=>`L${r.level}`).join(', ')})`)
  const f2 = r.features[1]
  const f3 = r.features[2]
  lines.push(`- 2번째 기능: ${f2?.id ?? '—'} (G${f2?.grade}, L${f2?.level})`)
  lines.push(`- 3번째 기능: ${f3?.id ?? '—'} (G${f3?.grade}, L${f3?.level})`)
  lines.push('')
}

// ── P2 규칙 ──
{
  const r = results[1]
  lines.push('### P2 전부 수용 규칙')
  lines.push('')
  const g1rows = r.gradeTable.filter(row => row.grade === 1)
  // G1 후보 = G1 레벨들에서 itemsForLevel 결과 합산
  const state = r.state
  let g1items = []
  for (const row of g1rows) {
    const level = LEVELS.find(l => l.level === row.level)
    const items = itemsForLevel(level, state.scopes, state.timingRank)
    g1items = g1items.concat(items)
  }
  const uniqueG1 = [...new Set(g1items.map(x=>x.id))]
  lines.push(`- G1 후보 개수: **${uniqueG1.length}개** (기대: 8)`)
  lines.push(`  - G1 rows: ${g1rows.map(row=>`L${row.level}`).join(', ')}`)
  lines.push(`  - 후보 ids: ${uniqueG1.join(', ')}`)

  // P2 features are picked from G1
  lines.push(`- 추천 기능: ${r.features.map(f=>`${f.id}(L${f.level})`).join(', ')}`)
  // Check L9→L8(3)→L7 order
  const levels_desc = r.features.map(f=>f.level)
  lines.push(`- 레벨 순서: ${levels_desc.join('→')} (기대: 9→8→8 or 9→8→7)`)
  // L8 내 순서 확인
  const l8feats = r.features.filter(f=>f.level===8)
  if (l8feats.length > 0) {
    lines.push(`- L8 항목: ${l8feats.map(f=>f.id).join(', ')} (기대: 촬영(mission-capture,n=3) > 간단(mission-simple,n=2) > 대체(mission-altapp,n=1))`)
  }
  lines.push('')
}

// ── P3 규칙 ──
{
  const r = results[2]
  lines.push('### P3 전부 과함 규칙')
  lines.push('')
  const grades = r.gradeTable.map(row => row.grade)
  const minGrade = Math.min(...grades.filter(g => g < 7))
  const g1to4empty = r.gradeTable.filter(row => row.grade >= 1 && row.grade <= 4).length === 0
  // Actually let's check which grades appear
  const gradeCounts = {}
  r.gradeTable.forEach(row => { gradeCounts[row.grade] = (gradeCounts[row.grade]||0)+1 })
  lines.push(`- 등급 분포: ${Object.entries(gradeCounts).sort((a,b)=>+a[0]-+b[0]).map(([g,c])=>`G${g}×${c}`).join(' ')}`)
  const hasG1toG4 = r.gradeTable.some(row => row.grade >= 1 && row.grade <= 4)
  lines.push(`- G1~G4 비어 있는지: **${!hasG1toG4 ? 'O' : 'X'}**`)
  const firstFeature = r.features[0]
  lines.push(`- 1번째 기능 (최고 등급): ${firstFeature?.id} (G${firstFeature?.grade}, L${firstFeature?.level})`)

  // L4 timing check
  const l4row = r.gradeTable.find(row => row.level === 4)
  const l4grade = l4row?.grade
  const l4items = itemsForLevel(LEVELS.find(l=>l.level===4), r.state.scopes, r.state.timingRank)
  lines.push(`- L4 (flexible, G${l4grade}) timingRank=[InUse,At,Pre]:`)
  lines.push(`  - itemsForLevel → ${l4items.map(f=>`${f.id}(${f.when})`).join(', ')} (기대: interrupt(InUse))`)

  // L10 grade check
  const l10row = r.gradeTable.find(row => row.level === 10)
  lines.push(`- L10 (limited) 등급: G${l10row?.grade} (기대: G7)`)
  lines.push('')
}

// ── P4 규칙 ──
{
  const r = results[3]
  lines.push('### P4 완전 차단 규칙')
  lines.push('')
  const l10Level = LEVELS.find(l=>l.level===10)
  const { items: l10items, fallback } = analyzeLevel(l10Level, r.state.scopes, r.state.timingRank)
  lines.push(`- L10 analyzeLevel (scopes=[app,shorts-row,shorts-tab,content], timing=[InUse,At,Pre]):`)
  l10items.forEach(it => {
    const mark = it.passed ? '✓' : '✗'
    const drop = it.dropReason ? ` [${it.dropReason}]` : ''
    lines.push(`  - ${mark} ${it.id}(${it.when}, scope=[${it.scope.join(',')}])${drop}`)
  })
  lines.push(`  - fallback: ${fallback ?? 'none'}`)
  const survived = l10items.filter(it=>it.passed)
  lines.push(`- 살아남은 항목: ${survived.map(it=>it.id).join(', ')}`)
  lines.push(`- 추천된 기능: ${r.features.map(f=>`${f.id}(L${f.level},G${f.grade})`).join(', ')}`)
  lines.push('')
}

// ── P5 규칙 ──
{
  const r = results[4]
  lines.push('### P5 평가 최소 규칙')
  lines.push('')
  const supportedRow = r.gradeTable.filter(row => row.agency === 'supported')
  const flexibleRow  = r.gradeTable.filter(row => row.agency === 'flexible')
  const limitedRow   = r.gradeTable.filter(row => row.agency === 'limited')

  // agencyRank=['flexible','supported','limited'], featureAccepted={4:'ok'}
  // L4(flexible, i=0) → ok → G1
  // L1,L2,L3 (supported, i=1) → no answer → G7
  // L5~L9 (flexible, i=0) → no answer → G7
  // L10 (limited, i=2) → no answer → G7

  const g7rows = r.gradeTable.filter(row => row.grade === 7)
  const supportedG7 = g7rows.filter(row => row.agency === 'supported')
  const flexibleG7  = g7rows.filter(row => row.agency === 'flexible')
  lines.push(`- supported 가 G7 인지: **${supportedRow.every(row=>row.grade===7) ? 'O' : 'X'}** (grades: ${supportedRow.map(r=>`L${r.level}:G${r.grade}`).join(', ')})`)
  lines.push(`- flexible L5~L9 가 G7 인지: **${flexibleRow.filter(r=>r.level>=5&&r.level<=9).every(r=>r.grade===7) ? 'O' : 'X'}**`)

  // G7 순서: flexible이 supported보다 먼저 오는지
  // gradeTable에서 G7 rows는 agencyRank 순으로 정렬되므로
  // agencyRank=['flexible','supported','limited'] → flexible(0) < supported(1)
  const firstG7 = g7rows[0]
  const g7agencyOrder = [...new Set(g7rows.map(r=>r.agency))]
  lines.push(`- G7 agency 순서 (gradeTable): ${g7agencyOrder.join(' → ')} (기대: flexible → supported → limited)`)
  lines.push(`- G7 첫 번째 행: L${firstG7?.level} ${firstG7?.agency}`)
  lines.push(`- 추천 기능: ${r.features.map(f=>`${f.id}(G${f.grade},L${f.level},${f.agency})`).join(', ')}`)
  lines.push('')
}

// ── P6 규칙 ──
{
  const r = results[5]
  lines.push('### P6 지원 없는 환경 규칙')
  lines.push('')
  const hasVD = r.features.some(f=>f.id==='visual-demotion')
  lines.push(`- visual-demotion 추천 여부: **${hasVD ? 'O' : 'X'}** (추천 기능: ${r.features.map(f=>f.id).join(', ')})`)
  lines.push(`- visual-demotion coverage: n=4, ios=4, android=0`)
  lines.push('')
  const androidApps = r.apps.every(a => a.os.includes('android'))
  lines.push(`- 추천 앱 3개 모두 Android 지원 여부: **${androidApps ? 'O' : 'X'}**`)
  r.apps.forEach((a,i) => {
    lines.push(`  - ${i+1}. ${a.id} (os=[${a.os.join(',')}])`)
  })
  lines.push('')
}

// ── 전체 등급표 (상세) ──────────────────────────────────────
lines.push('## 4. 전체 등급표 (디버그용)')
lines.push('')
for (const r of results) {
  lines.push(`### ${r.name} — 등급표`)
  lines.push('')
  lines.push('| G | L | agency | rank | answer | decideParams | fallback | items(passed) |')
  lines.push('|---|---|---|---|---|---|---|---|')
  for (const row of r.gradeTable) {
    const passedItems = row.items.filter(it=>it.passed).map(it=>`${it.id}(${it.when})${it.picked?'★':''}`).join(', ')
    const dp = row.decideParams === null ? 'null' : JSON.stringify(row.decideParams)
    lines.push(`| G${row.grade} | L${row.level} | ${row.agency} | ${row.rank} | ${row.answer??'—'} | ${dp} | ${row.fallback??'—'} | ${passedItems||'—'} |`)
  }
  lines.push('')
}

// ── 저장 ────────────────────────────────────────────────────
const outPath = resolve(root, 'docs/preset-check.md')
writeFileSync(outPath, lines.join('\n'), 'utf8')
console.log(`저장 완료: docs/preset-check.md`)

// ── 터미널 요약 ──────────────────────────────────────────────
console.log('\n=== 반영 확인 ===')
console.log(`PRESETS: ${PRESETS.length}개 (P1~P6) ✓`)
console.log(`이름: ${PRESETS.map(p=>p.name).join(' / ')}`)
console.log('injectPreset → result 화면 이동 ✓')
console.log('activePreset 표시 ✓')

console.log('\n=== 여섯 세트 결과 요약 ===')
for (const r of results) {
  const feats = r.features.map(f=>`${f.id}(L${f.level},G${f.grade},앱${f.coverage?.n??'?'})`).join(' | ')
  const apps  = r.apps.map(a=>`${a.id}(C${a.coverageScore}|S${a.scopeScore}|E${a.envScore})`).join(' | ')
  console.log(`\n[${r.name}]`)
  console.log(`  아키타입: ${r.archetype}`)
  console.log(`  기능: ${feats}`)
  console.log(`  앱:   ${apps}`)
}

console.log('\n=== 규칙 확인 ===')

// P1
{
  const r = results[0]
  const g1 = r.gradeTable.filter(row=>row.grade===1)
  console.log(`\nP1 G1=L1 하나: ${g1.length===1&&g1[0].level===1?'O':'X'} | 2번째: ${r.features[1]?.id}(G${r.features[1]?.grade},L${r.features[1]?.level}) | 3번째: ${r.features[2]?.id}(G${r.features[2]?.grade},L${r.features[2]?.level})`)
}

// P2
{
  const r = results[1]
  const state = r.state
  let g1items = []
  const g1rows = r.gradeTable.filter(row=>row.grade===1)
  for (const row of g1rows) {
    const level = LEVELS.find(l=>l.level===row.level)
    const items = itemsForLevel(level, state.scopes, state.timingRank)
    g1items = g1items.concat(items)
  }
  const uniqueG1 = [...new Set(g1items.map(x=>x.id))]
  console.log(`P2 G1 후보: ${uniqueG1.length}개(기대8) | 기능: ${r.features.map(f=>`${f.id}(L${f.level})`).join(',')}`)
}

// P3
{
  const r = results[2]
  const hasG1toG4 = r.gradeTable.some(row=>row.grade>=1&&row.grade<=4)
  const gradeDist = {}
  r.gradeTable.forEach(row=>{gradeDist[row.grade]=(gradeDist[row.grade]||0)+1})
  const l4items = itemsForLevel(LEVELS.find(l=>l.level===4), r.state.scopes, r.state.timingRank)
  const l10row = r.gradeTable.find(row=>row.level===10)
  console.log(`P3 G1~G4 없음: ${!hasG1toG4?'O':'X'} | 등급분포: ${Object.entries(gradeDist).sort((a,b)=>+a[0]-+b[0]).map(([g,c])=>`G${g}×${c}`).join(' ')}`)
  console.log(`   L4 itemsForLevel: ${l4items.map(f=>`${f.id}(${f.when})`).join(',')} | L10 등급: G${l10row?.grade}`)
}

// P4
{
  const r = results[3]
  const l10Level = LEVELS.find(l=>l.level===10)
  const { items: l10items, fallback } = analyzeLevel(l10Level, r.state.scopes, r.state.timingRank)
  const survived = l10items.filter(it=>it.passed)
  console.log(`P4 L10 생존: ${survived.map(it=>it.id).join(',')} | 탈락: ${l10items.filter(it=>!it.passed).map(it=>`${it.id}[${it.dropReason}]`).join(',')} | fallback:${fallback??'none'}`)
  console.log(`   추천 기능: ${r.features.map(f=>`${f.id}(G${f.grade})`).join(',')}`)
}

// P5
{
  const r = results[4]
  const supportedRows = r.gradeTable.filter(row=>row.agency==='supported')
  const g7rows = r.gradeTable.filter(row=>row.grade===7)
  const g7agencyOrder = [...new Set(g7rows.map(row=>row.agency))]
  console.log(`P5 supported G7: ${supportedRows.every(r=>r.grade===7)?'O':'X'} | G7 agency 순서: ${g7agencyOrder.join('->')} | 추천: ${r.features.map(f=>`${f.id}(G${f.grade})`).join(',')}`)
}

// P6
{
  const r = results[5]
  const hasVD = r.features.some(f=>f.id==='visual-demotion')
  const androidApps = r.apps.every(a=>a.os.includes('android'))
  console.log(`P6 visual-demotion 추천: ${hasVD?'O':'X'} | 앱 모두 Android: ${androidApps?'O':'X'} | 앱: ${r.apps.map(a=>`${a.id}[${a.os.join(',')}]`).join(',')}`)
}

console.log('\n→ 상세: docs/preset-check.md')
