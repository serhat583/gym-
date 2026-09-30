const SUPABASE_URL = 'https://tfwxxrzpndyqnmwrzgja.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmd3h4cnpwbmR5cW5td3J6Z2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDUyMTYsImV4cCI6MjA5NzEyMTIxNn0.eqkkhVlRDoOtK1O7l4uSv-pHqAT2NxzLEkU12K44sRc'

function getDeviceId(): string {
  let id = localStorage.getItem('ghmax_device_id')
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('ghmax_device_id', id)
  }
  return id
}

async function req(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=minimal' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok && res.status !== 201) return null
  if (method === 'GET') return res.json()
  return true
}

export async function saveSession(weekNum: number, dayIndex: number, dayName: string, exercises: object[]) {
  const device_id = getDeviceId()
  return req('sessions', 'POST', { device_id, week_num: weekNum, day_index: dayIndex, day_name: dayName, exercises })
}

export async function getSessions() {
  const device_id = getDeviceId()
  return req(`sessions?device_id=eq.${device_id}&order=logged_at.asc&select=*`) as Promise<Session[] | null>
}

export interface Session {
  id: string
  device_id: string
  week_num: number
  day_index: number
  day_name: string
  logged_at: string
  exercises: Array<{ kg: string; sets: string; reps: string; note: string; isDone: boolean }>
}
