# YouTube Comments Extractor

Uma extensão para Microsoft Edge que extrai e analisa comentários de vídeos do YouTube utilizando inteligência artificial.

## Funcionalidades

- **Extração otimizada**: Extrai todos os comentários e respostas do vídeo, não apenas os primeiros 20
- **Análise com IA**: Utiliza modelos de linguagem avançados (GPT-4o-mini, GPT-3.5-Turbo ou GPT-4) para analisar o conteúdo
- **Personalização**: Permite selecionar o modelo de IA e configurar o número máximo de comentários
- **Análise detalhada**: Identifica padrões, informações extra, sugestões e nível de satisfação
- **Comentários de suporte**: Mostra exemplos concretos que fundamentam cada insight extraído
- **Estado persistente**: Mantém o estado da extração mesmo se o popup for fechado e reaberto
- **Interface aprimorada**: Design moderno e intuitivo com feedback visual para ações
- **Comentários salvos**: Mantém os comentários mais relevantes para visualização posterior

## O que a extensão analisa

- Se o vídeo atendeu às expectativas do público
- Informações extras relevantes compartilhadas nos comentários, com detalhes e exemplos
- Sugestões de outros assuntos mencionados pelo público, com detalhes e exemplos
- Resumo geral do feedback

## Requisitos

Para usar a análise com IA, você precisará:

1. Chave da API da OpenAI (você pode obter uma em [platform.openai.com](https://platform.openai.com/))
2. Conta na OpenAI com créditos disponíveis para uso da API

## Como instalar

### Instalação como desenvolvedor

1. Clone ou baixe este repositório para seu computador
2. Abra o Microsoft Edge e navegue até `edge://extensions/`
3. Ative o "Modo de desenvolvedor" no canto inferior esquerdo
4. Clique em "Carregar sem pacote"
5. Selecione a pasta onde este repositório foi baixado

## Como configurar

1. Após instalar a extensão, clique no ícone na barra de ferramentas
2. Clique em "⚙️ Configurações da IA" para expandir o painel de configurações
3. Insira sua chave da API da OpenAI e clique em "Salvar"
4. Escolha o modelo de IA desejado:
   - **GPT-4o-mini**: Rápido e eficiente para análises rotineiras (recomendado)
   - **GPT-3.5-Turbo**: Bom equilíbrio entre desempenho e custo
   - **GPT-4**: Para análises mais detalhadas (mais caro)
5. Defina o número máximo de comentários a serem extraídos (100-1000)

## Como usar

1. Navegue até um vídeo do YouTube
2. Clique no ícone da extensão na barra de ferramentas
3. Clique no botão "Extrair Comentários"
4. Aguarde o processo de extração e análise ser concluído
5. Navegue pelas abas para visualizar os resultados:
   - **Resumo**: Visão geral dos comentários
   - **Satisfação**: Análise se o vídeo atendeu às expectativas
   - **Extras**: Informações adicionais mencionadas nos comentários
   - **Sugestões**: Tópicos sugeridos pelo público
   - **Comentários**: Lista completa dos comentários extraídos

## Novidades na versão 1.1.9

- Revertidas alterações estéticas para garantir compatibilidade em diferentes ambientes

## Novidades na versão 1.1.8

- **Navegação melhorada**: O botão flutuante agora desaparece automaticamente ao navegar para vídeos sem análise salva
- **Comportamento contextual**: O botão aparece apenas em páginas com análises válidas, funcionando como um verdadeiro histórico
- **Validação em tempo real**: Verificação constante durante a navegação para garantir a exibição correta do botão
- **Experiência mais limpa**: Interface mantém-se organizada ao navegar entre diferentes vídeos do YouTube

## Novidades na versão 1.1.7

- **Fluxo natural**: Removida a pergunta de recarga da página após salvar análise - o botão flutuante aparece automaticamente quando necessário
- **Validação aprimorada**: Verificação mais rigorosa das análises salvas para garantir que só mostrem o botão quando houver conteúdo válido
- **Experiência intuitiva**: Comportamento mais natural do botão flutuante, aparecendo somente quando há análise válida disponível
- **Mensagem clara**: Notificação simples após salvamento informando que o botão estará disponível ao retornar ao vídeo

## Novidades na versão 1.1.6

- **Correção do botão flutuante**: Botão "Análise de Comentários" agora só aparece quando existir análise válida para o vídeo
- **Validação aprimorada de análises**: Verificação mais rigorosa do conteúdo das análises salvas
- **Experiência mais consistente**: Comportamento previsível do botão flutuante em diferentes estados da extensão

## Novidades na versão 1.1.5

- **Correção de erro crítico**: Resolvido problema que causava "Extension context invalidated" ao clicar no botão flutuante após fechar o popup
- **Melhor tratamento de erros**: Adicionada verificação de contexto da extensão com mensagens claras para o usuário
- **Experiência melhorada**: Opção de recarregar a página automaticamente quando um erro de contexto é detectado

## Novidades na versão 1.1.4

- **Comentários em análises salvas**: Agora os comentários mais relevantes (até 20 por categoria) também são salvos e exibidos quando você recarrega uma análise anterior
- **Melhor contexto para análises**: Permite visualizar os comentários que embasaram cada categoria da análise mesmo após fechar a extensão
- **Menções clicáveis**: Todas as menções a usuários nos comentários salvos permanecem clicáveis

## Novidades na versão 1.1.3

- **Preservação do estado**: Agora a extensão mantém o estado da extração mesmo se o popup for fechado
- **Interface aprimorada**: Melhorias estéticas na área de configuração da API
- **Feedback visual**: Botões com efeitos visuais ao serem clicados
- **Simplificação**: Remoção de botões redundantes para uma experiência mais intuitiva
- **Correções de bugs**: Resolução de problemas relacionados à invalidação do contexto da extensão

## Limitações

- A análise com IA é limitada aos primeiros 100 comentários para evitar alta utilização da API
- Vídeos com comentários desativados não são compatíveis
- A qualidade da análise depende da quantidade e relevância dos comentários
- É necessária uma chave válida da API OpenAI para usar os recursos de IA

## Tecnologias Utilizadas

- JavaScript
- HTML/CSS
- APIs do Chrome/Edge Extension
- API OpenAI GPT-4o-mini, GPT-3.5-Turbo e GPT-4

## Privacidade

Esta extensão processa todos os dados localmente em seu navegador, exceto pelos comentários enviados para a API da OpenAI para análise. Nenhum dado é armazenado permanentemente nos servidores.

## Contribuição

Contribuições são bem-vindas! Se você encontrar um bug ou tiver uma sugestão de melhoria, sinta-se à vontade para abrir uma issue ou enviar um pull request.
