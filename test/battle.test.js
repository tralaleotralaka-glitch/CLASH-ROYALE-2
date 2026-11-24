import test from 'node:test';
import assert from 'node:assert/strict';
import {Battle, DEFAULT_DECK} from '../src/battle.js';

test('deploy validates territory and elixir, spends elixir and cycles cards',()=>{
  const game=new Battle();
  assert.ok(game.deploy(0,307,130));
  assert.equal(game.phase,'ready');
  assert.equal(game.deploy(0,307,410),null);
  assert.equal(game.phase,'live');
  assert.equal(game.elixir,2);
  assert.equal(game.hand[0],DEFAULT_DECK[4]);
  assert.equal(game.queue.at(-1),DEFAULT_DECK[0]);
  assert.ok(game.deploy(1,307,410));
  assert.equal(game.units.length,1);
});
test('spells damage enemy buildings on enemy territory and start the match',()=>{
  const game=new Battle();
  const target=game.towers[0];
  assert.equal(game.deploy(3,target.x,target.y),null);
  assert.equal(target.hp,target.maxHp-230);
  assert.equal(game.elixir,1);
});
test('the bot enters play and units cross bridges to attack towers',()=>{
  const game=new Battle({random:()=>0, difficulty:'easy'});
  const target=game.towers[2];
  game.deploy(2,target.x,362);
  for(let n=0;n<700;n++)game.tick(1/60);
  assert.ok(game.units.some(a=>a.side==='red'));
  assert.ok(target.hp<target.maxHp);
  assert.ok(game.elixir>0);
});
test('a tie at regulation goes to overtime; next tower ends the battle',()=>{
  const game=new Battle();
  game.start();game.left=.02;game.tick(.03);
  assert.equal(game.phase,'overtime');
  const target=game.towers[1];game.hit(target,target.hp);
  assert.equal(game.crowns.blue,1);
  assert.equal(game.winner,'blue');
  assert.equal(game.phase,'ended');
});
test('taking the king gives three crowns and ends the battle immediately',()=>{
  const game=new Battle();game.start();
  const target=game.towers.find(t=>t.king&&t.side==='blue');
  game.hit(target,target.hp);
  assert.equal(game.crowns.red,3);
  assert.equal(game.winner,'red');
  assert.ok(game.deploy(0,307,400));
});
