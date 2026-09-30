'use client'

import { useEffect, useState } from 'react'
import { getSessions } from './supabase'
import type { Session } from './supabase'
import { PROGRAM } from './program'

function calcVol(kg: string, sets: string, reps: string) {
  return (parseFloat(kg) || 0) * (parseInt(sets) || 0) * (parseInt(reps) || 0)
}

function sessionVol(s: Session) {
  return (s.exercises || []).reduce((sum, e) => sum + calcVol(e.kg, e.sets, e.reps), 0)
}

export default function Progress({ onBack }: { onBack: () => void }) {
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [view, setView] = useState<'haftalik' | 'hareketler'>('haftalik')

  useEffect(() => {
    getSessions().then(d => setSessions(d || []))
  }, [])

  if (!sessions) return (
    <div style={{ background: '#0a0a0a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
      Yükleniyor...
    </div>
  )

  // Haftalık hacim — her hafta için toplam
  const weekMap: Record<number, number> = {}
  sessions.forEach(s => {
    weekMap[s.week_num] = (weekMap[s.week_num] || 0) + sessionVol(s)
  })
  const weekNums = Object.keys(weekMap).map(Number).sort((a, b) => a - b)
  const maxWeekVol = Math.max(...Object.values(weekMap), 1)

  // Hareket bazlı PR — her hareket için max kg
  const prMap: Record<string, { kg: number; week: number; date: string }> = {}
  sessions.forEach(s => {
    const prog = PROGRAM[s.day_index]
    const progExs = prog?.exercises || []
    ;(s.exercises || []).forEach((data, ei) => {
      const exName = (data as any).name || progExs[ei]?.name
      if (!exName) return
      const kg = parseFloat(data.kg) || 0
      if (!kg) return
      if (!prMap[exName] || kg > prMap[exName].kg) {
        prMap[exName] = { kg, week: s.week_num, date: s.logged_at ? s.logged_at.slice(0, 10) : '' }
      }
    })
  })

  // Toplam istatistikler
  const totalSessions = sessions.length
  const totalVol = Math.round(sessions.reduce((s, sess) => s + sessionVol(sess), 0))

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: "'Barlow', sans-serif", color: '#f0f0f0' }}>
      {/* Header */}
      <div style={{ padding: '52px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#c8f135', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, color: '#c8f135' }}>Progress</div>
      </div>

      {/* Toplam stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '16px 16px 0' }}>
        <div style={statCard}>
          <div style={statLabel}>Toplam antrenman</div>
          <div style={statVal}>{totalSessions}<span style={{ fontSize: 13, color: '#666', marginLeft: 2 }}> gün</span></div>
        </div>
        <div style={statCard}>
          <div style={statLabel}>Toplam hacim</div>
          <div style={statVal}>{totalVol > 0 ? (totalVol / 1000).toFixed(1) : '–'}<span style={{ fontSize: 13, color: '#666', marginLeft: 2 }}>{totalVol > 0 ? ' ton' : ''}</span></div>
        </div>
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', gap: 6, padding: '16px 16px 0' }}>
        {(['haftalik', 'hareketler'] as const).map(t => (
          <button key={t} onClick={() => setView(t)} style={{
            flex: 1, padding: '9px 0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700,
            letterSpacing: '.05em', borderRadius: 8, cursor: 'pointer', border: '1px solid',
            borderColor: view === t ? '#c8f135' : '#2a2a2a',
            background: view === t ? 'rgba(200,241,53,0.12)' : '#141414',
            color: view === t ? '#c8f135' : '#666',
          }}>
            {t === 'haftalik' ? 'Haftalık Hacim' : 'Hareket PRları'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 16px 40px' }}>
        {view === 'haftalik' ? (
          sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#444', fontSize: 14 }}>Henüz antrenman kaydedilmemiş</div>
          ) : (
            <>
              {/* Bar chart */}
              <div style={{ background: '#141414', borderRadius: 12, border: '1px solid #2a2a2a', padding: '16px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', color: '#666', textTransform: 'uppercase', marginBottom: 14 }}>Toplam haftalık hacim (kg)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                  {weekNums.map(wn => {
                    const vol = weekMap[wn]
                    const pct = (vol / maxWeekVol) * 100
                    return (
                      <div key={wn} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: 9, color: '#666' }}>{Math.round(vol / 1000 * 10) / 10}t</div>
                        <div style={{ width: '100%', background: '#c8f135', borderRadius: '4px 4px 0 0', height: `${pct}%`, minHeight: 4, transition: 'height .3s' }} />
                        <div style={{ fontSize: 10, color: '#666', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>H{wn}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Hafta detayları */}
              {weekNums.map(wn => {
                const wSessions = sessions.filter(s => s.week_num === wn)
                return (
                  <div key={wn} style={{ background: '#141414', borderRadius: 12, border: '1px solid #2a2a2a', padding: '14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700 }}>Hafta {wn}</div>
                      <div style={{ fontSize: 12, color: '#c8f135' }}>{Math.round(weekMap[wn]).toLocaleString('tr')} kg</div>
                    </div>
                    {wSessions.map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #1e1e1e' }}>
                        <div style={{ fontSize: 13 }}>{s.day_name}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>{Math.round(sessionVol(s)).toLocaleString('tr')} kg</div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          )
        ) : (
          Object.keys(prMap).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#444', fontSize: 14 }}>Henüz veri yok</div>
          ) : (
            Object.entries(prMap).map(([name, pr]) => (
              <div key={name} style={{ background: '#141414', borderRadius: 12, border: '1px solid #2a2a2a', padding: '14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{name}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>Hafta {pr.week} · {pr.date}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: '#c8f135', lineHeight: 1 }}>{pr.kg}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>kg PR</div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}

const statCard: React.CSSProperties = {
  background: '#141414', border: '1px solid #2a2a2a', borderRadius: 10, padding: '12px 14px',
}
const statLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: '.08em', color: '#666', textTransform: 'uppercase', marginBottom: 4,
}
const statVal: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: '#f0f0f0', lineHeight: 1,
}
