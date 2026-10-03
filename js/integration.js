/* Integration retains the competition formula; Dynamics owns vehicle handling. */
const baseline={updateCar,draw,resetCar,finishCompetition,leaveGame,spawnPosition,acceleration,maxSpeed,updateHud,updateCompetition};
const Game={loading:false,
 async start(id,mode,ghost=null){if(this.loading)return;if(Guide.active&&Guide.phase==='drive'&&!Guide.starting)Guide.stop();Controls.clear();this.loading=true;AudioPlayer.stopGame();gameRunning=false;window.gameRunning=false;gamePaused=true;keys={};document.getElementById('rmDialog').style.display='none';document.getElementById('serviceBtn').hidden=true;Replay.ghost=null;try{Pursuit.refresh();if(!MAPS[id])throw new Error('Неизвестная трасса');if(!MAPS[id].route||mode==='illegal'||mode==='city')Tracks.direction='forward';if(mode==='competition'){const saved=ghost||(await Save.list(id,Tracks.direction,'competition'))[0];Replay.ghost=saved?await Save.get(saved.id):null;}
  selectedMapId=id;selectedMode=mode;gameType=(mode==='illegal'||mode==='city')?'illegal':'legal';window.gameType=gameType;
  await Promise.all([loadMap(id),AudioManager.prepare()]);await Promise.allSettled([...CATALOG.cars.map(c=>Vehicles.sprite(c)),...Array.from({length:5},(_,i)=>Vehicles.sprite({police:i+1})),Vehicles.sprite(Vehicles.current(),Save.state.custom[Save.state.selected]||{})].map(im=>im.assetReady||im.decode?.()));Tracks.markers();resetCar();await NpcReplay.load();showScreen('game');canvas.classList.add('active');document.getElementById('controls').style.display='flex';document.getElementById('topGameBtns').style.display='flex';document.getElementById('rmStatus').hidden=false;document.getElementById('miniMap').hidden=false;
   if(currentMap.splashes?.length)await showSplashes();gameRunning=true;window.gameRunning=true;gamePaused=false;
   if(mode==='city')Guide.cityIntro();
  }catch(e){gameRunning=false;UI.home();UI.toast('Не удалось загрузить трассу: '+e.message);}finally{this.loading=false;}
 }
};
showLegalMenu=()=>UI.tracks('legal');showIllegalMenu=()=>UI.tracks('illegal');
startLegal=m=>Game.start('isakiy',m);startIllegal=()=>Game.start('autodrom','illegal');
// Route the legacy threshold event into the bounded multi-car pursuit system.
resetPolice=function(){};
spawnPosition=function(type='player'){if(Tracks.usesRoute()&&type==='player')return{x:markers.spawns[0].cx,y:markers.spawns[0].cy,angle:Tracks.spawnAngle};return baseline.spawnPosition(type);};
resetCar=function(){NpcReplay.record=null;NpcReplay.last=null;AudioPlayer.stopGame();window.clearDrivingControls?.();keys={};baseline.resetCar();if(Tracks.usesRoute())car.angle=Tracks.spawnAngle;if(Replay.ghost?.frames?.length&&selectedMode!=='competition'){const f=Replay.ghost.frames[0];car.x=f[0];car.y=f[1];car.angle=f[2];}policeContactTimer=0;Tandem.reset();Replay.reset();World.reset();City.reset();if(!['isakiy','autodrom','green'].includes(selectedMapId)&&!World.safe(car.x,car.y,car.angle)){if(!Navigation.ready)Navigation.build();const i=Navigation.nearest(car);if(i>=0)Object.assign(car,Navigation.point(i));}Game.lastSafe={...car};};
acceleration=function(){return baseline.acceleration()*Vehicles.current().stats.acceleration;};
maxSpeed=function(){return Dynamics.maximum(Vehicles.current().stats,baseline.maxSpeed());};
updateCar=function(){if(gamePaused)return;const c=Vehicles.current(),s=c.stats;const before={x:car.x,y:car.y,angle:car.angle,vx:car.vx,vy:car.vy};
 // Multi-vehicle chase supersedes only the broken original single-police branch.
 police=null;baseline.updateCar();police=null;
 if(Save.state.tires<=0&&gameType==='illegal'){car.vx*=.97;car.vy*=.97;}
 const impact=Math.hypot(before.vx,before.vy)>1&&Math.hypot(car.x-before.x,car.y-before.y)<.1;if(impact){Replay.hits++;AudioPlayer.impact();}
 if(!collides(car.x,car.y)){Game.lastSafe={x:car.x,y:car.y,angle:car.angle};}else{car.angle=before.angle;if(collides(car.x,car.y)&&Game.lastSafe){Object.assign(car,Game.lastSafe);car.vx=car.vy=car.yaw=0;}}
 if(gamePaused)return;World.update();City.update();Replay.sample();NpcReplay.sample();Tandem.update();Guide.update();
};
finishCompetition=function(){if(!Tandem.active)NpcReplay.sample();if(Tandem.result())return;baseline.finishCompetition();AudioPlayer.stopGame();if(car)Replay.frames.push([car.x,car.y,car.angle,car.vx,car.vy]);Replay.prepare();Tandem.offer(comp.score);};
const originalInvalid= invalidateCompetition;invalidateCompetition=function(reason){if(Tandem.active){comp.invalid=true;comp.finished=true;comp.score=0;Tandem.result();return;}originalInvalid(reason);AudioPlayer.stopGame();};
leaveGame=function(){Pursuit.exit(()=>{Guide.stop();Controls.clear();Save.persist();baseline.leaveGame();DevMode.update();AudioPlayer.stopGame();Tandem.reset();document.getElementById('rmStatus').hidden=true;document.getElementById('miniMap').hidden=true;document.getElementById('serviceBtn').hidden=true;UI.balance();keys={};});};
draw=function(){Runtime.camera();
 // Use baseline camera and rendering; replace only the selected car image.
 const old=carImg;const conf=Save.state.custom[Save.state.selected]||{};if(Vehicles.current().id!=='baseline'||Object.keys(conf).length)carImg=Vehicles.sprite(Vehicles.current(),conf);baseline.draw();carImg=old;
 const z=SCALE*(gameType==='illegal'?CAMERA_ZOOM_ILLEGAL:CAMERA_ZOOM_LEGAL);ctx.save();ctx.scale(z,z);ctx.translate(-camera.x,-camera.y);World.draw(ctx);City.draw(ctx);Replay.draw(ctx);NpcReplay.debugDraw(ctx);ctx.restore();UI.minimap();
};
updateHud=function(){baseline.updateHud();DevMode.update();if(UI.placesButton)UI.placesButton.hidden=selectedMode!=='city';const ghostButton=UI.ghostButton;if(ghostButton){ghostButton.hidden=selectedMode!=='competition';ghostButton.textContent='GHOST '+(Replay.enabled?'ON':'OFF');}setHudText('rmStatus',`${Math.floor(Save.state.money)} ₽ · ШИНЫ ${Math.ceil(Save.state.tires)}%${selectedMode==='illegal'?' · '+(Pursuit.status()||'HEAT '+World.heat+'/5')+' · В СЕССИИ '+Math.floor(Pursuit.pending/20)+' ₽':''} · ТРЕК ${Save.state.settings.track+1}`);
 if(comp?.startCrossed&&!comp.finished){let q=0;for(const v of comp.clippingQuality.values())q+=v;const line=Math.max(0,q/Math.max(1,markers.clipping.length)*40-shoulderPenalty),angle=Math.max(0,Math.min(40,((comp.avgAngle/Math.max(1,comp.angleSamples))-20)/30*40));setHudText('compScore',`${Math.round(line+angle)} + STYLE`);setHudText('compDetails',`${comp.elapsed.toFixed(1)} с · x${driftMultiplier.toFixed(1)}`);}
};
// Direction gating and clipping sequence apply to new configurations only.
updateCompetition=function(speed,angle,ox,oy,nx,ny){if(!currentMap.route)return baseline.updateCompetition(speed,angle,ox,oy,nx,ny);const was=comp?.startCrossed;
 const route=Tracks.activeRoute;
 if(!was){const dx=route[2].x-route[1].x,dy=route[2].y-route[1].y;if((nx-ox)*dx+(ny-oy)*dy<=0)return;}
 if(comp?.startCrossed){comp.routeGate??=2;const p=route[comp.routeGate];if(p&&Math.hypot(nx-p.x,ny-p.y)<Math.max(260,W*.045))comp.routeGate++;}
 const finish=markers.lines[1];if((comp?.routeGate||0)<route.length-2)markers.lines[1]=null;
 baseline.updateCompetition(speed,angle,ox,oy,nx,ny);markers.lines[1]=finish;
};
// Fixed 60 Hz simulation preserves original 60 fps tuning on 90/120 Hz phones.
const FrameMetrics={since:performance.now(),draws:0,steps:0,physics:0,render:0,worst:0,fps:0,physicsMs:0,renderMs:0,maxFrameMs:0,reset(){this.since=performance.now();this.draws=this.steps=this.physics=this.render=this.worst=0;}};
let fixedLast=performance.now(),fixedAccumulator=0;
gameLoop=function(now=performance.now()){const delta=now-fixedLast;fixedAccumulator+=Math.min(100,delta);fixedLast=now;const profile=typeof DevMode!=='undefined'&&DevMode.active&&DevMode.debug;if(gameRunning){const start=profile?performance.now():0;while(fixedAccumulator>=1000/60){updateCar();fixedAccumulator-=1000/60;if(profile)FrameMetrics.steps++;}if(profile){FrameMetrics.physics+=performance.now()-start;FrameMetrics.worst=Math.max(FrameMetrics.worst,delta);}const low=Save.state.settings.quality==='low'||Save.state.settings.quality==='auto'&&(navigator.hardwareConcurrency<=4||navigator.deviceMemory<=4);const interval=1000/(low?30:60);if(!this.drawAt||now-this.drawAt>=interval-1){const t=profile?performance.now():0;draw();this.drawAt=now;if(profile){FrameMetrics.draws++;FrameMetrics.render+=performance.now()-t;}}if(profile&&now-FrameMetrics.since>=1000){const m=FrameMetrics;m.fps=m.draws*1000/(now-m.since);m.physicsMs=m.physics/Math.max(1,m.steps);m.renderMs=m.render/Math.max(1,m.draws);m.maxFrameMs=m.worst;m.reset();}if(!this.hudAt||now-this.hudAt>100){updateHud();this.hudAt=now;}}else fixedAccumulator=0;requestAnimationFrame(gameLoop);};
setMobileCameraMultiplier(Save.state.settings.zoom||1);
const Controls={held:new Map(),active:new Map(),
 set(key,pointer,on){const set=this.held.get(key);if(!set)return;if(on)set.add(pointer);else set.delete(pointer);keys[key]=set.size>0;const id={'ArrowLeft':'left','ArrowRight':'right','ArrowUp':'gas','ArrowDown':'brake',' ':'handbrake'}[key];document.getElementById(id).classList.toggle('pressed',set.size>0);},
 release(pointer){for(const key of this.held.keys())this.set(key,pointer,false);this.active.delete(pointer);},
 bind(id,key){const el=document.getElementById(id);this.held.set(key,new Set());el.draggable=false;
 el.addEventListener('pointerdown',e=>{e.preventDefault();this.active.set(e.pointerId,{origin:key,key});this.set(key,e.pointerId,true);el.setPointerCapture(e.pointerId);},{passive:false});
 el.addEventListener('pointermove',e=>{const p=this.active.get(e.pointerId);if(!p||!['ArrowUp',' '].includes(p.origin))return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('button')?.id,next=target==='gas'?'ArrowUp':target==='handbrake'?' ':null;if(next!==p.key){if(p.key)this.set(p.key,e.pointerId,false);if(next)this.set(next,e.pointerId,true);p.key=next;}e.preventDefault();},{passive:false});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,e=>this.release(e.pointerId));
 },clear(){this.active.clear();for(const set of this.held.values())set.clear();keys={};document.querySelectorAll('.pressed').forEach(e=>e.classList.remove('pressed'));}
};
for(const [id,key] of [['left','ArrowLeft'],['right','ArrowRight'],['gas','ArrowUp'],['brake','ArrowDown'],['handbrake',' ']])Controls.bind(id,key);
window.clearDrivingControls=()=>Controls.clear();
for(const event of ['contextmenu','selectstart','dragstart'])document.addEventListener(event,e=>{if(e.target.closest?.('button,#controls,#topGameBtns'))e.preventDefault();},{capture:true});
addEventListener('blur',()=>Controls.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)Controls.clear();});
addEventListener('keydown',e=>{const k={w:'ArrowUp',s:'ArrowDown',a:'ArrowLeft',d:'ArrowRight'}[e.key.toLowerCase()];if(k&&e.target.tagName!=='INPUT')keys[k]=true;if(e.key==='Escape'&&gameRunning&&!gamePaused)UI.pause();});
addEventListener('keyup',e=>{const k={w:'ArrowUp',s:'ArrowDown',a:'ArrowLeft',d:'ArrowRight'}[e.key.toLowerCase()];if(k)keys[k]=false;});
addEventListener('blur',()=>{keys={};if(gameRunning&&!gamePaused)UI.pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys={};Save.persist();if(gameRunning&&!gamePaused)UI.pause();}});
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('PWA',e)));


// Outer zones are judged with the rear of the car; legacy clipping is unchanged.
const legacyClipDistance=pointDistanceToCar;
pointDistanceToCar=function(p){if(!p.zone)return legacyClipDistance(p);const rear={x:car.x-Math.cos(car.angle)*carH()*.45,y:car.y-Math.sin(car.angle)*carH()*.45};return pointToSegmentDistance(rear.x,rear.y,p.zone.a.x,p.zone.a.y,p.zone.b.x,p.zone.b.y);};
