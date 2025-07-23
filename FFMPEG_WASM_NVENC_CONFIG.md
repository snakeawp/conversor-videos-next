# Configurações NVENC Adaptadas para FFmpeg.wasm

Este documento explica como as configurações NVENC originais foram adaptadas para funcionar com FFmpeg.wasm no navegador.

## Comparação das Configurações

### Original NVENC (Electron/Node.js)
```javascript
// Configurações originais do NVENC
'-videoCodec', 'hevc_nvenc'     // Encoder NVIDIA HEVC/H.265
'-preset', 'p6'                 // Preset mais lento = melhor compressão
'-profile:v', 'main10'          // Profile HEVC otimizado
'-tier', 'high'                 // High tier para melhor compressão
'-rc', 'constqp'                // Constant QP para controle preciso
'-qp', '25'                     // QP mais alto = menor arquivo
'-b_ref_mode', 'middle'         // Otimização de frames B
'-temporal-aq', '1'             // Adaptive quantization temporal
'-spatial-aq', '1'              // Adaptive quantization espacial
'-aq-strength', '8'             // Força do AQ
'-multipass', 'fullres'         // Multipass para melhor compressão
```

### Adaptado para FFmpeg.wasm
```javascript
// Configurações adaptadas para funcionar no navegador
'-c:v', 'libx265'               // H.265 software (equivalente ao hevc_nvenc)
'-preset', 'slow'               // Equivalente ao preset p6 do NVENC
'-crf', '25'                    // Equivalent ao QP 25 do NVENC
'-profile:v', 'main10'          // Mesmo profile HEVC
'-tier', 'high'                 // Mesmo tier para compressão
```

## Estratégia de Fallback

### 1. Primeira Tentativa: H.265 (HEVC)
- Usa `libx265` para máxima compressão
- Mantém as mesmas configurações de qualidade do NVENC
- Profile `main10` para melhor eficiência

### 2. Fallback: H.264 (AVC)
- Se H.265 falhar, usa `libx264`
- Mais compatível com navegadores
- Ainda mantém alta qualidade com CRF 23

## Configurações Mantidas

### Áudio
```javascript
'-c:a', 'aac'          // Codec AAC (mesmo do original)
'-b:a', '128k'         // Bitrate 128k (mesmo do original)
'-ac', '2'             // 2 canais (mesmo do original)
'-ar', '44100'         // Sample rate (mesmo do original)
```

### Legendas e Streams
```javascript
'-map', '0'                        // Mapear todos os streams
'-c:s', 'copy'                     // Copiar legendas
'-disposition:s:0', 'default'      // Primeira legenda como padrão
```

### Metadados (Português BR)
```javascript
'-metadata:s:a:0', 'language=por'  // Áudio em português
'-metadata:s:s:0', 'language=por'  // Legendas em português
'-metadata', 'title=Convertido para MKV OCFlix H.265'
'-metadata', 'language=por'        // Idioma geral do arquivo
```

## Limitações do FFmpeg.wasm vs NVENC

### NVENC (Hardware)
- ✅ Aceleração por GPU
- ✅ Velocidade muito alta
- ✅ Baixo uso de CPU
- ❌ Depende de hardware NVIDIA
- ❌ Não funciona no navegador

### FFmpeg.wasm (Software)
- ✅ Funciona em qualquer navegador
- ✅ Não depende de hardware específico
- ✅ Configurações flexíveis
- ❌ Usa CPU (mais lento)
- ❌ Maior uso de bateria

## Resultados Esperados

### Qualidade
- **H.265**: Arquivos ~30-50% menores que H.264
- **H.264**: Compatibilidade máxima
- **Áudio**: AAC 128k para boa qualidade/tamanho

### Performance
- **H.265**: 2-5x mais lento que NVENC, mas 30-50% menor arquivo
- **H.264**: Mais rápido que H.265, compatibilidade total

### Compatibilidade
- **Navegadores**: Chrome, Firefox, Safari, Edge
- **Dispositivos**: Desktop, mobile, tablets
- **Sistemas**: Windows, macOS, Linux, Android, iOS

## Monitoramento de Performance

O sistema automatically fallback para H.264 se:
- H.265 não for suportado pelo navegador
- H.265 falhar durante a conversão
- Dispositivo com pouca memória/processamento

```javascript
// Logs para debugging
console.log('🔄 Iniciando conversão para MKV com H.265...')
console.log('✅ Conversão H.265 concluída com sucesso!')
// ou
console.warn('⚠️ H.265 falhou, tentando H.264 como fallback')
console.log('✅ Conversão H.264 fallback concluída!')
```
