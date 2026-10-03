const AudioPlayer={music:new Audio(),requested:false,
 init(){this.music.preload='none';this.music.addEventListener('ended',()=>this.shuffleMode?this.random():this.next(1));this.select(Save.state.settings.track||0,false);document.addEventListener('visibilitychange',()=>{if(document.hidden){this.pause();this.stopGame();}});},
 select(i,play=true){const s=Save.state.settings,tracks=Economy.audioTracks();if(!tracks.length){this.pause();return false;}s.track=tracks.includes(i)?i:tracks[0];this.music.src=CATALOG.music[s.track];this.music.volume=s.master===false?0:s.volume;Save.persist();if(play&&s.music)this.play();return true;},
 play(){if(Save.state.settings.master===false||!this.requested||!Save.state.settings.music||document.hidden||!Economy.audioTracks().length)return;const epoch=this.musicEpoch||0;this.music.play().then(()=>{if(epoch!==(this.musicEpoch||0)||!this.requested||document.hidden)this.music.pause();}).catch(()=>{});},
 pause(){this.musicEpoch=(this.musicEpoch||0)+1;this.requested=false;this.music.pause();},
 next(d){this.shuffleMode=false;const tracks=Economy.audioTracks();if(!tracks.length)return;const at=Math.max(0,tracks.indexOf(Save.state.settings.track));this.select(tracks[(at+d+tracks.length)%tracks.length]);window.UI?.renderMusic?.();},
 random(){this.shuffleMode=true;const available=Economy.audioTracks(),current=Save.state.settings.track;if(!available.length)return;this.shuffle=(this.shuffle||[]).filter(i=>available.includes(i)&&i!==current);if(!this.shuffle.length){this.shuffle=available.filter(i=>i!==current);for(let i=this.shuffle.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.shuffle[i],this.shuffle[j]]=[this.shuffle[j],this.shuffle[i]];}}this.select(this.shuffle.pop()??current);window.UI?.renderMusic?.();},
 impact(){AudioManager.impact();},
 setMusic(on){if(on&&!Economy.audioTracks().length){window.UI?.toast('Купи аудиосистему в LOUD SOUND и установи в AR DRIVE');return false;}Save.state.settings.music=on;this.requested=on;if(on){this.select(Save.state.settings.track,false);this.play();}else this.pause();Save.persist();return true;},
 stopGame(){AudioManager.stop();},
 update(){AudioManager.update();}
};
AudioPlayer.init();setInterval(()=>AudioPlayer.update(),100);
