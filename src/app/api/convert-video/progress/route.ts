import { NextRequest, NextResponse } from 'next/server'
import { getProgress } from '../progressStore'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const conversionId = url.searchParams.get('id')
    
    // console.log('🔍 API Progress - Requisição recebida. ID solicitado:', conversionId)
    
    if (!conversionId) {
      // console.log('❌ API Progress - ID não fornecido')
      return NextResponse.json(
        { error: 'ID de conversão não fornecido' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      )
    }

    // Buscar progresso do progressStore compartilhado (usado pelo endpoint principal)
    const progressData = getProgress(conversionId)
    // console.log('📊 API Progress - Dados encontrados para ID', conversionId, ':', progressData)
    
    const responseData = {
      conversionId,
      progress: progressData.progress,
      status: progressData.status
    }
    
    // console.log('📤 API Progress - Enviando resposta:', responseData)
    
    return NextResponse.json(responseData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
    
  } catch (error) {
    console.error('❌ API Progress - Erro ao buscar progresso:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    )
  }
}
