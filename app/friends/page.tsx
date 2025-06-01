"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { PokemonCardComponent } from "@/components/pokemon-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase"
import type { PokemonCard } from "@/types/pokemon"
import { Users, User } from "lucide-react"
import { fetchPokemonCards } from "@/lib/pokemon-api"

interface UserMissingCards {
  userId: string
  username: string
  friendCode: string
  missingCards: string[]
}

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<PokemonCard[]>([])
  const [usersMissingCards, setUsersMissingCards] = useState<UserMissingCards[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchCards()
      fetchUsersMissingCards()
    }
  }, [user])

  const fetchCards = async () => {
    try {
      const apiCards = await fetchPokemonCards()
      setCards(apiCards)
    } catch (error) {
      console.error("Error fetching cards:", error)
      setCards([])
    } finally {
      setLoading(false)
    }
  }

  const fetchUsersMissingCards = async () => {
    if (!user) return

    try {
      // Get all missing cards with user profiles
      const { data: missingCardsData, error: missingError } = await supabase
        .from("missing_cards")
        .select(`
        card_id,
        user_id,
        user_profiles!inner(username, friend_code)
      `)
        .neq("user_id", user.id)

      if (missingError) throw missingError

      // Group missing cards by user
      const usersMap = new Map()
      missingCardsData.forEach((item: any) => {
        if (!usersMap.has(item.user_id)) {
          usersMap.set(item.user_id, {
            userId: item.user_id,
            username: item.user_profiles.username || `User ${item.user_profiles.friend_code}`,
            friendCode: item.user_profiles.friend_code,
            missingCards: [],
          })
        }
        usersMap.get(item.user_id).missingCards.push(item.card_id)
      })

      setUsersMissingCards(Array.from(usersMap.values()))
    } catch (error) {
      console.error("Error fetching users missing cards:", error)
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Active Users</h1>
          <p className="text-gray-600">See what cards other users are missing</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : usersMissingCards.length > 0 ? (
          <div className="space-y-8">
            {usersMissingCards.map((userMissing) => {
              const userMissingCardObjects = cards.filter((card) => userMissing.missingCards.includes(card.id))

              return (
                <Card key={userMissing.userId} className="overflow-hidden">
                  <CardHeader className="bg-blue-50">
                    <CardTitle className="flex items-center space-x-2">
                      <User className="w-5 h-5" />
                      <div className="flex flex-col">
                        <span>{userMissing.username}</span>
                        <span className="text-sm font-normal text-blue-600">Friend Code: {userMissing.friendCode}</span>
                      </div>
                      <span className="text-sm font-normal text-gray-600">
                        ({userMissing.missingCards.length} missing cards)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {userMissingCardObjects.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {userMissingCardObjects.map((card) => (
                          <PokemonCardComponent
                            key={card.id}
                            card={card}
                            isMissing={true}
                            onToggleMissing={() => {}} // Read-only for friends view
                            loading={false}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">This user has all cards! 🎉</div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <div className="text-gray-500 text-lg">No active users found</div>
            <div className="text-gray-400 text-sm mt-2">
              Invite your friends to join and start tracking cards together!
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
