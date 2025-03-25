import redis from "../redis"
import { v4 as uuidv4 } from "uuid"

export interface Product {
  id: string
  ml_item_id: string
  title: string
  description: string
  additional_info?: Record<string, any>
  created_at: string
  updated_at: string
}

export async function createProduct(data: Omit<Product, "id" | "created_at" | "updated_at">): Promise<Product> {
  try {
    const id = uuidv4()
    const now = new Date().toISOString()

    const product: Product = {
      id,
      ...data,
      created_at: now,
      updated_at: now,
    }

    // Save the product in Redis
    await redis.hset(`product:${id}`, product)

    // Create index by ml_item_id for quick lookup
    await redis.set(`product:ml_item_id:${data.ml_item_id}`, id)

    // Add to the list of products
    await redis.sadd("products", id)

    return product
  } catch (error) {
    console.error("Error creating product:", error)
    throw error
  }
}

export async function getProductByMlId(ml_item_id: string): Promise<Product | null> {
  try {
    const id = await redis.get(`product:ml_item_id:${ml_item_id}`)
    if (!id) return null

    const product = await redis.hgetall(`product:${id}`)
    if (!product || Object.keys(product).length === 0) return null

    return product as unknown as Product
  } catch (error) {
    console.error(`Error getting product by ML ID ${ml_item_id}:`, error)
    return null
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const product = await redis.hgetall(`product:${id}`)
    if (!product || Object.keys(product).length === 0) return null

    return product as unknown as Product
  } catch (error) {
    console.error(`Error getting product by ID ${id}:`, error)
    return null
  }
}

export async function getAllProducts(): Promise<Product[]> {
  try {
    const productIds = await redis.smembers("products")

    if (!productIds.length) return []

    const products = await Promise.all(productIds.map((id) => redis.hgetall(`product:${id}`)))

    return products.filter((p) => p && Object.keys(p).length > 0) as unknown as Product[]
  } catch (error) {
    console.error("Error getting all products:", error)
    return []
  }
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<Product, "id" | "created_at" | "updated_at">>,
): Promise<Product | null> {
  try {
    const product = await getProductById(id)
    if (!product) return null

    const updatedProduct = {
      ...product,
      ...data,
      updated_at: new Date().toISOString(),
    }

    await redis.hset(`product:${id}`, updatedProduct)

    return updatedProduct
  } catch (error) {
    console.error(`Error updating product ${id}:`, error)
    return null
  }
}

