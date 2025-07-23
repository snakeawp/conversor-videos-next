import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { updateProgress } from './progressStore'

// Função auxiliar para gerar UUID simples
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Interface para tipos do fluent-ffmpeg (caso não tenha @types instalado)
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

// Configurar caminho do ffmpeg se necessário
// Descomente e configure os caminhos se FFmpeg não estiver no PATH
// const ffmpeg = require('fluent-ffmpeg')
// ffmpeg.setFfmpegPath('/path/to/ffmpeg')
// ffmpeg.setFfprobePath('/path/to/ffprobe')

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  let conversionId = formData.get('conversionId') as string
  
  // Se não foi fornecido ID, gerar um
  if (!conversionId) {
    conversionId = generateId()
  }
  
  // console.log('🆔 API - ID de conversão:', conversionId)
  
  try {
    // Inicializar progresso
    updateProgress(conversionId, 0, 'iniciando')
    // console.log('📊 API - Progresso inicializado para ID:', conversionId)

    // Verificar se fluent-ffmpeg está disponível
    let ffmpeg: (input: string) => FFmpegCommand
    try {
      ffmpeg = require('fluent-ffmpeg')
    } catch (e) {
      console.error('fluent-ffmpeg não encontrado:', e)
      updateProgress(conversionId, 0, 'erro')
      return NextResponse.json(
        { 
          error: 'FFmpeg não está disponível no servidor',
          details: 'Esta API requer o FFmpeg para funcionar. O fluent-ffmpeg não foi encontrado.',
          suggestion: 'Esta aplicação não pode converter vídeos no servidor atual. Considere usar FFmpeg.wasm no navegador.',
          conversionId,
          timestamp: new Date().toISOString()
        },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Conversion-Id': conversionId
          }
        }
      )
    }

    const file = formData.get('video') as File
    const outputName = formData.get('outputName') as string

    if (!file) {
      updateProgress(conversionId, 0, 'erro')
      return NextResponse.json(
        { 
          error: 'Arquivo não fornecido',
          details: 'Nenhum arquivo de vídeo foi enviado na requisição',
          conversionId,
          timestamp: new Date().toISOString()
        },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'X-Conversion-Id': conversionId
          }
        }
      )
    }

    // Criar arquivos temporários
    const tempDir = tmpdir()
    const inputFileName = `${generateId()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const outputFileName = outputName || `${generateId()}.mkv`
    const inputPath = join(tempDir, inputFileName)
    const outputPath = join(tempDir, outputFileName)

    // console.log('Iniciando conversão via API:', {
    //   conversionId,
    //   inputFile: file.name,
    //   size: file.size,
    //   tempInput: inputPath,
    //   tempOutput: outputPath
    // })

    try {
      // Salvar arquivo de entrada
      updateProgress(conversionId, 5, 'preparando')
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(inputPath, buffer)
      
      // console.log('Arquivo temporário salvo:', inputPath)
      updateProgress(conversionId, 10, 'convertendo')

      // Converter vídeo usando FFmpeg - Tentar NVENC primeiro, depois CPU
      // Adicionar timeout de segurança (10 minutos para Vercel)
      const conversionPromise = new Promise<void>(async (resolve, reject) => {
        // Função para tentar conversão com NVIDIA HEVC (NVENC)
        const tryNvencConversion = () => {
          return new Promise<void>((resolveNvenc, rejectNvenc) => {
            // console.log('Tentando conversão NVENC HEVC...')
            
            const nvencCommand = ffmpeg(inputPath)
              .output(outputPath)
              .videoCodec('hevc_nvenc') // Encoder NVIDIA HEVC/H.265
              .audioCodec('copy') // Preservar áudio original
              .format('matroska') // Formato MKV
              .outputOptions([
                '-map 0', // Mapear todos os streams do input
                '-c:s copy', // Copiar legendas sem recodificação
                '-disposition:s:0 default', // Definir primeira legenda como padrão
                // Configurações de idioma padrão - Português Brasileiro
                '-metadata:s:a:0', 'language=por', // Definir idioma do áudio como português
                '-metadata:s:s:0', 'language=por', // Definir idioma da legenda como português
                '-metadata', 'title=Convertido para MKV', // Título do arquivo
                '-metadata', 'language=por', // Idioma geral do arquivo
                // Configurações otimizadas para menor tamanho
                '-preset p6', // Preset mais lento = melhor compressão
                '-profile:v main10', // Profile HEVC otimizado
                '-tier high', // High tier para melhor compressão
                '-rc constqp', // Constant QP para controle preciso
                '-qp 25', // QP mais alto = menor arquivo
                '-b_ref_mode middle', // Otimização de frames B
                '-temporal-aq 1', // Adaptive quantization temporal
                '-spatial-aq 1', // Adaptive quantization espacial
                '-aq-strength 8', // Força do AQ
                '-multipass fullres', // Multipass para melhor compressão
                // Configurações de áudio para menor tamanho
                '-c:a aac', // Usar AAC ao invés de copy
                '-b:a 128k', // Bitrate de áudio 128 kbps
                '-ac 2', // Força 2 canais de áudio
                '-ar 44100' // Sample rate padrão
              ])
              .on('start', (commandLine: string) => {
                // console.log('Comando NVENC HEVC iniciado:', commandLine)
              })
              .on('progress', (progress: { percent: number }) => {
                const percentComplete = Math.round(progress.percent || 0)
                // console.log('🚀 Progresso NVENC:', percentComplete + '%')
                updateProgress(conversionId, percentComplete, 'conversão NVENC')
              })
              .on('end', () => {
                // console.log('Conversão NVENC HEVC concluída com sucesso')
                updateProgress(conversionId, 100, 'concluído')
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
            
            const cpuCommand = ffmpeg(inputPath)
              .output(outputPath)
              .videoCodec('libx265') // Encoder CPU HEVC/H.265
              .audioCodec('aac') // Configurações de áudio
              .format('matroska') // Formato MKV
              .outputOptions([
                '-map 0', // Mapear todos os streams do input
                '-c:s copy', // Copiar legendas sem recodificação
                '-disposition:s:0 default', // Definir primeira legenda como padrão
                // Configurações de idioma padrão - Português Brasileiro
                '-metadata:s:a:0', 'language=por', // Definir idioma do áudio como português
                '-metadata:s:s:0', 'language=por', // Definir idioma da legenda como português
                '-metadata', 'title=Convertido para MKV', // Título do arquivo
                '-metadata', 'language=por', // Idioma geral do arquivo
                '-crf 23', // Constant Rate Factor para qualidade
                '-preset medium', // Preset balanceado
                // Configurações de áudio para menor tamanho
                '-b:a 128k', // Bitrate de áudio 128 kbps
                '-ac 2', // Força 2 canais de áudio
                '-ar 44100' // Sample rate padrão
              ])
              .on('start', (commandLine: string) => {
                // console.log('Comando CPU HEVC iniciado:', commandLine)
              })
              .on('progress', (progress: { percent: number }) => {
                const percentComplete = Math.round(progress.percent || 0)
                // console.log('🚀 Progresso CPU:', percentComplete + '%')
                updateProgress(conversionId, percentComplete, 'conversão CPU')
              })
              .on('end', () => {
                // console.log('Conversão CPU HEVC concluída com sucesso')
                updateProgress(conversionId, 100, 'concluído')
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
            reject(new Error(`Erro na conversão: NVENC falhou (${(nvencError as Error).message}), CPU também falhou (${(cpuError as Error).message}). Verifique se o FFmpeg está instalado e se há suporte NVENC.`))
          }
        }
      })

      // Timeout de segurança (8 minutos para ser menor que o limite do Vercel)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          updateProgress(conversionId, 0, 'erro')
          reject(new Error('TIMEOUT: Conversão excedeu o tempo limite de 8 minutos. Tente um arquivo menor.'))
        }, 8 * 60 * 1000) // 8 minutos
      })

      // Aguardar conversão ou timeout
      await Promise.race([conversionPromise, timeoutPromise])

      // Verificar se arquivo de saída foi criado
      const fs = require('fs')
      if (!fs.existsSync(outputPath)) {
        throw new Error('Arquivo de saída não foi criado. Possível erro na conversão.')
      }

      // Ler arquivo convertido
      const convertedBuffer = await fs.promises.readFile(outputPath)
      // console.log('Arquivo convertido lido:', convertedBuffer.length, 'bytes')

      // Limpar arquivos temporários
      await Promise.all([
        unlink(inputPath).catch(console.error),
        unlink(outputPath).catch(console.error)
      ])

      // Retornar arquivo convertido
      return new NextResponse(convertedBuffer, {
        headers: {
          'Content-Type': 'video/x-matroska',
          'Content-Disposition': `attachment; filename="${outputFileName}"`,
          'X-Conversion-Id': conversionId,
          'Access-Control-Expose-Headers': 'X-Conversion-Id'  // Importante para CORS
        }
      })

    } catch (conversionError) {
      // Limpar arquivos em caso de erro
      await Promise.all([
        unlink(inputPath).catch(() => {}),
        unlink(outputPath).catch(() => {})
      ])
      
      console.error('Erro na conversão:', conversionError)
      throw conversionError
    }

  } catch (error) {
    console.error('Erro na API de conversão:', error)
    
    // Atualizar progresso para erro
    updateProgress(conversionId, 0, 'erro')
    
    // Garantir que sempre retornamos JSON válido
    let errorMessage = 'Erro interno do servidor'
    let suggestion = 'Tente novamente ou use um arquivo menor'
    
    if (error instanceof Error) {
      errorMessage = error.message
      
      // Mensagens específicas para diferentes tipos de erro
      if (error.message.includes('fluent-ffmpeg')) {
        suggestion = 'FFmpeg não está disponível no servidor. Use FFmpeg.wasm no navegador como alternativa.'
      } else if (error.message.includes('TIMEOUT') || error.message.includes('timeout')) {
        suggestion = 'Timeout na conversão. Tente um arquivo menor ou menos complexo.'
      } else if (error.message.includes('ENOMEM') || error.message.includes('memory')) {
        suggestion = 'Erro de memória. Tente um arquivo menor.'
      } else if (error.message.includes('ENOENT')) {
        suggestion = 'FFmpeg não encontrado no sistema. Verifique a instalação.'
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        suggestion,
        conversionId,
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Conversion-Id': conversionId,
          'Access-Control-Expose-Headers': 'X-Conversion-Id'
        }
      }
    )
  }
}
