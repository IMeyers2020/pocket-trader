"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { PokemonCardComponent } from "@/components/pokemon-card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase"
import type { PokemonCard, MissingCard } from "@/types/pokemon"
import { Search } from "lucide-react"
import { fetchPokemonCards } from "@/lib/pokemon-api"

interface UserWithCard {
  userId: string
  email: string
  friendCode: string
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<PokemonCard[]>([])
  const [missingCards, setMissingCards] = useState<Set<string>>(new Set())
  const [usersWithCards, setUsersWithCards] = useState<Record<string, UserWithCard[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPack, setSelectedPack] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedRarity, setSelectedRarity] = useState<string>("all")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchCards()
      fetchMissingCards()
    }
  }, [user])

  useEffect(() => {
    if (user && cards.length > 0) {
      fetchUsersWithCards()
    }
  }, [user, cards, missingCards])

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

  const fetchMissingCards = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase.from("missing_cards").select("card_id").eq("user_id", user.id)

      if (error) throw error

      const missingSet = new Set(data.map((item: MissingCard) => item.card_id))
      setMissingCards(missingSet)
    } catch (error) {
      console.error("Error fetching missing cards:", error)
    }
  }

  const fetchUsersWithCards = async () => {
    if (!user || cards.length === 0) return

    try {
      // Get all users who have missing cards (excluding current user)
      const { data: allMissingCards, error: missingError } = await supabase
        .from("missing_cards")
        .select(`
          card_id,
          user_id,
          user_profiles!inner(friend_code)
        `)
        .neq("user_id", user.id)

      if (missingError) throw missingError

      // Get all user profiles to find users who have marked cards as missing
      const { data: allProfiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, friend_code")
        .neq("id", user.id)

      if (profilesError) throw profilesError

      // Create a set of users who have missing cards
      const usersWithMissingCards = new Set(allMissingCards.map((item: any) => item.user_id))

      // Create a set of all card IDs that other users are missing
      const cardsMissingByOthers = new Set(allMissingCards.map((item: any) => item.card_id))

      // For each card, determine which users have it (users who haven't marked it as missing)
      const usersWithCardsMap: Record<string, UserWithCard[]> = {}

      // Only process cards that the current user is missing
      const myMissingCardIds = Array.from(missingCards)

      for (const cardId of myMissingCardIds) {
        const usersWhoHaveThisCard: UserWithCard[] = []

        // Find users who have this card (haven't marked it as missing and have some activity)
        for (const profile of allProfiles) {
          const userMissingThisCard = allMissingCards.some(
            (missing: any) => missing.user_id === profile.id && missing.card_id === cardId,
          )

          // User has this card if:
          // 1. They haven't marked it as missing AND
          // 2. They have marked at least one card as missing (showing they're active)
          if (!userMissingThisCard && usersWithMissingCards.has(profile.id)) {
            usersWhoHaveThisCard.push({
              userId: profile.id,
              email: `User ${profile.friend_code}`, // We'll try to get email later
              friendCode: profile.friend_code,
            })
          }
        }

        if (usersWhoHaveThisCard.length > 0) {
          usersWithCardsMap[cardId] = usersWhoHaveThisCard
        }
      }

      // Try to get actual email addresses (this might fail due to RLS, so we'll use fallback)
      try {
        const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()
        if (!usersError && usersData) {
          // Update with real email addresses
          Object.keys(usersWithCardsMap).forEach((cardId) => {
            usersWithCardsMap[cardId] = usersWithCardsMap[cardId].map((userWithCard) => {
              const userData = usersData.users.find((u) => u.id === userWithCard.userId)
              return {
                ...userWithCard,
                email: userData?.email || userWithCard.email,
              }
            })
          })
        }
      } catch (error) {
        // Fallback to friend codes if we can't get emails
        console.log("Using friend codes as fallback for user identification")
      }

      setUsersWithCards(usersWithCardsMap)
    } catch (error) {
      console.error("Error fetching users with cards:", error)
    }
  }

  const toggleMissingCard = async (cardId: string, isMissing: boolean) => {
    if (!user) return

    setActionLoading(cardId)
    try {
      if (isMissing) {
        // Remove from missing cards
        const { error } = await supabase.from("missing_cards").delete().eq("user_id", user.id).eq("card_id", cardId)

        if (error) throw error

        setMissingCards((prev) => {
          const newSet = new Set(prev)
          newSet.delete(cardId)
          return newSet
        })
      } else {
        // Add to missing cards
        const { error } = await supabase.from("missing_cards").insert({ user_id: user.id, card_id: cardId })

        if (error) throw error

        setMissingCards((prev) => new Set([...prev, cardId]))
      }

      // Refresh users with cards after updating missing status
      setTimeout(() => {
        fetchUsersWithCards()
      }, 500)
    } catch (error) {
      console.error("Error toggling missing card:", error)
    } finally {
      setActionLoading(null)
    }
  }

  const filteredCards = cards.filter((card) => {
    const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPack = selectedPack === "all" || card.pack === selectedPack
    const matchesType = selectedType === "all" || card.type === selectedType
    const matchesRarity = selectedRarity === "all" || card.rarity === selectedRarity
    return matchesSearch && matchesPack && matchesType
  })

  const packs = [...new Set(cards.filter(card => Boolean(card.pack) && card.pack !== "Error").map((card) => card.pack))]
  const types = [...new Set(cards.filter(card => Boolean(card.type) && card.type !== "Error").map((card) => card.type))]
  const rarities = [...new Set(cards.filter(card => Boolean(card.rarity) && card.rarity !== "Error").map((card) => card.rarity))]

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pokemon Cards</h1>
          <p className="text-gray-600">Browse and manage your card collection</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search cards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <Select value={selectedPack} onValueChange={setSelectedPack}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Pack" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Packs</SelectItem>
                  {packs.map((pack) => (
                    <SelectItem key={pack} value={pack}>
                      {pack}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedPack} onValueChange={setSelectedRarity}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Rarity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rarities</SelectItem>
                  {rarities.map((rarity: string) => (
                    <SelectItem key={rarity} value={rarity}>
                      {rarity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-2xl font-bold text-blue-600">{cards.length}</div>
            <div className="text-sm text-gray-600">Total Cards</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-2xl font-bold text-green-600">{cards.length - missingCards.size}</div>
            <div className="text-sm text-gray-600">Cards Owned</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-2xl font-bold text-red-600">{missingCards.size}</div>
            <div className="text-sm text-gray-600">Cards Missing</div>
          </div>
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredCards.map((card) => (
              <PokemonCardComponent
                key={card.id}
                card={card}
                isMissing={missingCards.has(card.id)}
                onToggleMissing={toggleMissingCard}
                usersWithCard={usersWithCards[card.id] || []}
                loading={actionLoading === card.id}
              />
            ))}
          </div>
        )}

        {filteredCards.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">No cards found matching your filters</div>
          </div>
        )}
      </div>
    </div>
  )
}
