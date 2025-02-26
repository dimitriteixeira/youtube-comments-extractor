// Este é um script que pode ser executado no Node.js com a biblioteca canvas
// para gerar ícones para a extensão. É apenas para referência.
// Para usar, instale a biblioteca canvas: npm install canvas

const { createCanvas } = require('canvas');
const fs = require('fs');

// Tamanhos dos ícones
const sizes = [16, 48, 128];

// Função para criar um ícone
function createIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Fundo
    ctx.fillStyle = '#cc0000'; // Vermelho do YouTube
    ctx.fillRect(0, 0, size, size);

    // Símbolo de comentário
    ctx.fillStyle = 'white';
    const margin = size * 0.15;
    const width = size - 2 * margin;
    const height = size - 2 * margin;

    // Bolha de comentário
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin + width, margin);
    ctx.lineTo(margin + width, margin + height * 0.7);
    ctx.lineTo(margin + width * 0.7, margin + height * 0.7);
    ctx.lineTo(margin + width * 0.5, margin + height);
    ctx.lineTo(margin + width * 0.5, margin + height * 0.7);
    ctx.lineTo(margin, margin + height * 0.7);
    ctx.closePath();
    ctx.fill();

    // Linhas de texto
    ctx.fillStyle = '#cc0000';
    const lineHeight = size * 0.1;
    const lineMargin = size * 0.25;

    ctx.fillRect(lineMargin, margin + height * 0.25, width * 0.5, lineHeight);
    ctx.fillRect(lineMargin, margin + height * 0.45, width * 0.7, lineHeight);

    // Exportar para PNG
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(`icon${size}.png`, buffer);
    console.log(`Ícone ${size}x${size} criado!`);
}

// Criar os ícones
sizes.forEach(createIcon); 