"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase"
import type { PokemonCard } from "@/types/pokemon"
import { Users, Search, Copy, Check, ArrowRightLeft } from "lucide-react"
import { fetchPokemonCards } from "@/lib/pokemon-api"
import Image from "next/image"

interface UserWithCard {
  userId: string
  username: string
  friendCode: string
  cardsTheyNeed: PokemonCard[]
}

interface TradeOpportunity {
  card: PokemonCard
  usersWithCard: UserWithCard[]
}

export default function TradersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<PokemonCard[]>([])
  const [missingCards, setMissingCards] = useState<Set<string>>(new Set())
  const [tradeOpportunities, setTradeOpportunities] = useState<TradeOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    try {
      // Fetch cards and missing cards in parallel
      const [apiCards, missingCardsData] = await Promise.all([
        fetchPokemonCards(),
        supabase.from("missing_cards").select("card_id").eq("user_id", user!.id),
      ])

      setCards(apiCards)

      if (missingCardsData.error) throw missingCardsData.error

      const missingSet = new Set(missingCardsData.data.map((item: any) => item.card_id))
      setMissingCards(missingSet)

      // Now fetch trade opportunities
      await fetchTradeOpportunities(apiCards, missingSet)
    } catch (error) {
      console.error("Error fetching data:", error)
      setCards([])
    } finally {
      setLoading(false)
    }
  }

  const fetchTradeOpportunities = async (allCards: PokemonCard[], myMissingCards: Set<string>) => {
    if (!user || allCards.length === 0) return

    try {
      // Get all missing cards from all users
      const { data: allMissingCards, error: missingError } = await supabase
        .from("missing_cards")
        .select("card_id, user_id")
        .neq("user_id", user.id)

      if (missingError) throw missingError

      // Get user profiles only for users who have missing cards (active users)
      const activeUserIds = [...new Set(allMissingCards.map((missing: any) => missing.user_id))]

      if (activeUserIds.length === 0) {
        setTradeOpportunities([])
        return
      }

      const { data: activeProfiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, username, friend_code")
        .in("id", activeUserIds)

      if (profilesError) throw profilesError

      // Create a map of user_id to their missing cards
      const userMissingCardsMap: Record<string, Set<string>> = {}
      allMissingCards.forEach((missing: any) => {
        if (!userMissingCardsMap[missing.user_id]) {
          userMissingCardsMap[missing.user_id] = new Set()
        }
        userMissingCardsMap[missing.user_id].add(missing.card_id)
      })

      // Cards that I own (not in my missing cards)
      const myOwnedCards = new Set(allCards.map((card) => card.id).filter((cardId) => !myMissingCards.has(cardId)))

      const opportunities: TradeOpportunity[] = []

      // For each card I'm missing, find users who have it
      Array.from(myMissingCards).forEach((cardId) => {
        const usersWhoHaveThisCard: UserWithCard[] = []

        activeProfiles.forEach((profile) => {
          const userMissingThisCard = userMissingCardsMap[profile.id]?.has(cardId) || false

          // User has this card if they haven't marked it as missing
          // (we already know they're active since they're in activeProfiles)
          if (!userMissingThisCard) {
            // Find cards this user needs that I own
            const userMissingCardIds = userMissingCardsMap[profile.id] || new Set()
            const cardsTheyNeedThatIOwn = Array.from(userMissingCardIds)
              .filter((missingCardId) => myOwnedCards.has(missingCardId))
              .map((cardId) => allCards.find((card) => card.id === cardId))
              .filter(Boolean) as PokemonCard[]

            usersWhoHaveThisCard.push({
              userId: profile.id,
              username: profile.username || `User ${profile.friend_code}`,
              friendCode: profile.friend_code,
              cardsTheyNeed: cardsTheyNeedThatIOwn,
            })
          }
        })

        if (usersWhoHaveThisCard.length > 0) {
          const card = allCards.find((c) => c.id === cardId)
          if (card) {
            opportunities.push({
              card,
              usersWithCard: usersWhoHaveThisCard,
            })
          }
        }
      })

      // Sort by number of users who have the card (rarest first)
      opportunities.sort((a, b) => a.usersWithCard.length - b.usersWithCard.length)

      setTradeOpportunities(opportunities)
    } catch (error) {
      console.error("Error fetching trade opportunities:", error)
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

  // Create proxied image URL
  const getImageUrl = (originalUrl: string) => {
    if (!originalUrl) return "/placeholder.svg"

    // If it's already a local URL, use it as-is
    if (originalUrl.startsWith("/") || originalUrl.startsWith("data:")) {
      return originalUrl
    }

    // Use the image proxy for external URLs
    return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`
  }

  const filteredOpportunities = tradeOpportunities.filter((opportunity) =>
    opportunity.card.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Traders</h1>
          <p className="text-gray-600">
            Find users who have the cards you're missing and see what you can trade to them
          </p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search missing cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-2xl font-bold text-red-600">{tradeOpportunities.length}</div>
            <div className="text-sm text-gray-600">Cards Available for Trade</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-2xl font-bold text-blue-600">
              {tradeOpportunities.reduce((sum, opp) => sum + opp.usersWithCard.length, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Trade Opportunities</div>
          </div>
        </div>

        {/* Trade Opportunities */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredOpportunities.length > 0 ? (
          <div className="space-y-6">
            {filteredOpportunities.map((opportunity) => (
              <Card key={opportunity.card.id} className="overflow-hidden">
                <CardHeader className="bg-red-50">
                  <CardTitle className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-20 relative bg-gray-100 rounded overflow-hidden">
                        <Image
                          src={getImageUrl(opportunity.card.image) || "/placeholder.svg"}
                          alt={opportunity.card.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold">{opportunity.card.name}</h3>
                      <p className="text-sm text-gray-600">
                        {opportunity.card.pack} • {opportunity.card.type} • {opportunity.card.rarity}
                      </p>
                      <p className="text-sm text-red-600">
                        {opportunity.usersWithCard.length} user{opportunity.usersWithCard.length !== 1 ? "s" : ""} have
                        this card
                      </p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    {opportunity.usersWithCard.map((userWithCard) => (
                      <div key={userWithCard.userId} className="border rounded-lg p-4 bg-gray-50">
                        {/* User Info */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{userWithCard.username}</div>
                            <div className="text-xs text-gray-500">Code: {userWithCard.friendCode}</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyFriendCode(userWithCard.friendCode)}
                            className="ml-2"
                          >
                            {copiedCode === userWithCard.friendCode ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>

                        {/* Cards you can trade to them */}
                        {userWithCard.cardsTheyNeed.filter(x => x.rarity === opportunity.card.rarity).length > 0 && (
                          <div className="border-t pt-4">
                            <div className="flex items-center space-x-2 mb-3">
                              <ArrowRightLeft className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-700">
                                Cards you can trade to them ({userWithCard.cardsTheyNeed.filter(x => x.rarity === opportunity.card.rarity).length})
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {userWithCard.cardsTheyNeed.filter(x => x.rarity === opportunity.card.rarity).slice(0, 8).map((card) => (
                                <div key={card.id} className="flex items-center space-x-2 p-2 bg-white rounded border">
                                  <div className="w-8 h-10 relative bg-gray-100 rounded overflow-hidden flex-shrink-0">
                                    <Image
                                      src={getImageUrl(card.image) || "/placeholder.svg"}
                                      alt={card.name}
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium truncate">{card.name}</div>
                                    <div className="text-xs text-gray-500">{card.rarity}</div>
                                  </div>
                                </div>
                              ))}
                              {userWithCard.cardsTheyNeed.filter(x => x.rarity === opportunity.card.rarity).length > 8 && (
                                <div className="flex items-center justify-center p-2 bg-white rounded border text-xs text-gray-500">
                                  +{userWithCard.cardsTheyNeed.filter(x => x.rarity === opportunity.card.rarity).length - 8} more
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <div className="text-gray-500 text-lg">
              {tradeOpportunities.length === 0 ? "No trade opportunities found" : "No cards match your search"}
            </div>
            <div className="text-gray-400 text-sm mt-2">
              {tradeOpportunities.length === 0
                ? "Either you have all cards or no other users are registered yet"
                : "Try a different search term"}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
