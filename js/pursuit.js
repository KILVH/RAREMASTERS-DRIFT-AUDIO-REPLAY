/* Pursuit state, unbanked street rewards and impound records share one save. */
const Pursuit={phase:'idle',capture:0,lost:0,scoreBase:0,pending:0,serial:0,
 init(){const s=Save.state;s.impound??={};s.policeStats??={escapes:0,bribes:0,impounds:0,fines:0};s.social??={followers:0,attention:0,posts:[],relations:{}};this.refresh();},
 refresh(){const s=Save.state;delete s.impound.baseline;for(const [id,record] of Object.entries(s.impound))if(record.until<=Date.now())delete s.impound[id];if(!s.owned.includes('baseline'))s.owned.unshift('baseline');if(s.impound[s.selected])s.selected='baseline';},
 available(id){this.refresh();return !Save.state.impound[id];},
 value(id){return Math.max(10000,CATALOG.cars.find(c=>c.id===id)?.price||0);},
 costs(id=Save.state.selected){const recovery=Math.ceil(this.value(id)*.3);return{recovery,bribe:1500,fine:3000};},
 reset(){if(typeof Social!=='undefined')Social.decay();this.phase='idle';this.capture=this.lost=this.pending=this.scoreBase=0;this.serial++;this.lastSeen=null;this.refresh();},
 addPoints(points){if(selectedMode==='illegal'){this.pending+=points;}else Economy.earn(points);},
 bank(){if(this.pending>=1000)Social.run(this.pending);if(this.pending>0)Economy.earn(this.pending);this.pending=0;Save.persist();},
 forfeit(){this.pending=0;},
 active(){return this.phase==='chase'||this.phase==='search'||this.phase==='caught';},
 release(){World.cops=[];World.heat=0;World.grace=1800;this.phase='idle';this.capture=this.lost=0;this.scoreBase=trainingScore;police=null;},
 update(){if(selectedMode!=='illegal'||selectedMapId==='quarry'){World.heat=0;return;}
  const attention=Math.min(100,Math.max(0,Save.state.social.attention||0)),score=(trainingScore-this.scoreBase)*(1+attention/150),heat=World.grace?0:[1500,5000,12000,25000,45000].filter(t=>score>=t).length;
  if(this.phase==='idle'&&heat){this.phase='chase';UI.toast('ПОГОНЯ: оторвись на достаточное расстояние и скрывайся 10 секунд');}
  if(!this.active()||this.phase==='caught')return;World.heat=Math.max(1,heat);
  const maxCops=Save.state.settings.quality==='low'?3:5;while(World.cops.length<Math.min(World.heat,maxCops)){const level=World.cops.length+1;World.cops.push({...World.spawn(car,650),level,navPhase:(level*17)%90});}
  let nearest=Infinity,holding=false,visible=false;const speed=Math.hypot(car.vx,car.vy);
  for(const p of World.cops){const distance=Math.hypot(p.x-car.x,p.y-car.y);nearest=Math.min(nearest,distance);if(World.frame%6===0||p.canSee===undefined){p.canSee=distance<900+attention*3;for(let i=1;p.canSee&&i<16;i++)if(surfaceAt(p.x+(car.x-p.x)*i/16,p.y+(car.y-p.y)*i/16)==='wall')p.canSee=false;}if(p.canSee){visible=true;this.lastSeen={x:car.x,y:car.y};}
   // Alternate direct pursuit and intercepting the road ahead; slow near a stopped car.
   const lead=p.level%2?12:38,target={x:car.x+car.vx*lead,y:car.y+car.vy*lead};const reachable=!p.canSee&&this.lastSeen?this.lastSeen:World.safe(target.x,target.y,car.angle)?target:car;
   const standOff=carH()*1.5;
   p.separateTicks=Math.max(0,(p.separateTicks||0)-1);
   if(p.separateTicks||distance<standOff&&speed<3){
    // Give the player room: back away instead of applying pressure against a wall.
    const dx=p.x-car.x,dy=p.y-car.y,d=Math.hypot(dx,dy)||1;
    if(distance<standOff){const x=p.x+dx/d*2,y=p.y+dy/d*2;if(World.safe(x,y,p.angle)){p.x=x;p.y=y;}}
    p.vx=p.vy=0;
   }else{const pursuitSpeed=Math.min(Math.min(13,7+p.level*.7+speed*.18),Math.max(speed,(distance-standOff)*.08));World.move(p,Navigation.steer(p,reachable),pursuitSpeed);}
   if(World.contact(car,p)&&!p.separateTicks){World.resolve(car,p);Replay.hits++;p.separateTicks=60;}

   if(distance<carH()*1.65&&speed<3)holding=true;
  }
  this.capture=holding?Math.min(240,this.capture+1):Math.max(0,this.capture-3);
  const hidden=!visible&&nearest>carH()*2.5;this.lost=hidden?this.lost+1:Math.max(0,this.lost-3);this.phase=hidden?'search':'chase';
  if(this.capture>=240)this.arrest();else if(this.lost>=600)this.escape();
 },
 escape(){if(!this.active())return;this.bank();Save.state.money-=1000;Save.state.respect+=25;Save.state.policeStats.escapes++;this.release();Economy.check();UI.toast('УШЁЛ ОТ ПОГОНИ · ШТРАФ 1 000 ₽');},
 arrest(){if(this.phase==='caught')return;this.phase='caught';this.capture=240;this.officer=Math.random()<.5?7:8;const id=Save.state.selected,cost=this.costs(id);const choices=[];
  if(Save.state.money>=cost.bribe)choices.push(['НА ХОД НОГИ · '+cost.bribe+' ₽',()=>this.bribe(id)]);
  choices.push(['ШТРАФ · '+cost.fine+' ₽',()=>this.fine(id)]);
  UI.dialog(this.officer,'Задержание. На ход ноги: '+cost.bribe+' ₽ (только при достаточном балансе). По игровому постановлению 12.5.1: штраф '+cost.fine+' ₽, даже в минус. '+(id==='baseline'?'Стартовая машина остаётся у тебя.':'Машина на штрафстоянке 3 часа либо возврат за '+cost.recovery+' ₽ отдельно от штрафа.'),choices,true);
 },
 bribe(id){if(this.phase!=='caught')return false;const cost=this.costs(id);if(Save.state.money<cost.bribe){this.phase='chase';this.arrest();return false;}Save.state.money-=cost.bribe;Save.state.policeStats.bribes++;this.forfeit();this.release();Economy.check();UI.toast('Отпустили. Награда незавершённой уличной сессии потеряна.');return true;},
 fine(id){if(this.phase!=='caught')return false;const s=Save.state,cost=this.costs(id);s.money-=cost.fine;s.policeStats.fines++;if(id!=='baseline'){s.impound[id]={until:Date.now()+3*60*60*1000,cost:cost.recovery};s.policeStats.impounds++;s.selected='baseline';}this.forfeit();this.release();Economy.check();leaveGame();UI.garage(false);return true;},
 recover(id){const record=Save.state.impound[id];if(!record)return true;if(record.until<=Date.now()){delete Save.state.impound[id];Save.persist();return true;}if(Save.state.money<record.cost)return false;Save.state.money-=record.cost;delete Save.state.impound[id];Save.persist();return true;},
 exit(done){if(this.active()){UI.dialog(8,'Ты всё ещё в розыске. Оторвись от полиции, чтобы сохранить награду. При выходе сейчас очки и деньги этой уличной сессии потеряются.',[['ПРОДОЛЖИТЬ ПОГОНЮ',()=>{}],['ВЫЙТИ БЕЗ НАГРАДЫ',()=>{this.forfeit();this.release();done();}]]);return;}const event=this.pending>=1000;this.bank();const trainingEvent=selectedMode==='training'?Social.run(trainingScore):null;done();if(trainingEvent)Social.offer(trainingEvent);else if(event)Social.offer(Save.state.social.drafts[0]);},
 status(){return this.active()?(this.phase==='search'?'ПОИСК '+Math.ceil((600-this.lost)/60)+' с':'ПОГОНЯ')+' · ЗАДЕРЖАНИЕ '+Math.round(this.capture/240*100)+'%':'';}
};
Pursuit.init();
for(const [id,name,field] of [['escape','Не уехал на эвакуаторе','escapes'],['bribe','На ход ноги','bribes'],['impound','12.5.1','impounds']])Achievements.push({id,name,goal:1,value:s=>s.policeStats?.[field]||0,reward:field==='escapes'?1000:0});
