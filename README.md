# TicketBot Pro - Sistema de Pagamento

Este é o sistema de pagamento para o TicketBot Pro, um bot de tickets para Discord.

## Instalação e Execução

Para rodar o sistema de pagamento, siga os passos abaixo:

### 1. Instalação das dependências

```bash
# Instalar dependências do backend
cd site/backend
npm install
```

### 2. Configuração

Antes de executar o sistema, você precisa:

1. Adicionar sua imagem do QR Code PIX em `site/assets/qr-code-pix.png`
2. Editar o arquivo `site/backend/server.js` e substituir `'sua-chave-pix-aqui'` pela sua chave PIX real

### 3. Execução

```bash
# Iniciar o servidor backend
cd site/backend
npm start
```

Acesse o sistema em: http://localhost:3000

## Funcionalidades

- **Sistema de Checkout**: Permite ao usuário finalizar a compra do bot
- **Pagamento via PIX**: Implementação segura de pagamento via PIX
- **Verificação Automática**: Sistema de verificação automática do pagamento
- **Confirmação por Email**: Envio de confirmação após pagamento (a ser implementado)

## Integrando com Serviços de Pagamento PIX

Para integrar com APIs reais de pagamento PIX, você precisará modificar o arquivo `site/backend/server.js` para se conectar ao seu provedor de pagamento preferido.

Exemplos de provedores:
- Mercado Pago
- PagSeguro
- Gerencianet
- Outros bancos com API PIX

## Modo de Teste

O sistema inclui um botão para simular pagamentos para fins de teste. Em produção, remova o botão `Simular Pagamento` do arquivo `site/checkout.html`.

## Personalizando

Você pode personalizar:
- Aparência: editando os arquivos CSS em `site/style.css` e `site/checkout.css`
- Textos e mensagens: editando o arquivo `site/checkout.html`
- Lógica de pagamento: editando o arquivo `site/backend/server.js`

## Suporte

Em caso de dúvidas, entre em contato com kyz28 no Discord. 