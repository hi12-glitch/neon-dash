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

const W = canvas.width, H = canvas.height, FLOOR = 456, CEILING = 34, SIZE = 42, LEVEL_END = 5700;
let running = false, attempt = 1, distance = 0, best = Number(localStorage.neonDashBest || 0);
let player, level, particles, lastTime, audioOn = false, audioCtx, beat = 0, flash = 0;
bestScore.textContent = `${best}%`;

const spike = (x, count = 1, h = 44) => ({kind:'spike', x, count, w:38 * count, h});
const block = (x, h = 42, w = 42) => ({kind:'block', x, w, h});
const pad = (x, power = 900) => ({kind:'pad', x, w:48, h:12, power});
const portal = (x, color = '#ff5eb3', speed = 1) => ({kind:'portal', x, w:58, h:120, color, speed});
const orb = (x, y, color = '#ffcf4d') => ({kind:'orb', x, y, w:38, color});
const coin = (x, y) => ({kind:'coin', x, y, w:24, collected:false});

function makeLevel() {
  return [
    spike(620), spike(670), block(900), spike(942), spike(1130, 2), orb(1245, 285), coin(1310, 230),
    pad(1370), spike(1560, 2), block(1780, 84), spike(1825),
    block(2045), block(2088, 84), block(2131, 126), spike(2178),
    portal(2440, '#58e4ff', 1.18), spike(2660), spike(2715), block(2920), spike(2962),
    pad(3170, 1000), orb(3320, 235, '#53e6ff'), spike(3370, 3), block(3600, 42, 90), spike(3690),
    block(3890, 84), block(3932, 126), spike(3974), portal(4250, '#ffcf4d', 1.28),
    spike(4490, 2), coin(4560, 300), pad(4740, 1060), orb(4880, 205, '#ff67b1'), spike(4960, 3), block(5250, 42, 126), spike(5390, 2)
  ];
}

function reset() {
  player = {x: 180, y: FLOOR - SIZE, vy: 0, rotation: 0, grounded: true, trail: [], speed: 1, nearOrb:null, coins:0};
  level = makeLevel(); particles = []; distance = 0; beat = 0; flash = 0;
  runScore.textContent = '0%'; progressFill.style.width = '0%';
}

function tone(freq = 440, duration = .05, volume = .035) {
  if (!audioOn) return;
  audioCtx ||= new AudioContext();
  const oscillator = audioCtx.createOscillator(), gain = audioCtx.createGain();
  oscillator.type = 'square'; oscillator.frequency.value = freq; gain.gain.value = volume;
  oscillator.connect(gain).connect(audioCtx.destination); oscillator.start();
  gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration); oscillator.stop(audioCtx.currentTime + duration);
}

function burst(x, y, color, amount = 14) {
  for (let i = 0; i < amount; i++) particles.push({x, y, color, vx:(Math.random()-.5)*260, vy:(Math.random()-.5)*260, life:.3 + Math.random()*.4, size:3+Math.random()*7});
}

function start() { reset(); running = true; overlay.classList.add('hidden'); lastTime = performance.now(); requestAnimationFrame(loop); }
function jump() {
  if (!running) return start();
  if (player.nearOrb) { const orb = player.nearOrb; player.vy = -850; player.grounded = false; orb.used = true; tone(980,.08); burst(player.x+20,player.y+20,orb.color,18); return; }
  if (player.grounded) { player.vy = -735; player.grounded = false; tone(660); burst(player.x + 20, player.y + 36, '#62e8ff', 7); }
}
function die() { if (!running) return; running = false; flash = 1; tone(95, .22, .06); burst(player.x+20, player.y+20, '#ff538b', 34); attempt++; attemptsEl.textContent = `ATTEMPT ${attempt}`; overlayTitle.textContent = 'CRASHED!'; overlayText.textContent = 'The beat waits for no one — try again'; playButton.innerHTML = 'RETRY LEVEL <span>↻</span>'; overlay.classList.remove('hidden'); draw(); }
function win() { running = false; best = 100; localStorage.neonDashBest = best; bestScore.textContent = '100%'; overlayTitle.textContent = 'LEVEL COMPLETE!'; overlayText.textContent = 'First Flight mastered'; playButton.innerHTML = 'PLAY AGAIN <span>▶</span>'; overlay.classList.remove('hidden'); tone(880,.12); }

function boxHitsSpike(o) {
  const left = player.x + 7, right = player.x + SIZE - 7, bottom = player.y + SIZE - 3;
  const sx = o.x - distance, top = FLOOR - o.h;
  return right > sx + 7 && left < sx + o.w - 7 && bottom > top + 12 && player.y < FLOOR;
}
function boxHitsBlock(o) { const x = o.x - distance, y = FLOOR-o.h; return player.x+SIZE-5 > x && player.x+5 < x+o.w && player.y+SIZE-5 > y && player.y+5 < FLOOR; }

function update(dt) {
  beat += dt; flash = Math.max(0, flash-dt*2.5); const speed = 350 * player.speed;
  const previousBottom = player.y + SIZE;
  player.vy += 2050 * dt; player.y += player.vy * dt; player.rotation += dt * 8.8;
  let landing = FLOOR;
  for (const o of level) if (o.kind === 'block') {
    const x = o.x - distance, top = FLOOR-o.h;
    if (player.x + SIZE - 7 > x && player.x + 7 < x+o.w && player.vy >= 0 && previousBottom <= top+13 && player.y+SIZE >= top) landing = Math.min(landing, top);
    else if (boxHitsBlock(o)) die();
  }
  if (player.y + SIZE >= landing) { player.y = landing-SIZE; player.vy = 0; player.grounded = true; player.rotation = Math.round(player.rotation/(Math.PI/2))*Math.PI/2; }
  else player.grounded = false;
  player.nearOrb = null;
  for (const o of level) {
    const sx = o.x - distance;
    if (o.kind === 'spike' && boxHitsSpike(o)) die();
    if (o.kind === 'pad' && player.grounded && player.x+SIZE > sx && player.x < sx+o.w && Math.abs(player.y+SIZE-FLOOR) < 4) { player.vy=-o.power; player.grounded=false; tone(910,.08); burst(sx+20,FLOOR-8,'#ffe15a',18); }
    if (o.kind === 'portal' && sx < player.x+SIZE && sx+o.w > player.x && !o.used) { o.used=true; player.speed=o.speed; flash=.65; tone(760,.1); burst(player.x+20,player.y+20,o.color,24); }
    if (o.kind === 'orb' && !o.used && Math.hypot(player.x+SIZE/2-(sx+o.w/2), player.y+SIZE/2-o.y) < 52) player.nearOrb = o;
    if (o.kind === 'coin' && !o.collected && Math.hypot(player.x+SIZE/2-(sx+o.w/2), player.y+SIZE/2-o.y) < 35) { o.collected=true; player.coins++; tone(1200,.05); burst(sx+12,o.y,'#ffdf51',10); }
  }
  if (player.y < CEILING-SIZE || player.y > H+80) die();
  distance += speed * dt; const pct = Math.min(100, Math.floor(distance / LEVEL_END * 100)); runScore.textContent = `${pct}%`; progressFill.style.width = `${pct}%`;
  if (pct > best) { best=pct; localStorage.neonDashBest=best; bestScore.textContent=`${best}%`; }
  if (distance >= LEVEL_END) win();
  player.trail.unshift({x:player.x+14,y:player.y+27,life:1}); player.trail=player.trail.slice(0,14);
  player.trail.forEach(t => t.life -= dt*4.2);
  particles.forEach(p => { p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=460*dt; p.life-=dt; }); particles=particles.filter(p=>p.life>0);
}

function rect(x,y,w,h,c) { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); }
function drawBackground() {
  const bg=ctx.createLinearGradient(0,0,W,H); bg.addColorStop(0,'#28105f'); bg.addColorStop(.48,'#153070'); bg.addColorStop(1,'#0a4a81'); rect(0,0,W,H,bg);
  const pulse=(Math.sin(beat*3.6)+1)/2;
  ctx.strokeStyle=`rgba(113,100,255,${.17+pulse*.12})`;ctx.lineWidth=2;
  for(let x=-(distance*.18)%70;x<W;x+=70){ctx.beginPath();ctx.moveTo(x,CEILING);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=CEILING;y<FLOOR;y+=70){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  for(let i=0;i<8;i++){const x=((i*211-distance*.08)%1400)-90, y=82+(i%4)*72;ctx.fillStyle='rgba(97,239,255,.08)';ctx.beginPath();ctx.arc(x,y,34+pulse*8,0,Math.PI*2);ctx.fill();}
  rect(0,0,W,CEILING,'#0d1645'); rect(0,FLOOR,W,H-FLOOR,'#0e1644'); rect(0,FLOOR,W,5,'#6a57e8');
}
function drawSpike(o) { const x=o.x-distance; for(let i=0;i<o.count;i++){const sx=x+i*38;ctx.beginPath();ctx.moveTo(sx,FLOOR);ctx.lineTo(sx+19,FLOOR-o.h);ctx.lineTo(sx+38,FLOOR);ctx.closePath();ctx.fillStyle='#fc4f9a';ctx.fill();ctx.strokeStyle='#ffd4e8';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(sx+8,FLOOR-4);ctx.lineTo(sx+19,FLOOR-o.h+12);ctx.lineTo(sx+30,FLOOR-4);ctx.strokeStyle='#d52672';ctx.stroke();} }
function drawBlock(o) { const x=o.x-distance,y=FLOOR-o.h; rect(x,y,o.w,o.h,'#7948ed');rect(x+4,y+4,o.w-8,o.h-8,'#a38aff');rect(x+8,y+8,o.w-16,7,'#d2c7ff');rect(x+8,y+20,o.w-16,3,'rgba(29,22,94,.4)'); }
function drawPad(o) { const x=o.x-distance; ctx.shadowColor='#ffe46a';ctx.shadowBlur=13;rect(x,FLOOR-10,o.w,10,'#ffe352');ctx.shadowBlur=0;ctx.fillStyle='#fffbd1';ctx.beginPath();ctx.moveTo(x+9,FLOOR-4);ctx.lineTo(x+o.w/2,FLOOR-16);ctx.lineTo(x+o.w-9,FLOOR-4);ctx.closePath();ctx.fill(); }
function drawPortal(o) { const x=o.x-distance, y=FLOOR-o.h;ctx.save();ctx.translate(x+o.w/2,y+o.h/2);ctx.strokeStyle=o.color;ctx.lineWidth=8;ctx.shadowColor=o.color;ctx.shadowBlur=18;ctx.beginPath();ctx.ellipse(0,0,19,53,0,0,Math.PI*2);ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,10,43,0,0,Math.PI*2);ctx.stroke();ctx.restore(); }
function drawOrb(o) { const x=o.x-distance+o.w/2;ctx.save();ctx.translate(x,o.y);ctx.shadowColor=o.color;ctx.shadowBlur=16;ctx.fillStyle=o.color;ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#fff8d5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.stroke();ctx.restore(); }
function drawCoin(o) { if(o.collected)return;const x=o.x-distance+12;ctx.save();ctx.translate(x,o.y);ctx.rotate(beat*4);ctx.fillStyle='#ffd545';ctx.shadowColor='#ffd545';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff4a4';ctx.fillRect(-3,-7,6,14);ctx.restore(); }
function drawPlayer() { player.trail.forEach((t,i)=>{ctx.globalAlpha=Math.max(0,t.life)*.33;rect(t.x-i*3,t.y,20-i*.7,20-i*.7,'#3fe4f3');});ctx.globalAlpha=1;ctx.save();ctx.translate(player.x+SIZE/2,player.y+SIZE/2);ctx.rotate(player.rotation);ctx.shadowColor='#35e5fa';ctx.shadowBlur=18;rect(-21,-21,42,42,'#32d9f0');ctx.shadowBlur=0;rect(-15,-15,30,30,'#2478bc');rect(-13,-11,8,8,'#10204d');rect(5,-11,8,8,'#10204d');rect(-9,8,18,5,'#10204d');ctx.restore(); }
function draw() { drawBackground(); level.forEach(o=>{ if(o.kind==='spike')drawSpike(o); else if(o.kind==='block')drawBlock(o); else if(o.kind==='pad')drawPad(o); else if(o.kind==='portal')drawPortal(o); else if(o.kind==='orb')drawOrb(o); else drawCoin(o); }); particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);});ctx.globalAlpha=1;drawPlayer();ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='800 15px Nunito';ctx.fillText(`◈ ${player.coins}`,W-72,28);if(flash){ctx.fillStyle=`rgba(255,255,255,${flash*.13})`;ctx.fillRect(0,0,W,H);} }
function loop(time) { if(!running) return; const dt=Math.min(.028,(time-lastTime)/1000);lastTime=time;update(dt);draw();requestAnimationFrame(loop); }

playButton.addEventListener('pointerdown',e=>e.stopPropagation()); playButton.addEventListener('click',e=>{e.stopPropagation();start();});
document.querySelector('#canvasWrap').addEventListener('pointerdown',e=>{if(e.target!==playButton)jump();});
window.addEventListener('keydown',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();jump();}});
document.querySelector('#soundButton').addEventListener('click',()=>{audioOn=!audioOn;document.querySelector('#soundButton').textContent=audioOn?'♫':'♩';});
reset(); draw();
