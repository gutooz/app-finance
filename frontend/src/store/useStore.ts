import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthSession {
  access_token: string
  user: { id: string; email: string }
}

export interface Profile {
  id: string
  name: string
  monthly_income: number
  gender?: 'male' | 'female'
  couple_id: string | null
  email?: string
}

export interface CoupleUser {
  id: string
  name: string
  monthly_income: number
  gender?: 'male' | 'female'
}

export interface Couple {
  id: string
  split_mode: string
  invite_token: string
  is_complete: boolean
  user1_id: string
  user2_id: string | null
  user1: CoupleUser
  user2: CoupleUser | null
}

interface AppStore {
  session: AuthSession | null
  profile: Profile | null
  couple: Couple | null
  setSession: (s: AuthSession | null) => void
  setProfile: (p: Profile | null) => void
  setCouple: (c: Couple | null) => void
  clear: () => void
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      session: null,
      profile: null,
      couple: null,
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      setCouple: (couple) => set({ couple }),
      clear: () => set({ session: null, profile: null, couple: null }),
    }),
    {
      name: 'fincouple-store-v4',
      version: 5,
      migrate: () => ({ session: null, profile: null, couple: null }),
    }
  )
)
