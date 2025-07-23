# Conversor de Vídeos OCFlix

Uma aplicação Next.js moderna para conversão de vídeos para formato MKV com codec HEVC (H.265).

## ✨ Características

- 🎬 **Conversão de Vídeo**: Converte vários formatos para MKV com codec HEVC
- 📁 **File System Access API**: Permite escolher o local de salvamento (navegadores compatíveis)
- 🖱️ **Drag & Drop**: Interface intuitiva para adicionar arquivos
- ⚡ **Múltiplas Opções**: FFmpeg.wasm (cliente) ou API backend
- 📊 **Progresso em Tempo Real**: Acompanhe o progresso das conversões
- 🎨 **Interface Moderna**: Built with Next.js 14 e Tailwind CSS
- 📱 **Responsivo**: Funciona bem em desktop e mobile

## 🚀 Tecnologias

- **Next.js 14** - Framework React
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **Shadcn/ui** - Componentes UI
- **File System Access API** - Acesso nativo ao sistema de arquivos
- **FFmpeg.wasm** - Conversão no navegador
- **Lucide React** - Ícones

## 📦 Instalação

1. **Clone o repositório**
```bash
git clone <repo-url>
cd convert-videos-snake
```

2. **Instale as dependências**
```bash
npm install
```

3. **Execute em modo desenvolvimento**
```bash
npm run dev
```

## 🔧 Opções de Conversão

### 1. FFmpeg.wasm (Padrão)
- ✅ Funciona completamente no navegador
- ✅ Privacidade total (arquivos não saem do dispositivo)
- ✅ Não requer servidor backend
- ⚠️ Pode ser mais lento para arquivos grandes

### 2. API Backend
Para usar a conversão via servidor, instale as dependências adicionais:

```bash
npm install fluent-ffmpeg
npm install -D @types/fluent-ffmpeg
```

E instale o FFmpeg no sistema:
- **Windows**: Download do [ffmpeg.org](https://ffmpeg.org/download.html)
- **macOS**: `brew install ffmpeg`
- **Ubuntu**: `sudo apt install ffmpeg`

## 📖 Como Usar

1. **Adicionar Vídeos**: Arraste arquivos ou clique em "Selecionar Arquivos"
2. **Configurar Saída**: Escolha o diretório de destino (se suportado)
3. **Converter**: Selecione vídeos e clique em "Comprimir Selecionados"
4. **Download**: Os arquivos convertidos serão baixados automaticamente

## 🎯 Formatos Suportados

**Entrada**: MP4, AVI, MOV, MKV, WMV, FLV, WEBM, M4V, MPG, MPEG, 3GP, OGV, TS, MTS, M2TS, F4V

**Saída**: MKV com codec HEVC (H.265)

## 🌐 Compatibilidade do Navegador

| Funcionalidade | Chrome | Firefox | Safari | Edge |
|----------------|--------|---------|--------|------|
| Conversão FFmpeg.wasm | ✅ | ✅ | ✅ | ✅ |
| File System Access API | ✅ | ❌ | ❌ | ✅ |
| Download Automático | ✅ | ✅ | ✅ | ✅ |

*Para navegadores sem File System Access API, os arquivos são baixados para a pasta padrão de downloads.*

## 🔨 Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento
npm run build        # Build para produção
npm run start        # Executar build de produção
npm run lint         # Verificar código
npm run type-check   # Verificar tipos TypeScript
```

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── api/convert-video/    # API de conversão (opcional)
│   ├── globals.css           # Estilos globais
│   ├── layout.tsx           # Layout principal
│   └── page.tsx             # Página inicial
├── components/
│   ├── ui/                  # Componentes Shadcn/ui
│   └── DragDrop.tsx         # Componente principal
├── lib/
│   └── utils.ts             # Utilitários
└── utils/
    └── generateContentText.ts # Geração de texto promocional
```

## ⚙️ Configuração

A aplicação funciona out-of-the-box com FFmpeg.wasm. Para conversão via API:

1. Configure os caminhos do FFmpeg em `src/app/api/convert-video/route.ts`
2. Ajuste as configurações de conversão conforme necessário

## 🐛 Solução de Problemas

**FFmpeg.wasm não carrega**: Verifique se os scripts estão sendo carregados corretamente no layout.tsx

**File System Access API não funciona**: Esta API só funciona em navegadores baseados em Chromium (Chrome, Edge)

**Conversão lenta**: FFmpeg.wasm é mais lento que a versão nativa. Para melhor performance, use a API backend

**Erro na conversão**: Verifique se o arquivo de vídeo não está corrompido e se o formato é suportado

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no repositório do projeto.
# conversor-videos-next
