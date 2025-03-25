import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function Home() {
  return (
    <>
      <Header />
      <main className="container mx-auto p-4 pt-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h1 className="text-4xl font-bold mb-6">Sistema de Gestión de Preguntas de MercadoLibre</h1>
          <p className="text-xl mb-8 max-w-2xl">
            Administra y responde preguntas de tus productos en MercadoLibre de forma eficiente.
          </p>
          <div className="flex gap-4">
            <Button asChild size="lg">
              <Link href="/questions">Ver Preguntas</Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  )
}

