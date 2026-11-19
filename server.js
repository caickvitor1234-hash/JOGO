const express=require("express"),http=require("http"),{WebSocketServer}=require("ws");
const app=express(),srv=http.createServer(app),wss=new WebSocketServer({server:srv,maxPayload:100000});
app.use(express.static(__dirname+"/public"));
app.get("/health",(q,r)=>r.send("ok"));
app.get("/ice",(q,r)=>{
  let s=[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}];
  try{if(process.env.ICE_SERVERS)s=JSON.parse(process.env.ICE_SERVERS)}catch{}
  r.json(s);
});

const R={},rnd=n=>Math.random()*n|0,uid=()=>Math.random().toString(36).slice(2,10);

/* ================= METRÓPOLE ================= */
const T=[["Largada","s"],["Cuiabá","p",60,0],["Sorte","c"],["Sorte","c"],["Imposto","x",200],["Ferrovia Norte","r",200],["Palmas","p",100,1],["Sorte","c"],["Sorte","c"],["Aracaju","p",120,1],["Cadeia","j"],["Natal","p",140,2],["Companhia de Luz","u",150],["Sorte","c"],["Maceió","p",160,2],["Ferrovia Leste","r",200],["Teresina","p",180,3],["Sorte","c"],["Sorte","c"],["Florianópolis","p",200,3],["Parque","f"],["Manaus","p",220,4],["Sorte","c"],["Belém","p",220,4],["Fortaleza","p",240,4],["Ferrovia Sul","r",200],["Recife","p",260,5],["Curitiba","p",260,5],["Companhia de Água","u",150],["Porto Alegre","p",280,5],["Vá preso","g"],["Salvador","p",300,6],["Belo Horizonte","p",300,6],["Sorte","c"],["Brasília","p",320,6],["Ferrovia Oeste","r",200],["Sorte","c"],["São Paulo","p",350,7],["Imposto","x",100],["Rio de Janeiro","p",400,7]];
const MULT=[1,2,4,8,13,20,30];
const full=(s,i)=>T.every((u,j)=>u[3]!==T[i][3]||s.own[j]===s.own[i]);
const rent=(s,i,n)=>{
  const t=T[i],o=s.own[i];
  if(s.mort[i])return 0;
  if(t[1]=="r")return 25*2**(T.filter((u,j)=>u[1]=="r"&&s.own[j]==o).length-1);
  if(t[1]=="u")return n*(T.filter((u,j)=>u[1]=="u"&&s.own[j]==o).length>1?10:4);
  const h=s.h[i];return t[2]/10*MULT[h?h+1:full(s,i)?1:0];
};
// Amuleto bloqueia uma penalidade financeira inteira e é consumido ao proteger.
const hit=(p,value)=>{
  value=Math.max(0,Math.round(value||0));
  if(!value)return 0;
  if(p.shield>0){p.shield--;return 0;}
  p.m-=value;return value;
};
const transfer=(from,to,value)=>{const paid=hit(from,value);to.m+=paid;return paid};
const CARDS=[
  {title:"BAÚ DE OURO",art:"treasure",run:(s,p)=>{p.m+=300;return "O baú estava lotado! Você recebeu R$300."}},
  {title:"TREVO DA SORTE",art:"clover",run:(s,p)=>{p.m+=150;p.shield=Math.min(2,(p.shield||0)+1);return "Você ganhou R$150 e um amuleto que bloqueia uma penalidade."}},
  {title:"DADO SOMBRIO",art:"dark-dice",run:(s,p)=>{const n=hit(p,120);return n?"O dado virou contra você: perdeu R$120.":"Seu amuleto anulou o azar!"}},
  {title:"RODA PREMIADA",art:"wheel",run:(s,p)=>{const n=50+rnd(6)*50;p.m+=n;return "A roda parou no prêmio de R$"+n+"!"}},
  {title:"ESCUDO MÁGICO",art:"shield",run:(s,p)=>{p.shield=Math.min(2,(p.shield||0)+1);p.m+=75;return "Você ganhou R$75 e recebeu um amuleto de proteção."}},
  {title:"COFRE REAL",art:"coins",run:(s,p)=>{const n=Math.max(100,s.own.filter(o=>o==p.i).length*100);p.m+=n;return "O banco pagou R$"+n+" de bônus pelas suas propriedades."}},
  {title:"CAIXA MISTERIOSA",art:"mystery",run:(s,p)=>{if(rnd(2)){p.m+=250;return "Surpresa boa! Havia R$250 dentro da caixa."}const n=hit(p,100);return n?"A caixa tinha uma pegadinha: você perdeu R$100.":"Seu amuleto bloqueou a pegadinha!"}},
  {title:"GATO PRETO",art:"blackcat",run:(s,p)=>{const n=hit(p,160);p.pos=(p.pos+39)%40;return (n?"O azar bateu: −R$160. ":"Seu amuleto bloqueou a perda. ")+"Você ainda voltou uma casa."}},
  {title:"TEMPESTADE",art:"storm",run:(s,p)=>{let total=0;s.p.forEach(q=>{if(q.a)total+=hit(q,40)});return total?"A tempestade atingiu a cidade: os jogadores perderam R$40 cada (R$"+total+" no total).":"Os amuletos protegeram todo mundo da tempestade!"}},
  {title:"FESTA NA CIDADE",art:"wheel",run:(s,p)=>{s.p.forEach(q=>{if(q.a)q.m+=60});return "Todo jogador ativo recebeu R$60 do banco. Festa para todos!"}},
  {title:"ATALHO",art:"clover",run:(s,p)=>{p.pos=(p.pos+38)%40;return "Você encontrou um atalho e avançou duas casas sem pagar nada."}},
  {title:"TROCA DE LUGARES",art:"mystery",run:(s,p)=>{const a=s.p.filter(q=>q.a&&q!=p);if(!a.length)return "Não havia ninguém para trocar de lugar.";const q=a[rnd(a.length)],[x,y]=[p.pos,q.pos];p.pos=y;q.pos=x;return "Você trocou de lugar com "+q.n+"!"}},
  {title:"CASHBACK",art:"coins",run:(s,p)=>{const n=Math.max(45,s.own.filter(o=>o==p.i).length*45);p.m+=n;return "Você recebeu R$"+n+" de retorno do banco."}},
  {title:"IMPOSTO SURPRESA",art:"dark-dice",run:(s,p)=>{const n=hit(p,Math.max(50,s.own.filter(o=>o==p.i).length*25));return n?"Taxa surpresa: −R$"+n+".":"Seu amuleto anulou o imposto surpresa!"}},
  {title:"ANIVERSÁRIO",art:"treasure",run:(s,p)=>{let n=0;s.p.forEach(q=>{if(q.a&&q!=p)n+=transfer(q,p,30)});return n?"Seus amigos contribuíram com R$"+n+" para o seu presente.":"Você ganhou parabéns, mas nenhum dinheiro foi transferido."}},
  {title:"SORTEIO DA MESA",art:"coins",run:(s,p)=>{const a=s.p.filter(q=>q.a);const q=a[rnd(a.length)];q.m+=200;return q==p?"Você foi sorteado e ganhou R$200!":q.n+" foi sorteado e ganhou R$200!"}},
  {title:"REPAROS",art:"storm",run:(s,p)=>{const houses=s.h.reduce((a,h,i)=>a+(s.own[i]==p.i?h:0),0),n=hit(p,Math.max(50,houses*40));return n?"Reparos na cidade: você pagou R$"+n+".":"Seu amuleto cobriu os reparos!"}},
  {title:"DEPÓSITO ERRADO",art:"treasure",run:(s,p)=>{p.m+=180;return "O banco depositou R$180 por engano. Melhor não avisar!"}},
  {title:"MÃO AMIGA",art:"clover",run:(s,p)=>{const n=p.m<400?250:80;p.m+=n;return "O banco ajudou você com R$"+n+"."}},
  {title:"AMULETO EXTRA",art:"shield",run:(s,p)=>{p.shield=Math.min(2,(p.shield||0)+1);return "Você ganhou um amuleto. Ele bloqueia a próxima penalidade financeira."}},
  {title:"PRÊMIO DO CONCURSO",art:"wheel",run:(s,p)=>{p.m+=200;return "Parabéns! O concurso pagou R$200."}},
  {title:"MULTA DE TRÂNSITO",art:"storm",run:(s,p)=>{const n=hit(p,100);return n?"Multa inesperada: −R$100.":"Seu amuleto cancelou a multa!"}},
  {title:"CHUVA DE MOEDAS",art:"coins",run:(s,p)=>{s.p.forEach(q=>{if(q.a)q.m+=40});return "Choveu dinheiro! Todos receberam R$40."}},
  {title:"TAXA COLETIVA",art:"dark-dice",run:(s,p)=>{let n=0;s.p.forEach(q=>{if(q.a&&q!=p)n+=transfer(q,p,40)});return n?"Você recebeu R$"+n+" de uma taxa coletiva.":"Ninguém tinha taxa para pagar."}},
  {title:"LOTERIA DA CIDADE",art:"wheel",run:(s,p)=>{const n=100+rnd(7)*100;p.m+=n;return "Seu bilhete foi sorteado! Prêmio de R$"+n+"."}},
  {title:"CONTA DE LUZ",art:"storm",run:(s,p)=>{const n=hit(p,80);return n?"A conta de luz chegou: −R$80.":"Seu amuleto cobriu a conta de luz."}},
  {title:"FEIRA DE TROCAS",art:"mystery",run:(s,p)=>{const a=s.p.filter(q=>q.a&&q!=p);if(!a.length)return "A feira foi cancelada: você está sozinho.";const q=a[rnd(a.length)],v=Math.min(120,Math.max(0,q.m));q.m-=v;p.m+=v;return q.n+" fez uma troca com você. Você recebeu R$"+v+"."}},
  {title:"PATROCÍNIO",art:"coins",run:(s,p)=>{const n=150+(s.own.filter(o=>o==p.i).length*35);p.m+=n;return "Uma marca patrocinou seu império: +R$"+n+"."}},
  {title:"GREVE GERAL",art:"storm",run:(s,p)=>{const n=hit(p,130);return n?"A cidade parou e você perdeu R$130.":"Seu amuleto protegeu seu caixa da greve."}},
  {title:"ACHADO E PERDIDO",art:"treasure",run:(s,p)=>{p.m+=90;return "Você encontrou uma carteira esquecida: +R$90."}},
  {title:"DOAÇÃO SOLIDÁRIA",art:"clover",run:(s,p)=>{let n=0;s.p.forEach(q=>{if(q.a&&q!=p)n+=transfer(q,p,25)});return n?"Cada rival contribuiu com R$25. Você recebeu R$"+n+".":"Não havia outros jogadores ativos."}},
  {title:"DIA DE azar",art:"blackcat",run:(s,p)=>{const n=hit(p,Math.max(60,Math.round(p.m*0.08)));return n?"Um imprevisto levou R$"+n+" do seu caixa.":"O amuleto anulou o imprevisto."}},
  {title:"BÔNUS DE PASSAGEM",art:"clover",run:(s,p)=>{p.m+=200;return "O banco antecipou seu bônus de passagem: +R$200."}},
  {title:"PASSEIO TURÍSTICO",art:"wheel",run:(s,p)=>{p.pos=(p.pos+5)%40;return "Você fez um passeio e avançou cinco casas!"}},
  {title:"RETROCESSO",art:"dark-dice",run:(s,p)=>{p.pos=(p.pos+35)%40;return "Uma rua interditada fez você voltar cinco casas."}},
  {title:"MULTA POR BARULHO",art:"storm",run:(s,p)=>{const n=hit(p,70);return n?"Festa fora de hora: multa de R$70.":"Seu amuleto cancelou a multa."}},
  {title:"INVESTIMENTO CERTO",art:"coins",run:(s,p)=>{const n=100+rnd(5)*75;p.m+=n;return "Seu investimento rendeu R$"+n+"."}},
  {title:"INVESTIMENTO RUIM",art:"dark-dice",run:(s,p)=>{const n=hit(p,100+rnd(4)*50);return n?"O investimento deu prejuízo: −R$"+n+".":"Seu amuleto impediu o prejuízo."}},
  {title:"PRESENTE DO RIVAL",art:"treasure",run:(s,p)=>{const a=s.p.filter(q=>q.a&&q!=p);if(!a.length){p.m+=100;return "Sem rivais, o banco deu R$100.";}const q=a.reduce((x,y)=>x.m<y.m?x:y);const n=transfer(q,p,Math.min(100,Math.max(0,q.m)));return q.n+" pagou R$"+n+" para você."}},
  {title:"FESTIVAL DE RUA",art:"wheel",run:(s,p)=>{s.p.forEach(q=>{if(q.a)q.m+=90});return "Festival na cidade! Todo mundo ganhou R$90."}},
  {title:"APAGÃO",art:"storm",run:(s,p)=>{let n=0;s.p.forEach(q=>{if(q.a)n+=hit(q,35)});return "Apagão geral: os jogadores perderam até R$35 cada. Total recolhido: R$"+n+"."}},
  {title:"SEGURO PREMIADO",art:"shield",run:(s,p)=>{p.shield=Math.min(3,(p.shield||0)+2);return "A seguradora deu dois amuletos! Você pode bloquear duas penalidades."}},
  {title:"DEVOLUÇÃO DE IMPOSTO",art:"coins",run:(s,p)=>{const n=100+rnd(4)*50;p.m+=n;return "O governo devolveu R$"+n+" de imposto."}},
  {title:"OBRA NA SUA RUA",art:"storm",run:(s,p)=>{const n=hit(p,Math.max(50,s.own.filter(o=>o==p.i).length*30));return n?"Obra e barulho: você pagou R$"+n+".":"Seu amuleto cobriu os custos da obra."}},
  {title:"VAQUINHA",art:"clover",run:(s,p)=>{let n=0;s.p.forEach(q=>{if(q.a&&q!=p)n+=transfer(q,p,50)});return n?"A vaquinha dos amigos rendeu R$"+n+".":"A vaquinha não teve participantes."}},
  {title:"CIDADE EM PROMOÇÃO",art:"treasure",run:(s,p)=>{p.m+=120;return "Comércio em promoção! Você economizou R$120 e recebeu o valor."}},
  {title:"PANE NO CARRO",art:"storm",run:(s,p)=>{const n=hit(p,110);return n?"Seu carro quebrou: conserto de R$110.":"Seu amuleto pagou o conserto."}},
  {title:"SORTE GRANDE",art:"wheel",run:(s,p)=>{const n=300+rnd(4)*100;p.m+=n;return "Jackpot! Você ganhou R$"+n+"."}},
  {title:"AZAR COMPARTILHADO",art:"blackcat",run:(s,p)=>{const a=s.p.filter(q=>q.a);let n=0;a.forEach(q=>n+=hit(q,50));return "Todo jogador ativo teve um gasto inesperado de R$50. Total: R$"+n+"."}},
  {title:"PASSE LIVRE",art:"shield",run:(s,p)=>{p.shield=Math.min(3,(p.shield||0)+1);p.m+=50;return "Você recebeu R$50 e um passe que bloqueia uma penalidade."}},
  {title:"CONTRATO RELÂMPAGO",art:"coins",run:(s,p)=>{const n=Math.max(80,s.own.filter(o=>o==p.i).length*60);p.m+=n;return "Um contrato foi fechado! Você recebeu R$"+n+"."}},
  {title:"VIZINHO GENEROSO",art:"clover",run:(s,p)=>{const a=s.p.filter(q=>q.a&&q!=p);if(!a.length){p.m+=75;return "O banco substituiu o vizinho e deu R$75.";}const q=a[rnd(a.length)];const n=transfer(q,p,75);return q.n+" dividiu R$"+n+" com você."}},
  {title:"PONTE INTERDITADA",art:"dark-dice",run:(s,p)=>{p.pos=(p.pos+37)%40;return "Ponte interditada! Você voltou três casas."}},
  {title:"DIA DE PAGAMENTO",art:"coins",run:(s,p)=>{p.m+=250;return "Salário caiu na conta: +R$250."}},
  {title:"DOAÇÃO AO PARQUE",art:"storm",run:(s,p)=>{const n=hit(p,60);return n?"Você ajudou a cidade e doou R$60.":"Seu amuleto cobriu a doação."}},
  {title:"BOLSA EM ALTA",art:"wheel",run:(s,p)=>{const n=150+rnd(5)*50;p.m+=n;return "A bolsa subiu! Seu bônus foi de R$"+n+"."}},
  {title:"BOLSA EM QUEDA",art:"dark-dice",run:(s,p)=>{const n=hit(p,150);return n?"A bolsa caiu: prejuízo de R$150.":"Seu amuleto protegeu seu investimento."}},
  {title:"PRESENTE PARA TODOS",art:"treasure",run:(s,p)=>{s.p.forEach(q=>{if(q.a)q.m+=40});return "A prefeitura distribuiu R$40 para cada jogador."}},
  {title:"REVIRAVOLTA",art:"mystery",run:(s,p)=>{const a=s.p.filter(q=>q.a);if(a.length<2)return "Não há jogadores suficientes para a reviravolta.";const rich=a.reduce((x,y)=>x.m>y.m?x:y),poor=a.reduce((x,y)=>x.m<y.m?x:y);const n=Math.min(120,Math.max(0,rich.m));rich.m-=n;poor.m+=n;return "O líder ajudou quem estava atrás: R$"+n+" foram transferidos."}},
  {title:"BONUS POR PROPRIEDADES",art:"coins",run:(s,p)=>{const n=s.own.filter(o=>o==p.i).length*45;p.m+=n;return "O banco pagou R$"+n+" pelo seu patrimônio."}},
  {title:"DIA DE AZAR NO TRÂNSITO",art:"storm",run:(s,p)=>{const n=hit(p,90);p.pos=(p.pos+1)%40;return (n?"Você pagou R$90. ":"Seu amuleto anulou a multa. ")+"O trânsito ainda fez você avançar uma casa."}},
  {title:"PERDEU A VEZ",art:"blackout",run:(s,p)=>{p.j=1;return "O pneu furou! Você perde sua próxima rodada para consertar."}},
  {title:"FUGA DA CADEIA",art:"rail-tunnel",run:(s,p)=>{p.j=0;p.pos=(p.pos+1)%40;return "Você ganhou um passe livre e escapou de qualquer prisão. Avance uma casa!"}},
  {title:"DIRETO PARA A CADEIA",art:"blackout",run:(s,p)=>{p.pos=10;p.j=1;return "A polícia confundiu seus documentos. Vá para a cadeia e perca uma rodada."}},
  {title:"LEILÃO RELÂMPAGO",art:"prize-wheel",run:(s,p)=>{const a=T.map((t,i)=>({t,i})).filter(x=>["p","r","u"].includes(x.t[1])&&s.own[x.i]<0);if(!a.length)return "Não há propriedades livres para leiloar.";const x=a[rnd(a.length)],price=Math.max(40,Math.round(x.t[2]*0.65));if(p.m<price)return "O leilão terminou, mas você não tinha R$"+price+" para dar o lance vencedor.";p.m-=price;s.own[x.i]=p.i;return "Você venceu o leilão de "+x.t[0]+" por R$"+price+"!"}},
  {title:"COBRANÇA DOS PROPRIETÁRIOS",art:"money-rain",run:(s,p)=>{let n=0;s.p.filter(q=>q.a&&q!=p).forEach(q=>{const owned=s.own.filter(o=>o==q.i).length;if(owned)n+=transfer(q,p,Math.min(90,owned*30));});return n?"Você recebeu R$"+n+" de uma cobrança extraordinária aos rivais com propriedades.":"Nenhum rival tinha propriedades para contribuir."}},
  {title:"OBRA PREMIADA",art:"gold-shield",run:(s,p)=>{const a=s.own.map((o,i)=>o==p.i&&T[i][1]=="p"&&s.h[i]<5?i:-1).filter(i=>i>=0);if(!a.length)return "Você não tinha cidade disponível para receber uma melhoria.";const i=a[rnd(a.length)];s.h[i]++;return "A prefeitura construiu uma melhoria grátis em "+T[i][0]+"!"}},
  {title:"CHUVA DE DINHEIRO",art:"money-rain",run:(s,p)=>{p.m+=500;return "Uma mala caiu do céu! Você ganhou R$500."}},
  {title:"NOITE DE FESTA",art:"city-festival",run:(s,p)=>{s.p.forEach(q=>{if(q.a)q.m+=120});return "A cidade inteira comemorou: todos receberam R$120."}},
  {title:"CARRO QUEBRADO",art:"broken-car",run:(s,p)=>{const n=hit(p,180);return n?"Seu carro quebrou no pior momento: −R$180.":"Seu amuleto cobriu o conserto do carro."}},
  {title:"MERCADO EM PÂNICO",art:"market-crash",run:(s,p)=>{const n=hit(p,220);return n?"O mercado despencou e você perdeu R$220.":"Seu amuleto salvou seus investimentos."}},
  {title:"TÚNEL SECRETO",art:"rail-tunnel",run:(s,p)=>{p.pos=(p.pos+10)%40;return "Você encontrou um túnel secreto e avançou dez casas!"}},
  {title:"PRESENTE DO PREFEITO",art:"rival-gift",run:(s,p)=>{p.m+=180;p.shield=Math.min(3,(p.shield||0)+1);return "O prefeito gostou de você: +R$180 e um amuleto."}}
];
function drawChests(){const a=CARDS.map((_,i)=>i);for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,3)}
function openChest(s,p,index){const c=CARDS[index],before=p.m,tx=c.run(s,p);return{i:p.pos,ti:c.title,tx,d:p.m-before,art:c.art}}
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
function land(s,p,m0,pass,n){
  const i=p.pos,t=T[i],o=s.own[i];let ti=t[0],tx="",ph="end";
  if(t[1]=="p"||t[1]=="r"||t[1]=="u"){
    if(o<0){ph="buy";tx="Está livre! Se você comprar por R$"+t[2]+", cobra aluguel de quem parar aqui."}
    else if(o!=p.i){const r=rent(s,i,n),ow=s.p[o];p.m-=r;ow.m+=r;tx=!r?"Esta propriedade é de "+ow.n+", mas está hipotecada: você não paga nada.":"Esta propriedade é de "+ow.n+". Você pagou R$"+r+" de aluguel"+(s.h[i]?" (há "+(s.h[i]==5?"um hotel":s.h[i]+" casa(s)")+" construída(s))":"")+"."}
    else tx="Já é sua! Toque numa cidade sua para construir, se tiver todas da mesma cor."
  }else if(t[1]=="c"){ti="Baús da Sorte";tx="Três baús apareceram! Escolha um para descobrir seu destino.";ph="chest";s.chests=drawChests()}
  else if(t[1]=="x"){p.m-=t[2];tx="Hora de pagar o governo: R$"+t[2]+" de imposto."}
  else if(t[1]=="g"){p.pos=10;p.j=1;tx="Você foi levado para a cadeia e perde a próxima vez."}
  else tx={s:"Você parou na Largada! Receba R$200 toda vez que passar por aqui.",j:"Só visitando a cadeia. Nada acontece.",f:"Parque livre: descanse, não ganha nem perde nada."}[t[1]];
  if(pass)tx+=" Você passou pela Largada: +R$200.";
  s.ev={i,ti,tx,d:p.m-m0,art:t[1]=="c"?"mystery":null};s.ph=ph;broke(s);
}
const M={min:2,max:6,
  init(pl){return{p:pl.map((q,i)=>({id:q.id,n:q.name,i,m:1500,pos:0,j:0,a:1,shield:0})),own:T.map(()=>-1),h:T.map(()=>0),mort:T.map(()=>0),cur:0,ph:"roll",dice:[1,1],ev:null,chests:null}},
  act(s,pid,m){
    const me=s.p.find(q=>q.id==pid),p=s.p[s.cur];
    if(!me||!me.a||s.ph=="win")return;
    if(me!=p)return "Não é a sua vez.";
    if(m.a=="chest"&&s.ph=="chest"){
      const j=Number(m.i);if(!Number.isInteger(j)||j<0||j>2||!s.chests)return "Escolha um dos três baús.";
      s.ev=openChest(s,p,s.chests[j]);s.ev.tx="Você escolheu o baú "+(j+1)+". "+s.ev.tx;s.chests=null;s.ph="end";broke(s);return;
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
      s.ev={i:me.pos,ti:"Você não comprou",tx:T[me.pos][0]+" continua livre para os outros jogadores.",d:0};s.ph="end";
    }else if(m.a=="next"&&s.ph=="end"){
      do{s.cur=(s.cur+1)%s.p.length}while(!s.p[s.cur].a);
      const q=s.p[s.cur];
      if(q.j>0){q.j--;s.ev={i:10,ti:q.n+" está preso",tx:"Quem foi para a cadeia perde uma vez. Na próxima rodada volta a jogar.",d:0};s.ph="end"}
      else{s.ph="roll";s.ev=null}
    }
  },
  view(s,pid){const me=s.p.find(q=>q.id==pid);return{T,p:s.p.map(q=>({n:q.n,i:q.i,m:q.m,pos:q.pos,a:q.a,shield:q.shield||0})),own:s.own,h:s.h,mort:s.mort,cur:s.cur,ph:s.ph,dice:s.dice,ev:s.ev,me:me?me.i:-1,chestChoices:s.ph=="chest"&&me&&s.p[s.cur]&&me.id==s.p[s.cur].id?[0,1,2]:[]}}
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
  const q={id:uid(),name:String(name||"Jogador").slice(0,14),ws};
  r.pl.push(q);if(!r.host)r.host=q.id;ws.r=r;ws.pid=q.id;push(r);
}
wss.on("connection",ws=>{
  ws.on("message",raw=>{try{
    let m;try{m=JSON.parse(raw)}catch{return}
    const r=ws.r;
    if(m.t=="create"&&G[m.game]){
      let c;do{c=Math.random().toString(36).slice(2,6).toUpperCase()}while(R[c]);
      join(R[c]={c,game:m.game,host:null,pl:[],s:null,t:Date.now()},ws,m.name);
    }else if(m.t=="join"){
      const rm=R[String(m.room).toUpperCase()];
      if(!rm)send(ws,{t:"err",m:"Sala não encontrada."});
      else if(rm.s)send(ws,{t:"err",m:"Essa partida já começou."});
      else join(rm,ws,m.name);
    }else if(m.t=="rejoin"){
      const rm=R[m.room],q=rm&&rm.pl.find(x=>x.id==m.id);
      if(q){q.ws=ws;ws.r=rm;ws.pid=q.id;push(rm)}else send(ws,{t:"gone"});
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
setInterval(()=>{for(const c in R)if(R[c].pl.every(q=>!q.ws)&&Date.now()-R[c].t>3600000)delete R[c]},600000);
const fs=require("fs"),FILE=(process.env.DATA_DIR||".")+"/salas.json",dump=()=>JSON.stringify(R,(k,v)=>k=="ws"?undefined:v);
try{Object.assign(R,JSON.parse(fs.readFileSync(FILE,"utf8")));for(const c in R)R[c].pl.forEach(q=>q.v=false)}catch{}
let tm;function save(){clearTimeout(tm);tm=setTimeout(()=>{try{fs.writeFileSync(FILE,dump())}catch{}},1500)}
process.on("uncaughtException",e=>console.error(e));process.on("unhandledRejection",e=>console.error(e));
process.on("SIGTERM",()=>{try{fs.writeFileSync(FILE,dump())}catch{}process.exit(0)});
srv.listen(process.env.PORT||3000,()=>console.log("Sala de Jogos no ar"));
