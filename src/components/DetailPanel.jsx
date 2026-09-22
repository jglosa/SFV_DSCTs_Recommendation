import { useState } from 'react'
import { FEATURE_BY_ID, FEATURES, SCOPE_DISPLAY, SCOPE_LEVELS } from '../data/features.js'
import { APP_BY_ID, appIconPath, ROUTE_MAP, inAppPlatforms as getInAppPlatforms } from '../data/apps.js'
import { SimNotReady, InterventionSim } from './Cards.jsx'

// 기능 속성 참가자용 레이블 — ResultCard 에서도 import
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
  if (app.os.includes('android')) parts.push('Android')
  if (app.os.includes('ios')) parts.push('iOS')
  // worksOn: 웹 전용('web'만, 'app' 없음)일 때만 표기
  if ((app.worksOn ?? []).includes('web') && !(app.worksOn ?? []).includes('app')) parts.push('웹브라우저')
  return parts.join('·')
}

// ── 앱 행 컴포넌트 ───────────────────────────────────────────
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

// ── 지원 환경 행 ─────────────────────────────────────────────
// items: [{ label: string, match: boolean }]
function EnvRow({ label, items }) {
  return (
    <div className="dtl-env-row">
      <span className="dtl-env-label">{label}</span>
      <span className="dtl-env-tokens">
        {items.map((item, i) => (
          <span key={i} className={'dtl-env-token' + (item.match ? ' match' : '')}>{item.label}</span>
        ))}
      </span>
    </div>
  )
}

// ── 기능 상세 ─────────────────────────────────────────────────
function FeatureDetail({ detail, onBack, onOpenApp, onOpenDetail }) {
  const [showSim, setShowSim] = useState(false)
  const { item, recAppIds = [], prevDetail } = detail

  const handleBack = prevDetail
    ? () => onOpenDetail?.(prevDetail)
    : onBack
  const backLabel = prevDetail ? '‹ 앱으로' : '‹ 결과로'

  // engine v3/v4 는 id 를 직접 사용. 하위 호환으로 item.code 도 허용.
  const featureId = item.id ?? item.code
  if (!featureId && process.env.NODE_ENV !== 'production') {
    console.warn('[FeatureDetail] item.id/code 모두 없음', item)
  }

  const feature = FEATURE_BY_ID[featureId]
  const name = item.nameKo ?? feature?.nameKo ?? featureId
  const desc = item.descKo ?? feature?.descKo ?? ''
  const simId = feature?.sim
  const hasLiveSim = simId != null

  // 앱 목록: features[].apps 역방향 참조
  const allAppIds = feature?.apps ?? []
  const recSet = new Set(recAppIds)
  const recIds = allAppIds.filter((id) => recSet.has(id))
  const restIds = allAppIds.filter((id) => !recSet.has(id))

  return (
    <div className="dtl" onClick={(e) => e.stopPropagation()}>
      <div className="dtl-nav">
        <button className="dtl-back" onClick={handleBack}>{backLabel}</button>
        <span className="dtl-nav-title">기능 상세</span>
      </div>
      <div className="dtl-body">

        {/* 1) 기능 이름 */}
        <h2 className="dtl-title">{name}</h2>

        {/* 2) 설명 */}
        {desc && <p className="dtl-desc">{desc}</p>}

        {/* 3) 기능 속성 — 작동 시점·개입 방식·통제 범위 */}
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
            {(feature.scope ?? []).length > 0 && (
              <div className="dtl-meta-row">
                <span className="dtl-meta-label">통제 범위</span>
                <span className="dtl-meta-value">
                  {(feature.scope ?? []).map((s) => SCOPE_LEVELS[s] ?? s).join(' · ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 4) 겪어보기 */}
        {feature?.role === 'intervention' && (
          <button className="c-sim-btn" onClick={() => setShowSim(true)}>경험해보기</button>
        )}

        {/* 5) 이 기능이 있는 앱 */}
        <div className="dtl-sec-h">이 기능이 있는 앱</div>
        <div className="dtl-apps">
          {recIds.map((id) => <AppRow key={id} appId={id} highlighted onOpenApp={onOpenApp} />)}
          {restIds.map((id) => <AppRow key={id} appId={id} onOpenApp={onOpenApp} />)}
        </div>

      </div>

      {showSim && (
        hasLiveSim
          ? <InterventionSim simId={simId} featureName={name} onClose={() => setShowSim(false)} />
          : <SimNotReady onClose={() => setShowSim(false)} />
      )}
    </div>
  )
}

// ── 앱 상세 ───────────────────────────────────────────────────
function AppDetail({ detail, state, onBack, onOpenDetail }) {
  const [iconErr, setIconErr] = useState(false)
  const { item: app, recPicks = [], prevDetail } = detail

  const handleBack = prevDetail
    ? () => onOpenDetail?.(prevDetail)
    : onBack
  const backLabel = prevDetail ? '‹ 기능으로' : '‹ 결과로'

  // 추천 기능 중 이 앱이 보유한 것 (app.features 직접 참조)
  const recHasSet = new Set(
    recPicks.filter((f) => {
      const fid = f.id ?? f.code
      return (app.features ?? []).includes(fid)
    }).map((f) => f.id ?? f.code),
  )

  // 이 앱이 가진 다른 기능 (추천 기능 제외, app.features 직접 참조)
  const recIds = new Set(recPicks.map((f) => f.id ?? f.code))
  const otherFeatures = FEATURES.filter(
    (f) => (app.features ?? []).includes(f.id) && !recIds.has(f.id)
  )
  const interventionFeatures = otherFeatures.filter((f) => f.role === 'intervention' || f.role === 'trigger' || f.role === 'exclude')
  const bypassFeatures = otherFeatures.filter((f) => f.role === 'bypass')

  // 지원 환경 일치 여부
  const userOs = state?.env?.os ?? []
  const userPlatforms = state?.env?.platforms ?? []
  const userRoute = state?.env?.route ?? []

  const iap = getInAppPlatforms(app)

  const osItems = ['ios', 'android'].filter((o) => app.os.includes(o)).map((o) => ({
    label: o === 'ios' ? 'iOS' : 'Android',
    match: userOs.includes(o),
  }))
  const routeItems = (app.worksOn ?? []).map((r) => ({
    label: r === 'app' ? '앱' : '웹브라우저',
    match: userRoute.some((ur) => ROUTE_MAP[ur] === r),
  }))
  const platformItems = iap.length
    ? iap.map((p) => ({ label: p, match: userPlatforms.includes(p) }))
    : [{ label: '미지원', match: false }]

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
            <div className="dtl-app-avail">{['ios','android'].filter(o=>app.os.includes(o)).map(o=>o==='ios'?'iOS':'Android').join(' · ')}</div>
          </div>
        </div>

        {/* 2) 추천 기능 지원 여부 */}
        {recPicks.length > 0 && (
          <>
            <div className="dtl-sec-h">추천 기능 지원 여부</div>
            <div className="dtl-feat-list">
              {recPicks.map((f) => {
                const fid = f.id ?? f.code
                const fName = f.nameKo ?? FEATURE_BY_ID[fid]?.nameKo ?? fid
                return (
                  <div key={fid} className={'dtl-feat-row' + (recHasSet.has(fid) ? ' highlight' : '')}>
                    <span className="dtl-feat-name">{fName}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* 스토어 링크 */}
        {(app.storeLinks?.android || app.storeLinks?.ios) && (
          <div className="dtl-store-links">
            {app.storeLinks.android && (
              <a className="dtl-store-btn" href={app.storeLinks.android} target="_blank" rel="noreferrer">
                Google Play Store
              </a>
            )}
            {app.storeLinks.ios && (
              <a className="dtl-store-btn" href={app.storeLinks.ios} target="_blank" rel="noreferrer">
                Apple App Store
              </a>
            )}
          </div>
        )}

        {/* 3a) 이 앱이 가진 다른 개입 기능 */}
        {interventionFeatures.length > 0 && (
          <>
            <div className="dtl-sec-h">이 앱이 가진 다른 개입 기능</div>
            <div className="dtl-feat-list">
              {interventionFeatures.map((f) => (
                <button key={f.id} className="dtl-feat-row dtl-feat-row--link" onClick={() => onOpenDetail?.({ type: 'feature', item: f, recAppIds: [], prevDetail: detail })}>
                  <span className="dtl-feat-name">{f.nameKo}</span>
                  {f.descKo && <span className="dtl-feat-desc">{f.descKo}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* 3b) 우회를 막아주는 기능 */}
        {bypassFeatures.length > 0 && (
          <>
            <div className="dtl-sec-h">우회를 막아주는 기능</div>
            <div className="dtl-feat-list">
              {bypassFeatures.map((f) => (
                <button key={f.id} className="dtl-feat-row dtl-feat-row--link" onClick={() => onOpenDetail?.({ type: 'feature', item: f, recAppIds: [], prevDetail: detail })}>
                  <span className="dtl-feat-name">{f.nameKo}</span>
                  {f.descKo && <span className="dtl-feat-desc">{f.descKo}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* 4) 지원 환경 */}
        <div className="dtl-sec-h">지원 환경</div>
        <div className="dtl-env-table">
          <EnvRow label="운영체제" items={osItems} />
          <EnvRow label="이용 경로" items={routeItems} />
          {app.inAppPlatforms !== null && (
            <EnvRow label="앱 내 차단" items={platformItems} />
          )}
        </div>


      </div>
    </div>
  )
}

// ── 진입점 ────────────────────────────────────────────────────
export default function DetailPanel({ detail, state, onBack, onOpenDetail }) {
  const handleOpenApp = (app) =>
    onOpenDetail?.({ type: 'app', item: app, recPicks: detail.recPicks ?? [], prevDetail: detail })

  const handleOpenFeature = (feature) =>
    onOpenDetail?.({ type: 'feature', item: feature, recAppIds: [], prevDetail: detail })

  if (detail.type === 'feature') {
    return (
      <FeatureDetail
        detail={detail}
        state={state}
        onBack={onBack}
        onOpenApp={handleOpenApp}
        onOpenDetail={onOpenDetail}
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
