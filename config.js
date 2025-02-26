// Configurações para a extensão YouTube Comments Extractor
const config = {
  // IMPORTANTE: Substitua pela sua chave da API OpenAI
  openaiApiKey: "sua-chave-api-aqui",

  // Configurações de modelos disponíveis
  models: [
    {
      id: "gpt-4o-mini",
      name: "GPT-4o-mini",
      description: "Modelo mais rápido e eficiente para análises de rotina",
      tokenLimit: 4096,
      defaultModel: true
    },
    {
      id: "gpt-4o",
      name: "GPT-4o",
      description: "Versão completa do GPT-4o com alta capacidade de análise",
      tokenLimit: 8192,
      defaultModel: false
    },
    {
      id: "o1-mini",
      name: "O1-mini",
      description: "Modelo avançado com capacidades multimodais",
      tokenLimit: 4096,
      defaultModel: false
    },
    {
      id: "o3-mini",
      name: "O3-mini",
      description: "Último modelo da série O3 com análise avançada",
      tokenLimit: 8192,
      defaultModel: false
    },
    {
      id: "gpt-3.5-turbo",
      name: "GPT-3.5 Turbo",
      description: "Bom equilíbrio entre desempenho e custo",
      tokenLimit: 4096,
      defaultModel: false
    },
    {
      id: "gpt-4",
      name: "GPT-4",
      description: "Modelo mais avançado para análises detalhadas (mais caro)",
      tokenLimit: 8192,
      defaultModel: false
    }
  ],

  // Configurações de extração
  extraction: {
    maxComments: 500, // Limite máximo de comentários a extrair
    scrollAttempts: 30, // Número de tentativas de rolagem para carregar mais comentários
    scrollDelay: 1500, // Tempo de espera entre rolagens (ms)
    expandReplies: true // Expandir respostas aos comentários
  },

  // Prompt base para análise de comentários
  promptTemplates: {
    baseAnalysis: `
Analise os comentários do YouTube abaixo e forneça insights sobre:
1. Satisfação geral do público com o conteúdo
2. Informações extras relevantes mencionadas nos comentários
3. Sugestões de assuntos relacionados feitas pelo público
4. Um resumo geral do feedback

Para cada categoria, forneça também exemplos de comentários específicos que suportam suas conclusões.
Responda em formato JSON com as seguintes chaves:
{
  "summary": "resumo geral em texto",
  "satisfaction": {
    "analysis": "análise de satisfação",
    "score": número entre 0 e 100
  },
  "extraInfo": [
    {
      "category": "nome da categoria de informação",
      "items": ["item1", "item2", "..."],
      "supportingComments": [{"author": "nome", "text": "texto", "index": número}]
    },
    ...
  ],
  "suggestions": [
    {
      "title": "título da sugestão",
      "description": "descrição da sugestão",
      "supportingComments": [{"author": "nome", "text": "texto", "index": número}]
    },
    ...
  ]
}

COMENTÁRIOS DO YOUTUBE:
`
  }
};

// Não altere este trecho - usado para exportar a configuração
if (typeof module !== 'undefined') {
  module.exports = config;
} else {
  // No ambiente de extensão, coloca o config no objeto window
  window.config = config;
} 