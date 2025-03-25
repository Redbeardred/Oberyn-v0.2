import { Button } from "@/components/ui/button"
import { MainNav } from "@/components/main-nav"
import Link from "next/link"

export function Header() {
  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">MercadoLibre Q&A</h1>
          <MainNav />
        </div>
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/">Inicio</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

