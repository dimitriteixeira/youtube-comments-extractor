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

// Estado da extração de comentários
let extractionState = {
    isExtracting: false,
    startTime: null,
    progress: {
        stage: null, // 'loading', 'processing', 'complete'
        total: 0,
        current: 0,
        message: '',
        percentage: 0
    },
    config: null,
    commentCount: 0,
    error: null,
    complete: false
};

// Função para atualizar o estado da extração
function updateExtractionState(update) {
    extractionState = { ...extractionState, ...update };

    // Armazenar o estado na chrome.storage para persistência
    chrome.storage.session.set({
        'commentExtractionState': extractionState
    }, function () {
        console.log('Estado da extração atualizado e salvo:', extractionState);
    });

    // Notificar o popup se estiver aberto
    chrome.runtime.sendMessage({
        action: 'extractionStateUpdate',
        state: extractionState
    }).catch(err => {
        // É normal haver erro aqui se o popup estiver fechado
        console.log('Popup possivelmente fechado, não foi possível atualizar estado');
    });
}

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

                            // Verificação mais rigorosa de análises válidas
                            const hasValidAnalysis = isValidAnalysis(analyses, appState.videoId);

                            appState.hasStoredAnalysis = hasValidAnalysis;
                            console.log('Análise válida para o vídeo encontrada via script injetado:', appState.hasStoredAnalysis);

                            // Tentar injetar o botão apenas se temos análise válida
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

            // Verificação mais rigorosa de análises válidas
            const hasValidAnalysis = isValidAnalysis(savedAnalyses, appState.videoId);

            appState.hasStoredAnalysis = hasValidAnalysis;
            console.log('Este vídeo tem análise válida salva?', appState.hasStoredAnalysis);

            // Notificar o background script apenas se temos análise válida
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

// Função auxiliar para verificar se uma análise é válida
function isValidAnalysis(analyses, videoId) {
    // Verificar se existe uma entrada para o vídeo
    if (!analyses || !analyses.hasOwnProperty(videoId) || !analyses[videoId]) {
        return false;
    }

    const analysis = analyses[videoId];

    // Verificar se a análise tem a estrutura esperada
    if (!analysis.categorizedComments || typeof analysis.categorizedComments !== 'object') {
        return false;
    }

    // Verificar se há pelo menos uma categoria válida
    const categories = Object.keys(analysis.categorizedComments);
    if (categories.length === 0) {
        return false;
    }

    // Verificar se pelo menos uma categoria tem análise
    for (const categoryKey of categories) {
        const category = analysis.categorizedComments[categoryKey];
        if (category && (category.analysis || (category.comments && category.comments.length > 0))) {
            return true;
        }
    }

    return false;
}

// Verifica periodicamente se o botão de análise deve ser injetado
function setupObserver() {
    // Verificar se estamos em uma página de vídeo
    const url = window.location.href;
    if (!url.includes('youtube.com/watch')) {
        console.log('Não estamos em uma página de vídeo do YouTube');
        // Remover qualquer botão existente se não estamos em uma página de vídeo
        removeAnalysisButton();
        return;
    }

    // Extrair videoId da URL
    const urlParams = new URLSearchParams(window.location.search);
    appState.videoId = urlParams.get('v');

    // Se não temos videoId, não podemos continuar
    if (!appState.videoId) {
        console.log('Não foi possível extrair o ID do vídeo da URL');
        // Remover qualquer botão existente se não conseguimos o ID do vídeo
        removeAnalysisButton();
        return;
    }

    console.log('ID do vídeo atual:', appState.videoId);

    // Redefinir o estado de injeção ao trocar de vídeo
    appState.analysisButtonInjected = false;

    // Verificar se temos análise no localStorage
    const hasAnalysis = checkForStoredAnalysis();

    // Se não tem análise salva, garantir que o botão seja removido
    if (!appState.hasStoredAnalysis) {
        console.log('Não há análise salva para este vídeo, removendo botão flutuante se existir');
        removeAnalysisButton();
        return;
    }

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
        }, 2000);
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
            try {
                chrome.runtime.sendMessage({
                    action: 'openPopupWithSavedAnalysis',
                    videoId: appState.videoId
                }, function (response) {
                    if (chrome.runtime.lastError) {
                        console.log('Erro ao enviar mensagem: ', chrome.runtime.lastError.message);
                        // Informar ao usuário que a extensão precisa ser recarregada
                        alert('O contexto da extensão foi invalidado. Por favor, recarregue a página para continuar usando a extensão.');
                    }
                });
            } catch (error) {
                console.error('Erro ao tentar abrir o popup: ', error);
                // Informar ao usuário que a extensão precisa ser recarregada
                alert('O contexto da extensão foi invalidado. Por favor, recarregue a página para continuar usando a extensão.');

                // Tentar recarregar a página automaticamente após confirmação
                if (confirm('Deseja recarregar a página agora?')) {
                    window.location.reload();
                }
            }
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

// Função para remover o botão flutuante se ele existir
function removeAnalysisButton() {
    const existingButton = document.getElementById('yt-comments-analysis-container');
    if (existingButton) {
        console.log('Removendo botão flutuante pois não há análise para este vídeo');
        existingButton.remove();
        appState.analysisButtonInjected = false;
    }
}

// Configurar o observador quando a página carregar
window.addEventListener('load', async () => {
    // Verificar se existe um estado de extração salvo
    await checkSavedExtractionState();

    // Configurar o observador para injetar o botão quando necessário
    setupObserver();
});

// Detectar mudanças na URL (navegação entre vídeos)
let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('Detectada navegação para nova URL:', url);

        // Resetar o estado
        appState.analysisButtonInjected = false;

        // Remover o botão flutuante existente para evitar que permaneça em páginas sem análise
        removeAnalysisButton();

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

        // Resetar estado e remover botão
        appState.analysisButtonInjected = false;
        removeAnalysisButton();

        setTimeout(setupObserver, 1000);
    }
});

window.addEventListener('popstate', () => {
    if (location.href !== lastUrl) {
        console.log('Detectada mudança de URL via popstate');
        lastUrl = location.href;

        // Resetar estado e remover botão
        appState.analysisButtonInjected = false;
        removeAnalysisButton();

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

    // Verificar o estado atual da extração
    if (request.action === 'getExtractionState') {
        console.log('Solicitação de estado atual da extração recebida');
        sendResponse({
            state: extractionState
        });
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

        // Se já estamos extraindo, envie o estado atual
        if (extractionState.isExtracting) {
            console.log('Extração já em andamento, retornando estado atual');
            sendResponse({
                status: 'extraction_in_progress',
                state: extractionState
            });
            return true;
        }

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

// Função para verificar se existe um estado de extração salvo
async function checkSavedExtractionState() {
    try {
        // Verifica se há um estado de extração salvo na chrome.storage.session
        const result = await new Promise(resolve => {
            chrome.storage.session.get(['commentExtractionState'], (data) => {
                resolve(data);
            });
        });

        if (result && result.commentExtractionState) {
            console.log('Estado de extração encontrado:', result.commentExtractionState);

            // Restaurar o estado salvo
            extractionState = result.commentExtractionState;

            // Se a extração estava em andamento mas foi interrompida pelo fechamento do popup,
            // atualizamos o status para mostrar que ela foi interrompida
            if (extractionState.isExtracting && !extractionState.complete) {
                extractionState.isExtracting = false;
                extractionState.error = 'Extração interrompida pelo fechamento do popup';
                extractionState.complete = true;

                // Salvar o estado atualizado
                chrome.storage.session.set({ 'commentExtractionState': extractionState });
            }

            return true;
        }

        return false;
    } catch (error) {
        console.error('Erro ao verificar estado de extração salvo:', error);
        return false;
    }
}

// Função principal para extrair comentários
async function extractYouTubeComments(extractionConfig, progressCallback) {
    // Configurações padrão se não forem recebidas
    const config = {
        maxComments: extractionConfig?.maxComments || 500,
        scrollAttempts: extractionConfig?.scrollAttempts || 30,
        scrollDelay: extractionConfig?.scrollDelay || 1500,
        expandReplies: extractionConfig?.expandReplies !== false
    };

    // Inicializar o estado da extração
    updateExtractionState({
        isExtracting: true,
        startTime: new Date().toISOString(),
        progress: {
            stage: 'loading',
            total: config.scrollAttempts,
            current: 0,
            message: 'Iniciando extração de comentários...',
            percentage: 0
        },
        config: config,
        commentCount: 0,
        error: null,
        complete: false
    });

    // Primeiro, vamos verificar se a seção de comentários está visível
    const commentsSection = document.querySelector('#comments');
    if (!commentsSection) {
        const errorMsg = 'Seção de comentários não encontrada. Verifique se os comentários estão habilitados para este vídeo.';
        updateExtractionState({
            isExtracting: false,
            error: errorMsg,
            complete: true
        });
        throw new Error(errorMsg);
    }

    // Se a seção de comentários não estiver visível, rolar para torná-la visível
    const commentsSectionRect = commentsSection.getBoundingClientRect();
    if (commentsSectionRect.top > window.innerHeight) {
        commentsSection.scrollIntoView({ behavior: 'smooth' });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
        // Rolar para carregar comentários
        await scrollToLoadComments(config.scrollAttempts, config.scrollDelay, (progress) => {
            // Atualizar o estado de progresso
            updateExtractionState({
                progress: {
                    ...extractionState.progress,
                    ...progress,
                    percentage: Math.round((progress.current / progress.total) * 50) // 50% para a fase de carregamento
                }
            });

            // Chamar o callback original se fornecido
            if (progressCallback) progressCallback(progress);
        });

        // Agora vamos coletar os comentários
        const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');

        if (commentElements.length === 0) {
            const errorMsg = 'Nenhum comentário encontrado. A página pode não ter carregado completamente ou os comentários estão desativados.';
            updateExtractionState({
                isExtracting: false,
                error: errorMsg,
                complete: true
            });
            throw new Error(errorMsg);
        }

        console.log(`Encontrados ${commentElements.length} comentários. Processando...`);

        const processingProgress = {
            stage: 'processing',
            total: Math.min(commentElements.length, config.maxComments),
            current: 0,
            message: `Processando ${Math.min(commentElements.length, config.maxComments)} comentários...`,
            percentage: 50 // Começamos em 50% após o carregamento
        };

        updateExtractionState({
            progress: processingProgress
        });

        if (progressCallback) {
            progressCallback(processingProgress);
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

                // Atualizar progresso a cada 10 comentários ou no último
                if (processedCount % 10 === 0 || processedCount === Math.min(commentElements.length, config.maxComments)) {
                    const currentProgress = {
                        stage: 'processing',
                        total: Math.min(commentElements.length, config.maxComments),
                        current: processedCount,
                        message: `Processados ${processedCount} de ${Math.min(commentElements.length, config.maxComments)} comentários...`,
                        percentage: 50 + Math.round((processedCount / Math.min(commentElements.length, config.maxComments)) * 50) // 50-100%
                    };

                    updateExtractionState({
                        progress: currentProgress,
                        commentCount: processedCount
                    });

                    // Atualizar progresso
                    if (progressCallback) {
                        progressCallback(currentProgress);
                    }
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

        const completeProgress = {
            stage: 'complete',
            total: comments.length,
            current: comments.length,
            message: `Extração concluída. ${comments.length} comentários processados.`,
            percentage: 100
        };

        updateExtractionState({
            isExtracting: false,
            progress: completeProgress,
            commentCount: comments.length,
            complete: true
        });

        if (progressCallback) {
            progressCallback(completeProgress);
        }

        return comments;
    } catch (error) {
        console.error('Erro durante a extração:', error);

        updateExtractionState({
            isExtracting: false,
            error: error.message,
            complete: true
        });

        throw error;
    }
}

// Função para expandir e extrair respostas
async function expandAndExtractReplies(commentElement, commentData) {
    try {
        // Verificar se há um botão "Ver respostas" (evitando botões de resposta)
        // Primeiro tentamos encontrar especificamente um botão para expandir respostas
        const expandRepliesButtons = commentElement.querySelectorAll('ytd-button-renderer#more-replies, ytd-button-renderer#more-replies-button, #more-replies button');
        let repliesButton = null;

        // Verificamos primeiro os botões mais específicos para expandir respostas
        for (const button of expandRepliesButtons) {
            if (button && button.offsetParent !== null) {
                const buttonText = button.textContent.trim().toLowerCase();
                // Verificamos se o texto contém palavras-chave relacionadas a ver respostas
                if (buttonText.includes('ver') || buttonText.includes('mostrar') ||
                    buttonText.includes('exibir') || buttonText.includes('respostas') ||
                    buttonText.includes('replies') || buttonText.includes('view')) {
                    repliesButton = button;
                    break;
                }
            }
        }

        // Se não encontrarmos um botão específico, buscamos outros elementos que possam ser o botão de respostas
        if (!repliesButton) {
            const replyButtonEnd = commentElement.querySelector('#reply-button-end yt-button-shape button');
            if (replyButtonEnd && replyButtonEnd.offsetParent !== null) {
                // Verificamos se o elemento parental tem alguma indicação que é para expandir respostas
                const parentText = replyButtonEnd.closest('#more-replies') ?
                    replyButtonEnd.closest('#more-replies').textContent.trim().toLowerCase() : '';

                if (parentText.includes('respostas') || parentText.includes('replies')) {
                    repliesButton = replyButtonEnd;
                }
            }
        }

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