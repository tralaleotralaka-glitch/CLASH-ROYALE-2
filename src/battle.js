export const CARDS = {
  knight: { name:'Рыцарь', cost:3, type:'Боец', info:'Надёжный воин ближнего боя, который прикроет дальнобойные войска.', hp:720, damage:116, range:45, speed:71 },
  archers: { name:'Лучницы', cost:3, type:'Стрелки', info:'Две лучницы атакуют издалека. Хороши в паре с прочным бойцом.', count:2, hp:260, damage:68, range:140, speed:68 },
  giant: { name:'Гигант', cost:5, type:'Танк', info:'Игнорирует войска и идёт прямо к башням, принимая урон на себя.', hp:1960, damage:198, range:48, speed:47, buildings:true },
  fireball: { name:'Огненный шар', cost:4, type:'Заклинание', info:'Наносит мощный урон врагам в области. Можно бросить на любую сторону.', spell:true, radius:109, damage:442, towerDamage:230 },
  'mini-pekka': { name:'Мини П.Е.К.К.А', cost:4, type:'Боец', info:'Быстрый боец, наносящий тяжёлый урон одной цели.', hp:770, damage:252, range:42, speed:87 },
  musketeer: { name:'Мушкетёр', cost:4, type:'Стрелок', info:'Стреляет с большого расстояния и поддерживает атаку из-за спин союзников.', hp:510, damage:135, range:158, speed:65 },
  goblins: { name:'Гоблины', cost:2, type:'Бойцы', info:'Три быстрых гоблина, которые отлично окружают одиночные цели.', count:3, hp:185, damage:65, range:36, speed:105 },
  arrows: { name:'Стрелы', cost:3, type:'Заклинание', info:'Накрывают большую площадь. Особенно полезны против слабых отрядов.', spell:true, radius:154, damage:275, towerDamage:120 },
  prince: { name:'Принц', cost:5, type:'Боец', info:'Быстро добирается до цели и наносит сильный удар копьём.', hp:1090, damage:222, range:45, speed:101 },
  'baby-dragon': { name:'Дракончик', cost:4, type:'Стрелок', info:'Атакует огнём по площади и может перелететь через реку.', hp:840, damage:116, range:124, speed:82, flying:true, splash:64 },
  valkyrie: { name:'Валькирия', cost:4, type:'Боец', info:'Круговой удар топором поражает всех врагов рядом с ней.', hp:1020, damage:149, range:43, speed:69, splash:71 },
  'skeleton-army': { name:'Армия скелетов', cost:3, type:'Бойцы', info:'Много хрупких, но быстрых бойцов для защиты от одиночных целей.', count:5, hp:95, damage:43, range:32, speed:86 },
};
export const DEFAULT_DECK = ['knight','archers','giant','fireball','mini-pekka','musketeer','goblins','arrows'];
export const DIFFICULTY = { easy:'Новичок', normal:'Обычный', hard:'Ветеран' };
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const cap = (x,min,max) => Math.min(max,Math.max(min,x));
const enemy = s => s === 'blue' ? 'red' : 'blue';
export const formatTime = secs => `${Math.floor(secs/60)}:${String(Math.floor(secs%60)).padStart(2,'0')}`;
export const W = 1000, H = 600;

export class Battle {
  constructor({deck=DEFAULT_DECK, difficulty='normal', notify=()=>{}, random=Math.random}={}) {
    this.difficulty=difficulty; this.notify=notify; this.random=random;
    this.deck=[...deck]; this.hand=deck.slice(0,4); this.queue=deck.slice(4);
    this.t=0; this.left=180; this.phase='ready'; this.elixir=5; this.botElixir=5; this.nextBot=4;
    this.towers=[]; this.units=[]; this.effects=[]; this.crowns={blue:0,red:0}; this.id=0;
    for (const side of ['red','blue']) {
      const blue=side==='blue';
      for (const [x,y,king] of [[500,blue?471:107,true],[307,blue?435:165,false],[693,blue?435:165,false]]) {
        const hp=king?4008:2534;
        this.towers.push({id:++this.id,tower:true,side,x,y,king,hp,maxHp:hp,cooldown:0});
      }
    }
  }
  start() { if(this.phase==='ready') { this.phase='live'; this.notify('Бой начался!','swords','blue'); } }
  finish(winner) { if(this.phase==='ended')return; this.phase='ended'; this.winner=winner; this.notify(winner==='blue'?'Победа!':winner==='red'?'Соперник победил.':'Бой завершился вничью.','trophy',winner); }
  deploy(slot,x,y) {
    const id=this.hand[slot], card=CARDS[id];
    if(!card || this.phase==='ended')return 'Бой уже завершён.';
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<32||x>968||y<30||y>570)return 'Выберите точку внутри арены.';
    if(!card.spell && y<339)return 'Войска можно выставлять только на своей стороне.';
    if(this.elixir<card.cost)return 'Не хватает эликсира.';
    this.start(); this.elixir-=card.cost;
    this.hand[slot]=this.queue.shift(); this.queue.push(id);
    this.notify(`Вы разыграли: ${card.name}`,'layers','blue');
    this.spawn(id,'blue',x,y);
    return null;
  }
  spawn(id,side,x,y) {
    const card=CARDS[id];
    if(card.spell) {
      this.effects.push({kind:id,x,y,side,life:.66,id:++this.id});
      for(const target of [...this.units,...this.towers]) {
        if(target.side!==side && distance({x,y},target)<card.radius) this.hit(target,target.tower?card.towerDamage:card.damage);
      }
      return;
    }
    const count=card.count||1;
    for(let i=0;i<count;i++) this.units.push({id:++this.id,card:id,side,x:x+(i-(count-1)/2)*14,y:y+(i%2)*15,lane:x<500?307:693,hp:card.hp,maxHp:card.hp,cooldown:.32+i*.07});
  }
  hit(target,damage) {
    if(target.hp<=0 || this.phase==='ended')return;
    target.hp=Math.max(0,target.hp-damage);
    if(target.hp===0 && target.tower) {
      const side=enemy(target.side);
      this.effects.push({kind:'break',side,x:target.x,y:target.y,life:.72,id:++this.id});
      this.crowns[side]=target.king?3:this.crowns[side]+1;
      this.notify(target.side==='red'?'Башня соперника разрушена!':'Ваша башня разрушена!','crown',side);
      if(target.king || this.phase==='overtime')this.finish(side);
    }
  }
  bot() {
    const ids=this.difficulty==='easy'?['knight','archers','giant','goblins']:['knight','archers','giant','goblins','valkyrie','prince','musketeer','fireball'];
    const targets=this.units.filter(a=>a.side==='blue'&&a.hp>0);
    const threat=targets.find(a=>a.y<350);
    const options=ids.filter(id=>CARDS[id].cost<=this.botElixir && (!CARDS[id].spell||targets.length>1));
    if(!options.length)return;
    const id=options[Math.floor(this.random()*options.length)], lane=threat?.lane??(this.random()<.5?307:693);
    this.botElixir-=CARDS[id].cost;
    if(CARDS[id].spell) {
      const a=targets[Math.floor(this.random()*targets.length)]; this.spawn(id,'red',a.x,a.y);
    } else this.spawn(id,'red',lane+(this.random()-.5)*65,threat?233:168+this.random()*64);
    this.notify(`Соперник: ${CARDS[id].name}`,'layers','red');
  }
  tick(dt) {
    this.effects=this.effects.filter(e=>(e.life-=dt)>0);
    if(!['live','overtime'].includes(this.phase))return;
    this.t+=dt; this.left=Math.max(0,this.left-dt);
    if(this.left<=0) {
      if(this.crowns.blue!==this.crowns.red) { this.finish(this.crowns.blue>this.crowns.red?'blue':'red'); return; }
      if(this.phase==='overtime') {
        const least=side=>Math.min(...this.towers.filter(a=>a.side===side&&a.hp>0).map(a=>a.hp));
        this.finish(least('blue')===least('red')?'draw':least('blue')>least('red')?'blue':'red'); return;
      }
      this.phase='overtime'; this.left=60; this.notify('Доп. время: первая башня решает исход!','timer','gold');
    }
    const regen=this.phase==='overtime'?1.03:this.left<=60?.72:.39;
    this.elixir=cap(this.elixir+dt*regen,0,10);
    this.botElixir=cap(this.botElixir+dt*regen*({easy:.79,normal:1.04,hard:1.33}[this.difficulty]??1),0,10);
    if(this.t>=this.nextBot) {
      this.bot(); this.nextBot=this.t+({easy:6.8,normal:4.7,hard:3.15}[this.difficulty]??4.7)+this.random()*2.5;
    }
    const living=(list,side)=>list.filter(a=>a.side===side&&a.hp>0);
    const nearest=(a,list,range=Infinity)=>list.reduce(([best,d],b)=>{let n=distance(a,b);return n<d?[b,n]:[best,d];},[null,range]);
    for(const a of this.units) {
      if(a.hp<=0 || this.phase==='ended')continue;
      const card=CARDS[a.card], side=enemy(a.side);
      const units=living(this.units,side), towers=living(this.towers,side);
      const crossed=a.side==='blue'?a.y<268:a.y>332;
      const [mark]=nearest(a,card.buildings?[]:units,card.range+40);
      const [building]=nearest(a,towers.filter(b=>distance(a,b)<card.range+25));
      const target=mark||building;
      a.cooldown-=dt;
      if(target && distance(a,target)<card.range+(target.tower?19:11) && (card.flying||Math.abs(a.y-target.y)<53||crossed||target.y>332&&a.y>332||target.y<268&&a.y<268)) {
        if(a.cooldown<=0) {
          a.cooldown=.86;
          this.hit(target,card.damage);
          if(card.splash)for(const victim of units)if(victim!==target&&distance(victim,target)<card.splash)this.hit(victim,card.damage);
          this.effects.push({kind:card.range>100?'shot':'strike',x:target.x,y:target.y,fromX:a.x,fromY:a.y,side:a.side,id:++this.id,life:.22});
        }
        continue;
      }
      const [tower]=nearest(a,towers.filter(b=>!b.king && (b.x<500)===(a.lane<500)));
      const [king]=nearest(a,towers);
      const bridge={x:a.lane,y:a.side==='blue'?263:337};
      let goal=tower||king;
      if(!card.flying&&!crossed) {
        const sameBank=target&&(a.side==='blue'?target.y>332&&a.y>332:target.y<268&&a.y<268);
        goal=sameBank?target:(Math.abs(a.x-a.lane)>15&&(a.y>333||a.y<267)?{x:a.lane,y:a.side==='blue'?345:255}:bridge);
      } else if(target)goal=target;
      if(!goal)continue;
      const d=distance(a,goal);
      if(d>0.01) { const s=Math.min(d,card.speed*dt)/d; a.x+=(goal.x-a.x)*s; a.y+=(goal.y-a.y)*s; }
    }
    for(const tower of this.towers) {
      if(tower.hp<=0||this.phase==='ended')continue;
      if(tower.king&&tower.hp===tower.maxHp&&this.towers.every(a=>a.side!==tower.side||a.hp>0))continue;
      tower.cooldown-=dt;
      const [target]=nearest(tower,living(this.units,enemy(tower.side)),tower.king?147:158);
      if(target&&tower.cooldown<=0) {
        tower.cooldown=tower.king?.92:.81; this.hit(target,tower.king?100:83);
        this.effects.push({kind:'shot',x:target.x,y:target.y,fromX:tower.x,fromY:tower.y,side:tower.side,id:++this.id,life:.21});
      }
    }
    this.units=this.units.filter(a=>a.hp>0);
  }
}
