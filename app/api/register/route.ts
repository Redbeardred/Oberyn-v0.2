import { NextResponse } from "next/server"
import { createUser } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    // Create user
    const user = await createUser(name, email, password)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("❌ Error registering user:", error.message)

    if (error.message === "User already exists") {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 })
    }

    return NextResponse.json({ error: "Error registering user", message: error.message }, { status: 500 })
  }
}

