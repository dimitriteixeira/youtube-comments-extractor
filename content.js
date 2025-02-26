// Notificar o background.js que o content script está pronto
console.log('Content script do YouTube Comments Extractor inicializado');
chrome.runtime.sendMessage({ action: 'contentScriptReady' }, function (response) {
    console.log('Background script respondeu:', response);
});

// Escutar mensagens do popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    // Responder a pings do background script
    if (request.action === 'ping') {
        console.log('Ping recebido');
        sendResponse({ status: 'active' });
        return true;
    }

    if (request.action === 'extractComments') {
        // Obter configurações
        const config = request.config || {
            extraction: {
                maxComments: 500,
                scrollAttempts: 30,
                scrollDelay: 1500,
                expandReplies: true
            }
        };

        // Notificar que o processo começou
        sendResponse({ status: 'started' });

        // Extrair comentários e enviar progresso
        extractYouTubeComments(config.extraction, (progress) => {
            // Enviar atualizações de progresso para o popup
            chrome.runtime.sendMessage({
                action: 'extractionProgress',
                progress: progress
            });
        })
            .then(comments => {
                chrome.runtime.sendMessage({
                    action: 'extractionComplete',
                    success: true,
                    comments: comments
                });
            })
            .catch(error => {
                console.error('Erro ao extrair comentários:', error);
                chrome.runtime.sendMessage({
                    action: 'extractionComplete',
                    success: false,
                    error: error.message
                });
            });

        // Retornamos true para manter o canal de mensagem aberto,
        // mas a resposta real será enviada via sendMessage
        return true;
    }
});

// Função principal para extrair comentários
async function extractYouTubeComments(extractionConfig, progressCallback) {
    // Configurações padrão se não forem recebidas
    const config = {
        maxComments: extractionConfig?.maxComments || 500,
        scrollAttempts: extractionConfig?.scrollAttempts || 30,
        scrollDelay: extractionConfig?.scrollDelay || 1500,
        expandReplies: extractionConfig?.expandReplies !== false
    };

    // Primeiro, vamos verificar se a seção de comentários está visível
    const commentsSection = document.querySelector('#comments');
    if (!commentsSection) {
        throw new Error('Seção de comentários não encontrada. Verifique se os comentários estão habilitados para este vídeo.');
    }

    // Se a seção de comentários não estiver visível, rolar para torná-la visível
    const commentsSectionRect = commentsSection.getBoundingClientRect();
    if (commentsSectionRect.top > window.innerHeight) {
        commentsSection.scrollIntoView({ behavior: 'smooth' });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Rolar para carregar comentários
    await scrollToLoadComments(config.scrollAttempts, config.scrollDelay, progressCallback);

    // Agora vamos coletar os comentários
    const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');

    if (commentElements.length === 0) {
        throw new Error('Nenhum comentário encontrado. A página pode não ter carregado completamente ou os comentários estão desativados.');
    }

    console.log(`Encontrados ${commentElements.length} comentários. Processando...`);

    if (progressCallback) {
        progressCallback({
            stage: 'processing',
            total: Math.min(commentElements.length, config.maxComments),
            current: 0,
            message: `Processando ${Math.min(commentElements.length, config.maxComments)} comentários...`
        });
    }

    const comments = [];
    let processedCount = 0;

    // Para cada comentário principal
    for (const commentElement of commentElements) {
        try {
            // Rolar para o comentário para garantir que ele esteja carregado
            commentElement.scrollIntoView({ block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 100));

            // Extrair o comentário principal
            const commentData = extractCommentData(commentElement);

            // Expandir e extrair respostas
            if (config.expandReplies) {
                await expandAndExtractReplies(commentElement, commentData);
            }

            comments.push(commentData);
            processedCount++;

            // Atualizar progresso
            if (progressCallback && processedCount % 10 === 0) {
                progressCallback({
                    stage: 'processing',
                    total: Math.min(commentElements.length, config.maxComments),
                    current: processedCount,
                    message: `Processados ${processedCount} de ${Math.min(commentElements.length, config.maxComments)} comentários...`
                });
            }

            // Se coletamos um número máximo de comentários, podemos parar
            if (comments.length >= config.maxComments) {
                console.log(`Limite de ${config.maxComments} comentários atingido. Parando extração.`);
                break;
            }
        } catch (commentError) {
            console.warn('Erro ao extrair comentário:', commentError);
        }
    }

    console.log(`Extração concluída. Total de ${comments.length} comentários processados.`);

    if (progressCallback) {
        progressCallback({
            stage: 'complete',
            total: comments.length,
            current: comments.length,
            message: `Extração concluída. ${comments.length} comentários processados.`
        });
    }

    return comments;
}

// Função para expandir e extrair respostas
async function expandAndExtractReplies(commentElement, commentData) {
    try {
        // Verificar se há um botão "Ver respostas"
        const repliesButton = commentElement.querySelector('#more-replies button, #reply-button-end yt-button-shape button');

        if (repliesButton && repliesButton.offsetParent !== null) {
            // Rolar para o botão para garantir que seja clicável
            repliesButton.scrollIntoView({ block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 300));

            // Clicar no botão para expandir as respostas
            try {
                console.log('Clicando para expandir respostas...');
                repliesButton.click();
                // Pequena pausa para carregar as respostas
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (clickError) {
                console.warn('Erro ao clicar para carregar respostas', clickError);
            }

            // Clicar em "Ver mais respostas" se existir
            try {
                const moreReplies = commentElement.querySelector('ytd-continuation-item-renderer button');
                if (moreReplies && moreReplies.offsetParent !== null) {
                    // Rolar para o botão
                    moreReplies.scrollIntoView({ block: 'center' });
                    await new Promise(resolve => setTimeout(resolve, 300));

                    console.log('Clicando para ver mais respostas...');
                    moreReplies.click();
                    // Esperar mais respostas carregarem
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            } catch (moreRepliesError) {
                console.warn('Erro ao carregar mais respostas', moreRepliesError);
            }
        }

        // Agora coleta as respostas expandidas
        const repliesContainer = commentElement.querySelector('ytd-comment-replies-renderer');
        if (repliesContainer) {
            const replyElements = repliesContainer.querySelectorAll('ytd-comment-renderer');
            if (replyElements.length > 0) {
                commentData.replies = [];

                for (const replyElement of replyElements) {
                    try {
                        const replyData = {
                            author: replyElement.querySelector('#author-text').textContent.trim(),
                            text: replyElement.querySelector('#content-text').textContent.trim(),
                            likes: extractLikeCount(replyElement)
                        };
                        commentData.replies.push(replyData);
                    } catch (replyError) {
                        console.warn('Erro ao extrair resposta:', replyError);
                    }
                }

                console.log(`Extraídas ${commentData.replies.length} respostas para o comentário de ${commentData.author}`);
            }
        }
    } catch (error) {
        console.warn('Erro ao processar respostas:', error);
    }
}

// Extrai os dados de um comentário
function extractCommentData(commentElement) {
    const authorElement = commentElement.querySelector('#author-text');
    const contentElement = commentElement.querySelector('#content-text');

    if (!authorElement || !contentElement) {
        throw new Error('Estrutura do comentário não encontrada');
    }

    return {
        author: authorElement.textContent.trim(),
        text: contentElement.textContent.trim(),
        likes: extractLikeCount(commentElement)
    };
}

// Extrai o número de likes de um comentário
function extractLikeCount(element) {
    const likeElement = element.querySelector('#vote-count-middle');
    if (!likeElement) return 0;

    const likeText = likeElement.textContent.trim();
    if (!likeText || likeText === '') return 0;

    // Converte formatos como "1,2 mil" para números
    if (likeText.includes('mil')) {
        return parseFloat(likeText.replace('mil', '').replace(',', '.')) * 1000;
    }

    // Números simples
    return parseInt(likeText, 10) || 0;
}

// Função para rolar a página e carregar mais comentários
async function scrollToLoadComments(maxScrolls = 30, scrollDelay = 1500, progressCallback) {
    let scrollCount = 0;
    let lastCommentCount = 0;
    let stableCount = 0;

    console.log(`Iniciando rolagem para carregar comentários. Máximo de ${maxScrolls} tentativas.`);

    if (progressCallback) {
        progressCallback({
            stage: 'loading',
            total: maxScrolls,
            current: 0,
            message: 'Carregando comentários...'
        });
    }

    while (scrollCount < maxScrolls) {
        // Rolar para o final da seção de comentários
        const commentsSection = document.querySelector('#comments');
        if (commentsSection) {
            window.scrollTo({
                top: commentsSection.offsetTop + commentsSection.offsetHeight,
                behavior: 'smooth'
            });
        } else {
            // Se não encontrar a seção, rolar para o final da página
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });
        }

        // Esperar um momento para que os comentários carreguem
        await new Promise(resolve => setTimeout(resolve, scrollDelay));

        // Verificar se novos comentários foram carregados
        const currentCommentCount = document.querySelectorAll('ytd-comment-thread-renderer').length;

        // Atualizar o progresso
        if (progressCallback) {
            progressCallback({
                stage: 'loading',
                total: maxScrolls,
                current: scrollCount,
                message: `Carregando comentários... (${currentCommentCount} encontrados)`
            });
        }

        if (scrollCount % 5 === 0 || currentCommentCount !== lastCommentCount) {
            console.log(`Rolagem ${scrollCount}/${maxScrolls}: ${currentCommentCount} comentários carregados`);
        }

        if (currentCommentCount > lastCommentCount) {
            // Encontramos novos comentários, reiniciar o contador de estabilidade
            lastCommentCount = currentCommentCount;
            stableCount = 0;
            scrollCount++;
        } else {
            // Sem novos comentários, incrementar o contador de estabilidade
            stableCount++;

            // Se não carregamos novos comentários após algumas tentativas, podemos parar
            if (stableCount >= 5) {
                console.log('Nenhum novo comentário carregado após múltiplas tentativas. Encerrando rolagem.');
                break;
            }
            scrollCount++;
        }
    }

    console.log(`Rolagem finalizada. Total de ${lastCommentCount} comentários carregados.`);

    // Rolar de volta para a seção de comentários
    const commentsSection = document.querySelector('#comments');
    if (commentsSection) {
        commentsSection.scrollIntoView({ behavior: 'smooth' });
    } else {
        window.scrollTo(0, 0);
    }

    // Pequena pausa antes de começar a coleta
    await new Promise(resolve => setTimeout(resolve, 1000));
} 