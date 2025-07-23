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
      
      // PRIMEIRA TENTATIVA: H.265 (configurações NVENC adaptadas)
      try {
        await convertWithH265(ffmpeg, inputFileName, outputName)
        console.log('✅ Conversão H.265 concluída com sucesso!')
      } catch (h265Error) {
        console.warn('⚠️ H.265 falhou, tentando H.264 como fallback:', h265Error)
        
        // FALLBACK: H.264 se H.265 falhar
        await convertWithH264(ffmpeg, inputFileName, outputName)
        console.log('✅ Conversão H.264 fallback concluída!')
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

  // Função para conversão com H.265 (configurações NVENC adaptadas)
  const convertWithH265 = async (ffmpeg: any, inputFileName: string, outputName: string) => {
    await ffmpeg.exec([
      '-i', inputFileName,
      
      // === CODEC E FORMATO (Adaptação das configurações NVENC) ===
      '-c:v', 'libx265',          // H.265 para melhor compressão (equivalente ao hevc_nvenc)
      '-c:a', 'aac',              // AAC para áudio (menor tamanho)
      '-c:s', 'copy',             // Copiar legendas sem recodificação
      
      // === MAPEAMENTO DE STREAMS ===
      '-map', '0',                // Mapear todos os streams do input
      '-disposition:s:0', 'default', // Definir primeira legenda como padrão
      
      // === CONFIGURAÇÕES DE VÍDEO H.265 OTIMIZADA ===
      '-preset', 'slow',          // Preset mais lento = melhor compressão (equiv. preset p6)
      '-crf', '25',               // CRF 25 para alta compressão (equiv. qp 25)
      '-profile:v', 'main10',     // Profile H.265 main10 otimizado
      '-tier', 'high',            // High tier para melhor compressão
      
      // === CONFIGURAÇÕES DE ÁUDIO OTIMIZADA ===
      '-b:a', '128k',             // Bitrate de áudio 128 kbps
      '-ac', '2',                 // Força 2 canais de áudio  
      '-ar', '44100',             // Sample rate padrão
      
      // === CONFIGURAÇÕES DE CONTAINER MKV ===
      '-f', 'matroska',           // Formato MKV
      
      // === METADADOS (Configurações de idioma PT-BR) ===
      '-metadata:s:a:0', 'language=por', // Idioma do áudio como português
      '-metadata:s:s:0', 'language=por', // Idioma da legenda como português
      '-metadata', 'title=Convertido para MKV OCFlix H.265', // Título personalizado
      '-metadata', 'language=por', // Idioma geral do arquivo
      
      // Arquivo de saída
      outputName
    ])
  }

  // Função para conversão com H.264 (fallback)
  const convertWithH264 = async (ffmpeg: any, inputFileName: string, outputName: string) => {
    await ffmpeg.exec([
      '-i', inputFileName,
      
      // === CODEC E FORMATO (H.264 como fallback) ===
      '-c:v', 'libx264',          // H.264 (mais compatível)
      '-c:a', 'aac',              // AAC para áudio
      '-c:s', 'copy',             // Copiar legendas sem recodificação
      
      // === MAPEAMENTO DE STREAMS ===
      '-map', '0',                // Mapear todos os streams do input
      '-disposition:s:0', 'default', // Definir primeira legenda como padrão
      
      // === CONFIGURAÇÕES DE VÍDEO H.264 OTIMIZADA ===
      '-preset', 'slow',          // Preset mais lento = melhor compressão
      '-crf', '23',               // CRF 23 para boa qualidade
      '-profile:v', 'high',       // Profile H.264 high
      
      // === CONFIGURAÇÕES DE ÁUDIO ===
      '-b:a', '128k',             // Bitrate de áudio 128 kbps
      '-ac', '2',                 // Força 2 canais de áudio
      '-ar', '44100',             // Sample rate padrão
      
      // === CONFIGURAÇÕES DE CONTAINER MKV ===
      '-f', 'matroska',           // Formato MKV
      
      // === METADADOS (Configurações de idioma PT-BR) ===
      '-metadata:s:a:0', 'language=por', // Idioma do áudio como português
      '-metadata:s:s:0', 'language=por', // Idioma da legenda como português
      '-metadata', 'title=Convertido para MKV OCFlix H.264', // Título personalizado
      '-metadata', 'language=por', // Idioma geral do arquivo
      
      // Arquivo de saída
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
