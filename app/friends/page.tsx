"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase"
import { Users, User, Copy, Check, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface UserProfile {
  id: string
  username: string | null
  friend_code: string
  created_at: string
  missing_count: number
}

export default function FriendsPage() {
  const { user, loading: authLoading, refreshSession } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchAllUsers()
    }
  }, [user])

  const handleAuthError = async (error: any) => {
    if (error.message?.includes("JWT") || error.message?.includes("expired")) {
      setError("Your session has expired. Please refresh or sign in again.")
      return true
    }
    return false
  }

  const fetchAllUsers = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      // Get all user profiles except current user
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, username, friend_code, created_at")
        .neq("id", user.id)
        .order("created_at", { ascending: false })

      if (profilesError) {
        const isAuthError = await handleAuthError(profilesError)
        if (!isAuthError) {
          throw profilesError
        }
        return
      }

      // Get missing card counts for each user
      const userIds = profiles.map((p) => p.id)
      const { data: missingCounts, error: countsError } = await supabase
        .from("missing_cards")
        .select("user_id")
        .in("user_id", userIds)

      if (countsError) {
        const isAuthError = await handleAuthError(countsError)
        if (!isAuthError) {
          console.error("Error fetching missing card counts:", countsError)
        }
      }

      // Count missing cards per user
      const countMap: Record<string, number> = {}
      missingCounts?.forEach((item: any) => {
        countMap[item.user_id] = (countMap[item.user_id] || 0) + 1
      })

      // Combine the data
      const usersWithCounts = profiles.map((profile: any) => ({
        ...profile,
        missing_count: countMap[profile.id] || 0,
      }))

      setUsers(usersWithCounts)
    } catch (error) {
      console.error("Error fetching users:", error)
      setError("Failed to load users. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshSession()
      await fetchAllUsers()
    } catch (error) {
      console.error("Error refreshing:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const copyFriendCode = async (friendCode: string) => {
    try {
      await navigator.clipboard.writeText(friendCode)
      setCopiedCode(friendCode)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (error) {
      console.error("Failed to copy friend code:", error)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Active Users</h1>
              <p className="text-gray-600">All users registered on the platform</p>
            </div>
            {error && (
              <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : users.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((profile) => (
              <Card key={profile.id} className="overflow-hidden">
                <CardHeader className="bg-blue-50 py-4">
                  <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <div className="flex-1">
                      <span>{profile.username || "Anonymous User"}</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm text-gray-600">Friend Code:</div>
                    <div className="flex items-center">
                      <span className="font-mono text-sm mr-2">{profile.friend_code}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyFriendCode(profile.friend_code)}
                        className="h-7 w-7 p-0"
                      >
                        {copiedCode === profile.friend_code ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">Missing Cards:</div>
                    <Badge variant={profile.missing_count > 0 ? "secondary" : "outline"}>{profile.missing_count}</Badge>
                  </div>

                  <div className="mt-4 text-xs text-gray-500">
                    Joined: {new Date(profile.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <div className="text-gray-500 text-lg">No other users found</div>
            <div className="text-gray-400 text-sm mt-2">
              Invite your friends to join and start tracking cards together!
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
