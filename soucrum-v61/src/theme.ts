import type { ColorName } from './types'

/**
 * Visual do SouCrum: vidro sobre fundo escuro com brilho magenta.
 *
 * Todo o aspecto vive aqui. Os componentes só leem `var(--...)`, então trocar
 * a aparência não exige tocar em nenhuma view — foi assim que esta UI entrou
 * sem mudar a estrutura do app.
 */

export interface ThemeTokens {
  bgApp: string
  /** Camadas de brilho aplicadas na raiz, por cima de bgApp. */
  bgGlow: string
  bgElevated: string
  bgCard: string
  bgHover: string
  border: string
  text1: string
  text2: string
  text3: string
  /**
   * Cor do texto sobre superfície invertida (a pílula em `text1`, como o item
   * ativo do menu). Sem isto, o rótulo herdaria `bgCard`, que agora é
   * translúcido, e desapareceria dentro da pílula.
   */
  onInvert: string
  accent: string
  accentSoft: string
  accentStrong: string
  accentShadow: string
  shadow: string
  violetSoft: string
  violet: string
  cardBorder: string
  cardShadow: string
  /** Raio dos cartões. O visual pede canto bem mais macio que o anterior. */
  radiusCard: string
  /** Desfoque do vidro. Vazio em telas que não suportam. */
  blur: string
  /** Gradiente de marca, para o selo e os destaques. */
  brandGradient: string
}

export const lightTokens: ThemeTokens = {
  bgApp: '#F6EBF1',
  bgGlow: [
    'radial-gradient(1100px 700px at 12% -10%, rgba(225,14,69,.16), transparent 60%)',
    'radial-gradient(900px 600px at 92% 8%, rgba(200,107,255,.16), transparent 62%)',
    'radial-gradient(700px 520px at 50% 108%, rgba(255,46,99,.10), transparent 60%)',
  ].join(','),
  bgElevated: 'rgba(255,255,255,.62)',
  bgCard: 'rgba(255,255,255,.76)',
  bgHover: 'rgba(225,14,69,.07)',
  border: 'rgba(90,10,45,.11)',
  text1: '#1C0710',
  text2: '#6C5060',
  text3: '#9B8290',
  onInvert: '#FFF4F8',
  accent: '#E10E45',
  accentSoft: 'rgba(225,14,69,.12)',
  accentStrong: '#AE0733',
  accentShadow: 'rgba(225,14,69,.28)',
  shadow: 'rgba(70,10,40,.12)',
  violetSoft: 'rgba(176,74,255,.13)',
  violet: '#A93CF0',
  cardBorder: '1px solid rgba(255,255,255,.65)',
  cardShadow: 'inset 0 1px 0 rgba(255,255,255,.75), 0 20px 42px -26px rgba(90,10,45,.34)',
  radiusCard: '22px',
  blur: 'blur(18px)',
  brandGradient: 'linear-gradient(135deg,#E10E45,#A93CF0)',
}

export const darkTokens: ThemeTokens = {
  bgApp: '#10030B',
  bgGlow: [
    // O brilho é fixo na viewport, então as posições são em relação à tela —
    // nada de 110%, que cairia fora do quadro e não apareceria.
    'radial-gradient(1150px 760px at 30% -6%, rgba(255,20,80,.50), transparent 64%)',
    'radial-gradient(1050px 720px at 97% 12%, rgba(196,22,134,.52), transparent 66%)',
    'radial-gradient(1000px 700px at 62% 98%, rgba(150,12,90,.46), transparent 66%)',
    'radial-gradient(820px 560px at 8% 76%, rgba(104,8,62,.42), transparent 68%)',
  ].join(','),
  // Vidro claro por cima do brilho: é o que deixa o magenta atravessar o
  // cartão em vez de virar cinza. Só funciona com a floração forte acima.
  bgElevated: 'rgba(255,255,255,.045)',
  bgCard: 'rgba(255,255,255,.07)',
  bgHover: 'rgba(255,255,255,.10)',
  border: 'rgba(255,255,255,.13)',
  text1: '#FDF4F8',
  text2: 'rgba(253,244,248,.68)',
  text3: 'rgba(253,244,248,.42)',
  onInvert: '#17040E',
  accent: '#FF2E63',
  accentSoft: 'rgba(255,46,99,.20)',
  accentStrong: '#FF7096',
  accentShadow: 'rgba(255,46,99,.42)',
  shadow: 'rgba(0,0,0,.6)',
  violetSoft: 'rgba(200,107,255,.18)',
  violet: '#C86BFF',
  cardBorder: '1px solid rgba(255,255,255,.11)',
  cardShadow: 'inset 0 1px 0 rgba(255,255,255,.07), 0 24px 50px -28px rgba(0,0,0,.75)',
  radiusCard: '22px',
  blur: 'blur(20px)',
  brandGradient: 'linear-gradient(135deg,#FF2E63,#C86BFF)',
}

/** Builds the CSS custom-property string applied to the app root. */
export function rootVars(dark: boolean): string {
  const c = dark ? darkTokens : lightTokens
  return [
    `--bg-app:${c.bgApp}`,
    `--bg-glow:${c.bgGlow}`,
    `--bg-elevated:${c.bgElevated}`,
    `--bg-card:${c.bgCard}`,
    `--bg-hover:${c.bgHover}`,
    `--border:${c.border}`,
    `--text-1:${c.text1}`,
    `--text-2:${c.text2}`,
    `--text-3:${c.text3}`,
    `--on-invert:${c.onInvert}`,
    `--accent:${c.accent}`,
    `--accent-soft:${c.accentSoft}`,
    `--accent-strong:${c.accentStrong}`,
    `--accent-shadow:${c.accentShadow}`,
    `--shadow:${c.shadow}`,
    `--violet-soft:${c.violetSoft}`,
    `--violet:${c.violet}`,
    `--card-border:${c.cardBorder}`,
    `--card-shadow:${c.cardShadow}`,
    `--radius-card:${c.radiusCard}`,
    `--blur:${c.blur}`,
    `--brand-gradient:${c.brandGradient}`,
  ].join(';')
}

/** Returns [background, foreground] for a soft colored badge/avatar. */
export function colorMap(name: ColorName, dark: boolean): [string, string] {
  const light: Record<ColorName, [string, string]> = {
    accent: ['rgba(225,14,69,.12)', '#AE0733'],
    info: ['rgba(0,158,180,.12)', '#00707F'],
    violet: ['rgba(176,74,255,.13)', '#8A25CE'],
    warn: ['rgba(214,124,0,.13)', '#9A5A00'],
    success: ['rgba(0,150,104,.12)', '#00714E'],
  }
  const darkMap: Record<ColorName, [string, string]> = {
    accent: ['rgba(255,46,99,.20)', '#FF7096'],
    info: ['rgba(64,224,224,.18)', '#5FE3E0'],
    violet: ['rgba(200,107,255,.18)', '#D693FF'],
    warn: ['rgba(255,183,77,.18)', '#FFC46B'],
    success: ['rgba(46,224,154,.18)', '#4FE0A6'],
  }
  const m = dark ? darkMap : light
  return m[name] || m.accent
}
