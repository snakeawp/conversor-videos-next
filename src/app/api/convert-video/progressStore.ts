// Store compartilhado para progresso das conversões usando global para persistência
declare global {
  var __progressStore: Map<string, { progress: number; status: string }> | undefined
}

export const progressStore = globalThis.__progressStore ?? new Map<string, { progress: number; status: string }>()

if (!globalThis.__progressStore) {
  globalThis.__progressStore = progressStore
}

export function updateProgress(conversionId: string, progress: number, status: string) {
  progressStore.set(conversionId, { progress, status })
  // console.log(`📦 ProgressStore UPDATE - ID: ${conversionId} | Progresso: ${progress}% | Status: ${status}`)
  // console.log(`📦 ProgressStore UPDATE - Total de itens no store: ${progressStore.size}`)
  // console.log(`📦 ProgressStore UPDATE - Todos os IDs no store: [${Array.from(progressStore.keys()).join(', ')}]`)
}

export function getProgress(conversionId: string) {
  const result = progressStore.get(conversionId) || { progress: 0, status: 'não encontrado' }
  // console.log(`📦 ProgressStore GET - Buscando ID: ${conversionId}`)
  // console.log(`📦 ProgressStore GET - Resultado: ${JSON.stringify(result)}`)
  // console.log(`📦 ProgressStore GET - IDs disponíveis: [${Array.from(progressStore.keys()).join(', ')}]`)
  // console.log(`📦 ProgressStore GET - Store size: ${progressStore.size}`)
  return result
}
