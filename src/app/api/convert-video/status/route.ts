import { NextRequest, NextResponse } from 'next/server'

// Store compartilhado do convert-video/route.ts
// Para acessar precisamos importar do módulo principal
// Como não podemos fazer isso diretamente, vamos criar um store local
const progressStore = new Map<string, { progress: number; status: string }>()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
  }

  const progress = progressStore.get(id)
  
  if (!progress) {
    return NextResponse.json({ error: 'Conversão não encontrada' }, { status: 404 })
  }

  return NextResponse.json(progress)
}

// Função auxiliar para outros módulos atualizarem o progresso
export function updateProgress(id: string, progress: number, status: string) {
  progressStore.set(id, { progress, status })
}
