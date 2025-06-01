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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { fetchPokemonCards } from "@/lib/pokemon-api"
import { LoaderCircle, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface PackProgress {
  packName: string
  total: number
  owned: number
  percentage: number
}

export default function CollectionPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<PokemonCard[]>([])
  const [missingCards, setMissingCards] = useState<Set<string>>(new Set())
  const [missingCardsLoading, setMissingCardsLoading] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPack, setSelectedPack] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedRarity, setSelectedRarity] = useState<string>("all")
  const [packProgress, setPackProgress] = useState<PackProgress[]>([])
  const [overallProgress, setOverallProgress] = useState<PackProgress | null>(null)
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
    if (cards.length > 0) {
      calculatePackProgress()
    }
  }, [cards, missingCards])

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
    } finally {
      setMissingCardsLoading(false)
    }
  }

  const calculatePackProgress = () => {
    const packStats: Record<string, { total: number; owned: number }> = {}
    let totalCards = 0
    let totalOwned = 0

    // Count total cards per pack
    cards.forEach((card) => {
      if (!packStats[card.pack]) {
        packStats[card.pack] = { total: 0, owned: 0 }
      }
      packStats[card.pack].total++
      totalCards++

      // Count owned cards (not in missing cards)
      if (!missingCards.has(card.id)) {
        packStats[card.pack].owned++
        totalOwned++
      }
    })

    // Calculate overall progress
    setOverallProgress({
      packName: "All Packs",
      total: totalCards,
      owned: totalOwned,
      percentage: totalOwned === totalCards ? 100 : Math.floor((totalOwned / totalCards) * 100),
    })

    // Convert to progress array and sort by completion percentage
    const progress = Object.entries(packStats)
      .map(([packName, stats]) => ({
        packName,
        total: stats.total,
        owned: stats.owned,
        percentage: stats.owned === stats.total ? 100 : Math.floor((stats.owned / stats.total) * 100),
      }))
      .sort((a, b) => b.percentage - a.percentage)

    setPackProgress(progress)
  }

  const getProgressColor = (percentage: number) => {
    if (percentage < 25) return "bg-red-500"
    if (percentage < 50) return "bg-orange-500"
    if (percentage < 75) return "bg-yellow-500"
    if (percentage < 100) return "bg-blue-500"
    return "bg-green-500"
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

  const filteredCards = cards.filter((card) => {
    const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPack = selectedPack === "all" || card.pack === selectedPack
    const matchesType = selectedType === "all" || card.type === selectedType
    const matchesRarity = selectedRarity === "all" || card.rarity === selectedRarity
    return matchesSearch && matchesPack && matchesType && matchesRarity
  })

  const ownedCards = filteredCards.filter((card) => !missingCards.has(card.id))
  const missingCardsList = filteredCards.filter((card) => missingCards.has(card.id))

  const packs = [...new Set(cards.map((card) => card.pack))]
  const types = [...new Set(cards.map((card) => card.type))]
  const rarities = [...new Set(cards.map((card) => card.rarity))].sort()

  // Get the progress for the selected pack or overall
  const selectedPackProgress =
    selectedPack !== "all" ? packProgress.find((p) => p.packName === selectedPack) : overallProgress

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

        {/* Search and Filters */}
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
              <Select value={selectedRarity} onValueChange={setSelectedRarity}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Rarity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rarities</SelectItem>
                  {rarities.map((rarity) => (
                    <SelectItem key={rarity} value={rarity}>
                      {rarity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Pack Progress Section - Only show for selected pack or overall */}
        {selectedPackProgress && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            {
              missingCardsLoading && (
                <div className="flex items-center justify-center">
                  <LoaderCircle className="animate-spin" />
                </div>
              )
            }
            {
              !missingCardsLoading && (
                <>
                <h2 className="text-xl font-semibold mb-4">
                  {selectedPack === "all" ? "Overall Collection Progress" : `${selectedPackProgress.packName} Progress`}
                </h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">{selectedPackProgress.packName}</span>
                    <span className="text-sm text-gray-500">
                      {selectedPackProgress.owned}/{selectedPackProgress.total} ({selectedPackProgress.percentage}%)
                    </span>
                  </div>
                  <Progress
                    value={selectedPackProgress.percentage}
                    className="h-4"
                    indicatorClassName={cn(getProgressColor(selectedPackProgress.percentage))}
                  />

                  {/* Completion message */}
                  {selectedPackProgress.percentage === 100 && (
                    <div className="text-center text-green-600 font-medium mt-2">
                      🎉 Complete! You've collected all cards in this set!
                    </div>
                  )}
                </div>
                </>
              )
            }
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-2xl font-bold text-blue-600">{filteredCards.length}</div>
            <div className="text-sm text-gray-600">
              {selectedPack === "all" ? "Total Cards" : `${selectedPack} Cards`}
            </div>
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
                <div className="text-gray-500 text-lg">No owned cards found</div>
                <div className="text-gray-400 text-sm mt-2">
                  {searchTerm || selectedPack !== "all" || selectedType !== "all" || selectedRarity !== "all"
                    ? "Try adjusting your search or filters"
                    : "Start marking cards as missing to see your owned collection"}
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
                <div className="text-gray-500 text-lg">No missing cards found</div>
                <div className="text-gray-400 text-sm mt-2">
                  {searchTerm || selectedPack !== "all" || selectedType !== "all" || selectedRarity !== "all"
                    ? "Try adjusting your search or filters"
                    : "You have all the cards! 🎉"}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
