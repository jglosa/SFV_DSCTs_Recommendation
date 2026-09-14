/**
 * preset-check2.mjs — engine 수정 후 검증 스크립트
 * 1. OS 필터 (buildAppPicks)
 * 2. scope+timing 범위별 독립 처리 (itemsForLevel)
 * 3. gradeTable items 정렬
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const featuresRaw = JSON.parse(readFileSync(resolve(root, 'src/data/features.json'), 'utf8'))
const appsRaw     = JSON.parse(readFileSync(resolve(root, 'src/data/apps.json'), 'utf8'))

const LEVELS        = featuresRaw.levels
const INTERVENTIONS = featuresRaw.features.filter(f => f.role === 'intervention')
const APPS          = appsRaw.apps

const SCOPE_LEVELS = featuresRaw.scopeLevels
const SCOPE_TO_L10_FEATS = Object.fromEntries(
  SCOPE_LEVELS.map(sl => [
    sl.id,
    INTERVENTIONS.filter(f => f.level === 10 && (f.scope ?? []).includes(sl.id)).map(f => f.id),
  ])
)
const ROUTE_MAP = { '앱': 'app', '웹브라우저': 'web' }
const inAppPlatforms = app => app.inAppPlatforms || []

// ── itemsForLevel (수정 후 로직 반영) ─────────────────────────
function itemsForLevel(level, scopes, timingRank) {
  const dp = level.decideParams
  const candidates = INTERVENTIONS.filter(f => f.level === level.level)
  if (candidates.length === 0) return []
  if (dp === null) return candidates

  const useScope  = Array.isArray(dp) && dp.includes('scope')
  const useTiming = dp === 'timing' || (Array.isArray(dp) && dp.includes('timing'))

  // scope + timing 복합: 범위별 독립 처리
  if (useScope && useTiming && (scopes ?? []).length > 0) {
    const seenIds = new Set()
    const results = []
    for (const scope of (scopes ?? [])) {
      const byScope = candidates.filter(f => {
        const fs = f.scope ?? []
        return fs.length === 0 || fs.includes(scope)
      })
      if (byScope.length === 0) continue
      let picked = null
      for (const when of (timingRank ?? [])) {
        const hit = byScope.filter(f => f.when === when)
        if (hit.length > 0) { picked = hit; break }
      }
      if (!picked) picked = byScope
      for (const item of picked) {
        if (!seenIds.has(item.id)) { seenIds.add(item.id); results.push(item) }
      }
    }
    return results
  }

  let pool = candidates
  if (useScope && (scopes ?? []).length > 0) {
    const filtered = candidates.filter(f => {
      const fs = f.scope ?? []
      if (fs.length === 0) return true
      return fs.some(s => (scopes ?? []).includes(s))
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

// ── analyzeLevel (수정 후 로직 반영) ──────────────────────────
function analyzeLevel(level, scopes, timingRank) {
  const dp = level.decideParams
  const candidates = INTERVENTIONS.filter(f => f.level === level.level)
  if (candidates.length === 0) return { items: [], fallback: null }

  const makeItem = (f, passed, dropReason) => ({
    id: f.id, nameKo: f.nameKo, when: f.when,
    scope: f.scope ?? [], coverage: f.coverage?.n ?? 0,
    passed, dropReason,
  })
  const sortItems = items => [...items].sort((a, b) => {
    if (b.coverage !== a.coverage) return b.coverage - a.coverage
    return a.id.localeCompare(b.id)
  })

  if (dp === null) {
    return { items: sortItems(candidates.map(f => makeItem(f, true, null))), fallback: null }
  }

  const useScope  = Array.isArray(dp) && dp.includes('scope')
  const useTiming = dp === 'timing' || (Array.isArray(dp) && dp.includes('timing'))

  if (useScope && useTiming && (scopes ?? []).length > 0) {
    const passedIds = new Set()
    const timingLostIds = new Set()
    let anyTimingFallback = false

    for (const scope of (scopes ?? [])) {
      const byScope = candidates.filter(f => {
        const fs = f.scope ?? []
        return fs.length === 0 || fs.includes(scope)
      })
      if (byScope.length === 0) continue
      let picked = null
      for (const when of (timingRank ?? [])) {
        const hit = byScope.filter(f => f.when === when)
        if (hit.length > 0) { picked = hit; break }
      }
      if (!picked) { picked = byScope; anyTimingFallback = true }
      const pickedIds = new Set(picked.map(f => f.id))
      byScope.forEach(f => { if (!pickedIds.has(f.id)) timingLostIds.add(f.id) })
      picked.forEach(f => passedIds.add(f.id))
    }

    const items = sortItems(candidates.map(f => {
      const passed = passedIds.has(f.id)
      let dropReason = null
      if (!passed) {
        const fs = f.scope ?? []
        const matchesAnyScope = fs.length === 0 || fs.some(s => (scopes ?? []).includes(s))
        dropReason = matchesAnyScope ? 'timing 밀림' : 'scope 불일치'
      }
      return makeItem(f, passed, dropReason)
    }))
    return { items, fallback: anyTimingFallback ? 'timing' : null }
  }

  let pool = candidates
  const scopeDropped = new Set()
  let scopeFallback = false
  if (useScope && (scopes ?? []).length > 0) {
    const filtered = candidates.filter(f => {
      const fs = f.scope ?? []
      return fs.length === 0 || fs.some(s => (scopes ?? []).includes(s))
    })
    if (filtered.length > 0) {
      const pids = new Set(filtered.map(f => f.id))
      candidates.forEach(f => { if (!pids.has(f.id)) scopeDropped.add(f.id) })
      pool = filtered
    } else scopeFallback = true
  }

  const timingDropped = new Set()
  let timingFallback = false
  if (useTiming) {
    const ranks = timingRank ?? []
    let found = false
    for (const when of ranks) {
      const byTiming = pool.filter(f => f.when === when)
      if (byTiming.length > 0) {
        const pids = new Set(byTiming.map(f => f.id))
        pool.forEach(f => { if (!pids.has(f.id)) timingDropped.add(f.id) })
        pool = byTiming; found = true; break
      }
    }
    if (!found) timingFallback = true
  }

  const passedIds = new Set(pool.map(f => f.id))
  const items = sortItems(candidates.map(f => {
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

// ── 등급 계산 ───────────────────────────────────────────────
function levelGrade(level, state) {
  const agencyRank = state.agencyRank ?? []
  const fa = (state.featureAccepted ?? {})[level.level]
  if (fa === undefined) return 7
  const i = agencyRank.indexOf(level.agency)
  if (i === 0) { if (fa==='ok') return 1; if (fa==='weak') return 2; if (fa==='strong') return 5 }
  if (i === 1) { if (fa==='ok') return 3; if (fa==='weak') return 4; if (fa==='strong') return 6 }
  return 7
}

function lexSort(items) {
  return [...items].sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level
    const ca = a.coverage?.n ?? 0, cb = b.coverage?.n ?? 0
    if (cb !== ca) return cb - ca
    return a.id.localeCompare(b.id)
  })
}
function sortG7(items, agencyRank) {
  const ri = agency => { const i=(agencyRank??[]).indexOf(agency); return i===-1?99:i }
  return [...items].sort((a,b)=>{
    const ra=ri(a.agency),rb=ri(b.agency); if(ra!==rb) return ra-rb
    if(b.level!==a.level) return b.level-a.level
    const ca=a.coverage?.n??0,cb=b.coverage?.n??0; if(cb!==ca) return cb-ca
    return a.id.localeCompare(b.id)
  })
}

function buildFeaturePicks(state) {
  const agencyRank=state.agencyRank??[], scopes=state.scopes??[], timingRank=state.timingRank??[]
  const levelsWithGrade = LEVELS.map(level=>({level,grade:levelGrade(level,state)}))
  const candidates=[], usedIds=new Set()
  for (const grade of [1,2,3,4,5,6,7]) {
    const gradeLevels = levelsWithGrade.filter(g=>g.grade===grade).map(g=>g.level)
    const gradeItems = gradeLevels.flatMap(level=>itemsForLevel(level,scopes,timingRank))
    const sorted = grade===7 ? sortG7(gradeItems,agencyRank) : lexSort(gradeItems)
    for (const item of sorted) {
      if (!usedIds.has(item.id)) { usedIds.add(item.id); candidates.push({...item,grade}) }
    }
    if (candidates.length>=3) break
  }
  return candidates.slice(0,3)
}

// ── 앱 점수 (OS 필터 반영) ─────────────────────────────────
function computeAppScore(app, state, featureIds) {
  const env=state.env??{}, userOs=env.os??[], userPlatforms=env.platforms??[], userRoute=env.route??[]
  const scopes=state.scopes??[], bypass=state.bypassWanted??{}
  const coveredIds = featureIds.filter(fid=>(app.features??[]).includes(fid))
  const coverageScore = coveredIds.length
  let scopeScore=0
  for (const s of scopes) {
    const featsForScope=SCOPE_TO_L10_FEATS[s]??[]
    if (featsForScope.some(fid=>(app.features??[]).includes(fid))) scopeScore+=1
  }
  let envScore=0
  envScore += userOs.filter(o=>app.os.includes(o)).length
  const normalRoutes=[...new Set(userRoute.map(r=>ROUTE_MAP[r]).filter(Boolean))]
  for (const rt of normalRoutes) { if ((app.worksOn??[]).includes(rt)) envScore+=1 }
  const iap=inAppPlatforms(app)
  if (iap.length>0) envScore+=userPlatforms.filter(p=>iap.includes(p)).length
  if (userOs.includes('desktop')&&(app.devices??[]).includes('pc')) envScore+=1
  const hasSchedule=state.dayType==='daily'||state.dayType==='split'
  const scheduleScore=hasSchedule&&(app.features??[]).includes('schedule-window')?1:0
  let bypassScore=0
  for (const [fid,bv] of Object.entries(bypass)) {
    if (bv!==true) continue; if ((app.features??[]).includes(fid)) bypassScore++
  }
  return {coverageScore,coveredIds,scopeScore,envScore,scheduleScore,bypassScore}
}

function buildAppPicks(state, featureIds) {
  // OS 필터: ios/android 가 하나라도 있으면 교집합 있는 앱만
  const userMobileOs=(state.env?.os??[]).filter(o=>o==='ios'||o==='android')
  const pool=userMobileOs.length>0
    ? APPS.filter(app=>app.os.some(o=>userMobileOs.includes(o)))
    : APPS
  const scored=pool.map(app=>({...app,...computeAppScore(app,state,featureIds)}))
  scored.sort((a,b)=>{
    if(b.coverageScore!==a.coverageScore) return b.coverageScore-a.coverageScore
    if(b.scopeScore!==a.scopeScore)       return b.scopeScore-a.scopeScore
    if(b.envScore!==a.envScore)           return b.envScore-a.envScore
    if(b.scheduleScore!==a.scheduleScore) return b.scheduleScore-a.scheduleScore
    if(b.bypassScore!==a.bypassScore)     return b.bypassScore-a.bypassScore
    return a.id.localeCompare(b.id)
  })
  if (scored.length<3) console.error(`[engine] buildAppPicks: 후보 ${scored.length}개 — 3개 미만`)
  return scored.slice(0,3)
}

function resolveArchetype(state) {
  const agency=(state.agencyRank??[])[0]??null, timing=(state.timingRank??[])[0]??null
  if (!agency||!timing) return '_default'
  return `${agency}_${timing}`
}

function buildGradeTable(state, pickedIds) {
  const agencyRank=state.agencyRank??[], accepted=state.featureAccepted??{}
  const scopes=state.scopes??[], timingRank=state.timingRank??[]
  const ri = agency=>{const i=agencyRank.indexOf(agency);return i===-1?99:i}
  const rows = LEVELS.map(level=>{
    const grade=levelGrade(level,state), rank=agencyRank.indexOf(level.agency)
    const answer=accepted[level.level]??null
    const {items:rawItems,fallback}=analyzeLevel(level,scopes,timingRank)
    const items=rawItems.map(it=>({...it,picked:pickedIds.includes(it.id)}))
    return {level:level.level,nameKo:level.nameKo,agency:level.agency,rank,answer,grade,decideParams:level.decideParams,items,fallback}
  })
  return rows.sort((a,b)=>{
    if(a.grade!==b.grade) return a.grade-b.grade
    if(a.grade===7){const ra=ri(a.agency),rb=ri(b.agency);if(ra!==rb) return ra-rb}
    return b.level-a.level
  })
}

function recommend(state) {
  const features = buildFeaturePicks(state)
  const featureIds = features.map(f=>f.id)
  const apps = buildAppPicks(state, featureIds)
  const archetype = resolveArchetype(state)
  const gradeTable = buildGradeTable(state, featureIds)
  return {features, apps, archetype, gradeTable}
}

// ── 프리셋 ────────────────────────────────────────────────────
const DEFAULT_ENV = {devices:['mobile'],os:['ios','android'],route:['앱'],platforms:['YouTube','Instagram']}
const DEFAULT_PATCH = {hours:{daily:[22,23,24,1,2],weekday:[],weekend:[]},dayType:'daily',bypassMethods:{},bypassWanted:{'lock-app-settings':true,'prevent-uninstall':true},simsPlayed:[],oxSkipped:[]}
function makePreset({env:envOverride,...rest}){return{...DEFAULT_PATCH,env:{...DEFAULT_ENV,...envOverride},agencyVisited:rest.agencyRank,...rest}}

const PRESETS = [
  {name:'P1·최소응답',patch:makePreset({agencyRank:['supported','flexible','limited'],featureAccepted:{1:'ok'},scopes:['shorts-tab'],timingRank:['At','InUse','Pre'],oxSkipped:['flexible']})},
  {name:'P2·전부수용',patch:makePreset({agencyRank:['flexible','limited','supported'],featureAccepted:{4:'ok',5:'ok',6:'ok',7:'ok',8:'ok',9:'ok'},scopes:['app','shorts-row','shorts-tab','content'],timingRank:['At','InUse','Pre']})},
  {name:'P3·전부과함',patch:makePreset({agencyRank:['flexible','supported','limited'],featureAccepted:{1:'strong',2:'strong',3:'strong',4:'strong',5:'strong',6:'strong',7:'strong',8:'strong',9:'strong'},scopes:['shorts-tab'],timingRank:['InUse','At','Pre']})},
  {name:'P4·완전차단',patch:makePreset({agencyRank:['limited','flexible','supported'],featureAccepted:{10:'ok'},scopes:['app','shorts-row','shorts-tab','content'],timingRank:['InUse','At','Pre']})},
  {name:'P5·평가최소',patch:makePreset({agencyRank:['flexible','supported','limited'],featureAccepted:{4:'ok'},scopes:['shorts-tab'],timingRank:['At','InUse','Pre'],oxSkipped:['supported']})},
  {name:'P6·지원없는환경',patch:makePreset({env:{os:['android'],platforms:['YouTube']},agencyRank:['supported','flexible','limited'],featureAccepted:{1:'ok',2:'ok',3:'ok'},scopes:['shorts-tab'],timingRank:['Pre','At','InUse']})},
]

// ── 특수 케이스 ────────────────────────────────────────────────
const CASE_CONTENT = makePreset({agencyRank:['limited','flexible','supported'],featureAccepted:{10:'ok'},scopes:['content'],timingRank:['InUse','Pre','At']})
const CASE_DESKTOP = makePreset({env:{os:['desktop'],platforms:[]},agencyRank:['supported','flexible','limited'],featureAccepted:{1:'ok'},scopes:['shorts-tab'],timingRank:['At','InUse','Pre']})

// ── 계산 ──────────────────────────────────────────────────────
const results = PRESETS.map(p=>({name:p.name,...recommend(p.patch),state:p.patch}))
const caseContent = recommend(CASE_CONTENT)
const caseDesktop = recommend(CASE_DESKTOP)

// ── docs/preset-check2.md 작성 ────────────────────────────────
const lines = []
lines.push(`# preset-check2.md — ${new Date().toISOString().slice(0,10)}`)
lines.push('')
lines.push('engine 수정(OS 필터 + scope+timing 범위별 독립 처리 + items 정렬) 후 검증 결과')
lines.push('')

// P4 상세 — 범위별 판정 과정
lines.push('## P4 완전 차단 — L10 범위별 판정 과정')
lines.push('')
const p4 = results[3]
const l10Level = LEVELS.find(l=>l.level===10)
const p4scopes = p4.state.scopes
const p4timing = p4.state.timingRank
const p4cands = INTERVENTIONS.filter(f=>f.level===10)

p4scopes.forEach(scope=>{
  const byScope = p4cands.filter(f=>{const fs=f.scope??[];return fs.length===0||fs.includes(scope)})
  let picked=null, pickedWhen=null
  for (const when of p4timing) {
    const hit=byScope.filter(f=>f.when===when)
    if(hit.length>0){picked=hit;pickedWhen=when;break}
  }
  if(!picked){picked=byScope;pickedWhen='폴백'}
  lines.push(`- scope="${scope}": 후보=[${byScope.map(f=>f.id).join(',')}]  → timing="${pickedWhen}" 선택=[${picked.map(f=>f.id).join(',')}]`)
})
lines.push('')

const {items:p4L10items} = analyzeLevel(l10Level, p4scopes, p4timing)
const p4survived = p4L10items.filter(it=>it.passed)
const p4dropped  = p4L10items.filter(it=>!it.passed)
lines.push(`**생존:** ${p4survived.map(it=>`${it.id}(${it.when})`).join(', ')}`)
lines.push(`**탈락:** ${p4dropped.map(it=>`${it.id}[${it.dropReason}]`).join(', ')}`)
lines.push(`**추천 기능:** ${p4.features.map(f=>`${f.id}(L${f.level},G${f.grade})`).join(', ')}`)
lines.push(`**추천 앱:**   ${p4.apps.map(a=>`${a.id}(os=[${a.os.join(',')}])`).join(', ')}`)
lines.push('')

// P6 Android 확인
lines.push('## P6 지원 없는 환경 — 앱 Android 지원')
lines.push('')
const p6 = results[5]
const p6AllAndroid = p6.apps.every(a=>a.os.includes('android'))
lines.push(`env.os=['android'], userMobileOs=['android']`)
lines.push(`- 앱 필터 후보: ${APPS.filter(a=>a.os.includes('android')).length}개 (Android 지원)`)
p6.apps.forEach((a,i)=>lines.push(`- ${i+1}. ${a.id} os=[${a.os.join(',')}] → Android지원: ${a.os.includes('android')?'O':'X'}`))
lines.push(`- **3개 모두 Android 지원: ${p6AllAndroid?'O':'X'}**`)
lines.push(`- 추천 기능: ${p6.features.map(f=>`${f.id}(L${f.level},G${f.grade})`).join(', ')}`)
lines.push('')

// P1/P2/P3/P5 변경 전후 비교
lines.push('## P1/P2/P3/P5 — 변경 전후 비교')
lines.push('')
lines.push('이전 결과(preset-check.md 기준) vs 현재:')
lines.push('')
const prev = {
  'P1·최소응답':  {feats:'notify-entry(L1,G1) | path-guide(L3,G7) | visual-demotion(L2,G7)',apps:'12_SZ|16_UT|17_NL'},
  'P2·전부수용':  {feats:'mission-exercise(L9,G1) | mission-capture(L8,G1) | mission-simple(L8,G1)',apps:'2_SF|20_J|12_SZ'},
  'P3·전부과함':  {feats:'mission-exercise(L9,G5) | mission-capture(L8,G5) | mission-simple(L8,G5)',apps:'2_SF|20_J|12_SZ'},
  'P5·평가최소':  {feats:'confirm(L4,G1) | mission-exercise(L9,G7) | mission-capture(L8,G7)',apps:'4_A|20_J|18_CR'},
}
for (const r of [results[0],results[1],results[2],results[4]]) {
  const p = prev[r.name]
  const nowFeats = r.features.map(f=>`${f.id}(L${f.level},G${f.grade})`).join(' | ')
  const nowApps  = r.apps.map(a=>a.id).join('|')
  const featChanged = nowFeats !== (p?.feats ?? '')
  const appChanged  = nowApps  !== (p?.apps  ?? '')
  lines.push(`### ${r.name}`)
  lines.push(`기능: ${featChanged?'**변경** ':''}${nowFeats}`)
  if(p&&featChanged) lines.push(`  이전: ${p.feats}`)
  lines.push(`앱:   ${appChanged?'**변경** ':''}${nowApps}`)
  if(p&&appChanged) lines.push(`  이전: ${p.apps}`)
  lines.push('')
}

// 특수 케이스: scopes=['content'], timing=['InUse',...]
lines.push('## 특수 케이스: scopes=[content], timing=[InUse,Pre,At]')
lines.push('')
const cc = caseContent
const l10cc = analyzeLevel(l10Level, ['content'], ['InUse','Pre','At'])
lines.push(`scopes=['content'], timingRank=['InUse','Pre','At']`)
lines.push(`L10 후보 중 scope=[content]: ${INTERVENTIONS.filter(f=>f.level===10&&(f.scope??[]).includes('content')).map(f=>`${f.id}(${f.when})`).join(', ')}`)
const ccSurvived = l10cc.items.filter(it=>it.passed)
const ccDropped  = l10cc.items.filter(it=>!it.passed)
lines.push(`생존: ${ccSurvived.map(it=>`${it.id}(${it.when})`).join(', ')}  fallback:${l10cc.fallback??'none'}`)
lines.push(`탈락: ${ccDropped.map(it=>`${it.id}[${it.dropReason}]`).join(', ')}`)
lines.push(`추천 기능: ${cc.features.map(f=>`${f.id}(L${f.level},G${f.grade})`).join(', ')}`)
lines.push('')

// 특수 케이스: os=['desktop'] 만 — 앱 필터 없음
lines.push('## 특수 케이스: os=[desktop] 만 — 앱 필터 미적용')
lines.push('')
const cd = caseDesktop
const userMobileOsDesktop = ['desktop'].filter(o=>o==='ios'||o==='android')
lines.push(`userMobileOs=[${userMobileOsDesktop.join(',')}] → 길이 ${userMobileOsDesktop.length} → 필터 적용: ${userMobileOsDesktop.length>0?'O':'X'}`)
lines.push(`앱 3개: ${cd.apps.map(a=>`${a.id}(os=[${a.os.join(',')}])`).join(', ')}`)
lines.push(`에러 없이 3개 반환: ${cd.apps.length===3?'O':'X'}`)
lines.push('')

// items 정렬 확인
lines.push('## 등급표 items 정렬 확인 (L8 = flexible, decideParams=null, 3개 항목)')
lines.push('')
const l8Level = LEVELS.find(l=>l.level===8)
const l8state = results[1].state // P2: featureAccepted L8='ok', agencyRank[0]=flexible
const {items:l8items} = analyzeLevel(l8Level, l8state.scopes, l8state.timingRank)
lines.push(`L8 analyzeLevel items 순서: ${l8items.map(it=>`${it.id}(n=${it.coverage})`).join(' → ')}`)
lines.push(`기대: mission-capture(n=3) → mission-simple(n=2) → mission-altapp(n=1)`)
lines.push(`일치: ${l8items.map(it=>it.id).join(',') === 'mission-capture,mission-simple,mission-altapp' ? 'O' : 'X'}`)
lines.push('')

// 전체 요약표
lines.push('## 전체 프리셋 결과표')
lines.push('')
lines.push('| 프리셋 | 아키타입 | 기능1 | 기능2 | 기능3 | 앱1 | 앱2 | 앱3 |')
lines.push('|---|---|---|---|---|---|---|---|')
for (const r of results) {
  const f=(i)=>r.features[i]?`${r.features[i].id}(L${r.features[i].level},G${r.features[i].grade})`:'—'
  const a=(i)=>r.apps[i]?`${r.apps[i].id}[${r.apps[i].os.join('+')}]`:'—'
  lines.push(`|${r.name}|${r.archetype}|${f(0)}|${f(1)}|${f(2)}|${a(0)}|${a(1)}|${a(2)}|`)
}
lines.push('')

const outPath = resolve(root, 'docs/preset-check2.md')
writeFileSync(outPath, lines.join('\n'), 'utf8')
console.log('저장 완료: docs/preset-check2.md')

// ── 터미널 요약 ────────────────────────────────────────────────
console.log('\n=== P4 L10 범위별 판정 ===')
p4scopes.forEach(scope=>{
  const byScope=p4cands.filter(f=>{const fs=f.scope??[];return fs.length===0||fs.includes(scope)})
  let picked=null,pickedWhen=null
  for (const when of p4timing){const hit=byScope.filter(f=>f.when===when);if(hit.length>0){picked=hit;pickedWhen=when;break}}
  if(!picked){picked=byScope;pickedWhen='폴백'}
  console.log(`  scope="${scope}": ${byScope.map(f=>f.id).join(',')}  → [${pickedWhen}] ${picked.map(f=>f.id).join(',')}`)
})
console.log(`  생존: ${p4survived.map(it=>it.id).join(', ')}`)
console.log(`  추천: ${p4.features.map(f=>`${f.id}(G${f.grade})`).join(', ')}`)

console.log('\n=== P6 앱 Android 지원 ===')
p6.apps.forEach((a,i)=>console.log(`  ${i+1}. ${a.id} [${a.os.join(',')}] Android:${a.os.includes('android')?'O':'X'}`))
console.log(`  3개 모두 Android: ${p6AllAndroid?'O':'X'}`)
console.log(`  추천 기능: ${p6.features.map(f=>`${f.id}(G${f.grade})`).join(', ')}`)

console.log('\n=== P1/P2/P3/P5 변경 여부 ===')
for (const r of [results[0],results[1],results[2],results[4]]) {
  const p=prev[r.name]
  const nowFeats=r.features.map(f=>`${f.id}(L${f.level},G${f.grade})`).join('|')
  const nowApps=r.apps.map(a=>a.id).join('|')
  const fc=nowFeats!==(p?.feats??''), ac=nowApps!==(p?.apps??'')
  console.log(`  ${r.name}: 기능${fc?'변경':'동일'} 앱${ac?'변경':'동일'}`)
  if(fc) console.log(`    기능 변경: ${nowFeats}`)
  if(ac) console.log(`    앱 변경: ${nowApps}`)
}

console.log('\n=== 특수 케이스: content 범위 + InUse 시점 ===')
console.log(`  L10 생존: ${ccSurvived.map(it=>`${it.id}(${it.when})`).join(', ')}`)
console.log(`  fallback: ${l10cc.fallback??'none'}`)
console.log(`  block-content 생존: ${ccSurvived.some(it=>it.id==='block-content')?'O':'X'}`)
console.log(`  폴백 발동: ${l10cc.fallback?'O':'X'}`)

console.log('\n=== 특수 케이스: os=[desktop] ===')
console.log(`  userMobileOs=[] → 필터 미적용 → 앱 ${cd.apps.length}개`)
console.log(`  ${cd.apps.map(a=>a.id).join(', ')}`)

console.log('\n=== items 정렬 확인 ===')
console.log(`  L8 items: ${l8items.map(it=>`${it.id}(n=${it.coverage})`).join(' → ')}`)
console.log(`  정렬 일치: ${l8items.map(it=>it.id).join(',') === 'mission-capture,mission-simple,mission-altapp' ? 'O' : 'X'}`)

console.log('\n→ 상세: docs/preset-check2.md')
