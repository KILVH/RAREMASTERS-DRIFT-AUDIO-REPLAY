/* Optional interactive lessons use the existing dialogs, screens and Save. */
const Guide={active:false,index:0,ticks:0,phase:'',
 init(){Save.state.guide??={offered:!Save.state.tutorial,complete:false,citySeen:false};if(!Save.state.guide.offered){Save.state.guide.offered=true;Save.persist();UI.dialog(1,'Я Ваня. Покажем с Серым, как поймать занос и освоиться в игре?',[['ПРОЙТИ ОБУЧЕНИЕ',()=>this.start()],['ПРОПУСТИТЬ',()=>{Save.state.tutorial=false;Save.persist();}]]);}document.getElementById('miniMap').addEventListener('click',e=>{if(selectedMode!=='city')return;const rect=e.currentTarget.getBoundingClientRect(),z=Math.min(rect.width/W,rect.height/H),x=(e.clientX-rect.left-(rect.width-W*z)/2)/z,y=(e.clientY-rect.top-(rect.height-H*z)/2)/z,p=City.places.find(p=>Math.hypot(p.x-x,p.y-y)*z<18);if(p)this.describe(p);});},
 async start(){if(Pursuit.active()){UI.toast('Сначала закончи погоню, затем начни обучение в настройках');return;}this.stop();this.active=true;this.phase='drive';this.index=0;this.ticks=0;this.starting=true;try{await Game.start('green','training');}finally{this.starting=false;}if(!gameRunning){this.stop();return;}World.npcs=[];Traffic.trainingLimit=0;this.prompt();},
 lessons:[['Ваня','Удерживай ГАЗ и разгонись.','gas'],['Серый','Не отпуская газ, немного поверни. Почувствуй реакцию машины.','right'],['Ваня','Газ + поворот, затем коротко нажми РУЧНИК.','handbrake'],['Серый','Отпусти ручник, оставь газ и управляй заносом рулём.','gas'],['Ваня','Контрруление уменьшает угол. Потом отпусти газ: машина успокоится.','left']],
 prompt(){this.remove();if(!this.active)return;const lesson=this.lessons[this.index],box=UI.el('div',{id:'guideCoach',className:'guide-coach'});box.append(UI.el('b',{},lesson[0]+' · '+(this.index+1)+'/5'),UI.el('p',{},lesson[1]),UI.el('button',{onclick:()=>this.next()},'ПРОПУСТИТЬ ШАГ'),UI.el('button',{onclick:()=>this.stop()},'ЗАКРЫТЬ'));document.body.append(box);document.getElementById(lesson[2]).classList.add('guide-highlight');},
 update(){if(!this.active||this.phase!=='drive'||gamePaused)return;const speed=Math.hypot(car.vx,car.vy),angle=Math.abs(Dynamics.wrap(car.angle-Math.atan2(car.vy,car.vx)));let ok=false;
 if(this.index===0)ok=keys.ArrowUp&&speed>2.5;
 if(this.index===1)ok=(keys.ArrowLeft||keys.ArrowRight)&&speed>2;
 if(this.index===2)ok=keys[' ']&&speed>2&&Math.abs(car.steer||0)>.2;
 if(this.index===3)ok=!keys[' ']&&keys.ArrowUp&&angle>.25;
 if(this.index===4)ok=!keys.ArrowUp&&speed<.5;
 this.ticks=ok?this.ticks+1:0;if(this.ticks> (this.index===2?2:25))this.next();},
 next(){this.ticks=0;this.index++;if(this.index<this.lessons.length){this.prompt();return;}World.npcs=[];Traffic.trainingReset();this.remove();this.phase='features';this.index=0;this.feature();},
 features:[
 ['ГАРАЖ','Ваня','Здесь выбираешь машину, окраску, диски и обвес. Дрифт приносит деньги на покупки.',()=>UI.garage(false)],
 ['ГОРОД','Серый','Шинка восстанавливает шины, автосалон продаёт машины. LOUD SOUND продаёт автозвук, AR DRIVE его устанавливает.',()=>Game.start('wheel','city')],
 ['ДОСТИЖЕНИЯ','Ваня','Выполняй условия, получай награды. Бонусная машина сначала открывается достижением, затем покупается.',()=>UI.achievements()],
 ['РЕЙТИНГ','Серый','Сохрани завершённое соревнование с ником. Здесь твои результаты и записи ghost.',()=>UI.leaderboard()],
 ['DOLBOGRAM','Ваня','Публикуй кадры и заезды, меняй одежду, набирай подписчиков. С 5000 можно вызвать Борща и Хаслера.',()=>Social.open()],
 ['МУЗЫКА','Серый','В городе купи STANDARD (20 треков) или PRO (все треки), затем оплати установку в AR DRIVE. Здесь выбирай трек, PLAY, PAUSE и RANDOM.',()=>UI.music()]
 ],
 feature(){const f=this.features[this.index];if(!f){Save.state.guide.complete=true;Save.state.tutorial=false;Save.persist();this.stop();UI.toast('Обучение завершено. Вернуться к нему можно в настройках.');return;}const root=UI.panel('ОСВАИВАЕМ ИГРУ');root.append(UI.el('h2',{},f[1]),UI.el('p',{},f[2]),UI.el('button',{className:'primary',onclick:async()=>{await f[3]();this.remove();const box=UI.el('div',{id:'guideCoach',className:'guide-coach feature-coach'});box.append(UI.el('p',{},f[1]+': '+f[2]),UI.el('button',{onclick:()=>{this.remove();this.index++;this.feature();}},'ДАЛЬШЕ'),UI.el('button',{onclick:()=>this.stop()},'ЗАКРЫТЬ ОБУЧЕНИЕ'));document.body.append(box);}},'ОТКРЫТЬ '+f[0]),UI.el('button',{onclick:()=>this.stop()},'ЗАКРЫТЬ ОБУЧЕНИЕ'));},
 remove(){document.getElementById('guideCoach')?.remove();document.querySelectorAll('.guide-highlight').forEach(e=>e.classList.remove('guide-highlight'));},
 stop(){const restore=this.active&&this.phase==='drive'&&gameRunning&&selectedMode==='training';this.remove();this.active=false;this.phase='';if(restore){World.npcs=[];Traffic.trainingReset();}},
 cityIntro(){if(this.active||Save.state.guide?.citySeen)return;Save.state.guide??={offered:true};Save.state.guide.citySeen=true;Save.persist();UI.dialog(1,'Это город. Здесь шиномонтаж, гараж, автосалон и автозвук. Нажми на точку миникарты или открой МЕСТА.',[['ПОКАЗАТЬ МЕСТА',()=>this.cityPlaces()],['ОСМОТРЮСЬ САМ',()=>{}]]);},
 cityPlaces(){if(selectedMode!=='city')return;const root=UI.panel('ГОРОД · МЕСТА');for(const p of City.places)root.append(UI.el('button',{onclick:()=>this.describe(p)},p.name));},
 describe(p){const text={tires:'Серый: здесь меняют шины. Можно оплатить сервис или договориться за story.',garage:'Ваня: твои машины и купленные детали. Меняй образ автомобиля.',dealer:'Ваня: покупай новые автомобили за заработанные деньги. Для бонусных нужны достижения.',audio:'Серый: STANDARD — 10 000 ₽, PRO — 50 000 ₽. После покупки нужна установка в AR DRIVE.',install:'Серый: установка купленной системы — 10 000 ₽. Затем музыка доступна через кнопку МУЗЫКА.'};UI.dialog(6,text[p.action],[['ОТМЕТИТЬ НА КАРТЕ',()=>{City.destination=p;UI.closePanel();UI.toast('Цель: '+p.name+'. Остановись у отмеченного места.');}],['НАЗАД',()=>this.cityPlaces()]]);}
};
Guide.init();
