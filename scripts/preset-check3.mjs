/**
 * preset-check3.mjs — osFullScore 추가 후 검증
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

// ── itemsForLevel (이전과 동일) ────────────────────────────────
function itemsForLevel(level, scopes, timingRank) {
  const dp = level.decideParams
  const candidates = INTERVENTIONS.filter(f => f.level === level.level)
  if (candidates.length === 0) return []
  if (dp === null) return candidates

  const useScope  = Array.isArray(dp) && dp.includes('scope')
  const useTiming = dp === 'timing' || (Array.isArray(dp) && dp.includes('timing'))

  if (useScope && useTiming && (scopes ?? []).length > 0) {
    const seenIds = new Set(), results = []
    for (const scope of scopes) {
      const byScope = candidates.filter(f => { const fs=f.scope??[]; return fs.length===0||fs.includes(scope) })
      if (byScope.length === 0) continue
      let picked = null
      for (const when of timingRank) { const hit=byScope.filter(f=>f.when===when); if(hit.length>0){picked=hit;break} }
      if (!picked) picked = byScope
      for (const item of picked) { if (!seenIds.has(item.id)) { seenIds.add(item.id); results.push(item) } }
    }
    return results
  }
  let pool = candidates
  if (useScope && (scopes ?? []).length > 0) {
    const filtered = candidates.filter(f => { const fs=f.scope??[]; return fs.length===0||fs.some(s=>scopes.includes(s)) })
    if (filtered.length > 0) pool = filtered
  }
  if (useTiming) {
    for (const when of (timingRank ?? [])) { const bt=pool.filter(f=>f.when===when); if(bt.length>0) return bt }
    return pool
  }
  return pool
}

// ── 등급 계산 ─────────────────────────────────────────────────
function levelGrade(level, state) {
  const ar = state.agencyRank ?? [], fa = (state.featureAccepted ?? {})[level.level]
  if (fa === undefined) return 7
  const i = ar.indexOf(level.agency)
  if (i === 0) { if(fa==='ok') return 1; if(fa==='weak') return 2; if(fa==='strong') return 5 }
  if (i === 1) { if(fa==='ok') return 3; if(fa==='weak') return 4; if(fa==='strong') return 6 }
  return 7
}
function lexSort(items) {
  return [...items].sort((a,b)=>{
    if(b.level!==a.level) return b.level-a.level
    const ca=a.coverage?.n??0,cb=b.coverage?.n??0; if(cb!==ca) return cb-ca
    return a.id.localeCompare(b.id)
  })
}
function sortG7(items, ar) {
  const ri=agency=>{const i=(ar??[]).indexOf(agency);return i===-1?99:i}
  return [...items].sort((a,b)=>{
    const ra=ri(a.agency),rb=ri(b.agency); if(ra!==rb) return ra-rb
    if(b.level!==a.level) return b.level-a.level
    const ca=a.coverage?.n??0,cb=b.coverage?.n??0; if(cb!==ca) return cb-ca
    return a.id.localeCompare(b.id)
  })
}
function buildFeaturePicks(state) {
  const ar=state.agencyRank??[], scopes=state.scopes??[], tr=state.timingRank??[]
  const lwg=LEVELS.map(l=>({level:l,grade:levelGrade(l,state)}))
  const cands=[], used=new Set()
  for (const grade of [1,2,3,4,5,6,7]) {
    const gls=lwg.filter(g=>g.grade===grade).map(g=>g.level)
    const gi=gls.flatMap(l=>itemsForLevel(l,scopes,tr))
    const sorted=grade===7?sortG7(gi,ar):lexSort(gi)
    for (const item of sorted) { if(!used.has(item.id)){used.add(item.id);cands.push({...item,grade})} }
    if (cands.length>=3) break
  }
  return cands.slice(0,3)
}

// ── computeAppScore (osFullScore 포함, userMobileOs 인자) ──────
function computeAppScore(app, state, featureIds, userMobileOs) {
  const env=state.env??{}, userOs=env.os??[], userPlatforms=env.platforms??[], userRoute=env.route??[]
  const scopes=state.scopes??[], bypass=state.bypassWanted??{}

  const osFullScore = userMobileOs.length===0 || userMobileOs.every(o=>app.os.includes(o)) ? 1 : 0
  const coveredIds = featureIds.filter(fid=>(app.features??[]).includes(fid))
  const coverageScore = coveredIds.length
  let scopeScore=0
  for (const s of scopes) {
    const featsForScope=SCOPE_TO_L10_FEATS[s]??[]
    if (featsForScope.some(fid=>(app.features??[]).includes(fid))) scopeScore+=1
  }
  let envScore=0
  envScore+=userOs.filter(o=>app.os.includes(o)).length
  const normalRoutes=[...new Set(userRoute.map(r=>ROUTE_MAP[r]).filter(Boolean))]
  for (const rt of normalRoutes) { if((app.worksOn??[]).includes(rt)) envScore+=1 }
  const iap=inAppPlatforms(app)
  if (iap.length>0) envScore+=userPlatforms.filter(p=>iap.includes(p)).length
  if (userOs.includes('desktop')&&(app.devices??[]).includes('pc')) envScore+=1
  const hasSchedule=state.dayType==='daily'||state.dayType==='split'
  const scheduleScore=hasSchedule&&(app.features??[]).includes('schedule-window')?1:0
  let bypassScore=0
  for (const [fid,bv] of Object.entries(bypass)) {
    if(bv!==true) continue; if((app.features??[]).includes(fid)) bypassScore++
  }
  return {osFullScore,coverageScore,coveredIds,scopeScore,envScore,scheduleScore,bypassScore}
}

// ── buildAppPicks (osFullScore 정렬 맨 앞) ─────────────────────
function buildAppPicks(state, featureIds) {
  const userMobileOs=(state.env?.os??[]).filter(o=>o==='ios'||o==='android')
  const pool=userMobileOs.length>0
    ? APPS.filter(app=>app.os.some(o=>userMobileOs.includes(o)))
    : APPS
  const scored=pool.map(app=>({...app,...computeAppScore(app,state,featureIds,userMobileOs)}))
  scored.sort((a,b)=>{
    if(b.osFullScore   !==a.osFullScore)    return b.osFullScore   -a.osFullScore
    if(b.coverageScore !==a.coverageScore)  return b.coverageScore -a.coverageScore
    if(b.scopeScore    !==a.scopeScore)     return b.scopeScore    -a.scopeScore
    if(b.envScore      !==a.envScore)       return b.envScore      -a.envScore
    if(b.scheduleScore !==a.scheduleScore)  return b.scheduleScore -a.scheduleScore
    if(b.bypassScore   !==a.bypassScore)    return b.bypassScore   -a.bypassScore
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

function recommend(state) {
  const features=buildFeaturePicks(state)
  const featureIds=features.map(f=>f.id)
  const apps=buildAppPicks(state,featureIds)
  const archetype=resolveArchetype(state)
  return {features,apps,archetype}
}

// ── 프리셋 ─────────────────────────────────────────────────────
const DEFAULT_ENV={devices:['mobile'],os:['ios','android'],route:['앱'],platforms:['YouTube','Instagram']}
const DEFAULT_PATCH={hours:{daily:[22,23,24,1,2],weekday:[],weekend:[]},dayType:'daily',bypassMethods:{},bypassWanted:{'lock-app-settings':true,'prevent-uninstall':true},simsPlayed:[],oxSkipped:[]}
function makePreset({env:envOverride,...rest}){return{...DEFAULT_PATCH,env:{...DEFAULT_ENV,...envOverride},agencyVisited:rest.agencyRank,...rest}}

const PRESETS=[
  {name:'P1·최소응답', patch:makePreset({agencyRank:['supported','flexible','limited'],featureAccepted:{1:'ok'},scopes:['shorts-tab'],timingRank:['At','InUse','Pre'],oxSkipped:['flexible']})},
  {name:'P2·전부수용', patch:makePreset({agencyRank:['flexible','limited','supported'],featureAccepted:{4:'ok',5:'ok',6:'ok',7:'ok',8:'ok',9:'ok'},scopes:['app','shorts-row','shorts-tab','content'],timingRank:['At','InUse','Pre']})},
  {name:'P3·전부과함', patch:makePreset({agencyRank:['flexible','supported','limited'],featureAccepted:{1:'strong',2:'strong',3:'strong',4:'strong',5:'strong',6:'strong',7:'strong',8:'strong',9:'strong'},scopes:['shorts-tab'],timingRank:['InUse','At','Pre']})},
  {name:'P4·완전차단', patch:makePreset({agencyRank:['limited','flexible','supported'],featureAccepted:{10:'ok'},scopes:['app','shorts-row','shorts-tab','content'],timingRank:['InUse','At','Pre']})},
  {name:'P5·평가최소', patch:makePreset({agencyRank:['flexible','supported','limited'],featureAccepted:{4:'ok'},scopes:['shorts-tab'],timingRank:['At','InUse','Pre'],oxSkipped:['supported']})},
  {name:'P6·지원없는환경', patch:makePreset({env:{os:['android'],platforms:['YouTube']},agencyRank:['supported','flexible','limited'],featureAccepted:{1:'ok',2:'ok',3:'ok'},scopes:['shorts-tab'],timingRank:['Pre','At','InUse']})},
]

const CASE_DESKTOP=makePreset({env:{os:['desktop'],platforms:[]},agencyRank:['supported','flexible','limited'],featureAccepted:{1:'ok'},scopes:['shorts-tab'],timingRank:['At','InUse','Pre']})

// 이전 결과 (preset-check2.md 기준)
const prev={
  'P1·최소응답': {feats:'notify-entry|path-guide|visual-demotion', apps:'12_SZ|1_S|13_M'},
  'P2·전부수용': {feats:'mission-exercise|mission-capture|mission-simple', apps:'2_SF|20_J|12_SZ'},
  'P3·전부과함': {feats:'mission-exercise|mission-capture|mission-simple', apps:'2_SF|20_J|12_SZ'},
  'P4·완전차단': {feats:'block-app|block-content|block-scroll', apps:'20_J|2_SF|5_N'},
  'P5·평가최소': {feats:'confirm|mission-exercise|mission-capture', apps:'4_A|20_J|18_CR'},
  'P6·지원없는환경': {feats:'path-guide|visual-demotion|notify-entry', apps:'12_SZ|1_S|13_M'},
}

// ── 계산 ──────────────────────────────────────────────────────
const results=PRESETS.map(p=>({name:p.name,...recommend(p.patch),state:p.patch}))
const desktopResult=recommend(CASE_DESKTOP)
const desktopMobileOs=[]  // os=['desktop'] → userMobileOs=[]

// ── docs/preset-check3.md ────────────────────────────────────
const lines=[]
lines.push(`# preset-check3.md — ${new Date().toISOString().slice(0,10)}`)
lines.push('')
lines.push('osFullScore(OS 완전 지원) 추가 후 검증')
lines.push('')

// P1
lines.push('## P1 추천 앱 변경 확인')
lines.push('')
const p1=results[0]
const p1MobileOs=['ios','android']
p1.apps.forEach((a,i)=>{
  const osFull=p1MobileOs.every(o=>a.os.includes(o))
  lines.push(`${i+1}. ${a.id}(${a.shortName})  os=[${a.os.join(',')}]  osFullScore=${a.osFullScore}  coverageScore=${a.coverageScore}  iOS+Android양쪽:${osFull?'O':'X'}`)
})
lines.push(`앱 목록: ${p1.apps.map(a=>a.id).join(' / ')}`)
lines.push(`기대:    12_SZ / 1_S / 4_A`)
lines.push(`일치: ${p1.apps.map(a=>a.id).join('/')===`12_SZ/1_S/4_A`?'O':'X'}`)
lines.push('')

// P6
lines.push('## P6 Android 결과 유지 확인')
lines.push('')
const p6=results[5]
p6.apps.forEach((a,i)=>lines.push(`${i+1}. ${a.id}  os=[${a.os.join(',')}]  osFullScore=${a.osFullScore}  Android:${a.os.includes('android')?'O':'X'}`))
const p6Prev=prev['P6·지원없는환경']
const p6AppsSame=p6.apps.map(a=>a.id).join('|')===p6Prev.apps
lines.push(`이전과 동일: ${p6AppsSame?'O':'X'}`)
lines.push('')

// desktop 케이스
lines.push('## os=[desktop] — osFullScore 모두 1 확인')
lines.push('')
const desktopPool=APPS  // userMobileOs=[] → 필터 없음
const desktopScores=desktopPool.map(app=>({id:app.id,osFullScore:computeAppScore(app,CASE_DESKTOP,[],desktopMobileOs).osFullScore}))
const allOsFull1=desktopScores.every(s=>s.osFullScore===1)
lines.push(`userMobileOs=[] → 전체 ${desktopPool.length}개 앱 모두 osFullScore=1: ${allOsFull1?'O':'X'}`)
lines.push(`추천 앱 3개: ${desktopResult.apps.map(a=>`${a.id}(OS${a.osFullScore})`).join(', ')}`)
lines.push(`에러 없이 3개 반환: ${desktopResult.apps.length===3?'O':'X'}`)
lines.push('')

// P2/P3/P4/P5
lines.push('## P2/P3/P4/P5 — 변경 여부')
lines.push('')
for (const r of [results[1],results[2],results[3],results[4]]) {
  const p=prev[r.name]
  const nowFeats=r.features.map(f=>f.id).join('|')
  const nowApps=r.apps.map(a=>a.id).join('|')
  const fc=nowFeats!==p.feats, ac=nowApps!==p.apps
  lines.push(`### ${r.name}`)
  lines.push(`기능: ${fc?'**변경**':'동일'}  ${nowFeats}`)
  if(fc) lines.push(`  이전: ${p.feats}`)
  lines.push(`앱:   ${ac?'**변경**':'동일'}  ${r.apps.map(a=>`${a.id}(OS${a.osFullScore}|C${a.coverageScore})`).join(' / ')}`)
  if(ac) lines.push(`  이전: ${p.apps}`)
  lines.push('')
}

// 전체 기능 결과
lines.push('## 전체 프리셋 기능 추천 — 변경 없음 확인')
lines.push('')
for (const r of results) {
  const p=prev[r.name]
  const nowFeats=r.features.map(f=>f.id).join('|')
  const same=nowFeats===p?.feats
  lines.push(`${r.name}: ${same?'동일':'**변경**'}  ${nowFeats}`)
}
lines.push('')

// 전체 앱 점수표
lines.push('## 전체 프리셋 앱 점수표')
lines.push('')
lines.push('| 프리셋 | 앱1 | OS1 | C1 | 앱2 | OS2 | C2 | 앱3 | OS3 | C3 |')
lines.push('|---|---|---|---|---|---|---|---|---|---|')
for (const r of results) {
  const a=(i)=>r.apps[i]
  lines.push(`|${r.name}|${a(0)?.id}|${a(0)?.osFullScore}|${a(0)?.coverageScore}|${a(1)?.id}|${a(1)?.osFullScore}|${a(1)?.coverageScore}|${a(2)?.id}|${a(2)?.osFullScore}|${a(2)?.coverageScore}|`)
}

const outPath=resolve(root,'docs/preset-check3.md')
writeFileSync(outPath,lines.join('\n'),'utf8')
console.log('저장 완료: docs/preset-check3.md')

// ── 터미널 요약 ────────────────────────────────────────────────
console.log('\n=== P1 추천 앱 ===')
p1.apps.forEach((a,i)=>console.log(`  ${i+1}. ${a.id}  os=[${a.os.join(',')}]  osFullScore=${a.osFullScore}  coverage=${a.coverageScore}`))
console.log(`  기대: 12_SZ / 1_S / 4_A  →  ${p1.apps.map(a=>a.id).join('/')===`12_SZ/1_S/4_A`?'O':'X'}`)

console.log('\n=== P6 결과 유지 ===')
p6.apps.forEach((a,i)=>console.log(`  ${i+1}. ${a.id}  osFullScore=${a.osFullScore}  Android:${a.os.includes('android')?'O':'X'}`))
console.log(`  이전과 동일: ${p6AppsSame?'O':'X'}`)

console.log('\n=== desktop — osFullScore 모두 1 ===')
console.log(`  전체 ${desktopPool.length}개 앱 osFullScore=1: ${allOsFull1?'O':'X'}`)
console.log(`  추천 앱: ${desktopResult.apps.map(a=>a.id).join(', ')}  에러없이 3개: ${desktopResult.apps.length===3?'O':'X'}`)

console.log('\n=== P2/P3/P4/P5 앱 변경 여부 ===')
for (const r of [results[1],results[2],results[3],results[4]]) {
  const p=prev[r.name]
  const nowApps=r.apps.map(a=>a.id).join('|')
  const ac=nowApps!==p.apps
  console.log(`  ${r.name}: 앱 ${ac?'변경':'동일'}  ${r.apps.map(a=>`${a.id}(OS${a.osFullScore})`).join(' / ')}`)
}

console.log('\n=== 기능 추천 변경 없음 확인 ===')
let allFeatsSame=true
for (const r of results) {
  const p=prev[r.name], nowFeats=r.features.map(f=>f.id).join('|')
  if(nowFeats!==p?.feats){allFeatsSame=false;console.log(`  ${r.name}: 기능 변경! ${nowFeats}`)}
}
if(allFeatsSame) console.log('  전체 6개 프리셋 기능 동일 O')

console.log('\n→ 상세: docs/preset-check3.md')
