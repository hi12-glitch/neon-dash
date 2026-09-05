const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#overlay');
const playButton = document.querySelector('#playButton');
const progressFill = document.querySelector('#progressFill');
const runScore = document.querySelector('#runScore');
const bestScore = document.querySelector('#bestScore');
const attemptsEl = document.querySelector('#attempts');
const overlayTitle = document.querySelector('#overlayTitle');
const overlayText = document.querySelector('#overlayText');

const W = canvas.width, H = canvas.height, ground = 453;
let running = false, started = false, attempt = 1, distance = 0, best = Number(localStorage.neonDashBest || 0);
let player, obstacles, particles, lastTime, audioOn = false, audioCtx;
bestScore.textContent = best + '%';

function reset() {
  player = { x:180, y:ground-42, size:42, vy:0, rotation:0, grounded:true, trail:[] };
  obstacles = [
    {x:590,w:38,h:44,type:'spike'}, {x:628,w:38,h:82,type:'spike'},
    {x:850,w:42,h:42,type:'block'}, {x:892,w:38,h:44,type:'spike'},
    {x:1070,w:38,h:44,type:'spike'}, {x:1109,w:38,h:44,type:'spike'},
    {x:1330,w:42,h:88,type:'block'}, {x:1374,w:38,h:44,type:'spike'},
    {x:1570,w:38,h:44,type:'spike'}, {x:1610,w:38,h:82,type:'spike'},
    {x:1810,w:38,h:44,type:'spike'}, {x:1850,w:42,h:42,type:'block'},
    {x:2070,w:38,h:44,type:'spike'}, {x:2110,w:38,h:44,type:'spike'},
    {x:2320,w:42,h:88,type:'block'}, {x:2375,w:38,h:82,type:'spike'}
  ];
  particles=[]; distance=0; runScore.textContent='0%'; progressFill.style.width='0%';
}
function beep(freq=440, duration=.06) { if (!audioOn) return; audioCtx ||= new AudioContext(); const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.frequency.value=freq; g.gain.value=.04; o.connect(g).connect(audioCtx.destination); o.start(); g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration); o.stop(audioCtx.currentTime+duration); }
function start() { reset(); running=true; started=true; overlay.classList.add('hidden'); lastTime=performance.now(); requestAnimationFrame(loop); }
function jump() { if (!running) { start(); return; } if (player.grounded) { player.vy=-720; player.grounded=false; beep(650); } }
function die() { running=false; beep(100,.25); attempt++; attemptsEl.textContent='ATTEMPT '+attempt; overlayTitle.textContent='TRY AGAIN'; overlayText.textContent='Tap anywhere or press Space to retry'; playButton.innerHTML='RETRY LEVEL <span>↻</span>'; overlay.classList.remove('hidden'); }
function win() { running=false; best=100; localStorage.neonDashBest=best; bestScore.textContent='100%'; overlayTitle.textContent='LEVEL COMPLETE!'; overlayText.textContent='You made it through First Flight'; playButton.innerHTML='PLAY AGAIN <span>▶</span>'; overlay.classList.remove('hidden'); beep(880,.12); }
function collision(a,o) { const px=a.x+5, py=a.y+5, s=a.size-10; if (o.type==='block') return px+s>o.x && px<o.x+o.w && py+s>ground-o.h; const spikeTop=ground-o.h; return px+s>o.x+5 && px<o.x+o.w-5 && py+s>spikeTop+12; }
function update(dt) { const speed=330; player.vy += 1950*dt; player.y += player.vy*dt; player.rotation += dt*8.2; if (player.y>=ground-player.size) { player.y=ground-player.size; player.vy=0; player.grounded=true; player.rotation=Math.round(player.rotation/(Math.PI/2))*Math.PI/2; }
  for (const o of obstacles) o.x-=speed*dt; distance+=speed*dt; const pct=Math.min(100,Math.floor(distance/19)); runScore.textContent=pct+'%'; progressFill.style.width=pct+'%'; if (pct>best) { best=pct; localStorage.neonDashBest=best; bestScore.textContent=best+'%'; }
  if (obstacles.some(o=>collision(player,o))) die(); if (distance>=1900) win();
  player.trail.unshift({x:player.x+12,y:player.y+29,life:1}); player.trail=player.trail.slice(0,9); player.trail.forEach(t=>t.life-=dt*5);
}
function drawBackground() { const bg=ctx.createLinearGradient(0,0,W,H); bg.addColorStop(0,'#3d1d85'); bg.addColorStop(.55,'#172273'); bg.addColorStop(1,'#0d3a83'); ctx.fillStyle=bg;ctx.fillRect(0,0,W,H); ctx.fillStyle='rgba(255,255,255,.06)'; for(let x=0;x<W;x+=80){for(let y=30;y<ground;y+=80){ctx.fillRect(x+((y/80)%2)*12,y,3,3)}} ctx.fillStyle='rgba(51,220,248,.12)'; for(let i=0;i<7;i++){ctx.beginPath();ctx.arc(105+i*180,80+(i%3)*80,47,0,Math.PI*2);ctx.fill();} }
function drawObstacle(o) { const y=ground-o.h; if(o.type==='block'){ctx.fillStyle='#f1b52c';ctx.fillRect(o.x,y,o.w,o.h);ctx.fillStyle='#ffdc5d';ctx.fillRect(o.x+5,y+5,o.w-10,o.h-10);ctx.fillStyle='#c77d1e';ctx.fillRect(o.x+9,y+11,o.w-18,8);return;} ctx.beginPath();ctx.moveTo(o.x,ground);ctx.lineTo(o.x+o.w/2,y);ctx.lineTo(o.x+o.w,ground);ctx.closePath();ctx.fillStyle='#ff4e9b';ctx.fill();ctx.strokeStyle='#ffd1e8';ctx.lineWidth=3;ctx.stroke(); }
function draw() { drawBackground(); ctx.fillStyle='#172060';ctx.fillRect(0,ground,W,H-ground);ctx.fillStyle='#27367f';ctx.fillRect(0,ground,W,5); obstacles.forEach(drawObstacle);
  player.trail.forEach((t,i)=>{ctx.globalAlpha=Math.max(0,t.life)*.35;ctx.fillStyle='#5de6ff';ctx.fillRect(t.x-i*3,t.y,18-i,18-i);});ctx.globalAlpha=1;
  ctx.save();ctx.translate(player.x+player.size/2,player.y+player.size/2);ctx.rotate(player.rotation);ctx.shadowColor='#23ddff';ctx.shadowBlur=15;ctx.fillStyle='#38d9f3';ctx.fillRect(-21,-21,42,42);ctx.shadowBlur=0;ctx.fillStyle='#102150';ctx.fillRect(-13,-11,8,8);ctx.fillRect(5,-11,8,8);ctx.fillRect(-9,8,18,5);ctx.restore(); }
function loop(t) { if(!running)return; const dt=Math.min(.03,(t-lastTime)/1000);lastTime=t;update(dt);draw();requestAnimationFrame(loop); }
playButton.addEventListener('pointerdown',e=>e.stopPropagation());
playButton.addEventListener('click',e=>{e.stopPropagation();start();}); document.querySelector('#canvasWrap').addEventListener('pointerdown',e=>{if(e.target!==playButton)jump();}); window.addEventListener('keydown',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();jump();}});
document.querySelector('#soundButton').addEventListener('click',()=>{audioOn=!audioOn;document.querySelector('#soundButton').textContent=audioOn?'♫':'♩';});
reset();draw();
