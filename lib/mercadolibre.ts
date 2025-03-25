// Variables para almacenar los tokens
let currentAccessToken: string | null = null
let currentRefreshToken: string | null = null
let tokenExpirationTime: number | null = null

// Función para renovar el access_token automáticamente
export async function refreshToken() {
  console.log("MercadoLibre: 🔄 Iniciando renovación de access_token...")

  try {
    const CLIENT_ID = process.env.MERCADOLIBRE_CLIENT_ID
    const CLIENT_SECRET = process.env.MERCADOLIBRE_CLIENT_SECRET
    const REFRESH_TOKEN = currentRefreshToken || process.env.MERCADOLIBRE_REFRESH_TOKEN
    const SELLER_ID = process.env.MERCADOLIBRE_SELLER_ID

    // Agregar logs para depuración
    console.log("MercadoLibre: Variables de entorno disponibles:", {
      CLIENT_ID: CLIENT_ID ? "Configurado" : "No configurado",
      CLIENT_SECRET: CLIENT_SECRET ? "Configurado" : "No configurado",
      REFRESH_TOKEN: REFRESH_TOKEN ? "Configurado" : "No configurado",
      SELLER_ID: SELLER_ID ? "Configurado" : "No configurado",
    })

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      console.error("MercadoLibre: Faltan variables de entorno para la autenticación")
      throw new Error("Faltan variables de entorno para la autenticación")
    }

    const params = new URLSearchParams()
    params.append("grant_type", "refresh_token")
    params.append("client_id", CLIENT_ID)
    params.append("client_secret", CLIENT_SECRET)
    params.append("refresh_token", REFRESH_TOKEN)

    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Error en la API: ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()

    // Guardar los tokens y calcular tiempo de expiración (5 minutos antes para tener margen)
    currentAccessToken = data.access_token
    currentRefreshToken = data.refresh_token
    tokenExpirationTime = Date.now() + data.expires_in * 1000 - 5 * 60 * 1000

    console.log("✅ Nuevo access_token obtenido")
    console.log("🔄 Nuevo refresh_token guardado")

    return currentAccessToken
  } catch (error) {
    console.error("❌ Error al renovar el access_token:", error)
    return null
  }
}

// Función para verificar si el token necesita ser renovado
export async function refreshTokenIfNeeded() {
  // Si no hay token o está por expirar, renovarlo
  if (!currentAccessToken || !tokenExpirationTime || Date.now() >= tokenExpirationTime) {
    return await refreshToken()
  }

  return currentAccessToken
}

// Exportar el SELLER_ID para usarlo en otros lugares
export const getSellerId = () => process.env.MERCADOLIBRE_SELLER_ID

