// ─────────────────────────────────────────────────────────────
// 실제 앱과 같은 구조의 모의 UI.
// 목적: "무엇을 막고 싶은지"를 말로 고르는 게 아니라
//       화면에 있는 그 요소를 직접 누르게 하는 것.
//
// 탭 타겟(.hit)은 UI 요소를 감싸며, id 는 capability 매트릭스의
// scope_levels 값과 1:1 대응한다.
// ─────────────────────────────────────────────────────────────

import { SCOPE_DISPLAY } from '../data/features.js'

const CHIPS = ['전체', '게임', '음악', '실시간', '요리', '뉴스', '학습']

const LONGFORM = [
  { t: '3시간 집중용 로파이 플레이리스트', ch: '작업용음악', v: '조회수 41만회', d: '2일 전', len: '3:02:11', g: ['#2a3550', '#151a2b'] },
  { t: '전공 시험 2주 전에 하는 벼락치기 루틴', ch: '공부기록', v: '조회수 8.2만회', d: '5일 전', len: '18:44', g: ['#3a2a2a', '#1f1414'] },
  { t: '포모도로 공부법 실전편 — 25분 집중 × 6세트', ch: '스터디위드미', v: '조회수 15만회', d: '3일 전', len: '2:41:00', g: ['#1a3a2a', '#0d1f15'] },
  { t: '논문 처음 읽는 법 — 초록부터 결론까지', ch: '연구실생존기', v: '조회수 3.4만회', d: '1주 전', len: '32:07', g: ['#1f3040', '#0d1820'] },
  { t: '밤 11시 같이 공부해요 📚 조용한 스터디 with me', ch: '밤공부ASMR', v: '조회수 6.1만회', d: '1일 전', len: '1:58:22', g: ['#2a1f3a', '#15102a'] },
]

const SHELF = [
  { t: '이 구간 3초만 보세요', v: '조회수 122만회', g: ['#4B2E83', '#1b1f3b'] },
  { t: '편의점 조합 아세요?', v: '조회수 84만회', g: ['#8A4B2A', '#3b1f1b'] },
  { t: '조별과제 빌런 유형', v: '조회수 219만회', g: ['#2A8A6B', '#1f3b33'] },
  { t: '새벽 2시 과제하는 사람', v: '조회수 57만회', g: ['#2A5B8A', '#1f2a3b'] },
]

function VidCard({ v }) {
  return (
    <article className="yt-vid">
      <div
        className="yt-thumb"
        style={{ background: `linear-gradient(140deg,${v.g[0]},${v.g[1]})` }}
      >
        <span className="yt-len">{v.len}</span>
      </div>
      <div className="yt-meta">
        <span className="yt-avatar" />
        <span className="yt-meta-txt">
          <b>{v.t}</b>
          <i>{v.ch} · {v.v} · {v.d}</i>
        </span>
        <span className="yt-dots">⋮</span>
      </div>
    </article>
  )
}

function YTLogo() {
  // ShortsGlyph 재사용 — 꽃 모양 공유, 색은 .yt-logo { color: #cc0000 } 로 분기
  return (
    <span className="yt-logo">
      <ShortsGlyph size={26} />
      <b>MyTube</b>
    </span>
  )
}

function ShortsGlyph({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <path
        d="M13.4 3.2a3.6 3.6 0 0 1 1.5 5l-.6 1 1 .5a3.6 3.6 0 0 1-1.6 6.8 3.6 3.6 0 0 1-1.7-.5l-1-.6-.5 1a3.6 3.6 0 0 1-6.5-3l.6-1-1-.6a3.6 3.6 0 0 1 3.4-6.3l1 .5.6-1a3.6 3.6 0 0 1 4.8-1.3Z"
        fill="currentColor"
      />
      <path d="M8.4 7.1 L13 10 L8.4 12.9 Z" fill="#fff" />
    </svg>
  )
}

// 선택 가능한 UI 요소 래퍼
// dim     : app 선택 시 entry-point / app-tab 을 흐리게 표시 (선택 차단 없음)
// variant : 'grid' | 'nav' | 'inline' — 배지 위치 레이아웃 종류
//   grid   → display:grid 1fr 76px, 배지가 오른쪽 칸 (겹침 구조적 불가)
//   nav    → 탭 배지: flex-column, 배지가 아래
//   inline → 채널명 줄: flex row space-between, 배지가 오른쪽
function Hit({ id, label, selected, onPick, children, block, cue, dim, variant }) {
  const cls = 'hit' +
    (variant ? ' hit-' + variant : '') +
    (selected ? ' on' : '') +
    (block ? ' block' : '') +
    (cue ? ' cue' : '') +
    (dim ? ' sub' : '')
  return (
    <div
      className={cls}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation()
        onPick(id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPick(id)
        }
      }}
    >
      {variant === 'grid' ? <div className="hit-body">{children}</div> : children}
      <span className="hit-tag">
        <i>{selected ? '✓' : '+'}</i>
        {label}
      </span>
    </div>
  )
}

// ══ 홈 피드 ═══════════════════════════════════════════════
// selectable     : S1 범위 선택 모드. true 이면 4개 타겟에 배지+그리드 레이아웃 적용.
//                  기본값 false — 나중에 다른 카드에서 재사용할 때 배지가 뜨지 않는다.
// targets        : 레거시 시뮬 용도 (hit 래퍼 적용 id 목록). selectable 과 함께 쓰지 않는다.
// cue            : 레거시 유도 모드 ("여기를 누르세요" 레이블)
// preBlocked     : Pre-Access 시뮬 전용. true 면 숏폼 선반과 탭을 즉시 차단 상태로 렌더.
// onShortsAccess : At/InUse 시뮬 전용. Hit 없이 클릭 핸들러+시각적 유도만.
// ※ appSelected / dim / passive / noShorts 는 제거됨
export function MockHome({ picked = [], onPick, targets, cue, preBlocked = false, onShortsAccess, selectable = false, shelfStyle }) {
  const is = (id) => picked.includes(id)
  // selectable 이면 전체 타겟 활성. targets 명시 시 해당 id 만 (레거시 시뮬 용도).
  const live = (id) => selectable || (!!targets && targets.includes(id))

  // Hit 래퍼 헬퍼 — opacity dim 없음, 선택 여부만 on/off
  const T = ({ id, label, block, variant, children }) =>
    live(id) ? (
      <Hit
        id={id} label={label} selected={is(id)} onPick={onPick}
        block={block} cue={cue}
        variant={selectable ? variant : undefined}
      >
        {children}
      </Hit>
    ) : (
      children
    )

  // At/InUse 시뮬: Shorts 접근 클릭 핸들러 (Hit 없이 직접 바인딩)
  const handleShortsAccess = onShortsAccess
    ? (e) => { e.stopPropagation(); onShortsAccess() }
    : undefined

  // Shorts 선반 노드
  const shelfSection = (
    <section
      className={'yt-shelf' + (onShortsAccess ? ' sim-cue' : '')}
      onClick={handleShortsAccess}
      style={shelfStyle}
    >
      {/* 원래 콘텐츠: preBlocked 시 즉시 숨김 */}
      <div
        className="yt-shelf-content"
        style={preBlocked ? { opacity: 0, maxHeight: '1px', overflow: 'hidden' } : undefined}
      >
        <div className="yt-shelf-head">
          <ShortsGlyph />
          숏폼
        </div>
        <div className="yt-shelf-row">
          {SHELF.map((s) => (
            <div className="yt-short" key={s.t}>
              <div
                className="yt-short-thumb"
                style={{ background: `linear-gradient(150deg,${s.g[0]},${s.g[1]})` }}
              />
              <b>{s.t}</b>
              <i>{s.v}</i>
            </div>
          ))}
        </div>
      </div>
      {/* 차단 자리: preBlocked 시 즉시 표시 */}
      <div
        className="yt-shelf-placeholder"
        style={{ opacity: preBlocked ? 1 : 0 }}
        aria-label="숏폼 선반 - 차단됨"
      >
        숏폼 · 차단됨
      </div>
    </section>
  )

  // Shorts 탭 노드
  const shortsTab = (
    <span
      className={'yt-nav-item' + (onShortsAccess ? ' sim-cue' : '') + (preBlocked ? ' preblocked' : '')}
      role={onShortsAccess ? 'button' : undefined}
      tabIndex={onShortsAccess ? 0 : undefined}
      onClick={handleShortsAccess}
      onKeyDown={onShortsAccess ? (e) => (e.key === 'Enter' || e.key === ' ') && onShortsAccess() : undefined}
    >
      <span className="yt-nav-glyph">
        <ShortsGlyph size={17} />
        {preBlocked && (
          <span className="yt-nav-lock" aria-label="차단됨">🔒</span>
        )}
      </span>
      숏폼
    </span>
  )

  return (
    <div className="yt">
      {/* app 타겟: 앱 헤더 전체 (로고+아이콘) */}
      <T id="app" label={SCOPE_DISPLAY['app']} variant="grid">
        <header className="yt-top">
          <YTLogo />
          <span className="yt-top-icons">
            <span>⌗</span>
            <span>⌕</span>
            <span className="yt-avatar-sm" />
          </span>
        </header>
      </T>

      {/* Pre-Access: 배너 */}
      {preBlocked && (
        <div className="sim-pre-banner">
          <span>●</span>
          홈의 숏폼 줄과 하단 숏폼 탭이 잠겼어요
        </div>
      )}

      {/* content 타겟 진입점: 카테고리 칩 묶음 */}
      <T id="content" label={SCOPE_DISPLAY['content']} variant="grid">
        <div className="yt-chips">
          {CHIPS.map((c, i) => (
            <span key={c} className={'yt-chip' + (i === 0 ? ' on' : '')}>
              {c}
            </span>
          ))}
        </div>
      </T>

      <div className="yt-body">
        <VidCard v={LONGFORM[0]} />

        {/* Shorts 선반 */}
        {live('entry-point')
          ? <T id="entry-point" label={SCOPE_DISPLAY['entry-point']} block variant="grid">{shelfSection}</T>
          : shelfSection
        }

        {LONGFORM.slice(1).map((v) => (
          <VidCard key={v.t} v={v} />
        ))}
      </div>

      <nav className="yt-nav">
        <span className="yt-nav-item on">
          <span className="yt-nav-glyph">⌂</span>홈
        </span>
        {/* Shorts 탭 */}
        {live('app-tab')
          ? <T id="app-tab" label={cue ? '여기를 누르세요' : SCOPE_DISPLAY['app-tab']} variant="nav">{shortsTab}</T>
          : shortsTab
        }
        <span className="yt-nav-item">
          <span className="yt-nav-plus">＋</span>
        </span>
        <span className="yt-nav-item">
          <span className="yt-nav-glyph">▤</span>구독
        </span>
        <span className="yt-nav-item">
          <span className="yt-nav-glyph">◔</span>나
        </span>
      </nav>
    </div>
  )
}

// ══ Shorts 플레이어 ══════════════════════════════════════
export function MockShorts({ video, picked, onPick, interactive = true, playing }) {
  const is = (id) => picked?.includes(id)
  const wrap = (id, label, node, block) =>
    interactive ? (
      <Hit id={id} label={label} selected={is(id)} onPick={onPick} block={block}>
        {node}
      </Hit>
    ) : (
      node
    )

  return (
    <div className="sp">
      <div
        className={'sp-visual' + (playing ? ' playing' : '')}
        style={{ background: `linear-gradient(150deg,${video.grad[0]},${video.grad[1]})` }}
      />
      <div className="sp-scrim" />

      <div className="sp-top">
        <span className="sp-top-title">
          <ShortsGlyph size={14} /> 숏폼
        </span>
        <span className="sp-top-icons">
          <span>⌕</span>
          <span>⋮</span>
        </span>
      </div>

      <div className="sp-rail">
        <span className="sp-rail-item">
          <b>♡</b>
          {video.likes}
        </span>
        <span className="sp-rail-item">
          <b>♡̶</b>
          싫어요
        </span>
        <span className="sp-rail-item">
          <b>💬</b>
          {video.seconds * 7}
        </span>
        <span className="sp-rail-item">
          <b>↗</b>
          공유
        </span>
        <span className="sp-rail-item">
          <b>⟳</b>
          리믹스
        </span>
        <span className="sp-disc" />
      </div>

      <div className="sp-bottom">
        <div className="sp-channel">
          <span className="sp-ch-avatar" />
          <b>@{video.creator}</b>
          <span className="sp-sub">구독</span>
        </div>
        <div className="sp-title">{video.title}</div>
        <div className="sp-tags">
          <span className="sp-tag">#{video.categoryLabel}</span>
          <span className="sp-tag">#숏폼</span>
        </div>
        <div className="sp-audio">
          <span>♪</span> 원본 오디오 · @{video.creator}
        </div>
      </div>

      <nav className="yt-nav on-dark">
        <span className="yt-nav-item">
          <span className="yt-nav-glyph">⌂</span>홈
        </span>
        <span className="yt-nav-item on">
          <span className="yt-nav-glyph">
            <ShortsGlyph size={17} />
          </span>
          숏폼
        </span>
        <span className="yt-nav-item">
          <span className="yt-nav-plus">＋</span>
        </span>
        <span className="yt-nav-item">
          <span className="yt-nav-glyph">▤</span>구독
        </span>
        <span className="yt-nav-item">
          <span className="yt-nav-glyph">◔</span>나
        </span>
      </nav>
    </div>
  )
}
