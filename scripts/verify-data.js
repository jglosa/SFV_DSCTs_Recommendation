// ─────────────────────────────────────────────────────────────
// 데이터 무결성 검증 스크립트
// 실행: node scripts/verify-data.js
// ─────────────────────────────────────────────────────────────

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const f = JSON.parse(readFileSync(join(root, 'src/data/features.json'), 'utf8'))
const a = JSON.parse(readFileSync(join(root, 'src/data/apps.json'), 'utf8'))

function check(label, actual, expected) {
  const ok = actual === expected
  console.log(`${ok ? '✓' : '✗'} ${label.padEnd(24)} = ${String(actual).padStart(3)}  (expect ${expected})`)
  return ok
}

const implCount = a.apps.reduce((sum, app) => sum + Object.keys(app.impl).length, 0)

// FRICTION_UNITS 정의 (features.js 와 동기 유지)
const FRICTION_UNITS = [
  { id: 'u01', enforcement: 'E1', featureIds: ['3.1.1'] },
  { id: 'u02', enforcement: 'E1', featureIds: ['3.1.2'] },
  { id: 'u03', enforcement: 'E1', featureIds: ['3.2.2'] },
  { id: 'u04', enforcement: 'E1', featureIds: ['3.2.3'] },
  { id: 'u05', enforcement: 'E2', featureIds: ['2.1.1', '3.1.3'] },
  { id: 'u06', enforcement: 'E3', featureIds: ['2.1.2'] },
  { id: 'u07', enforcement: 'E3', featureIds: ['2.1.4'] },
  { id: 'u08', enforcement: 'E3', featureIds: ['2.1.3'], branch: true },
  { id: 'u09', enforcement: 'E4', featureIds: ['3.2.1'] },
  { id: 'u10', enforcement: 'E4', featureIds: ['1.1.3'] },
  { id: 'u11', enforcement: 'E4', featureIds: ['1.1.2'] },
  { id: 'u12', enforcement: 'E4', featureIds: ['1.3.1'] },
]

const featureIdSet = new Set(f.features.map(feat => feat.id))
const u05 = FRICTION_UNITS.find(u => u.id === 'u05')
const branchUnits = FRICTION_UNITS.filter(u => u.branch)
const allFeatureIdsExist = FRICTION_UNITS.every(u => u.featureIds.every(id => featureIdSet.has(id)))

let pass = true
pass = check('FEATURES.length',          f.features.length,         23) && pass
pass = check('FRICTION_SET.length',      f.frictionSet.length,      14) && pass
pass = check('BYPASS_TARGETS.length',    f.bypassTargets.length,     4) && pass
pass = check('SCOPE_LEVELS.length',      f.scopeLevels.length,       4) && pass
pass = check('APPS.length',              a.apps.length,             21) && pass
pass = check('impl count sum',           implCount,                169) && pass
pass = check('FRICTION_UNITS.length',    FRICTION_UNITS.length,     12) && pass
pass = check('u05 featureIds count',     u05?.featureIds.length,     2) && pass
pass = check('branch:true count',        branchUnits.length,         1) && pass

const featureIdsOk = allFeatureIdsExist ? 1 : 0
pass = check('FRICTION_UNITS featureIds', featureIdsOk,              1) && pass

// ── SCOPE_CONSEQUENCE 검증 ────────────────────────────────────
const SCOPE_CONSEQUENCE = {
  'app':         '이 앱을 아예 열 수 없습니다',
  'entry-point': '홈에 이 줄이 뜨지 않습니다. 다른 경로로는 들어갈 수 있습니다',
  'app-tab':     '어느 경로로 와도 Shorts에 들어가지 못합니다',
  'content':     '고른 채널·주제만 걸립니다. 나머지 숏폼은 그대로 봅니다',
}
const scopeIds = f.scopeLevels.map(s => s.id)
const consequenceCoversAll = scopeIds.every(id => !!SCOPE_CONSEQUENCE[id])
pass = check('SCOPE_CONSEQUENCE coverage', consequenceCoversAll ? 1 : 0, 1) && pass

// ── ENFORCEMENT_SEARCH 검증 ────────────────────────────────────
const ENFORCEMENT_SEARCH = {
  order: ['E1', 'E2', 'E3', 'E4'],
  start: 'E3',
  rep: { E1: 'u02', E2: 'u05', E3: 'u06', E4: 'u11' },
}

const unitById = Object.fromEntries(FRICTION_UNITS.map(u => [u.id, u]))

// rep의 4개 unitId 가 FRICTION_UNITS 에 존재하고 enforcement 가 키와 일치하는지
let repOk = true
for (const [enfLevel, unitId] of Object.entries(ENFORCEMENT_SEARCH.rep)) {
  const unit = unitById[unitId]
  if (!unit || unit.enforcement !== enfLevel) repOk = false
}
pass = check('ENFORCEMENT_SEARCH.rep ok', repOk ? 1 : 0, 1) && pass

// nextSearchLevel 인라인 구현 (store.js 와 동일한 로직)
function nextSearchLevel(history) {
  const { order, start } = ENFORCEMENT_SEARCH
  if (history.length === 0) return start
  let lo = 0, hi = order.length - 1
  for (const step of history) {
    const mid = Math.ceil((lo + hi) / 2)
    if (step.accepted) lo = mid + 1
    else hi = mid - 1
  }
  if (lo > hi) return null
  return order[Math.ceil((lo + hi) / 2)]
}

// 탐색을 실행해 ceiling 과 탐색 횟수를 반환
function runSearch(steps) {
  // steps: [accepted: boolean] 순서대로
  const history = []
  let level = ENFORCEMENT_SEARCH.start
  for (const accepted of steps) {
    history.push({ level, accepted })
    level = nextSearchLevel(history)
    if (level === null) break
  }
  // ceiling 결정: 마지막 수용 단, 없으면 'none'
  let ceiling = 'none'
  for (const s of history) if (s.accepted) ceiling = s.level
  return { ceiling, rounds: history.length, history }
}

// unitsForCeiling 인라인 구현
function unitsForCeiling(ceiling) {
  if (!ceiling || ceiling === 'none') return []
  const rep = ENFORCEMENT_SEARCH.rep[ceiling]
  return FRICTION_UNITS.filter(u => u.enforcement === ceiling && u.id !== rep)
}

function checkPath(label, steps, expectCeiling) {
  const { ceiling, rounds, history } = runSearch(steps)
  const levels = history.map(s => `${s.level}(${s.accepted ? '✓' : '✗'})`).join(' → ')
  const ceilOk = ceiling === expectCeiling
  const roundsOk = rounds >= 2 && rounds <= 3
  const rowPass = ceilOk && roundsOk
  pass = rowPass && pass
  return { label, levels, ceiling, expectCeiling, rounds, ceilOk, roundsOk }
}

const paths = [
  checkPath('E3✓ E4✓ → E4',           [true,  true],         'E4'),
  checkPath('E3✓ E4✗ → E3',           [true,  false],        'E3'),
  checkPath('E3✗ E2✓ → E2',           [false, true],         'E2'),
  checkPath('E3✗ E2✗ E1✓ → E1',      [false, false, true],  'E1'),
  checkPath('E3✗ E2✗ E1✗ → none',    [false, false, false], 'none'),
]

console.log()
console.log('── 탐색 경로 검증 ──────────────────────────────────────────')
console.log('경로'.padEnd(22) + '탐색'.padEnd(32) + 'ceiling'.padEnd(8) + '기대'.padEnd(8) + '횟수'.padEnd(5) + '결과')
for (const p of paths) {
  const mark = (p.ceilOk && p.roundsOk) ? '✓' : '✗'
  console.log(
    p.label.padEnd(22) +
    p.levels.padEnd(32) +
    p.ceiling.padEnd(8) +
    p.expectCeiling.padEnd(8) +
    String(p.rounds).padEnd(5) +
    mark
  )
}

// unitsForCeiling 에서 대표 항목 제외 확인
const unitsE3 = unitsForCeiling('E3')
const repE3 = ENFORCEMENT_SEARCH.rep['E3']  // u06
const repExcluded = !unitsE3.some(u => u.id === repE3)
pass = check('rep excluded in E3',       repExcluded ? 1 : 0, 1) && pass

// E3 ceiling → u08(branch) 포함
const hasU08inE3 = unitsE3.some(u => u.id === 'u08')
pass = check('E3 ceiling has u08',       hasU08inE3 ? 1 : 0,  1) && pass

// E1 ceiling → u08 포함 안 됨
const unitsE1 = unitsForCeiling('E1')
const noU08inE1 = !unitsE1.some(u => u.id === 'u08')
pass = check('E1 ceiling no u08',        noU08inE1 ? 1 : 0,   1) && pass

console.log()
console.log(pass ? '모든 검증 통과' : '검증 실패 항목 있음')
process.exit(pass ? 0 : 1)
