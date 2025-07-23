import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { useState, useRef } from 'react'

export interface UseFFmpegReturn {
  ffmpeg: FFmpeg | null
  isLoaded: boolean
  isLoading: boolean
  loadFFmpeg: () => Promise<void>
  convertVideo: (
    inputFile: File,
    outputFileName: string,
    onProgress?: (progress: number) => void
  ) => Promise<Blob>
  error: string | null
}

export function useFFmpeg(): UseFFmpegReturn {
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFFmpeg = async () => {
    if (ffmpegRef.current && isLoaded) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      // Verificar se o ambiente suporta os recursos necessários
      if (typeof window === 'undefined') {
        throw new Error('FFmpeg.wasm só funciona no navegador')
      }

      if (!window.crossOriginIsolated) {
        console.warn('⚠️ crossOriginIsolated não está habilitado, pode causar problemas')
      }

      if (typeof SharedArrayBuffer === 'undefined') {
        throw new Error('SharedArrayBuffer não está disponível. Verifique se o site está sendo servido com HTTPS e headers CORS corretos.')
      }

      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg()
      }

      const ffmpeg = ffmpegRef.current

      // Configurar logs para debug
      ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg log:', message)
      })

      // Tentar diferentes métodos de carregamento
      try {
        // Método 1: Usar CDN oficial
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
        
        console.log('🔄 Carregando FFmpeg.wasm do CDN...')
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        })
      } catch (cdnError) {
        console.warn('⚠️ CDN falhou, tentando método alternativo:', cdnError)
        
        // Método 2: Carregar sem URLs específicas (deixar o FFmpeg decidir)
        await ffmpeg.load()
      }

      setIsLoaded(true)
      console.log('✅ FFmpeg.wasm carregado com sucesso!')
      
    } catch (err) {
      console.error('❌ Erro ao carregar FFmpeg.wasm:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao carregar FFmpeg'
      setError(`Erro ao carregar FFmpeg: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const convertVideo = async (
    inputFile: File, 
    outputFileName: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    if (!ffmpegRef.current || !isLoaded) {
      throw new Error('FFmpeg não está carregado. Chame loadFFmpeg() primeiro.')
    }

    const ffmpeg = ffmpegRef.current
    
    try {
      // Nomes dos arquivos
      const inputFileName = `input.${inputFile.name.split('.').pop()}`
      const outputName = outputFileName.endsWith('.mkv') ? outputFileName : `${outputFileName}.mkv`
      
      // Escrever arquivo de entrada
      console.log('📁 Escrevendo arquivo de entrada:', inputFileName)
      await ffmpeg.writeFile(inputFileName, await fetchFile(inputFile))

      // Configurar callback de progresso
      if (onProgress) {
        ffmpeg.on('progress', ({ progress }) => {
          const progressPercent = Math.round(progress * 100)
          onProgress(progressPercent)
        })
      }

      console.log('🔄 Iniciando conversão para MKV com H.265...')
      
      // PRIMEIRA TENTATIVA: H.265 (configurações NVENC adaptadas) com timeout
      try {
        // Criar uma Promise com timeout para evitar travamento
        const conversionPromise = convertWithH265(ffmpeg, inputFileName, outputName)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout: H.265 demorou mais de 5 minutos')), 5 * 60 * 1000) // 5 minutos
        })
        
        await Promise.race([conversionPromise, timeoutPromise])
        console.log('✅ Conversão H.265 concluída com sucesso!')
      } catch (h265Error) {
        console.warn('⚠️ H.265 falhou, tentando H.264 como fallback:', h265Error)
        console.warn('⚠️ Detalhes do erro H.265:', {
          message: (h265Error as Error).message,
          name: (h265Error as Error).name,
          stack: (h265Error as Error).stack
        })
        
        // FALLBACK: H.264 se H.265 falhar, também com timeout
        try {
          console.log('🔄 Tentando conversão H.264...')
          const h264Promise = convertWithH264(ffmpeg, inputFileName, outputName)
          const h264TimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout: H.264 demorou mais de 3 minutos')), 3 * 60 * 1000) // 3 minutos
          })
          
          await Promise.race([h264Promise, h264TimeoutPromise])
          console.log('✅ Conversão H.264 fallback concluída!')
        } catch (h264Error) {
          console.error('❌ H.264 também falhou, tentando conversão básica:', h264Error)
          
          // FALLBACK FINAL: Conversão básica e rápida
          try {
            console.log('🔄 Tentando conversão básica (última tentativa)...')
            const basicPromise = convertWithBasicSettings(ffmpeg, inputFileName, outputName)
            const basicTimeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout: Conversão básica demorou mais de 2 minutos')), 2 * 60 * 1000) // 2 minutos
            })
            
            await Promise.race([basicPromise, basicTimeoutPromise])
            console.log('✅ Conversão básica concluída!')
          } catch (basicError) {
            console.error('❌ Todas as tentativas falharam:', basicError)
            throw new Error(`Todas as conversões falharam. H.265: ${(h265Error as Error).message}, H.264: ${(h264Error as Error).message}, Básica: ${(basicError as Error).message}`)
          }
        }
      }
      
      // Ler arquivo convertido
      const data = await ffmpeg.readFile(outputName)
      const blob = new Blob([data], { type: 'video/x-matroska' })
      
      // Limpar arquivos temporários
      try {
        await ffmpeg.deleteFile(inputFileName)
        await ffmpeg.deleteFile(outputName)
      } catch (cleanupError) {
        console.warn('⚠️ Erro na limpeza:', cleanupError)
      }
      
      return blob
      
    } catch (err) {
      console.error('❌ Erro na conversão:', err)
      throw new Error(`Erro na conversão: ${(err as Error).message}`)
    }
  }

  // Função para conversão com H.265 (configurações NVENC adaptadas - versão otimizada)
  const convertWithH265 = async (ffmpeg: any, inputFileName: string, outputName: string) => {
    await ffmpeg.exec([
      '-i', inputFileName,
      
      // === CODEC E FORMATO ===
      '-c:v', 'libx265',          // H.265 para melhor compressão
      '-c:a', 'aac',             // Copiar áudio original (mais rápido que recodificar)
      
      // === MAPEAMENTO DE STREAMS (apenas vídeo e áudio principais) ===
      '-map', '0:v:0',            // Mapear apenas primeiro stream de vídeo
      '-map', '0:a:0',            // Mapear apenas primeiro stream de áudio
      
      // === CONFIGURAÇÕES DE VÍDEO H.265 OTIMIZADA PARA NAVEGADOR ===
      '-preset', 'fast',          // Preset rápido para evitar travamento
      '-crf', '28',               // CRF mais alto = processamento mais rápido
      '-x265-params', 'log-level=error', // Reduzir logs do x265
      
      // === CONFIGURAÇÕES PARA EVITAR TRAVAMENTO ===
      '-threads', '1',            // Forçar single-thread (mais estável no navegador)
      '-avoid_negative_ts', 'make_zero', // Evitar problemas de timestamp
      
      // === FORMATO E METADADOS SIMPLES ===
      '-f', 'matroska',           // Formato MKV
      '-metadata', 'title=Convertido OCFlix H.265',
      
      // Arquivo de saída
      outputName
    ])
  }

  // Função para conversão com H.264 (fallback otimizado)
  const convertWithH264 = async (ffmpeg: any, inputFileName: string, outputName: string) => {
    await ffmpeg.exec([
      '-i', inputFileName,
      
      // === CODEC E FORMATO ===
      '-c:v', 'libx264',          // H.264 (mais compatível)
      '-c:a', 'aac',             // Copiar áudio original (mais rápido)
      
      // === MAPEAMENTO DE STREAMS (apenas principais) ===
      '-map', '0:v:0',            // Mapear apenas primeiro stream de vídeo
      '-map', '0:a:0',            // Mapear apenas primeiro stream de áudio
      
      // === CONFIGURAÇÕES DE VÍDEO H.264 OTIMIZADA ===
      '-preset', 'fast',          // Preset rápido
      '-crf', '26',               // CRF balanceado para velocidade
      
      // === CONFIGURAÇÕES PARA ESTABILIDADE ===
      '-threads', '1',            // Single-thread para estabilidade
      '-avoid_negative_ts', 'make_zero', // Evitar problemas de timestamp
      
      // === FORMATO E METADADOS SIMPLES ===
      '-f', 'matroska',           // Formato MKV
      '-metadata', 'title=Convertido OCFlix H.264',
      
      // Arquivo de saída
      outputName
    ])
  }

  // Função para conversão simples (fallback final se tudo falhar)
  const convertWithBasicSettings = async (ffmpeg: any, inputFileName: string, outputName: string) => {
    await ffmpeg.exec([
      '-i', inputFileName,
      '-c:v', 'libx264',          // H.264 básico
      '-c:a', 'aac',             // Copiar áudio
      '-preset', 'ultrafast',     // Preset mais rápido possível
      '-crf', '30',               // Qualidade menor mas muito rápido
      '-f', 'matroska',           // MKV
      outputName
    ])
  }

  return {
    ffmpeg: ffmpegRef.current,
    isLoaded,
    isLoading,
    loadFFmpeg,
    convertVideo,
    error
  }
}
