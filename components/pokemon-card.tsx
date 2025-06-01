"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, Users, Copy } from "lucide-react"
import type { PokemonCard } from "@/types/pokemon"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface UserWithCard {
  userId: string
  username: string
  friendCode: string
}

interface PokemonCardProps {
  card: PokemonCard
  isMissing: boolean
  onToggleMissing: (cardId: string, isMissing: boolean) => void
  usersWithCard?: UserWithCard[]
  loading?: boolean
}

export function PokemonCardComponent({
  card,
  isMissing,
  onToggleMissing,
  usersWithCard = [],
  loading = false,
}: PokemonCardProps) {
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "◊":
        return "bg-gray-100 text-gray-800"
      case "◊◊":
        return "bg-green-100 text-green-800"
      case "◊◊◊":
        return "bg-blue-100 text-blue-800"
      case "◊◊◊◊":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Grass: "bg-green-500",
      Fire: "bg-red-500",
      Water: "bg-blue-500",
      Electric: "bg-yellow-500",
      Psychic: "bg-purple-500",
      Fighting: "bg-orange-500",
      Darkness: "bg-gray-800",
      Metal: "bg-gray-500",
      Colorless: "bg-gray-400",
    }
    return colors[type] || "bg-gray-400"
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

  // Create proxied image URL with better caching
  const getImageUrl = (originalUrl: string) => {
    if (!originalUrl) return "/placeholder.svg"

    // If it's already a local URL, use it as-is
    if (originalUrl.startsWith("/") || originalUrl.startsWith("data:")) {
      return originalUrl
    }

    // Use the image proxy for external URLs with cache optimization
    return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`
  }

  return (
    <Card
      className={`overflow-hidden transition-all duration-200 hover:shadow-lg ${
        isMissing ? "ring-2 ring-red-200 bg-red-50" : "bg-white"
      }`}
    >
      <CardContent className="p-4">
        <div className="relative mb-3">
          <div className="aspect-[3/4] relative bg-gray-100 rounded-lg overflow-hidden">
            {imageLoading && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
            {imageError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                <div className="text-center text-gray-500 text-xs p-2">
                  <div className="mb-1">Image</div>
                  <div>Unavailable</div>
                </div>
              </div>
            ) : (
              <Image
                src={getImageUrl(card.image) || "/placeholder.svg"}
                alt={card.name}
                fill
                className="object-cover"
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true)
                  setImageLoading(false)
                }}
                unoptimized
              />
            )}
          </div>
          {card.ex === "Yes" && <Badge className="absolute top-2 right-2 bg-yellow-500 text-white">EX</Badge>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm truncate">{card.name}</h3>
            <div className={`w-3 h-3 rounded-full ${getTypeColor(card.type)}`} title={card.type}></div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>{card.pack}</span>
            <span>HP {card.health}</span>
          </div>

          <div className="flex items-center justify-between">
            <Badge variant="outline" className={getRarityColor(card.rarity)}>
              {card.rarity}
            </Badge>
            <span className="text-xs text-gray-500">#{card.id}</span>
          </div>

          {/* Show users who have this card if the current user is missing it */}
          {isMissing && usersWithCard.length > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <div className="flex items-center space-x-1 text-xs text-green-600 cursor-pointer hover:text-green-700 p-1 rounded hover:bg-green-50">
                  <Users className="w-3 h-3" />
                  <span>
                    {usersWithCard.length} user{usersWithCard.length !== 1 ? "s" : ""} have this card
                  </span>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Users who have {card.name}</DialogTitle>
                  <DialogDescription>Contact these users to trade for this card</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {usersWithCard.map((userWithCard) => (
                    <div
                      key={userWithCard.userId}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{userWithCard.username}</div>
                        <div className="text-xs text-gray-500">Friend Code: {userWithCard.friendCode}</div>
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
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Button
            variant={isMissing ? "destructive" : "outline"}
            size="sm"
            className="w-full"
            onClick={() => onToggleMissing(card.id, isMissing)}
            disabled={loading}
          >
            {isMissing ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Mark as Owned
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Mark as Missing
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
