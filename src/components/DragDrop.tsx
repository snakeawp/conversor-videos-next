'use client'
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
// import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Upload, X, Play, Clock, FileType, HardDrive, AlertCircle, Settings, CheckCircle, Loader2, Folder, FolderOpen, Film, Monitor, Copy, Wand2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { generateContentText } from '@/utils/generateContentText'
import { useProgress } from '@/contexts/ProgressContext'

// Interface para File System Access API
interface FileSystemDirectoryHandle {
  kind: 'directory'
  name: string
  requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
}

interface FileSystemFileHandle {
  kind: 'file'
  name: string
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>
  close(): Promise<void>
}

// Interface para FFmpeg.wasm
interface FFmpegWasm {
  load(): Promise<void>
  writeFile(name: string, data: Uint8Array): Promise<void>
  readFile(name: string): Promise<Uint8Array>
  exec(args: string[]): Promise<void>
  on(event: 'progress', callback: (data: { progress: number }) => void): void
}

interface FFmpegConstructor {
  new (): FFmpegWasm
}

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: Array<{
        description: string
        accept: Record<string, string[]>
      }>
    }) => Promise<FileSystemFileHandle>
    FFmpeg?: {
      FFmpeg: FFmpegConstructor
    }
  }
}

type VideoData = {
  id: string
  preview: string
  name: string
  format: string
  duration: number
  size: number
  extension: string
  fileObject: File // Sempre será um objeto File para aplicações web
  converting?: boolean
  converted?: boolean
  progress?: number
  selected?: boolean
  elapsedTime?: string
  totalTime?: string
  customOutputDir?: FileSystemDirectoryHandle // Handle do diretório personalizado
  customOutputName?: string // Nome personalizado para o arquivo
}

export default function DragDrop() {
  const { progressMap, updateProgress: updateProgressContext, getProgress: getProgressContext } = useProgress()
  
  const [videos, setVideos] = useState<VideoData[]>([])
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [convertingVideoId, setConvertingVideoId] = useState<string | null>(null)
  const [isConvertingBatch, setIsConvertingBatch] = useState(false)
  const [outputDirectory, setOutputDirectory] = useState('Downloads (padrão do navegador)')
  const [showSettings, setShowSettings] = useState(false)
  
  // Estados para tempo total das conversões (timer global)
  const [totalConversionTime, setTotalConversionTime] = useState(0) // em milissegundos
  const [isAnyConverting, setIsAnyConverting] = useState(false)
  const [globalTimer, setGlobalTimer] = useState<NodeJS.Timeout | null>(null)

  // Estados para os campos de geração de conteúdo
  const [contentType, setContentType] = useState('')
  const [contentName, setContentName] = useState('')
  const [availableLanguages, setAvailableLanguages] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [isGeneratingText, setIsGeneratingText] = useState(false)
  const [generateError, setGenerateError] = useState('')

  // Mapa para relacionar conversion IDs com video IDs
  const [conversionVideoMap, setConversionVideoMap] = useState<Map<string, string>>(new Map())

  // Carregar configurações ao inicializar
  useEffect(() => {
    // Para aplicações web, não há configurações persistentes do sistema de arquivos
    // O usuário escolherá o local na hora do download
  }, [])

  // Sincronizar progresso do contexto com os vídeos
  useEffect(() => {
    // console.log('🔍 UseEffect - Sincronizando progresso... ProgressMap size:', progressMap.size)
    // console.log('🔍 UseEffect - ConversionVideoMap size:', conversionVideoMap.size)
    // console.log('🔍 UseEffect - ProgressMap contents:', Array.from(progressMap.entries()))
    // console.log('🔍 UseEffect - ConversionVideoMap contents:', Array.from(conversionVideoMap.entries()))
    
    setVideos(prev => prev.map(video => {
      // Encontrar o conversion ID para este video
      let conversionId: string | undefined
      for (const [cId, vId] of conversionVideoMap.entries()) {
        if (vId === video.id) {
          conversionId = cId
          break
        }
      }
      
      if (conversionId && video.converting) {
        const progressData = getProgressContext(conversionId)
        // console.log(`🔄 Sincronizando progresso para vídeo ${video.id}: ${progressData.progress}% (Status: ${progressData.status})`)
        if (progressData.progress > 0 || progressData.status !== 'não encontrado') {
          const updatedVideo = {
            ...video,
            progress: progressData.progress,
            converting: progressData.status !== 'concluído' && progressData.status !== 'erro'
          }
          // console.log(`📝 Video ${video.id} atualizado:`, updatedVideo)
          return updatedVideo
        }
      } else if (conversionId) {
        // console.log(`⚠️ Video ${video.id} não está convertendo. Converting: ${video.converting}`)
      } else if (video.converting) {
        // console.log(`⚠️ Não encontrou conversionId para vídeo ${video.id}`)
        // console.log(`🔍 Video convertendo sem conversionId. Todos os IDs disponíveis:`, Array.from(conversionVideoMap.keys()))
      }
      
      return video
    }))
  }, [progressMap, conversionVideoMap, getProgressContext])

  const loadConfiguration = async () => {
    // Removido - não aplicável para aplicações web
  }

  const changeOutputDirectory = async () => {
    try {
      if (window.showDirectoryPicker) {
        const directoryHandle = await window.showDirectoryPicker()
        setOutputDirectory(directoryHandle.name)
        setSuccessMessage(`Diretório padrão definido como: ${directoryHandle.name}`)
        setError('')
      } else {
        setError('Seu navegador não suporta seleção de diretórios. Os arquivos serão baixados para a pasta padrão de downloads.')
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Erro ao alterar diretório:', err)
        setError('Erro ao alterar diretório de saída')
      }
    }
  }

  const selectCustomOutputDirectory = async (videoId: string) => {
    try {
      if (window.showDirectoryPicker) {
        const directoryHandle = await window.showDirectoryPicker()
        setVideos(prev => prev.map(v => 
          v.id === videoId 
            ? { ...v, customOutputDir: directoryHandle }
            : v
        ))
        setSuccessMessage(`Diretório personalizado definido: ${directoryHandle.name}`)
        setError('')
      } else {
        setError('Seu navegador não suporta seleção de diretórios. Use o botão "Salvar Como" durante a conversão.')
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Erro ao selecionar diretório personalizado:', err)
        setError('Erro ao selecionar diretório personalizado')
      }
    }
  }

  const clearCustomOutputDirectory = (videoId: string) => {
    setVideos(prev => prev.map(v => 
      v.id === videoId 
        ? { ...v, customOutputDir: undefined }
        : v
    ))
    setSuccessMessage('Diretório personalizado removido. Será usado o download padrão.')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '0s'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    
    let result = ''
    if (hours > 0) {
      result += `${hours}h `
    }
    if (minutes > 0) {
      result += `${minutes}m `
    }
    if (remainingSeconds > 0 || result === '') {
      result += `${remainingSeconds}s`
    }
    
    return result.trim()
  }

  const formatTotalTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
    } else {
      return `${seconds}s`
    }
  }

  // Função para iniciar timer global
  const startGlobalTimer = () => {
    if (!isAnyConverting) {
      setIsAnyConverting(true)
      const timer = setInterval(() => {
        setTotalConversionTime(prev => prev + 1000)
      }, 1000)
      setGlobalTimer(timer)
    }
  }

  // Função para parar timer global
  const stopGlobalTimer = () => {
    if (globalTimer) {
      clearInterval(globalTimer)
      setGlobalTimer(null)
    }
    setIsAnyConverting(false)
  }

  // Verificar se há conversões ativas e gerenciar timer global
  useEffect(() => {
    const hasActiveConversions = videos.some(v => v.converting)
    
    if (hasActiveConversions && !isAnyConverting) {
      startGlobalTimer()
    } else if (!hasActiveConversions && isAnyConverting) {
      stopGlobalTimer()
    }
  }, [videos, isAnyConverting])

  // Cleanup do timer quando componente é desmontado
  useEffect(() => {
    return () => {
      if (globalTimer) {
        clearInterval(globalTimer)
      }
    }
  }, [globalTimer])

  const handleGenerateContentText = async () => {
    if (!contentType || !contentName) {
      setGenerateError('Por favor, preencha pelo menos o tipo e o nome do conteúdo')
      return
    }

    setIsGeneratingText(true)
    setGenerateError('')

    try {
      const result = await generateContentText({
        contentType,
        contentName,
        availableLanguages
      })

      if (result.success && result.generatedText) {
        setGeneratedText(result.generatedText)
      } else {
        throw new Error(result.error || 'Erro desconhecido')
      }

    } catch (err) {
      console.error('Erro ao gerar texto:', err)
      setGenerateError('Erro ao gerar texto: ' + (err as Error).message)
    } finally {
      setIsGeneratingText(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedText)
      // Você pode adicionar uma notificação de sucesso aqui se desejar
      // console.log('Texto copiado para a área de transferência!')
    } catch (err) {
      setGenerateError('Erro ao copiar texto')
    }
  }

  const getFileExtension = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase()
    return extension?.toUpperCase() || 'UNKNOWN'
  }

  const isValidVideoFile = (filename: string, mimeType?: string) => {
    const videoExtensions = [
      'mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 
      'mpg', 'mpeg', '3gp', 'ogv', 'ts', 'mts', 'm2ts', 'f4v'
    ]
    
    const extension = filename.split('.').pop()?.toLowerCase()
    const hasVideoMimeType = mimeType && mimeType.startsWith('video/')
    const hasVideoExtension = extension && videoExtensions.includes(extension)
    
    return hasVideoMimeType || hasVideoExtension
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    
    // Filtrar arquivos de vídeo usando a função de validação
    const files = Array.from(e.dataTransfer.files).filter(file => {
      const isValid = isValidVideoFile(file.name, file.type)
      // console.log(`Arquivo: ${file.name}, MIME: ${file.type}, É vídeo: ${isValid}`)
      return isValid
    })

    // console.log(`Total de arquivos arrastados: ${e.dataTransfer.files.length}, Arquivos de vídeo válidos: ${files.length}`)

    if (files.length === 0) {
      const allFiles = Array.from(e.dataTransfer.files)
      const fileInfo = allFiles.map(f => `${f.name} (${f.type || 'sem MIME type'})`).join(', ')
      setError(`Por favor, arraste apenas arquivos de vídeo. Arquivos detectados: ${fileInfo}`)
      return
    }

    if (videos.length + files.length > 500) {
      setError('Já atingiu o limite de 500 vídeos.')
      return
    }

    processFiles(files)
  }

  const handleSelectFiles = async () => {
    // Criar um input de arquivo temporário
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'video/*'
    
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || [])
      const validFiles = files.filter(file => isValidVideoFile(file.name, file.type))
      
      if (validFiles.length === 0) {
        setError('Por favor, selecione apenas arquivos de vídeo.')
        return
      }

      if (videos.length + validFiles.length > 500) {
        setError('Já atingiu o limite de 500 vídeos.')
        return
      }

      processFiles(validFiles)
    }
    
    input.click()
  }

  const processFiles = async (files: File[]) => {
    try {
      const newVideos: VideoData[] = await Promise.all(
        files.map(async (file) => {
          try {
            const preview = URL.createObjectURL(file)
            // console.log('Preview URL criada para drag&drop:', preview)
            
            const metadata = await getVideoMetadataFromFile(file)
            
            return {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              preview,
              name: file.name,
              format: metadata.format,
              duration: metadata.duration,
              size: file.size,
              extension: getFileExtension(file.name),
              fileObject: file,
              converting: false,
              converted: false,
              selected: false
            }
          } catch (err) {
            console.error('Erro ao processar arquivo:', file.name, err)
            return {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              preview: URL.createObjectURL(file),
              name: file.name,
              format: 'unknown',
              duration: 0,
              size: file.size,
              extension: getFileExtension(file.name),
              fileObject: file,
              converting: false,
              converted: false,
              selected: false
            }
          }
        })
      )

      setError('')
      setVideos(prev => [...prev, ...newVideos])
    } catch (err) {
      setError('Erro ao processar os arquivos de vídeo: ' + (err as Error).message)
      console.error(err)
    }
  }

  const getVideoMetadataFromFile = async (file: File): Promise<{format: string, duration: number}> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        resolve({
          format: file.type || 'unknown',
          duration: video.duration || 0
        })
      }
      
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src)
        resolve({
          format: 'unknown',
          duration: 0
        })
      }
      
      video.src = URL.createObjectURL(file)
    })
  }

  const removeVideo = (id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id))
  }

  const toggleVideoSelection = (id: string) => {
    setVideos(prev => prev.map(v => 
      v.id === id && !v.converted ? { ...v, selected: !v.selected } : v
    ))
  }

  const selectAllVideos = () => {
    const availableVideos = videos.filter(v => !v.converted)
    const allAvailableSelected = availableVideos.length > 0 && availableVideos.every(v => v.selected)
    setVideos(prev => prev.map(v => 
      !v.converted ? { ...v, selected: !allAvailableSelected } : v
    ))
  }

  const convertSelectedVideos = async () => {
    const selectedVideos = videos.filter(v => v.selected && v.fileObject && !v.converting && !v.converted)
    
    if (selectedVideos.length === 0) {
      setError('Nenhum vídeo selecionado ou todos já foram convertidos')
      return
    }

    setError('')
    setSuccessMessage('')
    setIsConvertingBatch(true)

    for (const video of selectedVideos) {
      await convertToMKV(video)
    }

    setIsConvertingBatch(false)
    setSuccessMessage(`${selectedVideos.length} vídeo(s) comprimido(s) com sucesso!`)
  }

  const clearConvertedVideos = () => {
    const convertedVideos = videos.filter(v => v.converted)
    
    if (convertedVideos.length === 0) {
      setError('Nenhum vídeo convertido para remover')
      return
    }

    setVideos(prev => prev.filter(v => !v.converted))
    setSuccessMessage(`${convertedVideos.length} vídeo(s) convertido(s) removido(s) da lista`)
    setError('')
  }

  const convertToMKV = async (video: VideoData) => {
    if (!video.fileObject) {
      setError('Arquivo não disponível para conversão')
      return
    }

    setError('')
    setSuccessMessage('')
    setConvertingVideoId(video.id)
    
    // Criar um timer individual específico para este vídeo
    let videoStartTime: number | null = null
    let individualTimer: NodeJS.Timeout | null = null
    
    // Função para calcular tempo decorrido individual deste vídeo específico
    const getIndividualElapsedTime = (startTime: number) => {
      const elapsed = Date.now() - startTime
      const seconds = Math.floor(elapsed / 1000)
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      return {
        elapsed: elapsed,
        formatted: `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
      }
    }
    
    // Marcar como convertendo
    setVideos(prev => prev.map(v => 
      v.id === video.id 
        ? { ...v, converting: true, converted: false, progress: 0, elapsedTime: '00:00' }
        : v
    ))

    try {
      // Inicializar timer
      videoStartTime = Date.now()
      individualTimer = setInterval(() => {
        if (videoStartTime) {
          const timeInfo = getIndividualElapsedTime(videoStartTime)
          setVideos(prev => prev.map(v => 
            v.id === video.id 
              ? { ...v, elapsedTime: timeInfo.formatted }
              : v
          ))
        }
      }, 1000)

      // OPÇÃO 1: Usar FFmpeg.wasm (conversão no navegador)
      if (typeof window !== 'undefined' && window.FFmpeg) {
        await convertWithFFmpegWasm(video, individualTimer, videoStartTime, getIndividualElapsedTime)
      } 
      // OPÇÃO 2: Enviar para API backend
      else {
        await convertWithBackendAPI(video, individualTimer, videoStartTime, getIndividualElapsedTime)
      }

    } catch (err) {
      console.error('Erro na conversão:', err)
      setError('Erro na conversão: ' + (err as Error).message)
      setConvertingVideoId(null)
      
      // Limpar timer individual em caso de erro
      if (individualTimer) {
        clearInterval(individualTimer)
        individualTimer = null
      }
      
      // Remover estado de conversão em caso de erro
      setVideos(prev => prev.map(v => 
        v.id === video.id 
          ? { ...v, converting: false, converted: false, progress: 0, elapsedTime: undefined }
          : v
      ))
    }
  }

  // Opção 1: Conversão usando FFmpeg.wasm (funciona no navegador)
  const convertWithFFmpegWasm = async (
    video: VideoData, 
    individualTimer: NodeJS.Timeout | null,
    videoStartTime: number | null,
    getIndividualElapsedTime: (startTime: number) => { elapsed: number; formatted: string }
  ) => {
    if (!window.FFmpeg) {
      throw new Error('FFmpeg.wasm não está disponível')
    }

    const { FFmpeg } = window.FFmpeg
    const ffmpeg = new FFmpeg()

    // Carregar FFmpeg.wasm
    await ffmpeg.load()

    // Converter File para Uint8Array
    const arrayBuffer = await video.fileObject.arrayBuffer()
    const inputData = new Uint8Array(arrayBuffer)
    
    // Escrever arquivo de entrada
    const inputFileName = `input.${video.extension.toLowerCase()}`
    const outputFileName = `${video.name.replace(/\.[^/.]+$/, "")}.mkv`
    
    await ffmpeg.writeFile(inputFileName, inputData)

    // Configurar callback de progresso
    ffmpeg.on('progress', (data: { progress: number }) => {
      const progressPercent = Math.round(data.progress * 100)
      setVideos(prev => prev.map(v => 
        v.id === video.id 
          ? { ...v, progress: progressPercent }
          : v
      ))
    })

    // Executar conversão
    await ffmpeg.exec([
      '-i', inputFileName,
      '-c:v', 'libx265',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-map', '0',
      '-f', 'matroska',
      outputFileName
    ])

    // Ler arquivo de saída
    const outputData = await ffmpeg.readFile(outputFileName)
    
    // Parar timer
    if (individualTimer) {
      clearInterval(individualTimer)
    }
    
    const finalTime = videoStartTime ? getIndividualElapsedTime(videoStartTime) : { formatted: '00:00' }
    
    // Criar blob e fazer download
    const blob = new Blob([outputData], { type: 'video/x-matroska' })
    const url = URL.createObjectURL(blob)
    
    // Se o usuário escolheu um diretório personalizado e o navegador suporta
    if (video.customOutputDir && window.showSaveFilePicker) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: outputFileName,
          types: [{
            description: 'MKV Video',
            accept: {'video/x-matroska': ['.mkv']}
          }]
        })
        
        const writable = await fileHandle.createWritable()
        await writable.write(blob)
        await writable.close()
      } catch (saveErr) {
        if ((saveErr as Error).name !== 'AbortError') {
          console.warn('Erro ao salvar com File System Access API, usando download padrão:', saveErr)
          downloadFile(url, outputFileName)
        }
      }
    } else {
      // Download padrão do navegador
      downloadFile(url, outputFileName)
    }
    
    // Limpar recursos
    URL.revokeObjectURL(url)
    
    // Atualizar estado
    setVideos(prev => prev.map(v => 
      v.id === video.id 
        ? { 
            ...v, 
            converting: false, 
            converted: true, 
            progress: 100, 
            selected: false, 
            totalTime: finalTime.formatted,
            elapsedTime: undefined 
          }
        : v
    ))
    
    setConvertingVideoId(null)
    setSuccessMessage(`Vídeo convertido para MKV com sucesso!`)
  }

  // Função para conversão com API backend (versão com progresso em tempo real)
  const convertWithBackendAPI = async (
    video: VideoData,
    individualTimer: NodeJS.Timeout | null,
    videoStartTime: number | null,
    getIndividualElapsedTime: (startTime: number) => { elapsed: number; formatted: string }
  ) => {
    // Gerar ID único no frontend
    const conversionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
    // console.log('🆔 ID de conversão gerado no frontend:', conversionId)
    
    const formData = new FormData()
    formData.append('video', video.fileObject)
    formData.append('outputName', `${video.name.replace(/\.[^/.]+$/, "")}.mkv`)
    formData.append('conversionId', conversionId) // Passar o ID para o backend

    let progressTimer: NodeJS.Timeout | null = null

    try {
      // console.log('🚀 Iniciando conversão:', video.name)
      
      // Mapear conversion ID para video ID antes de iniciar
      setConversionVideoMap(prev => {
        const newMap = new Map(prev)
        newMap.set(conversionId, video.id)
        // console.log('🗺️ Mapeando conversão:', conversionId, '→', video.id)
        // console.log('🗺️ ConversionVideoMap atualizado. Size:', newMap.size)
        return newMap
      })

      // Iniciar polling do progresso imediatamente
      // console.log('🔄 Iniciando polling do progresso para ID:', conversionId)
      
      const fetchProgress = async (): Promise<boolean> => {
        try {
          // console.log('🔍 Fazendo requisição de progresso para ID:', conversionId)
          const progressResponse = await fetch(`/api/convert-video/progress?id=${conversionId}`)
          // console.log('📡 Status da resposta do progresso:', progressResponse.status)
          
          if (progressResponse.ok) {
            const progressData = await progressResponse.json()
            // console.log('📊 Progresso atualizado do servidor:', progressData)
            
            // Verificar se os dados são válidos
            if (progressData && typeof progressData.progress === 'number') {
              // Atualizar progresso no contexto
              // console.log('📝 Atualizando contexto com progresso:', progressData.progress, '% - Status:', progressData.status)
              updateProgressContext(conversionId, progressData.progress, progressData.status)
              // console.log('✅ Contexto atualizado')
              
              // Se completou, parar o polling (download será feito pela conversão síncrona)
              if (progressData.status === 'concluído' || progressData.progress >= 100) {
                // console.log('✅ Conversão completada via polling')
                if (progressTimer) {
                  clearInterval(progressTimer)
                  progressTimer = null
                }
                return false // Indica para parar o polling
              }
            } else {
              console.warn('⚠️ Dados de progresso inválidos:', progressData)
            }
            return true // Continuar polling
          } else {
            console.warn('⚠️ Erro na resposta do progresso:', progressResponse.status)
            const errorText = await progressResponse.text()
            console.warn('⚠️ Texto do erro:', errorText)
            return true // Continuar tentando
          }
        } catch (progressError) {
          console.warn('⚠️ Erro ao buscar progresso:', progressError)
          return true // Continuar tentando
        }
      }
      
      // Iniciar polling imediatamente
      // console.log('🏃‍♂️ Fazendo primeira requisição de progresso imediatamente')
      fetchProgress() // Não aguardar a primeira
      
      // Configurar polling regular
      progressTimer = setInterval(async () => {
        const shouldContinuePolling = await fetchProgress()
        if (!shouldContinuePolling && progressTimer) {
          clearInterval(progressTimer)
          progressTimer = null
        }
      }, 1000) // Polling a cada 1 segundo

      // Fazer a requisição de conversão (síncrona, retorna o arquivo quando terminar)
      const response = await fetch('/api/convert-video', {
        method: 'POST',
        body: formData,
      })
      
      // Parar o polling quando a conversão terminar
      if (progressTimer) {
        clearInterval(progressTimer)
        progressTimer = null
      }

      if (!response.ok) {
        let errorMessage = `Erro HTTP ${response.status}`
        
        try {
          // Tentar parsear como JSON primeiro
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (jsonError) {
          // Se não for JSON válido, tentar ler como texto
          try {
            const errorText = await response.text()
            // Se for HTML de erro da Vercel, extrair informação útil
            if (errorText.includes('Internal Server Error') || errorText.includes('Error 500')) {
              errorMessage = 'Erro interno do servidor (500). Verifique os logs da aplicação.'
            } else if (errorText.includes('Request Entity Too Large') || errorText.includes('413')) {
              errorMessage = 'Arquivo muito grande. Tente um arquivo menor.'
            } else if (errorText.includes('Timeout') || errorText.includes('504')) {
              errorMessage = 'Timeout na conversão. Arquivo pode ser muito grande ou complexo.'
            } else if (errorText.trim()) {
              // Se tem conteúdo de texto mas não é JSON, mostrar parte dele
              const preview = errorText.substring(0, 100)
              errorMessage = `Erro do servidor: ${preview}${errorText.length > 100 ? '...' : ''}`
            }
          } catch (textError) {
            // Se não conseguir ler nem como texto
            errorMessage = `Erro HTTP ${response.status} - Não foi possível obter detalhes do erro`
          }
        }
        
        throw new Error(errorMessage)
      }

      // console.log('✅ Conversão completada! Processando download...')

      const blob = await response.blob()
      // console.log('📁 Arquivo recebido:', blob.size, 'bytes')
      
      // Parar timer individual
      if (individualTimer) {
        clearInterval(individualTimer)
      }
      
      const finalTime = videoStartTime ? getIndividualElapsedTime(videoStartTime) : { formatted: '00:00' }
      
      // Fazer download
      const url = URL.createObjectURL(blob)
      const outputFileName = `${video.name.replace(/\.[^/.]+$/, "")}.mkv`
      
      // Se o usuário escolheu um diretório personalizado e o navegador suporta
      if (video.customOutputDir && window.showSaveFilePicker) {
        try {
          // console.log('💾 Salvando com File System Access API...')
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: outputFileName,
            types: [{
              description: 'MKV Video',
              accept: {'video/x-matroska': ['.mkv']}
            }]
          })
          
          const writable = await fileHandle.createWritable()
          await writable.write(blob)
          await writable.close()
          // console.log('✅ Arquivo salvo em:', fileHandle.name)
        } catch (saveErr) {
          if ((saveErr as Error).name !== 'AbortError') {
            console.warn('⚠️ Erro ao salvar com File System Access API, usando download padrão:', saveErr)
            downloadFile(url, outputFileName)
          } else {
            // console.log('❌ Usuário cancelou o salvamento')
          }
        }
      } else {
        // console.log('📥 Iniciando download padrão...')
        downloadFile(url, outputFileName)
        // console.log('✅ Download iniciado:', outputFileName)
      }
      
      URL.revokeObjectURL(url)
      
      // Atualizar estado final com sucesso
      setVideos(prev => prev.map(v => 
        v.id === video.id 
          ? { 
              ...v, 
              converting: false, 
              converted: true, 
              progress: 100, 
              selected: false, 
              totalTime: finalTime.formatted,
              elapsedTime: undefined 
            }
          : v
      ))
      
      setConvertingVideoId(null)
      setSuccessMessage(`✅ Vídeo "${video.name}" convertido para MKV com sucesso!`)
      
    } catch (fetchError) {
      console.error('❌ Erro na API de conversão:', fetchError)
      
      // Parar o polling de progresso em caso de erro
      if (progressTimer) {
        clearInterval(progressTimer)
        progressTimer = null
      }
      
      // Parar timer em caso de erro
      if (individualTimer) {
        clearInterval(individualTimer)
      }
      
      // Atualizar estado para erro
      setVideos(prev => prev.map(v => 
        v.id === video.id 
          ? { 
              ...v, 
              converting: false, 
              converted: false, 
              progress: 0, 
              selected: false,
              elapsedTime: undefined 
            }
          : v
      ))
      
      setConvertingVideoId(null)
      setError(`Erro na conversão de "${video.name}": ${(fetchError as Error).message}`)
      
    } finally {
      // Limpeza final - garantir que todos os timers são limpos
      if (progressTimer) {
        clearInterval(progressTimer)
        progressTimer = null
      }
      if (individualTimer) {
        clearInterval(individualTimer)
      }
      
      // Limpar do mapa de conversão
      setConversionVideoMap(prev => {
        const newMap = new Map(prev)
        newMap.delete(conversionId)
        // console.log('🗑️ Removido do ConversionVideoMap. Size após remoção:', newMap.size)
        return newMap
      })
      
      // console.log('🔄 Conversão finalizada para video ID:', video.id, 'conversionId:', conversionId)
    }
  }

  // Função auxiliar para fazer download de arquivos
  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="min-h-screen bg-background p-6 flex">
      <div className="mx-auto max-w-6xl space-y-6 w-[70%]">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Conversor de Vídeos OCFlix</h1>
          <p className="text-muted-foreground mt-2">
            Arraste e solte ou selecione seus arquivos de vídeo
          </p>
          <p className="text-sm text-muted-foreground/80 mt-1">
            Compressão para MKV com codec HEVC (H.265) • GPU NVIDIA NVENC + CPU fallback • Mantém áudio dual e legendas
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Formatos suportados: MP4, AVI, MOV, MKV, WMV, FLV, WEBM, M4V, MPG, MPEG, 3GP, OGV, TS, MTS, M2TS, F4V
          </p>
        </div>

        {/* Configurações */}
        {/* <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="output-directory" className="text-sm font-medium text-gray-700 mb-2 block">
                  Pasta de destino dos vídeos convertidos:
                </Label>
                <div className="flex items-center gap-3 max-md:flex-col max-md:items-start">
                  <div className="flex-1 p-3 bg-gray-50 rounded-md border">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700 truncate">{outputDirectory}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={changeOutputDirectory}
                    className="gap-2 py-5"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Alterar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card> */}
        
        {/* Área de Drag and Drop */}
        <Card 
          className={`transition-all duration-300 ${
            isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-dashed border-2 hover:border-primary/50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <div className="text-center space-y-2">
              <p className="text-xl font-medium">
                {isDragging ? 'Solte os vídeos aqui' : 'Arraste os vídeos para cá'}
              </p>
              <p className="text-sm text-muted-foreground">
                Suporta até 500 vídeos • Todos os formatos comuns de vídeo
              </p>
              <p className="text-xs text-muted-foreground/70">
                MP4, AVI, MOV, MKV, WMV, FLV, WEBM, M4V, MPG, 3GP, TS, etc.
              </p>
              <div className="flex items-center justify-center gap-2 pt-4">
                <div className="h-px bg-border flex-1" />
                <span className="text-xs text-muted-foreground px-2">ou</span>
                <div className="h-px bg-border flex-1" />
              </div>
              <div className="pt-4">
                <Button onClick={handleSelectFiles} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Selecionar Arquivos
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mensagem de erro */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Mensagem de sucesso */}
        {successMessage && (
          <Alert className="border-green-500 bg-green-50 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Lista de vídeos */}
        {videos.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">
                Vídeos Carregados
              </h2>
              <Badge variant="secondary">
                {videos.length}/500
              </Badge>
            </div>
            
            {/* Botões de ação em lote */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              {/* Lado esquerdo - Botões de ação */}
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={selectAllVideos}
                  className="gap-2"
                  disabled={videos.filter(v => !v.converted && v.fileObject).length === 0}
                >
                  <CheckCircle className="h-4 w-4" />
                  {(() => {
                    const availableVideos = videos.filter(v => !v.converted && v.fileObject)
                    const allAvailableSelected = availableVideos.length > 0 && availableVideos.every(v => v.selected)
                    return allAvailableSelected ? 'Desmarcar Todos' : 'Selecionar Todos'
                  })()}
                </Button>
                
                <Button
                  onClick={convertSelectedVideos}
                  disabled={!videos.some(v => v.selected && v.fileObject && !v.converting && !v.converted) || isConvertingBatch}
                  className="gap-2"
                >
                  {isConvertingBatch ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Comprimindo...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4" />
                      Comprimir Selecionados ({videos.filter(v => v.selected && v.fileObject).length})
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={clearConvertedVideos}
                  disabled={!videos.some(v => v.converted)}
                  className="gap-2 text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                  Limpar Convertidos ({videos.filter(v => v.converted).length})
                </Button>
              </div>

              {/* Lado direito - Contador de tempo total */}
              <div className="flex items-center gap-2">
                {(isAnyConverting || totalConversionTime > 0) && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-md border">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <div className="text-sm">
                      <span className="text-gray-600">Tempo total: </span>
                      <span className="font-medium text-blue-600">
                        {formatTotalTime(totalConversionTime)}
                      </span>
                      {isAnyConverting && (
                        <span className="ml-1 text-green-600">●</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              {videos.map((video) => (
                <Card key={video.id} id={video.id} className="overflow-hidden">
                  <div className="flex">
                    {/* Checkbox de seleção */}
                    <div className="flex items-center justify-center p-4">
                      <Checkbox
                        checked={video.selected || false}
                        onCheckedChange={(checked) => toggleVideoSelection(video.id)}
                        disabled={video.converted}
                      />
                    </div>
                    
                    {/* Thumbnail do vídeo */}
                    <div className="relative w-80 flex-shrink-0">
                      <video 
                        src={video.preview} 
                        className="w-full h-48 object-cover rounded-lg"
                        controls
                        preload="metadata"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLVideoElement
                          console.error('Erro ao carregar vídeo:', video.name, {
                            error: target.error,
                            networkState: target.networkState,
                            readyState: target.readyState,
                            src: target.src
                          })
                        }}
                        onLoadedData={() => {
                          // console.log('Vídeo carregado com sucesso:', video.name)
                        }}
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-2 right-2 h-8 w-8 rounded-lg"
                        onClick={() => removeVideo(video.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Informações do vídeo */}
                    <div className="flex-1 p-6">
                      <CardHeader className="p-0">
                        <CardTitle className="text-lg line-clamp-2" title={video.name}>
                          {video.name}
                        </CardTitle>
                      </CardHeader>
                      
                      <CardContent className="p-0 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <FileType className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Extensão:</span>
                              <Badge variant="secondary">
                                {video.extension}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Play className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Formato:</span>
                              <span className="text-sm font-medium">{video.format}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Duração:</span>
                              <span className="text-sm font-medium">{formatDuration(video.duration)}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <HardDrive className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Tamanho:</span>
                              <span className="text-sm font-medium">{formatFileSize(video.size)}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Diretório de saída personalizado */}
                        {/* {video.fileObject && !video.converting && !video.converted && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-md border">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700">
                                Diretório de saída:
                              </Label>
                              {video.customOutputDir ? (
                                <div>
                                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border text-sm">
                                    <Folder className="h-4 w-4 text-blue-600" />
                                    <span className="text-blue-700 flex-1 truncate" title={video.customOutputDir.name}>
                                      {video.customOutputDir.name}
                                    </span>
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => selectCustomOutputDirectory(video.id)}
                                      className="text-xs"
                                    >
                                      <FolderOpen className="h-3 w-3 mr-1" />
                                      Alterar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => clearCustomOutputDirectory(video.id)}
                                      className="text-xs text-red-600 hover:text-red-700"
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Usar padrão
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-2 p-2 bg-gray-100 rounded border text-sm">
                                    <Folder className="h-4 w-4 text-gray-500" />
                                    <span className="text-gray-600 flex-1 truncate" title={outputDirectory}>
                                      {outputDirectory} (padrão)
                                    </span>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => selectCustomOutputDirectory(video.id)}
                                    className="text-xs mt-2"
                                  >
                                    <FolderOpen className="h-3 w-3 mr-1" />
                                    Escolher diretório personalizado
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )} */}
                        
                        {/* Botão de compressão */}
                        <div className="mt-6 flex items-center justify-between">
                          <div className="flex items-baseline gap-2">
                            {video.converted && (
                              <>
                                <div className="flex flex-col gap-1">
                                  <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Convertido
                                  </Badge>
                                  {video.totalTime && (
                                    <Badge id={video.id} variant="outline" className="text-green-600">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Tempo: {video.totalTime}
                                    </Badge>
                                  )}
                                </div>
                                {/* <Badge variant="outline" className="text-gray-500">
                                  Não selecionável
                                </Badge> */}
                              </>
                            )}
                            {video.converting && (
                              <div className="flex flex-col gap-1">
                                <Badge variant="secondary">
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Convertendo... {(() => {
                                    // Encontrar o conversion ID para este video
                                    let conversionId: string | undefined
                                    for (const [cId, vId] of conversionVideoMap.entries()) {
                                      if (vId === video.id) {
                                        conversionId = cId
                                        break
                                      }
                                    }
                                    
                                    if (conversionId) {
                                      const progressData = getProgressContext(conversionId)
                                      return Math.round(progressData.progress || 0)
                                    }
                                    
                                    return Math.round(video.progress || 0)
                                  })()}%
                                </Badge>
                                {video.elapsedTime && (
                                  <Badge variant="outline" className="text-blue-600">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {video.elapsedTime}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {video.fileObject && !video.converted && !video.converting && (
                              <Badge variant="outline" className="text-blue-600">
                                Arquivo carregado - Pronto para conversão
                              </Badge>
                            )}
                          </div>
                          
                          {video.fileObject && (
                            <div className="flex items-center gap-3">
                              <Button
                                onClick={() => convertToMKV(video)}
                                disabled={video.converting || video.converted}
                                variant={video.converted ? "secondary" : "default"}
                                className="gap-2"
                              >
                                {video.converting ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Comprimindo...
                                  </>
                                ) : video.converted ? (
                                  <>
                                    <CheckCircle className="h-4 w-4" />
                                    Comprimido
                                  </>
                                ) : (
                                  <>
                                    <Settings className="h-4 w-4" />
                                    Comprimir para MKV (HEVC)
                                  </>
                                )}
                              </Button>
                              
                              {/* Barra de progresso */}
                              {/* {video.converting && (
                                <div className="flex items-center gap-2 min-w-[140px]">
                                  <Progress value={video.progress || 0} className="w-24" />
                                  <span className="text-sm font-medium text-gray-700 min-w-[40px]">
                                    {Math.round(video.progress || 0)}%
                                  </span>
                                </div>
                              )} */}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className='w-[30%] generate-content p-6'>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Film className="h-5 w-5" />
              Informações do Conteúdo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Seletor de tipo de conteúdo */}
            <div className="space-y-2">
              <Label htmlFor="content-type" className="text-sm font-medium">
                Tipo de Conteúdo:
              </Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="serie">Série</SelectItem>
                  <SelectItem value="filme">Filme</SelectItem>
                  <SelectItem value="desenho">Desenho</SelectItem>
                  <SelectItem value="anime">Anime</SelectItem>
                  <SelectItem value="show">Show</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Input para nome do conteúdo */}
            <div className="space-y-2">
              <Label htmlFor="content-name" className="text-sm font-medium">
                Nome:
              </Label>
              <Input
                id="content-name"
                type="text"
                value={contentName}
                onChange={(e) => setContentName(e.target.value)}
                placeholder="Digite o nome do conteúdo"
              />
            </div>

            {/* Input para idiomas disponíveis */}
            <div className="space-y-2">
              <Label htmlFor="available-languages" className="text-sm font-medium">
                Idiomas disponíveis:
              </Label>
              <Input
                id="available-languages"
                type="text"
                value={availableLanguages}
                onChange={(e) => setAvailableLanguages(e.target.value)}
                placeholder="Ex: Português, Inglês, Espanhol"
              />
            </div>

            {/* Preview das informações */}
            {(contentType || contentName || availableLanguages) && (
              <div className="mt-6 p-4 bg-gray-50 rounded-md border">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Preview:</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  {contentType && (
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      <span className="capitalize">{contentType}</span>
                    </div>
                  )}
                  {contentName && (
                    <div className="flex items-center gap-2">
                      <Film className="h-4 w-4" />
                      <span>{contentName}</span>
                    </div>
                  )}
                  {availableLanguages && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs">🌐</span>
                      <span>{availableLanguages}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Botão para gerar texto */}
            <div className="mt-6">
              <Button 
                onClick={handleGenerateContentText}
                disabled={!contentType || !contentName || isGeneratingText}
                className="w-full"
              >
                {isGeneratingText ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando texto...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Gerar Texto Promocional
                  </>
                )}
              </Button>
            </div>

            {/* Exibição de erro */}
            {generateError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {generateError}
                </AlertDescription>
              </Alert>
            )}

            {/* Exibição do texto gerado */}
            {generatedText && (
              <div className="mt-6">
                <div className="flex items-center max-lg:flex-col max-lg:items-start justify-between mb-4 gap-2">
                  <Label className="text-sm font-medium">Texto Promocional Gerado:</Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={copyToClipboard}
                    className="h-8"
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copiar
                  </Button>
                </div>
                <div className="p-4 bg-white border rounded-md max-h-64 overflow-y-auto">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {generatedText}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
