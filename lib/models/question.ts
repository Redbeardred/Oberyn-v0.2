import redis from "../redis"
import { v4 as uuidv4 } from "uuid"

export type QuestionStatus = "UNANSWERED" | "PENDING" | "ANSWERED" | "REVIEW"

export interface Question {
  id: string
  ml_question_id: string
  product_id: string
  text: string
  status: QuestionStatus
  created_at: string
  updated_at: string
}

export async function createQuestion(data: Omit<Question, "id" | "created_at" | "updated_at">): Promise<Question> {
  try {
    const id = uuidv4()
    const now = new Date().toISOString()

    const question: Question = {
      id,
      ...data,
      created_at: now,
      updated_at: now,
    }

    // Save the question in Redis
    await redis.hset(`question:${id}`, question)

    // Create index by ml_question_id for quick lookup
    await redis.set(`question:ml_question_id:${data.ml_question_id}`, id)

    // Add to the list of questions by product
    await redis.sadd(`product:${data.product_id}:questions`, id)

    // Add to the list of questions by status
    await redis.sadd(`questions:status:${data.status}`, id)

    return question
  } catch (error) {
    console.error("Error creating question:", error)
    throw error
  }
}

export async function getQuestionByMlId(ml_question_id: string): Promise<Question | null> {
  try {
    const id = await redis.get(`question:ml_question_id:${ml_question_id}`)
    if (!id) return null

    const question = await redis.hgetall(`question:${id}`)
    if (!question || Object.keys(question).length === 0) return null

    return question as unknown as Question
  } catch (error) {
    console.error(`Error getting question by ML ID ${ml_question_id}:`, error)
    return null
  }
}

export async function getQuestionById(id: string): Promise<Question | null> {
  try {
    const question = await redis.hgetall(`question:${id}`)
    if (!question || Object.keys(question).length === 0) return null

    return question as unknown as Question
  } catch (error) {
    console.error(`Error getting question by ID ${id}:`, error)
    return null
  }
}

export async function getQuestionsByProductId(productId: string): Promise<Question[]> {
  try {
    const questionIds = await redis.smembers(`product:${productId}:questions`)

    if (!questionIds.length) return []

    const questions = await Promise.all(questionIds.map((id) => redis.hgetall(`question:${id}`)))

    return questions.filter((q) => q && Object.keys(q).length > 0) as unknown as Question[]
  } catch (error) {
    console.error(`Error getting questions by product ID ${productId}:`, error)
    return []
  }
}

export async function getQuestionsByStatus(status: QuestionStatus): Promise<Question[]> {
  try {
    const questionIds = await redis.smembers(`questions:status:${status}`)

    if (!questionIds.length) return []

    const questions = await Promise.all(questionIds.map((id) => redis.hgetall(`question:${id}`)))

    return questions.filter((q) => q && Object.keys(q).length > 0) as unknown as Question[]
  } catch (error) {
    console.error(`Error getting questions by status ${status}:`, error)
    return []
  }
}

export async function updateQuestionStatus(id: string, status: QuestionStatus): Promise<Question | null> {
  try {
    const question = await getQuestionById(id)
    if (!question) return null

    // Remove from the previous status list
    await redis.srem(`questions:status:${question.status}`, id)

    // Update the status
    const updatedQuestion = {
      ...question,
      status,
      updated_at: new Date().toISOString(),
    }

    // Save the updated question
    await redis.hset(`question:${id}`, updatedQuestion)

    // Add to the new status list
    await redis.sadd(`questions:status:${status}`, id)

    return updatedQuestion
  } catch (error) {
    console.error(`Error updating question status for ID ${id}:`, error)
    return null
  }
}

