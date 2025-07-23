# Instruções para Conversão de Vídeo em Aplicação Next.js

## Opções de Implementação

Você tem 3 opções principais para implementar a conversão de vídeo em sua aplicação Next.js:

### 1. FFmpeg.wasm (Recomendado para Aplicações Web)

**Vantagens:**
- Funciona completamente no navegador
- Não requer servidor backend
- Privacidade total (arquivos não saem do dispositivo do usuário)
- Não requer instalação de FFmpeg no servidor

**Instalação:**
```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util
```

**Implementação:**
Carregue o FFmpeg.wasm na sua página principal:

```html
<!-- No seu layout.tsx ou page.tsx -->
<Script src="https://unpkg.com/@ffmpeg/ffmpeg@0.12.7/dist/umd/ffmpeg.js"></Script>
<Script src="https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js"></Script>
```

### 2. API Backend com FFmpeg (Para Servidores Próprios)

**Vantagens:**
- Processamento mais rápido
- Suporte completo a recursos avançados do FFmpeg
- Não consome recursos do dispositivo do usuário

**Instalação:**
```bash
npm install fluent-ffmpeg uuid
npm install -D @types/fluent-ffmpeg @types/uuid
```

**Configuração:**
- Instale FFmpeg no servidor
- Configure os caminhos no código da API

### 3. Serviços de Terceiros (CloudConvert, AWS MediaConvert, etc.)

**Vantagens:**
- Escalabilidade automática
- Sem necessidade de manter infraestrutura
- Suporte a muitos formatos

**Desvantagens:**
- Custo por conversão
- Latência de rede
- Questões de privacidade

## Estado Atual do Código

O código foi atualizado para:
- ✅ Remover todas as dependências do Electron
- ✅ Implementar File System Access API para seleção de diretórios
- ✅ Suporte a FFmpeg.wasm (requires instalação)
- ✅ Suporte a API backend (requires instalação de dependências)
- ✅ Sistema de download automático para navegadores sem File System Access API

## Próximos Passos

1. **Escolha sua abordagem preferida**
2. **Instale as dependências necessárias**
3. **Configure os scripts/serviços conforme necessário**
4. **Teste a funcionalidade**

## Limitações Atuais

- FFmpeg.wasm pode ser lento para arquivos grandes
- File System Access API não é suportada em todos os navegadores
- A API backend requer FFmpeg instalado no servidor

## Exemplo de Uso

A aplicação agora funciona como uma aplicação web pura:
1. Usuário arrasta/seleciona arquivos de vídeo
2. Escolhe diretório de saída (se suportado pelo navegador)
3. Inicia conversão
4. Arquivo é processado e baixado automaticamente
