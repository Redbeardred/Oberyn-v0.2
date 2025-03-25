import { Redis } from "@upstash/redis"

// Función para crear una instancia de Redis con manejo de errores
function createRedisClient() {
  try {
    // Verificar que las variables de entorno estén disponibles
    console.log("Redis: Verificando variables de entorno para Redis")
    if (!process.env.REDIS_URL && !process.env.KV_URL && !process.env.KV_REST_API_URL) {
      console.warn("Redis: ⚠️ No se encontró REDIS_URL, KV_URL o KV_REST_API_URL en las variables de entorno")
    }

    console.log("Redis: Variables de entorno disponibles:", {
      REDIS_URL: process.env.REDIS_URL ? "Configurado" : "No configurado",
      KV_URL: process.env.KV_URL ? "Configurado" : "No configurado",
      KV_REST_API_URL: process.env.KV_REST_API_URL ? "Configurado" : "No configurado",
      KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? "Configurado" : "No configurado",
      KV_REST_API_READ_ONLY_TOKEN: process.env.KV_REST_API_READ_ONLY_TOKEN ? "Configurado" : "No configurado",
    })

    // Inicializar Redis usando variables de entorno
    console.log("Redis: Inicializando cliente Redis.fromEnv()")
    const redis = Redis.fromEnv()

    // Probar la conexión
    console.log("Redis: Probando conexión con ping()")
    redis
      .ping()
      .then(() => {
        console.log("Redis: ✅ Conexión a Redis establecida correctamente")
      })
      .catch((err) => {
        console.error("Redis: ❌ Error al conectar con Redis:", err)
      })

    return redis
  } catch (error) {
    console.error("Redis: ❌ Error al inicializar Redis:", error)

    // Crear un cliente simulado para desarrollo si hay problemas
    console.warn("Redis: ⚠️ Usando cliente Redis simulado")
    return createMockRedisClient()
  }
}

// Cliente Redis simulado para desarrollo
function createMockRedisClient() {
  const store = new Map()
  const setStore = new Map()

  return {
    get: async (key) => {
      console.log(`MockRedis: GET ${key}`)
      return store.get(key)
    },
    set: async (key, value) => {
      console.log(`MockRedis: SET ${key}`)
      store.set(key, value)
      return "OK"
    },
    hset: async (key, value) => {
      console.log(`MockRedis: HSET ${key}`)
      store.set(key, value)
      return "OK"
    },
    hgetall: async (key) => {
      console.log(`MockRedis: HGETALL ${key}`)
      return store.get(key) || {}
    },
    sadd: async (key, value) => {
      console.log(`MockRedis: SADD ${key} ${value}`)
      if (!setStore.has(key)) setStore.set(key, new Set())
      setStore.get(key).add(value)
      return 1
    },
    smembers: async (key) => {
      console.log(`MockRedis: SMEMBERS ${key}`)
      return Array.from(setStore.get(key) || [])
    },
    scard: async (key) => {
      console.log(`MockRedis: SCARD ${key}`)
      return (setStore.get(key) || new Set()).size
    },
    srem: async (key, value) => {
      console.log(`MockRedis: SREM ${key} ${value}`)
      if (!setStore.has(key)) return 0
      return setStore.get(key).delete(value) ? 1 : 0
    },
    ping: async () => {
      console.log(`MockRedis: PING`)
      return "PONG"
    },
  }
}

// Exportar la instancia de Redis
console.log("Redis: Creando cliente Redis")
const redis = createRedisClient()
export default redis

