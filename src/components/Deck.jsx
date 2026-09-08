import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildScript, FIXED_ORDER } from '../deck.js'
import { oxTargets } from '../store.js'
import { VIDEO_POOL, shuffled } from '../data/videos.js'
import { platformIconPath } from '../data/apps.js'
import ResultCard from './ResultCard.jsx'
import {
  BypassScenarioCard,
  BypassSelectCard,
  BypassWantedCard,
  IntroCard,
  MultiCard,
  NoteCard,
  RankCard,
  S4ExploreCard,
  S4ExplorePanel,
  S4OXCard,
  S4RankCard,
  ScheduleCard,
  ScheduleTypeCard,
  ScopeHomeCard,
  ScopeShortsCard,
  SimIntroCard,
  SimSceneCard,
} from './Cards.jsx'

// ─────────────────────────────────────────────────────────────
// 하나의 scroll-snap 피드가 설문 전체다.
// 답을 하면 아래에 카드가 하나 생긴다 → 위로 밀어서 넘어간다.
// 아직 안 답한 질문 아래로는 카드가 없으므로 그냥 넘길 수 없다.
// (스크롤을 막는 게 아니라, 넘길 대상이 아직 존재하지 않는 방식)
// ─────────────────────────────────────────────────────────────

export default function Deck({ state, api, jumpTo, onMeta, onOpenDetail }) {
  const script = useMemo(() => buildScript(), [])

  // 고정 제시 순서를 기록
  useEffect(() => {
    api.set({ timingSeen: FIXED_ORDER })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const videos = useMemo(() => shuffled(VIDEO_POOL, 42), [])

  const [cards, setCards] = useState(() => [{ ...script[0], cid: 'c0' }])
  const [answered, setAnswered] = useState({})
  const [active, setActive] = useState(0)
  const cursor = useRef(1) // script 내 다음 위치
  const seq = useRef(1)
  const scroller = useRef(null)

  // S4 레벨 순위 결정 후 s4-ox 조건부 주입 대기열
  const s4RankQueue = useRef([])
  // S4 탐색 오버레이 열림 상태
  const [s4ExploreOpen, setS4ExploreOpen] = useState(false)

  // S2 시계 카드 대기열 (dayType에 따라 0·1·2장)
  const clockQueue = useRef([])

  // S5 bypass-wanted 대기열 (bypassMethods에 true 항목이 있을 때만 1장)
  const bypassQueue = useRef([])

  // 최신 state를 항상 참조 (append 시점의 stale closure 방지)
  const stateRef = useRef(state)
  stateRef.current = state

  const mk = (spec) => ({ ...spec, cid: 'c' + seq.current++ })

  const pushNextFromScript = useCallback(() => {
    // S2 시계 카드가 대기 중이면 먼저 소진
    if (clockQueue.current.length > 0) {
      const next = clockQueue.current.shift()
      setCards((c) => [...c, mk(next)])
      return
    }

    // S4 s4-ox 카드가 대기 중이면 먼저 소진
    if (s4RankQueue.current.length > 0) {
      const next = s4RankQueue.current.shift()
      setCards((c) => [...c, mk(next)])
      return
    }

    // S5 bypass-wanted 카드가 대기 중이면 먼저 소진
    if (bypassQueue.current.length > 0) {
      const next = bypassQueue.current.shift()
      setCards((c) => [...c, mk(next)])
      return
    }

    const spec = script[cursor.current]
    if (!spec) return
    cursor.current += 1

    if (spec.type === 'intensity') {
      // S4 카드 시퀀스 — 다음 단계(Deck 재설계)에서 구현 예정
      setCards((c) => [...c, mk(spec)])
      return
    }
    setCards((c) => [...c, mk(spec)])
  }, [script])

  // 카드가 답을 받았을 때
  const answer = useCallback(
    (cid) => {
      setAnswered((a) => (a[cid] ? a : { ...a, [cid]: true }))
    },
    []
  )

  // answered 변화를 보고, 마지막 카드가 답해졌으면 다음 카드 생성
  useEffect(() => {
    const last = cards[cards.length - 1]
    if (!last) return
    if (last.type === 'result') return
    if (last.type === 'schedule-type') return // 시계 주입은 아래 effect에서 처리
    if (last.type === 'bypass-select') return  // bypass-wanted 주입은 아래 effect에서 처리
    if (last.type === 's4-rank') return        // s4-ox 주입은 아래 effect에서 처리
    if (answered[last.cid]) pushNextFromScript()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, cards.length])

  // schedule-type 답변 후 dayType에 따라 시계 카드 주입
  useEffect(() => {
    const last = cards[cards.length - 1]
    if (!last || last.type !== 'schedule-type') return
    if (!answered[last.cid]) return
    const dayType = stateRef.current.dayType
    if (dayType === 'daily') {
      clockQueue.current = [{ type: 'schedule', step: 'S2', hoursKey: 'daily', title: '시간대 지정 (매일)' }]
    } else if (dayType === 'split') {
      clockQueue.current = [
        { type: 'schedule', step: 'S2', hoursKey: 'weekday', title: '시간대 지정 (평일)' },
        { type: 'schedule', step: 'S2', hoursKey: 'weekend', title: '시간대 지정 (주말)' },
      ]
    } else {
      clockQueue.current = []
    }
    pushNextFromScript()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, cards.length])

  // bypass-select 답변 후 bypassMethods 에 따라 bypass-wanted 카드 주입
  useEffect(() => {
    const last = cards[cards.length - 1]
    if (!last || last.type !== 'bypass-select') return
    if (!answered[last.cid]) return
    const methods = stateRef.current.bypassMethods ?? {}
    const hasAny = Object.values(methods).some(Boolean)
    if (hasAny) {
      bypassQueue.current = [{ type: 'bypass-wanted', step: 'S5', title: '우회 차단 선호' }]
    } else {
      bypassQueue.current = []
    }
    pushNextFromScript()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, cards.length])

  // s4-rank 답변 후 oxTargets 기반으로 s4-ox 카드를 순서대로 대기열에 등록
  useEffect(() => {
    const last = cards[cards.length - 1]
    if (!last || last.type !== 's4-rank') return
    if (!answered[last.cid]) return
    const cur = stateRef.current
    const targets = oxTargets(cur)
    const top = (cur.agencyRank ?? [])[0]
    s4RankQueue.current = targets.map((agencyId) => ({
      type: 's4-ox',
      step: 'S4',
      title: '기능 수용 여부',
      agencyId,
      isPrimary: agencyId === top,   // 1순위 레벨만 건너뛰기 불가
    }))
    pushNextFromScript()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, cards.length])

  // 카드 목록·활성 인덱스를 상위로 올림 (시연 패널의 실시간 모니터)
  useEffect(() => {
    onMeta?.({ cards, active, order: FIXED_ORDER, remaining: Math.max(0, script.length - cursor.current) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, active])

  // 활성 카드 추적
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const els = Array.from(root.querySelectorAll('[data-cid]'))
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const i = els.indexOf(e.target)
            if (i >= 0) setActive(i)
          }
        })
      },
      { root, threshold: [0.6] }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [cards.length])

  // 시연 패널의 점프 요청
  useEffect(() => {
    if (!jumpTo) return
    const root = scroller.current
    if (!root) return
    const els = root.querySelectorAll('[data-cid]')
    const target = els[Math.min(jumpTo.i, els.length - 1)]
    target?.scrollIntoView({ behavior: 'smooth' })
  }, [jumpTo])

  const render = (spec, i) => {
    const ans = !!answered[spec.cid]
    const isActive = i === active
    const common = { spec, state, api, answered: ans, active: isActive }
    const onAnswer = () => answer(spec.cid)

    switch (spec.type) {
      case 'intro':
        return <IntroCard onAnswer={onAnswer} answered={ans} />
      case 'note':
        return <NoteCard {...common} onAnswer={onAnswer} />
      case 'multi':
        return (
          <MultiCard
            spec={spec}
            value={state.env[spec.key] || []}
            other={state.envOther[spec.key] || ''}
            onOther={(t) => api.set({ envOther: { ...state.envOther, [spec.key]: t } })}
            onAnswer={(v) => {
              // devices 문항: os 파생 (ios / android / desktop)
              const OS_MAP = { '아이폰·아이패드': 'ios', '안드로이드 폰·태블릿': 'android', 'PC·노트북': 'desktop' }
              const envPatch = { ...state.env, [spec.key]: v }
              if (spec.key === 'devices') envPatch.os = v.map((d) => OS_MAP[d]).filter(Boolean)
              api.set({ env: envPatch })
              if (v.length) answer(spec.cid)
            }}
            iconFn={spec.key === 'platforms' ? platformIconPath : undefined}
          />
        )
      case 'sim-intro':
        return <SimIntroCard {...common} onAnswer={onAnswer} />
      case 'sim-scene':
        return (
          <SimSceneCard
            spec={spec}
            answered={ans}
            active={isActive}
            onAnswer={onAnswer}
            videos={videos}
          />
        )
      case 'scope-home':
        return <ScopeHomeCard state={state} api={api} onAnswer={onAnswer} />
      case 'scope-shorts':
        return (
          <ScopeShortsCard
            state={state}
            api={api}
            onAnswer={onAnswer}
            video={videos[0]}
          />
        )
      case 'schedule-type':
        return (
          <ScheduleTypeCard
            state={state}
            api={api}
            onAnswer={() => {
              // dayType 변경 시 schedule-type 이후 카드 전부 제거 후 재생성
              // ('none'→'daily' 전환 시 S3 노트 등 비-schedule 카드도 제거해야 함)
              setCards((prev) => {
                const idx = prev.findIndex((c) => c.cid === spec.cid)
                if (idx < 0) return prev
                const removed = prev.slice(idx + 1)
                if (removed.length > 0) {
                  const removedCids = new Set(removed.map((c) => c.cid))
                  setAnswered((a) => {
                    const next = { ...a }
                    removedCids.forEach((id) => delete next[id])
                    return next
                  })
                  clockQueue.current = []
                  const scriptIdx = script.findIndex((s) => s.type === 'schedule-type')
                  if (scriptIdx >= 0) cursor.current = scriptIdx + 1
                  return prev.slice(0, idx + 1)
                }
                return prev
              })
              answer(spec.cid)
            }}
          />
        )
      case 'schedule':
        return <ScheduleCard state={state} api={api} onAnswer={onAnswer} hoursKey={spec.hoursKey} />
      case 'rank':
        return <RankCard state={state} api={api} onAnswer={onAnswer} order={FIXED_ORDER} />
      case 's4-explore':
        return (
          <S4ExploreCard
            state={state}
            api={api}
            answered={ans}
            onAnswer={onAnswer}
            onOpenExplore={() => setS4ExploreOpen(true)}
          />
        )
      case 's4-rank':
        return (
          <S4RankCard
            state={state}
            api={api}
            answered={ans}
            onAnswer={() => {
              // 기존 s4-ox 이후 카드 모두 제거 (순위 번복 지원)
              setCards((prev) => {
                const idx = prev.findIndex((c) => c.cid === spec.cid)
                if (idx < 0) return prev
                const toRemove = prev.slice(idx + 1)
                if (!toRemove.length) return prev
                const removedCids = new Set(toRemove.map((c) => c.cid))
                setAnswered((a) => {
                  const next = { ...a }
                  removedCids.forEach((id) => delete next[id])
                  return next
                })
                s4RankQueue.current = []
                return prev.slice(0, idx + 1)
              })
              // cursor를 s4-rank 다음으로 재설정
              const scriptIdx = script.findIndex((s) => s.type === 's4-rank')
              if (scriptIdx >= 0) cursor.current = scriptIdx + 1
              answer(spec.cid)
            }}
          />
        )
      case 's4-ox':
        return <S4OXCard spec={spec} state={state} api={api} answered={ans} onAnswer={onAnswer} />
      case 'bypass-scenario':
        return <BypassScenarioCard state={state} api={api} onAnswer={onAnswer} />
      case 'bypass-select':
        return (
          <BypassSelectCard
            state={state}
            api={api}
            answered={ans}
            onAnswer={() => {
              // bypass-wanted 와 result 재생성을 위해 기존 카드 제거
              setCards((prev) => {
                const idx = prev.findIndex((c) => c.cid === spec.cid)
                if (idx < 0) return prev
                const toRemove = prev.slice(idx + 1).filter(
                  (c) => c.type === 'bypass-wanted' || c.type === 'result'
                )
                if (!toRemove.length) return prev
                const removedCids = new Set(toRemove.map((c) => c.cid))
                setAnswered((a) => {
                  const next = { ...a }
                  removedCids.forEach((id) => delete next[id])
                  return next
                })
                bypassQueue.current = []
                // result 가 제거됐으면 cursor 를 result 위치로 되돌림
                if (toRemove.some((c) => c.type === 'result')) {
                  cursor.current = script.findIndex((s) => s.type === 'result')
                }
                return prev.filter(
                  (c, i) => i <= idx || (c.type !== 'bypass-wanted' && c.type !== 'result')
                )
              })
              // bypassWanted 초기화 (번복 시 이전 답 제거)
              api.set({ bypassWanted: {} })
              answer(spec.cid)
            }}
          />
        )
      case 'bypass-wanted':
        return <BypassWantedCard state={state} api={api} onAnswer={onAnswer} answered={ans} />
      case 'result':
        return <ResultCard state={state} api={api} onOpenDetail={onOpenDetail} />
      default:
        return null
    }
  }

  const total = script.length

  return (
    <>
      <div className="deck" ref={scroller}>
        {cards.map((spec, i) => (
          <section className="slot" data-cid={spec.cid} key={spec.cid}>
            {render(spec, i)}
          </section>
        ))}
      </div>

      {/* sim-scene / sim-intro 카드에서는 rail 숨김 */}
      {cards[active]?.type !== 'sim-scene' && cards[active]?.type !== 'sim-intro' && (
        <div className="rail">
          <div
            className="rail-fill"
            style={{ height: `${Math.min(100, ((active + 1) / total) * 100)}%` }}
          />
        </div>
      )}

      {/* step-pill 제거: S# 배지는 참가자 화면에 표시하지 않음 */}

      {/* S4 탐색 오버레이 — .viewport 위에 겹쳐서 scroll-snap 과 분리 */}
      {s4ExploreOpen && (
        <S4ExplorePanel
          state={state}
          api={api}
          onClose={() => setS4ExploreOpen(false)}
          onDone={() => {
            setS4ExploreOpen(false)
            const ec = cards.find((c) => c.type === 's4-explore')
            if (!ec) return
            answer(ec.cid)
            // 3개 모두 탐색한 경우 중간 화면을 건너뛰고 바로 다음 카드로 스크롤
            if ((stateRef.current.agencyVisited ?? []).length >= 3) {
              setTimeout(() => {
                const slot = scroller.current?.querySelector(`[data-cid="${ec.cid}"]`)
                slot?.nextElementSibling?.scrollIntoView({ behavior: 'smooth' })
              }, 300)
            }
          }}
        />
      )}
    </>
  )
}
