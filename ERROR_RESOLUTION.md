# Resolução do Erro "Internal Server Error"

## 🔍 Diagnóstico do Problema

O erro `Error: Erro na conversão: Internal Server Error` indica que a API backend não conseguiu processar a conversão. Isso geralmente acontece por uma das seguintes razões:

### 1. Dependências Faltando
A API backend precisa do `fluent-ffmpeg` instalado:

```bash
npm install fluent-ffmpeg
npm install -D @types/fluent-ffmpeg
```

### 2. FFmpeg Não Instalado no Sistema
O `fluent-ffmpeg` é apenas um wrapper - você precisa do FFmpeg real instalado:

**Windows:**
1. Baixe FFmpeg de https://ffmpeg.org/download.html
2. Extraia para `C:\ffmpeg`
3. Adicione `C:\ffmpeg\bin` ao PATH do sistema
4. Reinicie o terminal/VS Code

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

### 3. Verificar Instalação
Teste se o FFmpeg está funcionando:
```bash
ffmpeg -version
```

## 🚀 Soluções Alternativas

### Opção 1: Usar Apenas FFmpeg.wasm (Recomendado)
Se você quer evitar configurar FFmpeg no servidor, use apenas a conversão no navegador:

1. **Modifique o código para forçar FFmpeg.wasm:**

```typescript
// No DragDrop.tsx, na função convertToMKV, substitua:
if (typeof window !== 'undefined' && window.FFmpeg) {
  await convertWithFFmpegWasm(video, individualTimer, videoStartTime, getIndividualElapsedTime)
} else {
  // Forçar erro para sempre usar FFmpeg.wasm
  throw new Error('API backend não está disponível. Usando FFmpeg.wasm.')
}
```

### Opção 2: Instalar Dependências Necessárias
Se você quer usar a API backend:

```bash
# Instalar fluent-ffmpeg
npm install fluent-ffmpeg @types/fluent-ffmpeg

# Instalar FFmpeg no sistema (Windows)
# Baixar de https://ffmpeg.org/download.html e adicionar ao PATH

# Ou usar chocolatey (Windows)
choco install ffmpeg

# Verificar instalação
ffmpeg -version
node -e "console.log(require('fluent-ffmpeg'))"
```

### Opção 3: Desabilitar API Backend
Para usar apenas FFmpeg.wasm, você pode modificar a lógica:

```typescript
// Sempre usar FFmpeg.wasm
if (typeof window !== 'undefined') {
  if (window.FFmpeg) {
    await convertWithFFmpegWasm(video, individualTimer, videoStartTime, getIndividualElapsedTime)
  } else {
    throw new Error('FFmpeg.wasm não está carregado. Recarregue a página.')
  }
} else {
  throw new Error('Conversão só funciona no navegador.')
}
```

## 🛠️ Debug da API

Para ver exatamente qual é o erro, abra o console do servidor de desenvolvimento (`npm run dev`) e teste uma conversão. Você verá logs detalhados como:

```
fluent-ffmpeg não encontrado: Error: Cannot find module 'fluent-ffmpeg'
```

ou

```
Erro na conversão FFmpeg: Error: spawn ffmpeg ENOENT
```

## 📋 Status Atual do Código

✅ **Melhorias Implementadas:**
- Mensagens de erro mais detalhadas
- Verificação se fluent-ffmpeg está instalado
- Limite de tamanho de arquivo (100MB)
- Timeout de conversão (10 minutos)
- Limpeza automática de arquivos temporários
- Logs detalhados para debug

✅ **Código do Frontend Corrigido:**
- Botão de conversão funcionando
- Tratamento de erro aprimorado
- Mensagens claras para o usuário

## 🎯 Recomendação

**Para uso imediato:** Use apenas FFmpeg.wasm modificando a lógica para não tentar a API backend.

**Para produção:** Configure FFmpeg no servidor se você precisar de conversões mais rápidas e eficientes.

## 🔧 Próximos Passos

1. **Teste FFmpeg.wasm primeiro:**
   - Recarregue a página
   - Teste com um arquivo pequeno (< 10MB)
   - Verifique se `window.FFmpeg` está disponível no console

2. **Se quiser usar API:**
   - Instale as dependências
   - Configure FFmpeg no sistema
   - Teste novamente

3. **Verifique logs:**
   - Console do navegador (F12)
   - Terminal do servidor (`npm run dev`)
   - Network tab para ver requisições da API
