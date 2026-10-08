import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'

export type Profile = {
  id: string
  display_name: string
  couple_id: string | null
}

type ProfileContextValue = {
  profile: Profile | null
  loading: boolean
  refresh: () => Promise<void>
  saveDisplayName: (name: string) => Promise<boolean>
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  loading: true,
  refresh: async () => {},
  saveDisplayName: async () => false,
})

// The signed-in user's own profile row. Its couple_id decides which screens are
// reachable (CoupleGate); it only ever changes through the couple RPCs.
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const [profile, setProfile] = useState<Profile | null>(null)
  // Which user the current `profile` was loaded for. Deriving `loading` from it
  // (instead of a separate flag) means a just-signed-in user is never shown the
  // previous, empty state for a render.
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined)
  const loading = loadedFor !== userId

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setProfile(null)
      setLoadedFor(userId)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, couple_id')
      .eq('id', userId)
      .single()
    setProfile(data ?? null)
    setLoadedFor(userId)
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const saveDisplayName = useCallback(
    async (name: string) => {
      if (!supabase || !userId) return false
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: name.trim() })
        .eq('id', userId)
      return !error
    },
    [userId],
  )

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh, saveDisplayName }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}