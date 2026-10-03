const Tracks={direction:'forward',
 init(){for(const t of CATALOG.tracks)MAPS[t.id]=t;MAPS.isakiy.character=0;MAPS.autodrom.character=4;MAPS.isakiy.mode='legal';MAPS.autodrom.mode='illegal';MAPS.isakiy.preview='menu/legal_menu.webp';MAPS.autodrom.preview='menu/illegal_menu.webp';MAPS.isakiy.splashes=['../../menu/legal_menu.webp'];MAPS.autodrom.splashes=['../../menu/illegal_menu.webp'];MAPS.wheel.mode='city';MAPS.wheel.name='Город';MAPS.green.character=1;
  // Add legal event metadata to the existing street map; never alter its mask.
  MAPS.autodrom.route=[[0.26042, 0.36979], [0.27474, 0.33333], [0.41406, 0.22917], [0.51953, 0.1901], [0.58984, 0.09505], [0.72005, 0.05469], [0.75391, 0.11979], [0.7487, 0.32943], [0.73438, 0.47005], [0.72005, 0.5], [0.60026, 0.57943], [0.45052, 0.67969], [0.34505, 0.7513], [0.34635, 0.64583], [0.28385, 0.55729], [0.2526, 0.46094], [0.23698, 0.375]];
 },
 usesRoute(){return !!currentMap.route&&!(selectedMapId==='autodrom'&&gameType==='illegal');},
 route(){return (this.usesRoute()?currentMap.route:[]).map(([x,y])=>({x:x*W,y:y*H}));},
 markers(){
  // Marker extraction in the legacy engine uses collision pixels. Convert only
  // for new masks; original maps remain exactly as supplied.
  if(!this.usesRoute())return;
  const suppliedClips=currentMap.id==='green'?markers.lines.map(p=>({...p})):null;
  const route=this.route();const rev=this.direction==='reverse';if(rev)route.reverse();this.activeRoute=route;
  const line=(p,q)=>{const a=Math.atan2(q.y-p.y,q.x-p.x),half=gameType==='legal'?105:130;const dx=-Math.sin(a)*half,dy=Math.cos(a)*half;return{x:p.x-dx,y:p.y-dy,w:dx*2,h:dy*2,cx:p.x,cy:p.y};};
  const start=route[1],finish=route[route.length-2];
  markers.lines=[line(start,route[2]),line(finish,route[route.length-1])];
  markers.spawns=[{cx:route[0].x,cy:route[0].y,type:'player'}];
  markers.clipping=route.slice(2,-2).filter((_,i)=>i%2===0).map(p=>({x:p.x-45,y:p.y-45,cx:p.x,cy:p.y,w:90,h:90}));
  if(suppliedClips?.length){const progress=p=>{let distance=Infinity,result=0;for(let i=0;i<route.length-1;i++){const a=route[i],b=route[i+1],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.cx-a.x)*dx+(p.cy-a.y)*dy)/(dx*dx+dy*dy||1)));const d=Math.hypot(p.cx-a.x-t*dx,p.cy-a.y-t*dy);if(d<distance){distance=d;result=i+t;}}return result;};markers.clipping=suppliedClips.filter(p=>progress(p)>1&&progress(p)<route.length-2).sort((a,b)=>progress(a)-progress(b));}
  if(currentMap.zones){markers.clipping=currentMap.zones.map(z=>{const a={x:z.a[0]*W,y:z.a[1]*H},b={x:z.b[0]*W,y:z.b[1]*H};return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.max(90,Math.abs(a.x-b.x)),h:Math.max(90,Math.abs(a.y-b.y)),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,zone:{a,b}};});if(rev)markers.clipping.reverse();}
  this.spawnAngle=Math.atan2(route[1].y-route[0].y,route[1].x-route[0].x);
 },
 draw(g){if(!currentMap.zones)return;g.save();const route=this.activeRoute;g.strokeStyle='#e7d18b';g.lineWidth=4;g.setLineDash([24,36]);g.beginPath();route.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.stroke();g.setLineDash([]);
  for(let i=2;i<route.length-2;i+=3){const p=route[i],q=route[i+1],a=Math.atan2(q.y-p.y,q.x-p.x);g.save();g.translate(p.x,p.y);g.rotate(a);g.fillStyle='#f4e4af';g.beginPath();g.moveTo(36,0);g.lineTo(-14,-18);g.lineTo(-4,0);g.lineTo(-14,18);g.closePath();g.fill();g.restore();}
  g.lineWidth=12;for(let i=0;i<markers.clipping.length;i++){const p=markers.clipping[i],{a,b}=p.zone;g.strokeStyle='#f4c34d';g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();g.fillStyle='#fff1b7';g.font='bold 23px monospace';g.fillText('ZONE '+(i+1),p.cx+18,p.cy-18);}
  markers.lines.forEach((l,i)=>{const angle=Math.atan2(l.h,l.w),length=Math.hypot(l.w,l.h);g.save();g.translate(l.x,l.y);g.rotate(angle);for(let x=0;x<length;x+=22){g.fillStyle=(Math.floor(x/22)%2===0)?'#f8f3dd':'#22252a';g.fillRect(x,-8,Math.min(22,length-x),16);}g.restore();g.fillStyle='#fff';g.font='bold 32px monospace';g.fillText(i?'FINISH':'START',l.cx+25,l.cy-35);});g.restore();}

};
Tracks.init();
const World={npcs:[],cops:[],heat:0,contactTicks:0,cooldown:0,grace:0,earned:0,frame:0,lastPos:null,turn:0,guard:0,
 safe(x,y,a=0){const h=carH()*.45,w=carW()*.45,c=Math.cos(a),s=Math.sin(a);return surfaceAt(x,y)==='road'&&surfaceAt(x+c*h,y+s*h)==='road'&&surfaceAt(x-c*h,y-s*h)==='road'&&surfaceAt(x-s*w,y+c*w)==='road'&&surfaceAt(x+s*w,y-c*w)==='road';},
 spawn(near=car,min=250){for(let i=0;i<1500;i++){const a=Math.random()*Math.PI*2,d=min+Math.random()*650,x=near.x+Math.cos(a)*d,y=near.y+Math.sin(a)*d;if(this.safe(x,y,a)&&Math.hypot(x-car.x,y-car.y)>min)return{x,y,angle:a,vx:0,vy:0};}const s=spawnPosition();return{x:s.x,y:s.y,angle:0,vx:0,vy:0};},
 reset(){Navigation.ready=false;this.npcs=[];this.cops=[];this.heat=0;this.contactTicks=0;this.cooldown=0;this.grace=600;this.earned=0;this.frame=0;this.lastPos={x:car.x,y:car.y};this.turn=0;this.guard=0;police=null;Social.ride=null;Pursuit.reset();
  if(gameType==='illegal'){Traffic.build();const ids=selectedMode==='city'?['lada']:['lada','bmw','volga'];ids.forEach((id,i)=>{const n=Traffic.create(id,Traffic.length*(i+1)/(ids.length+1),[6,2,4][i]);if(n)this.npcs.push(n);});this.specialAt=1800+Math.floor(Math.random()*1800);}
  if(selectedMode==='training'&&gameType==='legal')Traffic.trainingReset();
  if(selectedMode==='competition'&&Save.state.social.followers>=1500&&Math.random()<.03){const id=Math.random()<.5?'gocha':'tsar',person=Social.people[id];this.npcs.push({...this.spawn(car,350),kind:'parked',car:CATALOG.cars.find(c=>c.id===id),special:true,person:id,character:person.portrait});}
 },
 contact(a,b){
  // Separating-axis test of two oriented vehicle rectangles.
  if(Math.abs(a.x-b.x)>carH()||Math.abs(a.y-b.y)>carH())return false;const axes=[a.angle,a.angle+Math.PI/2,b.angle,b.angle+Math.PI/2];
  const extent=(v,t)=>Math.abs(Math.cos(v.angle-t))*carH()*.43+Math.abs(Math.sin(v.angle-t))*carW()*.43;
  return axes.every(t=>Math.abs((a.x-b.x)*Math.cos(t)+(a.y-b.y)*Math.sin(t))<extent(a,t)+extent(b,t));
 },
 resolve(a,b){const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy),nx=d?dx/d:Math.cos(a.angle+Math.PI/2),ny=d?dy/d:Math.sin(a.angle+Math.PI/2);const push=10;const ax=a.x+nx*push,ay=a.y+ny*push;if(this.safe(ax,ay,a.angle)){a.x=ax;a.y=ay;}const bx=b.x-nx*push,by=b.y-ny*push;if(this.safe(bx,by,b.angle)){b.x=bx;b.y=by;}const impulse=((a.vx-b.vx)*nx+(a.vy-b.vy)*ny);if(impulse<0){a.vx-=impulse*nx*.8;a.vy-=impulse*ny*.8;b.vx+=impulse*nx*.8;b.vy+=impulse*ny*.8;if(Math.abs(impulse)>1)AudioPlayer.impact();}driftMultiplier=1;},
 move(v,target,speed){if(v.wait>0){v.wait--;return;}const dx=target.x-v.x,dy=target.y-v.y,d=Math.hypot(dx,dy);if(d<1)return;const travel=Math.atan2(dy,dx);v.angle+=Math.max(-.07,Math.min(.07,wrap(travel-v.angle)));const step=Math.min(speed,d),nx=v.x+dx/d*step,ny=v.y+dy/d*step;if(this.safe(nx,ny,v.angle)){v.vx=nx-v.x;v.vy=ny-v.y;v.x=nx;v.y=ny;}else{v.angle=travel;v.navPath=null;v.vx=v.vy=0;}},
 update(){if(gamePaused)return;this.frame++;if(this.cooldown>0)this.cooldown--;if(this.grace>0)this.grace--;
  const gain=Math.max(0,trainingScore-this.earned);this.earned=trainingScore;Pursuit.addPoints(gain);
  const dist=this.lastPos?Math.hypot(car.x-this.lastPos.x,car.y-this.lastPos.y):0;Save.state.distance+=dist;this.lastPos={x:car.x,y:car.y};
  const speed=Math.hypot(car.vx,car.vy),angle=Math.abs(wrap(Math.atan2(car.vy,car.vx)-car.angle));const drifting=speed>Dynamics.driftSpeed&&angle>Dynamics.driftAngle*Math.PI/180;
  if(drifting)Save.state.tires=Math.max(0,Save.state.tires-.0025);
  const da=wrap(car.angle-Replay.lastAngle),sign=Math.sign(da);this.donut??=null;
  if(!drifting||Math.abs(da)<.003||Math.abs(da)>.16){this.donut=null;}
  else{const radius=Math.min(220,speed/Math.abs(da)),cx=car.x-Math.sin(car.angle)*radius*sign,cy=car.y+Math.cos(car.angle)*radius*sign;
   if(!this.donut||this.donut.sign!==sign||Math.hypot(cx-this.donut.cx,cy-this.donut.cy)>120)this.donut={cx,cy,sign,turn:0,start:{x:car.x,y:car.y},ticks:0};
   const d=this.donut;d.turn+=Math.abs(da);d.ticks++;if(d.turn>=Math.PI*2&&d.ticks>=60&&Math.hypot(car.x-d.start.x,car.y-d.start.y)<120){Save.state.donuts++;this.donut=null;}
  }Replay.lastAngle=car.angle;
  if(this.frame%300===0)Economy.check();
  if(gameType!=='illegal'){if(selectedMode==='training')Traffic.trainingUpdate();return;}
  if(selectedMode==='illegal'&&this.frame===this.specialAt&&Traffic.length&&Math.random()<.25){const choices=selectedMapId==='shop'?['hustler']:['borsh','subaru','artak','osman','rare','grey'],id=choices[Math.floor(Math.random()*choices.length)],person=Social.people[id];const n=Traffic.create(person.car,Traffic.length*.7,person.portrait);if(n){n.special=true;n.person=id;this.npcs.push(n);UI.toast(person.name+' приехал. Остановись рядом для фото.');}}


  for(const n of this.npcs){
   if(n.kind!=='parked'){const far=Math.hypot(n.x-car.x,n.y-car.y)>1800;if(!far||this.frame%4===0)Traffic.update(n,far?4:1);}
   if(this.contact(car,n)){this.resolve(car,n);Replay.hits++;n.wait=180;if(!this.cooldown){this.cooldown=600;this.npcDialogue(n);}}
  }
  Social.updateRide();Pursuit.update();
  if(this.frame%3===0){const cells=new Map(),size=carH()*2;for(const v of [...this.npcs,...this.cops]){const x=Math.floor(v.x/size),y=Math.floor(v.y/size);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const other of cells.get((x+dx)+','+(y+dy))||[])if(this.contact(v,other))this.resolve(v,other);const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(v);}}

  if(currentMap.id==='wheel'){
   const service={x:W*.355,y:H*.183};const near=Math.hypot(car.x-service.x,car.y-service.y)<230;
   document.getElementById('serviceBtn').hidden=!(near&&speed<1);
   if(drifting)this.guard++;if(this.guard>300&&!this.cooldown){this.guard=0;this.cooldown=900;UI.dialog(3,'Уважаемый, охрана уже ругается. Резину поменяем, а тренировку продолжай на трассе.',[['ПОНЯЛ',()=>{}]]);}
  }else document.getElementById('serviceBtn').hidden=true;
 },
 npcDialogue(n){UI.dialog(n.special?Social.portrait(n.person||n.car.id):{name:n.displayName||'Водитель',image:'assets/social/npc-'+(n.avatar||0)+'.webp'},'Эй, мою траекторию вместе с бампером забрал! Как решим?',[['ИЗВИНИТЬСЯ',()=>{Save.state.respect+=2;Save.persist();}],['ОТВЕТИТЬ РЕЗКО',()=>{if(selectedMapId==='quarry'){n.wait=0;n.retaliateUntil=this.frame+180;UI.toast('Он решил вернуть один удар');}else{trainingScore+=1500;UI.toast('Шум привлёк внимание полиции');}}]]);},
 service(){if(gamePaused||currentMap.id!=='wheel'||Math.hypot(car.vx,car.vy)>=1||Math.hypot(car.x-W*.355,car.y-H*.183)>230)return;UI.dialog(3,'Кирилл Доктор: свежая резина — свежая траектория. Первая помощь за счёт мастерской.',[['ЗАМЕНИТЬ ШИНЫ',()=>{Save.state.tires=100;Save.persist();UI.toast('Шины: 100%');}]]);},
 draw(g){for(const n of this.npcs)if(Math.abs(n.x-car.x)<innerWidth/SCALE/2+200&&Math.abs(n.y-car.y)<innerHeight/SCALE/2+200)Vehicles.drawVehicle(g,n,n.car);for(const p of this.cops){Vehicles.drawVehicle(g,p,{police:p.level});g.fillStyle=this.frame%20<10?'#328cff':'#ff4656';g.fillRect(p.x-10,p.y-10,20,8);}if(false){g.strokeStyle='#f34343';g.lineWidth=8;g.beginPath();g.arc(W*.355,H*.183,100,0,Math.PI*2);g.stroke();g.fillStyle='#fff';g.font='30px monospace';g.fillText('ШИНОМОНТАЖ',W*.355-90,H*.183-115);}}
};

