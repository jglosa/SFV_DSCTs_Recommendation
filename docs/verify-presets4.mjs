// docs/verify-presets4.mjs — engine v4 정확한 재현
// 실행: node docs/verify-presets4.mjs
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

// ── 앱 헬퍼 ──────────────────────────────────────────────────────
const ROUTE_MAP      = { '앱': 'app', '웹브라우저': 'web' }
const inAppPlatforms = (app) => app.inAppPlatforms || []

// ── levelGrade (engine.js 96-113) ────────────────────────────────
function levelGrade(level, state) {
  const agencyRank = state.agencyRank ?? []
  const fa = (state.featureAccepted ?? {})[level.level]
  if (fa === undefined) return 7
  const i = agencyRank.indexOf(level.agency)
  if (i === 0) { if (fa==='ok') return 1; if (fa==='weak') return 2; if (fa==='strong') return 5 }
  if (i === 1) { if (fa==='ok') return 3; if (fa==='weak') return 4; if (fa==='strong') return 6 }
  return 7
}

// ── itemsForLevel (store.js 160-221) ─────────────────────────────
function itemsForLevel(level, scopes, timingRank) {
  const dp = level.decideParams
  const candidates = INTERVENTIONS.filter(f => f.level === level.level)
  if (candidates.length === 0) return []
  if (dp === null) return candidates

  const useScope  = Array.isArray(dp) && dp.includes('scope')
  const useTiming = dp === 'timing' || (Array.isArray(dp) && dp.includes('timing'))

  if (useScope && useTiming && (scopes ?? []).length > 0) {
    const seenIds = new Set()
    const results = []
    for (const scope of (scopes ?? [])) {
      const byScope = candidates.filter(f => { const fs = f.scope ?? []; return fs.length === 0 || fs.includes(scope) })
      if (byScope.length === 0) continue
      let picked = null
      for (const when of (timingRank ?? [])) {
        const hit = byScope.filter(f => f.when === when)
        if (hit.length > 0) { picked = hit; break }
      }
      if (!picked) picked = byScope
      for (const item of picked) { if (!seenIds.has(item.id)) { seenIds.add(item.id); results.push(item) } }
    }
    return results
  }

  let pool = candidates
  if (useScope && (scopes ?? []).length > 0) {
    const filtered = candidates.filter(f => { const fs = f.scope ?? []; if (fs.length === 0) return true; return fs.some(s => (scopes ?? []).includes(s)) })
    if (filtered.length > 0) pool = filtered
  }
  if (useTiming) {
    for (const when of (timingRank ?? [])) {
      const byTiming = pool.filter(f => f.when === when)
      if (byTiming.length > 0) return byTiming
    }
    return pool
  }
  return pool
}

// ── lexSort / sortG7 (engine.js 118-144) ─────────────────────────
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
    const ra2 = ra<0?99:ra; const rb2 = rb<0?99:rb
    if (ra2 !== rb2) return ra2 - rb2
    if (b.level !== a.level) return b.level - a.level
    const ca = a.coverage?.n ?? 0; const cb = b.coverage?.n ?? 0
    if (cb !== ca) return cb - ca
    return a.id.localeCompare(b.id)
  })
}

// ── buildFeaturePicks (engine.js 337-385) ────────────────────────
function buildFeaturePicks(state) {
  const agencyRank = state.agencyRank ?? []
  const scopes     = state.scopes     ?? []
  const timingRank = state.timingRank ?? []
  const levelsWithGrade = LEVELS.map(level => ({ level, grade: levelGrade(level, state) }))
  const candidates = []
  const usedIds    = new Set()
  for (const grade of [1,2,3,4,5,6,7]) {
    const gradeLevels = levelsWithGrade.filter(g => g.grade === grade).map(g => g.level)
    const gradeItems  = gradeLevels.flatMap(level => itemsForLevel(level, scopes, timingRank))
    const sorted = grade === 7 ? sortG7(gradeItems, agencyRank) : lexSort(gradeItems)
    for (const item of sorted) {
      if (!usedIds.has(item.id)) { usedIds.add(item.id); candidates.push({ ...item, grade }) }
    }
    if (candidates.length >= 3) break
  }
  return candidates.slice(0, 3)
}

// ── computeAppScore (engine.js 391-443 — 새 로직) ────────────────
function computeAppScore(app, state, featureIds, userMobileOs) {
  const env         = state.env ?? {}
  const userOs      = env.os       ?? []
  const userPlat    = env.platforms ?? []
  const userRoute   = env.route     ?? []
  const scopes      = state.scopes  ?? []
  const bypass      = state.bypassWanted ?? {}

  const osMatchCount  = userMobileOs.filter(o => app.os.includes(o)).length

  const coveredIds    = featureIds.filter(fid => (app.features ?? []).includes(fid))
  const coverageScore = coveredIds.length

  const nonAppScopes = scopes.filter(s => s !== 'app')
  const scopeScore =
    scopes.length > 0 && nonAppScopes.length === 0
      ? 1
      : nonAppScopes.length > 0 && inAppPlatforms(app).length > 0
        ? 1
        : 0

  let envScore = 0
  const normalRoutes = [...new Set(userRoute.map(r => ROUTE_MAP[r]).filter(Boolean))]
  for (const rt of normalRoutes) { if ((app.worksOn ?? []).includes(rt)) envScore += 1 }
  const iap = inAppPlatforms(app)
  if (iap.length > 0) envScore += userPlat.filter(p => iap.includes(p)).length
  if (userOs.includes('desktop') && (app.devices ?? []).includes('pc')) envScore += 1

  const hasSchedule   = state.dayType === 'daily' || state.dayType === 'split'
  const scheduleScore = hasSchedule && (app.features ?? []).includes('schedule-window') ? 1 : 0

  let bypassScore = 0
  for (const [fid, bv] of Object.entries(bypass)) {
    if (bv !== true) continue
    if ((app.features ?? []).includes(fid)) bypassScore++
  }

  return { osMatchCount, coverageScore, coveredIds, scopeScore, envScore, scheduleScore, bypassScore }
}

// ── buildAppPicks (engine.js 446-486) ────────────────────────────
function buildAppPicks(state, featureIds) {
  const userMobileOs = (state.env?.os ?? []).filter(o => o === 'ios' || o === 'android')
  const pool = userMobileOs.length > 0
    ? APPS.filter(app => app.os.some(o => userMobileOs.includes(o)))
    : APPS
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
  return scored
}

// ── recommend ────────────────────────────────────────────────────
function recommend(state) {
  const features   = buildFeaturePicks(state)
  const featureIds = features.map(f => f.id)
  const scored     = buildAppPicks(state, featureIds)
  return { features, featureIds, apps: scored.slice(0, 3), top5: scored.slice(0, 5) }
}

// ── 프리셋 정의 ──────────────────────────────────────────────────
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

// preset-check3 기준 이전 결과
const prev3 = {
  'P1 · 최소 응답':      { feats: 'notify-entry|path-guide|visual-demotion', apps: '12_SZ / 1_S / 4_A' },
  'P2 · 전부 수용':      { feats: 'mission-exercise|mission-capture|mission-simple', apps: '2_SF / 12_SZ / 4_A' },
  'P3 · 전부 과함':      { feats: 'mission-exercise|mission-capture|mission-simple', apps: '2_SF / 12_SZ / 4_A' },
  'P4 · 완전 차단':      { feats: 'block-app|block-content|block-scroll', apps: '2_SF / 1_S / 12_SZ' },
  'P5 · 평가 최소':      { feats: 'confirm|mission-exercise|mission-capture', apps: '4_A / 12_SZ / 2_SF' },
  'P6 · 지원 없는 환경': { feats: 'path-guide|visual-demotion|notify-entry', apps: '12_SZ / 1_S / 13_M' },
}

// ── 출력 ────────────────────────────────────────────────────────
const lines = [
  `# preset-check4.md — 2026-09-15`,
  ``,
  `osMatchCount(개수) / envScore OS항 제거 / scopeScore inAppPlatforms 기반 재정의 후 검증`,
  ``,
  `변경 비교 기준: preset-check3.md`,
  ``,
]
const summary = []

for (const { name, state } of PRESETS) {
  const { features, featureIds, apps, top5 } = recommend(state)
  const featStr = featureIds.join('|')
  const appStr  = apps.map(a => a.id).join(' / ')
  const p3      = prev3[name]
  const featSame = p3 && featStr === p3.feats
  const appSame  = p3 && appStr  === p3.apps

  lines.push(`## ${name}`)
  lines.push(``)
  lines.push(`기능: \`${featStr}\`  ${featSame ? '← 이전과 동일' : `**변경**  이전: \`${p3?.feats ?? 'N/A'}\``}`)
  lines.push(`앱:   ${appStr}  ${appSame ? '← 이전과 동일' : `**변경**  이전: ${p3?.apps ?? 'N/A'}`}`)
  lines.push(``)
  lines.push(`상위 5개 점수 (OS|C|S|E|Sc|B):`)
  for (const a of top5) {
    lines.push(`  \`${a.id}\`  OS${a.osMatchCount}|C${a.coverageScore}|S${a.scopeScore}|E${a.envScore}|Sc${a.scheduleScore}|B${a.bypassScore}`)
  }
  lines.push(``)

  summary.push(`${name}: feats=${featSame?'동일':'변경'}  apps=${appSame?'동일':'변경'}  [${appStr}]`)
}

lines.push(`## 전체 점수표`)
lines.push(``)
lines.push(`| 프리셋 | 앱1 | OS | C | S | E | Sc | B | 앱2 | OS | C | S | E | Sc | B | 앱3 | OS | C | S | E | Sc | B |`)
lines.push(`|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`)
for (const { name, state } of PRESETS) {
  const { apps } = recommend(state)
  const cols = apps.map(a => `${a.id}|${a.osMatchCount}|${a.coverageScore}|${a.scopeScore}|${a.envScore}|${a.scheduleScore}|${a.bypassScore}`).join('|')
  lines.push(`|${name}|${cols}|`)
}

const outPath = join(__dir, 'preset-check4.md')
writeFileSync(outPath, lines.join('\n'), 'utf8')

console.log('\n=== preset-check4 요약 ===')
for (const s of summary) console.log(' ', s)
console.log(`\n저장: ${outPath}`)
