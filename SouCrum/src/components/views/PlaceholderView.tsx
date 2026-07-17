interface PlaceholderViewProps {
  emoji: string
  title: string
  subtitle: string
}

export function PlaceholderView({ emoji, title, subtitle }: PlaceholderViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: 10, animation: 'fadeUp .25s ease' }}>
      <div style={{ fontSize: 40 }}>{emoji}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>{title}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 320, lineHeight: 1.5 }}>{subtitle}</div>
    </div>
  )
}
