import { useRef } from 'react'

// ─────────────────────────────────────────────────────────────
// 원형 24시간 시계. 1~24시 (0시 없음).
// 24시가 위(자정), 6시가 오른쪽, 12시가 아래, 18시가 왼쪽 —
// 표준 24시간 다이얼 배치.
// 누르거나 끌어서 칠한다.
// ─────────────────────────────────────────────────────────────

const CX = 132
const CY = 132
const R_OUT = 122
const R_IN = 74
const R_LBL = 98

const polar = (r, deg) => {
  const a = (deg * Math.PI) / 180
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}

// 시각 h(1~24)의 중심 각도. h=24 → 위쪽(-90°)
const centerDeg = (h) => (h % 24) * 15 - 90

function wedge(h) {
  const a1 = centerDeg(h) - 7.5
  const a2 = centerDeg(h) + 7.5
  const [x1, y1] = polar(R_OUT, a1)
  const [x2, y2] = polar(R_OUT, a2)
  const [x3, y3] = polar(R_IN, a2)
  const [x4, y4] = polar(R_IN, a1)
  return `M${x1} ${y1} A${R_OUT} ${R_OUT} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${R_IN} ${R_IN} 0 0 0 ${x4} ${y4} Z`
}

// 선택된 시각들을 연속 구간으로 묶어 "22–02시" 형태로
export function rangesOf(hours) {
  if (!hours.length) return []
  const set = new Set(hours)
  const out = []
  // 24시 다음이 1시로 이어지도록 순환 처리
  const isSel = (h) => set.has(((h - 1) % 24) + 1)
  const starts = [...hours].sort((a, b) => a - b).filter((h) => !isSel(h - 1 <= 0 ? 24 : h - 1))
  if (!starts.length) return ['하루 종일']
  starts.forEach((s) => {
    let e = s
    let guard = 0
    while (isSel(e + 1 > 24 ? 1 : e + 1) && guard++ < 24) e = e + 1 > 24 ? 1 : e + 1
    out.push(s === e ? `${s}시` : `${s}–${e}시`)
  })
  return out
}

export default function Clock24({ hours, onChange }) {
  const drag = useRef(null)

  const apply = (h) => {
    const has = hours.includes(h)
    if (drag.current === 'on' && has) return
    if (drag.current === 'off' && !has) return
    onChange(has ? hours.filter((x) => x !== h) : [...hours, h])
  }

  const end = () => (drag.current = null)

  return (
    <div className="clock24" onPointerUp={end} onPointerLeave={end} onPointerCancel={end}>
      <svg viewBox="0 0 264 264" width="100%" role="group" aria-label="24시간 시계">
        {/* 배경 고리 */}
        <circle cx={CX} cy={CY} r={(R_OUT + R_IN) / 2} fill="none" stroke="#fff" strokeWidth={R_OUT - R_IN} />
        <circle cx={CX} cy={CY} r={R_OUT} fill="none" stroke="var(--paper-3)" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={R_IN} fill="none" stroke="var(--paper-3)" strokeWidth="1" />

        {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => {
          const on = hours.includes(h)
          return (
            <path
              key={h}
              d={wedge(h)}
              className={'wedge' + (on ? ' on' : '')}
              onPointerDown={(e) => {
                e.preventDefault()
                drag.current = hours.includes(h) ? 'off' : 'on'
                apply(h)
              }}
              onPointerEnter={() => drag.current && apply(h)}
            />
          )
        })}

        {/* 시각 라벨 */}
        {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => {
          const [x, y] = polar(R_LBL, centerDeg(h))
          return (
            <text
              key={h}
              x={x}
              y={y}
              className={'wedge-lbl' + (hours.includes(h) ? ' on' : '')}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {h}
            </text>
          )
        })}

        {/* 가운데 요약 */}
        <text x={CX} y={CY - 12} className="clock-center-n" textAnchor="middle">
          {hours.length}
        </text>
        <text x={CX} y={CY + 8} className="clock-center-u" textAnchor="middle">
          시간 선택
        </text>
        {hours.length > 0 && (
          <text x={CX} y={CY + 28} className="clock-center-r" textAnchor="middle">
            {rangesOf(hours).slice(0, 2).join(', ')}
          </text>
        )}
      </svg>
      <div className="clock-poles">
        <span style={{ top: 2 }}>자정</span>
        <span style={{ bottom: 2 }}>정오</span>
      </div>
    </div>
  )
}
