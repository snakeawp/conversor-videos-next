import { NextRequest, NextResponse } from 'next/server'
import { conversionJobs, conversionProgress } from '../start/route'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const conversionId = searchParams.get('id')

  if (!conversionId) {
    return NextResponse.json({ error: 'ID de conversão é obrigatório' }, { status: 400 })
  }

  // console.log('📥 Solicitação de download para ID:', conversionId)

  const job = conversionJobs.get(conversionId)
  const progress = conversionProgress.get(conversionId)

  if (!job) {
    return NextResponse.json({ 
      error: 'Conversão não encontrada',
      conversionId 
    }, { status: 404 })
  }

  // Verificar se ainda está em progresso
  if (progress && progress.status !== 'concluído') {
    return NextResponse.json({
      error: 'Conversão ainda em andamento',
      progress: progress.progress,
      status: progress.status,
      conversionId
    }, { status: 202 })
  }

  try {
    // Aguardar conversão completar
    // console.log('⏳ Aguardando conversão completar para:', conversionId)
    const convertedBuffer = await job.promise
    
    // Limpar job do store
    conversionJobs.delete(conversionId)
    
    // Limpar progresso após 30 segundos
    setTimeout(() => {
      conversionProgress.delete(conversionId)
      // console.log('🧹 Progresso limpo para:', conversionId)
    }, 30000)

    // console.log('✅ Download pronto para:', conversionId, 'Tamanho:', convertedBuffer.length)

    // Retornar arquivo convertido
    return new NextResponse(convertedBuffer, {
      headers: {
        'Content-Type': 'video/x-matroska',
        'Content-Disposition': `attachment; filename="${job.outputFileName}"`,
        'Content-Length': convertedBuffer.length.toString()
      }
    })

  } catch (error) {
    console.error('❌ Erro no download:', error)
    
    // Limpar jobs
    conversionJobs.delete(conversionId)
    conversionProgress.set(conversionId, { progress: 0, status: 'erro' })
    
    return NextResponse.json({
      error: 'Erro na conversão',
      details: (error as Error).message,
      conversionId
    }, { status: 500 })
  }
}
