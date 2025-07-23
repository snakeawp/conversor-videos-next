# Como Testar a Aplicação

## 🧪 Testando Localmente

1. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

2. **Acesse a aplicação**
Abra [http://localhost:3000](http://localhost:3000) no seu navegador

3. **Teste o Drag & Drop**
- Arraste um arquivo de vídeo para a área de drop
- Ou clique em "Selecionar Arquivos" para escolher manualmente

4. **Teste a Seleção de Diretório**
- No Chrome/Edge: Clique em "Alterar" na seção de configurações
- Escolha um diretório personalizado para salvar os vídeos convertidos

5. **Teste a Conversão**
- Selecione um ou mais vídeos
- Clique em "Comprimir Selecionados"
- Aguarde o processo de conversão

## 🔍 Verificando Funcionalidades

### File System Access API
```javascript
// No console do navegador, teste se a API está disponível:
console.log('showDirectoryPicker:', typeof window.showDirectoryPicker)
console.log('showSaveFilePicker:', typeof window.showSaveFilePicker)
```

### FFmpeg.wasm
```javascript
// No console do navegador, teste se FFmpeg está carregado:
console.log('FFmpeg disponível:', typeof window.FFmpeg)
```

## 📝 Cases de Teste

### Teste 1: Upload de Arquivo Único
1. Faça upload de um arquivo MP4 pequeno (< 10MB)
2. Verifique se as informações são exibidas corretamente
3. Converta o arquivo
4. Verifique se o download acontece automaticamente

### Teste 2: Upload Múltiplo
1. Selecione múltiplos arquivos de vídeo
2. Teste "Selecionar Todos"
3. Teste "Comprimir Selecionados"
4. Verifique se todos os arquivos são processados

### Teste 3: Drag & Drop
1. Arraste arquivos do explorer para a área de drop
2. Verifique se arquivos não-vídeo são rejeitados
3. Teste com diferentes formatos de vídeo

### Teste 4: Diretório Personalizado (Chrome/Edge)
1. Clique em "Alterar" nas configurações
2. Selecione um diretório personalizado
3. Para cada vídeo, clique em "Escolher diretório personalizado"
4. Converta e verifique se salva no local correto

### Teste 5: Geração de Texto Promocional
1. Preencha os campos no painel lateral
2. Clique em "Gerar Texto Promocional"
3. Teste o botão "Copiar"

## 🐛 Debugging

### Logs Importantes
Abra o console do navegador (F12) para ver:
- Logs de conversão do FFmpeg
- Erros de File System Access API
- Status das operações de arquivo

### Mensagens de Erro Comuns

**"FFmpeg.wasm não está disponível"**
- Verifique se os scripts estão carregando no layout.tsx
- Teste em um navegador diferente

**"Seu navegador não suporta seleção de diretórios"**
- Normal em Firefox/Safari
- Use Chrome ou Edge para funcionalidade completa

**"Arquivo não encontrado"**
- Verifique se o arquivo não foi movido/deletado
- Tente fazer upload novamente

## 📊 Métricas de Performance

### Tempos Esperados (FFmpeg.wasm)
- Arquivo 10MB: ~30-60 segundos
- Arquivo 50MB: ~2-5 minutos
- Arquivo 100MB+: ~5-15 minutos

### Uso de Memória
- FFmpeg.wasm pode usar 200-500MB de RAM
- Monitore o uso de memória no DevTools

## 🔧 Configurações de Teste

### Arquivos de Teste Recomendados
- **Pequeno**: MP4 de 5-10MB
- **Médio**: AVI de 50-100MB  
- **Formatos**: MP4, AVI, MOV, MKV
- **Resolução**: 720p a 1080p

### Navegadores para Teste
1. **Chrome** (funcionalidade completa)
2. **Edge** (funcionalidade completa)
3. **Firefox** (sem File System Access API)
4. **Safari** (sem File System Access API)

## 📱 Teste Mobile

1. Acesse pelo celular/tablet
2. Teste upload de vídeos da galeria
3. Verifique responsividade da interface
4. Note que File System Access API não funciona em mobile
