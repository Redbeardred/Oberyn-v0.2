import { Header } from "@/components/header"
import QuestionsList from "@/components/questions-list"

export default function QuestionsPage() {
  return (
    <>
      <Header />
      <main className="container mx-auto p-4 pt-6">
        <QuestionsList />
      </main>
    </>
  )
}

