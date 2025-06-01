"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { getSupabaseClient } from "@/lib/supabase"

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const supabase = getSupabaseClient()

    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error("Error getting session:", error)
          // If session is invalid, clear it
          if (error.message.includes("JWT") || error.message.includes("expired")) {
            await supabase.auth.signOut()
          }
        }
        setUser(session?.user ?? null)
      } catch (error) {
        console.error("Error in getSession:", error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.email)

      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully")
      }

      if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        setUser(null)
      } else {
        setUser(session?.user ?? null)
      }

      setLoading(false)
    })

    // Set up automatic token refresh
    const refreshInterval = setInterval(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        const timeUntilExpiry = (session.expires_at || 0) * 1000 - Date.now()
        // Refresh if token expires in less than 5 minutes
        if (timeUntilExpiry < 5 * 60 * 1000) {
          console.log("Refreshing token...")
          await supabase.auth.refreshSession()
        }
      }
    }, 60000) // Check every minute

    return () => {
      subscription.unsubscribe()
      clearInterval(refreshInterval)
    }
  }, [mounted])

  const signOut = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
  }

  const refreshSession = async () => {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.refreshSession()
    if (error) {
      console.error("Error refreshing session:", error)
      // If refresh fails, sign out
      await signOut()
    }
  }

  // Don't render children until mounted
  if (!mounted) {
    return null
  }

  return <AuthContext.Provider value={{ user, loading, signOut, refreshSession }}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
