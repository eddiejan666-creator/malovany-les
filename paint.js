'use strict';
/* Shared helpers and hand-painted textures. Everything here is drawn in code. */

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let _rng=mulberry32(74110);
const rnd=()=>_rng();
const rr=(a,b)=>a+_rng()*(b-a);
const pick=a=>a[(_rng()*a.length)|0];
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2;
function mkCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}

function hash2(ix,iy){let h=Math.imul(ix,374761393)+Math.imul(iy,668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
function vnoise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  return lerp(lerp(hash2(ix,iy),hash2(ix+1,iy),sx),lerp(hash2(ix,iy+1),hash2(ix+1,iy+1),sx),sy);}
function fbm(x,y){return vnoise(x,y)*0.55+vnoise(x*2.1+7.3,y*2.1+3.1)*0.3+vnoise(x*4.3+1.7,y*4.3+9.2)*0.15;}

/* One loaded-brush stroke on a 2D canvas: a bundle of bristle lines with ragged ends. */
function brush(g,x,y,len,wid,ang,colFn,n,seed){
  const r=mulberry32(seed);
  g.save();g.translate(x,y);g.rotate(ang);g.lineCap='butt';
  const bw=wid/n;
  for(let i=0;i<n;i++){
    const yy=(i+0.5)*bw-wid/2;
    const a=-len/2+len*0.16*r(),b=len/2-len*0.2*r();
    g.strokeStyle=colFn(r,i,n);g.lineWidth=bw*1.35;
    g.beginPath();g.moveTo(a,yy);g.quadraticCurveTo(0,yy+(r()-0.5)*wid*0.18,b,yy+(r()-0.5)*wid*0.1);g.stroke();
  }
  g.restore();
}

/* Sprite for one dab of paint (grey multiplier + alpha). kind: 'dab' flat brush, 'leaf' pointed, 'blade' tapering. */
function dabTexture(kind,seed){
  const w=384,h=kind==='blade'?96:168,c=mkCanvas(w,h),g=c.getContext('2d'),r=mulberry32(seed);
  g.fillStyle='#fff';
  if(kind==='leaf'){g.beginPath();g.moveTo(w*0.02,h*0.5);g.quadraticCurveTo(w*0.3,-h*0.04,w*0.98,h*0.47);g.quadraticCurveTo(w*0.36,h*1.05,w*0.02,h*0.5);g.fill();}
  else if(kind==='blade'){g.beginPath();g.moveTo(w*0.02,h*0.16);g.quadraticCurveTo(w*0.5,h*0.24,w*0.99,h*0.5);g.quadraticCurveTo(w*0.5,h*0.76,w*0.02,h*0.84);g.closePath();g.fill();}
  else{ // flat brush: fine bristles whose ends lift off the canvas together
    const n=44,bh=h*0.86/n,top=h*0.07,o0=r()*50,o1=r()*50;
    for(let i=0;i<n;i++){
      const x0=w*(0.02+0.13*vnoise(i*0.17+o0,seed*0.37)+0.018*r()),x1=w*(0.98-0.17*vnoise(i*0.17+o1,seed*0.71)-0.028*r());
      g.fillRect(x0,top+i*bh,x1-x0,bh+0.7);
    }
  }
  // thickness of the paint: a lit ridge above, shade below, streaks of the bristles
  g.globalCompositeOperation='source-atop';
  const gr=g.createLinearGradient(0,0,0,h);
  gr.addColorStop(0,'#ffffff');gr.addColorStop(0.17,'#ffffff');gr.addColorStop(0.25,'#d8d8d8');gr.addColorStop(0.78,'#cdcdcd');gr.addColorStop(0.9,'#9c9c9c');gr.addColorStop(1,'#8a8a8a');
  g.fillStyle=gr;g.fillRect(0,0,w,h);
  for(let i=0;i<26;i++){const y=h*(0.2+0.62*r()),v=r()<0.5?160:255;g.strokeStyle=`rgba(${v},${v},${v},0.3)`;g.lineWidth=1+r()*3.5;
    g.beginPath();g.moveTo(w*r()*0.45,y);g.lineTo(w*(0.5+0.5*r()),y+(r()-0.5)*5);g.stroke();}
  if(kind==='leaf'){g.strokeStyle='rgba(255,255,255,0.9)';g.lineWidth=5;g.beginPath();g.moveTo(w*0.04,h*0.5);g.quadraticCurveTo(w*0.5,h*0.44,w*0.95,h*0.48);g.stroke();}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
}

/* Tileable ground: R = palette index, G = paint thickness, B = edge jitter for the light/shade mask. */
function groundTile(size){
  const c=mkCanvas(size,size),g=c.getContext('2d');
  g.fillStyle='rgb(112,150,128)';g.fillRect(0,0,size,size);
  for(let k=0;k<3200;k++){
    const x=rnd()*size,y=rnd()*size,len=size*rr(0.04,0.095),wid=len*rr(0.26,0.5),ang=rr(-1,1)*Math.PI;
    const R8=Math.round((((rnd()*8)|0)+0.5)/8*255),B=(rnd()*255)|0,seed=(rnd()*1e9)|0,g0=95+(rnd()*80|0);
    const col=(r,i,n)=>`rgb(${R8},${i<2?235:(i>=n-2?60:g0+(r()*60|0))},${B})`;
    for(let dx=-size;dx<=size;dx+=size)for(let dy=-size;dy<=size;dy+=size){
      const X=x+dx,Y=y+dy;if(X<-len||X>size+len||Y<-len||Y>size+len)continue;
      brush(g,X,Y,len,wid,ang,col,8,seed);
    }
  }
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.NoColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;return tex;
}

/* Bark, tileable around the trunk. The lit flank sits at u = litU. */
function trunkTexture(w,h,litU){
  const c=mkCanvas(w,h),g=c.getContext('2d');
  g.fillStyle='#392c3c';g.fillRect(0,0,w,h);
  const base=['#3a2f3d','#463646','#52403f','#2f2836','#5a4a4a','#4b4a3c','#40324a'];
  const warm=['#8a5a45','#a06a4a','#7a4a40','#93664f'];
  const lit=['#e9b56a','#f0c987','#d99a55','#f6dca0','#e7a968'];
  const cool=['#4a5a7a','#5a6a8a','#3f4a6a','#6c7c98'];
  for(let k=0;k<900;k++){
    const x=rnd()*w,y=rnd()*h,len=h*rr(0.05,0.2),wid=w*rr(0.02,0.055);
    let d=Math.abs(x/w-litU);d=Math.min(d,1-d);
    let pal=base;const q=rnd();
    if(d<0.09&&q<0.6)pal=lit;else if(d<0.2&&q<0.55)pal=warm;else if(d>0.36&&q<0.3)pal=cool;
    const col=pick(pal),seed=(rnd()*1e9)|0;
    for(let dx=-w;dx<=w;dx+=w)for(let dy=-h;dy<=h;dy+=h){
      const X=x+dx,Y=y+dy;if(X<-wid*2||X>w+wid*2||Y<-len||Y>h+len)continue;
      brush(g,X,Y,len,wid,Math.PI/2+rr(-0.05,0.05),()=>col,4,seed);
    }
  }
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=8;return tex;
}

/* Neutral brushwork to multiply over solid-coloured figures. */
function figureTexture(){
  const s=256,c=mkCanvas(s,s),g=c.getContext('2d');g.fillStyle='#e2e2e2';g.fillRect(0,0,s,s);
  for(let k=0;k<420;k++){const v=(195+rnd()*60)|0;const col=`rgb(${v},${v},${v})`;
    brush(g,rnd()*s,rnd()*s,rr(22,56),rr(8,18),rr(-0.5,0.5)+Math.PI/2,()=>col,4,(rnd()*1e9)|0);}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;return tex;
}

/* Round painted disc with a ragged edge (pond water, ice). */
function discTexture(size,cols,hi){
  const c=mkCanvas(size,size),g=c.getContext('2d');g.fillStyle=cols[0];g.fillRect(0,0,size,size);
  for(let k=0;k<1500;k++){
    const col=rnd()<0.12?pick(hi):pick(cols),len=size*rr(0.04,0.13);
    brush(g,rnd()*size,rnd()*size,len,len*rr(0.14,0.26),rr(-0.12,0.12),()=>col,5,(rnd()*1e9)|0);
  }
  g.globalCompositeOperation='destination-in';g.beginPath();
  for(let i=0;i<=90;i++){const a=i/90*TAU,rad=size*0.5*(0.9+0.08*vnoise(Math.cos(a)*3+5,Math.sin(a)*3+5));
    const x=size/2+Math.cos(a)*rad,y=size/2+Math.sin(a)*rad;i?g.lineTo(x,y):g.moveTo(x,y);}
  g.closePath();g.fill();
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;return tex;
}

function glowTexture(vertical){
  const c=mkCanvas(64,256),g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,vertical?0:64,vertical?256:0);
  if(vertical){gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(0.75,'rgba(255,255,255,0.55)');gr.addColorStop(1,'rgba(255,255,255,0.9)');}
  else{gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(0.5,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');}
  g.fillStyle=gr;g.fillRect(0,0,64,256);
  if(!vertical){g.globalCompositeOperation='destination-in';const g2=g.createLinearGradient(0,0,0,256);
    g2.addColorStop(0,'rgba(0,0,0,0.9)');g2.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=g2;g.fillRect(0,0,64,256);}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}

function blobTexture(){
  const c=mkCanvas(64,64),g=c.getContext('2d'),gr=g.createRadialGradient(32,32,2,32,32,31);
  gr.addColorStop(0,'rgba(20,10,40,0.55)');gr.addColorStop(1,'rgba(20,10,40,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
}

function labelTexture(txt,bg,fg){
  const c=mkCanvas(128,128),g=c.getContext('2d');
  g.fillStyle=bg;g.beginPath();g.arc(64,64,58,0,TAU);g.fill();g.lineWidth=8;g.strokeStyle=fg;g.stroke();
  g.fillStyle=fg;g.font='800 84px "Baloo 2","Trebuchet MS",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,64,70);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
