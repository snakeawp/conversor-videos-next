"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface ProgressData {
  progress: number
  status: string
}

interface ProgressContextType {
  progressMap: Map<string, ProgressData>
  updateProgress: (conversionId: string, progress: number, status: string) => void
  getProgress: (conversionId: string) => ProgressData
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined)

export const ProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [progressMap, setProgressMap] = useState<Map<string, ProgressData>>(new Map())

  const updateProgress = (conversionId: string, progress: number, status: string) => {
    // console.log(`🔄 Context UPDATE - Recebendo update para ${conversionId}: ${progress}% - ${status}`)
    setProgressMap(prev => {
      const newMap = new Map(prev)
      const oldValue = newMap.get(conversionId)
      newMap.set(conversionId, { progress, status })
      // console.log(`✅ Context UPDATE - Mapa atualizado. Size: ${newMap.size}`)
      // console.log(`🔄 Context UPDATE - Valor anterior:`, oldValue, '-> Novo valor:', { progress, status })
      // console.log(`🗂️ Context UPDATE - Todos os itens no mapa:`, Array.from(newMap.entries()))
      return newMap
    })
  }

  const getProgress = (conversionId: string): ProgressData => {
    const result = progressMap.get(conversionId) || { progress: 0, status: 'não encontrado' }
    // console.log(`🔍 Context GET - Buscando progresso para ${conversionId}:`, result)
    // console.log(`🔍 Context GET - ProgressMap size: ${progressMap.size}`)
    // console.log(`🔍 Context GET - Todas as chaves disponíveis:`, Array.from(progressMap.keys()))
    return result
  }

  return (
    <ProgressContext.Provider value={{ progressMap, updateProgress, getProgress }}>
      {children}
    </ProgressContext.Provider>
  )
}

export const useProgress = () => {
  const context = useContext(ProgressContext)
  if (context === undefined) {
    throw new Error('useProgress must be used within a ProgressProvider')
  }
  return context
}
