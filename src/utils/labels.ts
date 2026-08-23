// ─── Unified Verdict Label System ────────────────────────────────────────────
// Single source of truth for all user-facing verdict labels across the app.
// Every screen must import from here instead of defining their own logic.

import type { FactCheckLog } from '@/types';

export type SomiqLabel = 'Factual' | 'Misleading' | 'Partially True' | 'Opinion/Context' | 'Reviewing' | 'Failed' | 'Inconclusive';

export interface LabelConfig {
  label: SomiqLabel;
  /** Hex color for text / icon */
  color: string;
  /** rgba background */
  bg: string;
  /** rgba border */
  border: string;
  /** Tailwind classes (for screens that use NativeWind) */
  bgClass: string;
  borderClass: string;
  textClass: string;
}

/**
 * Maps a FactCheckLog to the consistent Somiq verification label.
 *
 * Label mapping rules (in priority order):
 * 1. PENDING / PROCESSING → "Reviewing" (blue)
 * 2. FAILED               → "Failed"    (red)
 * 3. COMPLETED + !isFactualClaim or isContentCorrect === 'Unverifiable'
 *                         → "Opinion/Context" (gold/amber)
 * 4. COMPLETED + isContentCorrect === 'Yes'
 *                         → "Factual"   (primary/green)
 * 5. COMPLETED + isContentCorrect === 'No'
 *                         → "Misleading"(red)
 * 6. COMPLETED + isContentCorrect === 'Partially'
 *                         → "Partially True" (amber)
 * 7. default              → "Opinion/Context" (gold/amber)
 */
export function getSomiqLabel(log: FactCheckLog): LabelConfig {
  // Pending / Processing
  if (log.status === 'PENDING' || log.status === 'PROCESSING') {
    return {
      label: 'Reviewing',
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.1)',
      border: 'rgba(59,130,246,0.25)',
      bgClass: 'bg-blue-500/10',
      borderClass: 'border-blue-500/20',
      textClass: 'text-blue-400',
    };
  }

  // Failed
  if (log.status === 'FAILED') {
    return {
      label: 'Failed',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.1)',
      border: 'rgba(239,68,68,0.25)',
      bgClass: 'bg-red-500/10',
      borderClass: 'border-red-500/20',
      textClass: 'text-red-400',
    };
  }

  // Completed
  if (log.status === 'COMPLETED') {
    // Inconclusive status check
    if (log.isContentCorrect === 'Inconclusive') {
      return {
        label: 'Inconclusive',
        color: '#9ca3af',
        bg: 'rgba(156,163,175,0.1)',
        border: 'rgba(156,163,175,0.25)',
        bgClass: 'bg-gray-500/10',
        borderClass: 'border-gray-500/20',
        textClass: 'text-gray-400',
      };
    }

    // Non-factual or unverifiable → Opinion/Context
    if (!log.isFactualClaim || log.isContentCorrect === 'Unverifiable') {
      return {
        label: 'Opinion/Context',
        color: '#B45309',
        bg: 'rgba(180,83,9,0.1)',
        border: 'rgba(180,83,9,0.25)',
        bgClass: 'bg-gold/10',
        borderClass: 'border-gold/20',
        textClass: 'text-gold',
      };
    }

    // Factual
    if (log.isContentCorrect === 'Yes') {
      return {
        label: 'Factual',
        color: '#10b981',
        bg: 'rgba(16,185,129,0.1)',
        border: 'rgba(16,185,129,0.25)',
        bgClass: 'bg-emerald-500/10',
        borderClass: 'border-emerald-500/20',
        textClass: 'text-emerald-500',
      };
    }

    // Misleading (outright false)
    if (log.isContentCorrect === 'No') {
      return {
        label: 'Misleading',
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.1)',
        border: 'rgba(239,68,68,0.25)',
        bgClass: 'bg-red-500/10',
        borderClass: 'border-red-500/20',
        textClass: 'text-red-400',
      };
    }

    // Partially True (mixed results)
    if (log.isContentCorrect === 'Partially') {
      return {
        label: 'Partially True',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.1)',
        border: 'rgba(245,158,11,0.25)',
        bgClass: 'bg-amber-500/10',
        borderClass: 'border-amber-500/20',
        textClass: 'text-amber-500',
      };
    }
  }

  // Default fallback
  return {
    label: 'Opinion/Context',
    color: '#B45309',
    bg: 'rgba(180,83,9,0.1)',
    border: 'rgba(180,83,9,0.25)',
    bgClass: 'bg-gold/10',
    borderClass: 'border-gold/20',
    textClass: 'text-gold',
  };
}

/**
 * Maps an AI-engine per-claim verdict to a display config.
 * Used in ResultScreen's Claims tab.
 */
export function getClaimVerdictConfig(verdict: string): {
  text: string;
  color: string;
  symbol: string;
  iconName: 'check-circle' | 'cancel' | 'warning' | 'update' | 'auto-awesome' | 'help';
} {
  switch (verdict) {
    case 'TRUE':
      return { text: 'Factual', color: '#10b981', symbol: '✓', iconName: 'check-circle' };
    case 'FALSE':
      return { text: 'Misleading', color: '#ef4444', symbol: '✗', iconName: 'cancel' };
    case 'MISLEADING':
      return { text: 'Misleading', color: '#f59e0b', symbol: '!', iconName: 'warning' };
    case 'PARTIALLY_TRUE':
      return { text: 'Partially True', color: '#f59e0b', symbol: '~', iconName: 'warning' };
    case 'DIRECTIONALLY_CORRECT':
      return { text: 'Directionally Correct', color: '#10b981', symbol: '≈', iconName: 'check-circle' };
    case 'TECHNICALLY_FLAWED':
      return { text: 'Technically Flawed', color: '#f97316', symbol: '⚠', iconName: 'warning' };
    case 'OUTDATED':
      return { text: 'Outdated', color: '#f59e0b', symbol: '!', iconName: 'update' };
    case 'SATIRE':
      return { text: 'Opinion', color: '#8b5cf6', symbol: '✦', iconName: 'auto-awesome' };
    case 'INCONCLUSIVE':
      return { text: 'Inconclusive', color: '#9ca3af', symbol: '?', iconName: 'help' };
    default:
      return { text: 'Inconclusive', color: '#9ca3af', symbol: '?', iconName: 'help' };
  }
}
