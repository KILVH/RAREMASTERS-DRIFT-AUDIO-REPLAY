/* 60 Hz arcade model: velocity has its own heading; rear traction controls how it follows the body. */
const Dynamics={
 driftSpeed:3,driftAngle:18,
 clamp(x,a,b){return Math.max(a,Math.min(b,x));},
 wrap(a){return Math.atan2(Math.sin(a),Math.cos(a));},
 maximum(stats,base=10){return (5.5+this.clamp((stats.topSpeed||.82)-.82,0,.4)*3.2)*Math.min(1.08,base/10);},
 step(v,input,stats,surface,baseAccel=.13,baseMax=10){
  const gas=input.throttle??(input.ArrowUp?1:0),brake=!!input.ArrowDown,hand=!!input[' '],steer=input.steer??((input.ArrowRight?1:0)-(input.ArrowLeft?1:0));
  let speed=Math.hypot(v.vx,v.vy),heading=speed>.01?Math.atan2(v.vy,v.vx):v.angle;
  const forward=v.vx*Math.cos(v.angle)+v.vy*Math.sin(v.angle),reverse=forward<-.1&&!gas;
  v.steer=(v.steer||0)+(steer-(v.steer||0))*.22;
  v.throttle=(v.throttle||0)+(gas-(v.throttle||0))*.13;
  const slip=this.wrap(v.angle-heading),moving=speed>2;
  // A tap initiates. Throttle and existing lateral momentum sustain the slide afterwards.
  if(moving&&(hand||gas&&Math.abs(v.steer)>.3))v.driftMemory=60;
  else v.driftMemory=Math.max(0,(v.driftMemory||0)-1);
  const target=moving&&(v.driftMemory>0||gas&&Math.abs(slip)>.18)?1:0;
  v.drift=(v.drift||0)+(target-(v.drift||0))*(target?hand?.35:.09:gas?.022:.04);
  const accel=.055*this.clamp(stats.acceleration||1,.85,1.65)/Math.sqrt(stats.weight||1)*(surface==='shoulder'?.6:1);
  if(brake&&!gas){if(!reverse&&speed>.15)speed=Math.max(0,speed-.13*(stats.brake||1));else{speed=Math.min(2.2,speed+.045);heading=v.angle+Math.PI;}}
  else if(gas){if(forward<-.1){speed=Math.max(0,speed-.13);if(speed<.15)heading=v.angle;}else speed+=accel*v.throttle;}
  speed=Math.max(0,speed-(gas?.008:.026)-(hand?.014:0));
  if(surface==='shoulder')speed*=.98;
  const yawTarget=v.steer*(.022+Math.min(speed,7)*.0018)*this.clamp(stats.steering||1,.9,1.18)*Math.min(1,speed/1.5)*(reverse?-1:1)*(hand?1.2:1);
  v.yaw=(v.yaw||0)+(yawTarget-(v.yaw||0))*.26;
  // Bound excess angle instead of repeatedly deleting lateral velocity.
  let yaw=v.yaw;if(!reverse&&Math.abs(slip)>.95&&Math.sign(yaw)===Math.sign(slip))yaw*=.22;
  if(!steer&&!hand&&!reverse)yaw-=slip*(gas?.004:.018)*Math.min(1,speed/2);
  v.angle+=yaw;
  const traction=(.17*(stats.grip||1))*(1-v.drift)+.0245*v.drift;
  if(!reverse)heading+=this.wrap(v.angle-heading)*traction;
  speed=Math.min(speed,this.maximum(stats,baseMax));
  if(!gas&&!brake&&speed<.04){speed=0;v.yaw=0;v.drift=0;}
  v.vx=Math.cos(heading)*speed;v.vy=Math.sin(heading)*speed;
  v.lateral=-v.vx*Math.sin(v.angle)+v.vy*Math.cos(v.angle);
  return speed;
 },
 drive(v,target,wanted,slip=0,skill=1){
  const speed=Math.hypot(v.vx,v.vy),aim=Math.atan2(target.y-v.y,target.x-v.x),desired=Math.min(wanted,this.maximum(v.car?.stats||{},10));
  v.drift=(v.drift||0)+(Math.min(1,Math.abs(slip)/.45)-(v.drift||0))*.09;
  const bodyTarget=aim+slip,rotation=this.wrap(bodyTarget-v.angle);v.yaw=(v.yaw||0)+(this.clamp(rotation*.2,-.045,.045)-(v.yaw||0))*.3;v.angle+=v.yaw;
  const c=Math.cos(v.angle),sn=Math.sin(v.angle),lateral=-v.vx*sn+v.vy*c;
  // Real tire force depends on drift state. Momentum and engine thrust affect the path.
  const tire=lateral*(.09*(1-v.drift)+.008*v.drift),thrust=speed<desired?.018:0;
  v.vx+=sn*tire+c*thrust;v.vy-=c*tire-sn*thrust;
  const ax=Math.cos(aim)*desired-v.vx,ay=Math.sin(aim)*desired-v.vy,force=Math.hypot(ax,ay),limit=.35*skill;
  if(force){const k=Math.min(1,limit/force);const forward=ax*c+ay*sn,side=(-ax*sn+ay*c)*(1-.25*v.drift);v.vx+=(forward*c-side*sn)*k;v.vy+=(forward*sn+side*c)*k;}
  v.lateral=-v.vx*sn+v.vy*c;return Math.hypot(v.vx,v.vy);
 }
};
