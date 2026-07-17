import type { ColorName } from './types'

export interface ThemeTokens {
  bgApp: string
  bgElevated: string
  bgCard: string
  bgHover: string
  border: string
  text1: string
  text2: string
  text3: string
  accent: string
  accentSoft: string
  accentStrong: string
  accentShadow: string
  shadow: string
  violetSoft: string
  violet: string
  cardBorder: string
  cardShadow: string
}

export const lightTokens: ThemeTokens = {
  bgApp: '#FAFAFA',
  bgElevated: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgHover: '#F2F2F3',
  border: '#EAEAEC',
  text1: '#171717',
  text2: '#6B6B70',
  text3: '#A0A0A6',
  accent: '#FF4D6D',
  accentSoft: '#FFE3E8',
  accentStrong: '#E0345A',
  accentShadow: 'rgba(255,77,109,.30)',
  shadow: 'rgba(20,20,25,.08)',
  violetSoft: '#EFEBFF',
  violet: '#7C6AFA',
  cardBorder: 'none',
  cardShadow: '0 1px 2px rgba(20,20,25,.05), 0 1px 8px rgba(20,20,25,.04)',
}

export const darkTokens: ThemeTokens = {
  bgApp: '#0E0E10',
  bgElevated: '#161618',
  bgCard: '#19191C',
  bgHover: '#222226',
  border: 'rgba(255,255,255,0.08)',
  text1: '#F5F5F7',
  text2: '#B0B0B6',
  text3: '#77777E',
  accent: '#FF6B85',
  accentSoft: 'rgba(255,107,133,.18)',
  accentStrong: '#FF8FA3',
  accentShadow: 'rgba(255,107,133,.35)',
  shadow: 'rgba(0,0,0,.55)',
  violetSoft: 'rgba(155,140,255,.18)',
  violet: '#9B8CFF',
  cardBorder: '1px solid rgba(255,255,255,0.08)',
  cardShadow: 'none',
}

/** Builds the CSS custom-property string applied to the app root. */
export function rootVars(dark: boolean): string {
  const c = dark ? darkTokens : lightTokens
  return [
    `--bg-app:${c.bgApp}`,
    `--bg-elevated:${c.bgElevated}`,
    `--bg-card:${c.bgCard}`,
    `--bg-hover:${c.bgHover}`,
    `--border:${c.border}`,
    `--text-1:${c.text1}`,
    `--text-2:${c.text2}`,
    `--text-3:${c.text3}`,
    `--accent:${c.accent}`,
    `--accent-soft:${c.accentSoft}`,
    `--accent-strong:${c.accentStrong}`,
    `--accent-shadow:${c.accentShadow}`,
    `--shadow:${c.shadow}`,
    `--violet-soft:${c.violetSoft}`,
    `--violet:${c.violet}`,
    `--card-border:${c.cardBorder}`,
    `--card-shadow:${c.cardShadow}`,
  ].join(';')
}

/** Returns [background, foreground] for a soft colored badge/avatar. */
export function colorMap(name: ColorName, dark: boolean): [string, string] {
  const light: Record<ColorName, [string, string]> = {
    accent: ['#FFE3E8', '#E0345A'],
    info: ['#E3F6F5', '#2E9D9A'],
    violet: ['#EFEBFF', '#7C6AFA'],
    warn: ['#FFF2DC', '#C98315'],
    success: ['#E3F5EC', '#2F8F63'],
  }
  const darkMap: Record<ColorName, [string, string]> = {
    accent: ['rgba(255,107,133,.18)', '#FF8FA3'],
    info: ['rgba(95,209,206,.18)', '#5FD1CE'],
    violet: ['rgba(155,140,255,.18)', '#9B8CFF'],
    warn: ['rgba(255,196,105,.18)', '#FFC469'],
    success: ['rgba(79,203,147,.18)', '#5FD9A6'],
  }
  const m = dark ? darkMap : light
  return m[name] || m.accent
}
