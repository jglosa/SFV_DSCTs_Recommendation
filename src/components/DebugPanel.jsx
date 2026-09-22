import { STEP_LABEL, cardTitle } from '../deck.js'
import { SCOPE_LEVELS, BYPASS_TARGETS, RESISTANCE_LABEL } from '../data/features.js'
import { VARIANTS } from './Intervention.jsx'
import { rangesOf } from './Clock24.jsx'
import { recommend } from '../engine.js'

// ─────────────────────────────────────────────────────────────
// 시연·모니터 패널. 데스크톱에서만 보이고 휴대폰 폭에서는 CSS로 숨는다.
//
// 노트북에서 폰 프레임을 조작하는 동안 옆에서:
//   · 지금 몇 번째 어느 카드인지
//   · 각 단계에 무엇이 입력됐는지
//   · 아무 카드로든 클릭 점프
// 를 실시간으로 볼 수 있다.
//
// [한계] 참가자가 자기 휴대폰으로 접속하는 경우는 별개의 브라우저 세션이므로
// 여기에 반영되지 않는다. 기기 간 동기화는 서버(웹소켓)가 필요하다.
// ─────────────────────────────────────────────────────────────


const NUM = ['①', '②', '③']

function Row({ k, v, dim }) {
  return (
    <div className={'mon-row' + (dim ? ' dim' : '')}>
      <span className="mon-k">{k}</span>
      <span className="mon-v">{v}</span>
    </div>
  )
}

export default function DebugPanel({ state, meta, onJump }) {
  const cards = meta?.cards || []
  const active = meta?.active ?? 0
  const order = meta?.order || []

  const isResult = cards[active]?.type === 'result'
  const { gradeTable = null, appTable = null } = isResult ? recommend(state) : {}

  const envLine = (key) => {
    const v = state.env[key] || []
    if (!v.length) return null
    const other = state.envOther[key]
    return v.map((x) => (x === '기타' && other ? `기타(${other})` : x)).join(', ')
  }

  // 카드 목록을 단계별로 묶기
  const groups = []
  cards.forEach((c, i) => {
    const step = c.step || '—'
    const g = groups[groups.length - 1]
    if (g && g.step === step) g.items.push({ c, i })
    else groups.push({ step, items: [{ c, i }] })
  })

  return (
    <aside className="sidecar">
      <p className="sc-h">시연 · 모니터</p>
      <p className="sc-note">
        참가자에게는 보이지 않습니다. 왼쪽 폰 화면을 조작하면 여기에 실시간으로
        반영됩니다.
      </p>

      {/* ── 현재 위치 ── */}
      <div className="mon-now">
        <span className="mon-now-step">{cards[active]?.step || '—'}</span>
        <span className="mon-now-title">{cards[active] ? cardTitle(cards[active]) : '—'}</span>
        <span className="mon-now-idx">
          {active + 1} / {cards.length}
          {meta?.remaining ? ` (+${meta.remaining})` : ''}
        </span>
      </div>

      {/* ── 카드 목록 (클릭 점프) ── */}
      <div className="sc-group">
        <div className="sc-label">카드 목록 · 클릭해서 이동</div>
        <div className="mon-list">
          {groups.map((g, gi) => (
            <div className="mon-grp" key={gi}>
              <div className="mon-grp-h">
                {g.step === '—' ? '·' : g.step}
                <i>{STEP_LABEL[g.step] || ''}</i>
              </div>
              {g.items.map(({ c, i }) => (
                <button
                  key={c.cid}
                  className={'mon-item' + (i === active ? ' on' : '')}
                  onClick={() => onJump({ i, k: Math.random() })}
                >
                  <span className="mon-item-n">{i + 1}</span>
                  {cardTitle(c)}
                </button>
              ))}
            </div>
          ))}
          {meta?.remaining > 0 && (
            <div className="mon-pending">아직 생성되지 않은 카드 {meta.remaining}장</div>
          )}
        </div>
      </div>

      {/* ── 입력 현황 ── */}
      <div className="sc-group">
        <div className="sc-label">입력 현황</div>
        <div className="mon-box">
          <div className="mon-sec">S0 사용 환경</div>
          <Row k="기기" v={envLine('devices') || '—'} dim={!envLine('devices')} />
          <Row k="OS" v={(state.env.os ?? []).join(', ') || '—'} dim={!(state.env.os ?? []).length} />
          <Row k="경로" v={envLine('route') || '—'} dim={!envLine('route')} />
          <Row k="플랫폼" v={envLine('platforms') || '—'} dim={!envLine('platforms')} />

          <div className="mon-sec">S1 통제 범위</div>
          <Row
            k="범위"
            v={state.scopes.length ? state.scopes.map((s) => SCOPE_LEVELS[s]).join(', ') : '—'}
            dim={!state.scopes.length}
          />

          <div className="mon-sec">S2 통제 규칙</div>
          <Row
            k="유형"
            v={{ daily: '매일 같은 시간대', split: '평일·주말 구분', none: '시간 무관' }[state.dayType] || '—'}
            dim={!state.dayType}
          />
          {state.dayType === 'daily' && (
            <Row
              k="매일"
              v={(state.hours.daily || []).length ? `${rangesOf(state.hours.daily).join(', ')} (${state.hours.daily.length}h)` : '—'}
              dim={!(state.hours.daily || []).length}
            />
          )}
          {state.dayType === 'split' && (
            <>
              <Row
                k="평일"
                v={(state.hours.weekday || []).length ? `${rangesOf(state.hours.weekday).join(', ')} (${state.hours.weekday.length}h)` : '—'}
                dim={!(state.hours.weekday || []).length}
              />
              <Row
                k="주말"
                v={(state.hours.weekend || []).length ? `${rangesOf(state.hours.weekend).join(', ')} (${state.hours.weekend.length}h)` : '—'}
                dim={!(state.hours.weekend || []).length}
              />
            </>
          )}

          <div className="mon-sec">S3 개입 시점</div>
          <Row
            k="제시 순서"
            v={order.length ? order.map((w, i) => `${NUM[i]}${VARIANTS[w].shortName}`).join(' ') : '—'}
            dim={!order.length}
          />
          <Row
            k="선호 순위"
            v={
              state.timingRank.length
                ? state.timingRank.map((w, i) => `${i + 1}.${VARIANTS[w].shortName}`).join(' ')
                : '—'
            }
            dim={!state.timingRank.length}
          />

          <div className="mon-sec">S4 개입 강도</div>
          {/* 탐색 방문: visited agency 순서 */}
          <Row
            k="탐색 방문"
            v={(state.agencyVisited ?? []).length
              ? (state.agencyVisited).join(' → ')
              : '—'}
            dim={!(state.agencyVisited ?? []).length}
          />
          {/* agency 순위 */}
          <Row
            k="agency 순위"
            v={(state.agencyRank ?? []).length
              ? (state.agencyRank).map((a, i) => `${i + 1}.${a}`).join(' ')
              : '—'}
            dim={!(state.agencyRank ?? []).length}
          />
          {/* 3단 척도 결과: featureAccepted */}
          <Row
            k="기능 응답"
            v={Object.keys(state.featureAccepted ?? {}).length
              ? Object.entries(state.featureAccepted ?? {})
                  .map(([id, v]) => `${id}:${v}`)
                  .join(' ')
              : '—'}
            dim={!Object.keys(state.featureAccepted ?? {}).length}
          />

          <div className="mon-sec">S5 우회·임시해제</div>
          {BYPASS_TARGETS.map((s) => (
            <Row
              key={s.featureId}
              k={RESISTANCE_LABEL[s.featureId]}
              v={(() => {
                const m = (state.bypassMethods ?? {})[s.featureId]
                const w = (state.bypassWanted ?? {})[s.featureId]
                if (m === undefined && w === undefined) return '—'
                const mStr = m === true ? '사용할 것' : m === false ? '안 쓸 것' : '?'
                const wStr = w === true ? '차단 원함' : w === false ? '차단 불필요' : '?'
                return `${mStr} / ${wStr}`
              })()}
              dim={(state.bypassMethods ?? {})[s.featureId] === undefined}
            />
          ))}
        </div>
      </div>

      {/* ── 등급 목록 (결과 화면에서만) ── */}
      {isResult && gradeTable && (
        <div className="sc-group">
          <div className="sc-label">레벨 등급표 (G 오름차순)</div>
          {/* 입력 요약 */}
          <div className="grade-summary">
            {`agencyRank:[${(state.agencyRank ?? []).join(',')}]`}
            {`  fa:{${Object.entries(state.featureAccepted ?? {}).map(([k,v]) => `${k}:${v}`).join(',')}}`}
            {`  scopes:[${(state.scopes ?? []).join(',')}]`}
            {`  timing:[${(state.timingRank ?? []).join(',')}]`}
            {`  oxSkipped:[${(state.oxSkipped ?? []).join(',')}]`}
          </div>
          <div className="mon-box">
            {gradeTable.map((row) => {
              const rankStr = row.rank === -1 ? 'rank -' : `rank ${row.rank + 1}`
              const dpStr = row.decideParams === null
                ? 'null'
                : JSON.stringify(row.decideParams)
              return (
                <div className="grade-row" key={row.level}>
                  <div className="grade-hdr">
                    <span className="grade-g">G{row.grade}</span>
                    <span className="grade-lv">L{row.level}</span>
                    <span className="grade-name">{row.nameKo}</span>
                    <span className="grade-meta">{row.agency}  {rankStr}</span>
                    <span className={`grade-ans ${row.answer ?? 'none'}`}>{row.answer ?? 'none'}</span>
                  </div>
                  <div className="grade-dp">
                    {`dp:${dpStr}`}
                    {row.fallback && ` [${row.fallback} 폴백]`}
                  </div>
                  {row.items.length > 0 && (
                    <div className="grade-items">
                      {row.items.map((it) => (
                        <div
                          key={it.id}
                          className={`grade-item${it.picked ? ' picked' : ''}${!it.passed ? ' dropped' : ''}`}
                        >
                          {it.picked ? '★ ' : '· '}
                          {it.nameKo}
                          <span className="grade-item-meta">
                            {'  '}{it.when}
                            {it.scope.length > 0 ? '  ' + it.scope.join(',') : ''}
                            {'  '}(앱 {it.coverage}개)
                            {it.dropReason && (
                              <span className="grade-drop">  [{it.dropReason}]</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 앱 점수표 (결과 화면에서만) ── */}
      {isResult && appTable && (
        <div className="sc-group">
          <div className="sc-label">앱 점수표</div>
          <div className="grade-summary">
            {`userMobileOs:[${appTable.userMobileOs.join(',')}]`}
            {`  pool:${appTable.poolSize}개`}
            {appTable.excludedIds.length > 0 && `  excluded:[${appTable.excludedIds.join(',')}]`}
          </div>
          <div className="mon-box">
            {appTable.rows.map((row, i) => {
              // 바로 위 행과 비교해 처음으로 달라진 점수 키
              const prev = appTable.rows[i - 1]
              const KEYS = ['osMatchCount','coverageScore','scopeScore','envScore','scheduleScore','bypassScore']
              const LABELS = ['OS','C','S','E','Sc','B']
              const diffKey = prev
                ? KEYS.find((k) => row[k] !== prev[k])
                : null
              return (
                <div key={row.id} className={`at-row${row.picked ? ' at-picked' : ''}`}>
                  <span className="at-pick">{row.picked ? '★' : '·'}</span>
                  <span className="at-id">{row.id}</span>
                  <span className="at-name">{row.shortName}</span>
                  <span className="at-os">[{row.os.join(',')}]</span>
                  <span className="at-scores">
                    {KEYS.map((k, ki) => (
                      <span key={k} className={`at-s${k === diffKey ? ' at-diff' : ''}`}>
                        {LABELS[ki]}{row[k]}
                      </span>
                    ))}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </aside>
  )
}
