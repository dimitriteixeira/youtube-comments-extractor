# YouTube Comments Extractor

Uma extensão para Microsoft Edge que extrai e analisa comentários de vídeos do YouTube utilizando inteligência artificial avançada.

## Visão Geral

O YouTube Comments Extractor traz uma solução completa para criadores de conteúdo e pesquisadores que precisam analisar o feedback da audiência. Utilizando modelos avançados de IA, nossa extensão extrai todos os comentários disponíveis de um vídeo e apresenta análises detalhadas e insights valiosos sobre o conteúdo.

![Versão Atual](https://img.shields.io/badge/Versão-1.2.2-red)

## Funcionalidades Principais

### Extração e Análise

- ✅ **Extração Completa**: Captura todos os comentários e respostas disponíveis, superando a limitação de apenas 20 comentários da interface padrão do YouTube
- ✅ **Processamento com IA**: Utiliza modelos GPT-4o Mini e GPT-4o para análise avançada do texto
- ✅ **Salvamento Local**: Armazena as análises no navegador para acesso posterior sem precisar refazer a extração

### Análise Inteligente

- ✅ **Sentimento da Audiência**: Classifica o feedback como Positivo, Negativo ou Misto com indicador visual
- ✅ **Pontuação do Conteúdo**: Atribui nota de 0 a 10 para o vídeo baseada na satisfação do público
- ✅ **Pontos Fortes e Fracos**: Identifica os aspectos positivos e negativos mais mencionados
- ✅ **Informações Adicionais**: Destaca informações complementares compartilhadas pelos usuários
- ✅ **Sugestões da Audiência**: Coleta sugestões e pedidos dos espectadores para futuros conteúdos

### Interface e Usabilidade

- ✅ **Design Responsivo**: Interface moderna e intuitiva com feedback visual para todas as ações
- ✅ **Acesso Rápido**: Botão flutuante para acessar análises já realizadas diretamente na página do vídeo
- ✅ **Sistema de Abas**: Organiza os diferentes tipos de análise em categorias de fácil navegação
- ✅ **Estado Persistente**: Mantém o progresso da extração mesmo se o popup for fechado acidentalmente
- ✅ **Comentários de Exemplo**: Exibe os comentários mais relevantes para cada insight da análise

## Capturas de Tela

_Adicione capturas de tela da sua extensão aqui (recomendamos 3-4 imagens demonstrando as principais funcionalidades)_

## Requisitos

Para utilizar a análise com IA, você precisará:

1. Chave da API da OpenAI (obtenha em [platform.openai.com](https://platform.openai.com/))
2. Conta na OpenAI com créditos disponíveis para uso da API

## Instalação

### Como usuário (Microsoft Edge)

1. Acesse a Microsoft Store e busque por "YouTube Comments Extractor"
2. Clique em "Obter" para instalar a extensão
3. Após instalada, clique no ícone na barra de ferramentas para começar a usar

### Como desenvolvedor

1. Clone ou baixe este repositório para seu computador
2. Abra o Microsoft Edge e navegue até `edge://extensions/`
3. Ative o "Modo de desenvolvedor" no canto superior direito
4. Clique em "Carregar sem pacote"
5. Selecione a pasta onde este repositório foi baixado

## Guia Rápido de Uso

1. **Configuração Inicial**

   - Clique no ícone da extensão na barra de ferramentas
   - Acesse o painel de configurações (ícone ⚙️)
   - Insira sua chave da API da OpenAI e salve
   - Selecione o modelo desejado (recomendamos GPT-4o Mini para melhor custo-benefício)
   - Defina o número máximo de comentários (quanto mais, melhor a análise)

2. **Extraindo Comentários**

   - Navegue até um vídeo do YouTube
   - Clique no ícone da extensão
   - Pressione o botão "Extrair e Analisar Comentários"
   - Aguarde o processo de extração e análise ser concluído

3. **Explorando os Resultados**

   - Navegue pelas abas para visualizar diferentes aspectos da análise:
     - **Resumo**: Visão geral e tendências principais dos comentários
     - **Satisfação**: Análise do sentimento, pontuação e pontos positivos/negativos
     - **Informações Extras**: Dados adicionais compartilhados nos comentários
     - **Sugestões**: Ideias e pedidos da audiência para futuros conteúdos
     - **Comentários**: Lista completa dos comentários extraídos

4. **Acessando Análises Salvas**
   - Ao retornar a um vídeo já analisado, um botão flutuante "Análise de Comentários" estará disponível
   - Clique no botão para visualizar a análise anterior sem necessidade de nova extração

## Limitações Atuais

- A análise detalhada com IA é aplicada aos primeiros 100 comentários por padrão (ajustável até 1000)
- Vídeos com comentários desativados não são compatíveis com a extensão
- A qualidade da análise depende diretamente da quantidade e relevância dos comentários
- É necessária uma chave válida da API OpenAI para utilizar os recursos de análise

## Tecnologias Utilizadas

- JavaScript (Vanilla)
- HTML5/CSS3
- APIs do Chrome/Edge Extension
- API OpenAI (GPT-4o Mini e GPT-4o)

## Privacidade e Segurança

Esta extensão processa todos os dados localmente em seu navegador, com exceção dos comentários enviados para a API da OpenAI para análise. Nenhum dado é armazenado permanentemente em servidores externos. Sua chave de API é armazenada apenas localmente no seu dispositivo.

## Contribuição

Contribuições são bem-vindas! Se você encontrar um bug ou tiver uma sugestão de melhoria, sinta-se à vontade para:

1. Abrir uma issue descrevendo o problema ou sugestão
2. Enviar um pull request com suas alterações
3. Compartilhar feedback sobre a usabilidade da extensão

## Agradecimentos

Agradecemos a todos os usuários que contribuíram com feedback e sugestões para a melhoria contínua desta extensão.

## Histórico de Versões

| Versão | Principais Mudanças                                                                                                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.2.2  | • Correção de bugs na exibição dos ratings de satisfação<br>• Melhorias nos prompts para garantir formato consistente<br>• Adicionados fallbacks para diferentes formatos de resposta<br>• Sistema de logs aprimorado para diagnóstico                                               |
| 1.2.1  | • Adição de rating visual para satisfação (Positivo/Negativo/Misto)<br>• Implementação de pontuação de 0-10 para conteúdo<br>• Organização visual de pontos positivos e negativos<br>• Novo layout moderno para a aba de satisfação                                                  |
| 1.2.0  | • Correção de bugs na extração de respostas aos comentários<br>• Simplificação da lista de modelos para GPT-4o Mini e GPT-4o<br>• Detecção aprimorada de sugestões nos comentários<br>• Extração de sugestões do resumo geral<br>• Prompts mais detalhados para análise de sugestões |
| 1.1.9  | • Revertidas alterações estéticas para garantir compatibilidade                                                                                                                                                                                                                      |
| 1.1.8  | • Navegação melhorada com botão flutuante contextual<br>• Validação em tempo real durante navegação<br>• Interface mais limpa entre diferentes vídeos                                                                                                                                |
| 1.1.7  | • Fluxo de trabalho otimizado para análises salvas<br>• Validação aprimorada das análises<br>• Experiência de usuário mais intuitiva                                                                                                                                                 |
| 1.1.6  | • Correção do comportamento do botão flutuante<br>• Validação mais rigorosa das análises salvas                                                                                                                                                                                      |
| 1.1.5  | • Correção de erro crítico "Extension context invalidated"<br>• Melhorias no tratamento de erros                                                                                                                                                                                     |
| 1.1.4  | • Salvamento de comentários relevantes por categoria<br>• Menções a usuários clicáveis nas análises                                                                                                                                                                                  |
| 1.1.3  | • Persistência do estado de extração<br>• Melhorias na interface e feedback visual                                                                                                                                                                                                   |

---

© 2023 YouTube Comments Extractor. Todos os direitos reservados.
