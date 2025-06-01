"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSupabaseClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { useEffect } from "react"
import { formatFriendCode, isValidFriendCode } from "@/lib/friend-code"

export default function AuthPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const router = useRouter()
  const { user } = useAuth()
  const [friendCode, setFriendCode] = useState("")
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (user) {
      router.push("/")
    }
  }, [user, router])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    // Validate friend code
    if (!isValidFriendCode(friendCode)) {
      setMessage("Please enter a valid 16-digit friend code")
      setLoading(false)
      return
    }

    // Check if friend code already exists
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("friend_code", friendCode)
      .single()

    if (existingProfile) {
      setMessage("This friend code is already taken. Please choose a different one.")
      setLoading(false)
      return
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setMessage(authError.message)
      setLoading(false)
      return
    }

    // Wait a moment for the trigger to create the profile, then update with custom friend code
    if (authData.user) {
      // Wait for the trigger to complete
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Update the auto-generated profile with the user's chosen friend code
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ friend_code: friendCode })
        .eq("id", authData.user.id)

      if (updateError) {
        console.error("Error updating friend code:", updateError)
        setMessage("Account created successfully! Please check your email for confirmation.")
      } else {
        setMessage("Account created successfully! Please check your email for confirmation.")
      }
    } else {
      setMessage("Check your email for the confirmation link!")
    }

    setLoading(false)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      router.push("/")
    }
    setLoading(false)
  }

  if (user) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-blue-600">Pokemon TCG Pocket Tracker</CardTitle>
          <CardDescription>Track your card collection with friends</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing In..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Input
                    type="text"
                    placeholder="Friend Code (1111-1111-1111-1111)"
                    value={friendCode}
                    onChange={(e) => setFriendCode(formatFriendCode(e.target.value))}
                    maxLength={19}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter 16 digits for your friend code (dashes added automatically)
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing Up..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {message && (
            <div
              className={`mt-4 text-center text-sm ${
                message.includes("successfully") ? "text-green-600" : "text-gray-600"
              }`}
            >
              {message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
