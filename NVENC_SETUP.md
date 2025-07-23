# Configuração NVENC para Conversão GPU

## 🚀 Alterações Implementadas

✅ **Removidos limitadores de memória**
- Sem limite de tamanho de arquivo
- Sem timeout de conversão
- Suporte a arquivos grandes

✅ **Implementado NVENC (GPU NVIDIA)**
- Tentativa primária com `hevc_nvenc`
- Fallback automático para CPU `libx265`
- Parâmetros otimizados para menor tamanho

✅ **Progresso em tempo real**
- Server-Sent Events para progresso real
- Atualização da porcentagem durante conversão
- Status detalhado (preparando, convertendo, finalizando)

## 🎯 Configurações NVENC Aplicadas

### Codec e Formato
- **Video Codec**: `hevc_nvenc` (GPU NVIDIA)
- **Audio Codec**: `aac` (128kbps, 2 canais, 44.1kHz)
- **Formato**: MKV (Matroska)

### Parâmetros Otimizados
```bash
-preset p6                    # Preset mais lento = melhor compressão
-profile:v main10            # Profile HEVC otimizado
-tier high                   # High tier para melhor compressão
-rc constqp                  # Constant QP para controle preciso
-qp 25                       # QP alto = menor arquivo
-b_ref_mode middle           # Otimização de frames B
-temporal-aq 1               # Adaptive quantization temporal
-spatial-aq 1                # Adaptive quantization espacial
-aq-strength 8               # Força do AQ
-multipass fullres           # Multipass para melhor compressão
```

### Metadados e Legendas
```bash
-map 0                       # Mapear todos os streams
-c:s copy                    # Copiar legendas sem recodificação
-disposition:s:0 default     # Primeira legenda como padrão
-metadata:s:a:0 language=por # Áudio em português
-metadata:s:s:0 language=por # Legendas em português
-metadata title="Convertido para MKV"
-metadata language=por
```

## 🔧 Requisitos para NVENC

### 1. Hardware Necessário
- **GPU NVIDIA**: GTX 1050 ou superior
- **Arquitetura**: Pascal, Turing, Ampere, Ada Lovelace
- **VRAM**: Pelo menos 2GB recomendado

### 2. Software Necessário
```bash
# FFmpeg com suporte NVENC
ffmpeg -encoders | grep nvenc
# Deve mostrar: hevc_nvenc, h264_nvenc

# Verificar drivers NVIDIA atualizados
nvidia-smi
```

### 3. Instalação FFmpeg com NVENC

**Windows:**
```bash
# Baixar FFmpeg com suporte NVENC
# https://www.gyan.dev/ffmpeg/builds/ (full builds)
# Ou usar chocolatey:
choco install ffmpeg-full
```

**Linux (Ubuntu):**
```bash
sudo apt update
sudo apt install ffmpeg nvidia-driver-xxx
# xxx = versão do driver apropriada
```

**Verificar suporte NVENC:**
```bash
ffmpeg -hide_banner -encoders | grep nvenc
```

## 📊 Fluxo de Conversão

1. **Preparação (0-10%)**
   - Upload e validação do arquivo
   - Criação de arquivos temporários
   - Inicialização do FFmpeg

2. **Tentativa NVENC (15-95%)**
   - Usa `hevc_nvenc` com parâmetros otimizados
   - Progresso real via Server-Sent Events
   - Conversão rápida e eficiente
   - Menor uso de CPU

3. **Fallback CPU (se NVENC falhar)**
   - Usa `libx265` tradicional
   - Progresso real atualizado
   - Conversão mais lenta mas compatível
   - Maior uso de CPU

4. **Finalização (95-100%)**
   - Leitura do arquivo convertido
   - Limpeza de arquivos temporários
   - Download do resultado

5. **Resultado**
   - Arquivo MKV com codec HEVC
   - Áudio AAC comprimido
   - Legendas preservadas
   - Metadados em português

## 🐛 Troubleshooting

### NVENC não funciona?
```bash
# Verificar se GPU suporta NVENC
ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=30 -c:v hevc_nvenc test.mkv

# Se der erro, possíveis causas:
# 1. Driver NVIDIA desatualizado
# 2. FFmpeg sem suporte NVENC
# 3. GPU não suporta NVENC
# 4. VRAM insuficiente
```

### Mensagens de Erro Comuns
- **"Unknown encoder 'hevc_nvenc'"**: FFmpeg sem suporte NVENC
- **"Cannot load nvenc"**: Driver NVIDIA problema
- **"No NVENC capable devices found"**: GPU incompatível
- **"NVENC init failed"**: Recurso em uso ou VRAM insuficiente

## 📈 Performance Esperada

### NVENC (GPU)
- **Velocidade**: 2-5x mais rápido que CPU
- **Qualidade**: Muito boa com parâmetros otimizados
- **Uso CPU**: Baixo (~10-20%)
- **Uso GPU**: Alto (~80-100%)

### Fallback CPU
- **Velocidade**: Padrão libx265
- **Qualidade**: Excelente
- **Uso CPU**: Alto (~80-100%)
- **Uso GPU**: Baixo

## 🎮 Testando a Configuração

1. **Instale as dependências:**
```bash
npm install fluent-ffmpeg @types/fluent-ffmpeg
```

2. **Teste um arquivo pequeno:**
- Faça upload de um vídeo de teste
- Observe os logs no console do servidor
- Verifique se NVENC foi usado ou houve fallback

3. **Logs importantes:**
```
Tentando conversão NVENC HEVC...
Comando NVENC HEVC iniciado: ffmpeg -i input.mp4 -c:v hevc_nvenc ...
Progresso NVENC: 50%
Conversão NVENC HEVC concluída com sucesso
```

4. **Progresso em tempo real:**
- O progresso agora é real, não simulado
- Atualização via Server-Sent Events
- Status detalhado: "preparando", "conversão NVENC", "conversão CPU", "finalizando"
- Porcentagem precisa baseada no FFmpeg

## 🏆 Vantagens da Nova Configuração

- ✅ **Sem limitação de tamanho de arquivo**
- ✅ **Conversão GPU ultra-rápida**
- ✅ **Progresso real em tempo real**
- ✅ **Fallback automático robusto**
- ✅ **Parâmetros otimizados para qualidade/tamanho**
- ✅ **Preservação completa de áudio e legendas**
- ✅ **Metadados organizados em português**
- ✅ **Server-Sent Events para acompanhamento**
