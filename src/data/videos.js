// ─────────────────────────────────────────────────────────────
// 시뮬레이션 영상 목록.
// 필드: title, creator, likes, thumb(썸네일 경로), src(영상 경로)
// ─────────────────────────────────────────────────────────────

let n = 0
const v = (title, creator, extra = {}) => ({
  id: `v${++n}`,
  title,
  creator,
  likes: (Math.floor(Math.random() * 90) + 4) + '만',
  ...extra,
})

export const VIDEO_POOL = [
  v('베트남 도로에서만 볼 수 있는 것들', '길위의곰', { thumb: 'thumbs/sf1.jpg', src: 'sf_videos/sf1.mp4', chThumb: 'chs/ch_sf1.png' }),
  v('오로라 색깔의 비밀 알려드림', '태양계먼지', { thumb: 'thumbs/sf2.jpg', src: 'sf_videos/sf2.mp4', chThumb: 'chs/ch_sf2.png' }),
  v('공대생은 노벨위크에서 뭘할까', '역마살포닉스', { thumb: 'thumbs/sf3.jpg', src: 'sf_videos/sf3.mp4', chThumb: 'chs/ch_sf3.png' }),
]

// S3 시뮬레이션 InUse 전용 영상 (sf1→sf2→sf3 순서 고정)
export const SIM_VIDEOS = VIDEO_POOL.slice(0, 3)

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
