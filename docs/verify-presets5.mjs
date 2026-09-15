// docs/verify-presets5.mjs
// node docs/verify-presets5.mjs
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root  = join(__dir, '..', 'src', 'data')

const appsRaw     = JSON.parse(readFileSync(join(root, 'apps.json'),     'utf8'))
const featuresRaw = JSON.parse(readFileSync(join(root, 'features.json'), 'utf8'))

const APPS          = appsRaw.apps
const FEATURES      = featuresRaw.features
const LEVELS        = featuresRaw.levels
const INTERVENTIONS = FEATURES.filter(f => f.role === 'intervention')

const ROUTE_MAP      = { '앱': 'app', '웹브라우저': 'web' }
const inAppPlatforms = (app) => app.inAppPlatforms || []

// ── engine helpers (정확한 재현) ─────────────────────────────────
function levelGrade(level, state) {
  const agencyRank = state.agencyRank ?? []
  const fa = (state.featureAccepted ?? {})[level.level]
  if (fa === undefined) return 7
  const i = agencyRank.indexOf(level.agency)
  if (i === 0) { if (fa==='ok') return 1; if (fa==='weak') return 2; if (fa==='strong') return 5 }
  if (i === 1) { if (fa==='ok') return 3; if (fa==='weak') return 4; if (fa==='strong') return 6 }
  return 7
}

function itemsForLevel(level, scopes, timingRank) {
  const dp = level.decideParams
  const candidates = INTERVENTIONS.filter(f => f.level === level.level)
  if (candidates.length === 0) return []
  if (dp === null) return candidates
  const useScope  = Array.isArray(dp) && dp.includes('scope')
  const useTiming = dp === 'timing' || (Array.isArray(dp) && dp.includes('timing'))
  if (useScope && useTiming && (scopes ?? []).length > 0) {
    const seenIds = new Set(); const results = []
    for (const scope of scopes) {
      const byScope = candidates.filter(f => { const fs = f.scope ?? []; return fs.length === 0 || fs.includes(scope) })
      if (!byScope.length) continue
      let picked = null
      for (const when of (timingRank ?? [])) { const hit = byScope.filter(f => f.when === when); if (hit.length) { picked = hit; break } }
      if (!picked) picked = byScope
      for (const item of picked) { if (!seenIds.has(item.id)) { seenIds.add(item.id); results.push(item) } }
    }
    return results
  }
  let pool = candidates
  if (useScope && (scopes ?? []).length > 0) {
    const f2 = candidates.filter(f => { const fs = f.scope ?? []; return fs.length === 0 || fs.some(s => scopes.includes(s)) })
    if (f2.length) pool = f2
  }
  if (useTiming) {
    for (const when of (timingRank ?? [])) { const bt = pool.filter(f => f.when === when); if (bt.length) return bt }
    return pool
  }
  return pool
}

function lexSort(items) {
  return [...items].sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level
    const ca = a.coverage?.n ?? 0; const cb = b.coverage?.n ?? 0
    if (cb !== ca) return cb - ca
    return a.id.localeCompare(b.id)
  })
}
function sortG7(items, agencyRank) {
  return [...items].sort((a, b) => {
    const ra = (agencyRank??[]).indexOf(a.agency); const rb = (agencyRank??[]).indexOf(b.agency)
    if ((ra<0?99:ra) !== (rb<0?99:rb)) return (ra<0?99:ra) - (rb<0?99:rb)
    if (b.level !== a.level) return b.level - a.level
    const ca = a.coverage?.n ?? 0; const cb = b.coverage?.n ?? 0
    if (cb !== ca) return cb - ca
    return a.id.localeCompare(b.id)
  })
}

function buildFeaturePicks(state) {
  const agencyRank = state.agencyRank ?? []; const scopes = state.scopes ?? []; const timingRank = state.timingRank ?? []
  const lwg = LEVELS.map(level => ({ level, grade: levelGrade(level, state) }))
  const candidates = []; const used = new Set()
  for (const grade of [1,2,3,4,5,6,7]) {
    const gradeItems = lwg.filter(g => g.grade === grade).flatMap(g => itemsForLevel(g.level, scopes, timingRank))
    const sorted = grade === 7 ? sortG7(gradeItems, agencyRank) : lexSort(gradeItems)
    for (const item of sorted) { if (!used.has(item.id)) { used.add(item.id); candidates.push({ ...item, grade }) } }
    if (candidates.length >= 3) break
  }
  return candidates.slice(0, 3)
}

function computeAppScore(app, state, featureIds, userMobileOs) {
  const env = state.env ?? {}
  const userOs = env.os ?? []; const userPlat = env.platforms ?? []; const userRoute = env.route ?? []
  const scopes = state.scopes ?? []; const bypass = state.bypassWanted ?? {}

  // (0) 명시적 0 처리
  const osMatchCount = userMobileOs.length === 0
    ? 0
    : userMobileOs.filter(o => app.os.includes(o)).length

  const coveredIds    = featureIds.filter(fid => (app.features ?? []).includes(fid))
  const coverageScore = coveredIds.length

  const nonAppScopes = scopes.filter(s => s !== 'app')
  const scopeScore =
    scopes.length > 0 && nonAppScopes.length === 0
      ? 1
      : nonAppScopes.length > 0 && inAppPlatforms(app).length > 0
        ? 1
        : 0

  // (3) worksOn: filter.length
  let envScore = 0
  const normalRoutes = [...new Set(userRoute.map(r => ROUTE_MAP[r]).filter(Boolean))]
  envScore += normalRoutes.filter(rt => (app.worksOn ?? []).includes(rt)).length
  const iap = inAppPlatforms(app)
  if (iap.length > 0) envScore += userPlat.filter(p => iap.includes(p)).length
  if (userOs.includes('desktop') && (app.devices ?? []).includes('pc')) envScore += 1

  const hasSchedule   = state.dayType === 'daily' || state.dayType === 'split'
  const scheduleScore = hasSchedule && (app.features ?? []).includes('schedule-window') ? 1 : 0

  let bypassScore = 0
  for (const [fid, bv] of Object.entries(bypass)) { if (bv !== true) continue; if ((app.features ?? []).includes(fid)) bypassScore++ }

  return { osMatchCount, coverageScore, scopeScore, envScore, scheduleScore, bypassScore }
}

function buildAppPicks(state, featureIds) {
  const userMobileOs = (state.env?.os ?? []).filter(o => o === 'ios' || o === 'android')
  const pool = userMobileOs.length > 0 ? APPS.filter(app => app.os.some(o => userMobileOs.includes(o))) : APPS
  const scored = pool.map(app => ({ ...app, ...computeAppScore(app, state, featureIds, userMobileOs) }))
  scored.sort((a, b) => {
    if (b.osMatchCount   !== a.osMatchCount)   return b.osMatchCount   - a.osMatchCount
    if (b.coverageScore  !== a.coverageScore)  return b.coverageScore  - a.coverageScore
    if (b.scopeScore     !== a.scopeScore)     return b.scopeScore     - a.scopeScore
    if (b.envScore       !== a.envScore)       return b.envScore       - a.envScore
    if (b.scheduleScore  !== a.scheduleScore)  return b.scheduleScore  - a.scheduleScore
    if (b.bypassScore    !== a.bypassScore)    return b.bypassScore    - a.bypassScore
    return a.id.localeCompare(b.id)
  })
  const picks = scored.slice(0, 3)
  const pickedIds = new Set(picks.map(a => a.id))
  const appTable = {
    userMobileOs, poolSize: pool.length,
    excludedIds: APPS.filter(a => !pool.includes(a)).map(a => a.id),
    rows: scored.map(a => ({ ...a, picked: pickedIds.has(a.id) })),
  }
  return { picks, appTable }
}

function buildWarnings(state, apps) {
  const envGaps = []
  const scopes = state.scopes ?? []
  const userOs = state.env?.os ?? []
  const userPlatforms = state.env?.platforms ?? []
  for (const os of userOs) {
    if (!apps.some(a => a.os.includes(os))) envGaps.push({ code: os })
  }
  const nonAppScopes = scopes.filter(s => s !== 'app')
  for (const p of userPlatforms) {
    const covered = apps.some(a => {
      if (nonAppScopes.length === 0) return inAppPlatforms(a).length === 0 || inAppPlatforms(a).includes(p)
      return inAppPlatforms(a).includes(p)
    })
    if (!covered) envGaps.push({ code: p })
  }
  return envGaps
}

function recommend(state) {
  const features   = buildFeaturePicks(state)
  const featureIds = features.map(f => f.id)
  const { picks: apps, appTable } = buildAppPicks(state, featureIds)
  const envGaps = buildWarnings(state, apps)
  return { featureIds, apps: apps.map(a => a.id), appTable, envGaps }
}

// ── 프리셋 ────────────────────────────────────────────────────────
const DEF_ENV   = { devices: ['mobile'], os: ['ios', 'android'], route: ['앱'], platforms: ['YouTube', 'Instagram'] }
const DEF_PATCH = { hours: { daily: [22,23,24,1,2], weekday: [], weekend: [] }, dayType: 'daily',
                    bypassMethods: {}, bypassWanted: { 'lock-app-settings': true, 'prevent-uninstall': true },
                    simsPlayed: [], oxSkipped: [] }
function mkState({ env: envOverride, ...rest }) {
  return { ...DEF_PATCH, env: { ...DEF_ENV, ...(envOverride ?? {}) }, agencyVisited: rest.agencyRank, ...rest }
}

const PRESETS = [
  { name: 'P1 · 최소 응답', state: mkState({
      agencyRank: ['supported','flexible','limited'], featureAccepted: { 1: 'ok' },
      scopes: ['shorts-tab'], timingRank: ['At','InUse','Pre'], oxSkipped: ['flexible'] }) },
  { name: 'P2 · 전부 수용', state: mkState({
      agencyRank: ['flexible','limited','supported'],
      featureAccepted: { 4:'ok', 5:'ok', 6:'ok', 7:'ok', 8:'ok', 9:'ok' },
      scopes: ['app','shorts-row','shorts-tab','content'], timingRank: ['At','InUse','Pre'] }) },
  { name: 'P3 · 전부 과함', state: mkState({
      agencyRank: ['flexible','supported','limited'],
      featureAccepted: { 1:'strong', 2:'strong', 3:'strong', 4:'strong', 5:'strong',
                         6:'strong', 7:'strong', 8:'strong', 9:'strong' },
      scopes: ['shorts-tab'], timingRank: ['InUse','At','Pre'] }) },
  { name: 'P4 · 완전 차단', state: mkState({
      agencyRank: ['limited','flexible','supported'], featureAccepted: { 10: 'ok' },
      scopes: ['app','shorts-row','shorts-tab','content'], timingRank: ['InUse','At','Pre'] }) },
  { name: 'P5 · 평가 최소', state: mkState({
      agencyRank: ['flexible','supported','limited'], featureAccepted: { 4: 'ok' },
      scopes: ['shorts-tab'], timingRank: ['At','InUse','Pre'], oxSkipped: ['supported'] }) },
  { name: 'P6 · 지원 없는 환경', state: mkState({
      env: { os: ['android'], platforms: ['YouTube'] },
      agencyRank: ['supported','flexible','limited'],
      featureAccepted: { 1:'ok', 2:'ok', 3:'ok' },
      scopes: ['shorts-tab'], timingRank: ['Pre','At','InUse'] }) },
]

// preset-check4 기준
const prev4Apps = {
  'P1 · 최소 응답':      '12_SZ / 1_S / 4_A',
  'P2 · 전부 수용':      '2_SF / 12_SZ / 4_A',
  'P3 · 전부 과함':      '2_SF / 12_SZ / 4_A',
  'P4 · 완전 차단':      '2_SF / 1_S / 12_SZ',
  'P5 · 평가 최소':      '4_A / 12_SZ / 2_SF',
  'P6 · 지원 없는 환경': '12_SZ / 1_S / 13_M',
}
const prev4Feats = {
  'P1 · 최소 응답':      'notify-entry|path-guide|visual-demotion',
  'P2 · 전부 수용':      'mission-exercise|mission-capture|mission-simple',
  'P3 · 전부 과함':      'mission-exercise|mission-capture|mission-simple',
  'P4 · 완전 차단':      'block-app|block-content|block-scroll',
  'P5 · 평가 최소':      'confirm|mission-exercise|mission-capture',
  'P6 · 지원 없는 환경': 'path-guide|visual-demotion|notify-entry',
}

// ── 추가 케이스: envGaps 잡기 테스트 ────────────────────────────
// shorts-tab 선택 + 추천 앱에 20_J 포함되도록
// 20_J는 인앱 플랫폼이 null (inAppPlatforms=[]). nonAppScopes=['shorts-tab'] → scopeScore=0
// 20_J가 추천에 들려면 다른 앱들이 낮게 나와야 함.
// 간단히 android only + YouTube만 + featureAccepted 없이 G7만 으로 만든다.
// 실제로 20_J가 추천 3개에 포함되는 케이스를 만들기 어려울 수 있으니,
// envGap 로직 자체를 별도 unit test로 확인.
function testEnvGapLogic() {
  // nonAppScopes=['shorts-tab'] 인 경우, inAppPlatforms=[] 앱은 커버 아님
  const fakeApps = [
    { id: '20_J', os: ['ios'], features: [], inAppPlatforms: null, worksOn: ['app'], devices: ['mobile'] }
  ]
  // os=['ios'] 로 맞춰 OS 갭은 없애고 플랫폼 갭만 확인
  const state = mkState({ env: { os: ['ios'], platforms: ['YouTube', 'Instagram'] },
    scopes: ['shorts-tab'], agencyRank: ['flexible'], featureAccepted: {}, timingRank: ['At'] })
  const envGaps = buildWarnings(state, fakeApps)
  // YouTube 플랫폼: 20_J 의 inAppPlatforms=[] → nonAppScopes=['shorts-tab'] → covered=false → gap 생김
  return { gaps: envGaps.map(g => g.code), expected: ['YouTube','Instagram'] }
}

// osMatchCount desktop 케이스
function testDesktopOs() {
  const state = mkState({ env: { os: ['desktop'], platforms: [], route: ['앱'] },
    agencyRank: ['supported'], featureAccepted: { 1: 'ok' }, scopes: ['app'], timingRank: ['At'] })
  const { picks, appTable } = buildAppPicks(state, ['notify-entry'])
  // userMobileOs=[] → osMatchCount=0 for all
  return { allZero: appTable.rows.every(r => r.osMatchCount === 0), poolSize: appTable.poolSize }
}

// ── 실행 ────────────────────────────────────────────────────────
const lines = [
  '# preset-check5.md — 2026-09-15',
  '',
  '변경: (1) worksOn filter.length 단순화 (2) osMatchCount 명시적 0 (3) buildWarnings 플랫폼 갭 수정',
  '',
  '비교 기준: preset-check4.md',
  '',
]
const summary = []

for (const { name, state } of PRESETS) {
  const { featureIds, apps, appTable, envGaps } = recommend(state)
  const featStr = featureIds.join('|')
  const appStr  = apps.join(' / ')
  const featSame = featStr === prev4Feats[name]
  const appSame  = appStr  === prev4Apps[name]

  lines.push(`## ${name}`)
  lines.push('')
  lines.push(`기능: \`${featStr}\`  ${featSame ? '← 이전과 동일' : `**변경**  이전: \`${prev4Feats[name]}\``}`)
  lines.push(`앱:   ${appStr}  ${appSame ? '← 이전과 동일' : `**변경**  이전: ${prev4Apps[name]}`}`)
  lines.push(`envGaps: ${envGaps.length ? envGaps.map(g => g.code).join(', ') : '없음'}`)
  lines.push('')
  lines.push(`앱 점수표 (pool ${appTable.poolSize}개):`)
  lines.push('```')
  const KEYS   = ['osMatchCount','coverageScore','scopeScore','envScore','scheduleScore','bypassScore']
  const LABELS = ['OS','C','S','E','Sc','B']
  for (const [i, row] of appTable.rows.entries()) {
    const prev = appTable.rows[i - 1]
    const diffKey = prev ? KEYS.find(k => row[k] !== prev[k]) : null
    const scores = KEYS.map((k, ki) => {
      const val = `${LABELS[ki]}${row[k]}`
      return diffKey === k ? `[${val}]` : val
    }).join(' ')
    lines.push(`${row.picked ? '★' : '·'} ${row.id.padEnd(6)} ${(row.shortName ?? '').padEnd(16)} ${scores}`)
  }
  lines.push('```')
  lines.push('')

  summary.push(`${name}: feats=${featSame?'동일':'변경'} apps=${appSame?'동일':'변경'} gaps=${envGaps.map(g=>g.code).join(',')||'-'}`)
}

// envGaps 테스트
const gapTest = testEnvGapLogic()
lines.push('## envGap 로직 단위 테스트')
lines.push('')
lines.push(`nonAppScopes=['shorts-tab'], inAppPlatforms=null 앱 → gap 발생: ${JSON.stringify(gapTest.gaps)}`)
lines.push(`기대: ${JSON.stringify(gapTest.expected)}`)
lines.push(`결과: ${gapTest.gaps.length === gapTest.expected.length && gapTest.expected.every(e => gapTest.gaps.includes(e)) ? 'PASS' : 'FAIL'}`)
lines.push('')

// desktop osMatchCount 테스트
const desktopTest = testDesktopOs()
lines.push('## desktop osMatchCount 단위 테스트')
lines.push('')
lines.push(`userMobileOs=[] → 전체 osMatchCount=0: ${desktopTest.allZero ? 'PASS' : 'FAIL'}`)
lines.push(`poolSize (필터 없음): ${desktopTest.poolSize}`)
lines.push('')

const outPath = join(__dir, 'preset-check5.md')
writeFileSync(outPath, lines.join('\n'), 'utf8')

console.log('\n=== preset-check5 요약 ===')
for (const s of summary) console.log(' ', s)
console.log(`\n envGap 테스트: gaps=${JSON.stringify(gapTest.gaps)}  기대=${JSON.stringify(gapTest.expected)}  → ${gapTest.gaps.length === gapTest.expected.length && gapTest.expected.every(e => gapTest.gaps.includes(e)) ? 'PASS' : 'FAIL'}`)
console.log(` desktop osMatchCount=0: ${desktopTest.allZero ? 'PASS' : 'FAIL'}`)
console.log(`\n저장: ${outPath}`)
