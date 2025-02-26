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
    if (request.action === 'getVideoInfo') {
        // Se o content script solicitar informações do vídeo
        if (sender.tab) {
            const videoId = new URL(sender.tab.url).searchParams.get('v');
            if (videoId) {
                sendResponse({ videoId: videoId });
            } else {
                sendResponse({ error: 'ID do vídeo não encontrado' });
            }
        }
        return true;
    } else if (request.action === 'contentScriptReady') {
        // Content script está pronto
        console.log('Content script está ativo na tab:', sender.tab.id);
        sendResponse({ status: 'acknowledged' });
        return true;
    } else if (request.action === 'checkContentScript') {
        // Checar se o content script está ativo em uma tab específica
        if (request.tabId) {
            chrome.tabs.sendMessage(request.tabId, { action: 'ping' }, function (response) {
                if (chrome.runtime.lastError) {
                    console.log('Content script não está ativo na tab:', request.tabId);
                    // Injetar o content script se não estiver ativo
                    chrome.scripting.executeScript({
                        target: { tabId: request.tabId },
                        files: ['content.js']
                    }).then(() => {
                        console.log('Content script injetado na tab:', request.tabId);
                        sendResponse({ status: 'injected' });
                    }).catch(err => {
                        console.error('Erro ao injetar content script:', err);
                        sendResponse({ status: 'error', error: err.message });
                    });
                } else {
                    console.log('Content script já está ativo na tab:', request.tabId);
                    sendResponse({ status: 'active' });
                }
            });
            return true;
        }
    }
}); 