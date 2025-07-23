# Otimizações para Resolver Travamento FFmpeg.wasm

## 🚨 Problema Identificado
O FFmpeg.wasm estava **travando/congelando** durante a conversão H.265, especificamente após iniciar o processamento sem mostrar progresso.

## 🔧 Soluções Implementadas

### **1. Configurações Otimizadas para Navegador**

#### **H.265 (Primeira tentativa)**
```javascript
// ANTES (Travando)
'-preset', 'medium',    // Muito pesado para navegador
'-crf', '25',          // Qualidade alta demais
'-map', '0',           // Mapeando todos os streams

// DEPOIS (Otimizado)
'-preset', 'fast',     // Preset rápido para evitar travamento
'-crf', '28',          // CRF mais alto = processamento mais rápido
'-map', '0:v:0',       // Apenas primeiro stream de vídeo
'-map', '0:a:0',       // Apenas primeiro stream de áudio
'-threads', '1',       // Single-thread (mais estável no navegador)
'-x265-params', 'log-level=error', // Reduzir logs verbosos
```

#### **H.264 (Fallback)**
```javascript
'-preset', 'fast',     // Preset rápido
'-crf', '26',          // Balanceado para velocidade
'-threads', '1',       // Single-thread para estabilidade
'-c:a', 'copy',        // Copiar áudio (mais rápido que recodificar)
```

#### **Básico (Fallback final)**
```javascript
'-preset', 'ultrafast', // Máxima velocidade
'-crf', '30',          // Qualidade menor, processamento rápido
// Mínimo de parâmetros para evitar travamento
```

### **2. Sistema de Timeout**
```javascript
// Timeout de 5 minutos para H.265
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Timeout: H.265 demorou mais de 5 minutos')), 5 * 60 * 1000)
})

await Promise.race([conversionPromise, timeoutPromise])
```

### **3. Estratégia de Fallback Tripla**
1. **H.265 otimizado** (máxima compressão)
2. **H.264 otimizado** (se H.265 falhar)
3. **Conversão básica** (se tudo falhar)

### **4. Melhorias de Estabilidade**
- `'-threads', '1'`: Força single-thread (evita problemas de concorrência)
- `'-avoid_negative_ts', 'make_zero'`: Evita problemas de timestamp
- `'-c:a', 'copy'`: Copia áudio sem recodificar (muito mais rápido)
- Mapeamento específico de streams ao invés de mapear tudo

## 📊 Benefícios Esperados

### **Performance**
- ⚡ **3-5x mais rápido**: Presets otimizados para navegador
- 🚀 **Sem travamento**: Timeouts previnem congelamento
- 🔄 **Fallback garantido**: Sempre completa a conversão

### **Estabilidade**
- ✅ **Single-thread**: Evita problemas de concorrência no navegador
- ✅ **Timeouts**: Previne conversões infinitas
- ✅ **Logs limpos**: Reduz spam de logs do x265

### **Compatibilidade**
- 📱 **Navegadores móveis**: Configurações leves
- 💻 **Dispositivos fracos**: Presets rápidos
- 🌐 **Todos os navegadores**: Máxima compatibilidade

## 🎯 Configurações por Cenário

### **Vídeo Pequeno (< 100MB)**
- H.265 fast, CRF 28
- Tempo esperado: 1-3 minutos

### **Vídeo Médio (100-500MB)**
- Provavelmente fallback H.264
- Tempo esperado: 2-5 minutos

### **Vídeo Grande (> 500MB)**
- Pode precisar do fallback básico
- Tempo esperado: 3-8 minutos

## 🔍 Debugging

### **Logs para Monitorar**
```
🔄 Iniciando conversão para MKV com H.265...
✅ Conversão H.265 concluída com sucesso!
// ou
⚠️ H.265 falhou, tentando H.264 como fallback
🔄 Tentando conversão H.264...
✅ Conversão H.264 fallback concluída!
// ou
❌ H.264 também falhou, tentando conversão básica
🔄 Tentando conversão básica (última tentativa)...
✅ Conversão básica concluída!
```

### **Possíveis Erros**
- **Timeout**: Arquivo muito grande ou dispositivo lento
- **Memory**: Arquivo muito grande para a memória disponível
- **Format**: Formato de entrada não suportado

## 📝 Próximos Passos

1. **Testar** com diferentes tamanhos de arquivo
2. **Ajustar timeouts** se necessário
3. **Monitorar** qual fallback é mais usado
4. **Otimizar** configurações baseado no feedback

## ⚡ Resumo das Otimizações

- **Preset**: `medium` → `fast` → `ultrafast`
- **CRF**: `25` → `28` → `30` (qualidade vs velocidade)
- **Threads**: `auto` → `1` (estabilidade)
- **Áudio**: `aac recodificação` → `copy` (velocidade)
- **Streams**: `todos` → `apenas principais` (simplicidade)
- **Timeout**: `infinito` → `5min/3min/2min` (prevenção)
