// ─────────────────────────────────────────────────────────────
// 개입 오버레이. when prop 하나로 3가지 변형.
// Continuous 는 여기 없음 — 설정 위의 보호층이지 시점이 아니므로.
//
// 배지에 ①②③ 번호를 함께 붙여, 나중에 순위를 매길 때
// "몇 번째로 겪은 것이 어느 시점이었는지" 되짚을 수 있게 한다.
//
// 대기 없음 — 카운트다운은 S4 timed_wait 시뮬레이션이 담당한다.
// ─────────────────────────────────────────────────────────────

// InUse 발동 기준 개수 — SimSceneCard(Cards.jsx)의 swipeNext와 반드시 동기화
export const SIM_INUSE_COUNT = 3

export const VARIANTS = {
  Pre: {
    badge: '진입 전 개입',
    shortName: '진입 전',
    title: '홈의 숏폼 줄과 하단 숏폼 탭이 잠겼어요',
    body: '어제 이 시간대에 47분을 썼습니다. 지금은 집중 시간으로 등록된 구간입니다.',
    explain: '숏폼으로 이어지는 경로 자체를 비활성화합니다. 탭과 피드 추천이 사라집니다.',
    stat: ['등록된 집중 시간대', '22:00 – 02:00'],
    rankDesc: '숏폼 진입 경로 자체가 비활성화됩니다.',
  },
  At: {
    badge: '진입 시점 개입',
    shortName: '진입 시점',
    title: '숏폼에 들어가려는 순간 막혔어요',
    body: '',
    explain: '숏폼에 진입하는 순간 당신을 멈춰 세웁니다.',
    stat: ['오늘 숏폼 사용', '1시간 12분'],
    rankDesc: '숏폼을 열려고 누른 그 순간에 확인이 걸립니다.',
  },
  InUse: {
    badge: '사용 중 개입',
    shortName: '사용 중',
    title: '보고 있는 중에 막혔어요',
    body: '',
    explain: '무의식적으로 이어지는 시청을 끊기 위해 사용 중간에 들어옵니다.',
    stat: ['이번 세션', `숏폼 ${SIM_INUSE_COUNT}개`],
    rankDesc: '이미 보기 시작한 뒤, 일정 개수마다 흐름을 끊습니다.',
  },
}

const NUM = ['①', '②', '③']

// onPrimary: "계속 보기" 클릭 시 호출 (개입 통과).
// onSecondary: "닫기" 클릭 시 호출 (개입 전 화면으로 복귀).
// hideContinue: true이면 "계속 보기" 버튼을 표시하지 않음.
export default function Intervention({ variant, n, onPrimary, onSecondary, hideContinue }) {
  const v = VARIANTS[variant]

  return (
    <div className="iv">
      <div className="iv-inner">
        <div className="iv-badge">
          {n ? `${NUM[n - 1]} ${v.badge}` : v.badge}
        </div>
        <h2 className="iv-h">{v.title}</h2>
        {v.body && <p className="iv-p">{v.body}</p>}
        <div className="iv-explain">
          <span>이 개입은</span>
          {v.explain}
        </div>
        <div className="iv-stat">
          <span>{v.stat[0]}</span>
          <span>{v.stat[1]}</span>
        </div>
      </div>
      <div className="iv-actions">
        {onSecondary && (
          <button className="iv-btn" onClick={onSecondary}>닫기</button>
        )}
        {!hideContinue && (
          <button className="iv-btn iv-btn-ghost" onClick={onPrimary}>계속 보기</button>
        )}
      </div>
    </div>
  )
}
