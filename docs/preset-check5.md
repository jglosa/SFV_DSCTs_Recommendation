# preset-check5.md — 2026-09-15

변경: (1) worksOn filter.length 단순화 (2) osMatchCount 명시적 0 (3) buildWarnings 플랫폼 갭 수정

비교 기준: preset-check4.md

## P1 · 최소 응답

기능: `notify-entry|path-guide|visual-demotion`  ← 이전과 동일
앱:   12_SZ / 1_S / 4_A  ← 이전과 동일
envGaps: 없음

앱 점수표 (pool 21개):
```
★ 12_SZ  ScreenZen        OS2 C2 S1 E3 Sc1 B2
★ 1_S    StayFree         OS2 [C1] S1 E3 Sc1 B1
★ 4_A    Ascent           OS2 C1 S1 E3 Sc1 [B0]
· 2_SF   Stay Focused     OS2 [C0] S1 E3 Sc1 B2
· 9_WH   WallHabit        OS2 C0 S1 E3 Sc1 B2
· 10_SG  ScrollGuard      OS2 C0 S1 E3 [Sc0] B2
· 16_UT  UnTrap           [OS1] C2 S1 E1 Sc1 B1
· 17_NL  No Scroll        OS1 C2 [S0] E1 Sc1 B1
· 13_M   Mindful          OS1 [C1] S1 E3 Sc1 B1
· 19_SH  SocialFocus      OS1 C1 S1 [E2] Sc0 B1
· 21_C   Cape             OS1 C1 [S0] E1 Sc1 B2
· 14_R   Regain           OS1 [C0] S1 E3 Sc1 B1
· 3_D    Digitox          OS1 C0 S1 E3 Sc1 B1
· 6_BS   Block Scroll     OS1 C0 S1 E3 Sc1 [B0]
· 5_N    NoScroll         OS1 C0 S1 E3 [Sc0] B1
· 11_SB  Scroll Block     OS1 C0 S1 E3 Sc0 [B0]
· 7_NS   NoShorts         OS1 C0 S1 E3 Sc0 B0
· 8_SS   StopScroll       OS1 C0 S1 E3 Sc0 B0
· 15_SY  Shorts Blocker   OS1 C0 S1 [E1] Sc0 B0
· 20_J   Jomo             OS1 C0 [S0] E1 Sc1 B2
· 18_CR  CloseReels       OS1 C0 S0 E1 [Sc0] B0
```

## P2 · 전부 수용

기능: `mission-exercise|mission-capture|mission-simple`  ← 이전과 동일
앱:   2_SF / 12_SZ / 4_A  ← 이전과 동일
envGaps: 없음

앱 점수표 (pool 21개):
```
★ 2_SF   Stay Focused     OS2 C2 S1 E3 Sc1 B2
★ 12_SZ  ScreenZen        OS2 [C1] S1 E3 Sc1 B2
★ 4_A    Ascent           OS2 C1 S1 E3 Sc1 [B0]
· 9_WH   WallHabit        OS2 [C0] S1 E3 Sc1 B2
· 1_S    StayFree         OS2 C0 S1 E3 Sc1 [B1]
· 10_SG  ScrollGuard      OS2 C0 S1 E3 [Sc0] B2
· 20_J   Jomo             [OS1] C2 S0 E1 Sc1 B2
· 18_CR  CloseReels       OS1 [C1] S0 E1 Sc0 B0
· 13_M   Mindful          OS1 [C0] S1 E3 Sc1 B1
· 14_R   Regain           OS1 C0 S1 E3 Sc1 B1
· 3_D    Digitox          OS1 C0 S1 E3 Sc1 B1
· 6_BS   Block Scroll     OS1 C0 S1 E3 Sc1 [B0]
· 5_N    NoScroll         OS1 C0 S1 E3 [Sc0] B1
· 11_SB  Scroll Block     OS1 C0 S1 E3 Sc0 [B0]
· 7_NS   NoShorts         OS1 C0 S1 E3 Sc0 B0
· 8_SS   StopScroll       OS1 C0 S1 E3 Sc0 B0
· 19_SH  SocialFocus      OS1 C0 S1 [E2] Sc0 B1
· 16_UT  UnTrap           OS1 C0 S1 [E1] Sc1 B1
· 15_SY  Shorts Blocker   OS1 C0 S1 E1 [Sc0] B0
· 21_C   Cape             OS1 C0 [S0] E1 Sc1 B2
· 17_NL  No Scroll        OS1 C0 S0 E1 Sc1 [B1]
```

## P3 · 전부 과함

기능: `mission-exercise|mission-capture|mission-simple`  ← 이전과 동일
앱:   2_SF / 12_SZ / 4_A  ← 이전과 동일
envGaps: 없음

앱 점수표 (pool 21개):
```
★ 2_SF   Stay Focused     OS2 C2 S1 E3 Sc1 B2
★ 12_SZ  ScreenZen        OS2 [C1] S1 E3 Sc1 B2
★ 4_A    Ascent           OS2 C1 S1 E3 Sc1 [B0]
· 9_WH   WallHabit        OS2 [C0] S1 E3 Sc1 B2
· 1_S    StayFree         OS2 C0 S1 E3 Sc1 [B1]
· 10_SG  ScrollGuard      OS2 C0 S1 E3 [Sc0] B2
· 20_J   Jomo             [OS1] C2 S0 E1 Sc1 B2
· 18_CR  CloseReels       OS1 [C1] S0 E1 Sc0 B0
· 13_M   Mindful          OS1 [C0] S1 E3 Sc1 B1
· 14_R   Regain           OS1 C0 S1 E3 Sc1 B1
· 3_D    Digitox          OS1 C0 S1 E3 Sc1 B1
· 6_BS   Block Scroll     OS1 C0 S1 E3 Sc1 [B0]
· 5_N    NoScroll         OS1 C0 S1 E3 [Sc0] B1
· 11_SB  Scroll Block     OS1 C0 S1 E3 Sc0 [B0]
· 7_NS   NoShorts         OS1 C0 S1 E3 Sc0 B0
· 8_SS   StopScroll       OS1 C0 S1 E3 Sc0 B0
· 19_SH  SocialFocus      OS1 C0 S1 [E2] Sc0 B1
· 16_UT  UnTrap           OS1 C0 S1 [E1] Sc1 B1
· 15_SY  Shorts Blocker   OS1 C0 S1 E1 [Sc0] B0
· 21_C   Cape             OS1 C0 [S0] E1 Sc1 B2
· 17_NL  No Scroll        OS1 C0 S0 E1 Sc1 [B1]
```

## P4 · 완전 차단

기능: `block-app|block-content|block-scroll`  ← 이전과 동일
앱:   2_SF / 1_S / 12_SZ  ← 이전과 동일
envGaps: 없음

앱 점수표 (pool 21개):
```
★ 2_SF   Stay Focused     OS2 C2 S1 E3 Sc1 B2
★ 1_S    StayFree         OS2 C2 S1 E3 Sc1 [B1]
★ 12_SZ  ScreenZen        OS2 [C1] S1 E3 Sc1 B2
· 9_WH   WallHabit        OS2 C1 S1 E3 Sc1 B2
· 4_A    Ascent           OS2 [C0] S1 E3 Sc1 B0
· 10_SG  ScrollGuard      OS2 C0 S1 E3 [Sc0] B2
· 14_R   Regain           [OS1] C2 S1 E3 Sc1 B1
· 6_BS   Block Scroll     OS1 C2 S1 E3 Sc1 [B0]
· 5_N    NoScroll         OS1 C2 S1 E3 [Sc0] B1
· 16_UT  UnTrap           OS1 C2 S1 [E1] Sc1 B1
· 13_M   Mindful          OS1 [C1] S1 E3 Sc1 B1
· 3_D    Digitox          OS1 C1 S1 E3 Sc1 B1
· 15_SY  Shorts Blocker   OS1 C1 S1 [E1] Sc0 B0
· 20_J   Jomo             OS1 C1 [S0] E1 Sc1 B2
· 21_C   Cape             OS1 C1 S0 E1 Sc1 B2
· 17_NL  No Scroll        OS1 C1 S0 E1 Sc1 [B1]
· 11_SB  Scroll Block     OS1 [C0] S1 E3 Sc0 B0
· 7_NS   NoShorts         OS1 C0 S1 E3 Sc0 B0
· 8_SS   StopScroll       OS1 C0 S1 E3 Sc0 B0
· 19_SH  SocialFocus      OS1 C0 S1 [E2] Sc0 B1
· 18_CR  CloseReels       OS1 C0 [S0] E1 Sc0 B0
```

## P5 · 평가 최소

기능: `confirm|mission-exercise|mission-capture`  ← 이전과 동일
앱:   4_A / 12_SZ / 2_SF  ← 이전과 동일
envGaps: 없음

앱 점수표 (pool 21개):
```
★ 4_A    Ascent           OS2 C2 S1 E3 Sc1 B0
★ 12_SZ  ScreenZen        OS2 [C1] S1 E3 Sc1 B2
★ 2_SF   Stay Focused     OS2 C1 S1 E3 Sc1 B2
· 9_WH   WallHabit        OS2 [C0] S1 E3 Sc1 B2
· 1_S    StayFree         OS2 C0 S1 E3 Sc1 [B1]
· 10_SG  ScrollGuard      OS2 C0 S1 E3 [Sc0] B2
· 20_J   Jomo             [OS1] C2 S0 E1 Sc1 B2
· 18_CR  CloseReels       OS1 C2 S0 E1 [Sc0] B0
· 13_M   Mindful          OS1 [C0] S1 E3 Sc1 B1
· 14_R   Regain           OS1 C0 S1 E3 Sc1 B1
· 3_D    Digitox          OS1 C0 S1 E3 Sc1 B1
· 6_BS   Block Scroll     OS1 C0 S1 E3 Sc1 [B0]
· 5_N    NoScroll         OS1 C0 S1 E3 [Sc0] B1
· 11_SB  Scroll Block     OS1 C0 S1 E3 Sc0 [B0]
· 7_NS   NoShorts         OS1 C0 S1 E3 Sc0 B0
· 8_SS   StopScroll       OS1 C0 S1 E3 Sc0 B0
· 19_SH  SocialFocus      OS1 C0 S1 [E2] Sc0 B1
· 16_UT  UnTrap           OS1 C0 S1 [E1] Sc1 B1
· 15_SY  Shorts Blocker   OS1 C0 S1 E1 [Sc0] B0
· 21_C   Cape             OS1 C0 [S0] E1 Sc1 B2
· 17_NL  No Scroll        OS1 C0 S0 E1 Sc1 [B1]
```

## P6 · 지원 없는 환경

기능: `path-guide|visual-demotion|notify-entry`  ← 이전과 동일
앱:   12_SZ / 1_S / 13_M  ← 이전과 동일
envGaps: 없음

앱 점수표 (pool 14개):
```
★ 12_SZ  ScreenZen        OS1 C2 S1 E2 Sc1 B2
★ 1_S    StayFree         OS1 [C1] S1 E2 Sc1 B1
★ 13_M   Mindful          OS1 C1 S1 E2 Sc1 B1
· 4_A    Ascent           OS1 C1 S1 E2 Sc1 [B0]
· 2_SF   Stay Focused     OS1 [C0] S1 E2 Sc1 B2
· 9_WH   WallHabit        OS1 C0 S1 E2 Sc1 B2
· 14_R   Regain           OS1 C0 S1 E2 Sc1 [B1]
· 3_D    Digitox          OS1 C0 S1 E2 Sc1 B1
· 6_BS   Block Scroll     OS1 C0 S1 E2 Sc1 [B0]
· 10_SG  ScrollGuard      OS1 C0 S1 E2 [Sc0] B2
· 5_N    NoScroll         OS1 C0 S1 E2 Sc0 [B1]
· 11_SB  Scroll Block     OS1 C0 S1 E2 Sc0 [B0]
· 7_NS   NoShorts         OS1 C0 S1 E2 Sc0 B0
· 8_SS   StopScroll       OS1 C0 S1 E2 Sc0 B0
```

## envGap 로직 단위 테스트

nonAppScopes=['shorts-tab'], inAppPlatforms=null 앱 → gap 발생: ["YouTube","Instagram"]
기대: ["YouTube","Instagram"]
결과: PASS

## desktop osMatchCount 단위 테스트

userMobileOs=[] → 전체 osMatchCount=0: PASS
poolSize (필터 없음): 21
