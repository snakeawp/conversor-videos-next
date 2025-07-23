interface GenerateContentParams {
  contentType: string
  contentName: string
  availableLanguages?: string
}

interface GenerateContentResponse {
  success: boolean
  generatedText?: string
  error?: string
}

export async function generateContentText({
  contentType,
  contentName,
  availableLanguages
}: GenerateContentParams): Promise<GenerateContentResponse> {
  try {
    // console.log('Início da geração de texto promocional')
    // console.log('Dados recebidos:', { contentType, contentName, availableLanguages })

    if (!contentType || !contentName) {
      return {
        success: false,
        error: 'Tipo de conteúdo e nome são obrigatórios'
      }
    }

    const prompt = `
    Crie um texto promocional seguindo o padrão específico para ${contentType === 'serie' ? 'a série' : contentType === 'filme' ? 'o filme' : contentType === 'desenho' ? 'o desenho' : contentType === 'anime' ? 'o anime' : 'o show'} "${contentName}".

    IMPORTANTE: Vá direto ao texto promocional. NÃO inclua introduções como "Aqui está o texto", "Desafio aceito", ou explicações. Comece IMEDIATAMENTE com o emoji 🎬.

    🎬 PADRÃO OBRIGATÓRIO PARA NOTAS DE LANÇAMENTO:

    Formato direto, objetivo, organizado e com impacto.
    Nunca inclua ficha técnica extensa, elenco ou prêmios.

    Dados obrigatórios:

    🎥 ${contentName} (com o ano, se houver mais de uma versão)

    📅 Ano de lançamento: [busque informações reais sobre o ano]

    🗣 Idiomas disponíveis: ${availableLanguages || 'Dublado e Legendado'}

    📝 Sinopse: curta, sem spoilers, chamativa e de impacto

    🎯 Texto de impacto/chamada: criativo, divertido ou intrigante

    🔗 Link do trailer no YouTube (sempre que possível): [se houver um trailer oficial no YouTube, inclua o link exposto]

    📌 DIRETRIZES:
    - Respostas visualmente organizadas, diretas, com criatividade
    - Use informações reais e precisas sobre a obra
    - Mantenha clareza e impacto
    - Sinopse deve ser envolvente sem revelar spoilers
    - Texto de impacto deve ser memorable e criativo
    `

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `Você é um especialista em entretenimento que cria textos promocionais seguindo padrões específicos para OCFlix. 

SEMPRE siga o padrão estabelecido automaticamente, sem confirmações:

🎬 PADRÃO PARA NOTAS DE LANÇAMENTO (Filmes, Séries, Animes, Desenhos):
- Formato direto, objetivo, organizado e com impacto
- Nunca inclua ficha técnica extensa, elenco ou prêmios
- Use informações reais e precisas sobre as obras
- Respostas visualmente organizadas, diretas, com criatividade e toques de impacto
- Sinopse curta, sem spoilers, chamativa
- Texto de impacto criativo, divertido ou intrigante
- Inclua link do trailer quando possível

${prompt}`
            }
          ]
        }
      ]
    }

    // console.log('Fazendo requisição para Gemini...')

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': 'AIzaSyCWJmbBWxEpoB28nRKmUvyuN0qBkGftFrg'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Erro da API do Gemini:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      return {
        success: false,
        error: `Erro na API do Gemini: ${response.status} ${response.statusText} - ${errorText}`
      }
    }

    const responseText = await response.text()
    // console.log('Resposta bruta do Gemini (primeiros 200 chars):', responseText.substring(0, 200))
    
    // Verificar se a resposta é HTML (página de erro)
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      console.error('Recebeu HTML em vez de JSON:', responseText)
      return {
        success: false,
        error: 'API do Gemini retornou HTML em vez de JSON - possível problema de autenticação ou URL'
      }
    }
    
    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta:', parseError)
      console.error('Resposta recebida:', responseText.substring(0, 500))
      return {
        success: false,
        error: 'Resposta inválida da API do Gemini - não é um JSON válido'
      }
    }
    
    // console.log('Dados parseados do Gemini:', JSON.stringify(data, null, 2))
    
    let generatedContent = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Erro ao gerar conteúdo'
    
    // console.log('Texto extraído do Gemini (antes da limpeza):', generatedContent)
    
    // Remover introduções indesejadas e ir direto ao conteúdo promocional
    const unwantedIntros = [
      /^.*?Aqui está.*?:/i,
      /^.*?Desafio aceito.*?:/i,
      /^.*?Perfeito.*?:/i,
      /^.*?Claro.*?:/i,
      /^.*?Vou criar.*?:/i,
      /^.*?Segue.*?:/i,
      /^.*?Eis.*?:/i
    ]
    
    for (const pattern of unwantedIntros) {
      generatedContent = generatedContent.replace(pattern, '').trim()
    }
    
    // Limpar links - remover colchetes e parênteses dos links
    // Padrão: 🔗 Trailer oficial: [https://...] ou 🔗 Link: (https://...)
    generatedContent = generatedContent.replace(/🔗\s*[^:]*:\s*\[([^\]]+)\]/g, '🔗 Trailer oficial: $1')
    generatedContent = generatedContent.replace(/🔗\s*[^:]*:\s*\(([^)]+)\)/g, '🔗 Trailer oficial: $1')
    
    // Remover links duplicados - padrão: https://....(https://...)
    generatedContent = generatedContent.replace(/(https:\/\/[^\s\)]+)\(https:\/\/[^\)]+\)/g, '$1')
    
    // Remover links duplicados - padrão: https://....[https://...]
    generatedContent = generatedContent.replace(/(https:\/\/[^\s\]]+)\[https:\/\/[^\]]+\]/g, '$1')
    
    // Garantir que comece com emoji se não começar
    if (!generatedContent.startsWith('🎬')) {
      const emojiIndex = generatedContent.indexOf('🎬')
      if (emojiIndex > 0) {
        generatedContent = generatedContent.substring(emojiIndex)
      }
    }
    
    // console.log('Texto final após limpeza:', generatedContent)
    
    return {
      success: true,
      generatedText: generatedContent
    }

  } catch (error) {
    console.error('Erro ao gerar texto promocional:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }
  }
}
