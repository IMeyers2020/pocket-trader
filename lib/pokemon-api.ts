import type { PokemonCard } from "@/types/pokemon"

let cachedCards: PokemonCard[] | null = null

export async function fetchPokemonCards(): Promise<PokemonCard[]> {
  // Return cached cards if available
  if (cachedCards) {
    return cachedCards
  }

  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/chase-manning/pokemon-tcg-pocket-cards/refs/heads/main/v4.json",
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch cards: ${response.statusText}`)
    }

    const cards: PokemonCard[] = await response.json()

    // Cache the cards
    cachedCards = cards

    return cards
  } catch (error) {
    console.error("Error fetching Pokemon cards:", error)
    throw error
  }
}

// Function to clear cache if needed
export function clearCardsCache() {
  cachedCards = null
}
