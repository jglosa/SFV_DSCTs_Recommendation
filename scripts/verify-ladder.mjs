// §5 검증 스크립트 — LADDER 데이터 및 스토어 셀렉터 전수 검증
import { readFileSync } from 'fs'

const raw = JSON.parse(readFileSync(new URL('../src/data/features.json', import.meta.url), 'utf-8'))

// ── 1. 기본 길이 체크 ────────────────────────────────────────
const LADDER_INDIVIDUAL = raw.ladder.individual
const LADDER_RUNGS = [...raw.ladder.search.rungs].sort((a, b) => a.order - b.order)
const LADDER_START_ORDER = raw.ladder.search.startOrder
const LADDER_UNASKED = raw.ladder.unasked
const FEATURES = raw.features
const FEATURE_BY_ID = Object.fromEntries(FEATURES.map(f => [f.id, f]))

let pass = true
function check(label, cond, detail = '') {
  const ok = !!cond
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) pass = false
}

console.log('\n── §5-1. 기본 길이 ─────────────────────────────────────')
check('LADDER_INDIVIDUAL.length === 3', LADDER_INDIVIDUAL.length === 3, `got ${LADDER_INDIVIDUAL.length}`)
check('LADDER_RUNGS.length === 6', LADDER_RUNGS.length === 6, `got ${LADDER_RUNGS.length}`)
check('LADDER_UNASKED.length === 3', LADDER_UNASKED.length === 3, `got ${LADDER_UNASKED.length}`)
check('LADDER_START_ORDER === 3', LADDER_START_ORDER === 3, `got ${LADDER_START_ORDER}`)

// ── 2. LADDER_RUNGS order 1..6 중복 없이 ────────────────────
console.log('\n── §5-2. LADDER_RUNGS order 1..6 ──────────────────────')
const orders = LADDER_RUNGS.map(r => r.order)
check('order 배열 = [1,2,3,4,5,6]', JSON.stringify(orders) === '[1,2,3,4,5,6]', JSON.stringify(orders))

// ── 3. 모든 rung/individual featureIds → FEATURE_BY_ID 존재 ─
console.log('\n── §5-3. featureIds 존재 확인 ──────────────────────────')
for (const item of LADDER_INDIVIDUAL) {
  for (const fid of (item.featureIds ?? [])) {
    check(`individual ${item.id} featureId '${fid}'`, !!FEATURE_BY_ID[fid])
  }
}
for (const rung of LADDER_RUNGS) {
  for (const fid of (rung.featureIds ?? [])) {
    check(`rung L${rung.order} (${rung.id}) featureId '${fid}'`, !!FEATURE_BY_ID[fid])
  }
  // resolve 테이블 안의 featureId 도 체크
  if (rung.resolve) {
    const allCodes = []
    const r = rung.resolve
    if (r.byTiming) allCodes.push(...Object.values(r.byTiming))
    if (r.default !== undefined) allCodes.push(r.default)
    if (r.byScope) {
      for (const entry of Object.values(r.byScope)) {
        if (entry.any !== undefined) allCodes.push(entry.any)
        if (entry.byTiming) allCodes.push(...Object.values(entry.byTiming))
        if (entry.default !== undefined) allCodes.push(entry.default)
      }
    }
    for (const code of allCodes) {
      if (code && typeof code === 'string') {
        check(`rung L${rung.order} resolve code '${code}'`, !!FEATURE_BY_ID[code])
      }
    }
  }
}
for (const u of LADDER_UNASKED) {
  for (const fid of (u.featureIds ?? [])) {
    check(`unasked ${u.id} featureId '${fid}'`, !!FEATURE_BY_ID[fid])
  }
}

// ── 4. nextProbeOrder 전수: 임계선 0~6 모두 도달 가능 ────────
console.log('\n── §5-4. nextProbeOrder 이진탐색 경로 표 ──────────────')

function nextProbeOrder(probes) {
  let lo = 0, hi = 6
  for (const step of probes) {
    const mid = Math.ceil((lo + hi) / 2)
    if (step.accepted) lo = mid
    else hi = mid - 1
  }
  if (lo >= hi) return null
  return Math.ceil((lo + hi) / 2)
}

function computeThreshold(probes) {
  let lo = 0, hi = 6
  for (const step of probes) {
    const mid = Math.ceil((lo + hi) / 2)
    if (step.accepted) lo = mid
    else hi = mid - 1
  }
  return lo >= hi ? lo : null
}

// BFS: 각 임계선에 도달하는 최단 경로 찾기
function findPath(target) {
  const queue = [[]]
  while (queue.length) {
    const probes = queue.shift()
    const t = computeThreshold(probes)
    if (t !== null) {
      if (t === target) return probes
      continue
    }
    const next = nextProbeOrder(probes)
    if (next === null) continue
    queue.push([...probes, { order: next, accepted: true }])
    queue.push([...probes, { order: next, accepted: false }])
  }
  return null
}

console.log('임계선 | 경로 (제시 order, A=수용, R=거부) | 질문 수')
console.log('─'.repeat(70))
for (let target = 0; target <= 6; target++) {
  const path = findPath(target)
  if (!path) {
    console.log(`  ${target}    | ❌ 도달 불가`)
    pass = false
    continue
  }
  const desc = path.map(p => `L${p.order}${p.accepted ? 'A' : 'R'}`).join(' → ')
  const n = path.length
  const ok = n >= 2 && n <= 3
  console.log(`  ${target}    | ${desc.padEnd(30)} | ${n}회 ${ok ? '✅' : '❌ (기대: 2~3)'}`)
  if (!ok) pass = false
}

// ── 5. resolveRungCode L9 케이스 ────────────────────────────
console.log('\n── §5-5. resolveRungCode 검증 ──────────────────────────')

function resolveRungCode(rung, scopes, timingRank) {
  if (!rung.resolveBy) {
    if (!rung.featureIds?.length) throw new Error(`rung ${rung.id}: featureIds 비어 있음`)
    return rung.featureIds[0]
  }
  if (rung.resolveBy === 'timing') {
    const { byTiming, default: def } = rung.resolve
    for (const t of (timingRank ?? [])) {
      if (byTiming?.[t] !== undefined) return byTiming[t]
    }
    if (def !== undefined) return def
    throw new Error(`rung ${rung.id}: byTiming 일치 없음 (timingRank=${JSON.stringify(timingRank)})`)
  }
  if (rung.resolveBy === 'scope+timing') {
    const { byScope, default: def } = rung.resolve
    const results = []
    for (const scope of (scopes ?? [])) {
      const entry = byScope?.[scope]
      if (entry === undefined) throw new Error(`rung ${rung.id}: scope '${scope}' 테이블 없음`)
      if (entry.any !== undefined) {
        results.push(entry.any)
      } else if (entry.byTiming) {
        let found = false
        for (const t of (timingRank ?? [])) {
          if (entry.byTiming[t] !== undefined) { results.push(entry.byTiming[t]); found = true; break }
        }
        if (!found) {
          const fallback = entry.default ?? def
          if (fallback === undefined) throw new Error(`rung ${rung.id}, scope '${scope}': byTiming 일치 없음`)
          results.push(fallback)
        }
      } else {
        throw new Error(`rung ${rung.id}, scope '${scope}': any/byTiming 모두 없음`)
      }
    }
    return results
  }
  throw new Error(`rung ${rung.id}: 알 수 없는 resolveBy '${rung.resolveBy}'`)
}

// individual L1 (id='L1', resolveBy='timing'): At→3.1.1, InUse→3.1.2
const indL1 = LADDER_INDIVIDUAL.find(r => r.id === 'L1')
if (indL1) {
  try {
    const r_at = resolveRungCode(indL1, [], ['At'])
    const r_inuse = resolveRungCode(indL1, [], ['InUse'])
    check('individual L1 + At → 3.1.1', r_at === '3.1.1', `got '${r_at}'`)
    check('individual L1 + InUse → 3.1.2', r_inuse === '3.1.2', `got '${r_inuse}'`)
  } catch(e) {
    check('individual L1 resolveRungCode 오류 없음', false, e.message)
  }
} else {
  check('individual L1 존재', false)
}

// rung order=1 (id='L4', resolveBy='timing'): At→2.1.1, InUse→3.1.3
const rungOrder1 = LADDER_RUNGS.find(r => r.order === 1)
if (rungOrder1) {
  try {
    const r_at = resolveRungCode(rungOrder1, [], ['At'])
    const r_inuse = resolveRungCode(rungOrder1, [], ['InUse'])
    check(`rung order=1 (${rungOrder1.id}) + At → 2.1.1`, r_at === '2.1.1', `got '${r_at}'`)
    check(`rung order=1 (${rungOrder1.id}) + InUse → 3.1.3`, r_inuse === '3.1.3', `got '${r_inuse}'`)
  } catch(e) {
    check('rung order=1 resolveRungCode 오류 없음', false, e.message)
  }
} else {
  check('rung order=1 존재', false)
}

// rung order=4 (id='L7', no resolveBy): featureIds[0]='2.1.3'
const rungOrder4 = LADDER_RUNGS.find(r => r.order === 4)
if (rungOrder4) {
  try {
    const r = resolveRungCode(rungOrder4, [], [])
    check(`rung order=4 (${rungOrder4.id}) → 2.1.3`, r === '2.1.3', `got '${r}'`)
  } catch(e) {
    check('rung order=4 resolveRungCode 오류 없음', false, e.message)
  }
} else {
  check('rung order=4 존재', false)
}

// L9(order=6) scope+timing 체크: scopes=['app-tab','content'] × 3 timingRanks
const L9 = LADDER_RUNGS.find(r => r.order === 6)
if (L9 && L9.resolveBy === 'scope+timing') {
  console.log('\n  L9 scope+timing 케이스 표 (scopes × timingRank):')
  for (const scopes of [['app-tab'], ['content'], ['app-tab','content']]) {
    for (const tr of [['Pre'], ['At'], ['InUse']]) {
      try {
        const result = resolveRungCode(L9, scopes, tr)
        console.log(`    scopes=${JSON.stringify(scopes).padEnd(26)} timing=${tr[0].padEnd(6)} → ${JSON.stringify(result)}`)
      } catch(e) {
        console.log(`    scopes=${JSON.stringify(scopes).padEnd(26)} timing=${tr[0].padEnd(6)} → ❌ ${e.message}`)
        pass = false
      }
    }
  }
} else if (L9) {
  console.log(`  ℹ️  L9(order=6) resolveBy=${L9.resolveBy} (scope+timing 아님, 스펙 확인 필요)`)
}

// ── 6. recommendationKey 중복 제거 테스트 ───────────────────
console.log('\n── §5-6. recommendationKey dedup ───────────────────────')
function recommendationKey(item) {
  return `${item.code}|${item.scope ?? ''}|${item.taskGroup ?? ''}`
}
const items = [
  { code: '1.1.2', scope: 'app-tab', taskGroup: undefined },
  { code: '1.1.2', scope: 'content', taskGroup: undefined },
  { code: '2.1.3', scope: undefined, taskGroup: 'A' },
  { code: '2.1.3', scope: undefined, taskGroup: 'B' },
]
const keys = items.map(recommendationKey)
const uniqueKeys = new Set(keys)
check('scope 다르면 다른 키 (1.1.2 app-tab vs content)', keys[0] !== keys[1], `${keys[0]} vs ${keys[1]}`)
check('taskGroup 다르면 다른 키 (2.1.3 A vs B)', keys[2] !== keys[3], `${keys[2]} vs ${keys[3]}`)
check('4항목 → 4개 고유키', uniqueKeys.size === 4, `got ${uniqueKeys.size}`)

// scopes=['app-tab','content'] + At → 두 distinct recommendationKey
if (L9 && L9.resolveBy === 'scope+timing') {
  try {
    const codes = resolveRungCode(L9, ['app-tab', 'content'], ['At'])
    if (Array.isArray(codes) && codes.length === 2) {
      const k1 = recommendationKey({ code: codes[0], scope: 'app-tab' })
      const k2 = recommendationKey({ code: codes[1], scope: 'content' })
      check('L9 app-tab vs content → distinct keys', k1 !== k2, `${k1} vs ${k2}`)
    }
  } catch(e) { /* 이미 위에서 출력됨 */ }
}

// ── 7. 삭제된 식별자가 store.js/features.js에 없는지 ────────
// engine.js, ResultCard.jsx는 §6 "수정하지 마라" 대상이므로 제외
console.log('\n── §5-7. 삭제된 식별자 잔재 검사 (store.js + features.js) ─')
import { execSync } from 'child_process'
const storeFile = new URL('../src/store.js', import.meta.url).pathname
const featFile = new URL('../src/data/features.js', import.meta.url).pathname
const dbgFile = new URL('../src/components/DebugPanel.jsx', import.meta.url).pathname
// store.js에서 완전히 제거돼야 하는 것들
const deletedFromStore = ['enforcementCeiling', 'enforcementSearch', 'frictionAccepted', 'frictionSeen', 'physicalActionGroup', 'nextSearchLevel', 'unitsForCeiling', 'acceptedFeatureIds', 'recordEnforcement', 'RECORD_ENFORCEMENT']
for (const id of deletedFromStore) {
  let found = ''
  try {
    found = execSync(`grep -n "${id}" "${storeFile}" 2>/dev/null`, { encoding: 'utf-8' }).trim()
  } catch { found = '' }
  check(`store.js에 '${id}' 없음`, !found, found ? found.split('\n')[0] : '')
}
// features.js에서 제거돼야 하는 것들
const deletedFromFeatures = ['FRICTION_UNITS', 'ENFORCEMENT_SEARCH', 'FRICTION_SET']
for (const id of deletedFromFeatures) {
  let found = ''
  try {
    found = execSync(`grep -n "${id}" "${featFile}" 2>/dev/null`, { encoding: 'utf-8' }).trim()
  } catch { found = '' }
  check(`features.js에 '${id}' 없음`, !found, found ? found.split('\n')[0] : '')
}
// DebugPanel.jsx 프리셋에서 구 S4 필드가 제거됐는지
const deletedFromDebug = ['enforcementCeiling', 'enforcementSearch', 'frictionAccepted', 'physicalActionGroup']
for (const id of deletedFromDebug) {
  let found = ''
  try {
    found = execSync(`grep -n "${id}" "${dbgFile}" 2>/dev/null`, { encoding: 'utf-8' }).trim()
  } catch { found = '' }
  check(`DebugPanel.jsx에 '${id}' 없음`, !found, found ? found.split('\n')[0] : '')
}

// ── 결과 ─────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(50))
console.log(pass ? '✅ 모든 검증 통과' : '❌ 실패 항목 있음 — 위 로그 확인')
console.log('═'.repeat(50))
