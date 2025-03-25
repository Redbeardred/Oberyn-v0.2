"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExternalLink, RefreshCw, MessageSquare } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface Question {
  id: string
  text: string
  item_id: string
  ml_question_id: string
}

interface Product {
  title: string
  questions: Question[]
}

interface GroupedQuestions {
  [key: string]: Product
}

interface AiSuggestion {
  option_a: string
  option_b: string
  option_c: string
}

export default function QuestionsList() {
  const { toast } = useToast()
  const [groupedQuestions, setGroupedQuestions] = useState<GroupedQuestions>({})
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AiSuggestion>>({})
  const [generatingSuggestions, setGeneratingSuggestions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    console.log("QuestionsList: Componente montado, iniciando fetchQuestions")
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    console.log("QuestionsList: Iniciando fetchQuestions")
    setLoading(true)
    setError(null)

    try {
      console.log("QuestionsList: Realizando fetch a /api/questions")
      const response = await fetch("/api/questions")
      console.log("QuestionsList: Respuesta recibida", { status: response.status, ok: response.ok })

      if (!response.ok) {
        const errorData = await response.json().catch((e) => ({ message: "No se pudo parsear el error" }))
        console.error("QuestionsList: Error en la respuesta", errorData)
        throw new Error(`Error: ${response.status} - ${errorData.message || "Error desconocido"}`)
      }

      const data = await response.json()
      console.log("QuestionsList: Datos recibidos", {
        dataExists: !!data,
        groupedQuestionsExists: !!data.groupedQuestions,
        groupedQuestionsKeys: data.groupedQuestions ? Object.keys(data.groupedQuestions).length : 0,
      })
      setGroupedQuestions(data.groupedQuestions || {})
    } catch (err) {
      console.error("QuestionsList: Error obteniendo preguntas:", err)
      setError(`No se pudieron cargar las preguntas: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Contar la cantidad total de preguntas
  const totalQuestions = Object.values(groupedQuestions).reduce((acc, product) => acc + product.questions.length, 0)

  // Manejar cambios en las respuestas editables
  const handleResponseChange = (productId: string, questionId: string, value: string) => {
    setResponses((prevResponses) => ({
      ...prevResponses,
      [`${productId}-${questionId}`]: value,
    }))
  }

  // Manejar selección de preguntas
  const handleQuestionSelect = (productId: string, questionId: string) => {
    const key = `${productId}-${questionId}`

    setSelectedQuestions((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key)
      } else {
        return [...prev, key]
      }
    })
  }

  // Generar sugerencias de IA para una pregunta
  const generateSuggestions = async (productId: string, questionId: string, mlQuestionId: string) => {
    const key = `${productId}-${questionId}`

    setGeneratingSuggestions((prev) => ({ ...prev, [key]: true }))

    try {
      const response = await fetch("/api/generate-answers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question_id: questionId,
          ml_question_id: mlQuestionId,
        }),
      })

      if (!response.ok) {
        throw new Error("Error al generar sugerencias")
      }

      const data = await response.json()

      setAiSuggestions((prev) => ({
        ...prev,
        [key]: {
          option_a: data.suggestion.option_a,
          option_b: data.suggestion.option_b,
          option_c: data.suggestion.option_c,
        },
      }))

      toast({
        title: "Sugerencias generadas",
        description: "Se han generado 3 opciones de respuesta para esta pregunta.",
      })
    } catch (err) {
      console.error("Error generando sugerencias:", err)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron generar sugerencias. Intenta nuevamente.",
      })
    } finally {
      setGeneratingSuggestions((prev) => ({ ...prev, [key]: false }))
    }
  }

  // Seleccionar una sugerencia como respuesta
  const selectSuggestion = (productId: string, questionId: string, option: "a" | "b" | "c") => {
    const key = `${productId}-${questionId}`
    const suggestions = aiSuggestions[key]

    if (!suggestions) return

    let text = ""

    switch (option) {
      case "a":
        text = suggestions.option_a
        break
      case "b":
        text = suggestions.option_b
        break
      case "c":
        text = suggestions.option_c
        break
    }

    setResponses((prev) => ({
      ...prev,
      [key]: text,
    }))
  }

  // Enviar respuesta a una pregunta
  const handleSubmitResponse = async (productId: string, questionId: string, mlQuestionId: string) => {
    const responseKey = `${productId}-${questionId}`
    const responseText = responses[responseKey]

    if (!responseText?.trim()) return

    setSubmitting((prev) => ({ ...prev, [responseKey]: true }))

    try {
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question_id: questionId,
          ml_question_id: mlQuestionId,
          text: responseText,
        }),
      })

      if (!response.ok) {
        throw new Error("Error al enviar la respuesta")
      }

      // Si la respuesta fue exitosa, actualizar la lista de preguntas
      await fetchQuestions()

      // Limpiar la respuesta enviada
      setResponses((prev) => {
        const updated = { ...prev }
        delete updated[responseKey]
        return updated
      })

      // Eliminar de seleccionados si estaba seleccionado
      if (selectedQuestions.includes(responseKey)) {
        setSelectedQuestions((prev) => prev.filter((item) => item !== responseKey))
      }

      toast({
        title: "Respuesta enviada",
        description: "La respuesta ha sido enviada correctamente.",
      })
    } catch (err) {
      console.error("Error enviando respuesta:", err)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo enviar la respuesta. Intenta nuevamente.",
      })
    } finally {
      setSubmitting((prev) => ({ ...prev, [responseKey]: false }))
    }
  }

  // Enviar respuestas en lote
  const handleBulkSubmit = async () => {
    if (selectedQuestions.length === 0) return

    const answersToSubmit = selectedQuestions
      .map((key) => {
        const [productId, questionId] = key.split("-")
        const product = Object.values(groupedQuestions).find((p) => p.questions.some((q) => q.id === questionId))

        if (!product) return null

        const question = product.questions.find((q) => q.id === questionId)
        if (!question) return null

        return {
          question_id: questionId,
          ml_question_id: question.ml_question_id,
          text: responses[key] || "",
          ai_generated: !!aiSuggestions[key],
        }
      })
      .filter((a) => a && a.text.trim())

    if (answersToSubmit.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No hay respuestas válidas para enviar.",
      })
      return
    }

    try {
      // Marcar todas como enviando
      const submittingState = {}
      answersToSubmit.forEach((a) => {
        submittingState[`${a.question_id}`] = true
      })
      setSubmitting((prev) => ({ ...prev, ...submittingState }))

      const response = await fetch("/api/bulk-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers: answersToSubmit,
        }),
      })

      if (!response.ok) {
        throw new Error("Error al enviar las respuestas")
      }

      const data = await response.json()

      // Actualizar la lista de preguntas
      await fetchQuestions()

      // Limpiar las respuestas enviadas y seleccionadas
      const newResponses = { ...responses }
      selectedQuestions.forEach((key) => {
        delete newResponses[key]
      })
      setResponses(newResponses)
      setSelectedQuestions([])

      toast({
        title: "Respuestas enviadas",
        description: `Se enviaron ${data.results.filter((r) => r.success).length} respuestas correctamente.`,
      })
    } catch (err) {
      console.error("Error enviando respuestas en lote:", err)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron enviar algunas respuestas. Intenta nuevamente.",
      })
    } finally {
      setSubmitting({})
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Cargando preguntas...</h1>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={fetchQuestions}>Reintentar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Preguntas de MercadoLibre ({totalQuestions})</h1>
        <div className="flex gap-2">
          {selectedQuestions.length > 0 && (
            <Button onClick={handleBulkSubmit} variant="default">
              Aprobar y Enviar ({selectedQuestions.length})
            </Button>
          )}
          <Button onClick={fetchQuestions} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {totalQuestions === 0 ? (
        <p className="text-center py-8 text-muted-foreground">No hay preguntas pendientes.</p>
      ) : (
        Object.entries(groupedQuestions).map(([productId, product]) => (
          <Card key={productId} className="overflow-hidden">
            <CardHeader className="bg-muted/50">
              <CardTitle className="flex items-center gap-2">
                <a
                  href={`https://www.mercadolibre.com.ar/item/${productId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {product.title}
                  <ExternalLink size={16} />
                </a>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {product.questions.map((q) => {
                const questionKey = `${productId}-${q.id}`
                const hasSuggestions = !!aiSuggestions[questionKey]

                return (
                  <div key={q.id} className="border-t p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`select-${q.id}`}
                        checked={selectedQuestions.includes(questionKey)}
                        onCheckedChange={() => handleQuestionSelect(productId, q.id)}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={`select-${q.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          <p className="mb-2 font-medium">❓ {q.text}</p>
                        </label>

                        {hasSuggestions ? (
                          <Tabs defaultValue="edit" className="mt-4">
                            <TabsList className="grid grid-cols-4">
                              <TabsTrigger value="edit">Editar</TabsTrigger>
                              <TabsTrigger value="option-a">Opción A</TabsTrigger>
                              <TabsTrigger value="option-b">Opción B</TabsTrigger>
                              <TabsTrigger value="option-c">Opción C</TabsTrigger>
                            </TabsList>
                            <TabsContent value="edit" className="mt-2">
                              <Textarea
                                className="min-h-[80px]"
                                value={responses[questionKey] || ""}
                                onChange={(e) => handleResponseChange(productId, q.id, e.target.value)}
                                placeholder="Escribí tu respuesta..."
                              />
                            </TabsContent>
                            <TabsContent value="option-a" className="mt-2">
                              <div className="border rounded-md p-3 bg-muted/30">
                                <p className="text-sm">{aiSuggestions[questionKey].option_a}</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => selectSuggestion(productId, q.id, "a")}
                              >
                                Usar esta respuesta
                              </Button>
                            </TabsContent>
                            <TabsContent value="option-b" className="mt-2">
                              <div className="border rounded-md p-3 bg-muted/30">
                                <p className="text-sm">{aiSuggestions[questionKey].option_b}</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => selectSuggestion(productId, q.id, "b")}
                              >
                                Usar esta respuesta
                              </Button>
                            </TabsContent>
                            <TabsContent value="option-c" className="mt-2">
                              <div className="border rounded-md p-3 bg-muted/30">
                                <p className="text-sm">{aiSuggestions[questionKey].option_c}</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => selectSuggestion(productId, q.id, "c")}
                              >
                                Usar esta respuesta
                              </Button>
                            </TabsContent>
                          </Tabs>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <Textarea
                              className="min-h-[80px]"
                              value={responses[questionKey] || ""}
                              onChange={(e) => handleResponseChange(productId, q.id, e.target.value)}
                              placeholder="Escribí tu respuesta..."
                            />
                            <div className="flex justify-between">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateSuggestions(productId, q.id, q.ml_question_id)}
                                disabled={generatingSuggestions[questionKey]}
                                className="flex items-center gap-1"
                              >
                                {generatingSuggestions[questionKey] ? "Generando..." : "Generar sugerencias"}
                                <MessageSquare className="h-4 w-4 ml-1" />
                              </Button>
                              <Button
                                onClick={() => handleSubmitResponse(productId, q.id, q.ml_question_id)}
                                disabled={!responses[questionKey]?.trim() || submitting[questionKey]}
                                size="sm"
                              >
                                {submitting[questionKey] ? "Enviando..." : "Responder"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

