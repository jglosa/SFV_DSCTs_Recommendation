

// ─────────────────────────────────────────────────────────────
// 카드 시퀀스 (System Questions Flow 기준)
//
//   S0  SFV 사용 환경     환경 전체를 커버해야 한다는 요구
//   S1  통제 범위         앱/콘텐츠/키워드 등 통제 대상의 범위
//   S2  통제 규칙         Scheduling — 개입 조건이 시간적으로 일관된가
//   S3  개입 시점         When axis & 발동기준 → 시뮬레이션
//   S4  개입 강도         권한 + 대가의 종류
//   S5  우회·임시해제     얼만큼의 임시 해제를 허용할 것인가
//
// 질문과 영상이 같은 scroll-snap 피드에 섞여 있고,
// 답하면 아래에 다음 카드가 생긴다. "다음" 버튼은 없다.
// ─────────────────────────────────────────────────────────────

export const STEP_LABEL = {
  S0: '사용 환경',
  S1: '통제 범위',
  S2: '통제 규칙',
  S3: '개입 시점',
  S4: '개입 강도',
  S5: '우회 방지',
  RESULT: '결과',
}

export const S0_QUESTIONS = [
  {
    key: 'devices',
    step: 'S0',
    n: '01',
    q: '어떤 기기에서 숏폼을 보나요?',
    hint: '해당하는 것 모두 선택해주세요',
    // 선택지 → os 파생: ios / android / desktop (Deck.jsx multi 핸들러에서 env.os 에 기록)
    opts: ['아이폰·아이패드 (iOS)', '갤럭시 등 안드로이드 폰·태블릿 (Android)', 'PC·노트북'],
  },
  {
    key: 'route',
    step: 'S0',
    n: '02',
    q: '어떤 경로를 통해 보나요?',
    hint: '해당하는 것 모두 선택해주세요',
    opts: ['앱', '웹브라우저'],
  },
  {
    key: 'platforms',
    step: 'S0',
    n: '03',
    q: '어떤 플랫폼을 통해 보나요?',
    hint: '해당하는 것 모두 선택해주세요',
    opts: ['YouTube', 'Instagram', 'TikTok', 'Facebook', 'Snapchat'],
  },
]

// S3 시뮬레이션: 모두 "MyTube 홈 화면에서 숏폼 탭을 누르려는 상황"으로 통일.
// 개입이 어느 지점에서 걸리는지만 다르다.
// 제시 순서 고정: Pre → At → InUse
// (행동 변화를 측정하는 설계가 아니므로 카운터밸런싱 불필요.
//  개입 지점이 점점 뒤로 밀리는 구조를 참가자가 이해하기 쉽다.)
const FIXED_ORDER = ['Pre', 'At', 'InUse']
const WHEN_LABEL = { Pre: '진입 전', At: '진입 시점', InUse: '사용 중' }

function simSegment(when, idx) {
  const n = idx + 1
  return [
    { type: 'sim-intro', step: 'S3', when, n, title: `개입 ${n} 안내` },
    { type: 'sim-scene', step: 'S3', when, n, title: `개입 ${n} 체험 (${WHEN_LABEL[when]})` },
  ]
}

export function buildScript() {
  return [
    { type: 'intro', title: '인트로' },

    ...S0_QUESTIONS.map((q) => ({ type: 'multi', ...q, title: q.q })),

    { type: 'scope-home', step: 'S1', title: '통제 범위 선택' },

    { type: 'schedule-type', step: 'S2', title: '개입 시간 유형 선택' },
    // 시계 카드는 Deck.jsx가 dayType에 따라 동적으로 주입 (0·1·2장)

    {
      type: 'note',
      step: 'S3',
      title: 'S3 안내',
      heading: '앱이 언제 개입해주면 좋을까요?',
      body: '앱이 어떤 순간에 개입하면 좋을지, 세 가지 시점을 직접 경험하며 비교해봅니다. 겪어본 뒤에는 마음에 드는 순서대로 순위를 매겨주세요.\n\n잠시 이런 상황에 있다고 생각해보세요.',
      scene: '시험공부를 하다 잠시 쉬기로 했습니다. 습관처럼 스마트폰을 켜서 숏폼을 보려는 순간, 앱이 개입합니다.',
      body2: '이제 이 상황에서 세 가지 개입을 하나씩 경험해보고, 어떤 시점이 가장 적절한지 살펴보세요.',
    },

    ...FIXED_ORDER.flatMap((w, i) => simSegment(w, i)),

    { type: 'rank', step: 'S3', title: '세 시점 순위 매기기' },

    // S4 카드 2장: A 탐색+순위 통합 / B 기능 O/X
    // B 카드(s4-ox)는 Deck.jsx가 agencyRank[0] !== 'limited' 일 때 동적 주입
    { type: 's4-rank',   step: 'S4', title: 'S4 레벨 탐색 & 순위' },

    { type: 'bypass-scenario', step: 'S5', title: '우회 상황 선택' },
    { type: 'bypass-select', step: 'S5', title: '우회 방법 선택' },
    { type: 'result', title: '결과' },
  ]
}

export { FIXED_ORDER }

// 시연 패널에 표시할 카드 제목
export function cardTitle(spec) {
  if (spec.title) return spec.title
  if (spec.type === 'sim-intro') return `개입 ${spec.n} 안내`
  if (spec.type === 'sim-scene') return `개입 ${spec.n} 체험 (${WHEN_LABEL[spec.when]})`
  if (spec.type === 's4-explore') return 'S4 레벨 탐색'
  if (spec.type === 's4-rank')   return 'S4 레벨 순위'
  if (spec.type === 's4-ox')     return 'S4 기능 O/X'
  return spec.type
}
