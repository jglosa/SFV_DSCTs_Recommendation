import { useState } from 'react'
import { FEATURE_BY_ID, SIMULATIONS, EXPLORE_RUNGS, description, SCOPE_DISPLAY } from '../data/features.js'
import { displayName } from '../store.js'
import { APP_BY_ID, appsWithFeature, appIconPath } from '../data/apps.js'
import { SimNotReady, InterventionSim } from './Cards.jsx'

// ─────────────────────────────────────────────────────────────
// feature code → sim id 역매핑 (EXPLORE_RUNGS)
// rung.resolve.fixed / byTiming 중 첫 번째 코드만 등록한다.
// ─────────────────────────────────────────────────────────────
const SIM_BY_CODE = {}
EXPLORE_RUNGS.forEach((rung) => {
  if (!rung.sim) return
  const r = rung.resolve
  const codes = []
  if (r?.fixed) codes.push(r.fixed)
  if (r?.byTiming) codes.push(...Object.values(r.byTiming))
  if (r?.byScope) {
    Object.values(r.byScope).forEach((entry) => {
      if (entry?.any) codes.push(entry.any)
      if (entry?.byTiming) codes.push(...Object.values(entry.byTiming))
    })
  }
  codes.forEach((fid) => {
    if (!SIM_BY_CODE[fid]) SIM_BY_CODE[fid] = rung.sim
  })
})

// availability 표시 레이블
const AVAIL_LABEL = { Both: 'iOS · Android', 'Google Play': 'Android', 'App Store': 'iOS' }

// 기능 속성 참가자용 레이블 (내부 코드 미노출) — ResultCard 에서도 import
export const WHEN_LABEL = {
  Pre:   '열기 전',
  At:    '숏폼에 들어가려는 순간',
  InUse: '보고 있는 중',
}
export const AGENCY_LABEL = {
  supported: '막지 않고 알려줌',
  flexible:  '조건을 채우면 통과',
  limited:   '아예 볼 수 없음',
}
// 앱 환경 참가자용 한 줄 레이블
function appEnvLabel(app) {
  const parts = []
  if (app.os.includes('ios')) parts.push('아이폰')
  if (app.os.includes('android')) parts.push('안드로이드')
  if (app.route === 'web') parts.push('웹브라우저')
  return parts.join('·')
}

// ── 앱 행 컴포넌트 (기능 상세 앱 목록용) ───────────────────
function AppRow({ appId, highlighted, onOpenApp }) {
  const [err, setErr] = useState(false)
  const app = APP_BY_ID[appId]
  if (!app) return null
  const initial = (app.shortName || appId)[0].toUpperCase()
  return (
    <button
      className={'dtl-app' + (highlighted ? ' highlight' : '')}
      onClick={() => onOpenApp?.(app)}
    >
      {err
        ? <span className="dtl-app-icon-fb">{initial}</span>
        : <span className="dtl-app-icon"><img src={appIconPath(appId)} alt="" onError={() => setErr(true)} /></span>
      }
      <span className="dtl-app-name">{app.shortName || appId}</span>
      <span className="dtl-app-env">{appEnvLabel(app)}</span>
    </button>
  )
}

// ── 지원 환경 행 ───────────────────────────────────────────
function EnvRow({ label, value, match }) {
  return (
    <div className="dtl-env-row">
      <span className="dtl-env-label">{label}</span>
      <span className="dtl-env-value">{value}</span>
      {match && <span className="dtl-env-match">내 환경</span>}
    </div>
  )
}

// ── 기능 상세 ─────────────────────────────────────────────
function FeatureDetail({ detail, onBack, onOpenApp }) {
  const [showSim, setShowSim] = useState(false)
  const { item, recAppIds = [] } = detail
  // engine v3 는 id 대신 code 를 사용한다. 하위 호환으로 item.id 도 허용.
  const code = item.code ?? item.id
  if (!code && process.env.NODE_ENV !== 'production') {
    console.warn('[FeatureDetail] item.code/id 모두 없음', item)
  }
  const feature = FEATURE_BY_ID[code]
  const name = displayName({ code, scope: item.scope, taskGroup: item.taskGroup })
  const desc = description({ code, scope: item.scope, taskGroup: item.taskGroup })
  const simId = SIM_BY_CODE[code]
  const hasLiveSim = simId != null && SIMULATIONS[simId] !== null

  // 앱 목록: 추천 앱 하이라이트, 나머지 이어서
  const allAppIds = appsWithFeature(code)
  const recSet = new Set(recAppIds)
  const recIds = allAppIds.filter((id) => recSet.has(id))
  const restIds = allAppIds.filter((id) => !recSet.has(id))

  return (
    <div className="dtl" onClick={(e) => e.stopPropagation()}>
      <div className="dtl-nav">
        <button className="dtl-back" onClick={onBack}>‹ 결과로</button>
        <span className="dtl-nav-title">기능 상세</span>
      </div>
      <div className="dtl-body">

        {/* 1) 기능 이름 */}
        <h2 className="dtl-title">{name}</h2>

        {/* 2) 설명 */}
        {desc && <p className="dtl-desc">{desc}</p>}

        {/* 3) 기능 속성 — 작동 시점·개입 방식·통제 범위
             통제 범위: engine 이 결정한 item.scope 하나만 표시. addressableScope 사용 안 함. */}
        {feature && (
          <div className="dtl-meta">
            {WHEN_LABEL[feature.when] && (
              <div className="dtl-meta-row">
                <span className="dtl-meta-label">작동 시점</span>
                <span className="dtl-meta-value">{WHEN_LABEL[feature.when]}</span>
              </div>
            )}
            {AGENCY_LABEL[feature.agency] && (
              <div className="dtl-meta-row">
                <span className="dtl-meta-label">개입 방식</span>
                <span className="dtl-meta-value">{AGENCY_LABEL[feature.agency]}</span>
              </div>
            )}
            {item.scope && SCOPE_DISPLAY[item.scope] && (
              <div className="dtl-meta-row">
                <span className="dtl-meta-label">통제 범위</span>
                <span className="dtl-meta-value">{SCOPE_DISPLAY[item.scope]}</span>
              </div>
            )}
          </div>
        )}

        {/* 4) 겪어보기 — 항상 표시. sim 없으면 준비 중 오버레이 */}
        <button className="c-sim-btn" onClick={() => setShowSim(true)}>겪어보기</button>

        {/* 5) 이 기능이 있는 앱 */}
        <div className="dtl-sec-h">이 기능이 있는 앱</div>
        <div className="dtl-apps">
          {recIds.map((id) => <AppRow key={id} appId={id} highlighted onOpenApp={onOpenApp} />)}
          {restIds.map((id) => <AppRow key={id} appId={id} onOpenApp={onOpenApp} />)}
        </div>

      </div>

      {/* 겪어보기 오버레이 — .dtl 컨텍스트 내부에서 position:absolute */}
      {showSim && (
        hasLiveSim
          ? <InterventionSim simId={simId} featureName={name} onClose={() => setShowSim(false)} />
          : <SimNotReady onClose={() => setShowSim(false)} />
      )}
    </div>
  )
}

// ── 앱 상세 ───────────────────────────────────────────────
function AppDetail({ detail, state, onBack, onOpenDetail }) {
  const [iconErr, setIconErr] = useState(false)
  const { item: app, recPicks = [], prevDetail } = detail

  // 뒤로 가기: 기능 상세에서 왔으면 그쪽으로, 아니면 결과로
  const handleBack = prevDetail
    ? () => onOpenDetail?.(prevDetail)
    : onBack
  const backLabel = prevDetail ? '‹ 기능으로' : '‹ 결과로'

  // 추천 기능 중 이 앱이 보유한 것 (engine v3: f.code, 하위호환: f.id)
  const recHasSet = new Set(
    recPicks.filter((f) => app.features.includes(f.code ?? f.id)).map((f) => f.code ?? f.id),
  )

  // 이 앱이 가진 다른 기능 (추천 기능 제외) — engineRole별 분리
  const otherCodes = app.features.filter((code) => !recPicks.some((f) => (f.code ?? f.id) === code))
  const interventionCodes = otherCodes.filter((c) => FEATURE_BY_ID[c]?.engineRole !== 's5')
  const bypassCodes = otherCodes.filter((c) => FEATURE_BY_ID[c]?.engineRole === 's5')

  // 지원 환경 일치 여부 (S0 답변 기준)
  const userOs = state?.env?.os ?? []
  const userPlatforms = state?.env?.platforms ?? []
  const userRoute = state?.env?.route ?? []

  const osMatch = app.os.some((o) => userOs.includes(o))
  const platformMatch = app.inAppPlatforms.some((p) => userPlatforms.includes(p))
  const routeMatch = (() => {
    if (app.route === 'app+web') return userRoute.includes('앱') || userRoute.includes('웹브라우저')
    if (app.route === 'app') return userRoute.includes('앱')
    if (app.route === 'web') return userRoute.includes('웹브라우저')
    return false
  })()

  return (
    <div className="dtl" onClick={(e) => e.stopPropagation()}>
      <div className="dtl-nav">
        <button className="dtl-back" onClick={handleBack}>{backLabel}</button>
        <span className="dtl-nav-title">앱 상세</span>
      </div>
      <div className="dtl-body">

        {/* 1) 상단: 아이콘 + fullName + availability */}
        <div className="dtl-app-hero">
          {iconErr
            ? <span className="dtl-app-hero-icon-fb">{app.shortName[0]}</span>
            : <img
                className="dtl-app-hero-icon"
                src={appIconPath(app.id)}
                alt=""
                onError={() => setIconErr(true)}
              />
          }
          <div>
            <h2 className="dtl-title" style={{ marginBottom: 0 }}>{app.fullName}</h2>
            <div className="dtl-app-avail">{AVAIL_LABEL[app.availability] ?? app.availability}</div>
          </div>
        </div>

        {/* 2) 추천 기능 지원 여부 — 3개 모두 나열, 보유분만 하이라이트 */}
        {recPicks.length > 0 && (
          <>
            <div className="dtl-sec-h">추천 기능 지원 여부</div>
            <div className="dtl-feat-list">
              {recPicks.map((f) => {
                const fCode = f.code ?? f.id
                const fName = displayName({ code: fCode, scope: f.scope, taskGroup: f.taskGroup })
                if (!fName && process.env.NODE_ENV !== 'production') {
                  console.warn('[AppDetail] displayName undefined', f)
                }
                return (
                  <div key={fCode} className={'dtl-feat-row' + (recHasSet.has(fCode) ? ' highlight' : '')}>
                    <span className="dtl-feat-name">{fName ?? fCode}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* 3a) 이 앱이 가진 다른 개입 기능 (engineRole ≠ s5) */}
        {interventionCodes.length > 0 && (
          <>
            <div className="dtl-sec-h">이 앱이 가진 다른 개입 기능</div>
            <div className="dtl-feat-list">
              {interventionCodes.map((code) => (
                <div key={code} className="dtl-feat-row">
                  <span className="dtl-feat-name">{displayName({ code })}</span>
                  {description({ code }) && (
                    <span className="dtl-feat-desc">{description({ code })}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* 3b) 우회를 막아주는 기능 (engineRole = s5) */}
        {bypassCodes.length > 0 && (
          <>
            <div className="dtl-sec-h">우회를 막아주는 기능</div>
            <div className="dtl-feat-list">
              {bypassCodes.map((code) => (
                <div key={code} className="dtl-feat-row">
                  <span className="dtl-feat-name">{displayName({ code })}</span>
                  {description({ code }) && (
                    <span className="dtl-feat-desc">{description({ code })}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* 4) 지원 환경 — 운영체제·이용 경로·앱 내 차단 3행, iOS 우선 */}
        <div className="dtl-sec-h">지원 환경</div>
        <div className="dtl-env-table">
          <EnvRow
            label="운영체제"
            value={['ios', 'android'].filter((o) => app.os.includes(o)).map((o) => o === 'ios' ? 'iOS' : 'Android').join(', ')}
            match={osMatch}
          />
          <EnvRow
            label="이용 경로"
            value={app.routeRaw}
            match={routeMatch}
          />
          <EnvRow
            label="앱 내 차단"
            value={app.inAppPlatforms.length ? app.inAppPlatforms.join(', ') : '미지원'}
            match={platformMatch}
          />
        </div>

      </div>
    </div>
  )
}

// ── 진입점 ────────────────────────────────────────────────
export default function DetailPanel({ detail, state, onBack, onOpenDetail }) {
  // 기능 상세에서 앱으로 이동 시 prevDetail 포함
  const handleOpenApp = (app) =>
    onOpenDetail?.({ type: 'app', item: app, recPicks: detail.recPicks ?? [], prevDetail: detail })

  if (detail.type === 'feature') {
    return (
      <FeatureDetail
        detail={detail}
        state={state}
        onBack={onBack}
        onOpenApp={handleOpenApp}
      />
    )
  }

  return (
    <AppDetail
      detail={detail}
      state={state}
      onBack={onBack}
      onOpenDetail={onOpenDetail}
    />
  )
}
