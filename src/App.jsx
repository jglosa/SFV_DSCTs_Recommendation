import { useEffect, useRef, useState } from 'react'
import { useStore } from './store.js'
import { supabase } from './lib/supabase.js'
import Deck from './components/Deck.jsx'
import DebugPanel from './components/DebugPanel.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import ResultCard from './components/ResultCard.jsx'

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
  // 이어서 하기 후보 세션 { id, state, updated_at } | null
  const [resumeCandidate, setResumeCandidate] = useState(null)
  // 완료된 세션 결과 직접 보기 { state, sessionId } | null
  const [readOnlyResult, setReadOnlyResult] = useState(null)

  const sessionId = useRef(urlSid || crypto.randomUUID())
  const syncTimer = useRef(null)
  // participantId 입력 후 최초 1회 upsert(생성) 여부 추적
  const sessionCreated = useRef(false)
  // 이어서 하기 조회 중복 실행 방지
  const resumeChecked = useRef(false)

  // 시스템 뒤로가기 차단 — 실수로 눌러도 앱에서 이탈하지 않음
  useEffect(() => {
    history.pushState(null, '', location.href)
    const block = () => history.pushState(null, '', location.href)
    window.addEventListener('popstate', block)
    return () => window.removeEventListener('popstate', block)
  }, [])

  // participantId 가 처음 설정될 때 미완료 세션 조회
  useEffect(() => {
    if (!state.participantId || resumeChecked.current) return
    resumeChecked.current = true
    supabase
      .from('sessions')
      .select('*')
      .filter('state->>participantId', 'eq', state.participantId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const found = data?.find((s) => s.id !== sessionId.current)
        if (found) setResumeCandidate(found)
      })
  }, [state.participantId])

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

  const handleResume = () => {
    sessionId.current = resumeCandidate.id
    sessionCreated.current = true
    if (resumeCandidate.completed) {
      // 완료 세션: Deck 재구성 없이 결과 화면 직접 표시
      setReadOnlyResult({ state: resumeCandidate.state, sessionId: resumeCandidate.id })
    } else {
      api.load(resumeCandidate.state)
      // 체인 반응(answered 카드 재구성)이 끝난 뒤 마지막 카드로 스크롤
      setTimeout(() => setJumpTo({ i: 9999 }), 600)
    }
    setResumeCandidate(null)
  }

  return (
    <div className="stage">
      <div className="phone">
        <div className="phone-notch" />
        <div className="viewport">
          {readOnlyResult ? (
            /* 완료 세션 결과 직접 보기 — Deck 없이 ResultCard만 */
            <ResultCard
              state={readOnlyResult.state}
              api={api}
              sessionId={readOnlyResult.sessionId}
              readOnly
            />
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
      {/* 기존 세션 감지 오버레이 (완료 / 미완료 공통) */}
      {resumeCandidate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 300, width: '90%', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>
              {resumeCandidate.completed ? '이미 완료된 세션이 있습니다' : '이전에 진행한 세션이 있어요'}
            </p>
            <p style={{ fontSize: 13, color: '#888', margin: '0 0 6px' }}>참가자 ID: {resumeCandidate.state?.participantId}</p>
            <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 24px' }}>
              마지막 저장: {new Date(resumeCandidate.updated_at).toLocaleString('ko-KR')}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #ddd', background: '#fff', fontSize: 14, cursor: 'pointer' }}
                onClick={() => setResumeCandidate(null)}
              >새로 시작</button>
              <button
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                onClick={handleResume}
              >{resumeCandidate.completed ? '결과 보기' : '이어서 하기'}</button>
            </div>
          </div>
        </div>
      )}

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
