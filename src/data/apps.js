// ─────────────────────────────────────────────────────────────
// apps.js — apps.json 의 얇은 어댑터
//
// JSON이 단일 진실 공급원이다. 데이터를 여기에 다시 적지 않는다.
// ─────────────────────────────────────────────────────────────

import raw from './apps.json'

// ── 앱 배열 (21개) ───────────────────────────────────────────
export const APPS = raw.apps

// ── id → app 맵 ──────────────────────────────────────────────
export const APP_BY_ID = Object.fromEntries(APPS.map((a) => [a.id, a]))

// ── 특정 기능을 가진 앱 id 배열 ──────────────────────────────
export function appsWithFeature(featureId) {
  return APPS.filter((a) => a.features.includes(featureId)).map((a) => a.id)
}

// ── 환경 조건에 맞는 앱 id 배열 ──────────────────────────────
// os       : 'android' | 'ios'
// route    : 'app' | 'web' | 'app+web'  (web은 app+web도 포함)
// platform : 'YouTube' | 'Instagram' | 'TikTok' 등 (빈 inAppPlatforms는 통과)
export function appsForEnv({ os, route, platform } = {}) {
  return APPS.filter((a) => {
    if (os && !a.os.includes(os)) return false
    if (route) {
      const r = a.route
      if (route === 'web') {
        if (r !== 'app+web' && r !== 'web') return false
      } else if (r !== route) {
        return false
      }
    }
    if (platform && a.inAppPlatforms.length > 0 && !a.inAppPlatforms.includes(platform)) {
      return false
    }
    return true
  }).map((a) => a.id)
}

// ── 아이콘 경로 헬퍼 (public/ 직접 참조 — Vite 빌드 해시 없음) ──────────
// BASE_URL 은 끝에 '/' 포함. 경로 앞 '/' 없이 이어붙인다.
// 아이콘 파일명은 앱 id 와 정확히 일치한다 (예: 7_NS.png, 17_NL.png).
export function appIconPath(appId) {
  return `${import.meta.env.BASE_URL}app_icons/${appId}.png`
}

// 표시명 → svg/png 경로. 매핑에 없는 플랫폼은 null 을 반환한다.
// 매핑 없음: X, Reddit, Line, Netflix, Pinterest, Twitch, Google, Twitter 등
const PLATFORM_ICON_NAMES = {
  YouTube:   'youtube.svg',
  Instagram: 'instagram.svg',
  TikTok:    'tiktok.svg',
  Facebook:  'facebook.svg',
  Naver:     'naver.png',
  KakaoTalk: 'kakaotalk.png',
  Snapchat:  'snapchat.svg',
  LinkedIn:  'linkedin.svg',
}

export function platformIconPath(name) {
  const file = PLATFORM_ICON_NAMES[name]
  return file ? `${import.meta.env.BASE_URL}app_icons/${file}` : null
}

// ── 특정 앱·플랫폼의 scope 지원 수준 ────────────────────────
// 반환: 'full' | 'partial' | 'none'
export function scopeSupport(appId, platform, scopeId) {
  const app = APP_BY_ID[appId]
  if (!app) return 'none'
  const platformScope = app.scope[platform]
  if (!platformScope) return 'none'
  return platformScope[scopeId] ?? 'none'
}
