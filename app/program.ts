export interface Exercise {
  id?: string
  name: string
  scheme: string
  sets?: number
  reps?: string
  superset?: boolean
}

export interface DayProgram {
  title?: string
  exercises?: Exercise[]
  rest?: boolean
}

export const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
export const FULL_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

export const antrenmanProgrami = {
  itis: [
    { id: 'itis-1', name: 'Bench Press', sets: 4, reps: '8-10', scheme: '4×8-10' },
    { id: 'itis-2', name: 'Incline Bench Press (Üst Göğüs)', sets: 3, reps: '10', scheme: '3×10' },
    { id: 'itis-3', name: 'Overhead Press (Omuz)', sets: 3, reps: '10', scheme: '3×10' },
    { id: 'itis-4', name: 'Lateral Raise (Yana Açış)', sets: 4, reps: '12-15', scheme: '4×12-15' },
    { id: 'itis-5', name: 'Reverse Pec Deck Fly (Arka Omuz)', sets: 3, reps: '12', scheme: '3×12' },
    { id: 'itis-6', name: 'Triceps Pushdown (Arka Kol)', sets: 4, reps: '10-12', scheme: '4×10-12' },
  ],
  cekis: [
    { id: 'cekis-1', name: 'Lat Pulldown (Sırta Çekiş)', sets: 4, reps: '10', scheme: '4×10' },
    { id: 'cekis-2', name: 'Barbell Row', sets: 4, reps: '8-10', scheme: '4×8-10' },
    { id: 'cekis-3', name: 'Cable Row', sets: 3, reps: '10-12', scheme: '3×10-12' },
    { id: 'cekis-4', name: 'Z-Bar Biceps Curl (Ön Kol)', sets: 4, reps: '10-12', scheme: '4×10-12' },
  ],
  bacak: [
    { id: 'bacak-1', name: 'Squat', sets: 4, reps: '8-10', scheme: '4×8-10' },
    { id: 'bacak-2', name: 'Leg Press', sets: 3, reps: '10-12', scheme: '3×10-12' },
    { id: 'bacak-3', name: 'Leg Extension (Ön Bacak)', sets: 3, reps: '12-15', scheme: '3×12-15' },
    { id: 'bacak-4', name: 'Leg Curl (Arka Bacak)', sets: 3, reps: '12-15', scheme: '3×12-15' },
  ],
}

export const PROGRAM: DayProgram[] = [
  {
    title: 'İtiş (Push)',
    exercises: antrenmanProgrami.itis,
  },
  {
    title: 'Çekiş (Pull)',
    exercises: antrenmanProgrami.cekis,
  },
  {
    title: 'Bacak (Legs)',
    exercises: antrenmanProgrami.bacak,
  },
  {
    title: 'Dinlenme',
    rest: true,
  },
  {
    title: 'İtiş (Push)',
    exercises: antrenmanProgrami.itis,
  },
  {
    title: 'Çekiş (Pull)',
    exercises: antrenmanProgrami.cekis,
  },
  {
    title: 'Dinlenme',
    rest: true,
  },
]
