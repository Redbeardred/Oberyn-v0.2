import { NextResponse } from "next/server"
import { refreshTokenIfNeeded } from "@/lib/mercadolibre"
import { getQuestionById, updateQuestionStatus } from "@/lib/models/question"
import { createAnswer } from "@/lib/models/answer"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { question_id, text, ml_question_id } = await request.json()

    if (!question_id || !text || !ml_question_id) {
      return NextResponse.json({ error: "Se requiere question_id, ml_question_id y text" }, { status: 400 })
    }

    // Obtener la pregunta de la base de datos
    const question = await getQuestionById(question_id)

    if (!question) {
      return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 })
    }

    // Asegurarse de que el token esté actualizado
    const accessToken = await refreshTokenIfNeeded()

    if (!accessToken) {
      return NextResponse.json({ error: "No se pudo obtener un token válido" }, { status: 401 })
    }

    // Enviar respuesta a MercadoLibre
    const response = await fetch(`https://api.mercadolibre.com/answers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        question_id: ml_question_id,
        text,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Error al enviar respuesta: ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()

    // Guardar la respuesta en la base de datos
    const answer = await createAnswer({
      question_id: question.id,
      user_id: session.user.id,
      text,
      is_sent: true,
      ai_generated: false,
    })

    // Actualizar el estado de la pregunta
    await updateQuestionStatus(question.id, "ANSWERED")

    return NextResponse.json({
      success: true,
      data,
      answer,
    })
  } catch (error) {
    console.error("❌ Error enviando respuesta:", error.message)
    return NextResponse.json({ error: "Error al enviar respuesta", message: error.message }, { status: 500 })
  }
}

