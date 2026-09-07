import { useState } from 'react'
import { recommend } from '../engine.js'
import { SCOPE_LEVELS, RESISTANCE_LABEL, LADDER_RUNGS } from '../data/features.js'
import { displayName } from '../store.js'
import { VARIANTS } from './Intervention.jsx'
import { rangesOf } from './Clock24.jsx'
import { appIconPath } from '../data/apps.js'

// ── 앱 아이콘 — 이미지 실패 시 이니셜 원형 배지 ─────────────
function AppIcon({ id, shortName, idx, onClick }) {
  const [err, setErr] = useState(false)
  const initial = (shortName || id)[0].toUpperCase()
  return (
    <button className="arec" data-idx={idx} onClick={onClick}>
      <div className="arec-icon">
        {err
          ? <span className="arec-icon-fb">{initial}</span>
          : <img src={appIconPath(id)} alt="" width={48} height={48} onError={() => setErr(true)} />
        }
      </div>
      <div className="arec-name">{shortName || id}</div>
    </button>
  )
}

// ── 응답 요약 자연어 문단 빌더 ────────────────────────────────
// 값이 없는 절은 빠진다. 내부 코드·영어명 없음.
function buildSummary(state, picks) {
  const parts = []

  // 절 1: 기기 / 플랫폼 / 범위
  const devices = (state.env?.devices ?? []).join(', ')
  const platforms = (state.env?.platforms ?? []).join(', ')
  const scopes = (state.scopes ?? []).map((s) => SCOPE_LEVELS[s]).filter(Boolean).join(', ')
  let s1 = ''
  if (devices && platforms) s1 = `${devices}에서 ${platforms}을(를) 보고 계시고`
  else if (devices) s1 = `${devices}에서 보고 계시고`
  else if (platforms) s1 = `${platforms}을(를) 보고 계시고`
  if (scopes) {
    s1 = s1
      ? `${s1}, ${scopes} 단위로 막고 싶다고 하셨어요.`
      : `${scopes} 단위로 막고 싶다고 하셨어요.`
  } else if (s1) {
    s1 += '.'
  }
  if (s1) parts.push(s1)

  // 절 2: 시간대 + 1순위 시점
  const topWhen = (state.timingRank ?? [])[0]
  const timingLabel = topWhen ? VARIANTS[topWhen]?.shortName : null
  let timeStr = ''
  if (state.dayType === 'daily' && (state.hours?.daily ?? []).length) {
    timeStr = `매일 ${rangesOf(state.hours.daily).join(', ')}`
  } else if (state.dayType === 'split') {
    const wd = state.hours?.weekday ?? []
    const we = state.hours?.weekend ?? []
    const ts = []
    if (wd.length) ts.push(`평일 ${rangesOf(wd).join(', ')}`)
    if (we.length) ts.push(`주말 ${rangesOf(we).join(', ')}`)
    if (ts.length) timeStr = ts.join(', ')
  }
  if (timeStr && timingLabel) {
    parts.push(`${timeStr}, ${timingLabel}에 개입받는 것을 가장 선호하셨고.`)
  } else if (timingLabel) {
    parts.push(`${timingLabel}에 개입받는 것을 가장 선호하셨어요.`)
  } else if (timeStr) {
    parts.push(`${timeStr}에 제한을 두고 싶다고 하셨어요.`)
  }

  // 절 3: 임계선
  const threshold = state.ladderThreshold
  if (threshold !== null && threshold !== undefined && threshold > 0) {
    const rung = LADDER_RUNGS[threshold - 1]
    if (rung) parts.push(`'${rung.nameKo}' 정도까지는 괜찮다고 하셨어요.`)
  }

  // 절 4: 우회 방지
  const blocked = Object.entries(state.bypassWanted ?? {})
    .filter(([, v]) => v === true)
    .map(([k]) => RESISTANCE_LABEL[k])
    .filter(Boolean)
  if (blocked.length) {
    parts.push(`${blocked.map((b) => `'${b}'`).join(', ')}은(는) 막혀 있어야 한다고 하셨습니다.`)
  }

  // 절 5: 추천 (displayName 이 undefined 면 해당 항목 제외)
  if (picks.length) {
    const names = picks
      .map((f) => displayName({ code: f.code, scope: f.scope, taskGroup: f.taskGroup }))
      .filter(Boolean)
    if (names.length) {
      parts.push(`그래서 ${names.map((n) => `'${n}'`).join(', ')}을(를) 추천했어요.`)
    }
  }

  return parts.join(' ')
}

// ── 시간대 포맷 (답변 자세히 보기용) ─────────────────────────
function hoursDisplay(state) {
  const fmt = (arr) =>
    arr.length ? `${rangesOf(arr).join(', ')} (${arr.length}시간)` : '지정 안 함'
  if (state.dayType === 'none') return '시간 무관'
  if (state.dayType === 'split') {
    const wd = fmt(state.hours?.weekday || [])
    const we = fmt(state.hours?.weekend || [])
    return `평일 ${wd} / 주말 ${we}`
  }
  if (state.dayType === 'daily') return fmt(state.hours?.daily || [])
  return null
}

export default function ResultCard({ state, api, onOpenDetail }) {
  const [showAnswers, setShowAnswers] = useState(false)
  const r = recommend(state)
  const summary = buildSummary(state, r.picks)
  const hours = hoursDisplay(state)

  const env = (k) => {
    const v = state.env?.[k] || []
    if (!v.length) return null
    const other = state.envOther?.[k]
    return v.map((x) => (x === '기타' && other ? `기타(${other})` : x)).join(', ')
  }

  return (
    <div className="c c-result">
      <div className="res-scroll">

        {/* 0) 아키타입 — 성격유형 키워드 + 한 문단 설명 */}
        <div className="res-hero">
          <div className="res-eyebrow">나의 유형</div>
          <p className="res-code">{r.archetype.code}</p>
          <p className="res-tag">{r.archetype.tagline}</p>
          <p className="res-body">{r.archetype.body}</p>
        </div>

        <div className="res-pad">

          {/* 1) 추천 기능 3개 — 이름만, 누르면 기능 상세 */}
          <div className="sec">
            <div className="sec-h"><span>추천 기능</span></div>
            {r.picks.map((f) => {
              const name = displayName({ code: f.code, scope: f.scope, taskGroup: f.taskGroup })
              if (!name && process.env.NODE_ENV !== 'production') {
                console.warn('[ResultCard] displayName undefined for feature', f)
              }
              return (
                <button
                  key={f.code}
                  className="frec frec-btn"
                  onClick={() => onOpenDetail?.({ type: 'feature', item: f, recAppIds: r.appRecs.map((a) => a.id), recPicks: r.picks })}
                >
                  <span className="frec-name">{name ?? f.code}</span>
                  <span className="frec-chevron">›</span>
                </button>
              )
            })}
          </div>

          {/* 2) 추천 앱 3개 — 아이콘 + 이름, 누르면 앱 상세 */}
          {r.appRecs.length > 0 && (
            <div className="sec">
              <div className="sec-h"><span>추천 앱</span></div>
              <div className="arec-grid">
                {r.appRecs.map((a, i) => (
                  <AppIcon
                    key={a.id}
                    id={a.id}
                    shortName={a.shortName}
                    idx={i}
                    onClick={() => onOpenDetail?.({ type: 'app', item: a, recPicks: r.picks })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 3) 이렇게 추천한 이유 — 자연어 한 문단 */}
          <div className="sec">
            <div className="sec-h"><span>이렇게 추천한 이유</span></div>
            <p className="res-reason">
              {summary}
            </p>
          </div>

          {/* 4) 답변 자세히 보기 — 접힘 */}
          <div className="sec">
            <div className="sec-h">
              <span>답변 자세히 보기</span>
              <button className="sec-toggle" onClick={() => setShowAnswers((v) => !v)}>
                {showAnswers ? '접기' : '열기'}
              </button>
            </div>
            {showAnswers && (
              <table className="ptable">
                <tbody>
                  {env('devices') && <tr><th>기기</th><td>{env('devices')}</td></tr>}
                  {env('route') && <tr><th>경로</th><td>{env('route')}</td></tr>}
                  {env('platforms') && <tr><th>플랫폼</th><td>{env('platforms')}</td></tr>}
                  {(state.scopes ?? []).length > 0 && (
                    <tr>
                      <th>통제 범위</th>
                      <td>{state.scopes.map((s) => SCOPE_LEVELS[s]).join(', ')}</td>
                    </tr>
                  )}
                  {hours && (
                    <tr><th>통제 시간대</th><td>{hours}</td></tr>
                  )}
                  {(state.timingRank ?? []).length > 0 && (
                    <tr>
                      <th>선호 개입 시점</th>
                      <td>
                        {state.timingRank
                          .map((w, i) => `${i + 1}. ${VARIANTS[w]?.shortName ?? w}`)
                          .join('  ')}
                      </td>
                    </tr>
                  )}
                  {state.ladderThreshold !== null && state.ladderThreshold !== undefined && (
                    <tr>
                      <th>개입 강도</th>
                      <td>
                        {state.ladderThreshold > 0
                          ? `'${LADDER_RUNGS[state.ladderThreshold - 1]?.nameKo}' 까지 수용`
                          : '모두 거부'}
                      </td>
                    </tr>
                  )}
                  {Object.values(state.bypassWanted ?? {}).some((v) => v !== undefined) && (
                    <tr>
                      <th>우회 방지</th>
                      <td>
                        {Object.entries(state.bypassWanted ?? {})
                          .filter(([, v]) => v === true)
                          .map(([k]) => RESISTANCE_LABEL[k])
                          .join(', ') || '없음'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <button className="c-ghost" onClick={api.reset}>
            처음부터 다시
          </button>
        </div>
      </div>
    </div>
  )
}
