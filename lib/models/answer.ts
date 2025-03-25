import redis from "../redis"
import { v4 as uuidv4 } from "uuid"

export interface Answer {
  id: string
  question_id: string
  user_id: string
  text: string
  is_sent: boolean
  ai_generated: boolean
  created_at: string
  updated_at: string
}

export async function createAnswer(data: Omit<Answer, "id" | "created_at" | "updated_at">): Promise<Answer> {
  const id = uuidv4()
  const now = new Date().toISOString()

  const answer: Answer = {
    id,
    ...data,
    created_at: now,
    updated_at: now,
  }

  // Save the answer in Redis
  await redis.hset(`answer:${id}`, answer)

  // Add to the list of answers by question
  await redis.sadd(`question:${data.question_id}:answers`, id)

  return answer
}

export async function getAnswersByQuestionId(questionId: string): Promise<Answer[]> {
  const answerIds = await redis.smembers(`question:${questionId}:answers`)

  if (!answerIds.length) return []

  const answers = await Promise.all(answerIds.map((id) => redis.hgetall(`answer:${id}`)))

  return answers as unknown as Answer[]
}

export async function getAnswerById(id: string): Promise<Answer | null> {
  const answer = await redis.hgetall(`answer:${id}`)
  if (!answer || Object.keys(answer).length === 0) return null

  return answer as unknown as Answer
}

