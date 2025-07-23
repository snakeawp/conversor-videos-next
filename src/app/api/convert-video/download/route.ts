import { NextRequest, NextResponse } from 'next/server'
import { getProgress } from '../progressStore'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const conversionId = searchParams.get('id')

  if (!conversionId) {
    return NextResponse.json({ error: 'ID de conversão é obrigatório' }, { status: 400 })
  }

  // console.log('📥 Solicitação de download para ID:', conversionId)

  const progress = getProgress(conversionId)

  // Este endpoint não é usado no sistema atual de conversão síncrona
  // O download é feito diretamente pelo endpoint principal /api/convert-video
  return NextResponse.json({ 
    error: 'Endpoint de download não suportado no sistema atual',
    message: 'Use o endpoint /api/convert-video para conversão síncrona',
    conversionId,
    progress: progress.progress,
    status: progress.status
  }, { status: 501 }) // 501 Not Implemented
}
