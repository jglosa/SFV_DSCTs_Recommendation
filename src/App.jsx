import { useEffect, useRef, useState } from 'react'
import { useStore } from './store.js'
import { supabase } from './lib/supabase.js'
import Deck from './components/Deck.jsx'
import DebugPanel from './components/DebugPanel.jsx'
import DetailPanel from './components/DetailPanel.jsx'

// ?monitor=0 이면 시연 패널을 숨긴다. 기본값은 표시.
const showMonitor = new URLSearchParams(window.location.search).get('monitor') !== '0'
// ?sid=<id> 가 있으면 그 세션 ID를 사용 (없으면 새로 생성)
const urlSid = new URLSearchParams(window.location.search).get('sid')

export default function App() {
  const [state, api] = useStore()
  const [jumpTo, setJumpTo] = useState(null)
  const [snapTrigger, setSnapTrigger] = useState(0)
  const [meta, setMeta] = useState(null)
  // 상세 화면 상태: { type: 'feature'|'app', item } | null
  const [detail, setDetail] = useState(null)

  const sessionId = useRef(urlSid || crypto.randomUUID())
  const syncTimer = useRef(null)
  // participantId 입력 후 최초 1회 upsert(생성) 여부 추적
  const sessionCreated = useRef(false)

  // 시스템 뒤로가기 차단 — 실수로 눌러도 앱에서 이탈하지 않음
  useEffect(() => {
    history.pushState(null, '', location.href)
    const block = () => history.pushState(null, '', location.href)
    window.addEventListener('popstate', block)
    return () => window.removeEventListener('popstate', block)
  }, [])

  // 상태 변경 시 1초 debounce로 Supabase 동기화
  // participantId 가 없으면 저장 자체를 건너뜀
  useEffect(() => {
    if (!state.participantId) return
    clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      const payload = { state, updated_at: new Date().toISOString() }
      if (!sessionCreated.current) {
        // 최초 저장: upsert로 row 생성
        sessionCreated.current = true
        supabase.from('sessions').upsert({ id: sessionId.current, ...payload })
          .then(({ error }) => { if (error) console.error('세션 생성 실패:', error) })
      } else {
        supabase.from('sessions').update(payload).eq('id', sessionId.current)
          .then(({ error }) => { if (error) console.error('세션 동기화 실패:', error) })
      }
    }, 1000)
  }, [state])

  return (
    <div className="stage">
      <div className="phone">
        <div className="phone-notch" />
        <div className="viewport">
          {/* nonce가 바뀌면 덱 전체가 새로 만들어짐 */}
          <Deck
            key={state.nonce}
            state={state}
            api={api}
            jumpTo={jumpTo}
            snapTrigger={snapTrigger}
            onMeta={setMeta}
            onOpenDetail={setDetail}
            sessionId={sessionId.current}
          />
          {/* 상세 화면 — 덱 위에 겹쳐서 scroll-snap 과 분리 */}
          {detail && (
            <DetailPanel
              detail={detail}
              state={state}
              onBack={() => { setDetail(null); setSnapTrigger((n) => n + 1) }}
              onOpenDetail={setDetail}
            />
          )}
        </div>
      </div>
      {showMonitor && (
        <DebugPanel
          state={state}
          meta={meta}
          onJump={setJumpTo}
          sessionId={sessionId.current}
        />
      )}
    </div>
  )
}
