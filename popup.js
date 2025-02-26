"// Criando arquivo temporário primeiro"

// Inicialização e configuração da extensão
document.addEventListener('DOMContentLoaded', init);

// Estado global da aplicação
let extractedComments = [];
let categorizedComments = {};
let activeTab = null;
let activeApiKey = '';
let activeModel = '';
let maxComments = 100;

// Referências para elementos da UI
const elements = {
    tabsContainer: null,
    commentsList: null,
    extractButton: null,
    statusIndicator: null,
    analysisResults: null,
    toggleConfigBtn: null,
    configPanel: null,
    apiKeyInput: null,
    saveApiKeyBtn: null,
    testConnectionBtn: null,
    modelSelect: null,
    maxCommentsInput: null,
    progressContainer: null,
    progressBar: null,
    progressText: null,
    errorContainer: null,
    retryButton: null,
    reloadButton: null
};

// Categorias para análise
const categories = {
    summary: {
        id: 'summary',
        title: 'Resumo Geral',
        description: 'Resumo de todos os pontos importantes mencionados nos comentários'
    },
    satisfaction: {
        id: 'satisfaction',
        title: 'Satisfação',
        description: 'Comentários indicando satisfação ou insatisfação com o conteúdo'
    },
    extraInfo: {
        id: 'extraInfo',
        title: 'Informações Adicionais',
        description: 'Informações extras mencionadas nos comentários que complementam o vídeo'
    },
    suggestions: {
        id: 'suggestions',
        title: 'Sugestões',
        description: 'Sugestões e pedidos feitos pela audiência'
    }
};

// Inicialização
async function init() {

    document.getElementById("year").textContent = new Date().getFullYear();

    // Inicializar referências a elementos
    initializeElementReferences();

    // Tentar carregar configurações salvas
    await loadSavedSettings();

    // Verificar se é uma página de vídeo do YouTube
    await checkYouTubeVideo();

    // Verificar se o content script está pronto
    await checkContentScriptStatus();

    // Configurar event listeners
    setupEventListeners();

    // Preencher a lista de modelos disponíveis
    populateModelSelect();
}

// Inicializa referências a todos os elementos da UI
function initializeElementReferences() {
    elements.tabsContainer = document.getElementById('tabs-container');
    elements.commentsList = document.getElementById('comments-list');
    elements.extractButton = document.getElementById('extract-btn');
    elements.statusIndicator = document.getElementById('status-indicator');
    elements.analysisResults = document.getElementById('analysis-results');
    elements.toggleConfigBtn = document.getElementById('toggle-config');
    elements.configPanel = document.getElementById('config-panel');
    elements.apiKeyInput = document.getElementById('api-key-input');
    elements.saveApiKeyBtn = document.getElementById('save-api-key');
    elements.testConnectionBtn = document.getElementById('test-connection');
    elements.modelSelect = document.getElementById('model-select');
    elements.maxCommentsInput = document.getElementById('max-comments');
    elements.progressContainer = document.getElementById('progress-container');
    elements.progressBar = document.getElementById('progress-bar');
    elements.progressText = document.getElementById('progress-text');
    elements.errorContainer = document.getElementById('error-container');
    elements.retryButton = document.getElementById('retry-button');
    elements.reloadButton = document.getElementById('reload-button');

    // Inicialmente ocultar containers de erro e progresso
    elements.errorContainer.style.display = 'none';
    elements.progressContainer.style.display = 'none';
}

// Carrega configurações salvas
async function loadSavedSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['apiKey', 'model', 'maxComments'], function (result) {
            if (result.apiKey) {
                activeApiKey = result.apiKey;
                elements.apiKeyInput.value = maskApiKey(result.apiKey);
            }

            if (result.model) {
                activeModel = result.model;
            }

            if (result.maxComments) {
                maxComments = parseInt(result.maxComments);
                elements.maxCommentsInput.value = maxComments;
            }

            resolve();
        });
    });
}

// Configura todos os event listeners
function setupEventListeners() {
    // Botão de extrair comentários
    elements.extractButton.addEventListener('click', extractAndProcessComments);

    // Configurações
    elements.toggleConfigBtn.addEventListener('click', toggleConfigPanel);
    elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
    elements.testConnectionBtn.addEventListener('click', testApiConnection);
    elements.maxCommentsInput.addEventListener('change', updateMaxComments);

    // Botões de retry/reload para erros
    elements.retryButton.addEventListener('click', () => {
        hideError();
        extractAndProcessComments();
    });

    elements.reloadButton.addEventListener('click', () => {
        chrome.tabs.reload(activeTab.id);
        window.close();
    });
}

// Verifica se o content script está pronto
async function checkContentScriptStatus() {
    if (!activeTab) return;

    try {
        const url = activeTab.url;
        if (!url || !url.includes('youtube.com/watch')) {
            setStatus('Esta não é uma página de vídeo do YouTube', 'error');
            return;
        }

        const response = await chrome.runtime.sendMessage({
            action: 'checkContentScript',
            tabId: activeTab.id
        });

        if (response && response.status === 'injected') {
            // Esperamos um segundo para que o script tenha tempo de inicializar
            setTimeout(() => {
                setStatus('Pronto para extrair comentários', 'ready');
            }, 1000);
        } else if (response && response.status === 'error') {
            showError('Não foi possível verificar o content script', 'Recarregue a página para tentar novamente.');
        }
    } catch (error) {
        console.error('Erro ao verificar o content script:', error);
        showError('Erro ao verificar o content script', error.message);
    }
}

// Verifica se a página atual é um vídeo do YouTube
async function checkYouTubeVideo() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        activeTab = tabs[0];

        if (!activeTab.url.includes('youtube.com/watch')) {
            elements.extractButton.disabled = true;
            setStatus('Esta não é uma página de vídeo do YouTube', 'error');
        } else {
            elements.extractButton.disabled = false;
            setStatus('Pronto para extrair comentários', 'ready');
        }
    } catch (error) {
        console.error('Erro ao verificar a URL do YouTube:', error);
        showError('Erro ao verificar a URL', error.message);
    }
}

// Garante que o content script está pronto antes de extrair comentários
async function ensureContentScriptReady() {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'checkContentScript',
            tabId: activeTab.id
        });

        if (response.status === 'active') {
            return true;
        } else if (response.status === 'injected') {
            // Damos um segundo para o script inicializar
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
        } else {
            showError('Content script não está pronto', 'Recarregue a página para tentar novamente.');
            return false;
        }
    } catch (error) {
        console.error('Erro ao verificar content script:', error);
        showError('Erro ao verificar content script', error.message);
        return false;
    }
}

// Processo principal de extração e análise de comentários
async function extractAndProcessComments() {
    // Limpar resultados anteriores
    clearResults();

    // Verificar se a chave API está configurada
    if (!activeApiKey) {
        toggleConfigPanel();
        showError('API Key não configurada', 'Por favor, insira sua API Key da OpenAI para continuar.');
        return;
    }

    // Verificar se é um vídeo do YouTube
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        activeTab = tabs[0];

        if (!activeTab.url.includes('youtube.com/watch')) {
            showError('URL inválida', 'Esta não é uma página de vídeo do YouTube.');
            return;
        }
    } catch (error) {
        console.error('Erro ao obter a aba ativa:', error);
        showError('Erro ao acessar a aba', error.message);
        return;
    }

    // Verificar se o content script está pronto
    const isReady = await ensureContentScriptReady();
    if (!isReady) {
        return;
    }

    // Inicia o processo de extração
    try {
        await extractComments();
        await categorizeComments();
        await analyzeCategories();
        displayResults();
    } catch (error) {
        console.error('Erro no processo de extração e análise:', error);
        showError('Erro no processamento', error.message);
    }
}

// Extrai comentários usando o content script
async function extractComments() {
    showProgress('Iniciando extração de comentários...');

    try {
        // Configuração para extração
        const config = {
            extraction: {
                maxComments: maxComments,
                scrollAttempts: 30,
                scrollDelay: 1500,
                expandReplies: true
            }
        };

        // Enviar mensagem para começar a extração
        chrome.tabs.sendMessage(activeTab.id, {
            action: 'extractComments',
            config: config
        });

        // Configurar listener para atualizações de progresso
        chrome.runtime.onMessage.addListener(handleExtractionMessages);

        // Aguardar a conclusão da extração (via Promise que será resolvida pelo listener)
        await new Promise((resolve, reject) => {
            window.extractionPromiseResolve = resolve;
            window.extractionPromiseReject = reject;

            // Timeout como segurança
            setTimeout(() => {
                if (window.extractionPromiseReject) {
                    window.extractionPromiseReject(new Error('Tempo esgotado ao aguardar extração de comentários.'));
                    window.extractionPromiseResolve = null;
                    window.extractionPromiseReject = null;
                }
            }, 600000); // 10 minutos de timeout
        });

        // Limpeza
        chrome.runtime.onMessage.removeListener(handleExtractionMessages);
    } catch (error) {
        console.error('Erro na extração de comentários:', error);
        updateProgress(0, 'Erro na extração de comentários: ' + error.message);
        throw new Error('Falha na extração de comentários: ' + error.message);
    }
}

// Lida com as mensagens de progresso e conclusão da extração
function handleExtractionMessages(message) {
    if (message.action === 'extractionProgress') {
        const progress = message.progress;
        let percentage = 0;
        let statusText = '';

        if (progress.stage === 'loading') {
            percentage = (progress.current / progress.total) * 50; // Pesos: 50% para carregamento
            statusText = progress.message;
        } else if (progress.stage === 'processing') {
            percentage = 50 + (progress.current / progress.total) * 50; // 50% base + 50% para processamento
            statusText = progress.message;
        } else if (progress.stage === 'complete') {
            percentage = 100;
            statusText = progress.message;
        }

        updateProgress(percentage, statusText);
    }
    else if (message.action === 'extractionComplete') {
        if (message.success) {
            extractedComments = message.comments;
            console.log(`Extração concluída com sucesso. ${extractedComments.length} comentários extraídos.`);

            if (window.extractionPromiseResolve) {
                window.extractionPromiseResolve(extractedComments);
                window.extractionPromiseResolve = null;
                window.extractionPromiseReject = null;
            }
        } else {
            console.error('Erro na extração:', message.error);
            if (window.extractionPromiseReject) {
                window.extractionPromiseReject(new Error(message.error));
                window.extractionPromiseResolve = null;
                window.extractionPromiseReject = null;
            }
        }
    }

    // Manter o listener ativo
    return true;
}

// Categoriza os comentários extraídos
async function categorizeComments() {
    if (!extractedComments || extractedComments.length === 0) {
        throw new Error('Nenhum comentário extraído para categorizar.');
    }

    updateProgress(100, 'Categorizando comentários...');

    // Inicializar as categorias vazias
    categorizedComments = {
        summary: {
            id: 'summary',
            title: categories.summary.title,
            description: categories.summary.description,
            comments: extractedComments
        },
        satisfaction: {
            id: 'satisfaction',
            title: categories.satisfaction.title,
            description: categories.satisfaction.description,
            comments: []
        },
        extraInfo: {
            id: 'extraInfo',
            title: categories.extraInfo.title,
            description: categories.extraInfo.description,
            comments: []
        },
        suggestions: {
            id: 'suggestions',
            title: categories.suggestions.title,
            description: categories.suggestions.description,
            comments: []
        }
    };

    // Categorização simples por palavras-chave
    extractedComments.forEach(comment => {
        const text = comment.text.toLowerCase();

        // Verificar satisfação/insatisfação
        if (
            text.includes('amo') || text.includes('gosto') || text.includes('excelente') ||
            text.includes('incrível') || text.includes('melhor') || text.includes('ótimo') ||
            text.includes('perfeito') || text.includes('parabéns') || text.includes('top') ||
            text.includes('adorei') || text.includes('brabo') || text.includes('👍') ||
            text.includes('odeio') || text.includes('ruim') || text.includes('péssimo') ||
            text.includes('terrível') || text.includes('decepcionado') || text.includes('pior') ||
            text.includes('horrível') || text.includes('👎') || text.includes('desapontado')
        ) {
            categorizedComments.satisfaction.comments.push(comment);
        }

        // Verificar informações adicionais
        if (
            text.includes('sabia que') || text.includes('informação') || text.includes('também tem') ||
            text.includes('complementando') || text.includes('adicionar') || text.includes('complemento') ||
            text.includes('além disso') || text.includes('acrescentar') || text.includes('pesquisei') ||
            text.includes('descobri') || text.includes('de acordo com') || text.includes('segundo a')
        ) {
            categorizedComments.extraInfo.comments.push(comment);
        }

        // Verificar sugestões
        if (
            text.includes('sugiro') || text.includes('sugestão') || text.includes('podia') ||
            text.includes('poderia') || text.includes('devia') || text.includes('deveria') ||
            text.includes('que tal') || text.includes('próximo vídeo') || text.includes('ideia') ||
            text.includes('recomendo') || text.includes('seria legal') || text.includes('seria interessante')
        ) {
            categorizedComments.suggestions.comments.push(comment);
        }
    });

    updateProgress(100, 'Comentários categorizados.');
}

// Analisa cada categoria usando a API OpenAI
async function analyzeCategories() {
    if (!activeApiKey) {
        throw new Error('API Key não configurada');
    }

    if (!activeModel) {
        throw new Error('Modelo não selecionado');
    }

    updateProgress(100, 'Iniciando análise de comentários...');

    try {
        // Para cada categoria, analise os comentários quando houver suficientes
        for (const categoryId in categorizedComments) {
            const category = categorizedComments[categoryId];

            // Pular categorias sem comentários ou com poucos comentários (exceto resumo geral)
            if (categoryId !== 'summary' && (!category.comments || category.comments.length < 3)) {
                category.analysis = {
                    result: 'Não há comentários suficientes nesta categoria para análise.'
                };
                continue;
            }

            updateProgress(100, `Analisando categoria: ${category.title}...`);

            // Obter os comentários da categoria (ou todos para o resumo)
            const commentsToAnalyze = category.comments;

            if (commentsToAnalyze.length > 0) {
                // Realizar a análise usando a API OpenAI
                const analysisResult = await window.OpenAIService.analyzeCommentsForCategory(
                    commentsToAnalyze,
                    categoryId,
                    activeApiKey,
                    activeModel
                );

                // Armazenar o resultado da análise na categoria
                category.analysis = analysisResult;
            } else {
                category.analysis = {
                    result: 'Não há comentários para analisar nesta categoria.'
                };
            }
        }

        updateProgress(100, 'Análise concluída!');
    } catch (error) {
        console.error('Erro na análise:', error);
        throw new Error('Falha na análise de comentários: ' + error.message);
    }
}

// Exibe os resultados da análise na interface
function displayResults() {
    hideProgress();

    // Limpar resultados anteriores
    elements.analysisResults.innerHTML = '';
    elements.tabsContainer.innerHTML = '';

    // Criar tabs para cada categoria
    const tabsList = document.createElement('ul');
    tabsList.className = 'tabs-list';
    elements.tabsContainer.appendChild(tabsList);

    // Container para o conteúdo das tabs
    const tabsContent = document.createElement('div');
    tabsContent.className = 'tabs-content';
    elements.analysisResults.appendChild(tabsContent);

    // Para cada categoria, criar uma tab e seu conteúdo
    let firstTab = null;

    for (const categoryId in categorizedComments) {
        const category = categorizedComments[categoryId];

        // Criar tab
        const tab = document.createElement('li');
        tab.className = 'tab';
        tab.setAttribute('data-tab', categoryId);
        tab.textContent = category.title;
        tabsList.appendChild(tab);

        if (!firstTab) firstTab = tab;

        // Criar conteúdo da tab
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        tabContent.id = `tab-${categoryId}`;
        tabContent.style.display = 'none';

        // Adicionar descrição da categoria
        const description = document.createElement('p');
        description.className = 'category-description';
        description.textContent = category.description;
        tabContent.appendChild(description);

        // Adicionar resultados da análise
        if (category.analysis) {
            const analysisDiv = document.createElement('div');
            analysisDiv.className = 'analysis-result';

            // Verificar se há um resultado formatado ou usar o bruto
            if (category.analysis.result) {
                analysisDiv.innerHTML = formatAnalysisResult(category.analysis.result);
            } else {
                analysisDiv.textContent = 'Não foi possível analisar os comentários desta categoria.';
            }

            tabContent.appendChild(analysisDiv);
        }

        // Adicionar lista de comentários relevantes
        if (category.comments && category.comments.length > 0) {
            const commentsHeader = document.createElement('h3');
            commentsHeader.textContent = `Comentários (${category.comments.length})`;
            tabContent.appendChild(commentsHeader);

            const commentsContainer = document.createElement('div');
            commentsContainer.className = 'category-comments';

            // Limitar a 20 comentários por categoria na exibição
            const displayLimit = Math.min(category.comments.length, 20);

            for (let i = 0; i < displayLimit; i++) {
                const comment = category.comments[i];
                const commentDiv = createCommentElement(comment);
                commentsContainer.appendChild(commentDiv);
            }

            // Se houver mais comentários, mostrar mensagem
            if (category.comments.length > 20) {
                const moreCommentsMsg = document.createElement('p');
                moreCommentsMsg.className = 'more-comments-msg';
                moreCommentsMsg.textContent = `+ ${category.comments.length - 20} comentários não exibidos`;
                commentsContainer.appendChild(moreCommentsMsg);
            }

            tabContent.appendChild(commentsContainer);
        }

        tabsContent.appendChild(tabContent);
    }

    // Adicionar event listeners para as tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Desativar todas as tabs
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

            // Ativar a tab clicada
            tab.classList.add('active');
            document.getElementById(`tab-${tab.getAttribute('data-tab')}`).style.display = 'block';
        });
    });

    // Ativar a primeira tab por padrão
    if (firstTab) {
        firstTab.click();
    }

    // Configurar event listeners para menções de usuários
    setupMentionListeners();

    // Exibir estatísticas
    displayStatistics();
}

// Exibe estatísticas sobre os comentários extraídos
function displayStatistics() {
    const statsDiv = document.createElement('div');
    statsDiv.className = 'statistics';
    statsDiv.innerHTML = `
        <h3>Estatísticas</h3>
        <p>Total de comentários extraídos: ${extractedComments.length}</p>
        <p>Comentários sobre satisfação: ${categorizedComments.satisfaction.comments.length}</p>
        <p>Informações adicionais: ${categorizedComments.extraInfo.comments.length}</p>
        <p>Sugestões: ${categorizedComments.suggestions.comments.length}</p>
    `;

    elements.analysisResults.appendChild(statsDiv);
}

// Cria um elemento para exibir um comentário
function createCommentElement(comment) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';

    const header = document.createElement('div');
    header.className = 'comment-header';

    const author = document.createElement('span');
    author.className = 'comment-author';
    author.textContent = comment.author;

    const likes = document.createElement('span');
    likes.className = 'comment-likes';
    likes.textContent = `👍 ${comment.likes || 0}`;

    header.appendChild(author);
    header.appendChild(likes);

    const text = document.createElement('div');
    text.className = 'comment-text';
    text.textContent = comment.text;

    commentDiv.appendChild(header);
    commentDiv.appendChild(text);

    // Se o comentário tiver respostas, adicionar
    if (comment.replies && comment.replies.length > 0) {
        const repliesToggle = document.createElement('button');
        repliesToggle.className = 'replies-toggle';
        repliesToggle.textContent = `Ver ${comment.replies.length} respostas`;

        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies-container';
        repliesContainer.style.display = 'none';

        comment.replies.forEach(reply => {
            const replyDiv = document.createElement('div');
            replyDiv.className = 'reply';

            const replyHeader = document.createElement('div');
            replyHeader.className = 'reply-header';
            replyHeader.textContent = reply.author;

            const replyText = document.createElement('div');
            replyText.className = 'reply-text';
            replyText.textContent = reply.text;

            replyDiv.appendChild(replyHeader);
            replyDiv.appendChild(replyText);
            repliesContainer.appendChild(replyDiv);
        });

        repliesToggle.addEventListener('click', () => {
            if (repliesContainer.style.display === 'none') {
                repliesContainer.style.display = 'block';
                repliesToggle.textContent = 'Ocultar respostas';
            } else {
                repliesContainer.style.display = 'none';
                repliesToggle.textContent = `Ver ${comment.replies.length} respostas`;
            }
        });

        commentDiv.appendChild(repliesToggle);
        commentDiv.appendChild(repliesContainer);
    }

    return commentDiv;
}

// Formata o resultado da análise para HTML
function formatAnalysisResult(result) {
    if (!result) return 'Não há resultado de análise disponível.';

    // Se o resultado já vier em HTML, retornar direto
    if (result.includes('<') && result.includes('>') && !result.includes('###')) {
        return result;
    }

    // Formatação de markdown para HTML
    let formatted = result
        // Headers
        .replace(/### (.*?)(?=\n|$)/g, '<h3>$1</h3>')
        .replace(/## (.*?)(?=\n|$)/g, '<h2>$1</h2>')
        .replace(/# (.*?)(?=\n|$)/g, '<h1>$1</h1>')

        // Negrito
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

        // Itálico
        .replace(/\*(.*?)\*/g, '<em>$1</em>')

        // Listas
        .replace(/- (.*?)(?=\n|$)/g, '<li>$1</li>')

        // Parágrafos
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n(?![<])/g, '<br>')

        // Tornar menções a usuários clicáveis
        .replace(/@([a-zA-Z0-9_]+)/g, function (match, username) {
            // Procurar o comentário correspondente
            const commentAuthor = findCommentByAuthor(username);
            if (commentAuthor) {
                return `<a href="#" class="user-mention" data-comment-id="${commentAuthor.id}" title="Ver comentário de ${username}">${match}</a>`;
            }
            return match;
        });

    // Envolver listas em tags <ul>
    if (formatted.includes('<li>')) {
        formatted = formatted
            .replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>')
            .replace(/<\/ul><ul>/g, '');
    }

    return formatted;
}

// Encontra um comentário pelo nome do autor
function findCommentByAuthor(username) {
    // Verifica em todas as categorias
    for (const categoryId in categorizedComments) {
        const category = categorizedComments[categoryId];
        if (!category.comments) continue;

        // Procura nos comentários da categoria
        for (const comment of category.comments) {
            // Verifica se o autor corresponde (ignorando @ e case insensitive)
            if (comment.author &&
                comment.author.toLowerCase() === username.toLowerCase() ||
                comment.author.toLowerCase() === username.toLowerCase().replace('@', '')) {
                return comment;
            }

            // Verifica nas respostas, se houver
            if (comment.replies && comment.replies.length > 0) {
                for (const reply of comment.replies) {
                    if (reply.author &&
                        reply.author.toLowerCase() === username.toLowerCase() ||
                        reply.author.toLowerCase() === username.toLowerCase().replace('@', '')) {
                        return reply;
                    }
                }
            }
        }
    }
    return null;
}

// Adicionar função para configurar os event listeners de menções de usuários
function setupMentionListeners() {
    document.querySelectorAll('.user-mention').forEach(mention => {
        mention.addEventListener('click', function (e) {
            e.preventDefault();
            const commentId = this.getAttribute('data-comment-id');
            if (commentId) {
                // Se estamos em um vídeo do YouTube, tentar abrir o comentário
                const videoId = getYouTubeVideoId(activeTab.url);
                if (videoId) {
                    // Abrir o comentário no YouTube
                    const commentUrl = `https://www.youtube.com/watch?v=${videoId}&lc=${commentId}`;
                    chrome.tabs.create({ url: commentUrl });
                }
            }
        });
    });
}

// Extrair o ID do vídeo do YouTube da URL
function getYouTubeVideoId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    return match ? match[1] : null;
}

// Funções para controle da barra de progresso
function showProgress(message) {
    elements.progressContainer.style.display = 'block';
    elements.progressText.textContent = message;
    elements.progressBar.style.width = '0%';
}

function updateProgress(percentage, message) {
    elements.progressContainer.style.display = 'block';
    elements.progressBar.style.width = `${percentage}%`;
    elements.progressText.textContent = message;
}

function hideProgress() {
    elements.progressContainer.style.display = 'none';
}

// Funções para mensagens de erro
function showError(title, message) {
    hideProgress();
    elements.errorContainer.style.display = 'block';
    elements.errorContainer.querySelector('h3').textContent = title;
    elements.errorContainer.querySelector('p').textContent = message;
}

function hideError() {
    elements.errorContainer.style.display = 'none';
}

// Funções para mensagens de status
function setStatus(message, type = 'info') {
    const statusDot = elements.statusIndicator.querySelector('.status-dot');

    // Remover todas as classes de status anteriores
    statusDot.classList.remove('ready', 'error', 'loading', 'success');

    // Adicionar a classe correspondente ao tipo
    if (type) {
        statusDot.classList.add(type);
    }

    // Atualizar o tooltip
    elements.statusIndicator.setAttribute('title', message);
}

// Funções para gerenciar configurações
function toggleConfigPanel() {
    elements.configPanel.classList.toggle('open');
    const isOpen = elements.configPanel.classList.contains('open');

    // Atualizar o ícone e o título do botão
    if (isOpen) {
        elements.toggleConfigBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        elements.toggleConfigBtn.title = 'Fechar Configurações';
    } else {
        elements.toggleConfigBtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
        elements.toggleConfigBtn.title = 'Configurações';
    }
}

function saveApiKey() {
    const apiKey = elements.apiKeyInput.value.trim();

    if (!apiKey) {
        showError('API Key Inválida', 'Por favor, insira uma API Key válida');
        return;
    }

    // Se a entrada contiver asteriscos e já tivermos uma chave armazenada,
    // mantenha a chave existente
    if (apiKey.includes('*') && activeApiKey) {
        elements.statusMessage.textContent = 'API Key mantida';
        return;
    }

    activeApiKey = apiKey;

    chrome.storage.sync.set({ apiKey: apiKey }, function () {
        elements.apiKeyInput.value = maskApiKey(apiKey);
        elements.statusMessage.textContent = 'API Key salva com sucesso';
    });
}

function maskApiKey(apiKey) {
    if (!apiKey) return '';

    // Mostrar apenas os primeiros 4 e últimos 4 caracteres
    if (apiKey.length > 8) {
        return apiKey.substring(0, 4) + '************************' + apiKey.substring(apiKey.length - 4);
    }

    return apiKey;
}

function updateMaxComments() {
    const value = parseInt(elements.maxCommentsInput.value);
    if (isNaN(value) || value < 10) {
        elements.maxCommentsInput.value = 10;
        maxComments = 10;
    } else if (value > 1000) {
        elements.maxCommentsInput.value = 1000;
        maxComments = 1000;
    } else {
        maxComments = value;
    }

    chrome.storage.sync.set({ maxComments: maxComments });
}

async function testApiConnection() {
    const apiKey = elements.apiKeyInput.value.trim();

    if (!apiKey || apiKey.includes('*')) {
        if (!activeApiKey) {
            showError('API Key Necessária', 'Por favor, insira uma API Key válida');
            return;
        }
    } else {
        activeApiKey = apiKey;
    }

    const selectedModel = elements.modelSelect.value;

    if (!selectedModel) {
        showError('Modelo Necessário', 'Por favor, selecione um modelo');
        return;
    }

    setStatus('Testando conexão com a API...', 'loading');

    try {
        const result = await window.OpenAIService.testConnection(activeApiKey, selectedModel);

        if (result.success) {
            setStatus('Conexão com a API estabelecida com sucesso!', 'success');
        } else {
            showError('Falha na conexão', result.error || 'Não foi possível conectar à API OpenAI');
        }
    } catch (error) {
        console.error('Erro ao testar a API:', error);
        showError('Erro no teste', error.message);
    }
}

// Preenche o select de modelos disponíveis
function populateModelSelect() {
    const models = window.ConfigService.getAvailableModels();
    const defaultModel = window.ConfigService.getDefaultModel();

    elements.modelSelect.innerHTML = '';

    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        elements.modelSelect.appendChild(option);
    });

    // Selecionar o modelo padrão ou o salvo anteriormente
    if (activeModel) {
        elements.modelSelect.value = activeModel;
    } else {
        elements.modelSelect.value = defaultModel;
        activeModel = defaultModel;
    }

    // Salvar o modelo selecionado quando alterado
    elements.modelSelect.addEventListener('change', function () {
        activeModel = this.value;
        chrome.storage.sync.set({ model: activeModel });
    });
}

// Limpa os resultados anteriores
function clearResults() {
    elements.analysisResults.innerHTML = '';
    elements.tabsContainer.innerHTML = '';
    hideError();
} 
