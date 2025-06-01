"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { PokemonCardComponent } from "@/components/pokemon-card"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase"
import type { PokemonCard, MissingCard } from "@/types/pokemon"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchPokemonCards } from "@/lib/pokemon-api"

export default function CollectionPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<PokemonCard[]>([])
  const [missingCards, setMissingCards] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
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

  const toggleMissingCard = async (cardId: string, isMissing: boolean) => {
    if (!user) return

    setActionLoading(cardId)
    try {
      if (isMissing) {
        const { error } = await supabase.from("missing_cards").delete().eq("user_id", user.id).eq("card_id", cardId)

        if (error) throw error

        setMissingCards((prev) => {
          const newSet = new Set(prev)
          newSet.delete(cardId)
          return newSet
        })
      } else {
        const { error } = await supabase.from("missing_cards").insert({ user_id: user.id, card_id: cardId })

        if (error) throw error

        setMissingCards((prev) => new Set([...prev, cardId]))
      }
    } catch (error) {
      console.error("Error toggling missing card:", error)
    } finally {
      setActionLoading(null)
    }
  }

  const ownedCards = cards.filter((card) => !missingCards.has(card.id))
  const missingCardsList = cards.filter((card) => missingCards.has(card.id))

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Collection</h1>
          <p className="text-gray-600">View your owned and missing cards</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-2xl font-bold text-blue-600">{cards.length}</div>
            <div className="text-sm text-gray-600">Total Cards</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-2xl font-bold text-green-600">{ownedCards.length}</div>
            <div className="text-sm text-gray-600">Cards Owned</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-2xl font-bold text-red-600">{missingCardsList.length}</div>
            <div className="text-sm text-gray-600">Cards Missing</div>
          </div>
        </div>

        <Tabs defaultValue="owned" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="owned">Owned Cards ({ownedCards.length})</TabsTrigger>
            <TabsTrigger value="missing">Missing Cards ({missingCardsList.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="owned" className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : ownedCards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {ownedCards.map((card) => (
                  <PokemonCardComponent
                    key={card.id}
                    card={card}
                    isMissing={false}
                    onToggleMissing={toggleMissingCard}
                    loading={actionLoading === card.id}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg">No owned cards yet</div>
                <div className="text-gray-400 text-sm mt-2">
                  Start marking cards as missing to see your owned collection
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="missing" className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : missingCardsList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {missingCardsList.map((card) => (
                  <PokemonCardComponent
                    key={card.id}
                    card={card}
                    isMissing={true}
                    onToggleMissing={toggleMissingCard}
                    loading={actionLoading === card.id}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg">No missing cards</div>
                <div className="text-gray-400 text-sm mt-2">You have all the cards! 🎉</div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
