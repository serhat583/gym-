export interface ExerciseData {
  id?: string
  name: string
  scheme: string
  kg: string
  sets: string
  reps: string
  note: string
  isDone: boolean
  isCustom?: boolean
  superset?: boolean
}

export interface DayData {
  title?: string
  rest?: boolean
  exercises?: ExerciseData[]
}

export interface Week {
  num: number
  days: DayData[]
}

export interface AppState {
  curWeek: number
  curDay: number
  weeks: Week[]
}
