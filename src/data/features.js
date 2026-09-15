// ─────────────────────────────────────────────────────────────
// features.js — features.json v3.0 어댑터
//
// JSON이 단일 진실 공급원이다. 데이터를 여기에 다시 적지 않는다.
// ─────────────────────────────────────────────────────────────

import raw from './features.json'

// ── 기능 배열 (27개, role: intervention / trigger / bypass / exclude) ──
export const FEATURES = raw.features

export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f]))

// ── 개입 기능 (role: intervention, 18개) — 추천 후보 풀 ────────
export const INTERVENTIONS = FEATURES.filter((f) => f.role === 'intervention')

// ── 강도 레벨 10단 (level 1~10) ────────────────────────────────
export const LEVELS = raw.levels

// ── agency 레벨 3단 (supported / flexible / limited), order 오름차순 ──
export const AGENCY_LEVELS = [...raw.agencyLevels].sort((a, b) => a.order - b.order)

// ── 통제 범위: id → 한국어 레이블 ──────────────────────────────
export const SCOPE_LEVELS = Object.fromEntries(
  raw.scopeLevels.map((s) => [s.id, s.nameKo])
)

// ── 통제 범위 전체 배열 (S1 목록 렌더링용) ─────────────────────
export const SCOPE_LEVELS_ARRAY = raw.scopeLevels

// ── 통제 범위 참가자용 배지 표현 — S1 화면·기능 상세 공통 사용 ──
export const SCOPE_DISPLAY = Object.fromEntries(
  raw.scopeLevels.map((s) => [s.id, s.badge])
)

// ── 우회 시나리오 — features.json bypassTargets에서 직접 export ──
export const BYPASS_TARGETS = raw.bypassTargets

// ── 저항 레이블 — featureId 키 ──────────────────────────────────
export const RESISTANCE_LABEL = Object.fromEntries(
  raw.bypassTargets.map((b) => [b.featureId, b.nameKo])
)
