'use strict';
/* The painted forest: ground, trees, seasons, weather, figures. Season index: 0 JARO, 1 LÉTO, 2 PODZIM, 3 ZIMA. */

const TOUCH=matchMedia('(pointer: coarse)').matches;
const Q=TOUCH?0.62:1;
const WORLD=170,HALF=WORLD/2,PLAY_R=45;
const SUN=new THREE.Vector2(0.75,0.66).normalize();   // direction shadows fall across the ground (x,z)
const PLACES={pond:{x:-15,z:-17,r:5.3},log:{x:17,z:-14},animals:{x:15,z:16},garden:{x:-16,z:13}};

const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true,powerPreference:'high-performance'});
let pixelRatio=Math.min(window.devicePixelRatio||1,TOUCH?1.75:2);
renderer.setPixelRatio(pixelRatio);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(50,1,0.1,400);
scene.fog=new THREE.Fog(0xecd0aa,13,76);
scene.add(new THREE.HemisphereLight(0xfff6e4,0x8a7fa8,2.1));
const sunLight=new THREE.DirectionalLight(0xfff0d0,2.3);sunLight.position.set(-SUN.x*10,12,-SUN.y*10);scene.add(sunLight);

const ENV=[
  {fog:'#dfe9c8',top:'#b9dcf0',near:16,far:86,ray:0.16},
  {fog:'#dde6b2',top:'#a4d2ee',near:16,far:88,ray:0.18},
  {fog:'#efd3aa',top:'#f6e6c4',near:12,far:74,ray:0.3},
  {fog:'#e3e9f1',top:'#c6d6ea',near:11,far:68,ray:0.1},
];
const GROUND_PAL=[
  ['#2f5a3a','#356644','#2a5248','#3f7048','#28485a','#34604a','#3a6a3a','#2c4f5f'],
  ['#8fc24a','#a6d15a','#bfe070','#d7ea86','#e9f0a0','#b0d862','#9acb52','#f1e9a6'],
  ['#1f4a30','#245438','#1c4038','#2a5e3a','#1e3a4a','#234f34','#2e6238','#1a3a44'],
  ['#5f9e34','#74ad3a','#8cbd45','#a5c94f','#c2d65c','#7fb43c','#689f30','#d6d96a'],
  ['#4a2030','#5c2434','#70303a','#82402f','#5a2f4a','#3f2a4a','#6a3a2a','#8a4a2a'],
  ['#b9541f','#d2691e','#e08a1e','#eda52a','#f4c13d','#f7d560','#e9b23a','#c97a22'],
  ['#8fa6cc','#9db3d6','#a9bcdc','#8a9cc8','#b4c4e2','#7f96c2','#a0b0d8','#93a8d0'],
  ['#e8eef6','#f4f7fb','#ffffff','#fbf3ea','#f0e9f2','#e3ecf7','#f7fafd','#eef2f8'],
];
const P={
  springLeaf:['#b9d86a','#cfe58a','#a3cc5a','#e6f0a0','#8fbf4f'],
  blossom:['#f7c6d9','#ffe3ee','#f4a6c0','#ffffff'],
  summerLeaf:['#4f8f3a','#3f7a34','#6aa544','#2f6a3a','#86b84c','#a6c85a'],
  autumnLeaf:['#e8a23a','#f2c14e','#d9772b','#c8552b','#e9d36a','#b8a13c','#8a8f3a','#e58a7a','#a63c2a','#f0b030','#f6d24a'],
  snow:['#f4f6fa','#e3eaf4','#d2deee','#ffffff'],
  dead:['#8a6a4a','#7a5a40'],
  spruce:['#2f5a3c','#24503a','#3a6a44','#1f4638','#2a4f55'],
  branch:['#3a2f3a','#4a3a3a','#2d2a38','#54433f'],
  grass:[['#9fd05a','#c4e36f','#7fbf4a','#b6dc60'],['#5fa03c','#3f8a35','#86c04a','#2f7038'],['#e9c75a','#d9a441','#7f9a4a','#5f7f3f','#f0dc8a'],['#d8c9a0','#b9b08a','#eef2f6']],
  flower:['#ffffff','#fff2a8','#c9a6f0','#ffd0e0','#ffe36a'],
  bark:['#3a2f3d','#463646','#52403f','#2f2836','#5a4a4a'],barkLit:['#e9b56a','#f0c987','#d99a55'],barkCool:['#4a5a7a','#5a6a8a'],
};
const SHADE=[[0.42,0.6,0.62],[0.36,0.55,0.5],[0.52,0.36,0.5],[0.6,0.7,0.92]];
const _cc={};function C(hex){return _cc[hex]||(_cc[hex]=new THREE.Color(hex));}
function tint(hex,lit,s){const c=C(hex),j=rr(0.88,1.1),m=lit?[1.12,1.12,1.12]:SHADE[s];return[c.r*m[0]*j,c.g*m[1]*j,c.b*m[2]*j];}

const _m=new THREE.Matrix4(),_p=new THREE.Vector3(),_q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_s=new THREE.Vector3(),_e=new THREE.Euler(),_v=new THREE.Vector3();
const UP=new THREE.Vector3(0,1,0);

/* ---------- dab layers: thousands of brush strokes whose colour and size change with the season ---------- */
function dabMaterial(tex){
  const m=new THREE.MeshBasicMaterial({map:tex,alphaTest:0.5,side:THREE.DoubleSide});
  m.alphaToCoverage=true;
  m.onBeforeCompile=sh=>{
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aS;')
      .replace('#include <begin_vertex>','vec3 transformed = vec3( position ) * aS;');
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <alphatest_fragment>','diffuseColor.a = smoothstep(0.5, 0.5 + max(fwidth(diffuseColor.a), 0.0001), diffuseColor.a);\n#ifdef USE_FOG\ndiffuseColor.a *= smoothstep(1.0, 2.6, vFogDepth);\n#endif\nif (diffuseColor.a <= 0.0) discard;')
      .replace('#include <opaque_fragment>','gl_FragColor = vec4( outgoingLight, diffuseColor.a );');
  };
  return m;
}
function bladeGeo(){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([-0.5,0,0,0.5,0,0,0.5,1,0,-0.5,1,0],3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,0,1,1,1,1,0],2));
  g.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1],3));
  g.setIndex([0,1,2,0,2,3]);return g;
}
const layers=[];
class DabLayer{
  constructor(tex,geo,max){
    this.max=max;this.n=0;this.geo=geo;
    this.aS=new THREE.InstancedBufferAttribute(new Float32Array(max),1);this.aS.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aS',this.aS);
    this.mesh=new THREE.InstancedMesh(geo,dabMaterial(tex),max);
    this.mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(max*3),3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled=false;
    this.cols=[0,1,2,3].map(()=>new Float32Array(max*3));
    this.scl=[0,1,2,3].map(()=>new Float32Array(max));
    this.dly=new Float32Array(max);
    scene.add(this.mesh);layers.push(this);
  }
  add(x,y,z,q,sx,sy,cols,scl){
    if(this.n>=this.max)return;
    const i=this.n++;_p.set(x,y,z);_s.set(sx,sy,1);_m.compose(_p,q,_s);this.mesh.setMatrixAt(i,_m);
    for(let s=0;s<4;s++){this.cols[s].set(cols[s],i*3);this.scl[s][i]=scl[s];}
    this.dly[i]=rnd();
  }
  finish(){this.mesh.count=this.n;this.mesh.instanceMatrix.needsUpdate=true;}
  apply(a,b,t){
    const ca=this.cols[a],cb=this.cols[b],sa=this.scl[a],sb=this.scl[b],col=this.mesh.instanceColor.array,s=this.aS.array,d=this.dly,n=this.n;
    for(let i=0;i<n;i++){
      let k=clamp(t*1.7-d[i]*0.7,0,1);k=k*k*(3-2*k);
      const j=i*3;col[j]=ca[j]+(cb[j]-ca[j])*k;col[j+1]=ca[j+1]+(cb[j+1]-ca[j+1])*k;col[j+2]=ca[j+2]+(cb[j+2]-ca[j+2])*k;
      s[i]=sa[i]+(sb[i]-sa[i])*k;
    }
    this.mesh.instanceColor.needsUpdate=true;this.aS.needsUpdate=true;
  }
}

/* ---------- where the trees stand ---------- */
const placeList=Object.values(PLACES);
function segDist(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz;let t=((px-ax)*dx+(pz-az)*dz)/l;t=clamp(t,0,1);return Math.hypot(px-ax-dx*t,pz-az-dz*t);}
function inClearing(x,z,pad){
  if(Math.hypot(x,z)<5.5+pad)return true;
  for(const p of placeList){
    if(Math.hypot(x-p.x,z-p.z)<(p.r?p.r+3.4:6.4)+pad)return true;
    if(Math.hypot(x-p.x,z-(p.z+7.5))<4+pad)return true;                // room for the camera south of each place
    if(segDist(x,z,0,0,p.x,p.z)<2.1+pad)return true;                  // the worn way from the middle
  }
  return false;
}
const trees=[],treeGrid=new Map(),CELL=6;
function gridKey(x,z){return Math.floor(x/CELL)+','+Math.floor(z/CELL);}
function nearTrees(x,z){const out=[],ix=Math.floor(x/CELL),iz=Math.floor(z/CELL);
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=treeGrid.get((ix+a)+','+(iz+b));if(l)for(const t of l)out.push(t);}return out;}
(function plant(){
  const maxTrees=Math.round(340*(TOUCH?0.75:1));
  for(let tries=0;tries<12000&&trees.length<maxTrees;tries++){
    const a=rnd()*TAU,d=Math.sqrt(rnd())*66,x=Math.cos(a)*d,z=Math.sin(a)*d;
    if(inClearing(x,z,0))continue;
    let ok=true;for(const t of nearTrees(x,z))if(Math.hypot(t.x-x,t.z-z)<4.3){ok=false;break;}
    if(!ok)continue;
    const spruce=rnd()<0.17&&!inClearing(x,z,3.4);
    const t={x,z,spruce,r:spruce?rr(0.2,0.28):rr(0.2,0.5),h:spruce?rr(13,18):rr(15,20)};
    trees.push(t);const k=gridKey(x,z);if(!treeGrid.has(k))treeGrid.set(k,[]);treeGrid.get(k).push(t);
  }
})();
/* Keeps a walker out of trunks (and out of the pond unless it is frozen). Returns [x,z]. */
function collide(x,z,rad,pondOpen){
  for(const t of nearTrees(x,z)){const dx=x-t.x,dz=z-t.z,d=Math.hypot(dx,dz),m=t.r+rad;
    if(d<m){const k=d>0.001?m/d:1;x=t.x+(d>0.001?dx*k:m);z=t.z+dz*k;}}
  if(!pondOpen){const p=PLACES.pond,dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),m=p.r-0.15+rad;if(d<m&&d>0.001){x=p.x+dx/d*m;z=p.z+dz/d*m;}}
  const d=Math.hypot(x,z);if(d>PLAY_R){x*=PLAY_R/d;z*=PLAY_R/d;}
  return[x,z];
}

/* ---------- ground: painted tile recoloured by season, light and shade from a painted mask ---------- */
const MS=1024,MPP=MS/WORLD;
const maskCanvas=mkCanvas(MS,MS);
(function paintMask(){
  const g=maskCanvas.getContext('2d');g.fillStyle='rgb(64,64,64)';g.fillRect(0,0,MS,MS);
  const sunAng=Math.atan2(SUN.y,SUN.x),W=v=>(v+HALF)*MPP;
  for(let k=0;k<6000;k++){const x=rr(-HALF,HALF),z=rr(-HALF,HALF);
    if(fbm(x*0.05+3.1,z*0.05+8.2)<0.5)continue;
    const len=rr(3,7)*MPP;brush(g,W(x),W(z),len,rr(0.9,1.8)*MPP,sunAng+rr(-0.3,0.3),()=>'rgba(255,255,255,0.5)',5,(rnd()*1e9)|0);}
  for(const t of trees){const len=rr(9,15);
    brush(g,W(t.x+SUN.x*len/2),W(t.z+SUN.y*len/2),len*MPP,(t.r*2+0.7)*MPP*1.3,sunAng,()=>'rgba(40,40,40,0.82)',4,(rnd()*1e9)|0);
    for(let i=0;i<4;i++){const d=rr(12,22),l=rr(2.5,5);
      brush(g,W(t.x+SUN.x*d+rr(-2.5,2.5)),W(t.z+SUN.y*d+rr(-2.5,2.5)),l*MPP,rr(1.4,2.6)*MPP,sunAng+rr(-0.6,0.6),()=>'rgba(40,40,40,0.5)',4,(rnd()*1e9)|0);}}
  for(const p of placeList){const L=Math.hypot(p.x,p.z),ang=Math.atan2(p.z,p.x);
    for(let d=2;d<L;d+=0.7){const x=p.x*d/L+rr(-0.6,0.6),z=p.z*d/L+rr(-0.6,0.6);
      brush(g,W(x),W(z),rr(1.6,3)*MPP,rr(0.8,1.3)*MPP,ang+rr(-0.5,0.5),()=>'rgba(255,255,255,0.42)',4,(rnd()*1e9)|0);}
    const R=(p.r||3)+3.2;for(let k=0;k<70;k++){const a=rnd()*TAU,d=Math.sqrt(rnd())*R;
      brush(g,W(p.x+Math.cos(a)*d),W(p.z+Math.sin(a)*d),rr(1.5,3.2)*MPP,rr(0.8,1.4)*MPP,rnd()*TAU,()=>'rgba(255,255,255,0.5)',4,(rnd()*1e9)|0);}}
  for(let k=0;k<40;k++){const a=rnd()*TAU,d=Math.sqrt(rnd())*4.5;brush(g,W(Math.cos(a)*d),W(Math.sin(a)*d),rr(1.5,3)*MPP,rr(0.8,1.4)*MPP,rnd()*TAU,()=>'rgba(255,255,255,0.5)',4,(rnd()*1e9)|0);}
})();
const maskData=maskCanvas.getContext('2d').getImageData(0,0,MS,MS).data;
function litAt(x,z){const px=clamp(((x+HALF)*MPP)|0,0,MS-1),py=clamp(((z+HALF)*MPP)|0,0,MS-1);return maskData[(py*MS+px)*4]>128;}

const maskTex=new THREE.CanvasTexture(maskCanvas);maskTex.colorSpace=THREE.NoColorSpace;
const tileTex=groundTile(TOUCH?1024:2048);tileTex.anisotropy=renderer.capabilities.getMaxAnisotropy();
const palData=new Uint8Array(8*8*4);
GROUND_PAL.forEach((row,ri)=>row.forEach((hex,ci)=>{const n=parseInt(hex.slice(1),16),o=(ri*8+ci)*4;palData[o]=n>>16;palData[o+1]=(n>>8)&255;palData[o+2]=n&255;palData[o+3]=255;}));
const palTex=new THREE.DataTexture(palData,8,8,THREE.RGBAFormat);palTex.colorSpace=THREE.SRGBColorSpace;palTex.magFilter=palTex.minFilter=THREE.LinearFilter;palTex.needsUpdate=true;
const groundU={uTile:{value:tileTex},uMask:{value:maskTex},uPal:{value:palTex},uRows:{value:new THREE.Vector4()},uT:{value:1},uWorld:{value:WORLD}};
const groundMat=new THREE.MeshBasicMaterial({color:0xffffff});
groundMat.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,groundU);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvW = position.xz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vW;\nuniform sampler2D uTile;\nuniform sampler2D uMask;\nuniform sampler2D uPal;\nuniform vec4 uRows;\nuniform float uT;\nuniform float uWorld;')
  .replace('#include <map_fragment>',`
    vec2 tuv = vW / 7.0;
    vec2 muv = vec2(vW.x / uWorld + 0.5, 0.5 - vW.y / uWorld);
    vec4 st = texture2D(uTile, tuv);
    vec4 st2 = texture2D(uTile, tuv * 0.137 + vec2(0.31, 0.57));
    float idx = clamp(mix(st.r, st2.r, 0.28), 0.07, 0.93);
    float m = texture2D(uMask, muv).r + (st.b - 0.5) * 0.55 + (st2.b - 0.5) * 0.2;
    float lit = smoothstep(0.42, 0.56, m);
    vec3 cA = mix(texture2D(uPal, vec2(idx, uRows.x)).rgb, texture2D(uPal, vec2(idx, uRows.y)).rgb, lit);
    vec3 cB = mix(texture2D(uPal, vec2(idx, uRows.z)).rgb, texture2D(uPal, vec2(idx, uRows.w)).rgb, lit);
    diffuseColor.rgb *= mix(cA, cB, uT) * (0.78 + 0.44 * st.g);`);
};
/* The plane reaches past the painted world so the horizon never shows an edge; the mask clamps at its border. */
const ground=new THREE.Mesh(new THREE.PlaneGeometry(WORLD*1.8,WORLD*1.8).rotateX(-Math.PI/2),groundMat);
scene.add(ground);

/* ---------- trunks ---------- */
const litU=(Math.atan2(-SUN.x,-SUN.y)/TAU+1)%1;
const trunkTex=trunkTexture(TOUCH?512:1024,TOUCH?1024:2048,litU);trunkTex.repeat.set(1,2.2);
const trunkMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1.14,1,14,1,true).translate(0,0.5,0),new THREE.MeshBasicMaterial({map:trunkTex}),trees.length);
trees.forEach((t,i)=>{_p.set(t.x,-0.1,t.z);_q.identity();_s.set(t.r,t.h,t.r);_m.compose(_p,_q,_s);trunkMesh.setMatrixAt(i,_m);
  const j=rr(0.85,1.12);trunkMesh.setColorAt(i,t.spruce?new THREE.Color(0.78*j,0.62*j,0.58*j):new THREE.Color(j,j*rr(0.94,1.04),j*rr(0.92,1.1)));});
trunkMesh.frustumCulled=false;scene.add(trunkMesh);

/* ---------- foliage, bark, grass ---------- */
const dabA=dabTexture('dab',11),dabB=dabTexture('dab',29),leafTex=dabTexture('leaf',5),bladeTex=dabTexture('blade',3);
const nDec=trees.filter(t=>!t.spruce).length,nSpr=trees.length-nDec;
const canopyA=new DabLayer(dabA,new THREE.PlaneGeometry(1,1),Math.ceil(nDec*(56*Q+26))+nSpr*150+2000);
const canopyB=new DabLayer(dabB,new THREE.PlaneGeometry(1,1),Math.ceil(nDec*56*Q)+nSpr*150+2000);
const bushLayer=new DabLayer(leafTex,new THREE.PlaneGeometry(1,1),Math.ceil(3400*Q));
const bladeLayer=new DabLayer(bladeTex,bladeGeo(),Math.ceil(11500*Q)+nDec*16+1200);
const barkLayer=new DabLayer(dabA,bladeGeo(),trees.length*9+200);
const floorLayer=new DabLayer(dabB,new THREE.PlaneGeometry(1,1),Math.ceil(9500*Q));

function decidLeaf(lit){
  const cols=[],scl=[],blossom=rnd()<0.14,snow=rnd()<0.14;
  cols[0]=tint(blossom?pick(P.blossom):pick(P.springLeaf),lit||blossom,0);scl[0]=blossom?rr(0.4,0.55):rr(0.5,0.78);
  cols[1]=tint(pick(P.summerLeaf),lit,1);scl[1]=rr(0.95,1.15);
  cols[2]=tint(pick(P.autumnLeaf),lit,2);scl[2]=rnd()<0.12?0:rr(0.85,1.08);
  cols[3]=tint(snow?pick(P.snow):pick(P.dead),lit||snow,3);scl[3]=snow?rr(0.55,0.9):(rnd()<0.05?0.5:0);
  return[cols,scl];
}
function spruceDab(lit,top){
  const cols=[],scl=[1,1,1,1],h=pick(P.spruce);
  for(let s=0;s<4;s++)cols[s]=tint(h,lit,s);
  if(top&&rnd()<0.62)cols[3]=tint(pick(P.snow),true,3);
  return[cols,scl];
}
function same(col,sc){return[[col,col,col,col],[sc,sc,sc,sc]];}
function addBlade(layer,bx,by,bz,dir,len,wid,cols,scl,cross){
  _q.setFromUnitVectors(UP,dir);_q2.setFromAxisAngle(UP,rnd()*TAU);_q.multiply(_q2);
  layer.add(bx,by,bz,_q,wid,len,cols,scl);
  if(cross){_q2.setFromAxisAngle(UP,Math.PI/2);_q.multiply(_q2);layer.add(bx,by,bz,_q,wid,len,cols,scl);}
}
for(const t of trees){
  // bark dabs standing a little proud of the trunk, so its outline is ragged paint
  for(let i=0;i<8;i++){
    const th=rnd()*TAU,nx=Math.sin(th),nz=Math.cos(th),facing=-(nx*SUN.x+nz*SUN.y);
    const hex=facing>0.55&&rnd()<0.7?pick(P.barkLit):(facing<-0.5&&rnd()<0.4?pick(P.barkCool):pick(P.bark));
    const c=tint(hex,true,2),w=tint(facing>0.2&&rnd()<0.45?pick(P.snow):hex,true,3);
    _q.setFromAxisAngle(UP,th);
    barkLayer.add(t.x+nx*(t.r*1.06+0.01),rr(0,t.spruce?5:9),t.z+nz*(t.r*1.06+0.01),_q,t.r*rr(0.5,1.0),rr(1.2,3.8),[c,c,c,w],[1,1,1,1]);
  }
  if(t.spruce){
    for(let y=1.8;y<t.h+1;y+=0.62){
      const R=(1-y/(t.h+1.6))*3.6+0.3,n=Math.max(4,Math.round(R*5.2*(TOUCH?0.7:1)));
      for(let i=0;i<n;i++){
        const a=rnd()*TAU,d=R*rr(0.3,1),lit=-(Math.cos(a)*SUN.x+Math.sin(a)*SUN.y)>-0.3&&rnd()<0.65;
        _e.set(rr(-0.75,0.75),-a+rr(-0.35,0.35),-rr(0.35,0.8),'YXZ');_q.setFromEuler(_e);
        const[cols,scl]=spruceDab(lit,true);
        (i&1?canopyA:canopyB).add(t.x+Math.cos(a)*d,y+rr(-0.25,0.25)-d*0.3,t.z+Math.sin(a)*d,_q,rr(1.2,2.1),rr(0.55,0.95),cols,scl);
      }
    }
    continue;
  }
  const n=Math.round(rr(84,104)*Q),nC=7;
  for(let c=0;c<nC;c++){
    const a=rnd()*TAU,rad=rr(0.4,4.2),cy=rr(6.2,t.h+1),cx=t.x+Math.cos(a)*rad,cz=t.z+Math.sin(a)*rad;
    const y0=cy-rr(1.5,3.5);_v.set(cx-t.x,cy-y0,cz-t.z);const bl=_v.length();_v.normalize();
    addBlade(bladeLayer,t.x,y0,t.z,_v,bl+0.6,rr(0.14,0.24),...same(tint(pick(P.branch),false,2),1),true);
    for(let i=0;i<n/nC;i++){
      const py=cy+rr(-1.2,1.2),lit=rnd()<(py>11?0.72:0.48);
      _e.set(rr(-1.1,1.1),rnd()*TAU,rr(-0.5,0.5),'YXZ');_q.setFromEuler(_e);
      const[cols,scl]=decidLeaf(lit);
      (i&1?canopyA:canopyB).add(cx+rr(-2,2),py,cz+rr(-2,2),_q,rr(1.0,1.9),rr(0.48,0.82),cols,scl);
    }
  }
  for(let lb=0;lb<2;lb++)if(rnd()<0.5){ // low boughs hanging into view
    const a=rnd()*TAU,rad=rr(1.6,3.4),cy=rr(3.2,6.5),cx=t.x+Math.cos(a)*rad,cz=t.z+Math.sin(a)*rad;
    if(inClearing(cx,cz,1.6))continue;
    _v.set(cx-t.x,1.2,cz-t.z);const bl=_v.length();_v.normalize();
    addBlade(bladeLayer,t.x,cy-1.2,t.z,_v,bl+0.4,0.1,...same(tint(pick(P.branch),false,2),1),true);
    for(let i=0;i<12;i++){_e.set(rr(-1.1,1.1),rnd()*TAU,rr(-0.5,0.5),'YXZ');_q.setFromEuler(_e);const[cols,scl]=decidLeaf(rnd()<0.6);
      canopyA.add(cx+rr(-1.2,1.2),cy+rr(-0.7,0.7),cz+rr(-1.2,1.2),_q,rr(0.7,1.3),rr(0.36,0.6),cols,scl);}
  }
}
function scatter(R,fn,count,pow){for(let i=0;i<count;i++){const a=rnd()*TAU,d=Math.pow(rnd(),pow)*R,x=Math.cos(a)*d,z=Math.sin(a)*d;
  const p=PLACES.pond;if(Math.hypot(x-p.x,z-p.z)<p.r+0.2)continue;fn(x,z);}}
// leaves lying on the ground in autumn, flowers in spring, a few in summer, none under snow
scatter(60,(x,z)=>{
  const lit=litAt(x,z),fl=rnd()<0.42,su=rnd()<0.3;
  _e.set(-Math.PI/2+rr(-0.28,0.28),rnd()*TAU,0,'YXZ');_q.setFromEuler(_e);
  const cols=[tint(pick(P.flower),lit,0),tint(pick(P.summerLeaf),lit,1),tint(pick(P.autumnLeaf),lit,2),tint(pick(P.snow),lit,3)];
  floorLayer.add(x,0.05+rnd()*0.07,z,_q,rr(0.4,0.8),rr(0.2,0.36),cols,[fl?rr(0.45,0.7):0,su?0.6:0,1,rnd()<0.25?0.8:0]);
},Math.ceil(9500*Q),0.62);
// grass
scatter(60,(x,z)=>{
  const lit=litAt(x,z),n=1+((rnd()*3)|0);
  for(let i=0;i<n;i++){
    _v.set(rr(-0.4,0.4),1,rr(-0.4,0.4)).normalize();
    const cols=[0,1,2,3].map(s=>tint(pick(P.grass[s]),lit,s)),k=rr(0.7,1.3);
    addBlade(bladeLayer,x+rr(-0.12,0.12),0,z+rr(-0.12,0.12),_v,rr(0.3,0.75),rr(0.07,0.13),cols,[0.85*k,k,0.8*k,0.4*k],false);
  }
},Math.ceil(5200*Q),0.6);
// reeds round the pond
for(let i=0;i<150;i++){const a=rnd()*TAU;if(Math.sin(a)>0.35&&rnd()<0.85)continue;const d=PLACES.pond.r+rr(-0.25,0.7),x=PLACES.pond.x+Math.cos(a)*d,z=PLACES.pond.z+Math.sin(a)*d;
  _v.set(rr(-0.2,0.2),1,rr(-0.2,0.2)).normalize();const cols=[0,1,2,3].map(s=>tint(pick(P.grass[s]),true,s));
  addBlade(bladeLayer,x,0,z,_v,rr(0.8,1.7),rr(0.08,0.14),cols,[0.7,1,0.95,0.6],true);}
// saplings with big leaves, the bright understorey
const bushes=[];
scatter(56,(x,z)=>{
  if(inClearing(x,z,1.6))return;
  const lit=litAt(x,z),h=rr(1.1,2.5);bushes.push({x,z});
  _v.set(rr(-0.15,0.15),1,rr(-0.15,0.15)).normalize();
  addBlade(bladeLayer,x,0,z,_v,h,0.06,...same(tint(pick(P.branch),lit,2),1),true);
  const n=Math.round(rr(12,22));
  for(let i=0;i<n;i++){
    _e.set(rr(-1.2,0.4),rnd()*TAU,rr(-0.6,0.6),'YXZ');_q.setFromEuler(_e);
    const cols=[],scl=[];
    cols[0]=tint(pick(P.springLeaf),lit,0);scl[0]=0.7;cols[1]=tint(pick(P.summerLeaf),lit,1);scl[1]=1;
    cols[2]=tint(rnd()<0.35?pick(P.springLeaf):pick(P.autumnLeaf),lit,2);scl[2]=0.95;cols[3]=tint(pick(P.snow),true,3);scl[3]=rnd()<0.12?0.55:0;
    bushLayer.add(x+rr(-0.6,0.6),rr(0.35,h),z+rr(-0.6,0.6),_q,rr(0.5,0.95),rr(0.24,0.42),cols,scl);
  }
},Math.ceil(150*Q),0.75);
layers.forEach(l=>l.finish());

/* ---------- sky, sun in the mist ---------- */
const skyGeo=new THREE.SphereGeometry(300,28,14);
skyGeo.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(skyGeo.attributes.position.count*3),3));
const sky=new THREE.Mesh(skyGeo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));
sky.renderOrder=-10;scene.add(sky);
const sunDir=new THREE.Vector3(-SUN.x,0.5,-SUN.y).normalize();
function paintSky(fog,top){
  const pos=skyGeo.attributes.position,col=skyGeo.attributes.color;
  for(let i=0;i<pos.count;i++){_v.fromBufferAttribute(pos,i).normalize();
    const t=clamp(_v.y*1.9,0,1),g=Math.pow(Math.max(_v.dot(sunDir),0),5)*0.6;
    col.setXYZ(i,lerp(lerp(fog.r,top.r,t),1,g),lerp(lerp(fog.g,top.g,t),1,g),lerp(lerp(fog.b,top.b,t),0.92,g));}
  col.needsUpdate=true;
}
const rayMat=new THREE.MeshBasicMaterial({map:glowTexture(false),transparent:true,opacity:0.1,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide,color:0xfff0c8});
(function rays(){
  const g=new THREE.PlaneGeometry(1,1),d=new THREE.Vector3(-SUN.x*0.75,1,-SUN.y*0.75).normalize(),n=TOUCH?10:18;
  for(let i=0;i<n;i++){const m=new THREE.Mesh(g,rayMat),a=rnd()*TAU,r=rr(8,46);
    m.position.set(Math.cos(a)*r,10,Math.sin(a)*r).addScaledVector(d,3);
    m.quaternion.setFromUnitVectors(UP,d);_q2.setFromAxisAngle(UP,rr(-0.5,0.5)+Math.atan2(SUN.x,SUN.y));m.quaternion.multiply(_q2);
    m.scale.set(rr(3,7),rr(26,34),1);m.renderOrder=5;scene.add(m);}
})();

/* ---------- figures: solid forms with brushwork, lit by the sun ---------- */
const figTex=figureTexture();
const _mats={};function fm(hex){return _mats[hex]||(_mats[hex]=new THREE.MeshLambertMaterial({color:hex,map:figTex}));}
const G_SPH=new THREE.SphereGeometry(1,20,14),G_CYL=new THREE.CylinderGeometry(1,1,1,14),G_CONE=new THREE.ConeGeometry(1,1,12),G_BOX=new THREE.BoxGeometry(1,1,1),
  G_ROCK=new THREE.IcosahedronGeometry(1,0);
function part(parent,geo,hex,x,y,z,sx,sy,sz){const m=new THREE.Mesh(geo,fm(hex));m.position.set(x,y,z);m.scale.set(sx,sy===undefined?sx:sy,sz===undefined?sx:sz);parent.add(m);return m;}
const blobTex=blobTexture(),blobGeo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
function blob(size){const m=new THREE.Mesh(blobGeo,new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false}));m.scale.setScalar(size);m.position.y=0.045;m.renderOrder=2;return m;}

const hero=new THREE.Group(),heroBody=new THREE.Group();hero.add(heroBody);scene.add(hero);
const heroParts=(function(){
  const b=heroBody,TEAL='#1f9aa8',SKIN='#f3c9a5',HAIR='#8a5a2b',CREAM='#f4ecd8';
  function leg(x){const p=new THREE.Group();p.position.set(x,0.46,0);b.add(p);part(p,G_CYL,'#39406a',0,-0.2,0,0.062,0.36,0.062);part(p,G_SPH,'#f2c230',0,-0.4,0.035,0.085,0.07,0.13);return p;}
  function arm(x){const p=new THREE.Group();p.position.set(x,0.9,0);b.add(p);part(p,G_CYL,TEAL,0,-0.17,0,0.055,0.34,0.055);part(p,G_SPH,SKIN,0,-0.36,0,0.055);p.rotation.z=x>0?0.2:-0.2;return p;}
  const legL=leg(-0.095),legR=leg(0.095);
  const jac=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.29,0.5,14),fm(TEAL));jac.position.y=0.7;b.add(jac);
  part(b,G_CYL,'#157886',0,0.47,0,0.295,0.05,0.295);
  const armL=arm(-0.22),armR=arm(0.22);
  const scarf=new THREE.Mesh(new THREE.TorusGeometry(0.14,0.05,8,18),fm(CREAM));scarf.rotation.x=Math.PI/2;scarf.position.y=0.95;b.add(scarf);
  part(b,G_SPH,SKIN,0,1.1,0,0.185);
  part(b,G_SPH,HAIR,0,1.11,-0.04,0.195,0.19,0.18);
  for(const x of[-0.17,0.17]){part(b,G_CYL,HAIR,x,0.93,-0.03,0.042,0.26,0.042);part(b,G_SPH,'#d8402f',x,0.79,-0.03,0.045);}
  const hat=new THREE.Mesh(new THREE.SphereGeometry(0.205,18,10,0,TAU,0,Math.PI*0.5),fm('#d8402f'));hat.position.y=1.14;b.add(hat);
  const brim=new THREE.Mesh(new THREE.TorusGeometry(0.2,0.04,8,20),fm(CREAM));brim.rotation.x=Math.PI/2;brim.position.y=1.145;b.add(brim);
  part(b,G_SPH,CREAM,0,1.385,0,0.07);
  part(b,G_SPH,'#1b2745',-0.065,1.1,0.172,0.022);part(b,G_SPH,'#1b2745',0.065,1.1,0.172,0.022);
  part(b,G_SPH,'#f0a090',-0.105,1.045,0.14,0.032,0.024,0.02);part(b,G_SPH,'#f0a090',0.105,1.045,0.14,0.032,0.024,0.02);
  part(b,G_BOX,'#f0b429',0,0.74,-0.21,0.26,0.3,0.14);part(b,G_BOX,'#d99a1c',0,0.85,-0.285,0.26,0.1,0.02);
  return{legL,legR,armL,armR};
})();
const heroBlob=blob(0.9);scene.add(heroBlob);

function eyes(g,y,z,dx,r){part(g,G_SPH,'#15182a',-dx,y,z,r);part(g,G_SPH,'#15182a',dx,y,z,r);}
function makeSquirrel(){const g=new THREE.Group(),O='#c8642a',L='#e89a54';
  part(g,G_SPH,O,0,0.2,0,0.13,0.18,0.13);part(g,G_SPH,'#f4e3c8',0,0.2,0.07,0.085,0.13,0.08);
  part(g,G_SPH,O,0,0.43,0.04,0.1);part(g,G_CONE,O,-0.06,0.54,0.02,0.03,0.09,0.03);part(g,G_CONE,O,0.06,0.54,0.02,0.03,0.09,0.03);
  eyes(g,0.45,0.125,0.045,0.018);part(g,G_SPH,'#15182a',0,0.41,0.14,0.014);
  part(g,G_SPH,O,0,0.2,-0.17,0.09,0.11,0.1);part(g,G_SPH,O,0,0.4,-0.24,0.11,0.16,0.11);part(g,G_SPH,L,0,0.58,-0.2,0.09,0.11,0.1);
  part(g,G_SPH,O,-0.08,0.24,0.1,0.035);part(g,G_SPH,O,0.08,0.24,0.1,0.035);g.add(blob(0.5));return g;}
function makeHedgehog(){const g=new THREE.Group();
  part(g,G_SPH,'#5a4636',0,0.15,-0.02,0.2,0.16,0.25);
  for(let i=0;i<44;i++){const a=rr(-2.5,2.5),e=rr(0.25,1.5),c=part(g,G_CONE,i%3?'#3d3028':'#b89a78',0,0,0,0.022,0.12,0.022);
    const nx=Math.sin(a)*Math.cos(e),ny=Math.sin(e),nz=-Math.cos(a)*Math.cos(e);c.position.set(nx*0.2,0.15+ny*0.16,-0.02+nz*0.25);
    c.quaternion.setFromUnitVectors(UP,_v.set(nx,ny*1.2,nz).normalize());}
  const sn=part(g,G_CONE,'#d9b48a',0,0.12,0.26,0.09,0.2,0.09);sn.rotation.x=Math.PI/2;
  part(g,G_SPH,'#15182a',0,0.12,0.36,0.022);eyes(g,0.17,0.27,0.05,0.016);g.add(blob(0.6));return g;}
function makeHare(){const g=new THREE.Group(),B='#a58a6a';
  part(g,G_SPH,B,0,0.22,-0.03,0.16,0.2,0.22);part(g,G_SPH,'#efe6d6',0,0.2,0.1,0.1,0.13,0.1);
  part(g,G_SPH,B,0,0.5,0.12,0.12);
  for(const x of[-0.05,0.05]){const e=part(g,G_SPH,B,x,0.76,0.08,0.035,0.18,0.05);e.rotation.z=x<0?0.12:-0.12;part(g,G_SPH,'#e8b0a0',x,0.76,0.1,0.018,0.13,0.035);}
  eyes(g,0.53,0.215,0.055,0.02);part(g,G_SPH,'#c06a6a',0,0.48,0.235,0.018);
  part(g,G_SPH,'#ffffff',0,0.18,-0.25,0.06);part(g,G_SPH,B,-0.09,0.06,0.12,0.045,0.05,0.08);part(g,G_SPH,B,0.09,0.06,0.12,0.045,0.05,0.08);g.add(blob(0.6));return g;}
function makeBear(){const g=new THREE.Group(),B='#7a4f2a',L='#c59a6a';
  part(g,G_SPH,B,0,0.3,0,0.27,0.3,0.25);part(g,G_SPH,L,0,0.28,0.13,0.16,0.19,0.14);
  part(g,G_SPH,B,0,0.7,0.02,0.2);part(g,G_SPH,B,-0.15,0.87,0,0.07);part(g,G_SPH,B,0.15,0.87,0,0.07);
  part(g,G_SPH,L,0,0.66,0.17,0.09,0.07,0.07);part(g,G_SPH,'#15182a',0,0.69,0.235,0.025);eyes(g,0.75,0.17,0.075,0.022);
  for(const x of[-0.24,0.24]){part(g,G_SPH,B,x,0.36,0.1,0.08,0.13,0.08);part(g,G_SPH,B,x*0.7,0.07,0.16,0.09,0.08,0.13);}return g;}
function makeMouse(){const g=new THREE.Group(),M='#9a9aa5';
  part(g,G_SPH,M,0,0.08,0,0.08,0.075,0.11);part(g,G_SPH,M,0,0.14,0.1,0.06);
  part(g,G_SPH,'#e8a8a8',-0.055,0.2,0.08,0.04,0.04,0.012);part(g,G_SPH,'#e8a8a8',0.055,0.2,0.08,0.04,0.04,0.012);
  eyes(g,0.155,0.15,0.028,0.011);part(g,G_SPH,'#e07a8a',0,0.13,0.16,0.012);
  const t=part(g,G_CYL,'#e8a8a8',0,0.05,-0.18,0.01,0.2,0.01);t.rotation.x=Math.PI/2-0.3;return g;}
function makeBird(){const g=new THREE.Group();
  part(g,G_SPH,'#f0d040',0,0.075,0,0.06,0.065,0.08);part(g,G_SPH,'#26324e',0,0.15,0.035,0.048);
  part(g,G_SPH,'#ffffff',-0.035,0.145,0.05,0.022,0.022,0.02);part(g,G_SPH,'#ffffff',0.035,0.145,0.05,0.022,0.022,0.02);
  const bk=part(g,G_CONE,'#3a3a3a',0,0.15,0.09,0.014,0.04,0.014);bk.rotation.x=Math.PI/2;
  part(g,G_SPH,'#5f7fa8',-0.055,0.08,-0.01,0.02,0.045,0.065);part(g,G_SPH,'#5f7fa8',0.055,0.08,-0.01,0.02,0.045,0.065);
  part(g,G_BOX,'#4a6a94',0,0.07,-0.1,0.035,0.012,0.08);return g;}
function makeFrog(){const g=new THREE.Group(),F='#5aa53a';
  part(g,G_SPH,F,0,0.09,0,0.13,0.085,0.15);part(g,G_SPH,'#cfe58a',0,0.06,0.07,0.09,0.05,0.08);
  for(const x of[-0.065,0.065]){part(g,G_SPH,F,x,0.17,0.07,0.045);part(g,G_SPH,'#15182a',x,0.18,0.105,0.02);
    part(g,G_SPH,'#4a8f30',x*2.2,0.05,-0.06,0.06,0.045,0.09);}return g;}
/* Zajdík: a soft long-eared plush rabbit with a red ribbon, who shows the way */
function makeZajdik(){
  const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);
  const F='#a9c8c1',L='#c6d9cf',N='#d8a994',INK='#4a4640';
  const limb=(x,y,r,len,foot)=>{const p=new THREE.Group();p.position.set(x,y,0);inner.add(p);part(p,G_CYL,F,0,-len/2,0,r,len,r);
    if(foot)part(p,G_SPH,F,0,-len-0.01,0.035,0.05,0.04,0.085);else part(p,G_SPH,F,0,-len,0,r*1.25);return p;};
  const legL=limb(-0.065,0.4,0.032,0.36,true),legR=limb(0.065,0.4,0.032,0.36,true);
  part(inner,G_SPH,F,0,0.52,0,0.13,0.17,0.115);
  part(inner,G_SPH,L,0,0.5,0.045,0.095,0.13,0.085);
  part(inner,G_SPH,L,0,0.44,-0.11,0.045);
  const armL=limb(-0.13,0.62,0.027,0.3,false),armR=limb(0.13,0.62,0.027,0.3,false);armL.rotation.z=-0.25;armR.rotation.z=0.25;
  const head=new THREE.Group();head.position.set(0,0.78,0.01);inner.add(head);
  part(head,G_SPH,F,0,0,0,0.125,0.12,0.115);
  part(head,G_SPH,L,0,-0.03,0.085,0.07,0.055,0.05);
  part(head,G_SPH,N,0,0,0.125,0.028,0.022,0.018);
  for(const x of[-0.055,0.055]){const e=part(head,G_SPH,INK,x,0.03,0.105,0.024,0.006,0.008);e.rotation.z=x<0?0.25:-0.25;}
  part(head,G_SPH,INK,0,-0.055,0.128,0.03,0.005,0.006);
  const ear=x=>{const p=new THREE.Group();p.position.set(x,0.08,-0.02);head.add(p);part(p,G_SPH,F,0,-0.2,0,0.048,0.21,0.03);part(p,G_SPH,L,0,-0.2,0.012,0.03,0.16,0.022);p.rotation.z=x<0?-0.35:0.35;return p;};
  const earL=ear(-0.075),earR=ear(0.075);
  const rb=new THREE.Mesh(new THREE.TorusGeometry(0.075,0.022,8,16),fm('#d8402f'));rb.rotation.x=Math.PI/2;rb.position.y=0.675;inner.add(rb);
  const tail=part(inner,G_BOX,'#d8402f',0.07,0.62,0.09,0.035,0.11,0.012);tail.rotation.z=-0.3;
  g.add(blob(0.55));
  g.userData={inner,legL,legR,armL,armR,earL,earR,head};
  return g;
}
const ITEM={
  stone(s){const g=new THREE.Group();const m=part(g,G_ROCK,'#8d8f98',0,0,0,0.2*s,0.15*s,0.17*s);m.material=ITEM._rock;return g;},
  stick(){const g=new THREE.Group();const m=part(g,G_CYL,'#8a6244',0,0,0,0.03,0.6,0.03);m.rotation.z=Math.PI/2;const t=part(g,G_CYL,'#8a6244',0.12,0.05,0,0.02,0.16,0.02);t.rotation.z=0.7;return g;},
  apple(){const g=new THREE.Group();part(g,G_SPH,'#d8402f',0,0,0,0.11,0.1,0.11);part(g,G_CYL,'#5a3d2e',0,0.11,0,0.01,0.06,0.01);part(g,G_SPH,'#4c9a3a',0.04,0.13,0,0.045,0.01,0.025);return g;},
  log(){const g=new THREE.Group();const m=part(g,G_CYL,'#7a5236',0,0,0,0.2,1.3,0.2);m.rotation.z=Math.PI/2;
    for(const x of[-0.655,0.655]){const e=part(g,G_CYL,'#d9b98a',x,0,0,0.19,0.02,0.19);e.rotation.z=Math.PI/2;}return g;},
  nut(){const g=new THREE.Group();part(g,G_SPH,'#b07a3a',0,0,0,0.075,0.085,0.075);part(g,G_SPH,'#6a4a2a',0,0.05,0,0.07,0.045,0.07);return g;},
  worm(){const g=new THREE.Group();for(let i=0;i<9;i++)part(g,G_SPH,i%2?'#e89aa0':'#d87a88',(i-4)*0.045,Math.sin(i*0.9)*0.03,0,0.032);return g;},
  clover(){const g=new THREE.Group();part(g,G_CYL,'#3f8a35',0,-0.07,0,0.01,0.14,0.01);for(let i=0;i<3;i++){const a=i/3*TAU+0.5;part(g,G_SPH,'#58b043',Math.cos(a)*0.06,0.02,Math.sin(a)*0.06,0.06,0.015,0.06);}return g;},
  cone(){const g=new THREE.Group();for(let i=0;i<6;i++){const k=1-Math.abs(i-2)/5;part(g,G_SPH,i%2?'#7a5236':'#94683f',0,i*0.045-0.1,0,0.07*k,0.035,0.07*k);}return g;},
  acorn(){const g=new THREE.Group();part(g,G_SPH,'#c08a4a',0,0,0,0.06,0.08,0.06);part(g,G_SPH,'#6a4a2a',0,0.05,0,0.065,0.04,0.065);part(g,G_CYL,'#6a4a2a',0,0.1,0,0.008,0.04,0.008);return g;},
};
ITEM._rock=new THREE.MeshLambertMaterial({color:'#9a9ca6',map:figTex,flatShading:true});

/* ---------- the four places ---------- */
// pond
const pondG=new THREE.Group();pondG.position.set(PLACES.pond.x,0,PLACES.pond.z);scene.add(pondG);
const waterGeo=new THREE.CircleGeometry(PLACES.pond.r*1.1,48).rotateX(-Math.PI/2);
const water=new THREE.Mesh(waterGeo,new THREE.MeshBasicMaterial({map:discTexture(1024,['#2f6f8f','#3a86a6','#2a5f80','#4a98b0','#245470','#3f7f9a'],['#f6e2b8','#bfe3ea','#ffffff']),alphaTest:0.5}));
water.position.y=0.035;pondG.add(water);
const ice=new THREE.Mesh(waterGeo,new THREE.MeshBasicMaterial({map:discTexture(1024,['#dfeaf6','#cfdff0','#eef4fb','#bcd0e8','#e6eef8'],['#ffffff','#a9c0e0']),alphaTest:0.5,transparent:true,opacity:0}));
ice.position.y=0.07;ice.visible=false;pondG.add(ice);
for(let i=0;i<11;i++){const a=rnd()*TAU;if(Math.sin(a)>0.2)continue;const d=PLACES.pond.r+rr(0,0.5),s=rr(0.8,2);
  const m=part(pondG,G_ROCK,'#8d8f98',Math.cos(a)*d,0.08*s,Math.sin(a)*d,0.24*s,0.16*s,0.2*s);m.material=ITEM._rock;m.rotation.y=rnd()*6;}
const lilyG=new THREE.Group();pondG.add(lilyG);
const PADS=[];for(let i=0;i<6;i++){const x=-3.4+i*1.36,z=0.9+Math.sin(i*1.7)*0.7;PADS.push([x,z]);
  const m=new THREE.Mesh(new THREE.CircleGeometry(0.56,16,0.4,5.6).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:i%2?'#5aa53a':'#6fb845'}));m.position.set(x,0.085,z);m.rotation.y=rnd()*6;lilyG.add(m);}
const frog=makeFrog();frog.scale.setScalar(1.5);lilyG.add(frog);frog.position.set(PADS[0][0],0.1,PADS[0][1]);frog.rotation.y=Math.PI/2;

// seesaw log
const logG=new THREE.Group();logG.position.set(PLACES.log.x,0,PLACES.log.z);scene.add(logG);
part(logG,G_CYL,'#6b4a36',0,0.27,0,0.34,0.56,0.34).scale.set(0.36,0.56,0.36);
part(logG,G_CYL,'#d9b98a',0,0.555,0,0.34,0.02,0.34);
const pivot=new THREE.Group();pivot.position.y=0.72;logG.add(pivot);
{const m=part(pivot,G_CYL,'#8a6244',0,0,0,0.17,6.2,0.17);m.rotation.z=Math.PI/2;
 for(const x of[-3.11,3.11]){const e=part(pivot,G_CYL,'#d9b98a',x,0,0,0.16,0.02,0.16);e.rotation.z=Math.PI/2;}}
const SEAT=0.95;
const signsG=new THREE.Group();pivot.add(signsG);
['1','2','3'].forEach((n,i)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(0.42,0.42),new THREE.MeshBasicMaterial({map:labelTexture(n,'#fdf8ea','#1b2745'),transparent:true}));
  m.position.set(-(i+1)*SEAT,-0.06,0.2);signsG.add(m);});
const bear=makeBear();pivot.add(bear);bear.position.set(-3*SEAT,0.15,0);
const mouse=makeMouse();mouse.scale.setScalar(1.5);pivot.add(mouse);mouse.position.set(3*SEAT,0.16,0);
const mouse2=makeMouse();mouse2.scale.setScalar(1.5);pivot.add(mouse2);mouse2.position.set(3*SEAT-0.34,0.16,0.02);mouse2.visible=false;
const birdsG=new THREE.Group();logG.add(birdsG);
const birds=[];for(let i=0;i<10;i++){const b=makeBird();b.scale.setScalar(2.1);b.visible=false;birdsG.add(b);birds.push(b);}
function birdSeat(i){return new THREE.Vector3(-2.5+i*0.555,0.88,0);}

// animals' clearing
const animalsG=new THREE.Group();animalsG.position.set(PLACES.animals.x,0,PLACES.animals.z);scene.add(animalsG);
{const m=part(animalsG,G_CYL,'#5f4636',0.2,0.3,-1.7,0.32,4.6,0.34);m.rotation.z=Math.PI/2;m.rotation.y=0.15;
 for(let i=0;i<5;i++)part(animalsG,G_SPH,'#6a9a45',rr(-1.8,2),0.6,-1.7+rr(-0.1,0.1),rr(0.2,0.4),0.08,0.24);}
const animals={v:makeSquirrel(),j:makeHedgehog(),z:makeHare()};
animals.v.scale.setScalar(1.6);animals.j.scale.setScalar(1.5);animals.z.scale.setScalar(1.45);
animals.v.position.set(-1.75,0,0);animals.j.position.set(0,0,0.35);animals.z.position.set(1.75,0,0);
animals.v.rotation.y=0.3;animals.z.rotation.y=-0.3;
for(const k in animals){animals[k].userData.pick=k;animalsG.add(animals[k]);}

// garden
const gardenG=new THREE.Group();gardenG.position.set(PLACES.garden.x,0,PLACES.garden.z);scene.add(gardenG);
part(gardenG,G_SPH,'#5a3d2e',0,0.02,0,0.75,0.2,0.75);
const sapling=new THREE.Group();gardenG.add(sapling);sapling.visible=false;
{part(sapling,G_CYL,'#6b4a36',0,0.6,0,0.045,1.2,0.045);
 for(let i=0;i<26;i++){const a=rnd()*TAU,e=rr(-0.3,1.4),r=rr(0.25,0.5);
   const l=part(sapling,G_SPH,i%3?'#7fbf4a':'#a6d15a',Math.cos(a)*Math.cos(e)*r,1.25+Math.sin(e)*r*0.9,Math.sin(a)*Math.cos(e)*r,0.16,0.035,0.09);l.rotation.set(rr(-0.6,0.6),rnd()*6,rr(-0.6,0.6));}}
const berriesG=new THREE.Group();scene.add(berriesG);
const berries=[];
(function(){let tries=0;while(berries.length<14&&tries++<400){
  const a=rnd()*TAU,d=rr(3.5,11.5),x=PLACES.garden.x+Math.cos(a)*d,z=PLACES.garden.z+Math.sin(a)*d;
  if(nearTrees(x,z).some(t=>Math.hypot(t.x-x,t.z-z)<1.4))continue;
  if(berries.some(b=>Math.hypot(b.x-x,b.z-z)<2.2))continue;
  if(Math.hypot(x,z)>PLAY_R-2)continue;
  const g=new THREE.Group();g.position.set(x,0,z);
  for(let i=0;i<7;i++){const l=part(g,G_SPH,i%2?'#3f8a35':'#5fa03c',rr(-0.25,0.25),rr(0.1,0.32),rr(-0.25,0.25),0.14,0.03,0.08);l.rotation.set(rr(-0.5,0.5),rnd()*6,rr(-0.5,0.5));}
  const fruit=new THREE.Group();g.add(fruit);
  for(let i=0;i<5;i++)part(fruit,G_SPH,i%2?'#3a4fb0':'#2c3f96',rr(-0.12,0.12),0.34+rr(0,0.12),rr(-0.12,0.12),0.06);
  berriesG.add(g);berries.push({x,z,g,fruit,got:false});}})();

/* markers over the places that still hold a task */
const beamTex=glowTexture(true);
function makeMarker(hex){
  const g=new THREE.Group();
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.8,18,20,1,true).translate(0,9,0),new THREE.MeshBasicMaterial({map:beamTex,color:hex,transparent:true,opacity:0.55,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide}));
  beam.renderOrder=6;g.add(beam);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(0.34),new THREE.MeshLambertMaterial({color:hex,emissive:hex,emissiveIntensity:0.45}));gem.position.y=3;g.add(gem);
  g.userData={beam,gem};scene.add(g);return g;
}

/* ---------- weather: falling leaves, snow, petals, motes ---------- */
const WN=Math.round(170*Q);
const weather=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:dabB,alphaTest:0.5,side:THREE.DoubleSide}),WN);
weather.frustumCulled=false;weather.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(weather);
const WX=[];for(let i=0;i<WN;i++)WX.push({x:rr(-16,16),y:rr(0,13),z:rr(-16,16),ph:rnd()*TAU,sp:rr(0.7,1.3),ax:rnd()*TAU});
const WKIND=[{pal:P.blossom,size:[0.14,0.1],fall:0.55,sway:0.6,spin:1.5},{pal:['#fff6b8','#ffffff','#f6e69a'],size:[0.07,0.06],fall:-0.06,sway:0.35,spin:0.4},
  {pal:P.autumnLeaf,size:[0.34,0.2],fall:0.95,sway:0.9,spin:2.2},{pal:['#ffffff','#f1f5fb'],size:[0.1,0.09],fall:1.15,sway:0.4,spin:0.6}];
let weatherKind=-1;
function setWeather(s){weatherKind=s;const k=WKIND[s];for(let i=0;i<WN;i++)weather.setColorAt(i,C(pick(k.pal)));weather.instanceColor.needsUpdate=true;}
function updateWeather(dt,time,cx,cz){
  const k=WKIND[weatherKind];
  for(let i=0;i<WN;i++){const w=WX[i];
    w.y-=k.fall*w.sp*dt;w.x+=Math.sin(time*0.7+w.ph)*k.sway*dt+SUN.x*0.25*dt;w.z+=Math.cos(time*0.6+w.ph)*k.sway*dt;
    if(w.y<0.05){w.y=13;w.x=rr(-16,16);w.z=rr(-16,16);}if(w.y>13.5)w.y=0.2;
    if(w.x>16)w.x-=32;if(w.x<-16)w.x+=32;if(w.z>16)w.z-=32;if(w.z<-16)w.z+=32;
    _e.set(time*k.spin*w.sp+w.ph,w.ax+time*0.6,w.ph,'YXZ');_q.setFromEuler(_e);
    _p.set(cx+w.x,w.y,cz+w.z);_s.set(k.size[0],k.size[1],1);_m.compose(_p,_q,_s);weather.setMatrixAt(i,_m);}
  weather.instanceMatrix.needsUpdate=true;
}

/* ---------- seasons ---------- */
const _fa=new THREE.Color(),_ta=new THREE.Color();
function paintSeason(a,b,t){
  for(const l of layers)l.apply(a,b,t);
  const k=t*t*(3-2*t);
  groundU.uRows.value.set((a*2+0.5)/8,(a*2+1.5)/8,(b*2+0.5)/8,(b*2+1.5)/8);groundU.uT.value=k;
  const A=ENV[a],B=ENV[b];
  _fa.copy(C(A.fog)).lerp(C(B.fog),k);_ta.copy(C(A.top)).lerp(C(B.top),k);
  scene.fog.color.copy(_fa);scene.fog.near=lerp(A.near,B.near,k);scene.fog.far=lerp(A.far,B.far,k);
  scene.background=scene.fog.color;paintSky(_fa,_ta);
  rayMat.opacity=lerp(A.ray,B.ray,k);
  const io=lerp(a===3?1:0,b===3?1:0,k);ice.material.opacity=io;ice.visible=io>0.02;
  const w=k<0.5?a:b;if(w!==weatherKind)setWeather(w);
}

function resize(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
