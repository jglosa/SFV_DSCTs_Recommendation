import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import MonitorView from './components/MonitorView.jsx'
import SharedResult from './components/SharedResult.jsx'
import './styles.css'

// URL 파라미터로 뷰 전환
// /?view=monitor&sid=<id> → 연구자 실시간 모니터
// /?view=result&sid=<id>  → 공유 결과 화면
// /                       → 설문 앱 (기본)
const params = new URLSearchParams(window.location.search)
const view = params.get('view')
const sid = params.get('sid')

let Root
if (view === 'monitor') {
  // sid 있으면 단일 세션, 없으면 전체 목록
  Root = () => <MonitorView sessionId={sid || null} />
} else if (view === 'result' && sid) {
  Root = () => <SharedResult sessionId={sid} />
} else {
  Root = App
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
