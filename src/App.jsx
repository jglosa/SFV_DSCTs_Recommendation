import { useState } from 'react'
import { useStore } from './store.js'
import Deck from './components/Deck.jsx'
import DebugPanel from './components/DebugPanel.jsx'
import DetailPanel from './components/DetailPanel.jsx'

// ?monitor=0 이면 시연 패널을 숨긴다. 기본값은 표시.
const showMonitor = new URLSearchParams(window.location.search).get('monitor') !== '0'

export default function App() {
  const [state, api] = useStore()
  const [jumpTo, setJumpTo] = useState(null)
  const [meta, setMeta] = useState(null)
  // 상세 화면 상태: { type: 'feature'|'app', item } | null
  const [detail, setDetail] = useState(null)

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
            onMeta={setMeta}
            onOpenDetail={setDetail}
          />
          {/* 상세 화면 — 덱 위에 겹쳐서 scroll-snap 과 분리 */}
          {detail && (
            <DetailPanel
              detail={detail}
              state={state}
              onBack={() => setDetail(null)}
              onOpenDetail={setDetail}
            />
          )}
        </div>
      </div>
      {showMonitor && <DebugPanel state={state} api={api} meta={meta} onJump={setJumpTo} />}
    </div>
  )
}
