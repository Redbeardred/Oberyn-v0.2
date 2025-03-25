import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import redis from "./redis"
import { v4 as uuidv4 } from "uuid"
import { hash, compare } from "bcryptjs"

// Check if a user exists
async function userExists(email: string): Promise<boolean> {
  try {
    const userId = await redis.get(`user:email:${email}`)
    return !!userId
  } catch (error) {
    console.error("Error checking if user exists:", error)
    return false
  }
}

// Get a user by email
async function getUserByEmail(email: string) {
  try {
    const userId = await redis.get(`user:email:${email}`)
    if (!userId) return null

    const user = await redis.hgetall(`user:${userId}`)
    return user
  } catch (error) {
    console.error("Error getting user by email:", error)
    return null
  }
}

// Create a new user
export async function createUser(name: string, email: string, password: string) {
  try {
    // Check if user already exists
    if (await userExists(email)) {
      throw new Error("User already exists")
    }

    // Generate unique ID for the user
    const userId = uuidv4()

    // Hash the password
    const hashedPassword = await hash(password, 10)

    // Save the user in Redis
    await redis.hset(`user:${userId}`, {
      id: userId,
      name,
      email,
      password: hashedPassword,
      role: "user",
      createdAt: new Date().toISOString(),
    })

    // Create index by email for quick lookup
    await redis.set(`user:email:${email}`, userId)

    return { id: userId, name, email, role: "user" }
  } catch (error) {
    console.error("Error creating user:", error)
    throw error
  }
}

// NextAuth configuration
export const authOptions: NextAuthOptions = {
  debug: true, // Enable debug mode for more information
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.log("Missing credentials")
            return null
          }

          const user = await getUserByEmail(credentials.email)

          if (!user || !user.password) {
            console.log("User not found or no password")
            return null
          }

          const passwordMatch = await compare(credentials.password, user.password)

          if (!passwordMatch) {
            console.log("Password doesn't match")
            return null
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }
        } catch (error) {
          console.error("Error in authorize function:", error)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
}

