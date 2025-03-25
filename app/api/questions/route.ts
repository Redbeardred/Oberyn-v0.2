import { NextResponse } from "next/server"
import { refreshTokenIfNeeded, getSellerId } from "@/lib/mercadolibre"
import { getProductByMlId, createProduct } from "@/lib/models/product"
import { getQuestionByMlId, createQuestion } from "@/lib/models/question"

// Función para obtener preguntas de MercadoLibre
export async function GET() {
  console.log("API /questions: 🔄 Iniciando solicitud de preguntas a MercadoLibre...")

  try {
    // Asegurarse de que el token esté actualizado
    console.log("API /questions: Solicitando token actualizado")
    const accessToken = await refreshTokenIfNeeded()
    console.log("API /questions: Token recibido:", !!accessToken)

    if (!accessToken) {
      console.error("API /questions: No se pudo obtener un token válido")
      return NextResponse.json({ error: "No se pudo obtener un token válido" }, { status: 401 })
    }

    const SELLER_ID = getSellerId()
    console.log("API /questions: SELLER_ID:", SELLER_ID)

    if (!SELLER_ID) {
      console.error("API /questions: SELLER_ID no está configurado")
      return NextResponse.json({ error: "SELLER_ID no está configurado" }, { status: 400 })
    }

    // Obtener preguntas sin responder
    const response = await fetch(
      `https://api.mercadolibre.com/questions/search?seller_id=${SELLER_ID}&status=UNANSWERED&limit=100&api_version=4`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: 0 }, // No cachear esta solicitud
      },
    )

    if (!response.ok) {
      throw new Error(`Error en la API de MercadoLibre: ${response.status}`)
    }

    const data = await response.json()
    console.log("📌 Respuesta de MercadoLibre antes de filtrar:", data)

    // Verificar que data.questions sea un array
    if (!Array.isArray(data.questions)) {
      console.error("API /questions: data.questions no es un array:", data.questions)
      return NextResponse.json(
        {
          error: "Formato de respuesta inesperado",
          groupedQuestions: {},
        },
        { status: 200 },
      )
    }

    // Filtrar solo preguntas sin responder y no eliminadas
    const filteredQuestions = data.questions.filter((q) => !q.answer && !q.deleted_from_listing)
    console.log(`API /questions: Filtradas ${filteredQuestions.length} preguntas sin responder`)

    // Procesar las preguntas y guardarlas en la base de datos
    await processQuestions(filteredQuestions, accessToken)

    // Obtener los títulos de los productos
    const itemIds = [...new Set(filteredQuestions.map((q) => q.item_id))] // Obtener IDs únicos
    const productTitles = await fetchProductTitles(itemIds, accessToken)

    // Agrupar preguntas por producto
    const groupedQuestions = {}
    filteredQuestions.forEach((q) => {
      if (!groupedQuestions[q.item_id]) {
        groupedQuestions[q.item_id] = {
          title: productTitles[q.item_id] || "Producto sin título",
          questions: [],
        }
      }
      groupedQuestions[q.item_id].questions.push(q)
    })

    console.log("📌 Preguntas agrupadas por producto:", Object.keys(groupedQuestions).length)
    return NextResponse.json({ groupedQuestions })
  } catch (error) {
    console.error("❌ Error obteniendo preguntas:", error.message)
    return NextResponse.json({ error: "Error al obtener preguntas", message: error.message }, { status: 500 })
  }
}

// Función para procesar y guardar preguntas en la base de datos
async function processQuestions(questions, accessToken) {
  // Verificar que questions sea un array
  if (!Array.isArray(questions)) {
    console.error("processQuestions: questions no es un array:", questions)
    return
  }

  for (const q of questions) {
    try {
      // Verificar que q.id exista
      if (!q.id) {
        console.error("processQuestions: Pregunta sin ID:", q)
        continue
      }

      // Verificar si la pregunta ya existe en la base de datos
      const existingQuestion = await getQuestionByMlId(q.id)

      if (!existingQuestion) {
        // Verificar que q.item_id exista
        if (!q.item_id) {
          console.error("processQuestions: Pregunta sin item_id:", q)
          continue
        }

        // Verificar si el producto existe
        let product = await getProductByMlId(q.item_id)

        // Si el producto no existe, crearlo
        if (!product) {
          const productData = await fetchProductDetails(q.item_id, accessToken)

          product = await createProduct({
            ml_item_id: q.item_id,
            title: productData.title || "Producto sin título",
            description: productData.description || "",
            additional_info: {
              permalink: productData.permalink,
              price: productData.price,
              currency_id: productData.currency_id,
              available_quantity: productData.available_quantity,
              thumbnail: productData.thumbnail,
            },
          })
        }

        // Crear la pregunta
        await createQuestion({
          ml_question_id: q.id,
          product_id: product.id,
          text: q.text || "Sin texto",
          status: "UNANSWERED",
        })
      }
    } catch (error) {
      console.error(`Error procesando pregunta ${q.id}:`, error)
    }
  }
}

// Función para obtener títulos de productos
async function fetchProductTitles(itemIds, accessToken) {
  // Verificar que itemIds sea un array
  if (!Array.isArray(itemIds)) {
    console.error("fetchProductTitles: itemIds no es un array:", itemIds)
    return {}
  }

  const titles = {}

  await Promise.all(
    itemIds.map(async (id) => {
      try {
        const response = await fetch(`https://api.mercadolibre.com/items/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          next: { revalidate: 0 }, // No cachear esta solicitud
        })

        if (!response.ok) {
          throw new Error(`Error al obtener producto: ${response.status}`)
        }

        const data = await response.json()
        titles[id] = data.title
      } catch (error) {
        console.error(`❌ Error obteniendo título del producto ${id}:`, error.message)
        titles[id] = "Producto desconocido"
      }
    }),
  )

  return titles
}

// Función para obtener detalles completos de un producto
async function fetchProductDetails(itemId, accessToken) {
  try {
    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      throw new Error(`Error al obtener producto: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`❌ Error obteniendo detalles del producto ${itemId}:`, error.message)
    return { title: "Producto desconocido" }
  }
}

