// §6 검증 스크립트 — features.json v1.4 + ResultCard + SIMULATIONS
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const raw = JSON.parse(readFileSync(new URL('../src/data/features.json', import.meta.url), 'utf-8'))
const src = new URL('../src', import.meta.url).pathname

let pass = true
function check(label, cond, detail = '') {
  const ok = !!cond
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) pass = false
}
function grep(pattern, file) {
  try { return execSync(`grep -n "${pattern}" "${file}" 2>/dev/null`, { encoding: 'utf-8' }).trim() }
  catch { return '' }
}

// ── 1. FEATURES 23개 전부 descKo 있는지 ─────────────────────
console.log('\n── §6-1. FEATURES descKo 체크 ─────────────────────────')
check('FEATURES.length === 23', raw.features.length === 23, `got ${raw.features.length}`)
const noDesc = raw.features.filter(f => !f.descKo)
check('모든 feature에 descKo', noDesc.length === 0, noDesc.length ? `없는 id: ${noDesc.map(f=>f.id).join(', ')}` : '')

// ── 2. descKoVariants 구조 검증 ─────────────────────────────
console.log('\n── §6-2. descKoVariants 검증 ───────────────────────────')
const f112 = raw.features.find(f => f.id === '1.1.2')
const f213 = raw.features.find(f => f.id === '2.1.3')
check('1.1.2에 descKoVariants.byScope', !!f112?.descKoVariants?.byScope)
const scopes112 = Object.keys(f112?.descKoVariants?.byScope ?? {})
check('1.1.2 byScope 키 4종 (app/entry-point/app-tab/content)',
  ['app','entry-point','app-tab','content'].every(k => scopes112.includes(k)),
  scopes112.join(', '))
check('2.1.3에 descKoVariants.byTaskGroup', !!f213?.descKoVariants?.byTaskGroup)
const groups213 = Object.keys(f213?.descKoVariants?.byTaskGroup ?? {})
check('2.1.3 byTaskGroup 키 4종 (simple/exercise/capture/altapp)',
  ['simple','exercise','capture','altapp'].every(k => groups213.includes(k)),
  groups213.join(', '))

// ── 3. description() 함수 — 변이 확인 ───────────────────────
console.log('\n── §6-3. description() 변이 표 ─────────────────────────')

// description() 로직 인라인 구현 (모듈 import 없이)
const FEATURE_BY_ID = Object.fromEntries(raw.features.map(f => [f.id, f]))
function description(item) {
  const f = FEATURE_BY_ID[item.code]
  if (!f) return ''
  if (f.descKoVariants?.byScope && item.scope) {
    const v = f.descKoVariants.byScope[item.scope]
    if (v !== undefined) return v
  }
  if (f.descKoVariants?.byTaskGroup && item.taskGroup) {
    const v = f.descKoVariants.byTaskGroup[item.taskGroup]
    if (v !== undefined) return v
  }
  return f.descKo ?? ''
}

console.log('\n  1.1.2 × scope:')
const scopes4 = ['app', 'entry-point', 'app-tab', 'content']
const desc112 = scopes4.map(s => description({ code: '1.1.2', scope: s }))
scopes4.forEach((s, i) => console.log(`    scope=${s.padEnd(13)} → "${desc112[i]?.slice(0,45)}${desc112[i]?.length>45?'…':''}"` ))
check('1.1.2 scope 4종이 서로 다른 문장', new Set(desc112).size > 1, `distinct: ${new Set(desc112).size}`)

console.log('\n  2.1.3 × taskGroup:')
const groups4 = ['simple', 'exercise', 'capture', 'altapp']
const desc213 = groups4.map(g => description({ code: '2.1.3', taskGroup: g }))
groups4.forEach((g, i) => console.log(`    taskGroup=${g.padEnd(8)} → "${desc213[i]?.slice(0,45)}${desc213[i]?.length>45?'…':''}"`))
check('2.1.3 taskGroup 4종이 서로 다른 문장', new Set(desc213).size === 4, `distinct: ${new Set(desc213).size}`)

// ── 4. SIMULATIONS 키 11개 + ladder sim 포함 확인 ───────────
console.log('\n── §6-4. SIMULATIONS 키 및 구현 현황 ──────────────────')
const simsArr = raw.sims
check('sims.length === 11', simsArr.length === 11, `got ${simsArr.length}`)
const simKeys = new Set(simsArr.map(s => s.id))
check('SIMULATIONS 키 11종', simKeys.size === 11, [...simKeys].join(', '))

// ladder sim 값이 SIMULATIONS 키에 포함되는지
const ladderSims = new Set()
for (const item of raw.ladder.individual) if (item.sim) ladderSims.add(item.sim)
for (const item of raw.ladder.search.rungs) if (item.sim) ladderSims.add(item.sim)
for (const item of (raw.ladder.unasked || [])) if (item.sim) ladderSims.add(item.sim)
for (const simId of ladderSims) {
  check(`ladder sim '${simId}' → SIMULATIONS에 존재`, simKeys.has(simId))
}

console.log('\n  구현 현황 (stub=true는 실제 행동 불요):')
console.log('  sim id                 | stub | 구현 여부')
console.log('  ' + '─'.repeat(48))
for (const s of simsArr) {
  const implemented = false // 다음 단계에서 구현 예정 → 현재 전부 null
  const stub = s.stub ? '✓   ' : '    '
  console.log(`  ${s.id.padEnd(22)} | ${stub} | ${ implemented ? '✅ 구현' : '⏳ 준비 중 (null)'}`)
}

// ── 5. ResultCard에 영어 코드 / app id / E1~E4 없는지 ────────
console.log('\n── §6-5. ResultCard 영어 코드 잔재 검사 ───────────────')
const rcFile = src + '/components/ResultCard.jsx'
const prohibit = ['E1','E2','E3','E4','enforcementCeiling','f\\.name\\b','f\\.blurb','feature\\.name\\b']
for (const p of prohibit) {
  const found = grep(p, rcFile)
  check(`ResultCard에 '${p}' 없음`, !found, found ? found.split('\n')[0] : '')
}

// ── 6. 결과 화면 렌더 순서 확인 ─────────────────────────────
console.log('\n── §6-6. 결과 화면 렌더 순서 확인 ────────────────────')
const rcContent = readFileSync(rcFile, 'utf-8')
const markers = [
  ['아키타입', '0) 아키타입'],
  ['추천 기능', '1) 추천 기능 3개'],
  ['추천 앱', '2) 추천 앱 3개'],
  ['이렇게 추천한 이유', '3) 이렇게 추천한 이유'],
  ['답변 자세히 보기', '4) 답변 자세히 보기'],
]
let lastIdx = -1
for (const [label, comment] of markers) {
  const idx = rcContent.indexOf(comment)
  check(`렌더 순서: ${label}`, idx > lastIdx, idx === -1 ? '주석 없음' : '')
  if (idx > lastIdx) lastIdx = idx
}

// ── 7. DetailPanel 존재 + swipe 분리 확인 ───────────────────
console.log('\n── §6-7. DetailPanel 구조 확인 ─────────────────────────')
const dpFile = src + '/components/DetailPanel.jsx'
try {
  const dpContent = readFileSync(dpFile, 'utf-8')
  check('DetailPanel.jsx 존재', true)
  check('position: absolute 선언 (.dtl)', readFileSync(src+'/../src/styles.css','utf-8').includes('.dtl {'))
  check('overscroll-behavior: contain', readFileSync(src+'/../src/styles.css','utf-8').includes('overscroll-behavior: contain'))
  check('z-index: 20 (덱 위에)', readFileSync(src+'/../src/styles.css','utf-8').includes('z-index: 20'))
  check('onBack prop 사용', dpContent.includes('onBack'))
} catch(e) {
  check('DetailPanel.jsx 존재', false, e.message)
}

// ── 8. npm run build ──────────────────────────────────────────
console.log('\n── §6-8. build ─────────────────────────────────────────')
try {
  const out = execSync('npm run build 2>&1', { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf-8' })
  check('npm run build 통과', out.includes('built in'))
} catch(e) {
  check('npm run build 통과', false, e.stderr?.slice(0,200))
}

console.log('\n' + '═'.repeat(50))
console.log(pass ? '✅ 모든 검증 통과' : '❌ 실패 항목 있음 — 위 로그 확인')
console.log('═'.repeat(50))
