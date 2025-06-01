"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { LogOut, User, Users, Home, ArrowLeftRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase"

export function Navigation() {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const [userProfile, setUserProfile] = useState<{ username: string; friend_code: string } | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const supabase = getSupabaseClient()

  useEffect(() => {
    if (user) {
      fetchUserProfile()
    }
  }, [user])

  const fetchUserProfile = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("username, friend_code")
        .eq("id", user.id)
        .single()

      if (!error && data) {
        setUserProfile(data)
      } else if (error && error.code === "PGRST116") {
        // Profile doesn't exist, create one with fallback values
        const fallbackUsername = `user_${user.id.slice(0, 8)}`
        const fallbackFriendCode = generateFallbackFriendCode()

        const { error: insertError } = await supabase.from("user_profiles").insert({
          id: user.id,
          username: fallbackUsername,
          friend_code: fallbackFriendCode,
        })

        if (!insertError) {
          setUserProfile({
            username: fallbackUsername,
            friend_code: fallbackFriendCode,
          })
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error)
    } finally {
      setProfileLoading(false)
    }
  }

  const generateFallbackFriendCode = () => {
    const segments = []
    for (let i = 0; i < 4; i++) {
      segments.push(
        Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0"),
      )
    }
    return segments.join("-")
  }

  if (!user) return null

  const navItems = [
    { href: "/", label: "Cards", icon: Home },
    { href: "/collection", label: "My Collection", icon: User },
    { href: "/traders", label: "Find Traders", icon: ArrowLeftRight },
    { href: "/friends", label: "Active Users", icon: Users },
  ]

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/" className="text-xl font-bold text-blue-600">
            Pokemon TCG Tracker
          </Link>
          <div className="flex space-x-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            {profileLoading ? (
              <div className="text-sm text-gray-400">Loading...</div>
            ) : userProfile ? (
              <>
                <div className="text-sm font-medium text-gray-900">{userProfile.username}</div>
                <div className="text-xs text-blue-600">Code: {userProfile.friend_code}</div>
              </>
            ) : (
              <div className="text-sm text-gray-600">{user.email}</div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  )
}
