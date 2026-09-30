'use client'

import { useState, useEffect, useCallback } from 'react'
import { PROGRAM, DAYS } from './program'
import type { AppState, Week, ExerciseData } from './types'
import { saveSession } from './supabase'
import Progress from './Progress'

const STORAGE_KEY = 'ghmax_v2'

function todayIdx() {
  const d = new Date().getDay()
  return d === 0 ? 6 : d - 1
}

function makeWeek(num: number): Week {
  return {
    num,
    days: PROGRAM.map(prog => {
      if (prog.rest) return { rest: true, title: prog.title }
      return {
        title: prog.title,
        exercises: (prog.exercises || []).map(ex => ({
          id: ex.id || `ex-${Math.random().toString(36).slice(2)}`,
          name: ex.name,
          scheme: ex.scheme,
          kg: '',
          sets: ex.sets ? String(ex.sets) : '',
          reps: ex.reps || '',
          note: '',
          isDone: false,
          superset: ex.superset,
        })),
      }
    }),
  }
}

function calcVol(kg: string, sets: string, reps: string) {
  return (parseFloat(kg) || 0) * (parseInt(sets) || 0) * (parseInt(reps) || 0)
}

function dayVol(state: AppState, wi: number, di: number) {
  const day = state.weeks[wi]?.days[di]
  if (!day || day.rest || !day.exercises) return 0
  return day.exercises.reduce((s, e) => s + calcVol(e.kg, e.sets, e.reps), 0)
}

function isDayDone(state: AppState, wi: number, di: number) {
  const day = state.weeks[wi]?.days[di]
  if (!day || day.rest || !day.exercises || day.exercises.length === 0) return false
  return day.exercises.every(e => e.isDone)
}

function weekVol(state: AppState, wi: number) {
  return DAYS.reduce((s, _, i) => s + dayVol(state, wi, i), 0)
}

export default function Tracker() {
  const [state, setState] = useState<AppState | null>(null)
  const [weekModal, setWeekModal] = useState(false)
  const [backupModal, setBackupModal] = useState(false)
  const [toast, setToast] = useState('')
  const [showProgress, setShowProgress] = useState(false)
  const [yeniHareketAdi, setYeniHareketAdi] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('ghmax_v1')
      if (saved) {
        const parsed = JSON.parse(saved) as AppState
        // Upgrade legacy state format if needed
        let needsUpgrade = false
        parsed.weeks.forEach(w => {
          w.days.forEach((d, di) => {
            if (!d.rest && d.exercises) {
              const progExs = PROGRAM[di]?.exercises || []
              d.exercises.forEach((e, ei) => {
                if (!e.name && progExs[ei]) {
                  e.name = progExs[ei].name
                  e.scheme = progExs[ei].scheme
                  needsUpgrade = true
                }
              })
            }
          })
        })
        setState(parsed)
        if (needsUpgrade) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        }
        return
      }
    } catch {}
    setState({ curWeek: 0, curDay: todayIdx(), weeks: [makeWeek(1)] })
  }, [])

  const save = useCallback((newState: AppState) => {
    setState(newState)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newState)) } catch {}
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  if (!state) return <div style={{ background: '#0a0a0a', height: '100vh' }} />
  if (showProgress) return <Progress onBack={() => setShowProgress(false)} />

  const curProg = PROGRAM[state.curDay] || { rest: true }
  const curDay = state.weeks[state.curWeek]?.days[state.curDay]
  const dv = Math.round(dayVol(state, state.curWeek, state.curDay))
  const doneDays = DAYS.reduce((s, _, i) => s + (isDayDone(state, state.curWeek, i) ? 1 : 0), 0)
  const totalTrainingDays = PROGRAM.filter(p => !p.rest).length
  const allDone = !curDay?.rest && (curDay?.exercises?.length ?? 0) > 0 && curDay?.exercises?.every(e => e.isDone)

  function setField(ei: number, field: keyof ExerciseData, val: string | boolean) {
    const ns = JSON.parse(JSON.stringify(state)) as AppState
    const ex = ns.weeks[ns.curWeek].days[ns.curDay].exercises![ei]
    ;(ex as any)[field] = val
    save(ns)
  }

  function toggleDone(ei: number) {
    const ns = JSON.parse(JSON.stringify(state)) as AppState
    const ex = ns.weeks[ns.curWeek].days[ns.curDay].exercises![ei]
    ex.isDone = !ex.isDone
    save(ns)
  }

  function ekstraHareketEkle() {
    if (!yeniHareketAdi.trim() || !state) return
    const ns = JSON.parse(JSON.stringify(state)) as AppState
    const targetDay = ns.weeks[ns.curWeek].days[ns.curDay]
    
    if (targetDay.rest) {
      targetDay.rest = false
      targetDay.exercises = []
    }
    if (!targetDay.exercises) targetDay.exercises = []

    const yeniHareket: ExerciseData = {
      id: `ekstra-${Date.now()}`,
      name: yeniHareketAdi.trim(),
      scheme: '3×10',
      sets: '3',
      reps: '10',
      kg: '',
      note: '',
      isDone: false,
      isCustom: true,
    }

    targetDay.exercises.push(yeniHareket)
    save(ns)
    setYeniHareketAdi('')
    showToast('Hareket eklendi ✓')
  }

  function removeExercise(ei: number) {
    const ns = JSON.parse(JSON.stringify(state)) as AppState
    const targetDay = ns.weeks[ns.curWeek].days[ns.curDay]
    if (targetDay.exercises) {
      targetDay.exercises.splice(ei, 1)
      save(ns)
      showToast('Hareket kaldırıldı')
    }
  }

  function finishDay() {
    const ns = JSON.parse(JSON.stringify(state)) as AppState
    const day = ns.weeks[ns.curWeek].days[ns.curDay]
    if (!day.rest && day.exercises && day.exercises.length > 0) {
      day.exercises.forEach(e => e.isDone = true)
      save(ns)
      // Supabase'e kaydet
      saveSession(
        ns.weeks[ns.curWeek].num,
        ns.curDay,
        DAYS[ns.curDay],
        day.exercises
      ).then(ok => {
        if (ok) showToast('Antrenman kaydedildi ✓')
        else showToast('Kaydedilemedi, internet kontrol et')
      })
    } else {
      save(ns)
    }
  }

  function switchDay(i: number) {
    save({ curWeek: state!.curWeek, curDay: i, weeks: state!.weeks })
  }

  function selectWeek(i: number) {
    save({ curWeek: i, curDay: state!.curDay, weeks: state!.weeks })
    setWeekModal(false)
  }

  function addWeek() {
    const ns = JSON.parse(JSON.stringify(state)) as AppState
    ns.weeks.push(makeWeek(ns.weeks.length + 1))
    ns.curWeek = ns.weeks.length - 1
    ns.curDay = todayIdx()
    save(ns)
    setWeekModal(false)
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.download = `ghmax_${new Date().toISOString().slice(0, 10)}.json`
    a.href = URL.createObjectURL(blob)
    a.click()
    showToast('Yedek indirildi')
    setBackupModal(false)
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as AppState
        if (!parsed.weeks) throw new Error()
        save(parsed)
        showToast('Veriler geri yüklendi')
        setBackupModal(false)
      } catch { showToast('Geçersiz dosya!') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function resetData() {
    if (!confirm('Tüm antrenman verileri silinecek ve yeni programa sıfırlanacak. Emin misin?')) return
    const ns: AppState = { curWeek: 0, curDay: todayIdx(), weeks: [makeWeek(1)] }
    save(ns)
    showToast('Yeni programla sıfırlandı')
    setBackupModal(false)
  }

  const currentExercises = curDay?.exercises || []
  const isRestDay = curDay?.rest && currentExercises.length === 0

  return (
    <>
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        .day-strip::-webkit-scrollbar { display: none; }
        .week-list::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Header */}
      <div style={{ padding: '52px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, color: 'var(--accent)' }}>
          Hypertrophy Max
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowProgress(true)} style={hdrBtnStyle}>📈 Progress</button>
          <button onClick={() => setWeekModal(true)} style={hdrBtnStyle}>
            Hafta <span style={{ color: 'var(--accent)' }}>{state.weeks[state.curWeek].num}</span> ▾
          </button>
          <button onClick={() => setBackupModal(true)} style={hdrBtnStyle}>⬆ Yedek</button>
        </div>
      </div>

      {/* Day strip */}
      <div className="day-strip" style={{ display: 'flex', gap: 6, padding: '14px 16px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {DAYS.map((d, i) => {
          const done = isDayDone(state, state.curWeek, i)
          const rest = PROGRAM[i]?.rest
          return (
            <button key={i} onClick={() => switchDay(i)} style={{
              flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '8px 10px', borderRadius: 10, minWidth: 46, cursor: 'pointer',
              border: `1px solid ${i === state.curDay ? 'var(--accent)' : 'var(--border)'}`,
              background: i === state.curDay ? 'var(--accent-dim)' : 'var(--surface)',
            }}>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '.04em',
                color: rest ? '#555' : i === state.curDay ? 'var(--accent)' : 'var(--muted)',
              }}>{d}</span>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: done ? 'var(--accent)' : 'transparent' }} />
            </button>
          )
        })}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '14px 16px 0' }}>
        <div style={statCard}>
          <div style={statLabel}>Bugün hacim {curProg.title ? `(${curProg.title})` : ''}</div>
          <div style={statVal}>{dv > 0 ? dv.toLocaleString('tr') : '–'}<span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 2 }}>{dv > 0 ? ' kg' : ''}</span></div>
        </div>
        <div style={statCard}>
          <div style={statLabel}>Hafta {state.weeks[state.curWeek].num}</div>
          <div style={statVal}>{doneDays}<span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 2 }}> / {totalTrainingDays} gün</span></div>
        </div>
      </div>

      {/* Exercise list */}
      <div style={{ padding: '14px 16px 140px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isRestDay ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 12, color: 'var(--muted)' }}>
            <div style={{ fontSize: 48 }}>💤</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700 }}>Dinlenme Günü</div>
            <div style={{ fontSize: 13 }}>Bugün dinlenme günü. Yine de antrenman yaptıysan aşağıdan hareket ekleyebilirsin.</div>
          </div>
        ) : (
          currentExercises.map((data, ei) => {
            const v = Math.round(calcVol(data.kg, data.sets, data.reps))
            return (
              <div key={data.id || ei} style={{
                background: data.isDone ? 'var(--done-bg)' : 'var(--surface)',
                border: `1px solid ${data.isDone ? 'var(--done-border)' : 'var(--border)'}`,
                borderRadius: 12, overflow: 'hidden', transition: 'border-color .2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '12px 14px 10px' }}>
                  <div style={{ flex: 1 }}>
                    {data.superset && <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', color: '#f59b00', background: 'rgba(245,155,0,.12)', borderRadius: 4, padding: '2px 6px', display: 'inline-block', marginBottom: 6 }}>SUPER SET</div>}
                    {data.isCustom && <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 4, padding: '2px 6px', display: 'inline-block', marginBottom: 6, marginRight: 6 }}>EKSTRA</div>}
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{data.name}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.05em', color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 5, padding: '3px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {data.scheme || (data.sets && data.reps ? `${data.sets}×${data.reps}` : 'Serbest')}
                    </div>
                    {data.isCustom && (
                      <button onClick={() => removeExercise(ei)} title="Hareketi Kaldır" style={{ background: 'transparent', border: 'none', color: '#ff5555', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>✕</button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 14px 10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '.07em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 5 }}>Ağırlık</label>
                    <input type="number" step="0.5" min="0" placeholder="kg" value={data.kg}
                      onChange={e => setField(ei, 'kg', e.target.value)}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '.07em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 5 }}>Set × Tekrar</label>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input type="number" min="1" max="20" placeholder="set" value={data.sets}
                        onChange={e => setField(ei, 'sets', e.target.value)}
                        style={{ ...inputStyle, flex: 1 }} />
                      <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>×</span>
                      <input type="text" placeholder="tekrar" value={data.reps}
                        onChange={e => setField(ei, 'reps', e.target.value)}
                        style={{ ...inputStyle, flex: 1 }} />
                    </div>
                  </div>
                </div>

                <div style={{ padding: '0 14px 10px' }}>
                  <input type="text" placeholder="not, his, form..." value={data.note}
                    onChange={e => setField(ei, 'note', e.target.value)}
                    style={{ ...inputStyle, background: 'transparent', color: 'var(--muted)', fontSize: 13 }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 12px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: v > 0 ? 'var(--accent)' : 'var(--muted)', fontWeight: v > 0 ? 500 : 400 }}>
                    {v > 0 ? `${v.toLocaleString('tr')} kg hacim` : ''}
                  </div>
                  <button onClick={() => toggleDone(ei)} style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '.06em',
                    padding: '7px 14px', borderRadius: 7, cursor: 'pointer', transition: 'all .15s',
                    background: data.isDone ? 'var(--accent)' : 'transparent',
                    color: data.isDone ? '#000' : 'var(--muted)',
                    border: `1px solid ${data.isDone ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                    {data.isDone ? '✓ Tamam' : 'Tamamla'}
                  </button>
                </div>
              </div>
            )
          })
        )}

        {/* Ekstra Hareket Ekle Kutusu */}
        <div style={{
          padding: '12px 14px', borderRadius: 12, border: '1px dashed var(--border)',
          background: 'var(--surface)', display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <input
            type="text"
            value={yeniHareketAdi}
            onChange={(e) => setYeniHareketAdi(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ekstraHareketEkle() }}
            placeholder="Ekstra hareket adı (Örn: Bilek, Karın)..."
            style={{
              flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text)',
              fontFamily: "'Barlow', sans-serif", outline: 'none',
            }}
          />
          <button
            onClick={ekstraHareketEkle}
            style={{
              background: 'var(--accent)', color: '#000', border: 'none',
              padding: '10px 16px', borderRadius: 8, fontWeight: 700,
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, cursor: 'pointer',
              letterSpacing: '.04em', whiteSpace: 'nowrap',
            }}
          >
            + Ekle
          </button>
        </div>
      </div>

      {/* Finish bar */}
      {!isRestDay && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 34px', background: 'linear-gradient(to top, var(--bg) 60%, transparent)' }}>
          <button onClick={finishDay} style={{
            width: '100%', padding: 15, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700,
            letterSpacing: '.08em', border: allDone ? '1px solid var(--done-border)' : 'none', borderRadius: 12, cursor: 'pointer',
            background: allDone ? 'var(--surface)' : 'var(--accent)',
            color: allDone ? 'var(--accent)' : '#000',
          }}>
            {allDone ? '✓ Antrenman Tamamlandı' : 'Antrenmanı Bitir'}
          </button>
        </div>
      )}

      {/* Week Modal */}
      {weekModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setWeekModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
          <div style={{ background: 'var(--surface)', borderRadius: '18px 18px 0 0', padding: '20px 16px 40px', width: '100%', borderTop: '1px solid var(--border)', position: 'relative' }}>
            <button onClick={() => setWeekModal(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>✕</button>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Hafta Seç</div>
            <div className="week-list" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, maxHeight: 240, overflowY: 'auto', scrollbarWidth: 'none' }}>
              {state.weeks.map((w, i) => {
                const v = Math.round(weekVol(state, i))
                return (
                  <div key={i} onClick={() => selectWeek(i)} style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${i === state.curWeek ? 'var(--accent)' : 'var(--border)'}`,
                    background: 'var(--bg)', fontSize: 15, display: 'flex', justifyContent: 'space-between',
                    color: i === state.curWeek ? 'var(--accent)' : 'var(--text)',
                  }}>
                    <span>Hafta {w.num}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{v > 0 ? `${v.toLocaleString('tr')} kg` : '–'}</span>
                  </div>
                )
              })}
            </div>
            <button onClick={addWeek} style={modalBtnStyle}>+ Yeni Hafta Ekle</button>
          </div>
        </div>
      )}

      {/* Backup Modal */}
      {backupModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setBackupModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
          <div style={{ background: 'var(--surface)', borderRadius: '18px 18px 0 0', padding: '20px 16px 40px', width: '100%', borderTop: '1px solid var(--border)', position: 'relative' }}>
            <button onClick={() => setBackupModal(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>✕</button>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Yedek & Geri Yükle</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>Verilerini JSON dosyası olarak indir. iCloud Drive veya Google Drive'a at, kaybolmaz.</p>
            <button onClick={exportData} style={modalBtnStyle}>⬇ Yedeği İndir (.json)</button>
            <label style={{ ...modalBtnStyle, display: 'block', textAlign: 'center', cursor: 'pointer' }}>
              ⬆ Yedeği Geri Yükle
              <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
            </label>
            <button onClick={resetData} style={{ ...modalBtnStyle, color: '#ff5555', borderColor: '#3a1a1a' }}>✕ Programı Sıfırla & Güncelle</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: '#000',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '.05em',
          padding: '10px 20px', borderRadius: 30, zIndex: 200,
        }}>{toast}</div>
      )}
    </>
  )
}

const hdrBtnStyle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.06em',
  color: 'var(--muted)', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--surface)', cursor: 'pointer', whiteSpace: 'nowrap',
}

const statCard: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
}

const statLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: '.08em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4,
}

const statVal: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '9px 10px', fontSize: 15, fontFamily: "'Barlow', sans-serif", color: 'var(--text)',
}

const modalBtnStyle: React.CSSProperties = {
  width: '100%', padding: 13, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700,
  border: '1px solid var(--border)', borderRadius: 10, background: 'transparent', color: 'var(--text)',
  cursor: 'pointer', marginTop: 8, letterSpacing: '.04em',
}