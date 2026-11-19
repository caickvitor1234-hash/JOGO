# Sala de Jogos

Site/app para jogar com amigos, cada um no seu aparelho (celular ou PC), com chat de voz já embutido.
Jogos: **Metrópole** (2 a 6) e **Cidade Dorme** (4 a 12). O Metrópole agora inclui 73 cartas de acontecimentos, três baús surpresa para escolher ao cair em uma casa de Sorte, amuletos que bloqueiam uma penalidade financeira e efeitos que podem atingir todos os jogadores ou trocar posições. O dinheiro é fictício e faz parte da partida; não há apostas com dinheiro real.

Para adicionar um jogo novo: crie um módulo em `server.js` (com `init`, `act` e `view`) e um cartão em `GM` no `public/index.html`.

## Rodar no seu computador
1. Instale o Node.js 18 ou mais novo.
2. Na pasta do projeto: `npm install` e depois `npm start`.
3. Abra `http://localhost:3000` em duas abas para testar uma sala.

## Colocar no ar
Use um serviço que mantenha o servidor sempre ligado (Render, Railway ou Fly.io, em plano pago de entrada).
- Comando de início: `npm start`. Endereço de checagem de saúde: `/health`.
- Precisa de HTTPS (esses serviços já dão). Sem HTTPS o navegador bloqueia o microfone.
- Para as salas sobreviverem a reinícios, use um disco persistente e aponte `DATA_DIR` para ele. Sem disco, as salas abertas se perdem quando o servidor reinicia.

## Chat de voz (nativo, sem conta externa)
Funciona direto: cada jogador clica em "Entrar no chat de voz" e permite o microfone. A voz vai de aparelho a aparelho (WebRTC), sem passar pelo servidor.
- Na Cidade Dorme o microfone é cortado sozinho de noite e para quem foi eliminado.
- Em redes muito restritas (alguns 4G, empresas) a ligação direta pode falhar. Para resolver, configure um servidor TURN (por exemplo no Metered ou no Twilio) e passe a lista na variável `ICE_SERVERS`, em JSON:
  `[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:SEU-TURN:3478","username":"usuario","credential":"senha"}]`
- Funciona bem para grupos de até uns 6 a 8 jogadores. Para salas maiores o ideal é trocar por um servidor de voz (LiveKit).

## Imagens e vídeos
Coloque arquivos em `public/img/` com o nome da cidade sem acento e sem espaço:
- Foto: `saopaulo.jpg`, `riodejaneiro.jpg`, `florianopolis.jpg` ...
- Vídeo curto (opcional): `saopaulo.mp4` (toca sem som, em repetição)
Eles aparecem nos cartões de evento por cima da ilustração padrão. O pacote já inclui dezoito artes em `public/img/` para os novos eventos: `treasure.jpg`, `clover.jpg`, `dark-dice.jpg`, `wheel.jpg`, `shield.jpg`, `coins.jpg`, `mystery.jpg`, `blackcat.jpg` e `storm.jpg`. Mantenha esses nomes para que as artes apareçam nos lugares certos.

## Instalar como app
No celular ou no PC, use "Instalar" / "Adicionar à tela inicial" no navegador.

## Ainda não tem
Negociação livre entre jogadores, leilão manual com lances simultâneos, contas de usuário, sons e animação do peão andando.
Teste com amigos antes de divulgar: este pacote foi checado só quanto à sintaxe, não com várias pessoas ao mesmo tempo.
