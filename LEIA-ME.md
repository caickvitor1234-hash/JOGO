# Sala de Jogos

Site multiplayer para jogar com amigos pelo navegador, cada pessoa no próprio celular ou computador. **Os jogadores não precisam criar conta nem fazer login**: basta abrir o link, escolher um apelido e criar/entrar em uma sala pelo código.

## Jogos incluídos

- **Metrópole**: 2 a 6 jogadores.
- **Cidade Dorme**: 4 a 12 jogadores.

O projeto usa Node.js, Express e WebSocket. O chat de voz usa WebRTC diretamente entre os navegadores, sem conta externa. O navegador pede permissão de microfone quando a pessoa toca em “Entrar no chat de voz”.

## Publicação recomendada (Render)

O arquivo `render.yaml` já está preparado para criar um serviço Node na região da Virgínia, com HTTPS, WebSocket, verificação de saúde e disco persistente para guardar os dados das salas entre reinícios.

1. Coloque o conteúdo desta pasta em um repositório Git (por exemplo, no GitHub).
2. Entre na sua conta Render e escolha criar um **Blueprint** a partir desse repositório.
3. O Render vai ler `render.yaml`, mostrar os recursos e o custo antes de confirmar.
4. Confirme a criação e aguarde o primeiro deploy terminar. O endereço público aparecerá no painel do serviço.
5. Abra `/health` no endereço gerado; a resposta esperada é `ok`.

**Importante:** esta é uma aplicação com servidor WebSocket. Não publique como “Static Site”. O serviço deve ser um **Web Service**.

### Teste gratuito (com limitações)

Há uma configuração alternativa em `render-free.yaml`. Para usá-la como Blueprint, faça uma cópia com o nome `render.yaml` antes de enviar o repositório. A versão gratuita pode desligar depois de 15 minutos sem tráfego, demora para acordar e não tem disco persistente. Portanto, é adequada para experimentar, mas não é a opção recomendada para partidas que precisam ficar estáveis.

## Rodar localmente

Requer Node.js 18 ou mais novo.

```bash
npm install
npm start
```

Abra `http://localhost:3000`.

## Dados e salas

As salas são guardadas em `salas.json`. Em produção, defina `DATA_DIR` para um disco persistente (o `render.yaml` já usa `/var/data`). O serviço foi preparado para uma única instância Node; não aumente o número de instâncias sem antes migrar o estado das salas para um armazenamento compartilhado.

## Chat de voz

O chat usa WebRTC e servidores STUN públicos para estabelecer a ligação. É necessário HTTPS e permissão do microfone. Em algumas redes móveis, empresariais ou com NAT restritivo, a ligação direta pode falhar; nesses casos, configure um servidor TURN na variável `ICE_SERVERS`, em formato JSON, por exemplo:

```json
[
  {"urls":"stun:stun.l.google.com:19302"},
  {"urls":"turn:SEU_SERVIDOR:3478","username":"USUARIO","credential":"SENHA"}
]
```

A voz foi pensada para grupos pequenos; para grupos maiores, o ideal é utilizar um serviço de voz dedicado.

## Instalar como app

Depois da publicação em HTTPS, no celular ou computador use a opção do navegador **“Adicionar à tela inicial”** / **“Instalar”**.
