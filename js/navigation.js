/* Navigation edges are validated once per map, then shared by all drivers. */
const Navigation={step:65,nodes:[],cols:0,rows:0,ready:false,cache:new Map(),directions:[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]],
 build(){
  const key=[selectedMapId,W,H,this.step,carH()].join(':');const cached=this.cache.get(key);
  if(cached){Object.assign(this,cached);this.ready=true;return;}
  this.cols=Math.ceil(W/this.step);this.rows=Math.ceil(H/this.step);this.nodes=new Uint8Array(this.cols*this.rows);this.edges=new Int8Array(this.nodes.length*8).fill(-1);
  const radius=selectedMapId==='isakiy'?carH()*.42:carW()*.65;
  for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){let clear=true;for(let i=0;i<8;i++){const a=i*Math.PI/4;if(surfaceAt((x+.5)*this.step+Math.cos(a)*radius,(y+.5)*this.step+Math.sin(a)*radius)!=='road'){clear=false;break;}}this.nodes[y*this.cols+x]=clear?1:0;}
  this.ready=true;this.cache.set(key,{nodes:this.nodes,edges:this.edges,cols:this.cols,rows:this.rows});if(this.cache.size>3)this.cache.delete(this.cache.keys().next().value);
 },
 point(i){return{x:(i%this.cols+.5)*this.step,y:(Math.floor(i/this.cols)+.5)*this.step};},
 nearest(p){let best=-1,d=Infinity;const px=Math.floor(p.x/this.step),py=Math.floor(p.y/this.step);for(let radius=0;radius<Math.max(this.cols,this.rows);radius++){for(let y=Math.max(0,py-radius);y<=Math.min(this.rows-1,py+radius);y++)for(let x=Math.max(0,px-radius);x<=Math.min(this.cols-1,px+radius);x++){if(radius&&Math.abs(x-px)!==radius&&Math.abs(y-py)!==radius)continue;const i=y*this.cols+x;if(this.nodes[i]){const n=((x+.5)*this.step-p.x)**2+((y+.5)*this.step-p.y)**2;if(n<d){d=n;best=i;}}}if(best>=0&&radius*this.step>Math.sqrt(d)+this.step)return best;}return best;},
 edge(cur,k){const index=cur*8+k;if(this.edges[index]>=0)return this.edges[index]===1;const x=cur%this.cols,y=Math.floor(cur/this.cols),[dx,dy]=this.directions[k],nx=x+dx,ny=y+dy,n=ny*this.cols+nx;
  let clear=nx>=0&&ny>=0&&nx<this.cols&&ny<this.rows&&!!this.nodes[n];if(clear&&dx&&dy)clear=!!this.nodes[y*this.cols+nx]&&!!this.nodes[ny*this.cols+x];
  if(clear){const a=this.point(cur);for(const t of [.25,.5,.75])for(const angle of [Math.atan2(dy,dx)])if(!World.safe(a.x+dx*this.step*t,a.y+dy*this.step*t,angle)){clear=false;break;}}
  this.edges[index]=clear?1:0;return clear;
 },
 path(from,to){if(!this.ready)this.build();const start=this.nearest(from),end=this.nearest(to);if(start<0||end<0)return[];if(this.queue?.length!==this.nodes.length){this.queue=new Int32Array(this.nodes.length);this.prev=new Int32Array(this.nodes.length);}const queue=this.queue,prev=this.prev;prev.fill(-1);queue[0]=start;let count=1;prev[start]=start;
  for(let at=0;at<count;at++){const cur=queue[at];if(cur===end)break;for(let k=0;k<8;k++){const [dx,dy]=this.directions[k],n=cur+dy*this.cols+dx;if(n<0||n>=prev.length||prev[n]!==-1||!this.edge(cur,k))continue;prev[n]=cur;queue[count++]=n;}}
  if(prev[end]===-1)return[];const path=[];for(let cur=end;cur!==start;cur=prev[cur])path.push(this.point(cur));return path.reverse();
 },
 steer(v,target){if(!target)return v;v.navPhase??=World.frame%90;if(!v.navPath||World.frame%90===v.navPhase)v.navPath=this.path(v,target);while(v.navPath.length&&Math.hypot(v.navPath[0].x-v.x,v.navPath[0].y-v.y)<this.step*.65)v.navPath.shift();return v.navPath[0]||target;}
};

