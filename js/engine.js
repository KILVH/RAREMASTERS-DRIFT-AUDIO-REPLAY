
/*
  ============================================================
  КАРТЫ
  ============================================================
  Чтобы добавить новую карту:
  1. Создай папку maps/имя_карты/
  2. Положи туда:
       track.png
       collision.png
       splash1.png
       splash2.png
       splash3.png
  3. Добавь один объект в MAPS ниже.

  ВАЖНО: старый Автодром не переименовываем.
  Он продолжает использовать map.png + map_collision.png.

  collision.png:
    ЧЁРНЫЙ   = стена / нельзя
    БЕЛЫЙ    = асфальт / обычная скорость
    СЕРЫЙ    = обочина / сильное замедление
    ЖЁЛТЫЙ   = clipping point
    ПУРПУРНЫЙ = старт / финишные линии
    ЗЕЛЁНЫЙ  = spawn игрока
    КРАСНЫЙ  = второй spawn

  Порядок двух пурпурных линий определяется по X:
    левая  = старт
    правая = финиш
  Для другой трассы это можно поменять в конфиге.
*/

const MAPS = {
  isakiy: {
    name: "Автодром",
    folder: "maps/isakiy/",
    track: "track.png",
    collision: "collision.png",
    splashes: [],
    startIsLeftLine: true
  },
  autodrom: {
    name: "Исакий",
    folder: "maps/autodrom/",
    track: "map.png",
    collision: "map_collision.png",
    splashes: [],
    startIsLeftLine: true
  }
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let selectedMapId = "isakiy";
let selectedMode = "training";
let gameType="legal"; window.gameType="legal";
let currentMap = null;

let mapImg = new Image();
let collisionImg = new Image();
let carImg = new Image();
let policeImg = new Image();

let collisionCanvas, collisionCtx, colData, colW, colH;
let markers = { clipping: [], lines: [], spawns: [] };

let W = 2048, H = 1280;
let SCALE = 1;
let CAMERA_ZOOM_LEGAL = 4.35;
let CAMERA_ZOOM_ILLEGAL = 5.75;
function setMobileCameraMultiplier(multiplier){
  const m = Math.max(0.25, Math.min(3, Number(multiplier) || 1));
  CAMERA_ZOOM_LEGAL = 4.35 * m;
  CAMERA_ZOOM_ILLEGAL = 5.75 * m;
  window.__SPB_CAMERA_MULTIPLIER = m;
}

let car, police;
let policeContactTimer=0;
let camera = {x:0,y:0};
let smoke = [];
let keys = {};
let gameRunning=false; window.gameRunning=false;
let gamePaused = false;
window.gameRunning=false; window.gameRunning=false;
window.gameType = gameType;
let audioCtx;
const gameAudioNodes=new Set();
let splashTimer = null;

let trainingScore = 0;
let driftTime = 0;
let driftMultiplier = 1;
let offroadTimer = 0;
let stoppedTimer = 0;
let spinTimer = 0;
let shoulderPenalty = 0;
let comp = null;

const LEGAL_CAR_H = 98;
const LEGAL_CAR_W = 49;
const ILLEGAL_CAR_H = 128;
const ILLEGAL_CAR_W = 64;
const LEGAL_MAX_SPEED = 10;
const ILLEGAL_MAX_SPEED = 12;
const LEGAL_ACCELERATION = 0.13;
const ILLEGAL_ACCELERATION = 0.16;
const KMH_FACTOR = 12;
function speedKmh(v){ return v * KMH_FACTOR; }
function carH(){ return gameType === "illegal" ? ILLEGAL_CAR_H : LEGAL_CAR_H; }
function carW(){ return gameType === "illegal" ? ILLEGAL_CAR_W : LEGAL_CAR_W; }
function maxSpeed(){ return gameType === "illegal" ? ILLEGAL_MAX_SPEED : LEGAL_MAX_SPEED; }
function acceleration(){ return gameType === "illegal" ? ILLEGAL_ACCELERATION : LEGAL_ACCELERATION; }

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function showLegalMenu(){ showScreen("legalMenu"); }
function showIllegalMenu(){ showScreen("illegalMenu"); }

function resize(){
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  SCALE = Math.min(innerWidth / W, innerHeight / H);
  // Немного увеличиваем карту, но оставляем её целиком управляемой камерой.
  if(SCALE > 1) SCALE = 1;
}
addEventListener("resize", resize);

addEventListener("keydown", e=>{
  keys[e.key] = true;
  if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
});
addEventListener("keyup", e=>keys[e.key] = false);

// Pointer capture in integration.js owns mobile buttons (one event pipeline).

// Shared decoded-image cache. Bound retained decoded pixels, not compressed bytes.
const AssetImages={cache:new Map(),pixels:0,maxPixels:24000000,
 image(src){let item=this.cache.get(src);if(item){this.cache.delete(src);this.cache.set(src,item);return item.image;}
  const im=new Image();item={image:im,pixels:0};this.cache.set(src,item);
  item.ready=new Promise((resolve,reject)=>{im.onload=async()=>{try{await im.decode?.();}catch(e){}item.pixels=im.naturalWidth*im.naturalHeight;this.pixels+=item.pixels;
   for(const [key,old] of this.cache){if(this.pixels<=this.maxPixels&&this.cache.size<=64)break;if(key!==src&&old.pixels){this.pixels-=old.pixels;this.cache.delete(key);}}resolve(im);};im.onerror=()=>{this.cache.delete(src);reject(new Error('Не найден файл: '+src));};});
  item.ready.catch(()=>{});im.assetReady=item.ready;im.src=src;return im;
 },load(src){this.image(src);return this.cache.get(src).ready;}
};
function loadImage(src){return AssetImages.load(src);}


async function loadMap(id){
  currentMap = MAPS[id];
  document.getElementById("loading").classList.add("active");

  const base = currentMap.folder;

  try{
    [mapImg,collisionImg] = await Promise.all([
      loadImage(base + currentMap.track),
      loadImage(base + currentMap.collision)
    ]);

    W = mapImg.naturalWidth;
    H = mapImg.naturalHeight;

    collisionCanvas = document.createElement("canvas");
    collisionCanvas.width = collisionImg.naturalWidth;
    collisionCanvas.height = collisionImg.naturalHeight;
    collisionCtx = collisionCanvas.getContext("2d",{willReadFrequently:true});
    collisionCtx.drawImage(collisionImg,0,0);
    colW = collisionCanvas.width;
    colH = collisionCanvas.height;
    colData = collisionCtx.getImageData(0,0,colW,colH).data;

    detectMarkers();
    resize();

    // Игровые машины остаются в корне проекта.
    carImg = await loadImage("zhiga.png");

    try { policeImg = await loadImage("police.png"); } catch(e) {
      policeImg = null;
    }

    document.getElementById("loading").classList.remove("active");
  }catch(e){
    document.getElementById("loading").classList.remove("active");
    alert(e.message);
    throw e;
  }
}

/*
  Автоматически ищем специальные маркеры прямо в collision.png.
  Поэтому тебе не нужно вручную прописывать координаты каждой точки.
*/
function detectMarkers(){
  markers = {clipping:[],lines:[],spawns:[]};

  const pixels = colData;
  const seen = new Uint8Array(colW*colH);

  function isYellow(i){
    return pixels[i] > 220 && pixels[i+1] > 180 && pixels[i+1] < 250 && pixels[i+2] < 60;
  }
  function isMagenta(i){
    return pixels[i] > 180 && pixels[i+1] < 100 && pixels[i+2] > 180;
  }
  function isGreen(i){
    return pixels[i] < 100 && pixels[i+1] > 180 && pixels[i+2] < 100;
  }
  function isRed(i){
    return pixels[i] > 180 && pixels[i+1] < 100 && pixels[i+2] < 100;
  }

  function components(test, minArea){
    const result=[];
    for(let y=0;y<colH;y++){
      for(let x=0;x<colW;x++){
        const p=y*colW+x;
        if(seen[p]) continue;
        const i=p*4;
        if(!test(i)) continue;

        const stack=[p];
        seen[p]=1;
        let count=0,sumX=0,sumY=0,minX=x,maxX=x,minY=y,maxY=y;

        while(stack.length){
          const q=stack.pop();
          const qx=q%colW, qy=Math.floor(q/colW);
          count++; sumX+=qx; sumY+=qy;
          if(qx<minX)minX=qx;if(qx>maxX)maxX=qx;
          if(qy<minY)minY=qy;if(qy>maxY)maxY=qy;

          const ns=[q-1,q+1,q-colW,q+colW];
          for(const n of ns){
            if(n<0||n>=colW*colH||seen[n]) continue;
            const nx=n%colW, ny=Math.floor(n/colW);
            if(Math.abs(nx-qx)+Math.abs(ny-qy)!==1) continue;
            if(test(n*4)){
              seen[n]=1;
              stack.push(n);
            }
          }
        }

        if(count>=minArea){
          result.push({
            area:count,
            x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,
            cx:sumX/count,cy:sumY/count
          });
        }
      }
    }
    return result;
  }

  // Для каждого типа используем отдельный проход.
  seen.fill(0);
  markers.clipping = components(isYellow, 100).sort((a,b)=>a.cy-b.cy || a.cx-b.cx);

  seen.fill(0);
  markers.lines = components(isMagenta, 40);

  seen.fill(0);
  markers.spawns = [
    ...components(isGreen,40).map(s=>({...s,type:"player"})),
    ...components(isRed,40).map(s=>({...s,type:"second"}))
  ];

  // В этой трассе левая по X пурпурная линия считается стартом.
  markers.lines.sort((a,b)=>a.cx-b.cx);
  if(!currentMap.startIsLeftLine) markers.lines.reverse();

  console.log("Маркеры карты:", markers);
}

function pixelAt(x,y){
  if(!colData) return {r:0,g:0,b:0};
  const px=Math.floor(x/W*colW);
  const py=Math.floor(y/H*colH);
  if(px<0||py<0||px>=colW||py>=colH) return {r:0,g:0,b:0};
  const i=(py*colW+px)*4;
  return {r:colData[i],g:colData[i+1],b:colData[i+2]};
}

function surfaceAt(x,y){
  const p=pixelAt(x,y);
  if(p.r<50 && p.g<50 && p.b<50) return "wall";
  if(Math.abs(p.r-p.g)<15 && Math.abs(p.g-p.b)<15 && p.r>=60 && p.r<200) return "shoulder";
  return "road";
}

function carSurfaceInfo(){
  const ca=Math.cos(car.angle), sa=Math.sin(car.angle);
  const hw=carW()*.42, hh=carH()*.42;
  const pts=[
    [car.x,car.y],[car.x+ca*hh,car.y+sa*hh],[car.x-ca*hh,car.y-sa*hh],
    [car.x+sa*hw,car.y-ca*hw],[car.x-sa*hw,car.y+ca*hw],
    [car.x+ca*hh+sa*hw*.8,car.y+sa*hh-ca*hw*.8],
    [car.x+ca*hh-sa*hw*.8,car.y+sa*hh+ca*hw*.8],
    [car.x-ca*hh+sa*hw*.8,car.y-sa*hh-ca*hw*.8],
    [car.x-ca*hh-sa*hw*.8,car.y-sa*hh+ca*hw*.8]
  ];
  let shoulder=0, wall=0;
  for(const [x,y] of pts){
    const sf=surfaceAt(x,y);
    if(sf==='wall') wall++;
    if(sf==='shoulder') shoulder++;
  }
  return {shoulderRatio:shoulder/pts.length, wallRatio:wall/pts.length, samples:pts.length};
}
function carSurface(){
  const info=carSurfaceInfo();
  if(info.wallRatio>0) return 'wall';
  return info.shoulderRatio>=.34 ? 'shoulder' : 'road';
}
function collides(x,y){
  const samples=[
    [x,y],
    [x+Math.cos(car.angle)*carH()*.4,y+Math.sin(car.angle)*carH()*.4],
    [x-Math.cos(car.angle)*carH()*.4,y-Math.sin(car.angle)*carH()*.4],
    [x+Math.cos(car.angle+Math.PI/2)*carW()*.4,y+Math.sin(car.angle+Math.PI/2)*carW()*.4],
    [x+Math.cos(car.angle-Math.PI/2)*carW()*.4,y+Math.sin(car.angle-Math.PI/2)*carW()*.4]
  ];
  return samples.some(([sx,sy])=>surfaceAt(sx,sy)==="wall");
}

function spawnPosition(type="player"){
  // Новая карта: используем явно отмеченный spawn.
  const s = markers.spawns.find(x=>x.type===type) || markers.spawns[0];
  if(s) return {x:s.cx,y:s.cy,angle:0};

  // Старый Автодром не имеет цветного spawn в collision.png.
  // Поэтому ищем случайную точку ИМЕННО на белом асфальте,
  // а не используем центр карты, который может оказаться в чёрной зоне.
  for(let i=0;i<30000;i++){
    const x=40+Math.random()*(W-80);
    const y=40+Math.random()*(H-80);
    if(surfaceAt(x,y)!=="road") continue;

    const checks=[
      [x+55,y],[x-55,y],[x,y+55],[x,y-55],
      [x+35,y+35],[x-35,y+35],[x+35,y-35],[x-35,y-35]
    ];
    if(checks.every(([cx,cy])=>surfaceAt(cx,cy)==="road")){
      return {x,y,angle:0};
    }
  }

  // Крайний fallback: ищем любую не-стену.
  for(let i=0;i<30000;i++){
    const x=Math.random()*W, y=Math.random()*H;
    if(surfaceAt(x,y)!=="wall") return {x,y,angle:0};
  }
  return {x:W*.5,y:H*.5,angle:0};
}

function resetCar(){
  const s=spawnPosition("player");
  car={x:s.x,y:s.y,angle:0,vx:0,vy:0};
  smoke=[];
  trainingScore=0;
  driftTime=0;
  driftMultiplier=1;
  offroadTimer=0;
  stoppedTimer=0;
  spinTimer=0;
  shoulderPenalty=0;

  if(selectedMode==="competition"){
    comp={
      score:0,
      clipping:0,
      clippingHit:new Set(),
      clippingQuality:new Map(),
      angle:0,
      speed:0,
      line:0,
      style:0,
      started:false,
      finished:false,
      invalid:false,
      startTime:0,
      elapsed:0,
      maxSpeed:0,
      avgAngle:0,
      angleSamples:0,
      speedSum:0,
      speedSamples:0,
      driftSamples:0,
      stableSamples:0,
      transitionSamples:0,
      lastDriftSide:0,
      startCrossed:false
    };
  }else comp=null;

  document.getElementById("restartBtn").style.display="none";
  document.getElementById("result").classList.remove("active");
}

function wrap(a){return Math.atan2(Math.sin(a),Math.cos(a));}

function updateCar(){
  if(!car || gamePaused) return;
  const oldX=car.x, oldY=car.y, oldAngle=car.angle;

  const surface=carSurface();
  const speed=Dynamics.step(car,keys,Vehicles.current().stats,surface,gameType==='illegal'?ILLEGAL_ACCELERATION:LEGAL_ACCELERATION,gameType==='illegal'?ILLEGAL_MAX_SPEED:LEGAL_MAX_SPEED);

  // Turning beside a wall must not embed the body and block forward AND reverse.
  if(collides(car.x,car.y)){car.angle=oldAngle;car.yaw=0;}
  const nx=car.x+car.vx, ny=car.y+car.vy;
  let collided=false;
  if(!collides(nx,ny)){
    car.x=nx; car.y=ny;
  }else{
    collided=true;
    if(!collides(car.x+car.vx,car.y)) {car.x+=car.vx;car.vy=0}
    else if(!collides(car.x,car.y+car.vy)) {car.y+=car.vy;car.vx=0}
    else {car.vx=0;car.vy=0}
    driftMultiplier=1;
  }

  const velA=Math.atan2(car.vy,car.vx);
  const angle=Math.abs(wrap(velA-car.angle))*180/Math.PI;
  const drifting=angle>Dynamics.driftAngle && speed>Dynamics.driftSpeed;

  if(drifting && !collided){
    driftTime++;
    driftMultiplier=Math.min(6, driftMultiplier + 0.012);
    trainingScore += (angle/35)*speed*.08*driftMultiplier;
    smoke.push({x:car.x,y:car.y,life:35,size:5+Math.random()*5,alpha:.45});
  }else if(!drifting){
    driftMultiplier=1;
  }

  if(gameType==="legal" && comp && !comp.finished) updateCompetition(speed,angle,oldX,oldY,car.x,car.y);

  // В НЕЛЕГАЛЕ полиция появляется только после 10 000 очков.
  if(gameType==="illegal" && !police && trainingScore >= 10000){
    resetPolice();
  }

  if(gameType==="illegal" && police){
    const pd=Math.hypot(car.x-police.x, car.y-police.y);
    if(pd < Math.max(carW(),carH())*.62){
      policeContactTimer += 1/60;
      if(policeContactTimer > 0.5) arrestPlayer();
      return;
    }
  }
}

function pointDistanceToCar(p){
  return Math.hypot(car.x-p.cx,car.y-p.cy);
}

function lineCrossed(line, oldX,oldY,newX,newY){
  if(!line) return false;
  const x1=line.x, y1=line.y, x2=line.x+line.w, y2=line.y+line.h;
  const denom=(x2-x1)*(newY-oldY)-(y2-y1)*(newX-oldX);
  if(Math.abs(denom)<.00001) return false;
  const a=((y1-oldY)*(newX-oldX)-(x1-oldX)*(newY-oldY))/denom;
  const b=((y1-oldY)*(x2-x1)-(x1-oldX)*(y2-y1))/denom;
  return a>=0&&a<=1&&b>=0&&b<=1;
}

function invalidateCompetition(reason="ВЫЛЕТ С ТРАССЫ"){
  if(!comp || comp.finished) return;
  comp.invalid=true;
  comp.finished=true;
  comp.started=false;
  comp.score=0;
  gamePaused=true;

  document.getElementById("resultScore").textContent="0";
  document.getElementById("resultStats").innerHTML=
    `<b>${reason}</b><br>Заезд аннулирован.`;
  document.getElementById("result").classList.add("active");
  gamePaused=true;
}

function pointToSegmentDistance(px,py,x1,y1,x2,y2){
  const dx=x2-x1, dy=y2-y1;
  const len2=dx*dx+dy*dy;
  if(!len2) return Math.hypot(px-x1,py-y1);
  let t=((px-x1)*dx+(py-y1)*dy)/len2;
  t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));
}
function lineTouched(line, oldX,oldY,newX,newY){
  if(!line) return false;
  if(lineCrossed(line,oldX,oldY,newX,newY)) return true;
  const cx=line.x+line.w/2, cy=line.y+line.h/2;
  const d=pointToSegmentDistance(cx,cy,oldX,oldY,newX,newY);
  return d < Math.max(carW(),carH())*.55;
}


function pointNearLine(x,y,line,pad=85){
  if(!line) return false;
  const x1=line.x1 ?? line.x ?? 0;
  const y1=line.y1 ?? line.y ?? 0;
  const x2=line.x2 ?? ((line.x??0)+(line.w??0));
  const y2=line.y2 ?? ((line.y??0)+(line.h??0));
  const dx=x2-x1, dy=y2-y1;
  const len2=dx*dx+dy*dy;
  let t=len2 ? ((x-x1)*dx+(y-y1)*dy)/len2 : 0;
  t=Math.max(0,Math.min(1,t));
  const px=x1+t*dx, py=y1+t*dy;
  return Math.hypot(x-px,y-py)<=pad;
}


// Shared LINE / ANGLE / STYLE formula for the player and live tandem leader.
const RaceJudge={
 create(){return{clippingQuality:new Map(),avgAngle:0,angleSamples:0,driftSamples:0,stableSamples:0,speedSum:0,speedSamples:0,transitionSamples:0,lastDriftSide:0};},
 sample(m,v){const speed=Math.hypot(v.vx,v.vy),signed=wrap(Math.atan2(v.vy,v.vx)-v.angle)*180/Math.PI,angle=Math.abs(signed);m.avgAngle+=angle;m.angleSamples++;m.speedSum+=speed;m.speedSamples++;if(angle>=Dynamics.driftAngle&&speed>Dynamics.driftSpeed)m.driftSamples++;if(Math.max(0,Math.min(1,(angle-20)/30))>.65)m.stableSamples++;const side=signed>8?1:signed<-8?-1:0;if(side&&m.lastDriftSide&&side!==m.lastDriftSide)m.transitionSamples++;if(side)m.lastDriftSide=side;markers.clipping.forEach((p,i)=>{const rear={x:v.x-Math.cos(v.angle)*carH()*.45,y:v.y-Math.sin(v.angle)*carH()*.45},d=p.zone?pointToSegmentDistance(rear.x,rear.y,p.zone.a.x,p.zone.a.y,p.zone.b.x,p.zone.b.y):Math.hypot(v.x-p.cx,v.y-p.cy),radius=Math.max(28,Math.max(p.w,p.h)*.9);if(d<radius)m.clippingQuality.set(i,Math.max(m.clippingQuality.get(i)||0,1-d/radius));});},
 score(m,penalty=0,maximum=maxSpeed()){let line=0;for(const q of m.clippingQuality.values())line+=q;const clipping=Math.max(0,Math.min(40,line/Math.max(1,markers.clipping.length)*40-penalty)),angle=Math.min(40,Math.max(0,(m.avgAngle/Math.max(1,m.angleSamples)-20)/30)*40),drift=m.driftSamples/Math.max(1,m.angleSamples),stability=m.stableSamples/Math.max(1,m.driftSamples),speed=Math.min(1,m.speedSum/Math.max(1,m.speedSamples)/maximum),transitions=Math.min(1,m.transitionSamples/2),style=Math.min(20,drift*7+stability*5+speed*5+transitions*3);return{clipping,angle,style,score:Math.round(Math.max(0,Math.min(100,clipping+angle+style)))};}
};

function updateCompetition(speed, angle, oldX, oldY, newX, newY){
  if(!comp || comp.finished) return;
  const startLine=markers.lines[0];
  const finishLine=markers.lines[1];

  if(!comp.startCrossed){
    if(lineTouched(startLine,oldX,oldY,newX,newY)){
      comp.startCrossed=true;
      comp.started=true;
      comp.startTime=performance.now();
    }
    return;
  }

  const info=carSurfaceInfo();
  const fullOffroad=info.shoulderRatio+info.wallRatio>=0.78;
  const partialOffroad=info.shoulderRatio>0;
  const dt=1/60;

  if(fullOffroad){
    offroadTimer+=dt;
    if(offroadTimer>1.5){
      invalidateCompetition("ВЫЛЕТ С ТРАССЫ");
      return;
    }
  }else offroadTimer=0;

  // Частичный выезд не аннулирует заезд, но уменьшает LINE.
  if(partialOffroad && !fullOffroad){
    shoulderPenalty=Math.min(15,shoulderPenalty+dt*4);
  }

  // Полная остановка = аннулирование.
  if(speed<0.35){
    stoppedTimer+=dt;
    if(stoppedTimer>3){
      invalidateCompetition("ПОЛНАЯ ОСТАНОВКА");
      return;
    }
  }else stoppedTimer=0;

  // Spins reduce judged angle/style; only sustained stop or full off-track invalidates.
  comp.elapsed=(performance.now()-comp.startTime)/1000;
  comp.maxSpeed=Math.max(comp.maxSpeed,speed);
  comp.avgAngle += angle;
  comp.angleSamples++;
  comp.speedSum += speed;
  comp.speedSamples++;

  const drifting=angle>=Dynamics.driftAngle && speed>Dynamics.driftSpeed;
  if(drifting) comp.driftSamples++;
  const angleQuality=Math.max(0,Math.min(1,(angle-20)/30));
  if(angleQuality>.65) comp.stableSamples++;

  const velA=Math.atan2(car.vy,car.vx);
  const signedAngle=wrap(velA-car.angle)*180/Math.PI;
  const side=signedAngle>8?1:signedAngle<-8?-1:0;
  if(side && comp.lastDriftSide && side!==comp.lastDriftSide) comp.transitionSamples++;
  if(side) comp.lastDriftSide=side;

  markers.clipping.forEach((p,i)=>{
    const d=pointDistanceToCar(p);
    const radius=Math.max(28,Math.max(p.w,p.h)*.9);
    if(d<radius){
      const quality=Math.max(0,1-d/radius);
      const old=comp.clippingQuality.get(i)||0;
      if(quality>old){comp.clippingQuality.set(i,quality);comp.clippingHit.add(i);}
    }
  });

  if(lineTouched(finishLine,oldX,oldY,newX,newY)){
    comp.finished=true;
    comp.started=false;

    Object.assign(comp,RaceJudge.score(comp,shoulderPenalty,maxSpeed()));
    finishCompetition();
  }
}
function finishCompetition(){
  gamePaused=true;
  document.getElementById("result").classList.add("active");
  document.getElementById("result").style.zIndex="100";
  const avg=comp.angleSamples?comp.avgAngle/comp.angleSamples:0;

  document.getElementById("resultScore").textContent=comp.score;
  document.getElementById("resultStats").innerHTML=
    `LINE: <b>${Math.round(comp.clipping)}/40</b><br>`+
    `ANGLE: <b>${Math.round(comp.angle)}/40</b><br>`+
    `STYLE: <b>${Math.round(comp.style)}/20</b><br>`+
    `Попаданий в clipping: <b>${comp.clippingHit.size}/${markers.clipping.length}</b><br>`+
    `Средний угол: <b>${Math.round(avg)}°</b><br>`+
    `Макс. скорость: <b>${speedKmh(comp.maxSpeed).toFixed(0)} км/ч</b>`;
}

function arrestPlayer(){
  gamePaused=true;
  police=null;
  document.getElementById("resultScore").textContent="АРЕСТ";
  document.getElementById("resultStats").innerHTML="Полиция тебя поймала.<br><b>Заезд начинается заново.</b>";
  document.getElementById("result").classList.add("active");
  gamePaused=true;
  setTimeout(()=>{
    document.getElementById("result").classList.remove("active");
    resetCar();
    gamePaused=false;
  },1400);
}

function resetPolice(){
  police=null;
  if(gameType!=="illegal") return;

  const s=spawnPosition("second");
  let px=s.x, py=s.y;
  if(!markers.spawns.find(x=>x.type==="second")){
    px=car.x+180; py=car.y+80;
    // Try a few nearby safe positions.
    const candidates=[
      [car.x+180,car.y+80],[car.x-180,car.y-80],
      [car.x+220,car.y],[car.x,car.y+220]
    ];
    for(const [x,y] of candidates){
      if(surfaceAt(x,y)==="road"){px=x;py=y;break}
    }
  }
  police={x:px,y:py,angle:Math.atan2(car.y-py,car.x-px),vx:0,vy:0};
}

function updatePolice(){
  if(!police || !car || gamePaused) return;
  const dx=car.x-police.x, dy=car.y-police.y;
  const targetA=Math.atan2(dy,dx);
  const da=wrap(targetA-police.angle);
  police.angle += Math.max(-.045,Math.min(.045,da));

  const fx=Math.cos(police.angle), fy=Math.sin(police.angle);
  police.vx += fx*.055;
  police.vy += fy*.055;

  let speed=Math.hypot(police.vx,police.vy);
  const max=7.2;
  if(speed>max){ police.vx*=max/speed; police.vy*=max/speed; }

  const nx=police.x+police.vx, ny=police.y+police.vy;
  if(surfaceAt(nx,ny)!=="wall"){
    police.x=nx; police.y=ny;
  }else{
    police.vx*=.25; police.vy*=.25;
  }

  // If the chase gets stuck too far away, respawn the police behind the player.
  if(Math.hypot(police.x-car.x,police.y-car.y)>1100){
    const a=car.angle+Math.PI;
    const rx=car.x+Math.cos(a)*260, ry=car.y+Math.sin(a)*260;
    if(surfaceAt(rx,ry)==="road"){police.x=rx;police.y=ry;}
  }
}

function draw(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(!mapImg.complete) return;

  // Камера следует за машиной; на НЕЛЕГАЛЕ она заметно ближе.
  const renderScale = SCALE * (gameType === "illegal" ? CAMERA_ZOOM_ILLEGAL : CAMERA_ZOOM_LEGAL);
  const viewW=canvas.width/renderScale, viewH=canvas.height/renderScale;
  camera.x=car.x-viewW/2;
  camera.y=car.y-viewH/2;
  camera.x=Math.max(0,Math.min(W-viewW,camera.x));
  camera.y=Math.max(0,Math.min(H-viewH,camera.y));

  ctx.scale(renderScale,renderScale);
  ctx.translate(-camera.x,-camera.y);
  const dw=Math.min(viewW,W-camera.x),dh=Math.min(viewH,H-camera.y);
  if(dw>0&&dh>0)ctx.drawImage(mapImg,camera.x/W*mapImg.naturalWidth,camera.y/H*mapImg.naturalHeight,dw/W*mapImg.naturalWidth,dh/H*mapImg.naturalHeight,camera.x,camera.y,dw,dh);
  Tracks.draw(ctx);

  // Дым.
  smoke.forEach(s=>{
    ctx.fillStyle=`rgba(180,180,180,${s.alpha})`;
    ctx.beginPath();ctx.arc(s.x,s.y,s.size,0,Math.PI*2);ctx.fill();
    s.life--;s.size+=.4;s.alpha*=.95;
  });
  let liveSmoke=0;for(let i=0;i<smoke.length;i++)if(smoke[i].life>0)smoke[liveSmoke++]=smoke[i];smoke.length=liveSmoke;

  // Машина.
  ctx.save();
  ctx.translate(car.x,car.y);
  ctx.rotate(car.angle-Math.PI/2);
  const visualScale=Vehicles.visualScale();
  ctx.drawImage(carImg,-carW()*visualScale/2,-carH()*visualScale/2,carW()*visualScale,carH()*visualScale);
  ctx.restore();

  if(gameType==="illegal" && police && policeImg && policeImg.complete){
    ctx.save();
    ctx.translate(police.x,police.y);
    ctx.rotate(police.angle-Math.PI/2);
    ctx.drawImage(policeImg,-carW()/2,-carH()/2,carW(),carH());
    ctx.restore();
  }

  ctx.setTransform(1,0,0,1,0,0);
}

const hudElements=new Map();function setHudText(id,value){let el=hudElements.get(id);if(!el){el=document.getElementById(id);hudElements.set(id,el);}const text=String(value);if(el.textContent!==text)el.textContent=text;}
function updateHud(){
  if(gameType==="illegal"){
    setHudText("mapNameHud","");
    setHudText("modeHud","");
  }else{
    setHudText("mapNameHud",currentMap?currentMap.name:"");
    setHudText("modeHud",selectedMode==="training"?"ТРЕНИРОВКА":"СОРЕВНОВАНИЕ");
  }

  const speed=Math.hypot(car.vx,car.vy);
  const angle=Math.abs(wrap(Math.atan2(car.vy,car.vx)-car.angle))*180/Math.PI;

  // Счётчик DRIFT всегда показывается в свободной тренировке и НЕЛЕГАЛЕ.
  // В соревновании вместо него показывается текущий соревновательный результат.
  if(gameType==="illegal"){
    setHudText("scoreHud",`DRIFT: ${Math.floor(trainingScore)}  x${driftMultiplier.toFixed(1)}`);
  }else if(selectedMode==="training"){
    setHudText("scoreHud",`DRIFT: ${Math.floor(trainingScore)}  x${driftMultiplier.toFixed(1)}`);
  }else{
    setHudText("scoreHud",`SCORE: ${comp?comp.score:0}`);
  }

  setHudText("speedHud",`СКОРОСТЬ: ${speedKmh(speed).toFixed(0)} км/ч`);
  setHudText("angleHud",`УГОЛ: ${Math.round(angle)}°`);
  setHudText("surfaceHud",gameType==="illegal" ? "" :
    `ПОВЕРХНОСТЬ: ${carSurface()==="shoulder"?"ОБОЧИНА":"АСФАЛЬТ"}`);

  if(gameType==="illegal"){
    setHudText("compScore","");
    setHudText("cpHud","");
    setHudText("compDetails","");
  }else if(comp){
    setHudText("compScore",`${comp.score} PTS`);
    setHudText("cpHud",`CLIPPING: ${comp.clippingHit.size}/${markers.clipping.length}`);
    setHudText("compDetails",`ANGLE ${Math.round(comp.angle)}  MAX ${speedKmh(comp.maxSpeed).toFixed(0)} км/ч`);
  }else{
    setHudText("compScore","");
    setHudText("cpHud","");
    setHudText("compDetails","");
  }
}

function gameLoop(){
  if(gameRunning){
    updateCar();
    if(gameType==="illegal") updatePolice();
    draw();
    updateHud();
  }
  requestAnimationFrame(gameLoop);
}

async function showSplashes(){
  const splash=document.getElementById("splash");
  const files=currentMap.splashes;
  for(const file of files){
    try{
      const img=await loadImage(currentMap.folder+file);
      splash.innerHTML="";
      splash.appendChild(img);
      splash.classList.add("active");
      await new Promise(resolve=>setTimeout(resolve,1800));
    }catch(e){
      // Если заставка пока не загружена, просто пропускаем её.
    }
  }
  splash.classList.remove("active");
  splash.innerHTML="";
}

async function countdown(){
  const el=document.getElementById("countdown");
  el.style.display="flex";
  for(const t of ["3","2","1","GO!"]){
    el.textContent=t;
    await new Promise(r=>setTimeout(r,t==="GO!"?700:900));
  }
  el.style.display="none";
}

async function startLegal(mode){
  gameType="legal"; window.gameType="legal"; window.gameType=gameType;
  selectedMapId="isakiy";
  selectedMode=mode;

  showScreen("game");
  canvas.classList.add("active");
  document.getElementById("controls").style.display="flex";
  document.getElementById("topGameBtns").style.display="flex";

  await loadMap("isakiy");
  resetCar();

  gameRunning=true; window.gameRunning=true; window.gameRunning=true; window.gameRunning=true;
  gamePaused=false;
}

async function startIllegal(){
  gameType="illegal"; window.gameType="illegal"; window.gameType=gameType;
  selectedMapId="autodrom";
  selectedMode="illegal";

  showScreen("game");
  canvas.classList.add("active");
  document.getElementById("controls").style.display="flex";
  document.getElementById("topGameBtns").style.display="flex";

  await loadMap("autodrom");
  resetCar();

  gameRunning=true; window.gameRunning=true; window.gameRunning=true; window.gameRunning=true;
  gamePaused=false;
}

function restartRun(){
  if(gameType==="illegal"){
    resetCar();
    police=null;
    gamePaused=false;
    return;
  }
  document.getElementById("result").classList.remove("active");
  resetCar();
  gamePaused=false;
}

function leaveGame(){
  gameRunning=false; window.gameRunning=false; window.gameRunning=false; window.gameRunning=false;
  gamePaused=false;
  police=null;
  document.getElementById("controls").style.display="none";
  document.getElementById("topGameBtns").style.display="none";
  document.getElementById("restartBtn").style.display="none";
  document.getElementById("result").classList.remove("active");
  canvas.classList.remove("active");
  showScreen("mainMenu");
}



function initAudio(){
  try{
    if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();

  }catch(e){}
}
function beep(freq,dur,vol,type='square',when=0){
  if(!audioCtx)return; const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  gameAudioNodes.add(o);o.onended=()=>{o.disconnect();g.disconnect();gameAudioNodes.delete(o);};
  o.type=type; o.frequency.value=freq; g.gain.setValueAtTime(0.0001,audioCtx.currentTime+when);
  g.gain.exponentialRampToValueAtTime(vol,audioCtx.currentTime+when+0.008);
  g.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+when+dur);
  o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime+when); o.stop(audioCtx.currentTime+when+dur+0.02);
}


gameLoop();


