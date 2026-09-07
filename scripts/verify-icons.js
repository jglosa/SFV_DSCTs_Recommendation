// ─────────────────────────────────────────────────────────────
// 아이콘 자산 검증 스크립트
// 실행: node scripts/verify-icons.js
// ─────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const appsRaw  = JSON.parse(readFileSync(join(root, 'src/data/apps.json'), 'utf8'))
const appsJs   = readFileSync(join(root, 'src/data/apps.js'), 'utf8')

let pass = true

function check(label, actual, expected) {
  const ok = actual === expected
  console.log(`${ok ? '✓' : '✗'} ${label.padEnd(54)} = ${String(actual).padStart(5)}  (expect ${expected})`)
  if (!ok) pass = false
  return ok
}
function checkTrue(label, bool) { return check(label, bool ? 1 : 0, 1) }

// ── 1. JSON 버전 확인 ─────────────────────────────────────
console.log('── JSON 버전 ────────────────────────────────────────────')
checkTrue("apps.json version = '0.9'",    appsRaw.version === '0.9')
const featJson = JSON.parse(readFileSync(join(root, 'src/data/features.json'), 'utf8'))
checkTrue("features.json version = '0.9'", featJson.version === '0.9')

// ── 2. JSON 에 17_NS 없음 확인 ────────────────────────────
console.log()
console.log('── 17_NS / 17_NL 검증 ──────────────────────────────────')
const appsJsonStr = readFileSync(join(root, 'src/data/apps.json'), 'utf8')
const featJsonStr = readFileSync(join(root, 'src/data/features.json'), 'utf8')
checkTrue("apps.json: '17_NS' 없음",      !appsJsonStr.includes('17_NS'))
checkTrue("features.json: '17_NS' 없음",  !featJsonStr.includes('17_NS'))
checkTrue("apps.json: '17_NL' 존재",       appsJsonStr.includes('17_NL'))

// 코드 파일 전체에 '17_NS' 없음
const filesToScan = [
  'src/data/apps.js', 'src/store.js', 'src/deck.js', 'src/engine.js',
  'src/components/Cards.jsx', 'src/components/Deck.jsx',
  'src/components/DebugPanel.jsx', 'src/components/ResultCard.jsx',
]
let foundNS = false
for (const f of filesToScan) {
  const src = readFileSync(join(root, f), 'utf8')
  if (src.includes('17_NS')) {
    console.log(`  ✗ 발견: ${f}`)
    foundNS = true
    pass = false
  }
}
if (!foundNS) console.log('✓ 코드 전체: 17_NS 없음')

// ── 3. 7_NS 가 21개 앱 목록에 여전히 존재하는지 ──────────
const ids = appsRaw.apps.map(a => a.id)
checkTrue("apps.json: '7_NS' 존재",       ids.includes('7_NS'))
checkTrue("apps 총 21개",                  ids.length === 21)

// ── 4. 앱 아이콘 파일 존재 확인 ──────────────────────────
console.log()
console.log('── 앱 아이콘 파일 확인 ─────────────────────────────────')
const missing = []
for (const id of ids) {
  const p = join(root, 'public/app_icons', `${id}.png`)
  if (!existsSync(p)) missing.push(id)
}
check('누락된 아이콘 수', missing.length, 0)
if (missing.length > 0) {
  console.log('  누락 목록:', missing.join(', '))
} else {
  console.log(`  → 21개 모두 확인됨`)
}

// ── 5. platformIconPath 함수 검증 ─────────────────────────
console.log()
console.log('── platformIconPath 검증 ───────────────────────────────')

// apps.js 에서 함수를 동적으로 실행하기 위해 직접 매핑 검사
const PLATFORM_ICON_MAP = {
  YouTube:   '/app_icons/youtube.svg',
  Instagram: '/app_icons/instagram.svg',
  TikTok:    '/app_icons/tiktok.svg',
  Facebook:  '/app_icons/facebook.svg',
  Snapchat:  '/app_icons/snapchat.svg',
  LinkedIn:  '/app_icons/linkedin.svg',
}

// SVG 파일 실제 존재 확인
for (const [name, path] of Object.entries(PLATFORM_ICON_MAP)) {
  const full = join(root, 'public', path)
  checkTrue(`${name} SVG 파일 존재`, existsSync(full))
}

// apps.js 소스에서 매핑 정의 확인
checkTrue("apps.js: PLATFORM_ICON_MAP 정의", appsJs.includes('PLATFORM_ICON_MAP'))
checkTrue("apps.js: platformIconPath 함수",  appsJs.includes('export function platformIconPath'))
checkTrue("apps.js: null 반환 (??)",          appsJs.includes('?? null'))

// null 반환 대상들
const noIconPlatforms = ['X', 'Reddit', 'Line', 'Netflix', 'Pinterest', 'Twitch', 'Google', 'Twitter', '기타']
checkTrue("null 반환 플랫폼 매핑에 없음",
  noIconPlatforms.every(p => !appsJs.includes(`${p}:`)))

// ── 6. appIconPath 함수 검증 ──────────────────────────────
console.log()
console.log('── appIconPath 검증 ─────────────────────────────────────')
checkTrue("apps.js: appIconPath 함수 정의",   appsJs.includes('export function appIconPath'))
checkTrue("apps.js: .png 경로 패턴",          appsJs.includes('/app_icons/${appId}.png'))

// ── 7. Cards.jsx 아이콘 컴포넌트 ──────────────────────────
console.log()
console.log('── Cards.jsx 아이콘 컴포넌트 ───────────────────────────')
const cardsRaw = readFileSync(join(root, 'src/components/Cards.jsx'), 'utf8')
checkTrue("PlatformIcon 컴포넌트 정의",        cardsRaw.includes('function PlatformIcon'))
checkTrue("onError 처리",                       cardsRaw.includes('onError'))
checkTrue("이니셜 원형 배지(c-opt-icon-fb)",    cardsRaw.includes('c-opt-icon-fb'))
checkTrue("iconFn prop 사용",                   cardsRaw.includes('iconFn'))

// ── 8. Deck.jsx 연결 ──────────────────────────────────────
const deckJsx = readFileSync(join(root, 'src/components/Deck.jsx'), 'utf8')
checkTrue("Deck.jsx: platformIconPath import",  deckJsx.includes('platformIconPath'))
checkTrue("Deck.jsx: platforms 키 시 iconFn 전달", deckJsx.includes("spec.key === 'platforms'"))

// ── 9. styles.css ─────────────────────────────────────────
const cssRaw = readFileSync(join(root, 'src/styles.css'), 'utf8')
checkTrue("styles.css: .c-opt-icon 정의",       cssRaw.includes('.c-opt-icon '))
checkTrue("styles.css: .c-opt-icon-fb 정의",    cssRaw.includes('.c-opt-icon-fb'))

console.log()
console.log(pass ? '모든 검증 통과' : '검증 실패 항목 있음')
process.exit(pass ? 0 : 1)
