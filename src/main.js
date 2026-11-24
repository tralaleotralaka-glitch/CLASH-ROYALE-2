import '@fontsource-variable/manrope';
import '@fontsource-variable/exo-2';
import './style.css';
import { Battle, CARDS, DEFAULT_DECK, DIFFICULTY, formatTime, W, H } from './battle.js';
import {icon as i} from './icons.js';

const $=s=>document.querySelector(s);
const app=$('#app');
const read=(key, fallback)=>{try { return JSON.parse(localStorage.getItem(`royale:${key}`))??fallback; } catch { return fallback; }};
const save=(key,value)=>{try{localStorage.setItem(`royale:${key}`,JSON.stringify(value));}catch{}};
const cardImg=id=>`/art/cards/${id}.webp`;
const unitImg=id=>`/art/units/${id}.webp`;
const drop=`<svg viewBox="0 0 24 27" aria-hidden="true"><path fill="currentColor" d="M12 1C9 6 2 13 2 17a10 10 0 0 0 20 0c0-4-7-11-10-16Z"/><path d="M6.5 17a5.5 5.5 0 0 0 3 4.7" fill="none" stroke="#ffebff" stroke-opacity=".72" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const brand=`<img src="/crown.svg" alt=""><span>CLASH<strong>ROYALE</strong></span>`;
const pages={arena:['Арена','swords'],deck:['Колода','layers'],collection:['Коллекция','library'],stats:['Статистика','chart-no-axes-column'],settings:['Настройки','settings']};
let current='arena', selected=-1, paused=false, modal='', battle, logs=[], draft=null, editSlot=-1, pointer=null;
let deck=read('deck',DEFAULT_DECK);
if(!Array.isArray(deck)||deck.length!==8||new Set(deck).size!==8||deck.some(id=>!CARDS[id]))deck=[...DEFAULT_DECK];
let stats=read('stats',{wins:0,losses:0,draws:0,crowns:0});
let difficulty=read('difficulty','normal'); if(!DIFFICULTY[difficulty])difficulty='normal';
let sound=read('sound',true), audio;
let toastTimer, endShown=false;
const trophies=()=>Math.max(0,stats.wins*30-stats.losses*10);
const navLink=id=>`<button class="nav-link ${id===current?'active':''}" ${id===current?'aria-current="page"':''} data-page="${id}">${i(pages[id][1],19)}<span>${pages[id][0]}</span>${id===current?i('chevron-right',15):''}</button>`;
const avatar=(id,side,extra='')=>`<span class="avatar ${side} ${extra}"><img src="${cardImg(id)}" alt=""></span>`;
function soundFx(type='tap') {
  if(!sound)return;
  try {
    audio ||= new (window.AudioContext||window.webkitAudioContext)();
    if(audio.state==='suspended')audio.resume().catch(()=>{});
    const notes=type==='win'?[392,523,659]:type==='deploy'?[268,408]:[420];
    const now=audio.currentTime;
    notes.forEach((f,k)=>{const osc=audio.createOscillator(),g=audio.createGain(),t=now+k*.075;osc.type='triangle';osc.frequency.value=f;g.gain.setValueAtTime(.085,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);osc.connect(g).connect(audio.destination);osc.start(t);osc.stop(t+.17);});
  } catch {}
}
function eventLog(text,icon,side) {
  logs.unshift({text,icon,side,time:formatTime(Math.ceil(battle?.left??180))});
  logs=logs.slice(0,20); renderLog();
}
function reset(start=false) {
  logs=[]; selected=-1; endShown=false; paused=false; draft=null; editSlot=-1;
  battle=new Battle({deck,difficulty,notify:eventLog});
  eventLog('Арена готова к бою','flag','green');
  if(start)battle.start();
}
function render() {
  app.innerHTML=`<div class="shell">
    <aside class="sidebar" aria-label="Главное меню">
      <button class="brand" data-page="arena" aria-label="Clash Royale — Арена">${brand}</button>
      <div class="sidebar-inner"><div class="nav-group"><div class="nav-label">ИГРА</div>${['arena','deck','collection'].map(navLink).join('')}</div>
      <div class="nav-group"><div class="nav-label">ПРОФИЛЬ</div>${['stats','settings'].map(navLink).join('')}</div></div>
      <div class="side-bottom"><button class="help-link" data-action="help">${i('circle-help',18)} Как играть ${i('arrow-up-right',14)}</button><button class="profile" data-page="stats">${avatar('knight','blue')}<span><b>Искатель</b><small>Уровень 1</small></span>${i('chevron-right',16)}</button></div>
    </aside>
    <div class="workspace"><header class="topbar"><div class="breadcrumbs"><button class="mobile-menu icon-btn" data-action="menu" aria-label="Меню">${i('menu',22)}</button><span>Игра</span>${i('chevron-right',14)}<b>${pages[current][0]}</b></div><div class="top-actions"><button class="trophy-pill" data-page="stats" title="Ваши трофеи">${i('trophy',17)}<strong>${trophies()}</strong></button><button class="icon-btn sound" data-action="sound" aria-label="${sound?'Выключить звук':'Включить звук'}" title="${sound?'Выключить звук':'Включить звук'}">${i(sound?'volume-2':'volume-x',19)}</button></div></header>
    <main class="content ${current!=='arena'?'secondary':''}">${current==='arena'?arenaView():otherView()}</main>
    </div><div id="overlay"></div><div id="toast" role="status"></div></div>`;
  if(current==='arena'){ renderHand(); renderTowers(); renderLog(); draw(); }
}
function arenaView() {
  return `<section class="page-heading"><div><div class="eyebrow"><span></span> БОЕВОЙ РЕЖИМ</div><h1>Арена</h1><p>Тренировочный лагерь <span class="sep"></span> Бой 1 на 1</p></div><button class="primary" data-action="new">${i('swords',19)} Новый бой</button></section>
  <div class="battle-grid"><section class="battlefield" aria-label="Поле боя">
    <div class="match-bar"><div class="contender">${avatar('knight','blue')}<span><b>Искатель</b><small>Вы</small></span></div><div class="clock">${i('timer',16)} <strong id="time">3:00</strong><small id="phase"></small></div><div class="contender enemy"><span><b>Тренер</b><small>Соперник</small></span>${avatar('prince','red')}</div></div>
    <div class="board" id="board" tabindex="0" aria-label="Арена. Выберите карту, затем кликните по полю или используйте стрелки и Enter.">
      <div class="arena-shade"></div><div id="zone"></div><div id="towers"></div><div id="units"></div><svg id="shots" viewBox="0 0 1000 600" preserveAspectRatio="none"></svg><div id="effects"></div><div id="aim"></div>
      <span class="board-tag">${i('shield',13)} ТРЕНИРОВОЧНЫЙ ЛАГЕРЬ</span>
      <span class="map-label red">ВРАГ</span><span class="map-label blue">ВЫ</span>
      <div id="board-help" class="board-help">${i('mouse-pointer-2',13)} <span>Выберите карту и разместите её на арене</span></div>
    </div>
    <div class="play-tray"><div class="tray-head"><div>${i('layers',15)} <b>ВАША РУКА</b></div><button class="keys" data-action="help" title="Управление">${i('keyboard',16)} <span>Клавиши 1–4</span></button></div><div id="hand" class="hand"></div><div class="elixir"><span class="elixir-count">${drop}<strong id="elixir-count">5</strong></span><div id="elixir-bar" class="elixir-bar" role="progressbar" aria-label="Эликсир" aria-valuemin="0" aria-valuemax="10">${Array.from({length:10},()=>'<span><em></em></span>').join('')}</div><span class="elixir-max">/ 10</span></div></div>
  </section><aside class="intel" aria-label="Информация о бое">
    <section class="panel score-panel"><div class="panel-title"><span class="panel-icon gold">${i('trophy',17)}</span><h2>Счёт боя</h2><span id="status" class="status"><em></em> ГОТОВНОСТЬ</span></div><div class="score-numbers"><div class="score-team blue">${i('crown',23)}<strong id="blue-score">0</strong><span>Вы</span></div><span class="versus">VS</span><div class="score-team red">${i('crown',23)}<strong id="red-score">0</strong><span>Тренер</span></div></div><div class="score-foot">${i('target',16)} <span>Сложность</span><button data-action="difficulty" title="Настроить сложность">${DIFFICULTY[battle.difficulty]} ${i('chevron-down',13)}</button></div></section>
    <section class="panel log-panel"><div class="panel-title"><span class="panel-icon slate">${i('history',18)}</span><h2>Ход боя</h2></div><div id="log" class="log" aria-live="polite"></div></section>
    <section class="tip"><span class="tip-glyph" aria-hidden="true">${i('lightbulb',106)}</span><div class="tip-title"><span>${i('lightbulb',17)}</span><h2>Совет тренера</h2></div><p>Ставьте бойцов за башней, чтобы накопить эликсир и собрать сильную атаку у моста.</p><button data-action="help">Как играть ${i('arrow-up-right',14)}</button></section>
  </aside></div>`;
}
function cardMarkup(id,slot,hand=false) {
  const c=CARDS[id];
  return `<button class="card ${c.spell?'spell':''}" ${hand?`data-slot="${slot}" aria-pressed="false"`:`data-card="${id}"`} title="${c.name} · ${c.cost} эликсира" aria-label="${hand?`Карта ${slot+1}: `:''}${c.name}, эликсир ${c.cost}"><img draggable="false" src="${cardImg(id)}" alt=""><span class="card-cost">${c.cost}</span>${hand?`<span class="card-key">${slot+1}</span>`:''}<span class="card-name">${c.name}</span></button>`;
}
function renderHand() {
  const hand=$('#hand'); if(!hand)return;
  const id=battle.queue[0];
  hand.innerHTML=`<div class="next-card"><small>СЛЕДУЮЩАЯ</small><div title="${CARDS[id].name}"><img src="${cardImg(id)}" alt="${CARDS[id].name}"><span>${CARDS[id].cost}</span></div></div><div class="cards">${battle.hand.map((id,j)=>cardMarkup(id,j,true)).join('')}</div>`;
  updateSelection();
}
function renderTowers() {
  const root=$('#towers'); if(!root)return;
  root.innerHTML=battle.towers.map(t=>`<div id="tower-${t.id}" class="tower ${t.king?'king':''} ${t.side}" style="left:${t.x/W*100}%;top:${t.y/H*100}%"><img src="/art/${t.king?'tower':'princess'}-${t.side}.webp" alt=""><div class="tower-hp"><span>${t.hp}</span><div><em></em></div></div></div>`).join('');
}
function renderLog() {
  const root=$('#log'); if(!root)return;
  root.innerHTML=logs.map(o=>`<div class="log-row"><span class="log-icon ${o.side}">${i(o.icon,15)}</span><span>${o.text}</span><time>${o.time}</time></div>`).join('');
  if(logs.length===1)root.insertAdjacentHTML('beforeend','<p class="log-note">Здесь появятся события боя.</p>');
}
function heading(k,title,subtitle,action='') {
  return `<section class="page-heading"><div><div class="eyebrow"><span></span> ${k}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</section>`;
}
function otherView() {
  if(current==='deck') {
    return heading('ПОДГОТОВКА','Боевая колода','Соберите восемь карт для следующего боя.',`<button class="primary" data-action="save-deck">${i('check',18)} Сохранить</button>`)+
    `<section class="panel gallery"><h2>Ваша колода <small>8 / 8</small></h2><p>Выберите карту в колоде, а затем нажмите на карту для замены.</p><div class="gallery-cards deck-cards">${(draft||deck).map((id,j)=>`<div class="deck-entry ${j===editSlot?'focused':''}" data-edit="${j}">${cardMarkup(id,j)}</div>`).join('')}</div></section><section class="panel gallery"><h2>Доступные для замены</h2><div class="gallery-cards">${Object.keys(CARDS).filter(id=>!(draft||deck).includes(id)).map(id=>cardMarkup(id,0)).join('')}</div></section>`;
  }
  if(current==='collection')return heading('КАРТЫ','Коллекция','Познакомьтесь с бойцами и заклинаниями.')+`<section class="panel gallery"><h2>Все карты <small>${Object.keys(CARDS).length}</small></h2><div class="gallery-cards">${Object.keys(CARDS).map(id=>cardMarkup(id,0)).join('')}</div></section>`;
  if(current==='stats')return heading('ПРОФИЛЬ','Статистика','Результаты ваших тренировочных боёв.')+`<div class="stat-grid">${[['trophy','Победы',stats.wins,'gold'],['shield','Поражения',stats.losses,'red'],['swords','Ничьи',stats.draws,'slate'],['crown','Короны',stats.crowns,'blue']].map(([icon,label,n,c])=>`<section class="panel stat"><span class="panel-icon ${c}">${i(icon,21)}</span><b>${n}</b><small>${label}</small></section>`).join('')}</div>`;
  return heading('ПРОФИЛЬ','Настройки','Настройте звук и сложность тренировки.')+`<section class="panel gallery settings-panel"><div class="setting-row"><div><h2>Звук</h2><p>Звуковые эффекты игры</p></div><button class="secondary-btn" data-action="sound">${i(sound?'volume-2':'volume-x',18)} ${sound?'Включён':'Выключен'}</button></div><div class="setting-row"><div><h2>Сложность</h2><p>Применится в следующем бою</p></div><button class="secondary-btn" data-action="difficulty">${DIFFICULTY[difficulty]} ${i('chevron-down',15)}</button></div><div class="setting-row"><div><h2>Управление</h2><p>Подсказки по игре</p></div><button class="secondary-btn" data-action="help">${i('circle-help',18)} Как играть</button></div></section>`;
}
function go(page) {
  if(!pages[page]||modal)return;
  if(page==='deck'){draft=[...deck];editSlot=-1;}
  current=page; selected=-1; paused=current!=='arena'; render(); window.scrollTo(0,0);
}
function updateSelection() {
  const board=$('#board'); if(!board)return;
  const active=selected>=0 ? CARDS[battle.hand[selected]]:null;
  board.classList.toggle('targeting',!!active);
  board.classList.toggle('targeting-spell',!!active?.spell);
  $('#board-help').classList.toggle('active',!!active);
  $('#board-help span').textContent=active?(active.spell?'Выберите цель на арене':'Выберите точку на своей половине'):'Выберите карту и разместите её на арене';
  if(!active)$('#aim').style.display='none';
  document.querySelectorAll('[data-slot]').forEach((button,j)=>{button.classList.toggle('chosen',j===selected);button.setAttribute('aria-pressed',j===selected);});
}
function select(slot) {
  if(battle.phase==='ended'||paused||current!=='arena')return;
  if(selected===slot){selected=-1;updateSelection();return;}
  if(battle.elixir+1e-7<CARDS[battle.hand[slot]].cost){toast('Недостаточно эликсира.');return;}
  selected=slot; updateSelection(); soundFx();
}
function toast(text) {
  const node=$('#toast'); clearTimeout(toastTimer); node.innerHTML=`${i('info',17)}<span>${text}</span>`; node.classList.add('visible');
  toastTimer=setTimeout(()=>node.classList.remove('visible'),2600);
}
function aim(x,y) {
  const card=CARDS[battle.hand[selected]]; if(!card)return;
  const el=$('#aim'); el.style.display='block'; el.style.left=`${x/W*100}%`;el.style.top=`${y/H*100}%`;
  el.classList.toggle('invalid',x<32||x>968||y<30||y>570||!card.spell&&y<339);
  el.style.width=card.spell?`${card.radius/W*200}%`:'';
}
function play(x,y) {
  if(selected<0||paused)return;
  const result=battle.deploy(selected,x,y);
  if(result){toast(result);return;}
  selected=-1; soundFx('deploy'); renderHand(); draw();
}
function mapPoint(e,board=$('#board')) {
  const r=board.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*H];
}
let keyAim=[307,411];
function draw() {
  if(current!=='arena'||!$('#board'))return;
  const phase=battle.phase;
  $('#board').dataset.phase=phase;
  $('#time').textContent=formatTime(Math.ceil(battle.left));
  $('#phase').textContent=phase==='overtime'?'ДОП. ВРЕМЯ':phase==='live'&&battle.left<=60?'×2 ЭЛИКСИР':'';
  $('#phase').parentElement.classList.toggle('overtime',phase==='overtime');
  const status=$('#status'), tag=phase==='ready'?'ГОТОВНОСТЬ':phase==='ended'?'ЗАВЕРШЁН':'В БОЮ';
  if(status.dataset.phase!==phase) {status.dataset.phase=phase;status.innerHTML=`<em></em> ${tag}`;}
  $('#blue-score').textContent=battle.crowns.blue; $('#red-score').textContent=battle.crowns.red;
  const n=battle.elixir; $('#elixir-count').textContent=Math.floor(n+1e-7);
  $('#elixir-bar').setAttribute('aria-valuenow',Math.floor(n+1e-7));
  $('#elixir-bar').querySelectorAll('em').forEach((el,j)=>el.style.width=`${Math.min(1,Math.max(0,n-j))*100}%`);
  document.querySelectorAll('[data-slot]').forEach((el,j)=>el.classList.toggle('unaffordable',n<CARDS[battle.hand[j]].cost));
  for(const t of battle.towers) {
    const node=$(`#tower-${t.id}`);
    node.classList.toggle('destroyed',t.hp<=0); node.querySelector('.tower-hp span').textContent=t.hp;
    node.querySelector('.tower-hp em').style.width=`${100*t.hp/t.maxHp}%`;
  }
  const u=$('#units'), alive=new Set(battle.units.map(a=>`unit-${a.id}`));
  for(const el of u.children)if(!alive.has(el.id))el.dataset.dead='true';
  u.querySelectorAll('[data-dead]').forEach(el=>el.remove());
  for(const a of battle.units) {
    let el=$(`#unit-${a.id}`);
    if(!el){el=document.createElement('div');el.id=`unit-${a.id}`;el.className=`unit ${a.side} ${a.card}`;el.innerHTML=`<img src="${unitImg(a.card)}" alt=""><span><em></em></span>`;u.append(el);}
    el.style.left=`${a.x/W*100}%`;el.style.top=`${a.y/H*100}%`;el.style.zIndex=Math.floor(a.y);el.querySelector('em').style.width=`${a.hp/a.maxHp*100}%`;
  }
  let particles='',lines='';
  for(const v of battle.effects) {
    if(v.kind==='shot'){
      const progress=Math.min(1,1-v.life/.22), x=(v.x-v.fromX)*progress+v.fromX, y=(v.y-v.fromY)*progress+v.fromY;
      lines+=`<line class="${v.side}" x1="${(v.fromX+x)/2}" y1="${(v.fromY+y)/2}" x2="${x}" y2="${y}" /><circle class="${v.side}" cx="${x}" cy="${y}" r="4.4"/>`;
    }else particles+=`<span class="effect ${v.kind}" style="left:${v.x/W*100}%;top:${v.y/H*100}%;--p:${Math.min(1,1-v.life/(v.kind==='strike'?.22:v.kind==='break'?.72:.66))}"></span>`;
  }
  $('#shots').innerHTML=lines;$('#effects').innerHTML=particles;
}
let returnFocus=null;
function open(type,cardId) {
  if(!modal)returnFocus=document.activeElement;
  modal=type;
  let title='',body='',foot='',ico='info';
  if(type==='help') {
    title='Как играть';ico='circle-help';body=`<ol class="guide"><li><b>Выберите карту.</b> Нажмите на неё или используйте клавиши 1–4. Для розыгрыша нужен эликсир.</li><li><b>Разместите отряд.</b> Нажмите на свою половину арены. Заклинания работают на обеих сторонах. С клавиатуры: Tab до арены, затем стрелки и Enter.</li><li><b>Защитите свои башни.</b> Бойцы сами двигаются и атакуют. Разрушенная башня даёт корону, а падение башни короля сразу заканчивает бой.</li></ol>`;foot=`<button class="primary" data-action="close">Понятно</button>`;
  } else if(type==='difficulty') {
    title='Сложность боя';ico='target';body=`<p>Изменение вступит в силу в следующем бою.</p><div class="difficulty-options">${Object.entries(DIFFICULTY).map(([key,label])=>`<button class="secondary-btn ${key===difficulty?'picked':''}" data-difficulty="${key}">${label}${key===difficulty?i('check',15):''}</button>`).join('')}</div>`;
  } else if(type==='new') {
    title='Начать новый бой?';ico='swords';body='<p>Текущий бой завершится без учёта в статистике.</p>';foot='<button class="secondary-btn" data-action="close">Продолжить бой</button><button class="primary" data-action="replay">Новый бой</button>';
  } else if(type==='card') {
    const c=CARDS[cardId];title=c.name;ico='layers';body=`<div class="card-detail"><img src="${cardImg(cardId)}" alt=""><div><p>${c.type} · ${c.cost} эликсира</p><p>${c.info}</p></div></div>`;foot='<button class="secondary-btn" data-action="close">Закрыть</button>';
  } else if(type==='end') {
    title=battle.winner==='blue'?'Победа!':battle.winner==='red'?'Поражение':'Ничья';ico='trophy';body=`<div class="result-score"><span>${i('crown',24)} ${battle.crowns.blue}</span><b>:</b><span>${battle.crowns.red} ${i('crown',24)}</span></div><p>${battle.winner==='blue'?'Вы победили тренера и получили 30 трофеев.':battle.winner==='red'?'Попробуйте другую колоду или тактику.':'Обе стороны показали равный результат.'}</p>`;foot='<button class="secondary-btn" data-action="close">На арену</button><button class="primary" data-action="replay">Играть снова</button>';
  }
  $('#overlay').innerHTML=`<div class="scrim" data-action="dismiss"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button class="icon-btn close-btn" data-action="close" aria-label="Закрыть">${i('x',19)}</button><span class="dialog-icon">${i(ico,23)}</span><h2 id="dialog-title">${title}</h2>${body}${foot?`<div class="dialog-foot">${foot}</div>`:''}</section></div>`;
  $('.close-btn').focus();
}
function close() { modal=''; $('#overlay').innerHTML=''; if(returnFocus?.isConnected)returnFocus.focus(); returnFocus=null; }
function begin() { close(); current='arena'; reset(true); render(); soundFx('deploy'); }
app.addEventListener('click',e=>{
  const target=e.target.closest('button');
  if(modal&&!e.target.closest('.dialog')){if(e.target.classList.contains('scrim'))close();return;}
  if(target?.dataset.page){go(target.dataset.page);return;}
  if(target?.dataset.difficulty){difficulty=target.dataset.difficulty;save('difficulty',difficulty);close();if(battle.phase==='ready')reset();render();return;}
  if(target?.dataset.action) {
    switch(target.dataset.action){
      case 'sound':{sound=!sound;save('sound',sound);if(sound)soundFx();if(current==='settings')render();else{target.innerHTML=i(sound?'volume-2':'volume-x',19);const label=sound?'Выключить звук':'Включить звук';target.setAttribute('aria-label',label);target.title=label;}break;}
      case 'new': ['live','overtime'].includes(battle.phase)?open('new'):begin();break;
      case 'replay':begin();break;
      case 'close':close();break;
      case 'help':open('help');break;
      case 'difficulty':open('difficulty');break;
      case 'menu':$('.sidebar').classList.toggle('mobile-open');break;
      case 'save-deck':deck=[...(draft||deck)];save('deck',deck);if(battle.phase==='ready')reset();toast('Колода сохранена.');break;
    }
    return;
  }
  if(modal)return;
  if(target?.dataset.slot!==undefined){select(Number(target.dataset.slot));return;}
  if(target?.dataset.card) {
    if(current==='deck') {
      const entry=target.closest('[data-edit]');
      if(entry){editSlot=Number(entry.dataset.edit);render();return;}
      if(editSlot<0){toast('Сначала выберите карту в вашей колоде.');return;}
      draft[editSlot]=target.dataset.card;editSlot=-1;render();return;
    }
    open('card',target.dataset.card);return;
  }
  const board=e.target.closest('#board');
  if(board&&selected>=0)play(...mapPoint(e,board));
});
app.addEventListener('pointermove',e=>{
  const board=$('#board'); if(!board||modal)return;
  if(pointer && pointer.id===e.pointerId && Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>14 && e.target.closest('#board') && selected!==pointer.slot){
    if(battle.elixir>=CARDS[battle.hand[pointer.slot]].cost)select(pointer.slot);
  }
  if(e.target.closest('#board')&&selected>=0)aim(...mapPoint(e,board));else $('#aim').style.display='none';
});
app.addEventListener('pointerdown', e=>{
  const el=e.target.closest('[data-slot]'); if(el&&!modal)pointer={id:e.pointerId,x:e.clientX,y:e.clientY,slot:Number(el.dataset.slot)};
});
window.addEventListener('pointerup',e=>{
  if(pointer?.id===e.pointerId){
    const board=$('#board');
    if(board&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>20){
      const [x,y]=mapPoint(e,board);
      if(x>0&&x<W&&y>0&&y<H){ if(selected!==pointer.slot)select(pointer.slot);if(selected===pointer.slot)play(x,y); }
    }
    pointer=null;
  }
});
window.addEventListener('pointercancel',()=>{pointer=null;});
window.addEventListener('keydown',e=>{
  if(modal){
    if(e.key==='Escape')close();
    if(e.key==='Tab'){
      const buttons=[...document.querySelectorAll('.dialog button')]; const index=buttons.indexOf(document.activeElement);
      if(e.shiftKey&&index<=0){e.preventDefault();buttons.at(-1).focus();}else if(!e.shiftKey&&index===buttons.length-1){e.preventDefault();buttons[0].focus();}
    }
    return;
  }
  if(current!=='arena'||e.altKey||e.ctrlKey||e.metaKey||e.repeat&&!e.key.startsWith('Arrow'))return;
  if(/^[1-4]$/.test(e.key)){e.preventDefault();select(+e.key-1);return;}
  if(e.key==='Escape'&&selected>=0){selected=-1;updateSelection();return;}
  if(document.activeElement===$('#board')&&selected>=0){
    let [x,y]=keyAim;
    if(e.key==='ArrowLeft')x-=30;else if(e.key==='ArrowRight')x+=30;else if(e.key==='ArrowUp')y-=30;else if(e.key==='ArrowDown')y+=30;else if(e.key==='Enter'){e.preventDefault();play(x,y);return;}else return;
    e.preventDefault();keyAim=[Math.max(35,Math.min(965,x)),Math.max(35,Math.min(565,y))];aim(...keyAim);
  }
});
function finish() {
  endShown=true;const field=battle.winner==='blue'?'wins':battle.winner==='red'?'losses':'draws';
  stats[field]++;stats.crowns+=battle.crowns.blue;save('stats',stats);
  document.querySelector('.trophy-pill strong').textContent=trophies();selected=-1;updateSelection();
  if(battle.winner==='blue')soundFx('win');open('end');
}
reset();render();
let last=performance.now(),acc=0;
function loop(now) {
  if(!paused&&!modal&&!document.hidden){
    const dt=Math.max(0,Math.min(.075,(now-last)/1000));
    const needsDraw=battle.phase==='live'||battle.phase==='overtime'||battle.effects.length>0;
    battle.tick(dt);acc+=dt;
    if(needsDraw&&acc>=.033){acc=0;draw();}
    if(battle.phase==='ended'&&!endShown){draw();finish();}
  }
  last=now;requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
