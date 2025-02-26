// OpenAI Service - Serviço para interação com a API da OpenAI
window.OpenAIService = {

    // Testa a conexão com a API da OpenAI
    async testConnection(apiKey, model) {
        if (!apiKey) {
            return { success: false, error: 'API Key não fornecida' };
        }

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: 'Você é um assistente útil.' },
                        { role: 'user', content: 'Teste de conexão. Responda apenas com "OK" se você recebeu esta mensagem.' }
                    ],
                    max_tokens: 10
                })
            });

            const data = await response.json();

            if (response.ok) {
                return { success: true };
            } else {
                console.error('Erro na API da OpenAI:', data);
                return { success: false, error: data.error?.message || 'Erro desconhecido na API' };
            }
        } catch (error) {
            console.error('Erro na conexão com a API:', error);
            return { success: false, error: error.message };
        }
    },

    // Análise de comentários para uma categoria específica
    async analyzeCommentsForCategory(comments, categoryId, apiKey, model) {
        if (!comments || comments.length === 0) {
            return { result: 'Nenhum comentário para analisar' };
        }

        if (!apiKey) {
            return { result: 'API Key não configurada' };
        }

        // Preparar os comentários no formato para análise
        const commentsText = comments.map(comment => {
            let text = `- "${comment.text}" (${comment.author}, Likes: ${comment.likes || 0})`;

            // Incluir respostas se existirem
            if (comment.replies && comment.replies.length > 0) {
                const replies = comment.replies.map(reply =>
                    `  - Resposta: "${reply.text}" (${reply.author})`
                ).join('\n');
                text += '\n' + replies;
            }

            return text;
        }).join('\n\n');

        // Limitar os comentários para não exceder o limite de tokens
        const maxChars = 15000;
        const truncatedComments = commentsText.length > maxChars
            ? commentsText.substring(0, maxChars) + '...\n[Comentários truncados devido ao limite de tamanho]'
            : commentsText;

        // Obter o prompt específico para a categoria
        const prompt = this.getPromptForCategory(categoryId, truncatedComments);

        try {
            console.log(`Enviando ${comments.length} comentários para análise na categoria ${categoryId}`);

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: prompt.system },
                        { role: 'user', content: prompt.user }
                    ],
                    temperature: 0.5,
                    max_tokens: 1000
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Erro na API da OpenAI:', data);
                return {
                    result: `Erro na análise: ${data.error?.message || 'Erro desconhecido'}`
                };
            }

            // Processar a resposta da API
            const aiResponse = data.choices[0]?.message?.content;

            if (!aiResponse) {
                return { result: 'A API retornou uma resposta vazia' };
            }

            // Se a categoria for "summary", podemos retornar o texto diretamente
            if (categoryId === 'summary') {
                return { result: aiResponse };
            }

            // Para outras categorias, tentar extrair o JSON da resposta
            try {
                // Tenta encontrar o JSON na resposta (pode estar entre ```json e ```)
                let jsonMatch = aiResponse.match(/```json\s*(\{.*?\})\s*```/s);

                if (jsonMatch) {
                    const jsonResponse = JSON.parse(jsonMatch[1]);
                    return jsonResponse;
                }

                // Se não encontrou JSON formatado, verificar se toda a resposta é um JSON
                if (aiResponse.trim().startsWith('{') && aiResponse.trim().endsWith('}')) {
                    const jsonResponse = JSON.parse(aiResponse);
                    return jsonResponse;
                }

                // Se não conseguiu extrair JSON, retorna o texto completo
                return { result: aiResponse };
            } catch (parseError) {
                console.error('Erro ao processar resposta da AI:', parseError);
                console.log('Resposta original:', aiResponse);

                // Fornecer um resultado de fallback
                return {
                    result: aiResponse || 'Não foi possível processar a resposta da IA. Formato incorreto.'
                };
            }
        } catch (error) {
            console.error('Erro na comunicação com a API:', error);
            return {
                result: `Erro na análise: ${error.message}`
            };
        }
    },

    // Obtém o prompt específico para cada categoria
    getPromptForCategory(categoryId, commentText) {
        const baseSystemPrompt = 'Você é um analista especializado em avaliar feedback de usuários em vídeos do YouTube. ' +
            'Sua tarefa é analisar os comentários fornecidos e extrair insights relevantes.';

        let categorySystemPrompt = '';
        let categoryUserPrompt = '';

        switch (categoryId) {
            case 'summary':
                categorySystemPrompt = 'Analise todos os comentários e forneça um resumo geral abrangente.';
                categoryUserPrompt = `Por favor, analise os seguintes comentários de um vídeo do YouTube e forneça um resumo geral:\n\n${commentText}\n\nIncorpore em seu resumo os principais temas discutidos, a opinião geral da audiência, pontos de interesse específicos mencionados, e quaisquer sugestões relevantes.`;
                break;

            case 'satisfaction':
                categorySystemPrompt = 'Analise os comentários relacionados à satisfação ou insatisfação dos usuários.';
                categoryUserPrompt = `Analise estes comentários que expressam satisfação ou insatisfação sobre o vídeo:\n\n${commentText}\n\nForneca uma análise detalhada da satisfação dos usuários, identificando pontos positivos e negativos, o sentimento geral e recomendações baseadas nas opiniões.`;
                break;

            case 'extraInfo':
                categorySystemPrompt = 'Analise os comentários que trazem informações adicionais ou complementares ao vídeo.';
                categoryUserPrompt = `Analise estes comentários que contêm informações adicionais relacionadas ao vídeo:\n\n${commentText}\n\nIdentifique e organize as informações adicionais relevantes fornecidas pelos usuários que complementam o conteúdo do vídeo.`;
                break;

            case 'suggestions':
                categorySystemPrompt = 'Analise os comentários que contêm sugestões e pedidos da audiência.';
                categoryUserPrompt = `Analise estes comentários que contêm sugestões ou pedidos:\n\n${commentText}\n\nIdentifique as principais sugestões e pedidos da audiência, organizando-os por relevância e frequência.`;
                break;

            default:
                categorySystemPrompt = 'Analise os comentários e forneça insights relevantes.';
                categoryUserPrompt = `Analise os seguintes comentários de um vídeo do YouTube:\n\n${commentText}\n\nForneça uma análise detalhada dos temas principais discutidos.`;
        }

        return {
            system: baseSystemPrompt + ' ' + categorySystemPrompt + ' Por favor, forneça sua análise em português do Brasil.',
            user: categoryUserPrompt
        };
    },

    // Função legada para retrocompatibilidade
    analyzeComments(comments, apiKey, model) {
        return this.analyzeCommentsForCategory(comments, 'summary', apiKey, model);
    }
};

// Configuração do serviço
window.ConfigService = {
    getAvailableModels() {
        return [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Recomendado)' },
            { id: 'gpt-4o', name: 'GPT-4o (Mais potente)' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Mais rápido)' },
            { id: 'gpt-4', name: 'GPT-4 (Mais preciso)' },
            { id: 'o1-mini', name: 'Claude 3 Opus Mini' },
            { id: 'o3-mini', name: 'Claude 3 Sonnet Mini' }
        ];
    },

    getDefaultModel() {
        return 'gpt-4o-mini';
    }
}; 