import { NextRequest, NextResponse } from 'next/server'
import { getProgress } from '../progressStore'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
  }

  const progress = getProgress(id)
  
  // console.log('📊 Status consultado para ID:', id, 'Progresso:', progress)

  return NextResponse.json({
    progress: progress.progress,
    status: progress.status
  })
}
