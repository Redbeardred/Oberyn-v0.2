import OpenAI from "openai"
import { getProductById } from "./models/product"
import { getAnswersByQuestionId } from "./models/answer"
import { getDefaultPromptTemplate } from "./models/prompt"

// Inicializar cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Función para generar un prompt estructurado para una pregunta
export async function generateStructuredPrompt(questionText: string, productId: string) {
  // Obtener información del producto
  const product = await getProductById(productId)

  // Obtener respuestas anteriores relacionadas con este producto
  // Esto es una simplificación, idealmente buscaríamos respuestas similares
  const previousAnswers = await getAnswersByQuestionId(productId)

  // Obtener el template de prompt predeterminado
  const promptTemplate = await getDefaultPromptTemplate()

  // Si no hay template, usar uno predeterminado
  const templateContent =
    promptTemplate?.content ||
    `
# Contexto
Eres un asistente de ventas para un vendedor de MercadoLibre. Tu tarea es generar 3 respuestas diferentes para la siguiente pregunta de un cliente potencial.

## Información del Producto
Título: {{product_title}}
Descripción: {{product_description}}
{{product_additional_info}}

## Historial de Respuestas Anteriores
{{previous_answers}}

# Pregunta del Cliente
{{question_text}}

# Instrucciones
Genera 3 respuestas diferentes para esta pregunta. Cada respuesta debe:
1. Ser cordial y profesional
2. Proporcionar información precisa basada en los datos del producto
3. Tener un tono ligeramente diferente (formal, amigable, directo)
4. Ser concisa pero completa
5. Incluir un llamado a la acción sutil para fomentar la compra

Formatea tu respuesta como:
OPCIÓN A:
[Primera respuesta]

OPCIÓN B:
[Segunda respuesta]

OPCIÓN C:
[Tercera respuesta]
`

  // Reemplazar variables en el template
  let prompt = templateContent
    .replace("{{product_title}}", product?.title || "Producto sin título")
    .replace("{{product_description}}", product?.description || "Sin descripción disponible")
    .replace("{{question_text}}", questionText)

  // Reemplazar información adicional del producto
  if (product?.additional_info) {
    prompt = prompt.replace(
      "{{product_additional_info}}",
      `Información adicional: ${JSON.stringify(product.additional_info, null, 2)}`,
    )
  } else {
    prompt = prompt.replace("{{product_additional_info}}", "")
  }

  // Reemplazar historial de respuestas
  if (previousAnswers.length > 0) {
    prompt = prompt.replace(
      "{{previous_answers}}",
      previousAnswers.map((a) => `Pregunta similar: ${a.text}`).join("\n"),
    )
  } else {
    prompt = prompt.replace("{{previous_answers}}", "No hay respuestas anteriores disponibles para este producto.")
  }

  return prompt
}

// Función para generar 3 opciones de respuesta usando OpenAI
export async function generateAnswerOptions(questionText: string, productId: string) {
  try {
    // Generar el prompt estructurado
    const prompt = await generateStructuredPrompt(questionText, productId)

    // Llamar a la API de OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Eres un asistente de ventas experto para MercadoLibre." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const responseText = completion.choices[0].message.content || ""

    // Parsear las opciones de respuesta
    const optionA = extractOption(responseText, "OPCIÓN A:")
    const optionB = extractOption(responseText, "OPCIÓN B:")
    const optionC = extractOption(responseText, "OPCIÓN C:")

    return {
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      prompt_used: prompt,
    }
  } catch (error) {
    console.error("Error generando respuestas con OpenAI:", error)
    throw error
  }
}

// Función auxiliar para extraer una opción de respuesta del texto
function extractOption(text: string, optionLabel: string) {
  const regex = new RegExp(`${optionLabel}([\\s\\S]*?)(?=OPCIÓN|$)`)
  const match = text.match(regex)
  return match ? match[1].trim() : `No se pudo generar la ${optionLabel}`
}

