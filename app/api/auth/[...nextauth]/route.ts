// This file redirects to the Pages Router implementation
export async function GET(request) {
  const url = new URL(request.url)
  return Response.redirect(`/api/auth${url.search}`)
}

export async function POST(request) {
  const url = new URL(request.url)
  return Response.redirect(`/api/auth${url.search}`)
}

