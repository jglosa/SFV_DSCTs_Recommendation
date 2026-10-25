# SFV 디지털 자기통제 도구 추천 시스템

숏폼 비디오 과사용을 다루는 디지털 자기통제 도구(DSCT)에 대한 사용자 선호를 유도하는 연구용 프로토타입.

---

## 접속 링크

| 용도 | URL |
|---|---|
| **참가자 설문** | `https://jglosa.github.io/SFV_DSCTs_Recommendation/?monitor=0` |
| **시연용 (노트북)** | `https://jglosa.github.io/SFV_DSCTs_Recommendation/` |
| **세션 전체 목록 + CSV** | `https://jglosa.github.io/SFV_DSCTs_Recommendation/?view=monitor` |
| **특정 세션 실시간 모니터** | `https://jglosa.github.io/SFV_DSCTs_Recommendation/?view=monitor&sid=<세션ID>` |
| **결과 공유 링크** | `https://jglosa.github.io/SFV_DSCTs_Recommendation/?view=result&sid=<세션ID>` |

> `?monitor=0`을 붙이면 오른쪽 시연 패널이 숨겨진다. 참가자 폰에서 사용할 때는 이 링크를 QR코드로 제공.

---

## 연구 세션 운영 방법

1. 참가자가 폰에서 **참가자 설문 링크** 접속 → 참가자 ID 입력 → 시작
2. 연구자는 노트북에서 **세션 전체 목록** 열고 새로고침하면 해당 참가자 세션 확인 가능
3. 목록에서 "모니터 →" 클릭 → 해당 세션 실시간 모니터로 이동
4. 완료 후 **CSV 다운로드**로 전체 또는 개별 세션 데이터 추출

---

## 구조의 핵심

설문 전체가 하나의 `scroll-snap` 피드다. 질문 카드와 영상 카드가 같은 스크롤 면에 섞여 있고, **답하면 아래에 다음 카드가 생긴다.** 위로 밀어서 넘어간다. "다음" 버튼은 없다.

아직 답하지 않은 질문 아래에는 카드가 존재하지 않으므로 그냥 넘길 수 없다. 스크롤을 막는 방식이 아니라, 넘길 대상이 아직 없는 방식이다.

---

## 카드 흐름

| 단계 | 내용 | 조작 |
|---|---|---|
| — | 인트로 + 참가자 ID 입력 | ID 입력 → 시작 버튼 → swipe |
| **S0** | SFV 사용 환경 — 기기 / 경로 / 플랫폼 | 복수 선택, 기타 → 주관식 |
| **S1** | 통제 범위 | 모의 앱 UI에서 요소를 직접 탭 |
| **S2** | 통제 규칙 (Scheduling) | 원형 24시간 시계, 탭·드래그 |
| **S3** | 개입 시점 | 시뮬레이션 ×3 (Pre / At / InUse) → 순위 |
| **S4** | 개입 강도 | enforcement 4단계 일괄 제시, 항목별 수용 여부 |
| **S5** | 우회·임시해제 | 시나리오 4개, yes/no |
| — | 결과 | 아키타입 · 추천 기능 · 추천 앱 · 판정 근거 |

---

## 로컬 실행

Node.js 18 이상.

```bash
npm install
npm run dev
```

`.env` 파일 필요:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

주소가 두 개 뜬다.

```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.0.xx:5173/
```

- **노트북** → `Local`. 오른쪽에 시연 패널 표시.
- **같은 wifi의 휴대폰** → `Network` 주소 입력. 시연 패널 자동 숨김.

### 휴대폰에서 앱처럼 띄우기

iOS Safari → 공유 → "홈 화면에 추가". Android Chrome → 메뉴 → "홈 화면에 추가". 주소창이 사라져서 실제 앱과 비슷해진다.

---

## 파일 구조

```
src/
  App.jsx              무대 + Supabase 세션 동기화
  store.js             단일 상태 객체 + 리듀서
  deck.js              카드 시퀀스 정의 (S0~S5)
  engine.js            규칙 기반 추천 엔진
  lib/
    supabase.js        Supabase 클라이언트
  data/
    features.js        기능 DB + 우회 시나리오
    apps.js            앱 DB
    videos.js          영상 풀
  components/
    Deck.jsx           scroll-snap 피드, 카드 append
    Cards.jsx          카드 렌더러 전부
    MockYouTube.jsx    모의 앱 UI (홈 / Shorts 플레이어)
    Clock24.jsx        원형 24시간 시계
    Intervention.jsx   개입 오버레이 3종
    ResultCard.jsx     결과 화면
    DetailPanel.jsx    기능/앱 상세 패널
    DebugPanel.jsx     시연 모니터 패널 (노트북 전용)
    MonitorView.jsx    원격 세션 모니터 + 전체 목록
    SharedResult.jsx   결과 공유 화면
```

---

## 배포

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드 & GitHub Pages에 배포한다.

Supabase 환경변수는 GitHub 레포 **Settings → Secrets and variables → Actions** 에서 설정:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
