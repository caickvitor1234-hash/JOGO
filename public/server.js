const express=require("express"),http=require("http"),{WebSocketServer}=require("ws"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const app=express(),srv=http.createServer(app),wss=new WebSocketServer({server:srv,maxPayload:100000,perMessageDeflate:false});
app.disable("x-powered-by");
app.use(express.static(path.join(__dirname,"public"),{etag:true,maxAge:"1h"}));
app.get("/health",(q,r)=>r.send("ok"));
app.get("/ice",(q,r)=>{
  let s=[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}];
  try{if(process.env.ICE_SERVERS)s=JSON.parse(process.env.ICE_SERVERS)}catch{}
  r.json(s);
});

const R={},rnd=n=>crypto.randomInt(n),uid=()=>crypto.randomBytes(16).toString("hex");
const ROOM_ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const roomCode=()=>Array.from({length:6},()=>ROOM_ALPHABET[crypto.randomInt(ROOM_ALPHABET.length)]).join("");
const cleanName=value=>String(value??"Jogador").replace(/[<>`"'&]/g,"").replace(/[\u0000-\u001f\u007f]/g,"").replace(/\s+/g," ").trim().slice(0,14)||"Jogador";

/* ================= METRÓPOLE ================= */
const T=[["Largada","s"],["Cuiabá","p",60,0],["Sorte","c"],["Campo Grande","p",60,0],["Imposto","x",200],["Ferrovia Norte","r",200],["Palmas","p",100,1],["Sorte","c"],["Feira de Negócios","m"],["Aracaju","p",120,1],["Cadeia","j"],["Natal","p",140,2],["Companhia de Luz","u",150],["João Pessoa","p",140,2],["Festival da Cidade","e"],["Ferrovia Leste","r",200],["Teresina","p",180,3],["Mega-Sena","l"],["Obras Públicas","o"],["Florianópolis","p",200,3],["Parque","f"],["Bolsa de Títulos","b"],["Sorte","c"],["Belém","p",220,4],["Fortaleza","p",240,4],["Ferrovia Sul","r",200],["Recife","p",260,5],["Leilão Municipal","a"],["Companhia de Água","u",150],["Porto Alegre","p",280,5],["Vá preso","g"],["Salvador","p",300,6],["Conselho da Cidade","q"],["Sorte","c"],["Brasília","p",320,6],["Ferrovia Oeste","r",200],["Viagem Premiada","v"],["São Paulo","p",350,7],["Imposto","x",100],["Rio de Janeiro","p",400,7]];
const MULT=[1,2,4,8,13,20,30];
const full=(s,i)=>T.every((u,j)=>u[3]!==T[i][3]||s.own[j]===s.own[i]);
const rent=(s,i,n)=>{
  const t=T[i],o=s.own[i];
  if(s.mort[i])return 0;
  if(t[1]=="r")return 25*2**(T.filter((u,j)=>u[1]=="r"&&s.own[j]==o).length-1);
  if(t[1]=="u")return n*(T.filter((u,j)=>u[1]=="u"&&s.own[j]==o).length>1?10:4);
  const h=s.h[i];return t[2]/10*MULT[h?h+1:full(s,i)?1:0];
};
const CARDS=[
  ["Você ganhou na loteria: +R$150",(s,p)=>{p.m+=150}],
  ["Conserto do carro: você pagou R$100.",(s,p)=>{p.m-=100}],
  ["Restituição do imposto de renda: +R$200",(s,p)=>{p.m+=200}],
  ["Multa de trânsito: você pagou R$80.",(s,p)=>{p.m-=80}],
  ["Aniversário! Cada jogador vivo paga R$30 a você.",(s,p)=>s.p.forEach(q=>{if(q!=p&&q.a){q.m-=30;p.m+=30}})],
  ["Fiscalização! Você vai direto para a cadeia e perde a próxima vez.",(s,p)=>{p.pos=10;p.j=1}],
  ["Avance até a Largada e receba R$200.",(s,p)=>{p.pos=0;p.m+=200}],
  ["Reforma obrigatória: você paga R$25 por casa que possui (hotel conta como 5).",(s,p)=>{p.m-=25*s.h.reduce((a,h,i)=>a+(s.own[i]==p.i?h:0),0)}],
  ["Você achou R$50 na rua. +R$50",(s,p)=>{p.m+=50}],
  ["Viagem de férias: você pagou R$120.",(s,p)=>{p.m-=120}],
  ["Herança de um tio distante: +R$300",(s,p)=>{p.m+=300}],
  ["Festa na rua! Você paga R$20 a cada jogador vivo.",(s,p)=>s.p.forEach(q=>{if(q!=p&&q.a){q.m+=20;p.m-=20}})],
  ["Bilhete premiado! Você ganhou uma aposta grátis na Mega-Sena. Escolha seus seis números.",(s,p)=>"lottery"],
  ["Pacote de férias! Você ganhou uma viagem grátis. Escolha o destino e receba R$150 de ajuda de custo.",(s,p)=>"travel"],
  ["Promoção de companhia aérea: viagem grátis para qualquer destino do tabuleiro! +R$100 de ajuda de custo.",(s,p)=>"travel"],
  ["Prêmio cultural: +R$250 por participar de um festival em outra cidade.",(s,p)=>{p.m+=250}],
  ["Seu negócio fechou um contrato nacional. +R$350.",(s,p)=>{p.m+=350}],
  ["Você ganhou um pacote turístico com tudo pago! Escolha uma cidade para visitar.",(s,p)=>"travel"],
  ["Reembolso de passagem: +R$120.",(s,p)=>{p.m+=120}],
  ["A prefeitura sorteou um bônus para empreendedores. +R$200.",(s,p)=>{p.m+=200}],
  ["Feira de empregos: você recebeu R$100 por um trabalho temporário.",(s,p)=>{p.m+=100}],
  ["Reforma da praça: cada jogador recebe R$30 do município.",(s,p)=>s.p.forEach(q=>{if(q.a)q.m+=30})],
  ["Seu seguro cobriu um imprevisto. +R$180.",(s,p)=>{p.m+=180}],
  ["A conta de manutenção chegou: pague R$30 por construção.",(s,p)=>{p.m-=30*s.h.reduce((a,h,i)=>a+(s.own[i]==p.i?h:0),0)}],
  ["Você alugou um espaço para um evento. +R$120.",(s,p)=>{p.m+=120}],
  ["Todos recebem um incentivo de R$40, pago pelo banco.",(s,p)=>s.p.forEach(q=>{if(q.a)q.m+=40})],
  ["Uma campanha publicitária deu certo! +R$160.",(s,p)=>{p.m+=160}],
  ["Você ajudou um vizinho: pague R$40 e receba R$100 de recompensa municipal.",(s,p)=>{p.m+=60}],
  ["O transporte público está em promoção. Avance até a próxima ferrovia.",(s,p)=>{let i=p.pos;do{i=(i+1)%40}while(T[i][1]!="r");p.pos=i}],
  ["Prêmio de participação comunitária: +R$90.",(s,p)=>{p.m+=90}]
];
const TRIPS=[{n:"Manaus",i:21},{n:"Fortaleza",i:24},{n:"Recife",i:26},{n:"Salvador",i:31},{n:"Rio de Janeiro",i:39},{n:"Florianópolis",i:19},{n:"Brasília",i:34}];
function broke(s){
  s.p.forEach((q,i)=>{
    if(!q.a||q.m>=0)return;
    const sold=[],mg=[];
    T.forEach((t,j)=>{if(s.own[j]==i)while(s.h[j]>0&&q.m<0){s.h[j]--;q.m+=Math.round(t[2]/20)*5;sold.push(t[0])}});
    T.forEach((t,j)=>{if(s.own[j]==i&&!s.mort[j]&&q.m<0&&!s.h[j]){s.mort[j]=1;q.m+=t[2]/2;mg.push(t[0])}});
    if(s.ev&&(sold.length||mg.length))s.ev.tx+=" 🏦 Para pagar a conta, "+q.n+(sold.length?" vendeu casas em "+[...new Set(sold)].join(", "):"")+(mg.length?(sold.length?" e":"")+" hipotecou "+mg.join(", "):"")+".";
    if(q.m<0){
      q.a=0;s.own=s.own.map(o=>o==i?-1:o);s.h=s.h.map((h,j)=>s.own[j]<0?0:h);s.mort=s.mort.map((m,j)=>s.own[j]<0?0:m);
      if(s.ev)s.ev.tx+=" 💥 "+q.n+" ficou sem dinheiro, faliu e saiu do jogo!";
    }
  });
  if(s.p.filter(q=>q.a).length==1)s.ph="win";
}
function beginAuction(s,i){
  const t=T[i];
  if(!t||!['p','r','u'].includes(t[1])||s.own[i]>=0){
    s.ev={i:s.p[s.cur].pos,ti:"Leilão cancelado",tx:"Não há uma propriedade livre disponível para leiloar.",d:0};s.ph="end";return;
  }
  s.auction={i,order:s.p.filter(q=>q.a).map(q=>q.i),idx:0,high:0,leader:-1,min:Math.max(20,Math.round(t[2]*0.25))};
  s.ph="auction";
  s.ev={i,ti:"Leilão aberto: "+t[0],tx:"Todos podem dar um lance. Cada jogador terá uma oportunidade; o maior lance leva a propriedade.",d:0};
}
function land(s,p,m0,pass,n){
  const i=p.pos,t=T[i],o=s.own[i];let ti=t[0],tx="",ph="end";
  if(t[1]=="p"||t[1]=="r"||t[1]=="u"){
    if(o<0){ph="buy";tx="Está livre! Se você comprar por R$"+t[2]+", cobra aluguel de quem parar aqui."}
    else if(o!=p.i){const r=rent(s,i,n),ow=s.p[o];p.m-=r;ow.m+=r;tx=!r?"Esta propriedade é de "+ow.n+", mas está hipotecada: você não paga nada.":"Esta propriedade é de "+ow.n+". Você pagou R$"+r+" de aluguel"+(s.h[i]?" (há "+(s.h[i]==5?"um hotel":s.h[i]+" casa(s)")+" construída(s))":"")+"."}
    else tx="Já é sua! Toque numa cidade sua para construir, se tiver todas da mesma cor."
  }else if(t[1]=="c"){const c=CARDS[rnd(CARDS.length)];ti="Carta de Sorte";tx=c[0];const special=c[1](s,p);if(special==="lottery"){ph="lottery";s.lotteryFree=1}else if(special==="travel"){ph="travel";s.travelReward=150}}
  else if(t[1]=="l"){ti="Mega-Sena Metrópole";tx="Escolha seis números de 1 a 60. A aposta custa R$50 e pode render até R$5.000!";ph="lottery";s.lotteryFree=0}
  else if(t[1]=="v"){ti="Viagem Premiada";tx="Você ganhou uma viagem grátis! Escolha uma cidade e receba R$150 de ajuda de custo.";ph="travel";s.travelReward=150}
  else if(t[1]=="m"){ti="Feira de Negócios";tx="Uma oportunidade comercial apareceu. Escolha fechar um contrato ou seguir adiante.";ph="market"}
  else if(t[1]=="e"){ti="Festival da Cidade";tx="Você pode organizar uma atração, investir no evento e receber retorno, ou apenas aproveitar a festa.";ph="festival"}
  else if(t[1]=="o"){ti="Obras Públicas";tx="A nova via expressa está aberta. Escolha avançar três casas ou receber uma compensação.";ph="works"}
  else if(t[1]=="b"){ti="Bolsa de Títulos";tx="O município está oferecendo títulos de investimento com retorno fixo. Você decide se participa.";ph="bonds"}
  else if(t[1]=="a"){ti="Leilão Municipal";tx="Uma propriedade livre irá a leilão entre os jogadores.";const free=T.map((u,j)=>({u,j})).filter(x=>['p','r','u'].includes(x.u[1])&&s.own[x.j]<0);if(free.length){beginAuction(s,free[rnd(free.length)].j);ph="auction"}else ph="end"}
  else if(t[1]=="q"){ti="Conselho da Cidade";tx="O conselho aprovou um programa de apoio. Você pode receber o benefício ou contribuir para que todos recebam.";ph="council"}
  else if(t[1]=="x"){p.m-=t[2];tx="Hora de pagar o governo: R$"+t[2]+" de imposto."}
  else if(t[1]=="g"){p.pos=10;p.j=1;tx="Você foi levado para a cadeia e perde a próxima vez."}
  else tx={s:"Você parou na Largada! Receba R$200 toda vez que passar por aqui.",j:"Só visitando a cadeia. Nada acontece.",f:"Parque livre: descanse, não ganha nem perde nada."}[t[1]];
  if(pass)tx+=" Você passou pela Largada: +R$200.";
  s.ev={i,ti,tx,d:p.m-m0};s.ph=ph;broke(s);
}
const M={min:2,max:6,
  init(pl){return{p:pl.map((q,i)=>({id:q.id,n:q.name,i,m:1500,pos:0,j:0,a:1})),own:T.map(()=>-1),h:T.map(()=>0),mort:T.map(()=>0),cur:0,ph:"roll",dice:[1,1],ev:null,lotteryFree:0,travelReward:150,auction:null}},
  act(s,pid,m){
    const me=s.p.find(q=>q.id==pid),p=s.p[s.cur];
    if(!me||!me.a||s.ph=="win")return;
    if(s.ph=="trade"){
      const tr=s.trade;if(!tr)return "Proposta indisponível.";
      if(me.i!==tr.seller)return "A proposta está aguardando resposta do proprietário.";
      if(m.a=="tradeAccept"){
        const buyer=s.p[tr.buyer],item=T[tr.i];
        if(!buyer||!buyer.a||s.own[tr.i]!==tr.seller||s.mort[tr.i]||s.h[tr.i])return "A propriedade não está mais disponível para negociação.";
        if(buyer.m<tr.amount)return "O comprador não tem mais dinheiro suficiente.";
        buyer.m-=tr.amount;me.m+=tr.amount;s.own[tr.i]=buyer.i;
        s.ev={i:tr.i,ti:"Negócio fechado!",tx:me.n+" vendeu "+item[0]+" para "+buyer.n+" por R$"+tr.amount+".",d:0};s.ph="end";s.trade=null;return;
      }
      if(m.a=="tradeReject"){
        s.ev={i:tr.i,ti:"Proposta recusada",tx:me.n+" recusou a oferta de R$"+tr.amount+" por "+T[tr.i][0]+".",d:0};s.ph="end";s.trade=null;return;
      }
      return "Escolha aceitar ou recusar a proposta.";
    }
    if(s.ph=="auction"){
      const au=s.auction;if(!au)return "Leilão indisponível.";
      const bidder=au.order[au.idx];if(me.i!==bidder)return "Aguarde a vez de outro jogador.";
      if(m.a=="auctionBid"){
        const amount=Math.floor(Number(m.amount));
        if(!Number.isFinite(amount)||amount<Math.max(au.min,au.high+10))return "O lance precisa ser de pelo menos R$"+Math.max(au.min,au.high+10)+".";
        if(amount>me.m)return "Você não tem dinheiro suficiente para esse lance.";
        au.high=amount;au.leader=me.i;
      }else if(m.a!="auctionPass")return "Escolha dar um lance ou passar.";
      au.idx++;
      if(au.idx>=au.order.length){
        const item=T[au.i];
        if(au.leader>=0){const winner=s.p[au.leader];winner.m-=au.high;s.own[au.i]=winner.i;s.ev={i:au.i,ti:"Leilão encerrado!",tx:winner.n+" arrematou "+item[0]+" por R$"+au.high+".",d:-au.high}}
        else s.ev={i:au.i,ti:"Leilão sem lances",tx:item[0]+" continua disponível para compra.",d:0};
        s.ph="end";s.auction=null;
      }
      return;
    }
    if(me!=p)return "Não é a sua vez.";
    if(m.a=="lottery"&&s.ph=="lottery"){
      const nums=Array.isArray(m.numbers)?m.numbers.map(Number):[];
      if(nums.length!=6||new Set(nums).size!=6||nums.some(n=>!Number.isInteger(n)||n<1||n>60))return "Escolha exatamente seis números diferentes, de 1 a 60.";
      const cost=s.lotteryFree?0:50;if(me.m<cost)return "Você precisa de R$50 para apostar. Escolha não participar ou aguarde sua próxima vez.";
      me.m-=cost;const draw=[];while(draw.length<6){const n=1+rnd(60);if(!draw.includes(n))draw.push(n)}
      const hits=nums.filter(n=>draw.includes(n)).length,prize=hits==6?5000:hits==5?1500:hits==4?400:hits==3?100:0;
      me.m+=prize;s.ev={i:me.pos,ti:"Resultado da Mega-Sena",tx:"Seus números: "+nums.slice().sort((a,b)=>a-b).join(", ")+". Sorteados: "+draw.slice().sort((a,b)=>a-b).join(", ")+". Você acertou "+hits+" número(s)! "+(prize?"Prêmio de R$"+prize+"!":"Desta vez não houve prêmio. Boa sorte na próxima!"),d:prize-cost};s.ph="end";s.lotteryFree=0;return;
    }
    if(m.a=="lotterySkip"&&s.ph=="lottery"){s.ev={i:me.pos,ti:"Mega-Sena",tx:"Você preferiu não apostar desta vez.",d:0};s.ph="end";s.lotteryFree=0;return}
    if(m.a=="travel"&&s.ph=="travel"){
      const dest=TRIPS.find(x=>x.i==Number(m.i));if(!dest)return "Escolha um destino válido.";
      const from=p.pos;p.pos=dest.i;const reward=s.travelReward||0;p.m+=reward;s.ev={i:dest.i,ti:"Viagem grátis para "+dest.n,tx:"Você viajou sem pagar passagem e recebeu R$"+reward+" de ajuda de custo. Aproveite a cidade!",d:reward};s.ph="end";s.travelReward=150;return;
    }
    if(m.a=="travelSkip"&&s.ph=="travel"){s.ev={i:me.pos,ti:"Viagem não utilizada",tx:"Você preferiu não utilizar a viagem agora.",d:0};s.ph="end";return}
    if(m.a=="marketOffer"&&s.ph=="market"){
      const i=Number(m.i),amount=Math.floor(Number(m.amount)),seller=s.own[i];
      if(!Number.isInteger(i)||!T[i]||!['p','r','u'].includes(T[i][1])||seller<0||seller===me.i||!s.p[seller]?.a)return "Escolha uma propriedade de outro jogador.";
      if(s.mort[i]||s.h[i])return "Propriedades hipotecadas ou com construções não entram nesta negociação.";
      if(!Number.isFinite(amount)||amount<1||amount>me.m)return "Informe uma oferta válida dentro do seu saldo.";
      s.trade={buyer:me.i,seller,i,amount};s.ph="trade";
      s.ev={i,ti:"Proposta enviada",tx:me.n+" ofereceu R$"+amount+" por "+T[i][0]+". Aguardando resposta de "+s.p[seller].n+".",d:0};return;
    }
    if(m.a=="marketDeal"&&s.ph=="market"){
      if(me.m<50)return "Você precisa de R$50 para fechar o contrato.";
      me.m-=50;me.m+=150;s.ev={i:me.pos,ti:"Contrato fechado!",tx:"Você investiu R$50 na feira e recebeu R$150 pelo serviço.",d:100};s.ph="end";return;
    }
    if(m.a=="marketPass"&&s.ph=="market"){s.ev={i:me.pos,ti:"Feira visitada",tx:"Você preferiu não fechar negócio desta vez.",d:0};s.ph="end";return}
    if(m.a=="festivalHost"&&s.ph=="festival"){
      if(me.m<80)return "Você precisa de R$80 para organizar o evento.";
      me.m-=80;me.m+=200;s.p.forEach(q=>{if(q.a&&q.i!=me.i)q.m+=20});
      s.ev={i:me.pos,ti:"Festival organizado!",tx:"Você investiu no festival, recebeu R$200 de retorno e movimentou a economia local: cada rival ganhou R$20.",d:120};s.ph="end";return;
    }
    if(m.a=="festivalEnjoy"&&s.ph=="festival"){me.m+=40;s.ev={i:me.pos,ti:"Dia de festa!",tx:"Você participou das atividades e recebeu R$40 em vale-cultura.",d:40};s.ph="end";return}
    if(m.a=="worksAdvance"&&s.ph=="works"){
      const old=me.pos,m0=me.m;me.pos=(old+3)%40;const pass=old+3>=40;if(pass)me.m+=200;land(s,me,m0,pass,3);return;
    }
    if(m.a=="worksGrant"&&s.ph=="works"){me.m+=70;s.ev={i:me.pos,ti:"Compensação de obras",tx:"Você recebeu R$70 pela interrupção no trânsito.",d:70};s.ph="end";return}
    if(m.a=="bondBuy"&&s.ph=="bonds"){
      if(me.m<100)return "Você precisa de R$100 para comprar o título.";
      me.m-=100;me.m+=140;s.ev={i:me.pos,ti:"Título municipal comprado",tx:"Você aplicou R$100 e recebeu R$140 no vencimento imediato do título.",d:40};s.ph="end";return;
    }
    if(m.a=="bondPass"&&s.ph=="bonds"){s.ev={i:me.pos,ti:"Sem investimento",tx:"Você decidiu guardar seu dinheiro.",d:0};s.ph="end";return}
    if(m.a=="councilBenefit"&&s.ph=="council"){me.m+=100;s.ev={i:me.pos,ti:"Apoio municipal",tx:"Você recebeu R$100 do programa de incentivo da cidade.",d:100};s.ph="end";return}
    if(m.a=="councilShare"&&s.ph=="council"){
      if(me.m<30)return "Você precisa de R$30 para contribuir.";
      me.m-=30;s.p.forEach(q=>{if(q.a)q.m+=20});s.ev={i:me.pos,ti:"Fundo comunitário",tx:"Você contribuiu com R$30 e todos os jogadores receberam R$20 do fundo municipal.",d:-10};s.ph="end";return;
    }
    if(["build","sell","mort","unmort"].includes(m.a)){
      const i=m.i,t=T[i];
      if(!t||s.own[i]!=me.i)return "Essa propriedade não é sua.";
      const hc=Math.round((t[2]||0)/20)*10,grp=T.map((u,j)=>j).filter(j=>T[j][3]!==undefined&&T[j][3]===t[3]);
      if(m.a=="build"){
        if(t[1]!="p")return "Só dá para construir em cidades.";
        if(!full(s,i))return "Para construir você precisa ter todas as cidades da mesma cor.";
        if(s.mort[i])return "Esta cidade está hipotecada. Resgate antes de construir.";
        if(s.h[i]>=5)return "Já existe um hotel aqui.";
        if(me.m<hc)return "Faltam R$"+(hc-me.m)+" para construir.";
        me.m-=hc;s.h[i]++;
        s.ev={i,ti:"Construção em "+t[0],tx:(s.h[i]==5?"Hotel construído! ":"Casa construída! ")+"O aluguel desta cidade subiu bastante.",d:-hc};
      }else if(m.a=="sell"){
        if(!s.h[i])return "Não há casas para vender aqui.";
        s.h[i]--;me.m+=hc/2;
        s.ev={i,ti:"Venda em "+t[0],tx:"Você vendeu uma construção pela metade do preço e o aluguel caiu.",d:hc/2};
      }else if(m.a=="mort"){
        if(s.mort[i])return "Já está hipotecada.";
        if(grp.some(j=>s.h[j]))return "Venda as casas desse grupo antes de hipotecar.";
        me.m+=t[2]/2;s.mort[i]=1;
        s.ev={i,ti:"Hipoteca de "+t[0],tx:"Você recebeu metade do valor do banco. Enquanto estiver hipotecada, ninguém paga aluguel nela.",d:t[2]/2};
      }else{
        const c=Math.round(t[2]/2*1.1);
        if(!s.mort[i])return "Esta propriedade não está hipotecada.";
        if(me.m<c)return "Faltam R$"+(c-me.m)+" para resgatar.";
        me.m-=c;s.mort[i]=0;
        s.ev={i,ti:"Resgate de "+t[0],tx:"Você pagou ao banco o valor da hipoteca mais 10% de juros. A propriedade voltou a render aluguel.",d:-c};
      }
      return;
    }
    if(m.a=="roll"&&s.ph=="roll"){
      const d=[1+rnd(6),1+rnd(6)],n=d[0]+d[1],m0=p.m,old=p.pos;
      s.dice=d;p.pos=(old+n)%40;
      const pass=old+n>=40;if(pass)p.m+=200;
      land(s,p,m0,pass,n);
    }else if(m.a=="buy"&&s.ph=="buy"&&me.m>=T[me.pos][2]){
      const t=T[me.pos];me.m-=t[2];s.own[me.pos]=me.i;
      s.ev={i:me.pos,ti:"Você comprou "+t[0]+"!",tx:"Agora é sua. Quem parar aqui paga aluguel a você.",d:-t[2]};s.ph="end";
    }else if(m.a=="skip"&&s.ph=="buy"){
      beginAuction(s,me.pos);
    }else if(m.a=="next"&&s.ph=="end"){
      do{s.cur=(s.cur+1)%s.p.length}while(!s.p[s.cur].a);
      const q=s.p[s.cur];
      if(q.j>0){q.j--;s.ev={i:10,ti:q.n+" está preso",tx:"Quem foi para a cadeia perde uma vez. Na próxima rodada volta a jogar.",d:0};s.ph="end"}
      else{s.ph="roll";s.ev=null}
    }
  },
  view(s,pid){const me=s.p.find(q=>q.id==pid),au=s.auction,tr=s.trade;return{T,p:s.p.map(q=>({n:q.n,i:q.i,m:q.m,pos:q.pos,a:q.a})),own:s.own,h:s.h,mort:s.mort,cur:s.cur,ph:s.ph,dice:s.dice,ev:s.ev,me:me?me.i:-1,lotteryFree:!!s.lotteryFree,travelReward:s.travelReward||150,trips:TRIPS,marketProperties:me?T.map((t,i)=>({t,i})).filter(x=>['p','r','u'].includes(x.t[1])&&s.own[x.i]>=0&&s.own[x.i]!==me.i&&!s.mort[x.i]&&!s.h[x.i]&&s.p[s.own[x.i]]?.a).map(x=>({i:x.i,n:x.t[0],owner:s.p[s.own[x.i]].n})):[],trade:tr?{buyer:tr.buyer,seller:tr.seller,buyerName:s.p[tr.buyer]?.n,sellerName:s.p[tr.seller]?.n,i:tr.i,property:T[tr.i][0],amount:tr.amount}:null,auction:au?{i:au.i,turn:au.order[au.idx],turnName:s.p[au.order[au.idx]]?.n,high:au.high,leader:au.leader,minimum:Math.max(au.min,au.high+10)}:null}}
};

/* ================= CIDADE DORME ================= */
function check(s){
  const k=s.p.filter(q=>q.a&&q.r=="assassino").length,o=s.p.filter(q=>q.a&&q.r!="assassino").length;
  if(!k||k>=o){s.ph="end";s.win=k?"Os assassinos":"A cidade";s.ev={ti:"Fim de jogo",tx:s.win+" venceram!"};return true}
  return false;
}
function resolveNight(s){
  const as=s.p.filter(q=>q.a&&q.r=="assassino"),k=as.map(q=>s.acts[q.id]).find(Boolean),
    doc=s.p.find(q=>q.a&&q.r=="médico"),sv=doc&&s.acts[doc.id],det=s.p.find(q=>q.a&&q.r=="detetive");
  if(det&&s.acts[det.id]){const t=s.p.find(q=>q.id==s.acts[det.id]);s.res[det.id]=t.n+(t.r=="assassino"?" é um ASSASSINO!":" é inocente.")}
  let tx;
  if(k&&k!=sv){const v=s.p.find(q=>q.id==k);v.a=0;tx=v.n+" foi encontrado morto. Era "+v.r+"."}
  else tx=k?"Alguém foi atacado, mas o médico salvou a vítima!":"Ninguém morreu esta noite.";
  s.ph="day";s.acts={};s.votes={};s.ev={ti:"A cidade acorda",tx:tx+" Conversem na voz e votem em quem expulsar."};
  check(s);
}
function tally(s){
  const c={};Object.values(s.votes).forEach(v=>c[v]=(c[v]||0)+1);
  const mx=Math.max(0,...Object.values(c)),top=Object.keys(c).filter(k=>c[k]==mx);let tx;
  if(mx&&top.length==1){const v=s.p.find(q=>q.id==top[0]);v.a=0;tx=v.n+" foi expulso pela cidade. Era "+v.r+"!"}
  else tx="Empate ou ninguém votou: ninguém foi expulso.";
  s.ev={ti:"Resultado da votação",tx};
  if(!check(s)){s.ph="night";s.day++;s.acts={};s.votes={};s.res={};s.ev.tx+=" A noite cai novamente..."}
}
const D={min:4,max:12,
  init(pl){
    const n=pl.length,roles=["assassino",...(n>=8?["assassino"]:[]),"detetive",...(n>=6?["médico"]:[])];
    while(roles.length<n)roles.push("cidadão");
    for(let i=roles.length-1;i>0;i--){const j=rnd(i+1);[roles[i],roles[j]]=[roles[j],roles[i]]}
    return{p:pl.map((q,i)=>({id:q.id,n:q.name,r:roles[i],a:1})),ph:"night",day:1,acts:{},votes:{},res:{},ev:{ti:"A cidade dorme...",tx:"Noite 1. Quem tem poderes age em segredo."}};
  },
  act(s,pid,m,host){
    if(m.a=="force"&&pid==host&&s.ph!="end"){s.ph=="night"?resolveNight(s):tally(s);return}
    const me=s.p.find(q=>q.id==pid);
    if(!me||!me.a||s.ph=="end")return;
    const t=s.p.find(q=>q.id==m.t&&q.a&&q.id!=pid);
    if(m.a=="night"&&s.ph=="night"&&me.r!="cidadão"&&t&&!s.acts[pid]&&!(me.r=="assassino"&&t.r=="assassino")){
      s.acts[pid]=t.id;
      if(s.p.every(q=>!q.a||q.r=="cidadão"||s.acts[q.id]))resolveNight(s);
    }else if(m.a=="vote"&&s.ph=="day"&&t&&!s.votes[pid]){
      s.votes[pid]=t.id;
      if(s.p.every(q=>!q.a||s.votes[q.id]))tally(s);
    }
  },
  view(s,pid){
    const me=s.p.find(q=>q.id==pid),end=s.ph=="end";
    return{p:s.p.map(q=>({id:q.id,n:q.n,a:q.a,r:(end||q.id==pid||(me.r=="assassino"&&q.r=="assassino"))?q.r:null})),
      ph:s.ph,day:s.day,ev:s.ev,res:s.res[pid]||null,me:{id:me.id,r:me.r,a:me.a},win:s.win,
      acted:!!s.acts[pid],voted:!!s.votes[pid],nv:Object.keys(s.votes).length};
  }
};

/* ================= SALAS ================= */
const G={metropole:M,cidade:D};
const send=(w,o)=>w&&w.readyState==1&&w.send(JSON.stringify(o));
function push(r){
  r.t=Date.now();save();
  r.pl.forEach(q=>send(q.ws,{t:"state",room:r.c,you:q.id,host:r.host,game:r.game,go:!!r.s,
    pl:r.pl.map(x=>({id:x.id,name:x.name,on:!!(x.ws&&x.ws.readyState==1),v:!!x.v})),g:r.s?G[r.game].view(r.s,q.id):null}));
}
function join(r,ws,name){
  if(r.pl.length>=G[r.game].max)return send(ws,{t:"err",m:"Sala cheia."});
  const q={id:uid(),name:cleanName(name),ws};
  r.pl.push(q);if(!r.host)r.host=q.id;ws.r=r;ws.pid=q.id;push(r);
}
wss.on("connection",ws=>{
  ws.on("message",raw=>{try{
    let m;try{m=JSON.parse(raw)}catch{return}
    const r=ws.r;
    if(m.t=="create"&&G[m.game]){
      if(ws.pid)return send(ws,{t:"err",m:"Saia da sala atual antes de criar outra."});
      let c;do{c=roomCode()}while(R[c]);
      join(R[c]={c,game:m.game,host:null,pl:[],s:null,t:Date.now()},ws,m.name);
    }else if(m.t=="join"){
      if(ws.pid)return send(ws,{t:"err",m:"Saia da sala atual antes de entrar em outra."});
      const rm=R[String(m.room).toUpperCase()];
      if(!rm)send(ws,{t:"err",m:"Sala não encontrada."});
      else if(rm.s)send(ws,{t:"err",m:"Essa partida já começou."});
      else join(rm,ws,m.name);
    }else if(m.t=="rejoin"){
      const rm=R[m.room],q=rm&&rm.pl.find(x=>x.id==m.id);
      if(q){q.ws=ws;ws.r=rm;ws.pid=q.id;push(rm)}else send(ws,{t:"gone"});
    }else if(r&&m.t=="leave"){
      const i=r.pl.findIndex(x=>x.id==ws.pid);
      if(i>=0)r.pl.splice(i,1);
      ws.r=null;ws.pid=null;
      if(!r.pl.length){delete R[r.c];save()}
      else{if(r.host&&!r.pl.some(x=>x.id==r.host))r.host=(r.pl.find(x=>x.ws&&x.ws.readyState==1)||r.pl[0]).id;push(r)}
    }else if(r&&m.t=="voice"){
      const q=r.pl.find(x=>x.id==ws.pid);if(q){q.v=!!m.on;push(r)}
    }else if(r&&m.t=="sig"){
      const q=r.pl.find(x=>x.id==m.to);if(q)send(q.ws,{t:"sig",from:ws.pid,d:m.d});
    }else if(r&&m.t=="start"&&ws.pid==r.host&&!r.s&&r.pl.length>=G[r.game].min){
      r.s=G[r.game].init(r.pl);push(r);
    }else if(r&&r.s&&m.t=="act"){
      const e=G[r.game].act(r.s,ws.pid,m,r.host);if(e)send(ws,{t:"err",m:e});push(r);
    }
  }catch(e){console.error(e)}});
  ws.on("close",()=>{const r=ws.r,q=r&&r.pl.find(x=>x.id==ws.pid);if(q&&q.ws==ws){q.ws=null;q.v=false;push(r)}});
  ws.on("error",()=>{});
});
setInterval(()=>wss.clients.forEach(w=>w.ping()),25000);
const DATA_DIR=process.env.DATA_DIR||__dirname;
fs.mkdirSync(DATA_DIR,{recursive:true});
const FILE=path.join(DATA_DIR,"salas.json"),dump=()=>JSON.stringify(R,(k,v)=>k=="ws"?undefined:v);
try{Object.assign(R,JSON.parse(fs.readFileSync(FILE,"utf8")));for(const c in R)R[c].pl.forEach(q=>{q.v=false;q.ws=null})}catch{}
let tm;
function saveNow(){clearTimeout(tm);try{fs.writeFileSync(FILE,dump())}catch(e){console.error("Não foi possível salvar as salas:",e.message)}}
function save(){clearTimeout(tm);tm=setTimeout(saveNow,500);if(tm.unref)tm.unref()}
setInterval(()=>{let changed=false;for(const c in R)if(R[c].pl.every(q=>!q.ws)&&Date.now()-R[c].t>3600000){delete R[c];changed=true}if(changed)save()},600000).unref?.();
process.on("uncaughtException",e=>console.error(e));
process.on("unhandledRejection",e=>console.error(e));
for(const signal of ["SIGTERM","SIGINT"])process.on(signal,()=>{saveNow();srv.close(()=>process.exit(0));setTimeout(()=>process.exit(0),10000).unref()});
srv.listen(Number(process.env.PORT)||3000,"0.0.0.0",()=>console.log("Sala de Jogos no ar"));
