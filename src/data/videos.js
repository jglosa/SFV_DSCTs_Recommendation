// ─────────────────────────────────────────────────────────────
// 가짜 영상 풀.
//
// [나중에 교체할 지점]
// 실제 데이터 수집 때는 각 항목에 src: '/clips/xxx.mp4' 를 추가하고
// components/Feed.jsx 의 <div className="vcard-visual"> 를 <video> 로 바꾸면 됨.
// category 태그는 그대로 유지 — S2(범위 선택)에서 재사용되므로 반드시 필요.
// ─────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { id: 'game', label: '게임' },
  { id: 'food', label: '먹방' },
  { id: 'comedy', label: '유머' },
  { id: 'beauty', label: '뷰티' },
  { id: 'news', label: '뉴스·이슈' },
  { id: 'study', label: '공부·자기계발' },
  { id: 'pet', label: '반려동물' },
  { id: 'workout', label: '운동' },
]

// 시각적으로 카드를 구분하기 위한 그라디언트 (영상 대체물)
const G = {
  game: ['#1B1F3B', '#4B2E83'],
  food: ['#3B1F1B', '#8A4B2A'],
  comedy: ['#1F3B33', '#2A8A6B'],
  beauty: ['#3B1F33', '#8A2A6B'],
  news: ['#1F2A3B', '#2A5B8A'],
  study: ['#2A2A2A', '#5C5C5C'],
  pet: ['#3B3421', '#8A7A2A'],
  workout: ['#3B2121', '#8A2A2A'],
}

const LABEL = {
  game: '게임', food: '먹방', comedy: '유머', beauty: '뷰티',
  news: '뉴스', study: '공부', pet: '반려동물', workout: '운동',
}

let n = 0
const v = (category, title, creator, seconds) => ({
  id: `v${++n}`,
  category,
  categoryLabel: LABEL[category],
  title,
  creator,
  seconds,
  grad: G[category],
  likes: (Math.floor(Math.random() * 90) + 4) + '만',
})

export const VIDEO_POOL = [
  v('game', '이 구간 3초만 보세요 진짜 미쳤음', '겜하는너굴', 14),
  v('food', '편의점에서 이거 조합 아세요?', '먹요정', 11),
  v('comedy', '조별과제 빌런 유형 3가지', '학식러', 18),
  v('study', '새벽 2시에 과제하는 사람들 특징', '공부기록', 16),
  v('pet', '주인 몰래 간식 훔치는 법', '냥냥일지', 9),
  v('game', '이 캐릭터 픽하면 욕먹는 이유', '겜하는너굴', 20),
  v('news', '오늘 그 사건 3줄 정리', '이슈요약', 13),
  v('beauty', '10분 만에 나가야 할 때 이거만', '뷰티로그', 15),
  v('food', '자취생 라면 업그레이드 5단계', '자취요리', 22),
  v('workout', '앉아서 하는 목 스트레칭', '홈트단', 12),
  v('comedy', '교수님이 갑자기 조용해질 때', '학식러', 10),
  v('game', '노 데스 클리어 마지막 3초', '스피드런', 17),
  v('study', '집중 안 될 때 이거 해보세요', '공부기록', 19),
  v('pet', '강아지가 산책 가자고 할 때', '멍멍일지', 8),
  v('food', '야식 참는 사람들 보세요', '먹요정', 14),
  v('beauty', '헤어 드라이 이렇게 하면 안 됨', '뷰티로그', 16),
]

// 시드 기반 셔플 (참가자별 재현 가능하게)
export function shuffled(arr, seed = 1) {
  const a = [...arr]
  let s = seed
  const rnd = () => {
        s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
