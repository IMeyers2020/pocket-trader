export function formatFriendCode(input: string): string {
  // Remove all non-numeric characters
  const numbers = input.replace(/\D/g, "")

  // Limit to 16 digits
  const limited = numbers.slice(0, 16)

  // Add dashes every 4 digits
  const formatted = limited.replace(/(\d{4})(?=\d)/g, "$1-")

  return formatted
}

export function isValidFriendCode(code: string): boolean {
  // Check if it matches the pattern 1111-1111-1111-1111 (16 digits with dashes)
  const pattern = /^\d{4}-\d{4}-\d{4}-\d{4}$/
  return pattern.test(code)
}

export function generateRandomFriendCode(): string {
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
