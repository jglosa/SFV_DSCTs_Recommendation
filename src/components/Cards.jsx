import { useEffect, useRef, useState } from 'react'
import { MockHome, MockShorts } from './MockYouTube.jsx'
import { VIDEO_POOL } from '../data/videos.js'
import Intervention, { VARIANTS, SIM_INUSE_COUNT } from './Intervention.jsx'
import Clock24, { rangesOf } from './Clock24.jsx'
import { AGENCY_LEVELS, ENFORCEMENT, RUNGS_BY_AGENCY, SIMULATIONS, description } from '../data/features.js'
import { canProceedFromExplore, displayName, rungsForOX } from '../store.js'
import { SCENARIOS, SCENARIO_BY_ID } from '../data/scenarios.js'
import { STEP_LABEL } from '../deck.js'

// 플랫폼 아이콘: 로딩 실패 시 이니셜 원형 배지로 대체
function PlatformIcon({ name, src }) {
  const [err, setErr] = useState(false)
  if (!src) return null
  return err
    ? <span className="c-opt-icon-fb">{name[0].toUpperCase()}</span>
    : <img src={src} className="c-opt-icon" width={24} height={24} alt="" onError={() => setErr(true)} />
}

function Tag({ step, n, tone }) {
  // 참가자 화면에 S 번호·단계명 비노출. 시연자 모니터(DebugPanel)는 STEP_LABEL 직접 사용.
  return null
}

export function SwipeUp({ label = '위로 밀어서 계속', tone, onClick }) {
  return (
    <div
      className={'swipe-up' + (tone ? ' ' + tone : '') + (onClick ? ' clickable' : '')}
      onClick={onClick}
    >
      <span className="swipe-arrow">︿</span>
      {label}
    </div>
  )
}

// ══ 인트로 ══════════════════════════════════════════════
export function IntroCard({ onAnswer, answered }) {
  return (
    <div className="c c-dark">
      <div className="c-pad">
        <div className="c-sys-label">Digital Self-Control Tool Selection Process</div>
        <h1 className="c-h1">
          나도 모르게 흘러간 시간,
          <br />
          <em>이제 되찾아 봐요</em>
        </h1>
        <p className="c-p">
          숏폼 비디오를 보다가 의도치 않게 너무 많은 시간을 흘려보낸 적이 있나요?
          주도권을 되찾고 싶은데 뭘 어떻게 해야 할지 모르겠다면, 여기서
          시작해보세요.
        </p>
        <p className="c-p">
          숏폼 사용을 스스로 조절하도록 돕는 많은 기술들 중에서,
          여러분에게 맞는 기능을 추천합니다. 질문에 답하고, 실제 숏폼
          사용 환경처럼 직접 써보면서 무엇을 통제하고 싶은지, 어떻게 통제하고
          싶은지 생각해보세요.
        </p>
        <div className="c-foot">
          질문에 답하거나 시뮬레이션이 끝나면 위로 스와이프하라는 안내가
          표시됩니다. 숏폼 비디오를 보듯 위로 밀어서 넘어가세요.
        </div>
        {!answered ? (
          <button className="c-start" onClick={() => onAnswer(true)}>
            시작하기
          </button>
        ) : (
          <SwipeUp tone="dark" label="위로 밀어서 시작" />
        )}
      </div>
    </div>
  )
}

// ══ 안내 ════════════════════════════════════════════════
export function NoteCard({ spec, state, onAnswer, answered }) {
  useEffect(() => {
    if (!answered) onAnswer(true)
  }, [answered, onAnswer])
  // body는 문자열 또는 (state) => string 함수 둘 다 허용
  const body = typeof spec.body === 'function' ? spec.body(state) : spec.body
  return (
    <div className="c c-dark">
      <div className="c-pad">
        <Tag step={spec.step} tone="dark" />
        <h2 className="c-h2">{spec.heading}</h2>
        {body && <p className="c-p">{body}</p>}
        {/* scene: 제시 시나리오 박스 (.scene 재사용) */}
        {spec.scene && (
          <div className="scene">
            <div className="scene-tag">{spec.sceneLabel ?? '제시 상황'}</div>
            <p className="scene-text">{spec.scene}</p>
          </div>
        )}
        {spec.body2 && <p className="c-p">{spec.body2}</p>}
        {spec.foot && <div className="c-foot">{spec.foot}</div>}
        <SwipeUp tone="dark" />
      </div>
    </div>
  )
}

// ══ 복수 선택 (+ 기타 주관식) ═══════════════════════════
// iconFn: (optionString) => string | null — 선택지 앞에 붙일 아이콘 경로 함수 (선택)
export function MultiCard({ spec, value = [], other = '', onAnswer, onOther, iconFn }) {
  const hasOther = value.includes('기타')
  const toggle = (o) =>
    onAnswer(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])

  return (
    <div className="c c-paper">
      <div className="c-pad">
        <Tag step={spec.step} n={spec.n} />
        <h2 className="c-q">{spec.q}</h2>
        {spec.hint && <p className="c-qhint">{spec.hint}</p>}
        <div className="c-opts">
          {spec.opts.map((o) => (
            <button
              key={o}
              className={'c-opt' + (value.includes(o) ? ' on' : '')}
              onClick={() => toggle(o)}
            >
              <span className="c-box">{value.includes(o) ? '✓' : ''}</span>
              {iconFn && <PlatformIcon name={o} src={iconFn(o)} />}
              {o}
            </button>
          ))}
        </div>

        {hasOther && (
          <div className="other-wrap">
            <label className="other-lbl">기타 — 직접 적어주세요</label>
            <input
              className="other-in"
              type="text"
              value={other}
              placeholder="예: 스마트TV"
              onChange={(e) => onOther(e.target.value)}
            />
          </div>
        )}

        {value.length > 0 && <SwipeUp />}
      </div>
    </div>
  )
}

// ══ S1 통제 범위 : 홈 화면 (앱·진입점·탭·콘텐츠 4개 타겟 통합) ═══
// content 타겟은 칩 묶음(이런 채널·주제)으로만 진입한다.
// 채널 이름 등 구체적 대상은 수집하지 않는다 (추천에 쓰이지 않음).
export function ScopeHomeCard({ state, api, onAnswer }) {
  const pick = (id) => {
    const has = state.scopes.includes(id)
    const scopes = has ? state.scopes.filter((s) => s !== id) : [...state.scopes, id]
    api.set({ scopes })
    if (scopes.length) onAnswer(true)
  }

  return (
    <div className="c c-device">
      <div className="c-ask">
        <Tag step="S1" tone="dark" />
        <h2 className="c-ask-q">막고 싶은 곳을 화면에서 눌러주세요</h2>
      </div>
      <div className="c-screen">
        <MockHome
          picked={state.scopes}
          onPick={pick}
          selectable
        />
      </div>

      {state.scopes.length > 0 && <SwipeUp tone="dark" />}
    </div>
  )
}

// ══ S1 통제 범위 : 숏폼 화면 (레거시 export — deck.js 에서 type='scope-shorts'는 제거됨)
// Deck.jsx 가 import 하므로 export는 유지한다. 카드가 실제로 생성되지는 않는다.
export function ScopeShortsCard({ state, api, onAnswer, answered, video }) {
  useEffect(() => {
    if (!answered) onAnswer(true)
  }, [answered, onAnswer])

  const pick = (id) => {
    const has = state.scopes.includes(id)
    api.set({ scopes: has ? state.scopes.filter((s) => s !== id) : [...state.scopes, id] })
    onAnswer(true)
  }

  return (
    <div className="c c-device">
      <div className="c-ask">
        <Tag step="S1" n="02" tone="dark" />
        <h2 className="c-ask-q">이 화면에서도 막고 싶은 것이 있나요</h2>
      </div>
      <div className="c-screen">
        <MockShorts video={video} picked={state.scopes} onPick={pick} playing />
      </div>
      <SwipeUp tone="dark" label="없으면 그냥 위로 밀어주세요" />
    </div>
  )
}

// ══ S2 통제 규칙 : 규칙 유형 선택 ══════════════════════
const SCHEDULE_TYPE_OPTS = [
  { k: 'daily', label: '매일 같은 시간대' },
  { k: 'split', label: '평일과 주말을 따로' },
  { k: 'none',  label: '시간과 무관하게 개입하고 싶음' },
]

export function ScheduleTypeCard({ state, api, onAnswer }) {
  const pick = (k) => {
    api.set({ dayType: k })
    onAnswer(true)
  }
  return (
    <div className="c c-paper">
      <div className="c-pad">
        <Tag step="S2" />
        <h2 className="c-q">언제 개입이 필요한가요?</h2>
        <div className="c-opts">
          {SCHEDULE_TYPE_OPTS.map(({ k, label }) => (
            <button
              key={k}
              className={'c-opt' + (state.dayType === k ? ' on' : '')}
              onClick={() => pick(k)}
            >
              <span className="c-box">{state.dayType === k ? '✓' : ''}</span>
              {label}
            </button>
          ))}
        </div>
        {state.dayType && <SwipeUp />}
      </div>
    </div>
  )
}

// ══ S2 통제 규칙 : 원형 24시간 시계 ═════════════════════
const HOURS_LABEL = { daily: '매일', weekday: '평일', weekend: '주말' }

export function ScheduleCard({ state, api, onAnswer, hoursKey }) {
  const hoursVal = state.hours[hoursKey] || []
  const write = (hrs) => {
    api.set({ hours: { ...state.hours, [hoursKey]: hrs } })
    if (hrs.length) onAnswer(true)
  }
  return (
    <div className="c c-paper">
      <div className="c-pad">
        <Tag step="S2" />
        <h2 className="c-q">
          숏폼이 특히 길어지는 시간을 칠해주세요
          <span style={{ fontWeight: 400, color: 'var(--slate-2)' }}> · {HOURS_LABEL[hoursKey]}</span>
        </h2>
        <p className="c-qhint">누르거나 시계 위를 끌어서 칠합니다</p>

        <Clock24 hours={hoursVal} onChange={write} />

        {hoursVal.length > 0 && (
          <div className="presets">
            <button className="cat-chip" onClick={() => write([])}>지우기</button>
          </div>
        )}

        {hoursVal.length > 0 && (
          <SwipeUp label={`${rangesOf(hoursVal).join(', ')} · 위로 밀어서 계속`} />
        )}
      </div>
    </div>
  )
}

// ══ S3 시뮬레이션 메타 ═══════════════════════════════════
// 모든 시뮬레이션은 "MyTube 홈 화면에서 숏폼 탭을 누르려는" 동일 상황.
// 개입이 어느 지점에서 걸리는지만 다르다.
const SIM_META = {
  Pre: {
    badge: '진입 전 개입',
    desc: '숏폼에 진입할 수 있는 경로 자체가 비활성화되어 있습니다. 숏폼에 접근하기 전부터 이미 개입 상태임을 알 수 있습니다.',
    todo: '홈 화면에서 어떻게 달라졌는지 확인하고 위로 밀어서 넘어가세요.',
  },
  At: {
    badge: '진입 시점 개입',
    desc: '숏폼에 진입하려는 순간 개입이 발동됩니다.',
    todo: '숏폼 탭이나 피드의 숏폼 선반을 눌러보세요.',
  },
  InUse: {
    badge: '사용 중 개입',
    desc: '숏폼 시청은 가능하지만, 일정 이상 시청이 지속되면 개입합니다.',
    todo: '숏폼 탭을 누르고, 영상을 위로 밀어 넘겨보세요.',
  },
}

const SIM_NUM = ['①', '②', '③']

// ══ S3 시뮬레이션 : 시점 안내 카드 ══════════════════════
export function SimIntroCard({ spec, onAnswer, answered }) {
  const meta = SIM_META[spec.when]
  useEffect(() => {
    if (!answered) onAnswer(true)
  }, [answered, onAnswer])
  return (
    <div className="c c-dark">
      <div className="c-pad">
        <Tag step="S3" tone="dark" n={`${spec.n} / 3`} />
        <div className="sim-num">{SIM_NUM[spec.n - 1]}</div>
        <div className="sim-badge-name">{meta.badge}</div>
        <p className="c-p" style={{ fontSize: 15 }}>
          {meta.desc}
        </p>
        <div className="c-foot">{meta.todo}</div>
        <SwipeUp tone="dark" label="위로 밀어서 체험하기" />
      </div>
    </div>
  )
}

// ══ S3 시뮬레이션 : 통합 체험 카드 ══════════════════════
// Pre  : 홈 화면에서 숏폼 탭이 막힌 것을 확인 (개입 오버레이 없음)
// At   : 홈 화면 → 탭 누르면 개입 오버레이
// InUse: 홈 화면 → 탭 → 숏폼 3개 스와이프 → 개입 오버레이
export function SimSceneCard({ spec, onAnswer, answered, active, videos }) {
  const [phase, setPhase] = useState('home') // 'home' | 'watching' | 'fired' | 'done'
  const [swipeCount, setSwipeCount] = useState(0)
  // 슬라이드 전환 중 { from, to } — null이면 전환 없음
  const [swipeTransition, setSwipeTransition] = useState(null)
  const cardRef = useRef(null)
  const watchRef = useRef(null)
  const meta = SIM_META[spec.when]

  // Pre-Access: 탭이 막힌 화면을 확인하는 것 자체가 체험. 즉시 답을 허용한다.
  useEffect(() => {
    if (spec.when === 'Pre' && !answered) onAnswer(true)
  }, [spec.when, answered, onAnswer])

  const accessShorts = () => {
    if (phase !== 'home') return
    if (spec.when === 'At') setPhase('fired')
    else if (spec.when === 'InUse') setPhase('watching')
  }

  const swipeNext = () => {
    // SIM_INUSE_COUNT - 1번 넘긴 뒤(즉 SIM_INUSE_COUNT개 시청) 개입 발동
    if (swipeCount >= SIM_INUSE_COUNT - 1) {
      setPhase('fired')
    } else {
      // 이전→현재 슬라이드 업 애니메이션을 350ms 동안 실행
      const from = swipeCount
      const to = swipeCount + 1
      setSwipeTransition({ from, to })
      setSwipeCount(to)
      setTimeout(() => setSwipeTransition(null), 350)
    }
  }
  // 이벤트 핸들러에서 항상 최신 swipeNext를 호출하기 위한 ref
  const swipeNextRef = useRef(swipeNext)
  swipeNextRef.current = swipeNext

  // InUse 시청 단계: 터치 스와이프 / 마우스 드래그 / 휠로 다음 영상
  useEffect(() => {
    const el = watchRef.current
    if (!el || phase !== 'watching') return

    const cooldown = { active: false }
    const trigger = () => {
      if (cooldown.active) return
      cooldown.active = true
      setTimeout(() => { cooldown.active = false }, 700)
      swipeNextRef.current()
    }

    let startY = null
    const onTouchStart = (e) => {
      // passive: false 로 등록해야 preventDefault() 가 동작한다
      // 부모 .deck 스크롤-스냅이 이 수직 제스처를 가로채지 않도록 막는다
      e.preventDefault()
      startY = e.touches[0].clientY
    }
    const onTouchEnd = (e) => {
      if (startY !== null && startY - e.changedTouches[0].clientY > 40) trigger()
      startY = null
    }

    let mouseY = null
    const onMouseDown = (e) => { mouseY = e.clientY }
    const onMouseUp = (e) => {
      if (mouseY !== null && mouseY - e.clientY > 40) trigger()
      mouseY = null
    }

    const onWheel = (e) => {
      e.preventDefault() // 부모 .deck 스크롤-스냅 방지
      if (e.deltaY > 0) trigger()
    }

    // passive: false — preventDefault() 를 쓰려면 passive를 false로 지정해야 함
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mouseup', onMouseUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [phase])

  const resolve = () => {
    setPhase('done')
    onAnswer(true)
    // React가 카드를 append한 뒤 다음 .slot으로 스크롤
    setTimeout(() => {
      const slot = cardRef.current?.closest('[data-cid]')
      const next = slot?.nextElementSibling
      next?.scrollIntoView({ behavior: 'smooth' })
    }, 120)
  }

  // 'done' 단계에서 보여줄 앱 화면 (개입 전 마지막 화면 유지)
  const showHome = phase === 'home' || (phase === 'done' && spec.when !== 'InUse')
  const showWatching = phase === 'watching' || (phase === 'done' && spec.when === 'InUse')

  return (
    <div className="c c-video" ref={cardRef}>
      {/* 개입 오버레이 중에는 HUD 숨김 */}
      {phase !== 'fired' && (
        <div className="sim-hud">
          <span className="sim-hud-n">{SIM_NUM[spec.n - 1]}</span>
          {meta.badge}
        </div>
      )}

      {/* 홈 화면: home 단계 + done(At/Pre 완료 후에도 앱 화면 유지) */}
      {showHome && (
        <div className="c-screen full">
          {spec.when === 'Pre' ? (
            <MockHome preBlocked />
          ) : (
            // done 단계에서는 onShortsAccess 제거 → sim-cue 사라짐
            <MockHome
              targets={[]}
              onShortsAccess={phase === 'home' ? accessShorts : undefined}
            />
          )}
        </div>
      )}

      {/* InUse: 숏폼 시청 단계 + done(완료 후에도 마지막 영상 유지) */}
      {showWatching && (
        <div className="c-screen full" ref={watchRef}>
          {swipeTransition ? (
            // 슬라이드 전환 중: 이전 영상이 위로 올라가고 새 영상이 아래에서 들어온다
            <>
              <div className="sp-slide sp-slide-out">
                <MockShorts video={videos[swipeTransition.from % videos.length]} interactive={false} playing={false} />
              </div>
              <div className="sp-slide sp-slide-in">
                <MockShorts video={videos[swipeTransition.to % videos.length]} interactive={false} playing={false} />
              </div>
            </>
          ) : (
            <MockShorts video={videos[swipeCount % videos.length]} interactive={false} playing={active} />
          )}
          {phase === 'watching' && (
            // 안내 표시만, 클릭 핸들러 없음 (제스처로 넘김)
            <div className="sim-swipe-next">
              <span className="sim-count">{swipeCount + 1} / {SIM_INUSE_COUNT}</span>
              <span>위로 밀어 다음 영상</span>
              <span className="swipe-arrow">︿</span>
            </div>
          )}
        </div>
      )}

      {/* 개입 오버레이 — 닫기만 표시, 계속 보기 없음 */}
      {phase === 'fired' && (
        <Intervention
          variant={spec.when}
          n={spec.n}
          onPrimary={resolve}
          onSecondary={resolve}
          hideContinue
        />
      )}

      {/* SwipeUp: Pre는 answered 즉시, At/InUse는 done 단계에 앱 화면 위에 오버레이 */}
      {(spec.when === 'Pre' ? answered : phase === 'done') && (
        <SwipeUp tone="dark" />
      )}
    </div>
  )
}

// ══ S3 시뮬레이션 : 홈에서 Shorts 탭 (At) — 레거시, sim-scene으로 통합됨
export function SimHomeCard({ spec, onAnswer, answered }) {
  const [fired, setFired] = useState(false)
  return (
    <div className="c c-video">
      <div className="c-screen full">
        <MockHome
          targets={['app-tab']}
          cue
          onPick={(id) => {
            if (id === 'app-tab' && !answered) setFired(true)
          }}
        />
      </div>
      {!fired && !answered && <div className="launcher-cue">아래 숏폼 탭을 누르세요</div>}
      {fired && (
        <Intervention
          variant="At"
          n={spec.n}
          onPrimary={() => { setFired(false); onAnswer(true) }}
          onSecondary={() => { setFired(false); onAnswer(true) }}
        />
      )}
      {answered && !fired && <SwipeUp tone="dark" />}
    </div>
  )
}

// ══ S3 순위 ═════════════════════════════════════════════
export function RankCard({ state, api, onAnswer, order }) {
  const picks = state.timingRank
  const toggle = (w) => {
    const next = picks.includes(w)
      ? picks.filter((x) => x !== w)
      : picks.length < 3
      ? [...picks, w]
      : picks
    api.set({ timingRank: next })
    if (next.length === 3) onAnswer(true)
  }
  const NUM = ['①', '②', '③']

  return (
    <div className="c c-paper">
      <div className="c-pad">
        <Tag step="S3" />
        <h2 className="c-q">세 시점을 마음에 드는 순서로 눌러주세요</h2>
        <p className="c-qhint">먼저 누른 것이 1순위 · 번호는 방금 겪은 순서</p>
        <div className="c-opts">
          {order.map((w) => {
            const r = picks.indexOf(w)
            const seen = order.indexOf(w)
            return (
              <button
                key={w}
                className={'rankcard' + (r >= 0 ? ' on' : '')}
                onClick={() => toggle(w)}
              >
                <span className="rank-badge">{r >= 0 ? r + 1 : '·'}</span>
                <span>
                  <b>
                    <span className="rank-seen">{NUM[seen]}</span>
                    {VARIANTS[w].shortName}
                  </b>
                  <i>{VARIANTS[w].rankDesc}</i>
                </span>
              </button>
            )
          })}
        </div>
        {picks.length > 0 && picks.length < 3 && (
          <button className="c-reset" onClick={() => api.set({ timingRank: [] })}>
            다시 매기기
          </button>
        )}
        {picks.length === 3 && <SwipeUp />}
      </div>
    </div>
  )
}

// ── S4 강도 게이지 — 칸 채우기 + n/총개수 표기 ─────────────
function IntensityGauge({ filled, total }) {
  return (
    <div className="s4-gauge">
      <div className="s4-gauge-bars">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={'s4-gauge-bar' + (i < filled ? ' filled' : '')} />
        ))}
      </div>
      <span className="s4-gauge-num">{filled} / {total}</span>
    </div>
  )
}

// ── 겪어보기 준비 중 오버레이 — S4 카드·기능 상세에서 공통 사용 ──
// 부모 요소가 position:absolute 인 컨텍스트(카드 .c, 상세 .dtl)에서 동작한다
export function SimNotReady({ onClose }) {
  return (
    <div className="sim-nr-bg" onClick={onClose}>
      <div className="sim-nr-box" onClick={(e) => e.stopPropagation()}>
        <p className="sim-nr-msg">이 기능의 시뮬레이션은 준비 중입니다.</p>
        <button className="c-ghost" onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}

// ══ 겪어보기 시뮬레이션 — 공통 껍데기 + 통과 절차 3종 ══════════
// ─────────────────────────────────────────────────────────────
// InterventionSim: 여덟 개 시뮬레이션이 공유하는 3단계 컨테이너
//   1단계 home    : MockHome — 숏폼 탭 하이라이트
//   2단계 overlay : 개입 오버레이 (children = sim 고유 내용)
//   3단계 shorts  : MockShorts + "겪어보기를 마쳤어요" 배너
//
// 닫고 다시 열면 1단계부터 (unmount/mount 로 state 리셋)
// ─────────────────────────────────────────────────────────────

// ── confirm: 의도 확인 ──────────────────────────────────────
function ConfirmSim({ onPass, onClose }) {
  return (
    <>
      <h2 className="isim-q">지금 정말 숏폼이 필요한가요?</h2>
      <div className="iv-actions">
        <button className="iv-btn" onClick={onClose}>닫기</button>
        <button className="iv-btn sub" onClick={onPass}>계속 보기</button>
      </div>
    </>
  )
}

// ── timed_wait: 사용 전 숨고르기 ───────────────────────────
const TIMED_WAIT_SEC = 10

function TimedWaitSim({ onPass, onClose }) {
  const [left, setLeft] = useState(TIMED_WAIT_SEC)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  const done = left === 0
  const pct = ((TIMED_WAIT_SEC - left) / TIMED_WAIT_SEC) * 100
  return (
    <>
      <h2 className="isim-q">잠시 멈추고<br/>숨을 고르세요</h2>
      <div className="isim-wait">
        <div className="isim-wait-bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="isim-countdown">{left > 0 ? `${left}초` : ''}</p>
      <div className="iv-actions">
        <button className="iv-btn" onClick={onClose}>닫기</button>
        <button className="iv-btn sub" onClick={onPass} disabled={!done}>계속 보기</button>
      </div>
    </>
  )
}

// ── intention_input: 사용 목적 입력 ────────────────────────
// 입력값은 state 에 저장하지 않는다. 시뮬레이션 전용 로컬 상태.
function IntentionInputSim({ onPass, onClose }) {
  const [text, setText] = useState('')
  return (
    <>
      <h2 className="isim-q">무엇을 하려고 여시나요?</h2>
      <textarea
        className="isim-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="직접 입력해보세요"
        rows={3}
        autoFocus
      />
      <div className="iv-actions">
        <button className="iv-btn" onClick={onClose}>닫기</button>
        <button className="iv-btn sub" onClick={onPass} disabled={!text.trim()}>계속 보기</button>
      </div>
    </>
  )
}

// ── 미션 계열 공통 안내 문구 (실제 조건 충족 불가한 3개에만 표시) ──
const SIM_NOTE = '실제로는 이 조건을 채워야 열립니다. 여기서는 흐름만 보여드려요'

// ── mission_hold: 버튼 5초 홀드 ────────────────────────────
// 핵심 마찰: 중간에 손을 떼면 진행이 0 으로 돌아간다.
// 원형 SVG 게이지가 버튼 주위를 감싸며 채워진다.
const HOLD_DURATION_MS = 5000
const HOLD_TICK_MS = 50
const HOLD_R = 56          // SVG 원 반지름
const HOLD_CIRCUMFERENCE = 2 * Math.PI * HOLD_R

function MissionHoldSim({ onPass, onClose }) {
  const [pct, setPct] = useState(0)
  const intervalRef = useRef(null)
  const pctRef = useRef(0)
  const passedRef = useRef(false)

  const startHold = (e) => {
    e.preventDefault()
    if (intervalRef.current || passedRef.current) return
    intervalRef.current = setInterval(() => {
      pctRef.current = Math.min(100, pctRef.current + (HOLD_TICK_MS / HOLD_DURATION_MS) * 100)
      setPct(pctRef.current)
      if (pctRef.current >= 100) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        passedRef.current = true
      }
    }, HOLD_TICK_MS)
  }

  const stopHold = () => {
    if (passedRef.current) return
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    pctRef.current = 0
    setPct(0)
  }

  useEffect(() => {
    if (pct < 100) return
    const t = setTimeout(onPass, 200)
    return () => clearTimeout(t)
  }, [pct])

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const offset = HOLD_CIRCUMFERENCE * (1 - pct / 100)

  return (
    <>
      <h2 className="isim-q">버튼을 5초간<br/>누르고 있어야 열립니다</h2>
      {/* 원형 게이지 + 홀드 버튼 */}
      <div className="hold-ring-wrap">
        <svg className="hold-ring-svg" viewBox="0 0 128 128">
          {/* 트랙 */}
          <circle cx="64" cy="64" r={HOLD_R} fill="none" stroke="var(--border)" strokeWidth="6" />
          {/* 진행 */}
          <circle
            cx="64" cy="64" r={HOLD_R}
            fill="none" stroke="var(--ink)" strokeWidth="6"
            strokeDasharray={HOLD_CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 64 64)"
          />
        </svg>
        <button
          className="hold-btn"
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          style={{ touchAction: 'none', userSelect: 'none' }}
        />
      </div>
      <div className="iv-actions">
        <button className="iv-btn" onClick={onClose}>닫기</button>
      </div>
    </>
  )
}

// ── mission_simple: 두 자리 수 덧셈 ────────────────────────
// 정답이 맞아야만 통과. intention_input 과 달리 임의 입력 불가.
function genAddProblem() {
  const a = Math.floor(Math.random() * 90) + 10 // 10~99
  const b = Math.floor(Math.random() * 90) + 10 // 10~99
  return { a, b, answer: a + b }
}

function MissionSimpleSim({ onPass, onClose }) {
  const [problem, setProblem] = useState(genAddProblem)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = () => {
    if (parseInt(input, 10) === problem.answer) {
      onPass()
    } else {
      setError(true)
      setInput('')
      setProblem(genAddProblem())
    }
  }

  return (
    <>
      <h2 className="isim-q">간단한 문제를 풀어야 열립니다</h2>
      <p className="isim-problem">{problem.a} + {problem.b} = ?</p>
      {error && <p className="isim-error">다시 시도해보세요</p>}
      <input
        className="isim-input"
        type="number"
        inputMode="numeric"
        value={input}
        onChange={(e) => { setInput(e.target.value); setError(false) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && input.trim()) handleSubmit() }}
        placeholder="정답 입력"
        autoFocus
      />
      <div className="iv-actions">
        <button className="iv-btn" onClick={onClose}>닫기</button>
        <button className="iv-btn sub" onClick={handleSubmit} disabled={!input.trim()}>확인</button>
      </div>
    </>
  )
}

// ── mission_exercise: 걸음 수 채우기 ────────────────────────
// 실제 걸음 수가 아니라 시뮬레이션. SIM_NOTE 표시.
// 4.5초에 100보 도달 (45ms 간격).
const EXERCISE_STEPS = 100
const EXERCISE_TICK_MS = 45

function MissionExerciseSim({ onPass, onClose }) {
  const [steps, setSteps] = useState(0)
  const [started, setStarted] = useState(false)
  const timerRef = useRef(null)
  const stepsRef = useRef(0)

  const startWalk = () => {
    setStarted(true)
    timerRef.current = setInterval(() => {
      stepsRef.current += 1
      setSteps(stepsRef.current)
      if (stepsRef.current >= EXERCISE_STEPS) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }, EXERCISE_TICK_MS)
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const done = steps >= EXERCISE_STEPS
  const pct = (steps / EXERCISE_STEPS) * 100
  return (
    <>
      <h2 className="isim-q">걸음 수 100보를 채워야 열립니다</h2>
      <p className="isim-sim-note">{SIM_NOTE}</p>
      <div className="isim-steps">
        <span className="isim-steps-count">{steps}</span>
        <span className="isim-steps-unit"> / {EXERCISE_STEPS} 보</span>
      </div>
      <div className="isim-wait">
        <div className="isim-wait-bar" style={{ width: `${pct}%`, transition: 'none' }} />
      </div>
      <div className="iv-actions">
        <button className="iv-btn" onClick={onClose}>닫기</button>
        {!started && <button className="iv-btn sub" onClick={startWalk}>걷기 시작</button>}
        {started && !done && <button className="iv-btn sub" disabled>걷는 중...</button>}
        {done && <button className="iv-btn sub" onClick={onPass}>계속 보기</button>}
      </div>
    </>
  )
}

// ── mission_capture: 촬영 미션 ──────────────────────────────
// 실제 카메라 권한 없음. 뷰파인더 목업 + 촬영 버튼.
function MissionCaptureSim({ onPass, onClose }) {
  const [captured, setCaptured] = useState(false)

  useEffect(() => {
    if (!captured) return
    const t = setTimeout(onPass, 700)
    return () => clearTimeout(t)
  }, [captured])

  return (
    <>
      <h2 className="isim-q">정해둔 대상을 촬영해야 열립니다</h2>
      <p className="isim-sim-note">{SIM_NOTE}</p>
      <div className="isim-viewfinder">
        <div className="isim-vf-frame" />
        {captured && <div className="isim-vf-flash" />}
      </div>
      <div className="iv-actions">
        <button className="iv-btn" onClick={onClose}>닫기</button>
        <button className="iv-btn sub" onClick={() => setCaptured(true)} disabled={captured}>
          {captured ? '촬영 완료' : '촬영'}
        </button>
      </div>
    </>
  )
}

// ── mission_altapp: 대체 활동 미션 ─────────────────────────
// 그 자리에서 겪을 수 없으므로 흐름만 보여준다. SIM_NOTE 표시.
function MissionAltappSim({ onPass, onClose }) {
  return (
    <>
      <h2 className="isim-q">미리 정해둔 앱을 5분 이상 사용해야 열립니다</h2>
      <p className="isim-sim-note">{SIM_NOTE}</p>
      <div className="isim-altapp-mock">
        <div className="isim-altapp-icon">📖</div>
        <div className="isim-altapp-label">미리 정해둔 앱</div>
      </div>
      <div className="iv-actions">
        <button className="iv-btn" onClick={onClose}>닫기</button>
        <button className="iv-btn sub" onClick={onPass}>사용했다고 가정하기</button>
      </div>
    </>
  )
}

// ══ 환경 변경 계열 시뮬레이션 — 껍데기 없이 독립 전체화면 ══════
// InterventionSim 3단계 흐름을 거치지 않는다.
// 각 컴포넌트가 자체 isim 컨테이너를 소유한다.
// ─────────────────────────────────────────────────────────────

// ── grayscale: 숏폼 선반 흑백화 ─────────────────────────────
// 처음부터 흑백으로 표시된다.
function GrayscaleSim({ onClose }) {
  const shelfStyle = { filter: 'grayscale(1)' }

  return (
    <div className="isim">
      <button className="isim-x" onClick={onClose} aria-label="닫기">✕</button>
      <div className="isim-screen">
        <MockHome shelfStyle={shelfStyle} />
        <div className="isim-env-banner">
          <p className="isim-env-msg">숏폼 썸네일이 흑백으로 표시돼요</p>
          <div className="isim-env-btns">
            <button className="iv-btn sub" onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── push_notification: 사용 푸시 알림 ──────────────────────
// 막지 않는다. 알림 배너가 뜨지만 숏폼 탭은 정상 작동한다.
function PushNotificationSim({ onClose }) {
  const [phase, setPhase] = useState('home') // 'home' | 'shorts'
  const [showBanner, setShowBanner] = useState(true)
  const [showShortsBanner, setShowShortsBanner] = useState(false)

  // 홈 화면 알림: 4초 후 자동 닫힘
  useEffect(() => {
    if (!showBanner) return
    const t = setTimeout(() => setShowBanner(false), 4000)
    return () => clearTimeout(t)
  }, [showBanner])

  // 숏폼 진입 시 알림 다시 표시
  useEffect(() => {
    if (phase !== 'shorts') return
    setShowShortsBanner(true)
    const t = setTimeout(() => setShowShortsBanner(false), 4000)
    return () => clearTimeout(t)
  }, [phase])

  return (
    <div className="isim">
      <button className="isim-x" onClick={onClose} aria-label="닫기">✕</button>
      {phase === 'home' && (
        <div className="isim-screen">
          <MockHome onShortsAccess={() => setPhase('shorts')} />
          {showBanner && (
            <div className="isim-notif" onClick={() => setShowBanner(false)}>
              <div className="isim-notif-body">
                <span className="isim-notif-app">MyTube</span>
                <span className="isim-notif-msg">오늘 숏폼을 30분 넘게 봤어요</span>
              </div>
              <button
                className="isim-notif-close"
                onClick={(e) => { e.stopPropagation(); setShowBanner(false) }}
                aria-label="알림 닫기"
              >✕</button>
            </div>
          )}
          <div className="isim-env-note">이 개입은 숏폼 탭을 막지 않아요. 탭을 눌러보세요.</div>
        </div>
      )}
      {phase === 'shorts' && (
        <div className="isim-screen">
          <MockShorts video={VIDEO_POOL[0]} interactive={false} playing={false} />
          {showShortsBanner && (
            <div className="isim-notif" onClick={() => setShowShortsBanner(false)}>
              <div className="isim-notif-body">
                <span className="isim-notif-app">MyTube</span>
                <span className="isim-notif-msg">오늘 숏폼을 30분 넘게 봤어요</span>
              </div>
              <button
                className="isim-notif-close"
                onClick={(e) => { e.stopPropagation(); setShowShortsBanner(false) }}
                aria-label="알림 닫기"
              >✕</button>
            </div>
          )}
          <div className="isim-done-banner">
            <p className="isim-done-msg">겪어보기를 마쳤어요</p>
            <button className="iv-btn" onClick={onClose}>닫기</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── redirect_productivity: 사용 경로 유도 ──────────────────
// 숏폼 탭을 눌러도 숏폼이 열리지 않고 대체 활동 제안 오버레이로 전환된다.
const REDIR_ALTS = [
  { emoji: '📧', label: '이메일', bg: '#0A84FF' },
  { emoji: '📖', label: '독서',   bg: '#FF9F0A' },
  { emoji: '🎵', label: '음악',   bg: '#BF5AF2' },
]

function RedirectProductivitySim({ onClose }) {
  const [phase, setPhase] = useState('home') // 'home' | 'redirected'

  return (
    <div className="isim">
      <button className="isim-x" onClick={onClose} aria-label="닫기">✕</button>
      {phase === 'home' && (
        <div className="isim-screen">
          <MockHome onShortsAccess={() => setPhase('redirected')} />
          <div className="isim-cue-hint">숏폼 탭을 눌러보세요</div>
        </div>
      )}
      {phase === 'redirected' && (
        <div className="isim-redir">
          <div className="isim-redir-body">
            <div className="isim-feat-badge">생산성 앱으로 이동</div>
            <h2 className="isim-redir-q">지금 정말 숏폼을<br/>봐야 하나요?</h2>
            <div className="isim-redir-apps">
              {REDIR_ALTS.map(({ emoji, label, bg }) => (
                <div key={label} className="isim-redir-app">
                  <div className="isim-redir-app-icon" style={{ background: bg }}>{emoji}</div>
                  <span className="isim-redir-app-label">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="isim-redir-btns">
            <button className="isim-redir-stop" onClick={onClose}>닫기</button>
            <button className="isim-redir-cont" onClick={onClose}>계속 보기</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── hard_block: 완전 차단 전용 화면 ────────────────────────
// 숏폼을 아예 못 보게 막으므로 닫기는 onClose(시뮬 종료)를 호출.
function HardBlockSim({ onClose }) {
  return (
    <>
      <h2 className="isim-q">숏폼이 차단되었습니다</h2>
      <div className="iv-actions">
        <button className="iv-btn" onClick={onClose}>닫기</button>
      </div>
    </>
  )
}

// sim id → 오버레이 내용 컴포넌트 (InterventionSim 2단계에서 렌더됨)
const SIM_COMPONENTS = {
  confirm: ConfirmSim,
  timed_wait: TimedWaitSim,
  intention_input: IntentionInputSim,
  mission_hold: MissionHoldSim,
  mission_simple: MissionSimpleSim,
  mission_exercise: MissionExerciseSim,
  mission_capture: MissionCaptureSim,
  mission_altapp: MissionAltappSim,
  hard_block: HardBlockSim,
}

// 환경 변경 계열 — InterventionSim 껍데기 없이 직접 전체화면 렌더
const ENV_SIM_COMPONENTS = {
  grayscale: GrayscaleSim,
  push_notification: PushNotificationSim,
  redirect_productivity: RedirectProductivitySim,
}

// ── 공통 껍데기 ────────────────────────────────────────────
export function InterventionSim({ simId, featureName, onClose }) {
  const [phase, setPhase] = useState('home') // 'home' | 'overlay' | 'shorts'
  const SimContent = SIM_COMPONENTS[simId]
  // 환경 변경 계열은 자체 전체화면 컴포넌트로 전달 (hooks 이후에 분기)
  const EnvSim = ENV_SIM_COMPONENTS[simId]
  if (EnvSim) return <EnvSim onClose={onClose} />

  return (
    <div className="isim">
      <button className="isim-x" onClick={onClose} aria-label="닫기">✕</button>

      {/* 1단계: MockHome — 숏폼 탭 하이라이트 (S1 selectable 없음) */}
      {phase === 'home' && (
        <div className="isim-screen">
          <MockHome onShortsAccess={() => setPhase('overlay')} />
          <div className="isim-cue-hint">아래 숏폼 탭을 눌러보세요</div>
        </div>
      )}

      {/* 2단계: 개입 오버레이 */}
      {phase === 'overlay' && (
        <div className="isim-ov">
          <div className="isim-feat-badge">{featureName}</div>
          {SimContent
            ? <SimContent onPass={() => setPhase('shorts')} onClose={onClose} />
            : <SimNotReady onClose={onClose} />
          }
        </div>
      )}

      {/* 3단계: 숏폼 화면 + 완료 배너 */}
      {phase === 'shorts' && (
        <div className="isim-screen">
          <MockShorts video={VIDEO_POOL[0]} interactive={false} playing={false} />
          <div className="isim-done-banner">
            <p className="isim-done-msg">겪어보기를 마쳤어요</p>
            <button className="iv-btn" onClick={onClose}>닫기</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ══ S4 강도 (카드 하나 = 판단 한 번) ════════════════════
// S4 공통 버튼 문구 — IntensityCard 계열 2단 버튼용 (O/X 카드는 3단이므로 아래 OXRow를 볼 것)
const S4_REJECT = '과해요'
const S4_ACCEPT = '괜찮아요'

// enforcement 레벨 id → { nameKo, microcopy } 조회 맵
const ENF_BY_ID = Object.fromEntries(ENFORCEMENT.map((e) => [e.id, e]))

// 겪어보기 시뮬레이션이 준비된 unit — E2·E3 상호작용 과제만
// u05: One-Tap / Soft Timer  u06: Math Task  u07: Breathing  u08: Physical Action
const HAS_SIM = new Set(['u05', 'u06', 'u07', 'u08'])

// onAccept / onReject : 상태 갱신만, answer(cid) 호출 없음
// onConfirm           : SwipeUp 탭 → answer(cid) + 다음 카드 스크롤
export function IntensityCard({ spec, onAccept, onReject, onConfirm }) {
  const [localPick, setLocalPick] = useState(null) // 'accepted' | 'rejected' | null
  const [showSim, setShowSim] = useState(false)
  const cardRef = useRef(null)

  const enf = ENF_BY_ID[spec.level] ?? {}
  const isSearch = spec.phase === 'search'
  const isBranch = spec.phase === 'floor2' && spec.branch
  const hasSim = HAS_SIM.has(spec.unitId)

  const question = isSearch
    ? `"${enf.nameKo ?? spec.level}" 수준의 개입을 받아들일 수 있나요?`
    : isBranch
    ? '이 방식의 개입을 받아들일 수 있나요?'
    : '이 방법은 어떤가요?'

  const tagN = isSearch ? `탐색 ${spec.searchRound}회` : '세부 확인'

  const handleAccept = () => {
    setLocalPick('accepted')
    onAccept()
  }
  const handleReject = () => {
    setLocalPick('rejected')
    onReject()
  }
  const handleConfirm = () => {
    onConfirm()
    setTimeout(() => {
      const slot = cardRef.current?.closest('[data-cid]')
      slot?.nextElementSibling?.scrollIntoView({ behavior: 'smooth' })
    }, 150)
  }

  return (
    <div className="c c-paper" ref={cardRef}>
      <div className="c-pad">
        <Tag step="S4" n={tagN} />
        <div className="enf-badge">{enf.nameKo ?? spec.level}</div>
        <h2 className="c-q">{question}</h2>
        {enf.ko && <p className="c-p">{enf.ko}</p>}

        {/* 겪어보기 버튼 — spec.sim 이 지정된 카드에만 표시 */}
        {spec.sim && (hasSim
          ? <button className="c-sim-btn" onClick={() => setShowSim(true)}>겪어보기</button>
          : <button className="c-sim-btn" disabled>준비 중</button>
        )}

        {/* 수락·거부 버튼 — 항상 표시, 선택 후 .picked 클래스 */}
        <div className="yesno">
          <button
            className={'yesno-btn yesno-btn--reject' + (localPick === 'rejected' ? ' picked' : '')}
            onClick={handleReject}
          >{S4_REJECT}</button>
          <button
            className={'yesno-btn yesno-btn--accept' + (localPick === 'accepted' ? ' picked' : '')}
            onClick={handleAccept}
          >{S4_ACCEPT}</button>
        </div>

        {/* 선택 후 SwipeUp 노출 — 탭하면 다음 카드 확정·스크롤 */}
        {localPick && <SwipeUp onClick={handleConfirm} />}
      </div>

      {/* 겪어보기 오버레이 */}
      {showSim && (
        hasSim
          ? <InterventionSim simId={spec.sim} featureName={enf.nameKo ?? spec.level} onClose={() => setShowSim(false)} />
          : <SimNotReady onClose={() => setShowSim(false)} />
      )}
    </div>
  )
}

// ══ S4-A 개별 문항 (LADDER_INDIVIDUAL L1~L3) ══════════════
// onAnswer: SwipeUp 탭 → answer(cid) 호출 (특수 effect가 다음 카드 주입)
export function IntensityIndivCard({ spec, state, api, onAnswer }) {
  const [localPick, setLocalPick] = useState(null) // 'accepted' | 'rejected' | null
  const [showSim, setShowSim] = useState(false)
  const cardRef = useRef(null)
  const item = spec.item
  const hasSim = SIMULATIONS[item.sim] !== null

  // 설명: featureIds[0] 기준. resolveBy: timing 항목은 첫 번째 featureId 사용.
  const desc = description({ code: item.featureIds?.[0] ?? '' })

  const handlePick = (accepted) => {
    setLocalPick(accepted ? 'accepted' : 'rejected')
    api.set({ individualAccepted: { ...state.individualAccepted, [item.id]: accepted } })
  }

  const handleConfirm = () => {
    onAnswer()
    setTimeout(() => {
      const slot = cardRef.current?.closest('[data-cid]')
      slot?.nextElementSibling?.scrollIntoView({ behavior: 'smooth' })
    }, 150)
  }

  return (
    <div className="c c-paper" ref={cardRef}>
      <div className="c-pad">
        <Tag step="S4" n="개별 문항" />
        <h2 className="c-q">{item.nameKo}</h2>
        {desc && <p className="c-p">{desc}</p>}

        {/* 겪어보기 — 항상 표시. sim 없으면 누를 때 준비 중 오버레이 */}
        <button className="c-sim-btn" onClick={() => setShowSim(true)}>겪어보기</button>

        <div className="yesno">
          <button
            className={'yesno-btn yesno-btn--reject' + (localPick === 'rejected' ? ' picked' : '')}
            onClick={() => handlePick(false)}
          >{S4_REJECT}</button>
          <button
            className={'yesno-btn yesno-btn--accept' + (localPick === 'accepted' ? ' picked' : '')}
            onClick={() => handlePick(true)}
          >{S4_ACCEPT}</button>
        </div>

        {localPick && <SwipeUp onClick={handleConfirm} />}
      </div>

      {showSim && (
        hasSim
          ? <InterventionSim simId={item.sim} featureName={item.nameKo} onClose={() => setShowSim(false)} />
          : <SimNotReady onClose={() => setShowSim(false)} />
      )}
    </div>
  )
}

// ══ S4-B 이분 탐색 카드 (LADDER_RUNGS, 동적 주입) ══════════
// spec.rung: LADDER_RUNGS 의 해당 rung 객체
// handlePick 이 ladderProbes 를 갱신하고, onAnswer 로 effect 트리거
export function IntensitySearchCard({ spec, state, api, onAnswer }) {
  const [localPick, setLocalPick] = useState(null) // 'accepted' | 'rejected' | null
  const [showSim, setShowSim] = useState(false)
  const cardRef = useRef(null)
  const rung = spec.rung
  const hasSim = SIMULATIONS[rung.sim] !== null

  const desc = description({ code: rung.featureIds?.[0] ?? '' })

  const handlePick = (accepted) => {
    setLocalPick(accepted ? 'accepted' : 'rejected')
    const existing = state.ladderProbes ?? []
    const idx = existing.findIndex((p) => p.order === rung.order)
    // 번복 시 해당 위치까지 잘라내고 교체 — 이후 기록은 무효이므로 폐기
    const newProbes = idx >= 0
      ? [...existing.slice(0, idx), { order: rung.order, accepted }]
      : [...existing, { order: rung.order, accepted }]
    api.set({ ladderProbes: newProbes })
  }

  const handleConfirm = () => {
    onAnswer()
    setTimeout(() => {
      const slot = cardRef.current?.closest('[data-cid]')
      slot?.nextElementSibling?.scrollIntoView({ behavior: 'smooth' })
    }, 150)
  }

  return (
    <div className="c c-paper" ref={cardRef}>
      <div className="c-pad">
        <Tag step="S4" n="강도 탐색" />
        <h2 className="c-q">{rung.nameKo}</h2>
        {desc && <p className="c-p">{desc}</p>}

        {/* 겪어보기 — 항상 표시. sim 없으면 누를 때 준비 중 오버레이 */}
        <button className="c-sim-btn" onClick={() => setShowSim(true)}>겪어보기</button>

        <div className="yesno">
          <button
            className={'yesno-btn yesno-btn--reject' + (localPick === 'rejected' ? ' picked' : '')}
            onClick={() => handlePick(false)}
          >{S4_REJECT}</button>
          <button
            className={'yesno-btn yesno-btn--accept' + (localPick === 'accepted' ? ' picked' : '')}
            onClick={() => handlePick(true)}
          >{S4_ACCEPT}</button>
        </div>

        {localPick && <SwipeUp onClick={handleConfirm} />}
      </div>

      {showSim && (
        hasSim
          ? <InterventionSim simId={rung.sim} featureName={rung.nameKo} onClose={() => setShowSim(false)} />
          : <SimNotReady onClose={() => setShowSim(false)} />
      )}
    </div>
  )
}

// ── S5 공통 — 팝업 이미지 (로딩 실패 시 이모지 대체) ──
function ScenarioImage({ sc }) {
  const [err, setErr] = useState(false)
  if (err) return <div className="sc-popup-icon-fb">{sc.icon}</div>
  return (
    <img
      className="sc-popup-img"
      src={sc.image}
      alt=""
      onError={() => setErr(true)}
    />
  )
}

// ══ S5-1 우회 상황 선택 ══════════════════════════════════
export function BypassScenarioCard({ state, api, onAnswer }) {
  const [popup, setPopup] = useState(null) // 팝업에 열린 시나리오 id
  const selected = state.bypassScenario

  const handleConfirm = (sc) => {
    api.set({ bypassScenario: sc.id })
    setPopup(null)
    onAnswer()
  }

  return (
    <div className="c c-paper">
      <div className="c-pad">
        <Tag step="S5" />
        <p className="s5-guide">
          당신은 다음의 상황에서 개입을 우회하여 숏폼 비디오를 시청하고 싶은 충동에
          휩싸였습니다. 숏폼 비디오 시청이 아예 차단된 기기 상태에서 다음의 상황에
          직면한 당신이 숏폼 비디오를 시청하기 위해 어떤 행동을 할지 상상해보세요
        </p>
        <h2 className="c-q">다음 중 숏폼 우회 시청을 정당화할 상황으로 가장 공감되는 시나리오를 하나 선택해주세요</h2>
        <div className="sc-list">
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              className={'sc-item' + (selected === sc.id ? ' selected' : '')}
              onClick={() => setPopup(sc.id)}
            >
              <span className="sc-item-icon">{sc.icon}</span>
              <span className="sc-item-name">{sc.name}</span>
              <span className="sc-item-chevron">›</span>
            </button>
          ))}
        </div>
      </div>

      {/* 시나리오 상세 팝업 — 배경 클릭 or 닫기 버튼으로 닫힘 (선택 안 됨) */}
      {popup && (() => {
        const sc = SCENARIOS.find((s) => s.id === popup)
        return (
          <div className="sc-popup" onClick={() => setPopup(null)}>
            <div className="sc-popup-body" onClick={(e) => e.stopPropagation()}>
              {/* 스크롤 가능 영역: 이미지 + 텍스트 */}
              <div className="sc-popup-scroll">
                <ScenarioImage sc={sc} />
                <div className="sc-popup-text">
                  <div className="sc-popup-name">{sc.name}</div>
                  <p className="sc-popup-desc">{sc.desc}</p>
                </div>
              </div>
              {/* 고정 하단: 버튼 영역 — 스크롤과 무관하게 항상 보임 */}
              <div className="sc-popup-footer">
                <button className="c-start" onClick={() => handleConfirm(sc)}>이 상황으로 하기</button>
                <button className="c-ghost" onClick={() => setPopup(null)}>닫기</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── S5 공통 선택 항목 레이블 ──
export const BYPASS_OPTS = [
  { id: 'B1', label: '차단 개입 설정 변경: 해제, 차단 시간대 변경 등' },
  { id: 'B2', label: '기기 시스템 설정에서 권한 삭제, 시스템 시간대 변경 등' },
  { id: 'B3', label: '자기 통제 앱 설치 삭제' },
  { id: 'B4', label: '작은 창이나 화면 분할로 보는 것' },
]

// ══ S5-2 우회 방법 복수 선택 ══════════════════════════════
export function BypassSelectCard({ state, api, onAnswer, answered }) {
  const sc = SCENARIO_BY_ID[state.bypassScenario] ?? null
  const methods = state.bypassMethods ?? {}
  const cardRef = useRef(null)
  const handleSwipeRef = useRef(null)

  const toggle = (id) => {
    api.set({ bypassMethods: { ...methods, [id]: !methods[id] } })
  }

  const handleSwipe = () => {
    // 선택되지 않은 항목은 false 로 확정 (미응답과 거부 구분 없음)
    const full = Object.fromEntries(BYPASS_OPTS.map(({ id }) => [id, methods[id] === true]))
    api.set({ bypassMethods: full })
    onAnswer()
  }
  handleSwipeRef.current = handleSwipe

  // wheel(트랙패드) + touch(모바일) 위로 스와이프 감지 → handleSwipe 호출
  // 다음 카드가 없으면 deck scroll-snap이 동작 불가 → JS로 직접 감지 필요
  useEffect(() => {
    if (answered) return
    const el = cardRef.current
    if (!el) return
    let triggered = false

    const onWheel = (e) => {
      if (e.deltaY > 0 && !triggered) {
        e.preventDefault()
        triggered = true
        handleSwipeRef.current()
      }
    }

    let startY = 0
    const onTouchStart = (e) => { startY = e.touches[0].clientY }
    const onTouchEnd = (e) => {
      if (startY - e.changedTouches[0].clientY > 30 && !triggered) {
        triggered = true
        handleSwipeRef.current()
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [answered])

  return (
    <div className="c c-paper" ref={cardRef}>
      <div className="c-pad" style={answered ? { overflowY: 'hidden' } : undefined}>
        <Tag step="S5" />
        {sc && (
          <div className="scene">
            <div className="scene-tag">{sc.icon} {sc.name}</div>
            <p className="scene-text">{sc.desc}</p>
          </div>
        )}
        <h2 className="c-q">이 상황에서 차단 기능을 피하기 위해 어떤 방법을 선택하실 것 같으세요?</h2>
        <p className="c-p">복수 선택 가능</p>
        <div className="c-opts">
          {BYPASS_OPTS.map(({ id, label }) => (
            <button
              key={id}
              className={'c-opt' + (methods[id] ? ' on' : '')}
              onClick={() => toggle(id)}
            >
              <span className="c-box">{methods[id] ? '✓' : ''}</span>
              {label}
            </button>
          ))}
        </div>
        {!answered && <SwipeUp onClick={handleSwipe} />}
        {answered && <SwipeUp />}
      </div>
    </div>
  )
}

// ══ S4 (자율 탐색 구조) ══════════════════════════════════

// ── 탐색 패널 내부: rung 한 행 ─────────────────────────
// onSim: 겪어보기 클릭 시 부모(S4AgencyDetail)에 rung 전달 — iOS 스태킹 문제 방지
function RungRow({ rung, state, api, gaugeFilled, gaugeTotal, onSim }) {
  const hasSim = rung.sim && SIMULATIONS[rung.sim] !== null
  const desc = description({ code: rung.resolve?.fixed ?? rung.id })

  const handleSim = () => {
    const played = state.simsPlayed ?? []
    api.set({ simsPlayed: [...played, rung.sim] })
    onSim(rung, hasSim)
  }

  return (
    <div className="s4-rung">
      {gaugeTotal && <IntensityGauge filled={gaugeFilled} total={gaugeTotal} />}
      <div className="s4-rung-name">{rung.nameKo}</div>
      {desc && <div className="s4-rung-desc">{desc}</div>}
      <button className="c-sim-btn" onClick={handleSim}>겪어보기</button>
    </div>
  )
}

// ── 탐색 패널 내부: agency 레벨 상세 화면 ──────────────
function S4AgencyDetail({ level, state, api, onBack }) {
  const [activeSim, setActiveSim] = useState(null) // { rung, hasSim } | null
  const rungs = (RUNGS_BY_AGENCY[level.id] ?? [])
    .filter((r) => r.exploreVisible)
    .sort((a, b) => a.order - b.order)

  // limited는 항목이 하나뿐이므로 게이지 미표시
  const showGauge = level.id !== 'limited' && rungs.length > 1

  return (
    <div className="dtl">
      <div className="dtl-nav">
        <button className="dtl-back" onClick={onBack}>‹ 레벨 목록</button>
        <span className="dtl-nav-title">{level.nameKo}</span>
      </div>
      <div className="dtl-body">
        <div className="s4-panel-body">
          <p className="s4-panel-example">{level.example}</p>
          <div className="dtl-sec-h">이 레벨의 개입 방식</div>
          <div className="s4-rung-list">
            {rungs.map((rung, idx) => (
              <RungRow
                key={rung.id}
                rung={rung}
                state={state}
                api={api}
                gaugeFilled={showGauge ? idx + 1 : undefined}
                gaugeTotal={showGauge ? rungs.length : undefined}
                onSim={(r, hasSim) => setActiveSim({ rung: r, hasSim })}
              />
            ))}
          </div>
        </div>
      </div>
      {/* iOS stacking context 우회: .dtl-body overflow-y:auto 밖에서 렌더 */}
      {activeSim && (
        activeSim.hasSim
          ? <InterventionSim simId={activeSim.rung.sim} featureName={activeSim.rung.nameKo} onClose={() => setActiveSim(null)} />
          : <SimNotReady onClose={() => setActiveSim(null)} />
      )}
    </div>
  )
}

// ── 탐색 오버레이 (Deck.jsx에서 렌더링) ────────────────
// position:absolute; inset:0 으로 .viewport 전체 덮음 (.dtl CSS 재사용)
export function S4ExplorePanel({ state, api, onClose, onDone }) {
  const [view, setView] = useState('list') // 'list' | 'detail'
  const [currentLevel, setCurrentLevel] = useState(null)
  const canFinish = canProceedFromExplore(state)

  const openLevel = (level) => {
    const visited = state.agencyVisited ?? []
    if (!visited.includes(level.id)) {
      api.set({ agencyVisited: [...visited, level.id] })
    }
    setCurrentLevel(level)
    setView('detail')
  }

  if (view === 'detail' && currentLevel) {
    return (
      <S4AgencyDetail
        level={currentLevel}
        state={state}
        api={api}
        onBack={() => setView('list')}
      />
    )
  }

  return (
    <div className="dtl">
      <div className="dtl-nav">
        <button className="dtl-back" onClick={onClose}>‹ 돌아가기</button>
        <span className="dtl-nav-title">개입 레벨 탐색</span>
      </div>
      <div className="dtl-body">
        <div className="s4-panel-body">
          <p className="s4-panel-intro">
            두 가지 이상 탐색하면 다음 단계로 넘어갈 수 있습니다.
          </p>
          <div className="s4-level-list">
            {AGENCY_LEVELS.map((level, idx) => {
              const visited = (state.agencyVisited ?? []).includes(level.id)
              const total = AGENCY_LEVELS.length
              return (
                <button
                  key={level.id}
                  className={'s4-level-btn' + (visited ? ' visited' : '')}
                  onClick={() => openLevel(level)}
                >
                  <div className="s4-level-row-top">
                    <span className="s4-level-name">{level.nameKo}</span>
                    {visited && <span className="s4-level-badge">✓ 탐색함</span>}
                  </div>
                  <IntensityGauge filled={idx + 1} total={total} />
                  <span className="s4-level-example">{level.example}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {canFinish && (
        <div className="s4-panel-footer">
          <button className="c-start" style={{ marginTop: 0 }} onClick={onDone}>
            탐색 완료
          </button>
        </div>
      )}
    </div>
  )
}

// ── Card A: 탐색 진입 ───────────────────────────────────
export function S4ExploreCard({ state, api, answered, onAnswer, onOpenExplore }) {
  const canProceed = canProceedFromExplore(state)
  const visitedCount = (state.agencyVisited ?? []).length

  return (
    <div className="c c-paper">
      <div className="c-pad">
        <Tag step="S4" />
        <h2 className="c-q">개입 레벨을 직접 탐색해보세요</h2>
        <p className="c-p">
          자기통제 앱의 개입 강도에는 세 가지 레벨이 있습니다. 각 레벨을 살펴보고
          어떤 방식이 자신에게 맞는지 확인해보세요.
        </p>
        {visitedCount > 0 && (
          <p className="c-note-sm">
            탐색한 레벨 {visitedCount} / 3
            {canProceed ? ' · 충분합니다, 계속 탐색하거나 아래로 넘어가세요' : ' · 하나 더 탐색하세요'}
          </p>
        )}
        <button className="c-start" onClick={onOpenExplore}>
          {visitedCount === 0 ? '탐색하기' : '계속 탐색하기'}
        </button>
        {canProceed && !answered && <SwipeUp onClick={onAnswer} />}
        {answered && <SwipeUp />}
      </div>
    </div>
  )
}

// ── Card B: 레벨 순위 매기기 ───────────────────────────
export function S4RankCard({ state, api, answered, onAnswer }) {
  const picks = state.agencyRank ?? []

  const toggle = (id) => {
    const next = picks.includes(id)
      ? picks.filter((x) => x !== id)
      : picks.length < 3
      ? [...picks, id]
      : picks
    api.set({ agencyRank: next })
    if (next.length === 3) onAnswer()
  }

  return (
    <div className="c c-paper">
      <div className="c-pad">
        <Tag step="S4" />
        <h2 className="c-q">마음에 드는 순서로 눌러주세요</h2>
        <p className="c-qhint">먼저 누른 것이 1순위</p>
        <div className="c-opts">
          {AGENCY_LEVELS.map((level) => {
            const r = picks.indexOf(level.id)
            return (
              <button
                key={level.id}
                className={'rankcard' + (r >= 0 ? ' on' : '')}
                onClick={() => toggle(level.id)}
              >
                <span className="rank-badge">{r >= 0 ? r + 1 : '·'}</span>
                <span>
                  <b>{level.nameKo}</b>
                  <i>{level.example}</i>
                </span>
              </button>
            )
          })}
        </div>
        {picks.length > 0 && picks.length < 3 && (
          <button className="c-reset" onClick={() => api.set({ agencyRank: [] })}>
            다시 매기기
          </button>
        )}
        {picks.length === 3 && <SwipeUp />}
      </div>
    </div>
  )
}

// ── O/X 행 (3단 척도: 약해요 / 괜찮아요 / 과해요) ─────────────────────────
// val: 'weak' | 'ok' | 'strong' | undefined
function OXRow({ rung, val, onWeak, onOk, onStrong }) {
  const [showSim, setShowSim] = useState(false)
  const hasSim = rung.sim && SIMULATIONS[rung.sim] !== null
  return (
    <div className="s4-ox-row">
      <div className="s4-ox-name-row">
        <div className="s4-rung-name">{rung.nameKo}</div>
        <button className="s4-ox-replay-btn" onClick={() => setShowSim(true)}>↺ 다시 겪어보기</button>
      </div>
      <div className="yesno yesno--3">
        <button
          className={'yesno-btn yesno-btn--weak' + (val === 'weak' ? ' picked' : '')}
          onClick={onWeak}
        >약해요</button>
        <button
          className={'yesno-btn yesno-btn--ok' + (val === 'ok' ? ' picked' : '')}
          onClick={onOk}
        >괜찮아요</button>
        <button
          className={'yesno-btn yesno-btn--strong' + (val === 'strong' ? ' picked' : '')}
          onClick={onStrong}
        >과해요</button>
      </div>
      {showSim && (
        hasSim
          ? <InterventionSim simId={rung.sim} featureName={rung.nameKo} onClose={() => setShowSim(false)} />
          : <SimNotReady onClose={() => setShowSim(false)} />
      )}
    </div>
  )
}

// ── Card C: 레벨별 기능 O/X (1순위 필수 / 비1순위 건너뛰기 가능) ──
export function S4OXCard({ spec, state, api, answered, onAnswer }) {
  const { agencyId, isPrimary } = spec
  const rungs = rungsForOX(state, agencyId)
  const accepted = state.featureAccepted ?? {}
  const cardRef = useRef(null)
  const padRef = useRef(null)
  const onAnswerRef = useRef(onAnswer)
  onAnswerRef.current = onAnswer

  const allAnswered = rungs.length > 0 && rungs.every((r) => accepted[r.id] !== undefined)

  // 모든 항목이 채워지면 → c-pad 맨 아래로 스크롤해 SwipeUp 표시 → 400ms 후 answer 처리
  useEffect(() => {
    if (allAnswered && !answered) {
      padRef.current?.scrollTo({ top: padRef.current.scrollHeight, behavior: 'smooth' })
      setTimeout(() => onAnswerRef.current(), 400)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered, answered])

  const setAccepted = (id, val) => {
    api.set({ featureAccepted: { ...accepted, [id]: val } })
  }

  // 건너뛰기 — oxSkipped 에 기록하고 다음 카드로 즉시 스크롤 (비1순위 카드만)
  const handleSkip = () => {
    const skipped = state.oxSkipped ?? []
    if (!skipped.includes(agencyId)) {
      api.set({ oxSkipped: [...skipped, agencyId] })
    }
    onAnswer()
    setTimeout(() => {
      const slot = cardRef.current?.closest('[data-cid]')
      slot?.nextElementSibling?.scrollIntoView({ behavior: 'smooth' })
    }, 150)
  }

  return (
    <div className="c c-paper" ref={cardRef}>
      <div className="c-pad" ref={padRef} style={answered ? { overflowY: 'hidden' } : undefined}>
        <Tag step="S4" />
        {!isPrimary && (
          <div className="s4-ox-secondary-header">
            <p className="c-p" style={{ margin: '0 0 10px' }}>
              1순위로 고르지는 않았지만 살펴보신 방식이에요. 판단이 어려우면 건너뛰어도 됩니다.
            </p>
            {!answered && (
              <button className="s4-ox-skip-btn" onClick={handleSkip}>
                이 방식은 건너뛰기 →
              </button>
            )}
          </div>
        )}
        <h2 className="c-q">각 방식이 나에게 어떤가요?</h2>
        <p className="c-qhint">방식마다 하나씩 골라주세요</p>
        <div className="s4-ox-list">
          {rungs.map((rung) => (
            <OXRow
              key={rung.id}
              rung={rung}
              val={accepted[rung.id]}
              onWeak={()   => setAccepted(rung.id, 'weak')}
              onOk={()     => setAccepted(rung.id, 'ok')}
              onStrong={()  => setAccepted(rung.id, 'strong')}
            />
          ))}
        </div>
        {allAnswered && !answered && <SwipeUp onClick={onAnswer} />}
        {answered && <SwipeUp />}
      </div>
    </div>
  )
}

// ══ S5-3 우회 차단 선호 ══════════════════════════════════
export function BypassWantedCard({ state, api, onAnswer, answered }) {
  const methods = state.bypassMethods ?? {}
  const wanted = state.bypassWanted ?? {}

  // 두 번째 카드에서 선택된 항목만 표시
  const selected = BYPASS_OPTS.filter(({ id }) => methods[id] === true)

  const setWanted = (id, val) => {
    api.set({ bypassWanted: { ...wanted, [id]: val } })
  }

  // 모든 표시 항목에 예/아니오가 선택됐을 때 SwipeUp 활성화
  const allAnswered = selected.length > 0 && selected.every(({ id }) => wanted[id] !== undefined)

  const onAnswerRef = useRef(onAnswer)
  onAnswerRef.current = onAnswer

  // 모든 항목이 채워지면 즉시 answer 처리 — SwipeUp 클릭 없이 바로 swipe 가능
  useEffect(() => {
    if (allAnswered && !answered) onAnswerRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered, answered])

  return (
    <div className="c c-paper">
      <div className="c-pad" style={answered ? { overflowY: 'hidden' } : undefined}>
        <Tag step="S5" />
        <h2 className="c-q">그럼 그 우회 선택지가 차단되어 있기를 바라나요?</h2>
        <div className="bpw-list">
          {selected.map(({ id, label }) => (
            <div key={id} className="bpw-item">
              <div className="bpw-label">{label}</div>
              <div className="yesno">
                <button
                  className={'yesno-btn' + (wanted[id] === false ? ' picked' : '')}
                  onClick={() => setWanted(id, false)}
                >괜찮아요</button>
                <button
                  className={'yesno-btn' + (wanted[id] === true ? ' picked' : '')}
                  onClick={() => setWanted(id, true)}
                >차단해요</button>
              </div>
            </div>
          ))}
        </div>
        {allAnswered && !answered && <SwipeUp onClick={onAnswer} />}
        {answered && <SwipeUp />}
      </div>
    </div>
  )
}
