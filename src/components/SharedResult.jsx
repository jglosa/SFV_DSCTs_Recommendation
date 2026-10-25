import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import ResultCard from './ResultCard.jsx'
import DetailPanel from './DetailPanel.jsx'

// ─────────────────────────────────────────────────────────────
// 공유 결과 화면. /?view=result&sid=<sessionId> 로 접근.
// DB에서 완료된 세션의 state를 읽어 ResultCard를 읽기 전용으로 표시한다.
// ─────────────────────────────────────────────────────────────

export default function SharedResult({ sessionId }) {
  const [sessionData, setSessionData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    supabase.from('sessions').select('state, completed')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => {
        setSessionData(data)
        setLoading(false)
      })
  }, [sessionId])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
      로딩 중...
    </div>
  )

  if (!sessionData?.state) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
      결과를 찾을 수 없습니다.
    </div>
  )

  return (
    <div className="stage">
      <div className="phone">
        <div className="phone-notch" />
        <div className="viewport">
          <ResultCard
            state={sessionData.state}
            api={{}}
            onOpenDetail={setDetail}
            readOnly
          />
          {detail && (
            <DetailPanel
              detail={detail}
              state={sessionData.state}
              onBack={() => setDetail(null)}
              onOpenDetail={setDetail}
            />
          )}
        </div>
      </div>
    </div>
  )
}
