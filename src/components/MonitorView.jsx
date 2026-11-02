import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { SCOPE_LEVELS, RESISTANCE_LABEL, BYPASS_TARGETS, LEVELS } from '../data/features.js'
import { VARIANTS } from './Intervention.jsx'
import { rangesOf } from './Clock24.jsx'
import { SCENARIO_BY_ID } from '../data/scenarios.js'

// ─────────────────────────────────────────────────────────────
// 연구자용 실시간 모니터.
//   /?view=monitor&sid=<sessionId> → 단일 세션 실시간 모니터
//   /?view=monitor                 → 전체 세션 목록 + CSV 다운로드
// ─────────────────────────────────────────────────────────────

const NUM = ['①', '②', '③']

// ── 단일 셀 ──────────────────────────────────────────────────
function MRow({ label, value, dim }) {
  return (
    <tr style={{ borderBottom: '1px solid #f0f0f0', opacity: dim ? 0.4 : 1 }}>
      <th style={{ textAlign: 'left', padding: '6px 12px', color: '#888', fontWeight: 'normal', width: 130, whiteSpace: 'nowrap', fontSize: 13 }}>
        {label}
      </th>
      <td style={{ padding: '6px 12px', fontSize: 13 }}>{value}</td>
    </tr>
  )
}

function MCheckRow({ label, checked, dim }) {
  return (
    <tr style={{ borderBottom: '1px solid #f0f0f0', opacity: dim ? 0.4 : 1 }}>
      <th style={{ textAlign: 'left', padding: '6px 12px', color: '#888', fontWeight: 'normal', width: 130, whiteSpace: 'nowrap', fontSize: 13 }}>
        {label}
      </th>
      <td style={{ padding: '6px 12px', fontSize: 13 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: 3,
          border: `1.5px solid ${checked ? '#22c55e' : '#ccc'}`,
          background: checked ? '#22c55e' : '#fff',
          color: '#fff', fontSize: 10, fontWeight: 700,
        }}>
          {checked ? '✓' : ''}
        </span>
      </td>
    </tr>
  )
}

function MSec({ label }) {
  return (
    <tr>
      <td colSpan={2} style={{ padding: '10px 12px 4px', fontSize: 11, fontWeight: 700, color: '#2563eb', letterSpacing: '.05em', textTransform: 'uppercase' }}>
        {label}
      </td>
    </tr>
  )
}

// ── CSV 다운로드 ──────────────────────────────────────────────
function downloadCSV(sessions) {
  const headers = [
    'session_id', 'participant_id', 'updated_at',
    '기기', '경로', '플랫폼', '통제범위', '개입시점순위', '우회방지',
    'agencyRank', 'timingRank',
  ]

  const escape = (v) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const rows = sessions.map((s) => {
    const st = s.state || {}
    const fmt = (arr) => (arr?.length ? arr.join(' | ') : '')
    return [
      s.id,
      s.participant_id ?? st.participantId ?? '',
      s.updated_at,
      fmt(st.env?.devices),
      fmt(st.env?.route),
      fmt(st.env?.platforms),
      (st.scopes || []).map((sc) => SCOPE_LEVELS[sc]).filter(Boolean).join(' | '),
      (st.timingRank || []).map((w, i) => `${i + 1}.${VARIANTS[w]?.shortName ?? w}`).join(' '),
      Object.entries(st.bypassWanted || {}).filter(([, v]) => v).map(([k]) => RESISTANCE_LABEL[k]).join(' | '),
      (st.agencyRank || []).join(' > '),
      (st.timingRank || []).join(' > '),
    ].map(escape)
  })

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const pids = sessions
    .map((s) => s.participant_id ?? s.state?.participantId ?? '')
    .filter(Boolean)
    .join('_')
  const date = new Date().toISOString().slice(0, 10)
  a.download = pids ? `sessions_${pids}_${date}.csv` : `sessions_${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── 전체 세션 목록 뷰 ────────────────────────────────────────
function SessionListView() {
  const [sessions, setSessions] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    supabase.from('sessions').select('*').order('updated_at', { ascending: false })
      .then(({ data }) => { setSessions(data ?? []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const S = {
    wrap: { fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 900, margin: '0 auto' },
    head: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
    h2: { margin: 0, fontSize: 20 },
    btn: {
      marginLeft: 'auto', padding: '6px 14px', fontSize: 13,
      background: '#111', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
    },
    btnGhost: {
      padding: '6px 14px', fontSize: 13,
      background: 'transparent', color: '#555', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer',
    },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: { textAlign: 'left', padding: '8px 10px', background: '#f5f5f5', borderBottom: '2px solid #e0e0e0', whiteSpace: 'nowrap' },
    td: { padding: '8px 10px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' },
    badge: (completed) => ({
      display: 'inline-block', padding: '2px 7px', borderRadius: 10, fontSize: 11,
      background: completed ? '#dcfce7' : '#fef9c3', color: completed ? '#15803d' : '#854d0e',
    }),
    link: { color: '#2563eb', textDecoration: 'none', fontFamily: 'monospace', fontSize: 12 },
  }

  return (
    <div style={S.wrap}>
      <div style={S.head}>
        <h2 style={S.h2}>세션 목록</h2>
        <span style={{ fontSize: 13, color: '#999' }}>{sessions ? `${sessions.length}개` : ''}</span>
        <button style={S.btnGhost} onClick={load}>새로고침</button>
        <button style={S.btn} onClick={() => sessions?.length && downloadCSV(sessions)}>
          CSV 다운로드
        </button>
      </div>

      {loading && <div style={{ color: '#999' }}>불러오는 중...</div>}

      {!loading && sessions?.length === 0 && (
        <div style={{ color: '#999' }}>세션이 없습니다.</div>
      )}

      {!loading && sessions?.length > 0 && (
        <table style={S.table}>
          <thead>
            <tr>
              {['참가자 ID', '세션 ID', '완료', '마지막 업데이트', '기기', '플랫폼', '상세'].map((h) => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const st = s.state || {}
              const pid = s.participant_id ?? st.participantId ?? '—'
              const devices = (st.env?.devices || []).join(', ') || '—'
              const platforms = (st.env?.platforms || []).join(', ') || '—'
              const monitorUrl = `?view=monitor&sid=${s.id}`
              return (
                <tr key={s.id}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{pid}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>
                    {s.id.slice(0, 8)}…
                  </td>
                  <td style={S.td}>
                    <span style={S.badge(s.completed)}>{s.completed ? '완료' : '진행중'}</span>
                  </td>
                  <td style={{ ...S.td, color: '#888', fontSize: 12 }}>
                    {new Date(s.updated_at).toLocaleString('ko-KR')}
                  </td>
                  <td style={S.td}>{devices}</td>
                  <td style={S.td}>{platforms}</td>
                  <td style={S.td}>
                    <a href={monitorUrl} style={S.link}>모니터 →</a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── 단일 세션 실시간 모니터 뷰 ───────────────────────────────
function SingleSessionView({ sessionId }) {
  const [session, setSession] = useState(null)
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    supabase.from('sessions').select('*').eq('id', sessionId).single()
      .then(({ data }) => {
        if (data) { setSession(data); setLastUpdate(new Date()) }
      })

    const channel = supabase
      .channel(`monitor:${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        setSession(payload.new)
        setLastUpdate(new Date())
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))

    return () => supabase.removeChannel(channel)
  }, [sessionId])

  const st = session?.state || {}
  const fmt = (arr) => (arr?.length ? arr.join(', ') : '—')

  const envLine = (key) => {
    const v = st.env?.[key] || []
    const other = st.envOther?.[key]
    if (!v.length) return null
    return v.map((x) => (x === '기타' && other ? `기타(${other})` : x)).join(', ')
  }

  const ruleVal = () => {
    if (st.dayType === 'daily') {
      const hrs = st.hours?.daily || []
      return `true${hrs.length ? ' / ' + rangesOf(hrs).join(', ') + ` (${hrs.length}h)` : ''}`
    }
    if (st.dayType === 'none') return 'false'
    return null
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 720, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <a href="?view=monitor" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', marginRight: 4 }}>← 목록</a>
        <h2 style={{ margin: 0, fontSize: 20 }}>세션 모니터</h2>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
        <span style={{ fontSize: 13, color: '#666' }}>{connected ? '연결됨' : '연결 중...'}</span>
        {lastUpdate && (
          <span style={{ fontSize: 12, color: '#aaa', marginLeft: 'auto' }}>
            업데이트: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div style={{ fontSize: 12, color: '#999', marginBottom: 16, fontFamily: 'monospace', display: 'flex', gap: 12, alignItems: 'center' }}>
        <span>세션 ID: {sessionId}</span>
        {session?.completed && <span style={{ color: '#22c55e' }}>✓ 완료됨</span>}
        {session && (
          <button
            style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12, background: '#111', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}
            onClick={() => downloadCSV([session])}
          >
            CSV 다운로드
          </button>
        )}
      </div>

      {!session && <div style={{ color: '#999' }}>세션을 불러오는 중...</div>}

      {session && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <MSec label="참가자" />
            <MRow label="참가자 ID" value={st.participantId || '—'} dim={!st.participantId} />

            <MSec label="S0 사용 환경" />
            <MRow label="기기"   value={envLine('devices') || '—'} dim={!envLine('devices')} />
            <MRow label="경로"   value={envLine('route') || '—'}   dim={!envLine('route')} />
            <MRow label="플랫폼" value={envLine('platforms') || '—'} dim={!envLine('platforms')} />
            {Object.entries(st.envOther || {}).filter(([, v]) => v).map(([k, v]) => (
              <MRow key={k} label={`기타(${k})`} value={v} />
            ))}

            <MSec label="S1 통제 범위" />
            <MRow
              label="범위"
              value={(st.scopes || []).length ? st.scopes.map((s) => SCOPE_LEVELS[s]).join(', ') : '—'}
              dim={!(st.scopes || []).length}
            />

            <MSec label="S2 통제 규칙" />
            <MRow label="Scheduling" value={ruleVal() || '—'} dim={!st.dayType} />

            <MSec label="S3 개입 시점" />
            <MRow
              label="선호 순위"
              value={(st.timingRank || []).length
                ? st.timingRank.map((w, i) => `${i + 1}.${VARIANTS[w]?.shortName ?? w}`).join(' ')
                : '—'}
              dim={!(st.timingRank || []).length}
            />

            <MSec label="S4 개입 강도" />
            <MRow
              label="탐색 방문"
              value={(st.agencyVisited ?? []).length ? st.agencyVisited.join(' → ') : '—'}
              dim={!(st.agencyVisited ?? []).length}
            />
            <MRow
              label="agency 순위"
              value={(st.agencyRank ?? []).length
                ? st.agencyRank.map((a, i) => `${i + 1}.${a}`).join(' ')
                : '—'}
              dim={!(st.agencyRank ?? []).length}
            />
            {/* 기능 응답 — agency별 그룹 */}
            {(() => {
              const acc = st.featureAccepted ?? {}
              const levelMap = Object.fromEntries(LEVELS.map((l) => [String(l.level), l]))
              const AGENCY_ORDER = ['supported', 'flexible', 'limited']
              const AGENCY_LABEL = { supported: 'supported 응답', flexible: 'flexible 응답', limited: 'limited 응답' }
              const hasAny = Object.keys(acc).length > 0
              if (!hasAny) return <MRow label="기능 응답" value="—" dim />
              return AGENCY_ORDER.map((agencyId) => {
                const entries = Object.entries(acc)
                  .filter(([lvl]) => levelMap[lvl]?.agency === agencyId)
                  .sort(([a], [b]) => Number(a) - Number(b))
                if (!entries.length) return null
                const val = entries.map(([lvl, resp]) => `${levelMap[lvl].nameKo}: ${resp}`).join(' / ')
                return <MRow key={agencyId} label={AGENCY_LABEL[agencyId]} value={val} />
              })
            })()}
            <MRow
              label="경험한 시뮬"
              value={(st.simsPlayed ?? []).length ? st.simsPlayed.join(', ') : '—'}
              dim={!(st.simsPlayed ?? []).length}
            />
            {(() => {
              const second = (st.agencyRank ?? [])[1]
              const skipped = second ? (st.oxSkipped ?? []).includes(second) : false
              return <MCheckRow label="2순위 응답 건너뜀" checked={skipped} dim={!second} />
            })()}

            <MSec label="S5 우회·임시해제" />
            <MRow
              label="선택 시나리오"
              value={st.bypassScenario ? (SCENARIO_BY_ID[st.bypassScenario]?.name ?? st.bypassScenario) : '—'}
              dim={!st.bypassScenario}
            />
            {BYPASS_TARGETS.map((s) => {
              const m = (st.bypassMethods ?? {})[s.featureId]
              return (
                <MCheckRow key={s.featureId} label={RESISTANCE_LABEL[s.featureId]} checked={m === true} dim={m === undefined} />
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function MonitorView({ sessionId }) {
  if (sessionId) return <SingleSessionView sessionId={sessionId} />
  return <SessionListView />
}
