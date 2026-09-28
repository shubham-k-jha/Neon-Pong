(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const arena = document.getElementById('arenaFrame');
  const $ = id => document.getElementById(id);
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const rand = (a,b) => a + Math.random()*(b-a);

  const defaults = { sound:true, music:false, particles:true, shake:true, trail:true, reducedMotion:false };
  let settings = {...defaults, ...load('neonPongSettings', {})};
  let records = {...{bestScore:0,bestRally:0,games:0,wins:0,losses:0}, ...load('neonPongStats', {})};

  const difficulty = {
    Easy:{speed:.35,reaction:115,accuracy:.62,error:70},
    Medium:{speed:.47,reaction:82,accuracy:.76,error:45},
    Hard:{speed:.60,reaction:58,accuracy:.88,error:24},
    Expert:{speed:.72,reaction:38,accuracy:.96,error:10}
  };
  const modeConfig = { Classic:{powerups:false,time:false}, 'Power-Up':{powerups:true,time:false}, 'Time Attack':{powerups:false,time:true} };

  const game = {
    state:'START', difficulty:'Medium', target:7, mode:'Classic', score:{player:0,ai:0}, rally:0, hits:0,
    startTime:0, pointStart:0, elapsed:0, frame:0, lastTime:0, raf:null, countdown:0, countdownTimer:null,
    w:0,h:0,dpr:1, playerX:.5, aiX:.5, ball:{x:.5,y:.5,vx:0,vy:0,r:.015,speed:0},
    playerWidth:.20, aiWidth:.20, particles:[], trail:[], powerups:[], activePower:null,
    aiTarget:.5, aiTimer:0, shake:0, pointFlash:0, toast:'', toastTimer:0,
    maxParticles:120, keys:{left:false,right:false}, pointerId:null, lastPointerX:null,
    stats:{longestRally:0,totalHits:0,playerHits:0,aiHits:0,playerAccuracy:0,maxSpeed:0}
  };

  function load(k,fallback){try{return JSON.parse(localStorage.getItem(k)) ?? fallback}catch{return fallback}}
  function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}

  function resize(){
    const rect=arena.getBoundingClientRect(); game.w=rect.width; game.h=rect.height; game.dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(game.w*game.dpr); canvas.height=Math.round(game.h*game.dpr); ctx.setTransform(game.dpr,0,0,game.dpr,0,0);
    game.playerWidth=clamp(game.w<600?.25:.20,.18,.28); game.aiWidth=game.playerWidth;
    game.ball.r=clamp(game.w/650,.009,.016); render();
  }

  function difficultyUI(){
    const group=$('difficultyGroup'); group.innerHTML=''; Object.keys(difficulty).forEach(name=>{const b=document.createElement('button');b.textContent=name;b.className=name===game.difficulty?'active':'';b.onclick=()=>{game.difficulty=name;[...group.children].forEach(x=>x.classList.remove('active'));b.classList.add('active')};group.appendChild(b)})
  }
  function targetUI(){
    const group=$('targetGroup'); group.innerHTML=''; [5,7,10,15].forEach(n=>{const b=document.createElement('button');b.textContent=n;b.className=n===game.target?'active':'';b.onclick=()=>{game.target=n;[...group.children].forEach(x=>x.classList.remove('active'));b.classList.add('active');$('targetLabel').textContent=`FIRST TO ${n}`};group.appendChild(b)})
  }
  function modeUI(){
    const group=$('modeGroup'); group.innerHTML=''; Object.keys(modeConfig).forEach(name=>{const b=document.createElement('button');b.textContent=name;b.className=name===game.mode?'active':'';b.onclick=()=>{game.mode=name;[...group.children].forEach(x=>x.classList.remove('active'));b.classList.add('active');$('modeLabel').textContent=name.toUpperCase()};group.appendChild(b)})
  }

  function resetMatch(){
    game.score.player=0;game.score.ai=0;game.rally=0;game.hits=0;game.elapsed=0;game.activePower=null;game.powerups=[];game.particles=[];game.trail=[];
    game.playerX=.5;game.aiX=.5;game.stats={longestRally:0,totalHits:0,playerHits:0,aiHits:0,playerAccuracy:0,maxSpeed:0};
    updateHUD(); resetBall(Math.random()<.5?1:-1);
  }

  function resetBall(direction){
    game.ball.x=.5;game.ball.y=.5; const angle=rand(-.55,.55); const base=game.h<500?.43:.37;
    game.ball.speed=base; game.ball.vy=direction*base; game.ball.vx=Math.sin(angle)*base*.95; game.pointStart=performance.now();
  }

  function startGame(){
    resetMatch(); game.state='COUNTDOWN'; game.startTime=performance.now(); hideAllScreens(); $('countdownScreen').classList.remove('hidden'); game.countdown=3; $('countdownValue').textContent='3'; playTone(520,.08,'triangle');
    clearInterval(game.countdownTimer); game.countdownTimer=setInterval(()=>{game.countdown--; if(game.countdown>0){$('countdownValue').textContent=game.countdown;playTone(520+game.countdown*90,.07,'triangle')}else{$('countdownValue').textContent='GO!';playTone(880,.12,'sine');setTimeout(()=>{if(game.state==='COUNTDOWN'){game.state='PLAYING';$('countdownScreen').classList.add('hidden');resetBall(Math.random()<.5?1:-1)}},300);clearInterval(game.countdownTimer)}},750);
  }
  function pauseGame(){if(game.state!=='PLAYING')return;game.state='PAUSED';$('pauseScreen').classList.remove('hidden')}
  function resumeGame(){if(game.state!=='PAUSED')return;game.state='PLAYING';$('pauseScreen').classList.add('hidden');game.lastTime=performance.now()}
  function mainMenu(){game.state='START';clearInterval(game.countdownTimer);hideAllScreens();$('startScreen').classList.remove('hidden');updateHUD();}
  function restart(){clearInterval(game.countdownTimer);startGame()}
  function hideAllScreens(){['startScreen','countdownScreen','pauseScreen','gameOverScreen'].forEach(id=>$(id).classList.add('hidden'))}

  function scorePoint(winner){
    if(winner==='player')game.score.player++;else game.score.ai++;
    game.stats.longestRally=Math.max(game.stats.longestRally,game.rally); game.rally=0; game.pointFlash=1; game.shake=settings.shake?.75:0; burst(.5,.5,24,winner==='player'?'player':'ai'); playTone(winner==='player'?720:180,.13,'square'); updateHUD();
    if(game.mode==='Time Attack' && game.elapsed>=60){endGame();return}
    if(game.mode!=='Time Attack' && (game.score.player>=game.target || game.score.ai>=game.target)){endGame();return}
    game.state='POINT_SCORED'; setTimeout(()=>{if(game.state==='POINT_SCORED'){resetBall(game.score.player>game.score.ai?1:-1);game.state='PLAYING'}},650);
  }

  function endGame(){
    game.state='GAME_OVER'; records.games++; const win=game.score.player>game.score.ai; if(win)records.wins++;else records.losses++;
    records.bestScore=Math.max(records.bestScore,game.score.player); records.bestRally=Math.max(records.bestRally,game.stats.longestRally); save('neonPongStats',records);
    $('finalPlayerScore').textContent=game.score.player;$('finalAiScore').textContent=game.score.ai;$('resultTitle').textContent=win?'YOU WON!':'AI WINS';$('resultIcon').textContent=win?'✦':'◆';
    const duration=formatTime(game.elapsed);const playerReturnShare=game.stats.totalHits?Math.round(game.stats.playerHits/game.stats.totalHits*100):0;
    $('statsGrid').innerHTML=[['Longest rally',game.stats.longestRally],['Total hits',game.stats.totalHits],['Player returns',`${playerReturnShare}% of hits`],['Max ball speed',`${game.stats.maxSpeed.toFixed(2)}×`],['Game duration',duration],['Games played',records.games]].map(([a,b])=>`<div class="stat"><span>${a}</span><b>${b}</b></div>`).join('');
    $('gameOverScreen').classList.remove('hidden');playTone(win?980:130,.35,'sawtooth');
  }

  function update(dt){
    if(game.state!=='PLAYING')return;
    game.elapsed=(performance.now()-game.startTime)/1000; if(game.mode==='Time Attack'&&game.elapsed>=60){endGame();return}
    const move=dt*(game.w<600?.9:1.05); if(game.keys.left)game.playerX-=move*.95;if(game.keys.right)game.playerX+=move*.95;game.playerX=clamp(game.playerX,game.playerWidth/2,1-game.playerWidth/2);
    updateAI(dt); updateBall(dt); updatePowerups(dt); updateParticles(dt); game.shake=Math.max(0,game.shake-dt*4); game.pointFlash=Math.max(0,game.pointFlash-dt*2.8);
  }

  function updateAI(dt){
    const d=difficulty[game.difficulty]; game.aiTimer-=dt*1000;
    if(game.aiTimer<=0){game.aiTimer=d.reaction;const target=predictBallX();const error=(1-d.accuracy)*rand(-d.error,d.error)/game.w;game.aiTarget=clamp(target+error,game.aiWidth/2,1-game.aiWidth/2)}
    const diff=game.aiTarget-game.aiX; const maxStep=d.speed*dt;game.aiX+=clamp(diff,-maxStep,maxStep);game.aiX=clamp(game.aiX,game.aiWidth/2,1-game.aiWidth/2);
  }
  function predictBallX(){
    const b=game.ball;if(b.vy>=0)return b.x; const topY=.09; let t=(topY-b.y)/b.vy;if(t<0)return b.x;let x=b.x+b.vx*t;while(x<0||x>1){if(x<0)x=-x;if(x>1)x=2-x}return x;
  }

  function updateBall(dt){
    const b=game.ball; const oldX=b.x,oldY=b.y; b.x+=b.vx*dt;b.y+=b.vy*dt;
    if(settings.trail&&!settings.reducedMotion){game.trail.push({x:b.x,y:b.y,a:1});if(game.trail.length>14)game.trail.shift()}
    if(b.x<=b.r){b.x=b.r;b.vx=Math.abs(b.vx);wallHit()} if(b.x>=1-b.r){b.x=1-b.r;b.vx=-Math.abs(b.vx);wallHit()}
    const playerY=.91,aiY=.09;
    if(b.vy>0 && b.y+b.r>=playerY && b.y-b.r<=playerY+.025 && Math.abs(b.x-game.playerX)<=game.playerWidth/2+b.r){paddleHit('player',playerY);return}
    if(b.vy<0 && b.y-b.r<=aiY+.025 && b.y+b.r>=aiY && Math.abs(b.x-game.aiX)<=game.aiWidth/2+b.r){paddleHit('ai',aiY);return}
    if(b.y>1.04){
      if(game.activePower?.type==='shield'){game.activePower=null;showToast('🛡 SHIELD SAVED YOU');burst(b.x,1,18,'power');playTone(760,.12,'triangle');resetBall(-1);return}
      scorePoint('ai');
    } else if(b.y<-.04)scorePoint('player');
    game.stats.maxSpeed=Math.max(game.stats.maxSpeed,Math.hypot(b.vx,b.vy)/.37);
    if(oldY!==b.y && (oldX!==b.x)){}
  }

  function paddleHit(who,y){
    const b=game.ball; const center=who==='player'?game.playerX:game.aiX;const rel=clamp((b.x-center)/(game.playerWidth/2),-1,1);const angle=rel*1.12; const speed=Math.min(Math.hypot(b.vx,b.vy)*1.045,.92); const dir=who==='player'?-1:1;
    b.vy=dir*Math.cos(angle)*speed;b.vx=Math.sin(angle)*speed;b.y=who==='player'?y-b.r-.03:y+b.r+.03; game.rally++;game.hits++;game.stats.totalHits++;if(who==='player')game.stats.playerHits++;game.stats.longestRally=Math.max(game.stats.longestRally,game.rally);burst(b.x,b.y,settings.reducedMotion?3:8,who);playTone(who==='player'?640:380,.055,'sine');game.shake=settings.shake?Math.min(.28,Math.abs(rel)*.22):0;
    if(game.mode==='Power-Up'&&Math.random()<.13)spawnPowerup();
    if(game.rally>=5)showToast(`🔥 ${game.rally} HIT RALLY`);updateHUD();
  }
  function wallHit(){burst(game.ball.x,game.ball.y,settings.reducedMotion?2:5,'wall');playTone(260,.035,'triangle')}

  function spawnPowerup(){const types=['speed','shield','slow','wide','fire'];const type=types[Math.floor(Math.random()*types.length)];game.powerups.push({x:rand(.15,.85),y:rand(.3,.7),type,r:.025,life:7,pulse:0})}
  function updatePowerups(dt){
    if(game.mode!=='Power-Up')return;for(let i=game.powerups.length-1;i>=0;i--){const p=game.powerups[i];p.life-=dt;p.pulse+=dt*5;if(p.life<=0){game.powerups.splice(i,1);continue}const dx=game.ball.x-p.x,dy=game.ball.y-p.y;if(dx*dx+dy*dy<(game.ball.r+p.r)**2){applyPower(p.type);game.powerups.splice(i,1);burst(p.x,p.y,14,'power');}}
    if(game.activePower){game.activePower.time-=dt;if(game.activePower.time<=0){if(game.activePower.restore){game.ball.vx/=game.activePower.restore;game.ball.vy/=game.activePower.restore}game.activePower=null;game.playerWidth=clamp(game.w<600?.25:.20,.18,.28)}}
  }
  function applyPower(type){const names={speed:'⚡ SPEED BOOST',shield:'🛡 SHIELD',slow:'🐌 SLOW BALL',wide:'↔ WIDE PADDLE',fire:'🔥 FIREBALL'};showToast(names[type]);playTone(900,.15,'square');if(type==='speed'||type==='fire'){game.ball.vx*=1.22;game.ball.vy*=1.22;game.activePower={type,time:5,restore:1.22}}if(type==='slow'){game.ball.vx*=.72;game.ball.vy*=.72;game.activePower={type,time:5,restore:.72}}if(type==='wide'){game.playerWidth=Math.min(.34,game.playerWidth*1.35);game.activePower={type,time:7}}if(type==='shield')game.activePower={type,time:10}}

  function burst(x,y,n,type){if(!settings.particles||settings.reducedMotion)return;for(let i=0;i<n;i++){if(game.particles.length>=game.maxParticles)game.particles.shift();const a=Math.random()*Math.PI*2,s=rand(.04,.22);game.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.3,.75),size:rand(.0025,.007),type})}}
  function updateParticles(dt){for(let i=game.particles.length-1;i>=0;i--){const p=game.particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.02*dt;p.life-=dt;if(p.life<=0)game.particles.splice(i,1)}for(const t of game.trail)t.a-=dt*3;game.trail=game.trail.filter(t=>t.a>0)}
  function showToast(text){game.toast=text;game.toastTimer=1.3}

  function render(){
    const w=game.w,h=game.h;if(!w||!h)return;ctx.clearRect(0,0,w,h);
    ctx.save();
    if(game.shake>0 && !settings.reducedMotion){const sx=(Math.random()-.5)*game.shake*w*.018;const sy=(Math.random()-.5)*game.shake*h*.018;ctx.translate(sx,sy)}
    const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#070b1d');grad.addColorStop(.5,'#040817');grad.addColorStop(1,'#06101d');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    drawGrid();drawCenter();drawPowerups();drawTrail();drawPaddle(game.aiX,.09,game.aiWidth,'ai');drawPaddle(game.playerX,.91,game.playerWidth,'player');drawBall();drawParticles();
    if(game.pointFlash>0){ctx.fillStyle=`rgba(255,255,255,${game.pointFlash*.045})`;ctx.fillRect(0,0,w,h)}
    if(game.toastTimer>0){game.toastTimer-=1/60;ctx.save();ctx.textAlign='center';ctx.font='800 11px system-ui';ctx.fillStyle='rgba(240,245,255,.9)';ctx.fillText(game.toast,w/2,h*.55);ctx.restore()}
    ctx.restore();
  }
  function drawGrid(){ctx.save();ctx.strokeStyle='rgba(98,125,204,.07)';ctx.lineWidth=1;for(let x=0;x<game.w;x+=Math.max(32,game.w/18)){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,game.h);ctx.stroke()}for(let y=0;y<game.h;y+=Math.max(32,game.h/14)){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(game.w,y);ctx.stroke()}ctx.restore()}
  function drawCenter(){ctx.save();ctx.setLineDash([9,13]);ctx.strokeStyle='rgba(143,161,211,.18)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,game.h/2);ctx.lineTo(game.w,game.h/2);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='rgba(54,231,255,.08)';ctx.beginPath();ctx.arc(game.w/2,game.h/2,Math.min(game.w,game.h)*.13,0,Math.PI*2);ctx.stroke();ctx.restore()}
  function drawPaddle(x,y,width,type){const pw=width*game.w,ph=Math.max(7,game.h*.022),px=x*game.w-pw/2,py=y*game.h;ctx.save();ctx.shadowBlur=type==='player'?22:20;ctx.shadowColor=type==='player'?'#36e7ff':'#b66cff';ctx.fillStyle=type==='player'?'#6df0ff':'#c796ff';roundRect(px,py,pw,ph,ph/2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,.7)';roundRect(px+pw*.12,py+ph*.2,pw*.76,ph*.22,ph/2);ctx.fill();ctx.restore()}
  function drawBall(){const b=game.ball,x=b.x*game.w,y=b.y*game.h,r=b.r*game.w;ctx.save();ctx.shadowBlur=25;ctx.shadowColor='#fff';ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore()}
  function drawTrail(){if(!settings.trail||settings.reducedMotion)return;ctx.save();for(const t of game.trail){const x=t.x*game.w,y=t.y*game.h,r=game.ball.r*game.w*(t.a*.65);ctx.globalAlpha=Math.max(0,t.a*.35);ctx.fillStyle='#65e9ff';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}ctx.restore()}
  function drawParticles(){ctx.save();for(const p of game.particles){ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.type==='ai'?'#b66cff':p.type==='player'?'#36e7ff':p.type==='power'?'#fff':'#92a5ff';ctx.beginPath();ctx.arc(p.x*game.w,p.y*game.h,p.size*game.w,0,Math.PI*2);ctx.fill()}ctx.restore()}
  function drawPowerups(){for(const p of game.powerups){ctx.save();const x=p.x*game.w,y=p.y*game.h,r=p.r*game.w*(1+.12*Math.sin(p.pulse));ctx.globalAlpha=.9;ctx.shadowBlur=18;ctx.shadowColor='#fff';ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.font=`${Math.max(11,r*1.1)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText({speed:'⚡',shield:'🛡',slow:'🐌',wide:'↔',fire:'🔥'}[p.type],x,y);ctx.restore()}}
  function roundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}

  function updateHUD(){ $('playerScore').textContent=game.score.player;$('aiScore').textContent=game.score.ai;$('rallyValue').textContent=game.rally;$('footerRally').textContent=game.rally;$('bestScore').textContent=records.bestScore;$('bestRally').textContent=records.bestRally }
  function formatTime(s){const m=Math.floor(s/60),sec=Math.floor(s%60);return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`}

  let audioCtx=null, musicTimer=null;
  function ensureAudio(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}
  function playTone(freq,dur,type){if(!settings.sound)return;try{ensureAudio();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur)}catch{}}
  function toggleMusic(){settings.music=!settings.music;syncSettings();if(settings.music)startMusic();else stopMusic()}
  function startMusic(){stopMusic();if(!settings.music)return;try{ensureAudio();let step=0;musicTimer=setInterval(()=>{if(game.state==='PLAYING'){const notes=[220,277,330,415];playTone(notes[step++%notes.length],.08,'triangle')}},430)}catch{}}
  function stopMusic(){if(musicTimer)clearInterval(musicTimer);musicTimer=null}
  function syncSettings(){save('neonPongSettings',settings);$('soundToggle').checked=settings.sound;$('musicToggle').checked=settings.music;$('particlesToggle').checked=settings.particles;$('shakeToggle').checked=settings.shake;$('trailToggle').checked=settings.trail;$('motionToggle').checked=settings.reducedMotion;$('soundBtn').textContent=settings.sound?'🔊':'🔇';$('musicBtn').textContent=settings.music?'🎵':'🔕';$('soundBtn').setAttribute('aria-pressed',settings.sound);$('musicBtn').setAttribute('aria-pressed',settings.music)}

  function openSettings(){ $('settingsModal').classList.remove('hidden');syncSettings() } function closeSettings(){$('settingsModal').classList.add('hidden')}

  document.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','a','d','A','D',' '].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')game.keys.left=true;if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')game.keys.right=true;if(e.key===' '){if(game.state==='PLAYING')pauseGame();else if(game.state==='PAUSED')resumeGame()}});
  document.addEventListener('keyup',e=>{if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')game.keys.left=false;if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')game.keys.right=false});
  arena.addEventListener('pointerdown',e=>{if(game.state!=='PLAYING')return;game.pointerId=e.pointerId;arena.setPointerCapture(e.pointerId);movePointer(e)});
  arena.addEventListener('pointermove',e=>{if(game.pointerId===e.pointerId)movePointer(e)});arena.addEventListener('pointerup',e=>{if(game.pointerId===e.pointerId)game.pointerId=null});
  function movePointer(e){const r=canvas.getBoundingClientRect();game.playerX=clamp((e.clientX-r.left)/r.width,game.playerWidth/2,1-game.playerWidth/2);$('touchHint').style.opacity='0'}
  $('startBtn').onclick=()=>{ensureAudio();startGame()};$('resumeBtn').onclick=resumeGame;$('restartBtn').onclick=restart;$('mainMenuBtn').onclick=mainMenu;$('playAgainBtn').onclick=restart;$('resultMenuBtn').onclick=mainMenu;$('settingsBtn').onclick=openSettings;$('pauseSettingsBtn').onclick=openSettings;$('closeSettings').onclick=closeSettings;$('soundBtn').onclick=()=>{settings.sound=!settings.sound;syncSettings();if(settings.sound)playTone(660,.06,'sine')};$('musicBtn').onclick=toggleMusic;
  $('soundToggle').onchange=e=>{settings.sound=e.target.checked;syncSettings()};$('musicToggle').onchange=e=>{settings.music=e.target.checked;syncSettings();settings.music?startMusic():stopMusic()};$('particlesToggle').onchange=e=>{settings.particles=e.target.checked;syncSettings()};$('shakeToggle').onchange=e=>{settings.shake=e.target.checked;syncSettings()};$('trailToggle').onchange=e=>{settings.trail=e.target.checked;syncSettings()};$('motionToggle').onchange=e=>{settings.reducedMotion=e.target.checked;syncSettings()};
  $('resetStatsBtn').onclick=()=>{records={bestScore:0,bestRally:0,games:0,wins:0,losses:0};save('neonPongStats',records);updateHUD()};
  window.addEventListener('resize',resize);window.addEventListener('blur',()=>{game.keys.left=false;game.keys.right=false;if(game.state==='PLAYING')pauseGame()});

  function loop(now){const dt=Math.min((now-game.lastTime)/1000||0,.032);game.lastTime=now;update(dt);render();game.raf=requestAnimationFrame(loop)}
  difficultyUI();targetUI();modeUI();syncSettings();resize();updateHUD();render();game.lastTime=performance.now();game.raf=requestAnimationFrame(loop);
})();
