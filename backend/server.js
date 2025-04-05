const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Chave PIX fixa
const PIX_KEY = 'a478c1f5-3f18-47e6-97a6-97a8-6d062bcbc682';
const PIX_VALOR_FIXO = 10.00;

// Webhook do Discord para notificações de vendas
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1358080139640049674/v2PhjcRAxu8GxwXo_1mLf9eyLphTI9Rh7EkIC6pFG44WP6KvjykYUApSajccRXSPRJre';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..')));

// Diretório para armazenar os QR codes gerados
const qrCodeDir = path.join(__dirname, '../assets/qrcodes');
if (!fs.existsSync(qrCodeDir)) {
    fs.mkdirSync(qrCodeDir, { recursive: true });
}

// Armazenamento temporário para registros de pagamentos
// Na implementação real, você usaria um banco de dados
const paymentStore = {
    transactions: {},
};

// Função para gerar payload do PIX
function gerarPayloadPix(valor, txid, nome = 'TicketBot Pro', cidade = 'SAO PAULO') {
    // Dados do beneficiário da transferência
    const pixKey = PIX_KEY;
    
    // Limita o nome a 25 caracteres
    nome = nome.substring(0, 25);
    
    // Limita a cidade a 15 caracteres
    cidade = cidade.substring(0, 15);
    
    // Função para calcular o CRC16
    function crc16CCITT(str) {
        let crc = 0xFFFF;
        const polynomial = 0x1021;
        
        for (let i = 0; i < str.length; i++) {
            let c = str.charCodeAt(i);
            for (let j = 0; j < 8; j++) {
                let bit = ((c >> (7 - j) & 1) == 1);
                let c15 = ((crc >> 15 & 1) == 1);
                crc <<= 1;
                if (c15 ^ bit) crc ^= polynomial;
            }
        }
        
        crc &= 0xFFFF;
        return crc.toString(16).padStart(4, '0').toUpperCase();
    }
    
    // Construindo os campos do payload PIX
    const payload = [
        // Payload Format Indicator
        '000201',
        // Merchant Account Information - Cartão de Crédito
        '26',
        // GUI do BR Code
        '00' + pad('br.gov.bcb.pix', 21),
        // Chave PIX
        '01' + pad(pixKey, pixKey.length),
        // Merchant Category Code - Transferência
        '52040000',
        // Transaction Currency - Real
        '5303986',
        // Transaction Amount
        '54' + pad(valor.toFixed(2), 4),
        // Country Code - BR
        '5802BR',
        // Merchant Name
        '59' + pad(nome, 2),
        // Merchant City
        '60' + pad(cidade, 2),
        // Identificador de transação (txid)
        '05' + pad(txid, 2),
        // CRC16 (será calculado e adicionado posteriormente)
        '6304'
    ];
    
    // Calcula o tamanho dos campos dinâmicos
    function pad(str, headerLength) {
        str = String(str);
        return str.length.toString().padStart(headerLength, '0') + str;
    }
    
    // Monta o payload
    let payloadString = payload.join('');
    
    // Calcula o CRC16
    const crc = crc16CCITT(payloadString);
    
    // Adiciona o CRC ao payload
    payloadString += crc;
    
    return payloadString;
}

// Gera um ID de transação único
function generateTransactionId() {
    return 'TRX' + Date.now() + Math.floor(Math.random() * 1000);
}

// Função para enviar notificação para o Discord
async function sendDiscordNotification(transaction) {
    try {
        const webhookData = {
            username: "Sistema de Vendas",
            avatar_url: "https://i.imgur.com/4M34hi2.png",
            embeds: [{
                title: "🎉 Venda Confirmada!",
                color: 3066993, // Verde
                description: `Uma nova venda do TicketBot Pro foi confirmada!`,
                fields: [
                    {
                        name: "📦 Produto",
                        value: "TicketBot Pro - Plano Básico",
                        inline: true
                    },
                    {
                        name: "💰 Valor",
                        value: `R$ ${transaction.amount.toFixed(2)}`,
                        inline: true
                    },
                    {
                        name: "🔢 ID da Transação",
                        value: transaction.id,
                        inline: false
                    },
                    {
                        name: "📅 Data e Hora",
                        value: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
                        inline: false
                    }
                ],
                thumbnail: {
                    url: "https://i.imgur.com/4M34hi2.png"
                },
                footer: {
                    text: "Sistema de Vendas TicketBot Pro",
                    icon_url: "https://i.imgur.com/4M34hi2.png"
                },
                timestamp: new Date()
            }]
        };

        await axios.post(DISCORD_WEBHOOK_URL, webhookData);
        console.log('✅ Notificação enviada para o Discord com sucesso');
    } catch (error) {
        console.error('❌ Erro ao enviar notificação para o Discord:', error);
    }
}

// Rota para iniciar uma nova transação
app.post('/api/create-transaction', async (req, res) => {
    const { amount = PIX_VALOR_FIXO, plan = 'básico' } = req.body;
    
    const transactionId = generateTransactionId();
    
    try {
        // Gerar payload PIX
        const pixPayload = gerarPayloadPix(
            amount,
            transactionId,
            'TicketBot Pro',
            'BRASIL'
        );
        
        // Gerar QR Code
        const qrCodeFilename = `${transactionId}.png`;
        const qrCodePath = path.join(qrCodeDir, qrCodeFilename);
        
        await qrcode.toFile(qrCodePath, pixPayload, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300
        });
        
        // URL pública para o QR Code
        const qrCodeUrl = `/assets/qrcodes/${qrCodeFilename}`;
        
        // Armazenar informações da transação
        paymentStore.transactions[transactionId] = {
            id: transactionId,
            amount,
            plan,
            status: 'pending',
            createdAt: new Date(),
            pixPayload,
            qrCodeUrl
        };
        
        res.json({
            success: true,
            transactionId,
            pixKey: PIX_KEY,
            pixPayload,
            qrCodeUrl,
            amount
        });
    } catch (error) {
        console.error('Erro ao criar transação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar QR Code PIX'
        });
    }
});

// Rota para verificar o status do pagamento
app.get('/api/check-payment-status/:transactionId', (req, res) => {
    const { transactionId } = req.params;
    
    if (!paymentStore.transactions[transactionId]) {
        return res.status(404).json({
            success: false,
            message: 'Transação não encontrada'
        });
    }
    
    // Aqui você implementaria a verificação real com sua API de pagamentos PIX
    // Por enquanto, vamos apenas simular
    
    const transaction = paymentStore.transactions[transactionId];
    
    res.json({
        success: true,
        transactionId,
        status: transaction.status,
        amount: transaction.amount
    });
});

// Rota para cancelar uma transação após o timeout
app.post('/api/cancel-transaction/:transactionId', (req, res) => {
    const { transactionId } = req.params;
    
    if (!paymentStore.transactions[transactionId]) {
        return res.status(404).json({
            success: false,
            message: 'Transação não encontrada'
        });
    }
    
    // Marca a transação como expirada
    paymentStore.transactions[transactionId].status = 'expired';
    paymentStore.transactions[transactionId].expiredAt = new Date();
    
    console.log(`Transação ${transactionId} expirada por timeout (10 minutos)`);
    
    res.json({
        success: true,
        message: 'Transação cancelada com sucesso'
    });
});

// Rota para simular a confirmação do pagamento (apenas para testes)
app.post('/api/simulate-payment', async (req, res) => {
    const { transactionId } = req.body;
    
    if (!transactionId || !paymentStore.transactions[transactionId]) {
        return res.status(404).json({
            success: false,
            message: 'Transação não encontrada'
        });
    }
    
    const transaction = paymentStore.transactions[transactionId];
    transaction.status = 'confirmed';
    transaction.confirmedAt = new Date();
    
    // Enviar notificação para o Discord
    await sendDiscordNotification(transaction);
    
    res.json({
        success: true,
        message: 'Pagamento confirmado com sucesso'
    });
});

// Adicionar uma rota para receber confirmações reais do sistema de pagamentos
// Essa rota seria chamada pelo seu provedor de pagamentos PIX
app.post('/api/payment-notification', async (req, res) => {
    const { txid, status } = req.body;
    
    // Buscar a transação pelo txid (que pode estar em um formato diferente)
    const transactionId = Object.keys(paymentStore.transactions).find(
        id => paymentStore.transactions[id].id === txid || id === txid
    );
    
    if (!transactionId || !paymentStore.transactions[transactionId]) {
        return res.status(404).json({
            success: false,
            message: 'Transação não encontrada'
        });
    }
    
    const transaction = paymentStore.transactions[transactionId];
    
    // Atualizar o status da transação
    if (status === 'approved' || status === 'confirmed' || status === 'paid') {
        transaction.status = 'confirmed';
        transaction.confirmedAt = new Date();
        
        // Enviar notificação para o Discord
        await sendDiscordNotification(transaction);
    }
    
    res.json({
        success: true,
        message: 'Notificação de pagamento processada com sucesso'
    });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
}); 