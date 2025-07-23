import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { updateProgress } from '../progressStore'

// Função auxiliar para gerar UUID simples
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Store para jobs em background
const conversionJobs = new Map<string, { 
  promise: Promise<Buffer>, 
  outputFileName: string,
  started: number 
}>()

// Interface para tipos do fluent-ffmpeg
interface FFmpegCommand {
  output(target: string): FFmpegCommand
  videoCodec(codec: string): FFmpegCommand
  audioCodec(codec: string): FFmpegCommand
  format(format: string): FFmpegCommand
  outputOptions(options: string[]): FFmpegCommand
  on(event: 'start', callback: (commandLine: string) => void): FFmpegCommand
  on(event: 'progress', callback: (progress: { percent: number }) => void): FFmpegCommand
  on(event: 'end', callback: () => void): FFmpegCommand
  on(event: 'error', callback: (err: Error) => void): FFmpegCommand
  run(): void
  kill(signal?: string): void
}

// Função para executar conversão em background
async function runConversionInBackground(
  conversionId: string,
  inputPath: string, 
  outputPath: string,
  outputFileName: string
): Promise<Buffer> {
  
  // Verificar se fluent-ffmpeg está disponível
  let ffmpeg: (input: string) => FFmpegCommand
  try {
    ffmpeg = require('fluent-ffmpeg')
  } catch (e) {
    console.error('fluent-ffmpeg não encontrado:', e)
    updateProgress(conversionId, 0, 'erro')
    throw new Error('fluent-ffmpeg não está instalado')
  }

  // console.log('🔄 Iniciando conversão background para ID:', conversionId)
  
  try {
    // Converter vídeo usando FFmpeg - Tentar NVENC primeiro, depois CPU
    await new Promise<void>(async (resolve, reject) => {
      // Função para tentar conversão com NVIDIA HEVC (NVENC)
      const tryNvencConversion = () => {
        return new Promise<void>((resolveNvenc, rejectNvenc) => {
          // console.log('Tentando conversão NVENC HEVC...')
          updateProgress(conversionId, 15, 'conversão NVENC')
          
          const nvencCommand = ffmpeg(inputPath)
            .output(outputPath)
            .videoCodec('hevc_nvenc')
            .audioCodec('copy')
            .format('matroska')
            .outputOptions([
              '-map 0',
              '-c:s copy',
              '-disposition:s:0 default',
              '-metadata:s:a:0', 'language=por',
              '-metadata:s:s:0', 'language=por',
              '-metadata', 'title=Convertido para MKV',
              '-metadata', 'language=por',
              '-preset p6',
              '-profile:v main10',
              '-tier high',
              '-rc constqp',
              '-qp 25',
              '-b_ref_mode middle',
              '-temporal-aq 1',
              '-spatial-aq 1',
              '-aq-strength 8',
              '-multipass fullres',
              '-c:a aac',
              '-b:a 128k',
              '-ac 2',
              '-ar 44100'
            ])
            .on('start', (commandLine: string) => {
              // console.log('Comando NVENC HEVC iniciado:', commandLine)
            })
            .on('progress', (progress: { percent: number }) => {
              const percent = Math.round(progress.percent || 0)
              // console.log('🚀 Progresso NVENC:', percent + '%')
              const updatedProgressValue = Math.min(95, Math.max(15, percent))
              updateProgress(conversionId, updatedProgressValue, 'conversão NVENC')
              // console.log('📝 Progresso salvo no store:', updatedProgressValue)
            })
            .on('end', () => {
              // console.log('Conversão NVENC HEVC concluída com sucesso')
              updateProgress(conversionId, 95, 'finalizando')
              resolveNvenc()
            })
            .on('error', (err: Error) => {
              // console.log('Erro NVENC HEVC:', err.message)
              rejectNvenc(err)
            })
          
          nvencCommand.run()
        })
      }

      // Função para conversão com libx265 (fallback CPU)
      const tryCpuConversion = () => {
        return new Promise<void>((resolveCpu, rejectCpu) => {
          // console.log('Iniciando conversão CPU HEVC (fallback)...')
          updateProgress(conversionId, 15, 'conversão CPU')
          
          const cpuCommand = ffmpeg(inputPath)
            .output(outputPath)
            .videoCodec('libx265')
            .audioCodec('aac')
            .format('matroska')
            .outputOptions([
              '-map 0',
              '-c:s copy',
              '-disposition:s:0 default',
              '-metadata:s:a:0', 'language=por',
              '-metadata:s:s:0', 'language=por',
              '-metadata', 'title=Convertido para MKV',
              '-metadata', 'language=por',
              '-crf 23',
              '-preset medium',
              '-b:a 128k',
              '-ac 2',
              '-ar 44100'
            ])
            .on('start', (commandLine: string) => {
              // console.log('Comando CPU HEVC iniciado:', commandLine)
            })
            .on('progress', (progress: { percent: number }) => {
              const percent = Math.round(progress.percent || 0)
              // console.log('🖥️ Progresso CPU:', percent + '%')
              const updatedProgressValue = Math.min(95, Math.max(15, percent))
              updateProgress(conversionId, updatedProgressValue, 'conversão CPU')
              // console.log('📝 Progresso CPU salvo no store:', updatedProgressValue)
            })
            .on('end', () => {
              // console.log('Conversão CPU HEVC concluída com sucesso')
              updateProgress(conversionId, 95, 'finalizando')
              resolveCpu()
            })
            .on('error', (err: Error) => {
              // console.log('Erro CPU HEVC:', err.message)
              rejectCpu(err)
            })
          
          cpuCommand.run()
        })
      }

      // Tentar NVENC primeiro, depois CPU como fallback
      try {
        await tryNvencConversion()
        // console.log('Conversão NVENC bem-sucedida')
        resolve()
      } catch (nvencError) {
        // console.log('NVENC HEVC falhou, tentando CPU HEVC...', (nvencError as Error).message)
        
        try {
          await tryCpuConversion()
          // console.log('Conversão CPU bem-sucedida')
          resolve()
        } catch (cpuError) {
          console.error('Ambas as conversões falharam:', cpuError)
          updateProgress(conversionId, 0, 'erro')
          reject(new Error(`Erro na conversão: NVENC falhou (${(nvencError as Error).message}), CPU também falhou (${(cpuError as Error).message})`))
        }
      }
    })

    // Verificar se arquivo de saída foi criado
    const fs = require('fs')
    if (!fs.existsSync(outputPath)) {
      updateProgress(conversionId, 0, 'erro')
      throw new Error('Arquivo de saída não foi criado')
    }

    // Ler arquivo convertido
    updateProgress(conversionId, 98, 'finalizando')
    const convertedBuffer = await fs.promises.readFile(outputPath)
    // console.log('Arquivo convertido lido:', convertedBuffer.length, 'bytes')

    // Limpar arquivos temporários
    await Promise.all([
      unlink(inputPath).catch(console.error),
      unlink(outputPath).catch(console.error)
    ])

    // Marcar como concluído
    updateProgress(conversionId, 100, 'concluído')
    
    return convertedBuffer

  } catch (error) {
    // Limpar arquivos em caso de erro
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath).catch(() => {})
    ])
    
    updateProgress(conversionId, 0, 'erro')
    console.error('Erro na conversão background:', error)
    throw error
  }
}

// Endpoint para iniciar conversão (retorna ID imediatamente)
export async function POST(request: NextRequest) {
  const conversionId = generateId()
  
  try {
    // console.log('🚀 Iniciando conversão com ID:', conversionId)
    updateProgress(conversionId, 0, 'iniciando')

    const formData = await request.formData()
    const file = formData.get('video') as File
    const outputName = formData.get('outputName') as string

    if (!file) {
      updateProgress(conversionId, 0, 'erro')
      return NextResponse.json({ error: 'Arquivo não fornecido', conversionId }, { status: 400 })
    }

    // Criar arquivos temporários
    const tempDir = tmpdir()
    const inputFileName = `${generateId()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const outputFileName = outputName || `${generateId()}.mkv`
    const inputPath = join(tempDir, inputFileName)
    const outputPath = join(tempDir, outputFileName)

    // console.log('📁 Preparando arquivos:', { conversionId, inputPath, outputPath })

    // Salvar arquivo de entrada
    updateProgress(conversionId, 5, 'preparando')
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(inputPath, buffer)
    
    // console.log('💾 Arquivo temporário salvo:', inputPath)
    updateProgress(conversionId, 10, 'convertendo')

    // Iniciar conversão em background
    const conversionPromise = runConversionInBackground(conversionId, inputPath, outputPath, outputFileName)
    
    // Salvar job no store
    conversionJobs.set(conversionId, {
      promise: conversionPromise,
      outputFileName,
      started: Date.now()
    })

    // Retornar ID imediatamente (não aguardar conversão)
    return NextResponse.json({
      conversionId,
      message: 'Conversão iniciada em background',
      status: 'started'
    })

  } catch (error) {
    console.error('Erro ao iniciar conversão:', error)
    updateProgress(conversionId, 0, 'erro')
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor', 
        details: (error as Error).message,
        conversionId 
      },
      { status: 500 }
    )
  }
}

// Exportar apenas o store de jobs
export { conversionJobs }
