// Adicionar um listener para o evento de instalação
chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === 'install') {
        // Ações a serem realizadas na primeira instalação
        console.log('Extensão YouTube Comments Extractor instalada com sucesso!');
    } else if (details.reason === 'update') {
        // Ações a serem realizadas quando a extensão for atualizada
        console.log('Extensão YouTube Comments Extractor atualizada para a versão ' + chrome.runtime.getManifest().version);
    }
});

// Configurar a ação do ícone na barra de ferramentas
chrome.action.onClicked.addListener(function (tab) {
    // Se não estivermos em uma página do YouTube, alertamos o usuário
    if (!tab.url.includes('youtube.com/watch')) {
        chrome.action.setPopup({ popup: '' });  // Remover o popup

        // Enviar uma mensagem para o content script (se estiver rodando)
        chrome.tabs.sendMessage(tab.id, { action: 'showAlert' }, function (response) {
            // Se houver erro, significa que o content script não está rodando
            if (chrome.runtime.lastError) {
                // Mostrar um alerta usando programaticamente uma janela
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: () => {
                        alert('Esta extensão funciona apenas em páginas de vídeos do YouTube.');
                    }
                });
            }
        });
    } else {
        // Se estivermos em uma página do YouTube, configuramos o popup
        chrome.action.setPopup({ popup: 'popup.html' });
    }
});

// Inicializamos o contexto de mensagens para comunicação com os content scripts
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log('Mensagem recebida no background:', request);

    // Verificar content script
    if (request.action === 'checkContentScript') {
        const tabId = request.tabId;

        chrome.tabs.sendMessage(tabId, { action: 'ping' }, function (response) {
            if (chrome.runtime.lastError) {
                // Content script não está injetado, tentamos injetá-lo
                console.log('Content script não injetado, tentando injetar...');

                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                }).then(() => {
                    console.log('Content script injetado com sucesso');
                    sendResponse({ status: 'injected' });
                }).catch(error => {
                    console.error('Erro ao injetar content script:', error);
                    sendResponse({ status: 'error', error: error.message });
                });
            } else {
                console.log('Content script já está ativo');
                sendResponse({ status: 'active' });
            }
        });

        return true; // Mantém o canal de mensagem aberto para resposta assíncrona
    }

    // Notificação de que o content script está pronto
    if (request.action === 'contentScriptReady') {
        console.log('Content script está pronto na tab ' + sender.tab.id);
        sendResponse({ acknowledged: true });
        return false;
    }

    // Abrir popup com análise salva
    if (request.action === 'openPopupWithSavedAnalysis') {
        const videoId = request.videoId;
        console.log('Solicitação para abrir popup com análise salva para o vídeo:', videoId);

        // Armazenamos o videoId para que o popup saiba qual análise carregar
        chrome.storage.session.set({ 'loadAnalysisForVideo': videoId }, function () {
            // Abrimos o popup diretamente
            chrome.action.openPopup();
            sendResponse({ status: 'opening_popup' });
        });

        return true; // Mantém o canal de mensagem aberto para resposta assíncrona
    }
}); 