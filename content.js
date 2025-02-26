// Notificar o background.js que o content script está pronto
console.log('Content script do YouTube Comments Extractor inicializado');
chrome.runtime.sendMessage({ action: 'contentScriptReady' }, function (response) {
    console.log('Background script respondeu:', response);
});

// Garantir acesso ao localStorage entre contextos
try {
    // Testar se conseguimos acessar o localStorage da página
    const testKey = 'youtube_comments_extractor_test';
    window.localStorage.setItem(testKey, 'test');
    const testValue = window.localStorage.getItem(testKey);
    window.localStorage.removeItem(testKey);

    if (testValue === 'test') {
        console.log('Acesso ao localStorage confirmado');
    } else {
        console.warn('Problema no acesso ao localStorage');
    }
} catch (error) {
    console.error('Erro ao acessar localStorage:', error);

    // Injetar script para comunicação com localStorage
    const script = document.createElement('script');
    script.textContent = `
        // Script injetado pelo YouTube Comments Extractor
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'YOUTUBE_COMMENTS_EXTRACTOR') {
                const action = event.data.action;
                
                try {
                    if (action === 'getItem') {
                        const value = localStorage.getItem(event.data.key);
                        window.postMessage({
                            type: 'YOUTUBE_COMMENTS_EXTRACTOR_RESPONSE',
                            action: 'getItem',
                            key: event.data.key,
                            value: value
                        }, '*');
                    } else if (action === 'setItem') {
                        localStorage.setItem(event.data.key, event.data.value);
                        window.postMessage({
                            type: 'YOUTUBE_COMMENTS_EXTRACTOR_RESPONSE',
                            action: 'setItem',
                            success: true
                        }, '*');
                    }
                } catch (error) {
                    window.postMessage({
                        type: 'YOUTUBE_COMMENTS_EXTRACTOR_RESPONSE',
                        action: action,
                        error: error.message
                    }, '*');
                }
            }
        });
        console.log('YouTube Comments Extractor: Script de acesso ao localStorage injetado');
    `;

    document.documentElement.appendChild(script);
    script.remove();

    // Configurar listeners para resposta
    window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'YOUTUBE_COMMENTS_EXTRACTOR_RESPONSE') {
            console.log('Resposta do script injetado:', event.data);
        }
    });
}

// Estado da aplicação
let appState = {
    hasStoredAnalysis: false,
    videoId: null,
    analysisButtonInjected: false,
    injectionInterval: null,
    injectionAttempts: 0
};

// Verifica se temos análise salva no localStorage
function checkForStoredAnalysis() {
    try {
        console.log('Verificando análises salvas para o vídeo:', appState.videoId);

        if (!appState.videoId) {
            console.error('VideoId não definido, não é possível verificar análises');
            appState.hasStoredAnalysis = false;
            return false;
        }

        // Obter todas as análises salvas
        let useInjectedScript = false;
        let savedData;

        // Primeiro tentar acessar diretamente
        try {
            savedData = localStorage.getItem('youtubeCommentsAnalyses');
            console.log('Dados obtidos do localStorage:', savedData ? 'sim (tamanho: ' + savedData.length + ')' : 'não');
        } catch (directError) {
            console.warn('Não foi possível acessar localStorage diretamente:', directError);
            useInjectedScript = true;
        }

        // Se não conseguir acesso direto, usar o script injetado
        if (useInjectedScript) {
            console.log('Tentando acessar localStorage via script injetado');
            window.postMessage({
                type: 'YOUTUBE_COMMENTS_EXTRACTOR',
                action: 'getItem',
                key: 'youtubeCommentsAnalyses'
            }, '*');

            // Configurar um listener específico para esta solicitação
            const messageHandler = function (event) {
                if (event.data &&
                    event.data.type === 'YOUTUBE_COMMENTS_EXTRACTOR_RESPONSE' &&
                    event.data.action === 'getItem' &&
                    event.data.key === 'youtubeCommentsAnalyses') {

                    console.log('Resposta recebida do script injetado para youtubeCommentsAnalyses');

                    // Remover o listener após receber a resposta
                    window.removeEventListener('message', messageHandler);

                    if (event.data.value) {
                        try {
                            const analyses = JSON.parse(event.data.value);
                            appState.hasStoredAnalysis = analyses.hasOwnProperty(appState.videoId);
                            console.log('Análise para o vídeo encontrada via script injetado:', appState.hasStoredAnalysis);

                            // Tentar injetar o botão se temos análise
                            if (appState.hasStoredAnalysis && !appState.analysisButtonInjected) {
                                tryInjectAnalysisButton();
                            }
                        } catch (parseError) {
                            console.error('Erro ao analisar dados do localStorage:', parseError);
                            appState.hasStoredAnalysis = false;
                        }
                    } else {
                        appState.hasStoredAnalysis = false;
                    }
                }
            };

            // Adicionar o listener
            window.addEventListener('message', messageHandler);

            // Timeout para remover o listener se não houver resposta
            setTimeout(() => {
                window.removeEventListener('message', messageHandler);
            }, 3000);

            return false;
        }

        if (!savedData) {
            console.log('Nenhum dado encontrado no localStorage');
            appState.hasStoredAnalysis = false;
            return false;
        }

        // Parsear os dados
        try {
            const savedAnalyses = JSON.parse(savedData);
            console.log('Análises salvas:', Object.keys(savedAnalyses).length);

            // Verificar se o ID deste vídeo está nas análises
            appState.hasStoredAnalysis = savedAnalyses.hasOwnProperty(appState.videoId);
            console.log('Este vídeo tem análise salva?', appState.hasStoredAnalysis);

            // Notificar o content script para controlar o botão
            if (appState.hasStoredAnalysis) {
                chrome.runtime.sendMessage({
                    action: 'hasStoredAnalysis',
                    videoId: appState.videoId,
                    hasStoredAnalysis: true
                }).catch(err => console.log('Erro ao notificar análise salva:', err));
            }

            return appState.hasStoredAnalysis;
        } catch (parseError) {
            console.error('Erro ao analisar dados do localStorage:', parseError);
            appState.hasStoredAnalysis = false;
            return false;
        }
    } catch (error) {
        console.error('Erro ao verificar análises salvas:', error);
        appState.hasStoredAnalysis = false;
        return false;
    }
}

// Verifica periodicamente se o botão de análise deve ser injetado
function setupObserver() {
    // Verificar se estamos em uma página de vídeo
    const url = window.location.href;
    if (!url.includes('youtube.com/watch')) {
        console.log('Não estamos em uma página de vídeo do YouTube');
        return;
    }

    // Extrair videoId da URL
    const urlParams = new URLSearchParams(window.location.search);
    appState.videoId = urlParams.get('v');

    // Se não temos videoId, não podemos continuar
    if (!appState.videoId) {
        console.log('Não foi possível extrair o ID do vídeo da URL');
        return;
    }

    console.log('ID do vídeo atual:', appState.videoId);

    // Redefinir o estado de injeção ao trocar de vídeo
    appState.analysisButtonInjected = false;

    // Verificar se temos análise no localStorage
    checkForStoredAnalysis();

    // Se temos análise salva, configuramos uma verificação repetida
    // para garantir que o botão seja injetado quando a página terminar de carregar
    if (appState.hasStoredAnalysis) {
        console.log('Há análise salva, configurando injeção periódica do botão');

        // Limpar qualquer intervalo existente
        if (appState.injectionInterval) {
            clearInterval(appState.injectionInterval);
        }

        // Tentativa imediata
        tryInjectAnalysisButton();

        // Configurar tentativas periódicas por 30 segundos (15 tentativas a cada 2 segundos)
        appState.injectionAttempts = 0;
        appState.injectionInterval = setInterval(() => {
            appState.injectionAttempts++;

            // Se já injetamos ou tentamos muitas vezes, parar
            if (appState.analysisButtonInjected || appState.injectionAttempts > 20) {
                console.log(
                    appState.analysisButtonInjected
                        ? 'Botão já injetado, parando tentativas'
                        : 'Máximo de tentativas atingido'
                );
                clearInterval(appState.injectionInterval);
                return;
            }

            console.log(`Tentativa ${appState.injectionAttempts} de injetar o botão...`);
            tryInjectAnalysisButton();
        }, 2000); // Tentar a cada 2 segundos
    }

    // Configurar um observador para detectar mudanças na página
    // especialmente o carregamento da área de inscrição
    const observer = new MutationObserver(function (mutations) {
        if (!appState.analysisButtonInjected && appState.hasStoredAnalysis) {
            console.log('Mudança detectada no DOM, tentando injetar botão...');
            tryInjectAnalysisButton();
        }
    });

    // Iniciar a observação do DOM para mudanças
    observer.observe(document.body, { childList: true, subtree: true });
}

// Adicionar funções de debug para ajudar na inspeção de elementos
function debugElementInfo(element, label) {
    if (!element) {
        console.error(`${label}: elemento não existe`);
        return;
    }

    console.log(`${label}:`, {
        tag: element.tagName,
        id: element.id,
        classList: Array.from(element.classList),
        childrenCount: element.children.length,
        innerText: element.innerText ? element.innerText.substring(0, 50) : '',
        attributes: Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', ')
    });
}

// Função para detectar elementos visíveis em posições específicas que podem receber nosso botão
function scanForPotentialContainers() {
    console.log('Escaneando possíveis containers para o botão de análise...');

    // Lista de seletores conhecidos que poderiam conter o botão
    const selectors = [
        '#top-row',
        '#meta',
        '#meta-contents',
        'ytd-subscribe-button-renderer',
        'ytd-menu-renderer',
        '#buttons.ytd-video-primary-info-renderer',
        '#info-contents'
    ];

    // Testar cada seletor
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        console.log(`Seletor '${selector}': ${elements.length} elementos encontrados`);

        elements.forEach((el, index) => {
            if (el.offsetParent !== null) { // Element is visible
                debugElementInfo(el, `${selector} [${index}] (visível)`);
            }
        });
    });

    // Procurar elementos com texto "Inscrever-se" (botão de inscrição)
    const allElements = document.querySelectorAll('button, [role="button"]');
    const subscribeButtons = Array.from(allElements).filter(el =>
        el.innerText && el.innerText.trim().toLowerCase().includes('inscrever') &&
        el.offsetParent !== null
    );

    console.log(`Encontrados ${subscribeButtons.length} elementos relacionados a "Inscrever-se":`);
    subscribeButtons.forEach((el, index) => {
        debugElementInfo(el, `Botão "Inscrever-se" [${index}]`);

        // Examinar os pais do elemento para encontrar possíveis contêineres
        let parent = el.parentElement;
        let level = 1;
        while (parent && level <= 5) {
            debugElementInfo(parent, `Pai nível ${level} do botão "Inscrever-se" [${index}]`);
            parent = parent.parentElement;
            level++;
        }
    });
}

// Tenta injetar o botão de análise ao lado do botão de inscrição
function tryInjectAnalysisButton() {
    // Verificar se já existe o botão
    if (appState.analysisButtonInjected) return;

    // Se não temos análise salva, não precisa mostrar o botão
    if (!appState.hasStoredAnalysis) {
        console.log('Não há análise salva para este vídeo, botão não será injetado');
        return;
    }

    console.log('Tentando injetar botão de análise flutuante...');

    // Verificar se nosso botão já existe (pode acontecer em alguns casos)
    const existingButton = document.getElementById('comments-analysis-button');
    if (existingButton) {
        console.log('Botão já existe, não será injetado novamente');
        appState.analysisButtonInjected = true;
        return;
    }

    try {
        // Criar um contêiner flutuante
        const floatingContainer = document.createElement('div');
        floatingContainer.id = 'yt-comments-analysis-container';
        floatingContainer.style.position = 'fixed';
        floatingContainer.style.bottom = '20px';
        floatingContainer.style.right = '20px';
        floatingContainer.style.zIndex = '9999';
        floatingContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
        floatingContainer.style.borderRadius = '4px';
        floatingContainer.style.overflow = 'hidden';

        // Criar o botão de análise
        const analysisButton = document.createElement('button');
        analysisButton.id = 'comments-analysis-button';
        analysisButton.className = 'yt-analysis-button';
        analysisButton.textContent = 'Análise de Comentários';
        analysisButton.title = 'Ver análise de comentários deste vídeo';

        // Estilizar o botão para parecer com a interface do YouTube
        analysisButton.style.backgroundColor = '#cc0000';
        analysisButton.style.color = 'white';
        analysisButton.style.border = 'none';
        analysisButton.style.padding = '10px 16px';
        analysisButton.style.fontSize = '14px';
        analysisButton.style.fontWeight = '500';
        analysisButton.style.cursor = 'pointer';
        analysisButton.style.display = 'flex';
        analysisButton.style.alignItems = 'center';
        analysisButton.style.justifyContent = 'center';
        analysisButton.style.width = '100%';
        analysisButton.style.height = '100%';

        // Adicionar hover effect
        analysisButton.onmouseover = function () {
            this.style.backgroundColor = '#aa0000';
        };
        analysisButton.onmouseout = function () {
            this.style.backgroundColor = '#cc0000';
        };

        // Adicionar evento de clique para abrir a extensão
        analysisButton.addEventListener('click', function () {
            chrome.runtime.sendMessage({
                action: 'openPopupWithSavedAnalysis',
                videoId: appState.videoId
            });
        });

        // Adicionar o botão ao contêiner
        floatingContainer.appendChild(analysisButton);

        // Adicionar o contêiner ao documento
        document.body.appendChild(floatingContainer);

        // Marcar que o botão foi injetado
        appState.analysisButtonInjected = true;
        console.log('Botão de análise flutuante injetado com sucesso');

    } catch (error) {
        console.error('Erro ao injetar o botão flutuante:', error);
    }
}

// Configurar o observador quando a página carregar
window.addEventListener('load', setupObserver);

// Detectar mudanças na URL (navegação entre vídeos)
let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('Detectada navegação para nova URL:', url);

        // Resetar o estado
        appState.analysisButtonInjected = false;

        // Limpar qualquer intervalo existente
        if (appState.injectionInterval) {
            clearInterval(appState.injectionInterval);
            appState.injectionInterval = null;
        }

        // Reconfigurar para o novo vídeo
        setTimeout(() => {
            console.log('Reconfigurando para novo vídeo após navegação');
            setupObserver();
        }, 1000); // Adicionamos um pequeno atraso para garantir que a página tenha carregado
    }
});

// Iniciar observação de mudanças no DOM que possam indicar navegação
urlObserver.observe(document, { subtree: true, childList: true });

// Também verificar por alterações na URL diretamente usando hashchange e popstate
window.addEventListener('hashchange', () => {
    if (location.href !== lastUrl) {
        console.log('Detectada mudança de URL via hashchange');
        lastUrl = location.href;
        appState.analysisButtonInjected = false;
        setTimeout(setupObserver, 1000);
    }
});

window.addEventListener('popstate', () => {
    if (location.href !== lastUrl) {
        console.log('Detectada mudança de URL via popstate');
        lastUrl = location.href;
        appState.analysisButtonInjected = false;
        setTimeout(setupObserver, 1000);
    }
});

// Escutar mensagens do popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    // Responder a pings do background script
    if (request.action === 'ping') {
        console.log('Ping recebido');
        sendResponse({ status: 'active' });
        return true;
    }

    if (request.action === 'analysisComplete' || request.action === 'hasStoredAnalysis') {
        console.log('Atualizando estado de análise:', request);

        // Atualizar estado
        appState.hasStoredAnalysis = request.hasStoredAnalysis;
        if (request.videoId) {
            appState.videoId = request.videoId;
        }

        // Reiniciar o estado de injeção do botão
        appState.analysisButtonInjected = false;

        // Limpar qualquer intervalo anterior
        if (appState.injectionInterval) {
            clearInterval(appState.injectionInterval);
            appState.injectionInterval = null;
        }

        // Configurar tentativas periódicas
        if (appState.hasStoredAnalysis) {
            console.log('Preparando-se para injetar o botão de análise');

            // Tentativa imediata
            tryInjectAnalysisButton();

            // Configurar tentativas periódicas por 30 segundos
            appState.injectionAttempts = 0;
            appState.injectionInterval = setInterval(() => {
                if (appState.analysisButtonInjected || appState.injectionAttempts >= 15) {
                    clearInterval(appState.injectionInterval);
                    appState.injectionInterval = null;

                    if (appState.analysisButtonInjected) {
                        console.log('Botão injetado com sucesso após tentativas');
                    } else {
                        console.error('Falha ao injetar botão após várias tentativas');
                    }
                    return;
                }

                appState.injectionAttempts++;
                console.log(`Tentativa ${appState.injectionAttempts} de injetar o botão...`);
                tryInjectAnalysisButton();
            }, 2000);
        }

        sendResponse({ status: 'updated', buttonInjected: appState.analysisButtonInjected });
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