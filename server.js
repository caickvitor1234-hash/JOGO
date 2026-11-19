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
const T=[["Largada","s"],["Cuiabá","p",60,0],["Sorte","c"],["Campo Grande","p",60,0],["Imposto","x",200],["Ferrovia Norte","r",200],["Palmas","p",100,1],["Cofre","k"],["Vitória","p",100,1],["Aracaju","p",120,1],["Cadeia","j"],["Natal","p",140,2],["Companhia de Luz","u",150],["João Pessoa","p",140,2],["Maceió","p",160,2],["Ferrovia Leste","r",200],["Teresina","p",180,3],["Sorte","c"],["Goiânia","p",180,3],["Florianópolis","p",200,3],["Carnaval","f"],["Manaus","p",220,4],["Cofre","k"],["Belém","p",220,4],["Fortaleza","p",240,4],["Ferrovia Sul","r",200],["Recife","p",260,5],["Curitiba","p",260,5],["Companhia de Água","u",150],["Porto Alegre","p",280,5],["Vá preso","g"],["Salvador","p",300,6],["Belo Horizonte","p",300,6],["Cofre","k"],["Brasília","p",320,6],["Ferrovia Oeste","r",200],["Sorte","c"],["São Paulo","p",350,7],["Imposto","x",100],["Rio de Janeiro","p",400,7]];
const MULT=[1,2,4,8,13,20,30],GN=["marrom","azul-claro","rosa","laranja","vermelha","azul","verde","roxa"];
const full=(s,i)=>T.every((u,j)=>u[3]!==T[i][3]||s.own[j]===s.own[i]);
const rent=(s,i,n)=>{
  const t=T[i],o=s.own[i];let r;
  if(s.mort[i])return 0;
  if(t[1]=="r")r=25*2**(T.filter((u,j)=>u[1]=="r"&&s.own[j]==o).length-1);
  else if(t[1]=="u")r=n*(T.filter((u,j)=>u[1]=="u"&&s.own[j]==o).length>1?10:4);
  else{const h=s.h[i];r=t[2]/10*MULT[h?h+1:full(s,i)?1:0]}
  if(s.news&&t[3]===s.news.g)r=Math.round(r*(s.news.t=="boom"?2:.5));
  return r;
};
const adv=(p,to)=>{if(to<p.pos)p.m+=200;p.pos=to};
const bank=(s,p,a)=>{p.m-=a;s.pot+=a};
const jail=p=>{p.pos=10;p.jail=1;p.jt=0};
const others=(s,p)=>s.p.filter(q=>q!=p&&q.a);
const reform=(s,p,c,h)=>{let a=0;s.h.forEach((x,i)=>{if(s.own[i]==p.i)a+=x==5?h:x*c});bank(s,p,a)};
const CHANCE=[
  ["Avance até a Largada e receba R$200.",(s,p)=>adv(p,0)],
  ["Viaje até Salvador. Se passar pela Largada, receba R$200.",(s,p)=>adv(p,31)],
  ["Siga até o Rio de Janeiro. Se passar pela Largada, receba R$200.",(s,p)=>adv(p,39)],
  ["Avance até o Carnaval e leve o prêmio acumulado!",(s,p)=>adv(p,20)],
  ["Siga até a ferrovia mais próxima. Se tiver dono, você paga o dobro do aluguel.",(s,p)=>{adv(p,[5,15,25,35].find(x=>x>p.pos)||5);s.dbl=1}],
  ["Volte 3 casas.",(s,p)=>{p.pos=(p.pos+37)%40}],
  ["Vá direto para a cadeia, sem passar pela Largada.",(s,p)=>jail(p)],
  ["Saída livre da cadeia! Guarde esta carta para usar quando precisar.",(s,p)=>{p.card++}],
  ["Multa por excesso de velocidade: pague R$80 (vai para o prêmio do Carnaval).",(s,p)=>bank(s,p,80)],
  ["Seu time foi campeão! Receba R$150.",(s,p)=>{p.m+=150}],
  ["Prêmio da loteria: receba R$200.",(s,p)=>{p.m+=200}],
  ["Reforma geral: pague R$25 por casa e R$100 por hotel que você tem.",(s,p)=>reform(s,p,25,100)],
  ["Você virou síndico: pague R$50 a cada jogador.",(s,p)=>others(s,p).forEach(q=>{q.m+=50;p.m-=50})],
  ["Conta de luz atrasada: pague R$60 (vai para o prêmio do Carnaval).",(s,p)=>bank(s,p,60)]
];
const CHEST=[
  ["Erro do banco a seu favor: receba R$200.",(s,p)=>{p.m+=200}],
  ["Restituição do imposto: receba R$100.",(s,p)=>{p.m+=100}],
  ["Herança de um tio distante: receba R$250.",(s,p)=>{p.m+=250}],
  ["Consulta médica: pague R$50 (vai para o prêmio do Carnaval).",(s,p)=>bank(s,p,50)],
  ["Mensalidade da escola: pague R$100 (vai para o prêmio do Carnaval).",(s,p)=>bank(s,p,100)],
  ["Você vendeu um bem usado: receba R$120.",(s,p)=>{p.m+=120}],
  ["Seu aniversário! Cada jogador paga R$30 a você.",(s,p)=>others(s,p).forEach(q=>{q.m-=30;p.m+=30})],
  ["Saída livre da cadeia! Guarde esta carta para usar quando precisar.",(s,p)=>{p.card++}],
  ["Denúncia anônima! Vá direto para a cadeia, sem passar pela Largada.",(s,p)=>jail(p)],
  ["Avance até a Largada e receba R$200.",(s,p)=>adv(p,0)],
  ["O seguro venceu: pague R$150 (vai para o prêmio do Carnaval).",(s,p)=>bank(s,p,150)],
  ["Você venceu o concurso de culinária: receba R$80.",(s,p)=>{p.m+=80}],
  ["Obras na rua: pague R$40 por casa e R$115 por hotel.",(s,p)=>reform(s,p,40,115)]
];
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
function fin(s){
  const p=s.p[s.cur];
  s.ph=s.again&&p.a&&!p.jail?"roll":"end";
  if(s.ph=="roll"&&s.ev)s.ev.tx+=" 🎲 Você tirou dupla: jogue de novo!";
  s.again=false;
}
function news(s){
  if(s.news&&--s.news.left<=0){s.news=null;s.ev={i:1,ti:"📰 A notícia passou",tx:"Os aluguéis voltaram ao normal.",d:0}}
  if(!s.news&&Math.random()<.4){
    const g=rnd(8),boom=Math.random()<.5,i=T.findIndex(u=>u[3]===g);
    s.news={g,t:boom?"boom":"crise",left:2};
    s.ev={i,ti:"📰 Notícia do dia",tx:boom?"Turismo em alta! As cidades da cor "+GN[g]+" pagam o dobro de aluguel por 2 rodadas.":"Crise econômica! As cidades da cor "+GN[g]+" pagam só metade do aluguel por 2 rodadas.",d:0};
  }
}
function arrive(s,p,n,dep){
  const i=p.pos,t=T[i],o=s.own[i];let ti=t[0],tx="",ph="end";
  if(t[1]=="p"||t[1]=="r"||t[1]=="u"){
    if(o<0){ph="buy";tx="Está livre! Se você comprar por R$"+t[2]+", cobra aluguel de quem parar aqui."}
    else if(o!=p.i){
      let r=rent(s,i,n);if(s.dbl&&t[1]=="r")r*=2;
      const ow=s.p[o];p.m-=r;ow.m+=r;
      tx=!r?"Esta propriedade é de "+ow.n+", mas está hipotecada: você não paga nada.":"Esta propriedade é de "+ow.n+". Você pagou R$"+r+" de aluguel"+(s.h[i]?" (há "+(s.h[i]==5?"um hotel":s.h[i]+" casa(s)")+" construída(s))":"")+(s.dbl&&t[1]=="r"?" (dobrado pela carta)":"")+(s.news&&t[3]===s.news.g?(s.news.t=="boom"?" (turismo em alta: aluguel dobrado)":" (crise: aluguel pela metade)"):"")+".";
    }else tx="Já é sua! Toque numa propriedade sua para construir ou hipotecar.";
    s.dbl=0;
  }else if(t[1]=="c"||t[1]=="k"){
    const dk=t[1]=="c"?CHANCE:CHEST,c=dk[rnd(dk.length)],b=p.pos;
    ti=t[1]=="c"?"Carta de Sorte":"Cofre da Cidade";tx=c[0];c[1](s,p);
    if(p.pos!=b&&!p.jail&&dep<2){const r=arrive(s,p,n,dep+1);tx+=" ➜ "+r.ti+": "+r.tx;ph=r.ph}
  }else if(t[1]=="x"){bank(s,p,t[2]);tx="Hora de pagar o governo: R$"+t[2]+" de imposto (vai para o prêmio do Carnaval)."}
  else if(t[1]=="g"){jail(p);tx="Você foi preso! Na sua vez, pague R$50, use a carta de saída ou tente tirar dupla (3 tentativas)."}
  else if(t[1]=="f"){const a=s.pot;p.m+=a;s.pot=0;tx=a?"Carnaval! Você levou todo o prêmio acumulado de multas e impostos: R$"+a+".":"Carnaval! Ainda não há prêmio acumulado, aproveite a festa."}
  else tx={s:"Você parou na Largada! Receba R$200 toda vez que passar por aqui.",j:"Só visitando a cadeia. Nada acontece."}[t[1]];
  return{ti,tx,ph};
}
function land(s,p,m0,pass,n){
  const i=p.pos,r=arrive(s,p,n,0);let tx=r.tx;
  if(pass)tx+=" Você passou pela Largada: +R$200.";
  s.ev={i,ti:r.ti,tx,d:p.m-m0};
  broke(s);
  if(s.ph=="win")return;
  if(!p.a){s.again=false;s.ph="end"}else if(r.ph=="buy")s.ph="buy";else fin(s);
}
const M={min:2,max:6,
  init(pl){return{p:pl.map((q,i)=>({id:q.id,n:q.name,i,m:1500,pos:0,jail:0,jt:0,card:0,a:1})),own:T.map(()=>-1),h:T.map(()=>0),mort:T.map(()=>0),cur:0,ph:"roll",dice:[1,1],ev:null,pot:0,round:1,news:null,dbls:0,again:false,dbl:0}},
  act(s,pid,m){
    const me=s.p.find(q=>q.id==pid),p=s.p[s.cur];
    if(!me||!me.a||s.ph=="win")return;
    if(me!=p)return "Não é a sua vez.";
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
    if(m.a=="pay"&&s.ph=="roll"&&me.jail){
      if(me.m<50)return "Faltam R$"+(50-me.m)+" para pagar a fiança.";
      bank(s,me,50);me.jail=0;me.jt=0;
      s.ev={i:10,ti:"Fiança paga",tx:"Você pagou R$50 (vai para o prêmio do Carnaval) e está livre! Agora é só rolar os dados.",d:-50};
    }else if(m.a=="card"&&s.ph=="roll"&&me.jail&&me.card>0){
      me.card--;me.jail=0;me.jt=0;
      s.ev={i:10,ti:"Carta de saída livre",tx:"Você usou a carta e saiu da cadeia sem pagar. Agora é só rolar os dados.",d:0};
    }else if(m.a=="roll"&&s.ph=="roll"){
      const d=[1+rnd(6),1+rnd(6)],n=d[0]+d[1],m0=me.m,dbl=d[0]==d[1];let pre="";
      s.dice=d;
      if(me.jail){
        if(dbl){me.jail=0;me.jt=0;pre="Dupla! Você saiu da cadeia. "}
        else{
          me.jt++;
          if(me.jt>=3){bank(s,me,50);me.jail=0;me.jt=0;pre="Terceira tentativa sem dupla: você pagou R$50 e saiu da cadeia. "}
          else{s.ev={i:10,ti:"Ainda preso",tx:"Sem dupla desta vez (tentativa "+me.jt+" de 3). Na próxima vez tente de novo, pague R$50 ou use uma carta.",d:0};s.ph="end";s.again=false;return}
        }
        s.again=false;
      }else if(dbl){
        s.dbls++;
        if(s.dbls>=3){s.dbls=0;jail(me);s.ev={i:30,ti:"Três duplas seguidas!",tx:"A polícia desconfiou: você vai direto para a cadeia.",d:0};s.ph="end";s.again=false;return}
        s.again=true;
      }else{s.again=false;s.dbls=0}
      const old=me.pos;me.pos=(old+n)%40;
      const pass=old+n>=40;if(pass)me.m+=200;
      land(s,me,m0,pass,n);
      if(pre&&s.ev)s.ev.tx=pre+s.ev.tx;
    }else if(m.a=="buy"&&s.ph=="buy"&&me.m>=T[me.pos][2]){
      const t=T[me.pos];me.m-=t[2];s.own[me.pos]=me.i;
      s.ev={i:me.pos,ti:"Você comprou "+t[0]+"!",tx:"Agora é sua. Quem parar aqui paga aluguel a você.",d:-t[2]};fin(s);
    }else if(m.a=="skip"&&s.ph=="buy"){
      s.ev={i:me.pos,ti:"Você não comprou",tx:T[me.pos][0]+" continua livre para os outros jogadores.",d:0};fin(s);
    }else if(m.a=="next"&&s.ph=="end"){
      const prev=s.cur;
      do{s.cur=(s.cur+1)%s.p.length}while(!s.p[s.cur].a);
      s.dbls=0;s.again=false;s.ph="roll";s.ev=null;
      if(s.cur<=prev){s.round++;news(s)}
    }
  },
  view(s,pid){const me=s.p.find(q=>q.id==pid);return{T,p:s.p.map(q=>({n:q.n,i:q.i,m:q.m,pos:q.pos,a:q.a,jail:q.jail,card:q.card})),own:s.own,h:s.h,mort:s.mort,cur:s.cur,ph:s.ph,dice:s.dice,ev:s.ev,pot:s.pot,news:s.news&&{g:s.news.g,t:s.news.t,left:s.news.left,c:GN[s.news.g]},me:me?me.i:-1}}
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
