// ─────────────────────────────────────────────────────────────
// S0·S1 변경 검증 스크립트
// 실행: node scripts/verify-s0-s1.js
// ─────────────────────────────────────────────────────────────

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const storeRaw   = readFileSync(join(root, 'src/store.js'), 'utf8')
const deckRaw    = readFileSync(join(root, 'src/deck.js'), 'utf8')
const cardsRaw   = readFileSync(join(root, 'src/components/Cards.jsx'), 'utf8')
const mockRaw    = readFileSync(join(root, 'src/components/MockYouTube.jsx'), 'utf8')
const debugRaw   = readFileSync(join(root, 'src/components/DebugPanel.jsx'), 'utf8')
const stylesRaw  = readFileSync(join(root, 'src/styles.css'), 'utf8')

let pass = true

function check(label, actual, expected) {
  const ok = actual === expected
  console.log(`${ok ? '✓' : '✗'} ${label.padEnd(52)} = ${String(actual).padStart(5)}  (expect ${expected})`)
  if (!ok) pass = false
  return ok
}

function checkTrue(label, bool) {
  return check(label, bool ? 1 : 0, 1)
}

console.log('── S0 기기 문항 ─────────────────────────────────────────')

// deck.js: key 가 'devices' 로 변경됐는지
checkTrue("deck.js: S0 Q1 key='devices'",      deckRaw.includes("key: 'devices'"))
checkTrue("deck.js: '아이폰·아이패드' 선택지",   deckRaw.includes("'아이폰·아이패드'"))
checkTrue("deck.js: '안드로이드 폰·태블릿' 선택지", deckRaw.includes("'안드로이드 폰·태블릿'"))
checkTrue("deck.js: 'PC·노트북' 선택지",         deckRaw.includes("'PC·노트북'"))
checkTrue("deck.js: 기타 선택지 없음",            !deckRaw.includes("'스마트폰'") && !deckRaw.includes("'태블릿'"))

// store.js: env 구조
checkTrue("store.js: env.devices 필드",          storeRaw.includes("devices: []"))
checkTrue("store.js: env.os 필드",               storeRaw.includes("os: []"))
checkTrue("store.js: env.route 필드",             storeRaw.includes("route: []"))
checkTrue("store.js: env.platforms 필드",         storeRaw.includes("platforms: []"))
checkTrue("store.js: contentTargets 없음",        !storeRaw.includes("contentTargets"))

// Deck.jsx: os 파생 로직
const deckJsx = readFileSync(join(root, 'src/components/Deck.jsx'), 'utf8')
checkTrue("Deck.jsx: OS_MAP 정의",               deckJsx.includes("OS_MAP"))
checkTrue("Deck.jsx: ios 파생",                  deckJsx.includes("'ios'"))
checkTrue("Deck.jsx: android 파생",              deckJsx.includes("'android'"))
checkTrue("Deck.jsx: desktop 파생",              deckJsx.includes("'desktop'"))
checkTrue("Deck.jsx: key==='devices' 분기",       deckJsx.includes("spec.key === 'devices'"))

console.log()
console.log('── S1 content 시트 제거 ────────────────────────────────')

// Cards.jsx: catOpen / toggleCat / closeSheet 없음
checkTrue("Cards.jsx: catOpen 상태 없음",          !cardsRaw.includes("setCatOpen"))
checkTrue("Cards.jsx: toggleCat 함수 없음",        !cardsRaw.includes("toggleCat"))
checkTrue("Cards.jsx: closeSheet 함수 없음",       !cardsRaw.includes("closeSheet"))
checkTrue("Cards.jsx: cat-sheet JSX 없음",         !cardsRaw.includes('cat-sheet'))
checkTrue("Cards.jsx: contentTargets 참조 없음 (ScopeHomeCard)",
  !cardsRaw.includes('state.contentTargets'))

// content pick → scope 토글만
checkTrue("Cards.jsx: selectable prop 전달",       cardsRaw.includes('selectable'))

// 결과 설명 텍스트
const featuresRaw = readFileSync(join(root, 'src/data/features.js'), 'utf8')
checkTrue("features.js: content 결과 텍스트 업데이트",
  featuresRaw.includes('나중에 직접 정하게 됩니다'))

console.log()
console.log('── MockHome selectable prop ──────────────────────────')

// 기본값 false
checkTrue("MockHome: selectable = false 기본값",    mockRaw.includes('selectable = false'))
// S1 카드에서 selectable 없이 쓰는 곳이 없는지 (S3 시뮬)
// SimSceneCard 내 MockHome 호출에 selectable 이 없어야 함
const simSceneUsages = mockRaw.match(/MockHome/g)?.length ?? 0
// MockYouTube 자체 export function 포함하므로 1개 이상이면 됨
checkTrue("MockYouTube: MockHome export 존재",       mockRaw.includes('export function MockHome'))
// S3 sim 에서 selectable 없이 호출 (Deck·Cards 에서 확인)
const simSelectable = deckJsx.includes('selectable') || cardsRaw.match(/MockHome[^>]*selectable(?!\s*\{)/g)
checkTrue("Deck.jsx: sim에서 selectable 미전달",
  !deckJsx.includes('<MockHome selectable') &&
  !deckJsx.includes("MockHome\n") )   // Deck.jsx 에서는 MockHome 직접 렌더 안 함

// selectable 배지·안내 가 S3 카드에 안 뜨는지
// SimSceneCard 에서 MockHome 호출 시 selectable 없음 (Cards.jsx 확인)
const simSceneBlock = cardsRaw.slice(cardsRaw.indexOf('SimSceneCard'), cardsRaw.indexOf('RankCard'))
checkTrue("SimSceneCard: selectable 미포함",         !simSceneBlock.includes('selectable'))

console.log()
console.log('── 그리드 레이아웃 (겹침 구조적 불가) ──────────────────')

checkTrue("MockYouTube: hit-grid variant 사용",      mockRaw.includes("variant=\"grid\"") || mockRaw.includes("variant='grid'"))
checkTrue("MockYouTube: hit-nav variant 사용",       mockRaw.includes("variant=\"nav\"") || mockRaw.includes("variant='nav'"))
checkTrue("MockYouTube: hit-inline variant 사용",    mockRaw.includes("variant=\"inline\"") || mockRaw.includes("variant='inline'"))
checkTrue("styles.css: .hit-grid 정의",             stylesRaw.includes('.hit.hit-grid'))
checkTrue("styles.css: grid-template-columns 정의",  stylesRaw.includes('grid-template-columns: 1fr 76px'))
checkTrue("styles.css: .hit-grid .hit-tag position:static", stylesRaw.includes('.hit.hit-grid .hit-tag { position: static'))
checkTrue("styles.css: .hit-nav 정의",              stylesRaw.includes('.hit-nav'))
checkTrue("styles.css: .hit-inline 정의",           stylesRaw.includes('.hit-inline'))
checkTrue("styles.css: scope-guide 정의",           stylesRaw.includes('.scope-guide'))
checkTrue("styles.css: .yt-passive 정의",           stylesRaw.includes('.yt-passive'))

console.log()
console.log('── DebugPanel 업데이트 ──────────────────────────────')

checkTrue("DebugPanel: devices 키 사용",             debugRaw.includes("'devices'"))
checkTrue("DebugPanel: platforms 키 사용",           debugRaw.includes("'platforms'"))
checkTrue("DebugPanel: CATEGORIES import 없음",      !debugRaw.includes("import { CATEGORIES }"))
checkTrue("DebugPanel: contentTargets 참조 없음",    !debugRaw.includes("contentTargets"))
checkTrue("DebugPanel: preset env.os 포함",          debugRaw.includes("os: ['ios']"))

console.log()
console.log('── contentTargets 잔존 참조 목록 ────────────────────')

const files = {
  'store.js':           storeRaw,
  'deck.js':            deckRaw,
  'Cards.jsx':          cardsRaw,
  'MockYouTube.jsx':    mockRaw,
  'DebugPanel.jsx':     debugRaw,
  'Deck.jsx':           deckJsx,
}

let foundAny = false
for (const [fname, src] of Object.entries(files)) {
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    if (line.includes('contentTargets')) {
      console.log(`  참조 발견: ${fname}:${i + 1}  →  ${line.trim()}`)
      foundAny = true
    }
  })
}
if (!foundAny) console.log('  (없음 — 모두 제거됨)')

console.log()
console.log(pass ? '모든 검증 통과' : '검증 실패 항목 있음')
process.exit(pass ? 0 : 1)
