import type { CrmStore } from '../../hooks/useCrmStore'
import { stageDefs } from '../../data'
import { colorMap } from '../../theme'
import { fmt } from '../../utils'

export function PipelineView({ store }: { store: CrmStore }) {
  const dark = store.darkMode
  const q = store.dealSearch.toLowerCase()
  const dealsFiltered = store.deals.filter((d) => (d.company + d.title).toLowerCase().includes(q))
  const stages = stageDefs(dark)

  return (
    <div style={{ display: 'flex', gap: 16, overflowX: 'auto', height: '100%', paddingBottom: 8, animation: 'fadeUp .25s ease' }}>
      {stages.map((stage) => {
        const stageDeals = dealsFiltered.filter((d) => d.stageId === stage.id)
        const total = stageDeals.reduce((a, d) => a + d.value, 0)
        const isOver = store.dragOverStage === stage.id
        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault()
              store.hoverStage(stage.id)
            }}
            onDragLeave={store.leaveStage}
            onDrop={(e) => {
              e.preventDefault()
              store.dropOnStage(stage.id)
            }}
            style={{
              width: 270,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              background: isOver ? 'var(--bg-hover)' : 'var(--bg-app)',
              border: isOver ? `1.5px dashed ${stage.color}` : '1px solid var(--border)',
              borderRadius: 16,
              padding: '12px 8px',
              transition: 'background .15s ease, border-color .15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 14px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-1)', flex: 1 }}>{stage.name}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 20 }}>
                {stageDeals.length}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, padding: '0 6px 12px' }}>{fmt(total)}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto', padding: '0 2px 4px' }}>
              {stageDeals.map((deal) => {
                const [bg, fg] = colorMap(deal.color, dark)
                const dragging = store.draggedDealId === deal.id
                return (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => store.startDrag(deal.id)}
                    onDragEnd={store.endDrag}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 13,
                      padding: '13px 14px',
                      cursor: 'grab',
                      opacity: dragging ? 0.35 : 1,
                      transition: 'box-shadow .15s ease, transform .15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 8px 20px -8px var(--shadow)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.transform = 'none'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-1)' }}>{deal.company}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{deal.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-strong)' }}>{fmt(deal.value)}</span>
                      <span style={{ width: 26, height: 26, borderRadius: 8, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700 }}>
                        {deal.initials}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
