'use strict';
/* Rules of the game: walking, the eight tasks, the seasons unlocking, the journal. */

const $=id=>document.getElementById(id);
const ORDER=[2,3,0,1];
const SEASON_NAME=['JARO','LÉTO','PODZIM','ZIMA'];
const SAVE='malovany-les-v1';
const SEASON_PAGES=[
  'NA JAŘE JE VÍC SLUNCE. RAŠÍ NOVÉ LISTY A KVETOU KVĚTINY.',
  'V LÉTĚ JE LES ZELENÝ. JE TEPLO A ZRAJÍ BORŮVKY.',
  'NA PODZIM JE MÉNĚ SLUNCE. LISTY ŽLOUTNOU A PADAJÍ.',
  'V ZIMĚ LISTNATÉ STROMY SPÍ. SMRK ZŮSTÁVÁ ZELENÝ I POD SNĚHEM.',
];
const SEASON_DONE=['JARO JE PROZKOUMANÉ. PŘICHÁZÍ LÉTO!','','PODZIM JE PROZKOUMANÝ. PŘICHÁZÍ ZIMA!','ZIMA JE PROZKOUMANÁ. PŘICHÁZÍ JARO!'];
const VIEW={
  pond:{cam:[0,4.4,11.4],look:[0,-1.1,0],hero:[-2.3,5.7]},
  log:{cam:[0,2.7,8.6],look:[0,0.1,0],hero:[-3.4,2.6]},
  animals:{cam:[0,2.1,5.9],look:[0,0.0,0],hero:[-2.5,1.5]},
  garden:{cam:[0,2.1,5.6],look:[0,0.1,0],hero:[-1.9,1.5]},
};

const st={mode:'title',season:2,unlocked:[2],done:{},seen:{},sound:true};
try{const s=JSON.parse(localStorage.getItem(SAVE)||'null');if(s){st.season=s.season;st.unlocked=s.unlocked;st.done=s.done||{};st.seen=s.seen||{};st.sound=s.sound!==false;}}catch(e){}
if(location.hash==='#vse')st.unlocked=[0,1,2,3];
function save(){try{localStorage.setItem(SAVE,JSON.stringify({season:st.season,unlocked:st.unlocked,done:st.done,seen:st.seen,sound:st.sound}));}catch(e){}}

/* ---------- sound: a few synthesised notes, no recordings ---------- */
let AC=null;
function tone(f,t,d,type,vol){const o=AC.createOscillator(),g=AC.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,AC.currentTime+t);
  g.gain.setValueAtTime(0,AC.currentTime+t);g.gain.linearRampToValueAtTime(vol||0.16,AC.currentTime+t+0.015);g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+t+d);
  o.connect(g).connect(AC.destination);o.start(AC.currentTime+t);o.stop(AC.currentTime+t+d+0.05);}
function sfx(n){
  if(!st.sound)return;
  try{
    AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
    if(n==='ok'){tone(660,0,0.14);tone(880,0.11,0.22);}
    else if(n==='no'){tone(220,0,0.22,'triangle',0.2);}
    else if(n==='pop'){tone(520,0,0.08,'triangle');}
    else if(n==='star'){[523,659,784,1047].forEach((f,i)=>tone(f,i*0.11,0.3));}
    else if(n==='season'){[392,494,587,784,988].forEach((f,i)=>tone(f,i*0.2,0.7,'sine',0.11));}
    else if(n==='splash'){const b=AC.createBuffer(1,AC.sampleRate*0.35,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
      const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();f.type='lowpass';f.frequency.value=1400;g.gain.value=0.3;s.buffer=b;s.connect(f).connect(g).connect(AC.destination);s.start();}
  }catch(e){}
}

/* ---------- flow: say, ask, tween; all cancellable when a task is left ---------- */
const CANCEL={cancel:true};
let waiter=null,correctNow=null,pickables=null;
function hold(){return new Promise((res,rej)=>{waiter={res,rej};});}
function release(v){const w=waiter;waiter=null;pickables=null;if(w)w.res(v);}
const tweens=[];
function tw(dur,fn,keep){return new Promise((res,rej)=>{tweens.push({t:0,dur,fn,res,rej,keep});});}
function wait(s){return tw(s,()=>{});}
function stepTweens(dt){for(let i=tweens.length-1;i>=0;i--){const w=tweens[i];w.t+=dt;const k=Math.min(1,w.t/w.dur);try{w.fn(k);}catch(e){console.error(e);}
  if(k>=1){const j=tweens.indexOf(w);if(j>=0)tweens.splice(j,1);w.res();}}}
function cancelFlow(){const w=waiter;waiter=null;pickables=null;if(w)w.rej(CANCEL);
  for(let i=tweens.length-1;i>=0;i--)if(!tweens[i].keep){const x=tweens[i];tweens.splice(i,1);x.rej(CANCEL);}}
const eo=k=>1-Math.pow(1-k,3),eio=k=>k*k*(3-2*k),back=k=>{const c=1.70158;return 1+(c+1)*Math.pow(k-1,3)+c*Math.pow(k-1,2);};

const panel=$('panel'),textEl=$('text'),choicesEl=$('choices'),nextBtn=$('btnNext'),wordEl=$('word');
function say(text,o){
  panel.hidden=false;textEl.textContent=text;choicesEl.replaceChildren();nextBtn.hidden=false;if(!(o&&o.word))wordEl.hidden=true;correctNow=null;
  return hold().then(()=>{panel.hidden=true;});
}
function ask(text,opts,o){
  panel.hidden=false;textEl.textContent=text;nextBtn.hidden=true;if(!(o&&o.word))wordEl.hidden=true;
  choicesEl.replaceChildren(...opts.map(op=>{const lab=Array.isArray(op)?op[0]:String(op),val=Array.isArray(op)?op[1]:op;
    const b=document.createElement('button');b.className='choice';b.textContent=lab;b.dataset.v=String(val);b.onclick=()=>{sfx('pop');release(val);};return b;}));
  pickables=o&&o.pick?o.pick:null;
  return hold().then(v=>{panel.hidden=true;return v;});
}
async function quiz(text,opts,correct,wrong,o){
  for(;;){correctNow=String(correct);const v=await ask(text,opts,o);correctNow=null;
    if(v===correct){sfx('ok');return;}
    sfx('no');await say(wrong||'ZKUS TO JEŠTĚ JEDNOU.',o);}
}
nextBtn.onclick=()=>{if(waiter&&!nextBtn.hidden){sfx('pop');release();}};
function showWord(w,gi,solved){wordEl.hidden=false;wordEl.replaceChildren(...[...w].map((ch,i)=>{const s=document.createElement('span');
  if(i===gi){s.className=solved?'hit':'gap';s.textContent=solved?ch:'?';}else s.textContent=ch;return s;}));}

/* ---------- small stage directions ---------- */
let stage=null;
const floaters=[],spinners=[];
function pop(o){const s=o.scale.x;o.scale.setScalar(0.001);sfx('pop');return tw(0.32,k=>o.scale.setScalar(Math.max(0.001,s*back(k))));}
function toss(o,x,y,z,dur,arc){const a=o.position.clone();return tw(dur,k=>{o.position.set(lerp(a.x,x,k),lerp(a.y,y,k)+arc*4*k*(1-k),lerp(a.z,z,k));o.rotation.x+=0.12;o.rotation.z+=0.07;});}
function hop(o){const y=o.position.y;sfx('ok');return tw(0.7,k=>{o.position.y=y+Math.abs(Math.sin(k*Math.PI*2))*0.35*(1-k*0.4);});}
function shake(o){const r=o.rotation.y;return tw(0.5,k=>{o.rotation.y=r+Math.sin(k*Math.PI*4)*0.45*(1-k);});}
const ringGeo=new THREE.RingGeometry(0.22,0.3,28).rotateX(-Math.PI/2);
function splash(x,z){for(let i=0;i<3;i++){const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.9,depthWrite:false}));
  m.position.set(x,0.1,z);m.renderOrder=3;scene.add(m);
  tw(1.1+i*0.35,k=>{const e=eo(k);m.scale.setScalar(1+e*(4+i*2.5));m.material.opacity=0.9*(1-k);},true).then(()=>{scene.remove(m);m.material.dispose();});}}
function drops(x,z){const g=new THREE.Group();stage.add(g);const ds=[];
  for(let i=0;i<16;i++){const d=part(g,G_SPH,'#4aa8e0',x+rr(-0.5,0.5),2.4+rr(0,1.6),z+rr(-0.5,0.5),0.035,0.075,0.035);ds.push([d,d.position.y]);}
  return tw(1.5,k=>{for(const[d,y0]of ds){d.position.y=Math.max(0.1,y0-k*4.2);d.visible=d.position.y>0.12;}}).then(()=>stage.remove(g));}

/* ---------- the eight tasks ---------- */
async function tPlave(){
  const p=PLACES.pond;
  await say('CO PLAVE A CO SE POTOPÍ? ZKUSÍME TO!');
  const items=[
    {a:'KÁMEN',mk:()=>ITEM.stone(1.3),fl:false,y:0,t:'KÁMEN JE TĚŽŠÍ NEŽ VODA. KLESL KE DNU.'},
    {a:'KLACEK',mk:()=>ITEM.stick(),fl:true,y:0.07,t:'DŘEVO JE LEHČÍ NEŽ VODA. PROTO KLACEK PLAVE.'},
    {a:'JABLKO',mk:()=>ITEM.apple(),fl:true,y:0.1,t:'JABLKO PLAVE! MÁ V SOBĚ TROCHU VZDUCHU.'},
    {a:'MALÝ KAMÍNEK',mk:()=>ITEM.stone(0.5),fl:false,y:0,t:'I MALÝ KAMÍNEK SE POTOPÍ. NEZÁLEŽÍ NA VELIKOSTI.'},
    {a:'VELKOU KLÁDU',mk:()=>ITEM.log(),fl:true,y:0.12,t:'I VELKÁ KLÁDA PLAVE. JE ZE DŘEVA.'},
  ];
  for(let i=0;i<items.length;i++){
    const it=items[i],o=it.mk();o.scale.multiplyScalar(1.7);stage.add(o);
    o.position.set(hero.position.x+1.0,1.55,hero.position.z-0.5);
    await pop(o);
    const g=await ask('HODÍME DO VODY '+it.a+'. CO SE STANE?',[['PLAVE',true],['POTOPÍ SE',false]]);
    const tx=p.x-2.6+i*1.3,tz=p.z+1.1-(i%2)*1.9;
    await toss(o,tx,it.y+0.05,tz,0.9,2.3);
    splash(tx,tz);sfx('splash');
    if(it.fl){o.rotation.set(0,rnd()*6,0);floaters.push({o,y:it.y+0.05,ph:rnd()*6});}
    else await tw(1.0,k=>{o.position.y=0.05-k*1.4;});
    await wait(0.5);
    sfx(g===it.fl?'ok':'no');
    await say((g===it.fl?'SPRÁVNĚ! ':'PODÍVEJ! ')+it.t);
  }
  await say('NEZÁLEŽÍ, JAK JE VĚC VELKÁ. ZÁLEŽÍ, Z ČEHO JE.');
}
async function tJidlo(){
  const A=PLACES.animals,N={v:'VEVERKA',j:'JEŽEK',z:'ZAJÍC'};
  await say('ZVÍŘÁTKA MAJÍ HLAD. KOMU CO CHUTNÁ?');
  const rounds=[
    {a:'OŘÍŠEK',mk:ITEM.nut,to:'v',t:'VEVERKA MÁ RÁDA OŘÍŠKY. SCHOVÁVÁ SI JE NA ZIMU.'},
    {a:'ŽÍŽALU',mk:ITEM.worm,to:'j',t:'JEŽEK JÍ ŽÍŽALY A BROUKY. JABLKA NEJÍ!'},
    {a:'JETEL',mk:ITEM.clover,to:'z',t:'ZAJÍC JÍ TRÁVU A JETEL.'},
    {a:'ŠIŠKU',mk:ITEM.cone,to:'v',t:'VEVERKA SI ZE ŠIŠKY VYLOUPE SEMÍNKA.'},
  ];
  const opts=[['VEVERKA','v'],['JEŽEK','j'],['ZAJÍC','z']];
  for(const r of rounds){
    const o=r.mk();o.scale.setScalar(2.6);stage.add(o);o.position.set(A.x,1.75,A.z+0.7);spinners.push(o);
    await pop(o);
    for(;;){
      correctNow=r.to;const v=await ask('KOMU DÁME '+r.a+'?',opts,{pick:Object.values(animals)});correctNow=null;
      if(v===r.to)break;
      sfx('no');await shake(animals[v]);await say(N[v]+' ŘÍKÁ: TO MI NECHUTNÁ! ZKUS TO ZNOVU.');
    }
    const an=animals[r.to];spinners.length=0;
    await toss(o,A.x+an.position.x,0.55,A.z+an.position.z+0.35,0.6,0.7);stage.remove(o);
    await hop(an);await say(r.t);
  }
  await say('KAŽDÉ ZVÍŘE JÍ NĚCO JINÉHO. PROTO SE V LESE NAJEDÍ VŠICHNI.');
}
async function tPtacci(){
  birds.forEach(b=>b.visible=false);let n=0;
  const fly=k=>{const ps=[];for(let i=n;i<n+k;i++){const b=birds[i],to=birdSeat(i),fx=to.x+rr(-5,5),fy=rr(5,7),fz=rr(-7,-4);b.visible=true;b.position.set(fx,fy,fz);
    ps.push(wait((i-n)*0.22).then(()=>tw(0.9,q=>{const e=eo(q);b.position.set(lerp(fx,to.x,e),lerp(fy,to.y,e)+Math.sin(q*Math.PI)*0.6,lerp(fz,to.z,e));})).then(()=>sfx('pop')));}n+=k;return Promise.all(ps);};
  const leave=k=>{const ps=[];for(let i=n-k;i<n;i++){const b=birds[i],a=b.position.clone(),tx=a.x+rr(-4,4);
    ps.push(tw(0.9,q=>{b.position.set(lerp(a.x,tx,q),a.y+q*q*6,a.z-q*5);}).then(()=>{b.visible=false;}));}n-=k;return Promise.all(ps);};
  await say('PTÁČCI HLEDAJÍ V ZIMĚ JÍDLO. SPOČÍTEJ JE!');
  await fly(4);
  await quiz('KOLIK PTÁČKŮ SEDÍ NA KLÁDĚ?',[3,4,5],4,'SPOČÍTEJ JE JEŠTĚ JEDNOU.');
  await say('ANO, JSOU 4.');
  await fly(3);
  await quiz('PŘILETĚLI 3 DALŠÍ. KOLIK JICH JE TEĎ?',[6,7,8],7,'SPOČÍTEJ JE JEŠTĚ JEDNOU.');
  await say('4 + 3 = 7');
  await leave(2);
  await quiz('2 PTÁČCI ODLETĚLI. KOLIK JICH ZBYLO?',[4,5,6],5,'SPOČÍTEJ JE JEŠTĚ JEDNOU.');
  await say('7 − 2 = 5');
  await fly(5);
  await quiz('PŘILETĚLO 5 PTÁČKŮ. KOLIK JICH JE?',[9,10,11],10,'SPOČÍTEJ JE JEŠTĚ JEDNOU.');
  await say('5 + 5 = 10. VÝBORNĚ POČÍTÁŠ!');
  await say('V ZIMĚ PTÁČKŮM POMÁHÁ KRMÍTKO SE SEMÍNKY.');
}
async function tHadanky(){
  for(const k in animals)animals[k].visible=false;
  await say('VE SNĚHU JSOU STOPY. KDO TU BYL? PŘEČTI SI HÁDANKU.');
  const R=[
    {q:'MÁM DLOUHÉ UŠI. RYCHLE SKÁČU. KDO JSEM?',o:[['JEŽEK','j'],['ZAJÍC','z'],['VEVERKA','v']],c:'z',t:'ZAJÍC MÁ V ZIMĚ HUSTÝ KOŽÍŠEK.'},
    {q:'MÁM HUŇATÝ OCAS. ŠPLHÁM PO STROMECH. KDO JSEM?',o:[['VEVERKA','v'],['ZAJÍC','z'],['RYBA','r']],c:'v',t:'VEVERKA V ZIMĚ JÍ SVÉ ZÁSOBY OŘÍŠKŮ.'},
    {q:'MÁM BODLINY. CELOU ZIMU SPÍM. KDO JSEM?',o:[['ZAJÍC','z'],['PTÁČEK','p'],['JEŽEK','j']],c:'j',t:'JEŽEK SPÍ POD LISTÍM AŽ DO JARA. PSST!'},
  ];
  for(const r of R){
    await quiz(r.q,r.o,r.c,'TO NENÍ ONO. PŘEČTI SI HÁDANKU ZNOVU.');
    const an=animals[r.c];an.visible=true;await pop(an);await hop(an);await say(r.t);
  }
  await say('KAŽDÉ ZVÍŘE PŘEČKÁ ZIMU JINAK.');
}
async function tSeminko(){
  const G=PLACES.garden;sapling.visible=false;
  const ac=ITEM.acorn();ac.scale.setScalar(2.4);stage.add(ac);ac.position.set(G.x,1.5,G.z+0.2);spinners.push(ac);
  await pop(ac);
  await say('NAŠLA JSI ŽALUD. JE TO SEMÍNKO DUBU. ZASADÍME HO!');
  await quiz('KAM DÁME SEMÍNKO?',[['NA KÁMEN','k'],['DO HLÍNY','h'],['DO VODY','v']],'h','TAM BY NEVYROSTLO. ZKUS TO ZNOVU.');
  spinners.length=0;
  await tw(0.8,k=>{ac.position.y=1.5-eio(k)*1.45;});stage.remove(ac);
  await say('SEMÍNKO JE V HLÍNĚ.');
  await quiz('CO SEMÍNKO POTŘEBUJE?',[['VODU','v'],['SNÍH','s'],['PÍSEK','p']],'v','TO SEMÍNKU NEPOMŮŽE. ZKUS TO ZNOVU.');
  await drops(G.x,G.z);
  await quiz('A CO JEŠTĚ POTŘEBUJE?',[['TMU','t'],['MRÁZ','m'],['SLUNCE','s']],'s','TO SEMÍNKU NEPOMŮŽE. ZKUS TO ZNOVU.');
  const sp=new THREE.Group();stage.add(sp);sp.position.set(G.x,0.14,G.z);
  part(sp,G_CYL,'#8fd05a',0,0.2,0,0.022,0.4,0.022);
  const l1=part(sp,G_SPH,'#8fd05a',-0.09,0.4,0,0.1,0.02,0.055),l2=part(sp,G_SPH,'#a6d15a',0.09,0.4,0,0.1,0.02,0.055);l1.rotation.z=0.5;l2.rotation.z=-0.5;
  sp.scale.setScalar(0.01);sfx('star');
  await tw(1.6,k=>sp.scale.setScalar(0.01+eo(k)*1.3));
  await say('VYRÁŽÍ KLÍČEK!');
  await quiz('CO ROSTE POD ZEMÍ?',[['LISTY','l'],['KOŘENY','k'],['KVĚTY','v']],'k','TO ROSTE NAD ZEMÍ. ZKUS TO ZNOVU.');
  await say('KOŘENY PIJÍ VODU Z HLÍNY.');
  stage.remove(sp);sapling.visible=true;sapling.scale.setScalar(0.05);sfx('star');
  await tw(2.2,k=>sapling.scale.setScalar(0.05+eo(k)*0.75));
  await say('ZE ŽALUDU VYROSTE DUB. POTŘEBUJE HLÍNU, VODU A SLUNCE.');
}
async function tSlova(){
  frog.position.set(PADS[0][0],0.1,PADS[0][1]);
  await say('ŽÁBA ZTRATILA PÍSMENA. DOPLŇ SLOVA A ŽÁBA PŘESKÁČE RYBNÍK!');
  const W=[['LES',1,'ROSTOU V NĚM STROMY.',['A','E','U']],['ŽÁBA',2,'SKÁČE A KVÁKÁ.',['B','D','P']],['VODA',2,'JE V RYBNÍKU.',['T','D','K']],
    ['LIST',2,'ROSTE NA STROMĚ.',['Z','Š','S']],['STROM',4,'MÁ KMEN A VĚTVE.',['N','M','V']]];
  for(let i=0;i<W.length;i++){
    const[w,gi,hint,opts]=W[i];showWord(w,gi,false);
    await quiz(hint,opts,w[gi],'TO PÍSMENO SEM NEPATŘÍ. ZKUS JINÉ.',{word:true});
    showWord(w,gi,true);
    const a=frog.position.clone(),b=PADS[i+1];
    await tw(0.6,k=>{frog.position.set(lerp(a.x,b[0],k),0.1+Math.sin(k*Math.PI)*0.9,lerp(a.z,b[1],k));});
    splash(PLACES.pond.x+b[0],PLACES.pond.z+b[1]);sfx('splash');
    await say(w+'!',{word:true});
  }
  wordEl.hidden=true;
  await say('UMÍŠ SKLÁDAT SLOVA Z PÍSMEN. ŽÁBA DĚKUJE!');
}
async function tHoupacka(){
  let seat=3,mice=1;mouse2.visible=false;bear.position.x=-3*SEAT;pivot.rotation.z=0.2;
  const tilt=()=>{const a=pivot.rotation.z,b=clamp((3*seat-mice*3)*0.07,-0.2,0.2);return tw(1.0,k=>{pivot.rotation.z=lerp(a,b,eio(k))+Math.sin(k*Math.PI*3)*0.03*(1-k);});};
  const sit=v=>{const a=bear.position.x,b=-v*SEAT;seat=v;return tw(0.6,k=>{bear.position.x=lerp(a,b,k);bear.position.y=0.15+Math.sin(k*Math.PI)*0.5;});};
  const opts=[['MÍSTO 1',1],['MÍSTO 2',2],['MÍSTO 3',3]];
  await say('MEDVÍDEK A MYŠKA SE CHTĚJÍ HOUPAT. MEDVÍDEK JE ALE MOC TĚŽKÝ.');
  for(;;){
    correctNow='1';const v=await ask('KAM SI MÁ MEDVÍDEK SEDNOUT, ABY BYLA HOUPAČKA ROVNĚ?',opts);correctNow=null;
    await sit(v);await tilt();
    if(v===1){sfx('ok');break;}
    sfx('no');await say(v===3?'MEDVÍDEK JE ÚPLNĚ DOLE. POSAĎ HO BLÍŽ KE STŘEDU.':'UŽ JE TO LEPŠÍ. ZKUS TO JEŠTĚ BLÍŽ KE STŘEDU.');
  }
  await say('HURÁ! HOUPAČKA JE ROVNĚ. TĚŽKÝ MEDVÍDEK SEDÍ BLÍZKO STŘEDU.');
  mouse2.visible=true;await pop(mouse2);mice=2;await tilt();
  await say('PŘIŠLA DRUHÁ MYŠKA. TEĎ MYŠKY MEDVÍDKA PŘEVÁŽILY!');
  for(;;){
    correctNow='2';const v=await ask('KAM SI MÁ MEDVÍDEK SEDNOUT TEĎ?',opts);correctNow=null;
    await sit(v);await tilt();
    if(v===2){sfx('ok');break;}
    sfx('no');await say(v===1?'MYŠKY JSOU POŘÁD DOLE. MEDVÍDEK MUSÍ DÁL OD STŘEDU.':'TEĎ JE DOLE MEDVÍDEK. ZKUS TO BLÍŽ KE STŘEDU.');
  }
  await say('VÝBORNĚ! KDO SEDÍ DÁL OD STŘEDU, MÁ VĚTŠÍ SÍLU.');
  await say('TOMU SE ŘÍKÁ PÁKA. S PÁKOU ZVEDNEŠ I TĚŽKÉ VĚCI.');
}
async function tBoruvky(){
  berries.forEach(b=>{b.got=false;b.fruit.visible=true;});
  await say('V LÉTĚ ZRAJÍ BORŮVKY. NAJDI JICH 8 A NASBÍREJ JE!');
  await say('ROSTOU NA MALÝCH KEŘÍCÍCH KOLEM. DOJDI AŽ K NIM.');
  await collect(8);
  await quiz('MÁŠ 8 BORŮVEK. 3 SNÍŠ. KOLIK TI ZBYDE?',[4,5,6],5,'ZKUS TO SPOČÍTAT NA PRSTECH.');
  await say('8 − 3 = 5');
  await quiz('VEVERKA TI PŘINESE 4 DALŠÍ. KOLIK JICH MÁŠ?',[8,9,10],9,'ZKUS TO SPOČÍTAT NA PRSTECH.');
  await say('5 + 4 = 9. VÝBORNĚ!');
  await say('V LESE JEZ JEN TO, CO DOBŘE ZNÁŠ.');
}
let quest=null;
function collect(n){quest={n,got:0};st.mode='quest';$('quest').hidden=false;$('quest').textContent='BORŮVKY 0 / '+n;panel.hidden=true;
  return hold().then(()=>{quest=null;$('quest').hidden=true;st.mode='task';});}

const TASKS=[
  {id:'plave',season:2,place:'pond',tag:'FYZIKA',title:'PLAVE, NEBO SE POTOPÍ?',color:'#3aa0d8',run:tPlave,page:'DŘEVO A JABLKO PLAVOU. KÁMEN SE POTOPÍ, I KDYŽ JE MALÝ. ZÁLEŽÍ, Z ČEHO VĚC JE.'},
  {id:'jidlo',season:2,place:'animals',tag:'PŘÍRODA',title:'KDO CO JÍ?',color:'#e0702a',run:tJidlo,page:'VEVERKA JÍ OŘÍŠKY A SEMÍNKA. JEŽEK JÍ ŽÍŽALY A BROUKY. ZAJÍC JÍ TRÁVU A JETEL.'},
  {id:'ptacci',season:3,place:'log',tag:'POČÍTÁNÍ',title:'SPOČÍTEJ PTÁČKY',color:'#f0c020',run:tPtacci,page:'4 + 3 = 7. 7 − 2 = 5. 5 + 5 = 10. V ZIMĚ PTÁČKŮM POMÁHÁ KRMÍTKO.'},
  {id:'hadanky',season:3,place:'animals',tag:'ČTENÍ',title:'HÁDANKY ZE SNĚHU',color:'#c04a8a',run:tHadanky,page:'ZAJÍC MÁ V ZIMĚ HUSTÝ KOŽÍŠEK. VEVERKA JÍ ZÁSOBY. JEŽEK CELOU ZIMU SPÍ.'},
  {id:'seminko',season:0,place:'garden',tag:'PŘÍRODA',title:'ZASAĎ SEMÍNKO',color:'#5ab040',run:tSeminko,page:'SEMÍNKO POTŘEBUJE HLÍNU, VODU A SLUNCE. KOŘENY PIJÍ VODU. ZE ŽALUDU VYROSTE DUB.'},
  {id:'slova',season:0,place:'pond',tag:'ČTENÍ',title:'ŽABÍ SLOVA',color:'#c04a8a',run:tSlova,page:'LES. ŽÁBA. VODA. LIST. STROM. SLOVA SE SKLÁDAJÍ Z PÍSMEN.'},
  {id:'houpacka',season:1,place:'log',tag:'FYZIKA',title:'HOUPAČKA',color:'#3aa0d8',run:tHoupacka,page:'TĚŽKÝ MUSÍ SEDĚT BLÍŽ KE STŘEDU HOUPAČKY. TOMU SE ŘÍKÁ PÁKA.'},
  {id:'boruvky',season:1,place:'garden',tag:'POČÍTÁNÍ',title:'SBÍRÁNÍ BORŮVEK',color:'#f0c020',free:true,run:tBoruvky,page:'8 − 3 = 5. 5 + 4 = 9. BORŮVKY ZRAJÍ V LÉTĚ NA MALÝCH KEŘÍCÍCH.'},
];
const seasonTasks=s=>TASKS.filter(t=>t.season===s);
const seasonDone=s=>seasonTasks(s).every(t=>st.done[t.id]);

/* ---------- journal and HUD ---------- */
function journalCount(){return Object.keys(st.seen).filter(k=>/^s\d$/.test(k)).length+TASKS.filter(t=>st.done[t.id]).length;}
function renderJournal(){
  const out=[];
  const card=(s,tag,title,text,open)=>{const d=document.createElement('div');d.className='page'+(open?'':' locked');d.dataset.s=s;
    const a=document.createElement('div');a.className='tag';a.textContent=tag;const h=document.createElement('h3');h.textContent=open?title:'?';
    const p=document.createElement('p');p.textContent=open?text:'TATO STRÁNKA JE ZATÍM PRÁZDNÁ.';d.append(a,h,p);return d;};
  for(const s of ORDER){
    out.push(card(s,SEASON_NAME[s],SEASON_NAME[s]+' V LESE',SEASON_PAGES[s],!!st.seen['s'+s]));
    for(const t of seasonTasks(s))out.push(card(s,SEASON_NAME[s]+' · '+t.tag,t.title,t.page,!!st.done[t.id]));
  }
  $('pages').replaceChildren(...out);
}
function updateHud(){
  document.querySelectorAll('#seasons .pill').forEach(b=>{const s=+b.dataset.s;b.disabled=!st.unlocked.includes(s);b.setAttribute('aria-pressed',String(s===st.season));});
  $('jcount').textContent=journalCount()+'/12';
  $('btnSound').textContent=st.sound?'ZVUK ANO':'ZVUK NE';$('btnSound').setAttribute('aria-pressed',String(st.sound));
}
function nudgeJournal(){const b=$('btnJournal');b.classList.remove('new');void b.offsetWidth;b.classList.add('new');}

/* ---------- markers and seasonal props ---------- */
const markers={};for(const k in PLACES){markers[k]=makeMarker('#ffffff');markers[k].position.set(PLACES[k].x,0,PLACES[k].z);}
function refreshMarkers(){
  for(const k in markers)markers[k].visible=false;
  for(const t of seasonTasks(st.season)){const m=markers[t.place],d=!!st.done[t.id],c=C(d?'#f4b72e':t.color);m.visible=true;
    m.userData.beam.material.color.copy(c);m.userData.beam.material.opacity=d?0.18:0.5;m.userData.gem.material.color.copy(c);m.userData.gem.material.emissive.copy(c);m.userData.done=d;}
}
function refreshProps(){
  const s=st.season;
  lilyG.visible=s===0;
  signsG.visible=bear.visible=mouse.visible=s===1;mouse2.visible=false;
  bear.position.x=-3*SEAT;pivot.rotation.z=s===1?0.2:0;
  birds.forEach((b,i)=>{b.visible=s===3&&!!st.done.ptacci&&i<5;b.position.copy(birdSeat(i*2));});
  animals.v.visible=animals.z.visible=s!==3||!!st.done.hadanky;animals.j.visible=s!==3;
  sapling.visible=!!st.done.seminko;sapling.scale.setScalar(s===0?0.8:1.15);
  berriesG.visible=s===1;
}

/* ---------- walking and the camera ---------- */
const cam={yaw:0,pitch:0.06,dist:7.6,pos:new THREE.Vector3(0,3,12),look:new THREE.Vector3(0,1.2,0),fixed:null};
const walk={target:null,heading:Math.PI,vy:0,y:0,phase:0,speed:0,stuck:0,lastX:0,lastZ:0};
hero.position.set(0,0,2);hero.rotation.y=Math.PI;
const keys={};
window.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if((e.code==='Enter'||e.code==='Space')&&waiter&&!nextBtn.hidden&&!panel.hidden){e.preventDefault();nextBtn.click();return;}
  if(e.code==='Space'&&canWalk()&&walk.y===0){e.preventDefault();walk.vy=4.4;}
  if(e.code.startsWith('Arrow'))e.preventDefault();
});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
const canWalk=()=>st.mode==='roam'||st.mode==='quest';
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
const targetRing=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false}));targetRing.renderOrder=3;targetRing.scale.setScalar(1.6);scene.add(targetRing);
const ptr={id:null,x:0,y:0,sx:0,sy:0,drag:false};
const cv=renderer.domElement;
cv.addEventListener('pointerdown',e=>{ptr.id=e.pointerId;ptr.x=ptr.sx=e.clientX;ptr.y=ptr.sy=e.clientY;ptr.drag=false;try{cv.setPointerCapture(e.pointerId);}catch(_){}});
cv.addEventListener('pointermove',e=>{
  if(ptr.id!==e.pointerId)return;
  if(!ptr.drag&&Math.hypot(e.clientX-ptr.sx,e.clientY-ptr.sy)>9)ptr.drag=true;
  if(ptr.drag&&canWalk()){cam.yaw-=(e.clientX-ptr.x)*0.006;cam.pitch=clamp(cam.pitch+(e.clientY-ptr.y)*0.004,-0.12,0.7);}
  ptr.x=e.clientX;ptr.y=e.clientY;
});
function endPtr(e){
  if(ptr.id!==e.pointerId)return;ptr.id=null;
  if(ptr.drag||e.type==='pointercancel')return;
  ndc.set(e.clientX/window.innerWidth*2-1,-(e.clientY/window.innerHeight)*2+1);ray.setFromCamera(ndc,camera);
  if(pickables){const hit=ray.intersectObjects(pickables,true)[0];if(hit){let o=hit.object;while(o&&!o.userData.pick)o=o.parent;if(o){sfx('pop');release(o.userData.pick);}}return;}
  if(!canWalk())return;
  const d=ray.ray.direction,o=ray.ray.origin;if(d.y>-0.02)return;
  const t=Math.min(-o.y/d.y,45),x=o.x+d.x*t,z=o.z+d.z*t;
  walk.target={x,z};walk.stuck=0;targetRing.position.set(x,0.09,z);targetRing.material.opacity=0.9;
}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{e.preventDefault();cam.dist=clamp(cam.dist+Math.sign(e.deltaY)*0.8,4,14);},{passive:false});

function angDiff(a,b){let d=(a-b)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;}
function stepHero(dt,time){
  let vx=0,vz=0,sp=0;
  if(canWalk()){
    const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),tr=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
    if(tr)cam.yaw-=tr*1.9*dt;
    if(f||tr)walk.target=null;
    const run=keys.ShiftLeft||keys.ShiftRight?1.6:1;
    if(f){sp=3.7*run;vx=-Math.sin(cam.yaw)*f;vz=-Math.cos(cam.yaw)*f;}
    else if(tr){walk.heading+=angDiff(cam.yaw+Math.PI,walk.heading)*Math.min(1,dt*8);}
    else if(walk.target){const dx=walk.target.x-hero.position.x,dz=walk.target.z-hero.position.z,d=Math.hypot(dx,dz);
      if(d<0.2)walk.target=null;else{sp=Math.min(3.7,d*4+0.8);vx=dx/d;vz=dz/d;
        const want=Math.atan2(vx,vz)+Math.PI,df=angDiff(want,cam.yaw);if(Math.abs(df)<2.3)cam.yaw+=df*Math.min(1,dt*0.9);}}
  }
  if(sp>0){
    const[nx,nz]=collide(hero.position.x+vx*sp*dt,hero.position.z+vz*sp*dt,0.34,st.season===3);
    const moved=Math.hypot(nx-hero.position.x,nz-hero.position.z);
    hero.position.x=nx;hero.position.z=nz;
    walk.heading+=angDiff(Math.atan2(vx,vz),walk.heading)*Math.min(1,dt*10);
    if(walk.target){if(moved<sp*dt*0.25){walk.stuck+=dt;if(walk.stuck>0.5)walk.target=null;}else walk.stuck=0;}
    walk.phase+=moved*3.6;
  }
  walk.speed=lerp(walk.speed,sp>0?1:0,Math.min(1,dt*10));
  if(walk.vy||walk.y>0){walk.vy-=11.5*dt;walk.y+=walk.vy*dt;if(walk.y<=0){walk.y=0;walk.vy=0;}}
  hero.rotation.y=walk.heading;
  const s=Math.sin(walk.phase)*walk.speed;
  heroParts.legL.rotation.x=s*0.75;heroParts.legR.rotation.x=-s*0.75;heroParts.armL.rotation.x=-s*0.6;heroParts.armR.rotation.x=s*0.6;
  hero.position.y=walk.y;heroBody.position.y=Math.abs(Math.cos(walk.phase))*0.045*walk.speed+Math.sin(time*2)*0.006;
  heroBlob.position.set(hero.position.x,0.045,hero.position.z);heroBlob.scale.setScalar(0.9/(1+walk.y*0.8));
  if(targetRing.material.opacity>0)targetRing.material.opacity=walk.target?0.55+Math.sin(time*6)*0.25:Math.max(0,targetRing.material.opacity-dt*3);
}
const _goal=new THREE.Vector3(),_lookGoal=new THREE.Vector3();
function stepCamera(dt,snap){
  if(cam.fixed){_goal.copy(cam.fixed.pos);_lookGoal.copy(cam.fixed.look);}
  else{const cp=Math.cos(cam.pitch);_lookGoal.set(hero.position.x,1.7+hero.position.y*0.5,hero.position.z);
    _goal.set(_lookGoal.x+Math.sin(cam.yaw)*cp*cam.dist,_lookGoal.y+Math.sin(cam.pitch)*cam.dist+0.35,_lookGoal.z+Math.cos(cam.yaw)*cp*cam.dist);
    // a trunk between the eye and Vendulka: step the eye in front of it
    const ax=_lookGoal.x,az=_lookGoal.z,bx=_goal.x-ax,bz=_goal.z-az,L=Math.hypot(bx,bz)||1;let f=1;
    for(let q=0.2;q<=1.001;q+=0.2)for(const t of nearTrees(ax+bx*q,az+bz*q)){
      const s=((t.x-ax)*bx+(t.z-az)*bz)/(L*L);if(s<0.05||s>1.12)continue;
      const d=Math.hypot(ax+bx*s-t.x,az+bz*s-t.z),m=t.r+0.45;if(d>=m)continue;
      f=Math.min(f,Math.max(0.2,s-Math.sqrt(m*m-d*d)/L-0.03));}
    if(f<1){_goal.x=ax+bx*f;_goal.z=az+bz*f;_goal.y=_lookGoal.y+(_goal.y-_lookGoal.y)*Math.max(f,0.55);}}
  const k=snap?1:1-Math.exp(-dt*(cam.fixed?3:7));
  cam.pos.lerp(_goal,k);cam.look.lerp(_lookGoal,k);
  camera.position.copy(cam.pos);camera.lookAt(cam.look);
}

/* ---------- tasks: enter, leave, reward ---------- */
let current=null,busy=false;
function nearTask(){
  for(const t of seasonTasks(st.season)){const p=PLACES[t.place];if(Math.hypot(hero.position.x-p.x,hero.position.z-p.z)<(p.r||2.5)+3.6)return t;}
  return null;
}
async function runTask(task){
  if(busy||st.mode!=='roam')return;
  busy=true;current=task;st.mode='task';walk.target=null;
  for(const k in markers)markers[k].visible=false;
  stage=new THREE.Group();scene.add(stage);
  const p=PLACES[task.place],v=VIEW[task.place];
  if(!task.free){
    hero.position.set(p.x+v.hero[0],0,p.z+v.hero[1]);walk.heading=Math.atan2(-v.hero[0],-v.hero[1]+ -0.0001);
    cam.fixed={pos:new THREE.Vector3(p.x+v.cam[0],v.cam[1],p.z+v.cam[2]),look:new THREE.Vector3(p.x+v.look[0],v.look[1],p.z+v.look[2])};
  }
  let ok=false;
  try{await task.run();ok=true;}catch(e){if(e!==CANCEL)console.error(e);}
  scene.remove(stage);stage=null;floaters.length=0;spinners.length=0;quest=null;$('quest').hidden=true;wordEl.hidden=true;panel.hidden=true;
  if(cam.fixed){cam.yaw=Math.atan2(cam.fixed.pos.x-hero.position.x,cam.fixed.pos.z-hero.position.z);cam.fixed=null;}
  current=null;st.mode='roam';
  const first=ok&&!st.done[task.id];
  if(ok)st.done[task.id]=1;
  refreshProps();refreshMarkers();updateHud();save();
  try{
    if(first){sfx('star');nudgeJournal();await say('MÁŠ NOVÝ ZÁPIS V DENÍKU: '+task.title);await progress();}
  }catch(e){if(e!==CANCEL)console.error(e);}
  busy=false;
}
async function progress(){
  const s=st.season;
  if(!seasonDone(s))return;
  const next=ORDER[ORDER.indexOf(s)+1];
  if(next!==undefined&&!st.unlocked.includes(next)){st.unlocked.push(next);updateHud();save();await say(SEASON_DONE[s]);await changeSeason(next);}
  else if(TASKS.every(t=>st.done[t.id])&&!st.seen.fin){st.seen.fin=1;save();sfx('star');
    await say('DENÍK JE PLNÝ! PROŠLA JSI LESEM CELÝ ROK.');await say('JSI OPRAVDOVÁ BADATELKA, VENDULKO!');}
}
async function changeSeason(s){
  if(s===st.season)return;
  const a=st.season;let swapped=false;st.season=s;sfx('season');updateHud();
  for(const k in markers)markers[k].visible=false;
  await tw(2.6,k=>{paintSeason(a,s,k);if(k>0.5&&!swapped){swapped=true;refreshProps();}},true);
  refreshMarkers();save();
  if(!st.seen['s'+s]){st.seen['s'+s]=1;save();updateHud();nudgeJournal();await say(SEASON_PAGES[s]);}
}
$('btnBack').onclick=()=>{if(st.mode==='task'||st.mode==='quest')cancelFlow();};
$('btnExplore').onclick=()=>{const t=nearTask();if(t){sfx('pop');runTask(t);}};
document.querySelectorAll('#seasons .pill').forEach(b=>b.onclick=async()=>{
  if(busy||st.mode!=='roam'||b.disabled)return;busy=true;
  try{await changeSeason(+b.dataset.s);}catch(e){if(e!==CANCEL)console.error(e);}busy=false;});
$('btnJournal').onclick=()=>{renderJournal();$('journal').hidden=false;$('btnJournal').classList.remove('new');sfx('pop');};
$('btnCloseJournal').onclick=()=>{$('journal').hidden=true;};
$('btnSound').onclick=()=>{st.sound=!st.sound;updateHud();save();sfx('pop');};
let resetArmed=false;
$('btnReset').onclick=()=>{if(!resetArmed){resetArmed=true;$('btnReset').textContent='Opravdu smazat celý deník? Klikni ještě jednou.';return;}
  try{localStorage.removeItem(SAVE);}catch(e){}location.reload();};

/* ---------- start ---------- */
async function start(){
  $('title').hidden=true;$('hud').hidden=false;st.mode='roam';sfx('pop');
  if(st.seen.intro)return;
  busy=true;
  try{
    await say('AHOJ, VENDULKO! NAŠLA JSI V LESE STARÝ DENÍK.');
    await say('DENÍK JE PRÁZDNÝ. ZAPIŠ DO NĚJ, CO V LESE OBJEVÍŠ.');
    await say('KLIKNI NEBO ŤUKNI NA ZEM A DOJDEŠ TAM. HLEDEJ SLOUPY SVĚTLA MEZI STROMY!');
    st.seen.intro=1;st.seen['s'+st.season]=1;save();updateHud();nudgeJournal();
    await say(SEASON_PAGES[st.season]);
  }catch(e){if(e!==CANCEL)console.error(e);}
  busy=false;
}
$('btnPlay').onclick=start;

/* ---------- frame loop ---------- */
let last=performance.now(),time=0,slow=0,shownTask=null;
function frame(now){
  requestAnimationFrame(frame);
  const raw=(now-last)/1000;last=now;const dt=Math.min(raw,0.05)*(window.__fast||1);time+=dt;
  stepTweens(dt);
  stepHero(dt,time);
  if(st.mode==='title'){cam.yaw=Math.sin(time*0.12)*0.5;}
  stepCamera(dt,false);
  updateWeather(dt,time,camera.position.x,camera.position.z);
  for(const k in markers){const m=markers[k];if(!m.visible)continue;m.userData.gem.position.y=(m.userData.done?2.2:3)+Math.sin(time*2+m.position.x)*0.25;m.userData.gem.rotation.y=time*1.5;m.userData.beam.rotation.y=time*0.3;}
  for(const f of floaters){f.o.position.y=f.y+Math.sin(time*2.2+f.ph)*0.035;f.o.rotation.z=Math.sin(time*1.4+f.ph)*0.08;}
  for(const o of spinners){o.rotation.y=time*1.6;}
  if(st.season===0&&!current)frog.position.y=0.1+Math.max(0,Math.sin(time*1.3))*0.05;
  if(quest){
    for(const b of berries){if(b.got)continue;b.fruit.position.y=Math.sin(time*3+b.x)*0.04;
      if(Math.hypot(b.x-hero.position.x,b.z-hero.position.z)<1.15){b.got=true;b.fruit.visible=false;quest.got++;sfx('ok');$('quest').textContent='BORŮVKY '+quest.got+' / '+quest.n;
        if(quest.got>=quest.n){release();break;}}}
  }
  // UI that depends on where she stands
  const t=st.mode==='roam'&&!busy?nearTask():null;
  if(t!==shownTask){shownTask=t;const b=$('btnExplore');b.hidden=!t;if(t)b.textContent=(st.done[t.id]?'ZNOVU: ':'PROZKOUMAT: ')+t.title;}
  const back=st.mode==='task'||st.mode==='quest';if($('btnBack').hidden===back)$('btnBack').hidden=!back;
  renderer.render(scene,camera);
  // keep it smooth: if frames run long, paint at a lower resolution
  if(raw>1/26)slow+=raw;else slow=Math.max(0,slow-raw*0.5);
  if(slow>2.5&&pixelRatio>1){pixelRatio=Math.max(1,pixelRatio-0.25);renderer.setPixelRatio(pixelRatio);resize();slow=0;}
}

paintSeason(st.season,st.season,1);
refreshProps();refreshMarkers();updateHud();
stepCamera(0,true);
requestAnimationFrame(frame);
$('btnPlay').disabled=false;$('btnPlay').textContent='HRÁT';
window.__les={st,TASKS,hero,cam,runTask,changeSeason,get correct(){return correctNow;},get busy(){return busy;}};
