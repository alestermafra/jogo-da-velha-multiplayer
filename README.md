# 🎮 Jogo da Velha Online (Multiplayer para Celular)

Um jogo da velha simples, moderno e em tempo real, feito especialmente para jogar pelo celular compartilhando um link diretamente pelo **GitHub Codespaces**.

---

## 🚀 Como Rodar no GitHub Codespaces

### 1. Iniciar o Servidor
Abra o terminal do Codespaces e execute:
```bash
npm start
```
*(ou se preferir, `node server.js` - não precisa instalar nenhuma dependência externa!)*

### 2. Tornar a Porta Pública no Codespaces (Essencial para o Celular)
Para que o link funcione no celular seu e do seu sobrinho sem pedir login do GitHub:

1. Na parte inferior do Codespaces, clique na aba **PORTS** (ou **PORTAS**).
2. Localize a porta **3000**.
3. Na coluna **Port Visibility** (Visibilidade da Porta), clique com o botão direito (ou duplo clique) e mude de **Private** para **Public** (Pública).
4. Passe o mouse sobre o endereço em **Forwarded Address** e clique no ícone de copiar (ou no ícone de globo para abrir no navegador).

> 💡 **Dica automática**: Já incluímos o arquivo `.devcontainer/devcontainer.json` que configura a porta 3000 automaticamente como pública ao iniciar o Codespaces!

---

## 📱 Como Jogar com o seu Sobrinho

1. Abra o link gerado no seu celular.
2. Você entrará na sala como **Jogador 1 (❌)**.
3. Toque no botão verde **"📲 Convidar Sobrinho"**:
   - Você pode enviar diretamente pelo **WhatsApp** com uma mensagem pronta!
   - Ou tocar em **"Copiar Link"** e colar para ele.
4. Quando seu sobrinho clicar no link no celular dele, ele entrará automaticamente como **Jogador 2 (⭕)**.
5. A partida começa na hora, em tempo real!

---

## ✨ Recursos

- ⚡ **Tempo Real Instantâneo:** Jogadas sincronizadas via Server-Sent Events (SSE).
- 📲 **Feito para Celular:** Interface responsiva, botões grandes e confortáveis ao toque.
- 🔊 **Efeitos Sonoros Retrô:** Sons de jogada, fanfarra de vitória e empate (gerados via Web Audio API, sem precisar baixar arquivos de som).
- 📳 **Vibração Tátil:** Vibra o celular ao marcar e ao vencer (quando suportado pelo aparelho).
- 🎊 **Chuva de Confetes:** Animação festiva para comemorar quem ganhou a partida.
- 📊 **Placar Automático:** Contabiliza vitórias do X, vitórias do O e empates.
- 🔄 **Jogar Novamente:** Botão de revanche imediata sem precisar gerar outro link.
- 😂 **Reações Rápidas:** Barra de emojis (🔥, 😂, 👏, 🥳, 😱, 🤖) que flutuam na tela de ambos durante o jogo.
- 0️⃣ **Zero Dependências:** Feito com Node.js puro, rápido, leve e sem risco de quebras de versões de pacotes.

