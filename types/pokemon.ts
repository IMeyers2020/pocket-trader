export interface PokemonCard {
  id: string
  name: string
  rarity: string
  pack: string
  health: string
  image: string
  fullart: string
  ex: string
  artist: string
  type: string
}

export interface MissingCard {
  id: string
  user_id: string
  card_id: string
  created_at: string
}

export interface UserProfile {
  id: string
  username: string
  friend_code: string
  created_at?: string
  updated_at?: string
}
