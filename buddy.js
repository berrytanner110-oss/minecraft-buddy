'use strict';

const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalNear, GoalFollow, GoalBlock, GoalXZ } = require('mineflayer-pathfinder').goals;
const pvp = require('mineflayer-pvp').plugin;
const collectBlock = require('mineflayer-collectblock').plugin;
const { Vec3 } = require('vec3');
const fs = require('fs');
const path = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BOT_USERNAME = 'Buddy';
const OWNER = 'lol_thegoaty';
const SERVER_HOST = 'localhost';
const SERVER_PORT = 50290;

// ─── PERSISTENCE FILES ────────────────────────────────────────────────────────
const WAYPOINTS_FILE = path.join(__dirname, 'waypoints.json');
const MACROS_FILE = path.join(__dirname, 'macros.json');

// ─── STATE ────────────────────────────────────────────────────────────────────
let followingPlayer = false;
let guardMode = false;
let guardPos = null;
let combatStyle = 'normal'; // normal | aggressive | defensive | tank
let currentTask = null;     // string label of current task
let huntMode = false;
let autoFarmLoop = false;
let autoPickup = true;
let nightWatchEnabled = true;
let alarmEnabled = false;
let doorsEnabled = true;
let fishingActive = false;
let treeFarmActive = false;
let patrolActive = false;
let patrolWaypoints = [];
let patrolIndex = 0;
let duelActive = false;
let autoFarmInterval = null;
let suggestionCooldowns = {};
let alarmCooldowns = {};
let previousTask = null;
let creeperDodgeActive = false;

// Mood system
let mood = 'neutral'; // happy | neutral | hurt | hungry | scared

// Waypoints + Macros
let waypoints = {};
let macros = {};

// ─── HOSTILE MOB PRIORITY ─────────────────────────────────────────────────────
const HOSTILE_PRIORITY = {
  creeper: 10, warden: 9, ender_dragon: 9, wither: 9,
  ravager: 8, elder_guardian: 7, witch: 7,
  blaze: 7, ghast: 7, phantom: 7,
  zombie: 6, skeleton: 6, spider: 5, cave_spider: 5,
  drowned: 5, husk: 5, stray: 5, pillager: 6,
  vindicator: 6, evoker: 7, vex: 5,
  hoglin: 5, zoglin: 5, piglin_brute: 6,
  silverfish: 2, endermite: 1,
  slime: 3, magma_cube: 3,
  wither_skeleton: 6, guardian: 5,
  enderman: 4, shulker: 4, bogged: 5, breeze: 6
};
const HOSTILE_LIST = Object.keys(HOSTILE_PRIORITY);

// ─── RANGED MOBS (prefer bow against these) ───────────────────────────────────
const RANGED_MOB_TYPES = ['ghast', 'skeleton', 'blaze', 'stray', 'bogged'];

// ─── PERSONALITY RESPONSES ────────────────────────────────────────────────────
const RESPONSES = {
  follow:     ['Right behind you!', 'On my way!', 'Coming!', "Let's go!", 'Following!'],
  stop:       ['Stopping.', 'Got it, staying put.', 'Halted!', 'Alright, I\'ll chill here.'],
  attack:     ['On it!', 'Engaging target!', 'I\'ll take care of them!', 'Attack mode!', 'For you!'],
  guard:      ['Guard mode on! I\'ve got your back.', 'Protecting you!', 'Nothing gets past me!', 'On guard!'],
  mine:       ['Mining!', 'On it!', 'Digging now!', 'Leave it to me!'],
  build:      ['Building now!', 'On it!', 'Let\'s construct!', 'I\'ll handle it!'],
  farm:       ['Farming time!', 'Let\'s grow some food!', 'On it!', 'Fields incoming!'],
  waypoint:   ['Saved that spot!', 'Waypoint remembered!', 'Got it marked!'],
  gowaypoint: ['Heading there!', 'On my way to that spot!', 'Let\'s go!', 'Pathfinding!'],
  macro:      ['Macro learned!', 'Got it, boss!', 'Stored that sequence!'],
  duel:       ['Let\'s spar! No hard feelings!', 'Bring it on!', 'Fight me!', "Let's dance!"],
  fish:       ['Casting line!', 'Time to fish!', 'Let\'s catch something!'],
  scout:      ['Scouting ahead!', 'On reconnaissance!', 'I\'ll check it out!'],
  patrol:     ['Patrol started!', 'Walking the beat!', 'Patrolling!'],
  craft:      ['Crafting now!', 'On it!', 'Working on it!'],
  cook:       ['Firing up the furnace!', 'Smelting time!', 'On it!'],
  breed:      ['Matchmaking time!', 'On it!', "Let's make some babies!"],
  chop:       ['Timber!', 'Chopping trees!', 'On it!', 'Lumberjack mode!'],
  pickup:     ['Auto-pickup toggled!', 'Got it!'],
  win:        ['Woohoo! I won!', 'Too easy!', "Don't worry, I held back!", 'Victory!'],
  lose:       ['You got me...', 'Good fight!', 'I let you win 😄', 'Next time I\'ll win!']
};

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── LOAD PERSISTENCE ─────────────────────────────────────────────────────────
function loadWaypoints() {
  try {
    if (fs.existsSync(WAYPOINTS_FILE)) {
      waypoints = JSON.parse(fs.readFileSync(WAYPOINTS_FILE, 'utf8'));
      console.log(`Loaded ${Object.keys(waypoints).length} waypoints.`);
    }
  } catch (e) { console.error('Failed to load waypoints:', e.message); }
}

function saveWaypoints() {
  try { fs.writeFileSync(WAYPOINTS_FILE, JSON.stringify(waypoints, null, 2)); }
  catch (e) { console.error('Failed to save waypoints:', e.message); }
}

function loadMacros() {
  try {
    if (fs.existsSync(MACROS_FILE)) {
      macros = JSON.parse(fs.readFileSync(MACROS_FILE, 'utf8'));
      console.log(`Loaded ${Object.keys(macros).length} macros.`);
    }
  } catch (e) { console.error('Failed to load macros:', e.message); }
}

function saveMacros() {
  try { fs.writeFileSync(MACROS_FILE, JSON.stringify(macros, null, 2)); }
  catch (e) { console.error('Failed to save macros:', e.message); }
}

// ─── BOT CREATION ─────────────────────────────────────────────────────────────
function createBot() {
  loadWaypoints();
  loadMacros();

  const bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: BOT_USERNAME,
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);
  bot.loadPlugin(collectBlock);

  // ─── SPAWN ──────────────────────────────────────────────────────────────────
  bot.once('spawn', () => {
    console.log(`${BOT_USERNAME} joined the server!`);
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    defaultMove.allowSprinting = true;
    defaultMove.allowParkour = true;
    bot.pathfinder.setMovements(defaultMove);

    startAutoSuggestions(bot);
    startNightWatch(bot);
    startMobAlarm(bot);
    startAutoPickupLoop(bot);
  });

  // ─── CHAT ───────────────────────────────────────────────────────────────────
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    if (username !== OWNER) return;
    handleCommand(bot, username, message.trim()).catch(err => {
      console.error('Command error:', err);
    });
  });

  // ─── GUARD LOOP ─────────────────────────────────────────────────────────────
  bot.on('physicsTick', () => {
    try {
      updateMood(bot);
      if (guardMode && !bot.pvp.target) guardTick(bot);
      if (creeperDodgeActive) return;
      checkCreeperDodge(bot);
      if (autoPickup) pickupNearbyItems(bot);
      if (duelActive) checkDuelEnd(bot);
      totemEquipTick(bot);
      if (doorsEnabled) autoDoorTick(bot);
    } catch (_) {}
  });

  // ─── DISCONNECT ─────────────────────────────────────────────────────────────
  bot.on('end', () => {
    console.log('Disconnected. Reconnecting in 5s...');
    clearAllIntervals();
    setTimeout(createBot, 5000);
  });
  bot.on('error', err => console.error('Bot error:', err.message));
  bot.on('kicked', reason => console.log('Kicked:', reason));

  return bot;
}

function clearAllIntervals() {
  if (autoFarmInterval) { clearInterval(autoFarmInterval); autoFarmInterval = null; }
}

// ─── MOOD SYSTEM ──────────────────────────────────────────────────────────────
function updateMood(bot) {
  try {
    if (bot.health < 8) { mood = 'hurt'; return; }
    if (bot.food < 6) { mood = 'hungry'; return; }
    const nearCreeper = bot.nearestEntity(e => e.name === 'creeper' &&
      e.position.distanceTo(bot.entity.position) < 16);
    if (nearCreeper) { mood = 'scared'; return; }
    if (mood !== 'happy') mood = 'neutral';
  } catch (_) {}
}

function moodPrefix() {
  switch (mood) {
    case 'hurt':    return '[Ouch!] ';
    case 'hungry':  return '[Hungry] ';
    case 'scared':  return '[Scared!] ';
    case 'happy':   return '[Happy] ';
    default:        return '';
  }
}

function say(bot, text) { bot.chat(moodPrefix() + text); }

// ─── STOP ALL ─────────────────────────────────────────────────────────────────
function stopAll(bot) {
  followingPlayer = false;
  guardMode = false;
  guardPos = null;
  huntMode = false;
  fishingActive = false;
  treeFarmActive = false;
  patrolActive = false;
  duelActive = false;
  autoFarmLoop = false;
  if (autoFarmInterval) { clearInterval(autoFarmInterval); autoFarmInterval = null; }
  try { bot.pathfinder.setGoal(null); } catch (_) {}
  try { bot.pvp.stop(); } catch (_) {}
  currentTask = null;
}

// ─── GUARD TICK ───────────────────────────────────────────────────────────────
function guardTick(bot) {
  let best = null;
  let bestPriority = -1;
  for (const entity of Object.values(bot.entities)) {
    if (!entity || !entity.name) continue;
    const name = entity.name.toLowerCase();
    if (!HOSTILE_LIST.includes(name)) continue;
    const dist = entity.position.distanceTo(bot.entity.position);
    if (dist > 20) continue;
    const priority = HOSTILE_PRIORITY[name] || 0;
    if (priority > bestPriority) { bestPriority = priority; best = entity; }
  }
  if (best) bot.pvp.attack(best);
}

// ─── TOTEM TICK ───────────────────────────────────────────────────────────────
function totemEquipTick(bot) {
  if (!guardMode && !duelActive && bot.health >= 8) return;
  try {
    const totem = bot.inventory.items().find(i => i.name === 'totem_of_undying');
    if (!totem) return;
    const offhand = bot.inventory.slots[45];
    if (offhand && offhand.name === 'totem_of_undying') return;
    bot.equip(totem, 'off-hand').catch(() => {});
  } catch (_) {}
}

// ─── AUTO DOOR ────────────────────────────────────────────────────────────────
function autoDoorTick(bot) {
  try {
    const time = bot.time.timeOfDay;
    if (time < 13000) return; // only at night
    const pos = bot.entity.position;
    for (const [, entity] of Object.entries(bot.players)) {
      if (!entity || !entity.entity) continue;
      const ppos = entity.entity.position;
      if (ppos.distanceTo(pos) > 10) continue;
    }
    // Close any open doors nearby
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        for (let dy = -1; dy <= 2; dy++) {
          const block = bot.blockAt(pos.offset(dx, dy, dz));
          if (!block) continue;
          if (block.name.includes('door') && block.getProperties && block.getProperties().open === 'true') {
            bot.activateBlock(block).catch(() => {});
          }
        }
      }
    }
  } catch (_) {}
}

// ─── CREEPER DODGE ────────────────────────────────────────────────────────────
function checkCreeperDodge(bot) {
  try {
    const creeper = bot.nearestEntity(e =>
      e.name === 'creeper' && e.position.distanceTo(bot.entity.position) < 5);
    if (!creeper) return;
    if (creeperDodgeActive) return;
    creeperDodgeActive = true;
    previousTask = currentTask;
    bot.chat('CREEPER! Running!');
    const angle = Math.random() * Math.PI * 2;
    const flee = bot.entity.position.offset(Math.cos(angle) * 16, 0, Math.sin(angle) * 16);
    bot.pathfinder.setGoal(new GoalNear(flee.x, flee.y, flee.z, 2));
    setTimeout(() => {
      creeperDodgeActive = false;
      bot.chat("Safe now! Back to it.");
    }, 5000);
  } catch (_) {}
}

// ─── AUTO PICKUP ──────────────────────────────────────────────────────────────
function pickupNearbyItems(bot) {
  if (!followingPlayer && currentTask !== null) return;
  try {
    const item = bot.nearestEntity(e =>
      e.type === 'object' && e.objectType === 'Item' &&
      e.position.distanceTo(bot.entity.position) < 5);
    if (item) {
      bot.pathfinder.setGoal(new GoalNear(item.position.x, item.position.y, item.position.z, 1));
    }
  } catch (_) {}
}

function startAutoPickupLoop(_bot) {
  // handled in physicsTick
}

// ─── AUTO SUGGESTIONS ─────────────────────────────────────────────────────────
function startAutoSuggestions(bot) {
  setInterval(() => {
    try { sendSuggestions(bot); } catch (_) {}
  }, 10000);
}

function sendSuggestions(bot) {
  const now = Date.now();
  const cd = 60000;

  const time = bot.time ? bot.time.timeOfDay : 0;
  // Suggest at 13000 (same threshold as night watch) so the hint fires as night begins
  if (time > 13000 && (!suggestionCooldowns.dark || now - suggestionCooldowns.dark > cd)) {
    bot.chat("It's getting dark, want me to guard?");
    suggestionCooldowns.dark = now;
  }

  const ownerEnt = bot.players[OWNER] ? bot.players[OWNER].entity : null;
  if (ownerEnt && ownerEnt.metadata) {
    const ownerHealth = ownerEnt.metadata[9];
    if (typeof ownerHealth === 'number' && ownerHealth < 8 &&
        (!suggestionCooldowns.ownerHealth || now - suggestionCooldowns.ownerHealth > cd)) {
      bot.chat("You're low on health!");
      suggestionCooldowns.ownerHealth = now;
    }
  }

  if (bot.food < 6 && (!suggestionCooldowns.food || now - suggestionCooldowns.food > cd)) {
    bot.chat("I'm running low on food.");
    suggestionCooldowns.food = now;
  }

  const hostile = bot.nearestEntity(e => HOSTILE_LIST.includes(e.name) &&
    e.position.distanceTo(bot.entity.position) < 20);
  if (hostile && (!suggestionCooldowns.hostile || now - suggestionCooldowns.hostile > cd)) {
    bot.chat('Hostile mobs nearby!');
    suggestionCooldowns.hostile = now;
  }

  const invCount = bot.inventory.items().length;
  if (invCount > 30 && (!suggestionCooldowns.inv || now - suggestionCooldowns.inv > cd)) {
    bot.chat('My inventory is almost full!');
    suggestionCooldowns.inv = now;
  }
}

// ─── NIGHT WATCH ──────────────────────────────────────────────────────────────
let nightWatchOn = false;
function startNightWatch(bot) {
  setInterval(() => {
    if (!nightWatchEnabled) return;
    try {
      const time = bot.time ? bot.time.timeOfDay : 0;
      if (time > 13000 && !nightWatchOn && !guardMode) {
        nightWatchOn = true;
        guardMode = true;
        guardPos = bot.entity.position.clone();
        bot.chat("It's getting dark, I'll keep watch!");
      } else if (time < 1000 && nightWatchOn) {
        nightWatchOn = false;
        if (!guardMode) return;
        guardMode = false;
        bot.pvp.stop();
        bot.chat('Dawn is here. Stopping night watch.');
      }
    } catch (_) {}
  }, 5000);
}

// ─── MOB ALARM ────────────────────────────────────────────────────────────────
function startMobAlarm(bot) {
  setInterval(() => {
    if (!alarmEnabled) return;
    try { checkAlarm(bot); } catch (_) {}
  }, 3000);
}

function checkAlarm(bot) {
  const now = Date.now();
  for (const [id, entity] of Object.entries(bot.entities)) {
    if (!entity || !entity.name) continue;
    const name = entity.name.toLowerCase();
    if (!HOSTILE_LIST.includes(name)) continue;
    const dist = entity.position.distanceTo(bot.entity.position);
    if (dist > 24) continue;
    const key = `mob_${id}`;
    if (alarmCooldowns[key] && now - alarmCooldowns[key] < 15000) continue;
    alarmCooldowns[key] = now;
    const dir = getDirection(bot, entity.position);
    bot.chat(`${capitalize(name)} approaching from the ${dir}!`);
  }
}

function getDirection(bot, targetPos) {
  const dx = targetPos.x - bot.entity.position.x;
  const dz = targetPos.z - bot.entity.position.z;
  const angle = Math.atan2(dz, dx) * (180 / Math.PI);
  if (angle >= -45 && angle < 45) return 'east';
  if (angle >= 45 && angle < 135) return 'south';
  if (angle >= -135 && angle < -45) return 'north';
  return 'west';
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─── MAIN COMMAND HANDLER ─────────────────────────────────────────────────────
async function handleCommand(bot, username, message) {
  const msg = message.toLowerCase();

  // ── FOLLOW ──────────────────────────────────────────────────────────────────
  if (msg === 'come' || msg === 'follow me' || msg === 'come here' || msg === 'follow') {
    await cmdFollow(bot, username); return;
  }

  // ── STOP ────────────────────────────────────────────────────────────────────
  if (msg === 'stop' || msg === 'stay' || msg === 'halt') {
    stopAll(bot); say(bot, rand(RESPONSES.stop)); return;
  }

  // ── ATTACK ──────────────────────────────────────────────────────────────────
  if (msg.startsWith('attack ') || msg.startsWith('kill ')) {
    const target = msg.replace(/^(attack|kill)\s+/, '');
    await cmdAttack(bot, target); return;
  }

  // ── GUARD ───────────────────────────────────────────────────────────────────
  if (msg === 'guard' || msg === 'protect me' || msg === 'guard me') {
    cmdGuard(bot, username); return;
  }
  if (msg === 'stop guard' || msg === 'stop guarding') {
    guardMode = false; guardPos = null; bot.pvp.stop();
    bot.chat('Guard mode OFF.'); return;
  }

  // ── COMBAT STYLE ────────────────────────────────────────────────────────────
  if (msg.startsWith('combat style ') || msg.startsWith('style ')) {
    const style = msg.replace(/^(combat style|style)\s+/, '');
    if (['normal', 'aggressive', 'defensive', 'tank'].includes(style)) {
      combatStyle = style;
      bot.chat(`Combat style set to ${style}.`);
    } else {
      bot.chat('Styles: normal, aggressive, defensive, tank');
    }
    return;
  }

  // ── HUNT ────────────────────────────────────────────────────────────────────
  if (msg === 'hunt' || msg === 'hunt mobs' || msg === 'hunt hostile') {
    cmdHunt(bot); return;
  }
  if (msg === 'clear area' || msg === 'clear mobs') {
    cmdClearArea(bot); return;
  }
  if (msg === 'stop hunt') {
    huntMode = false; bot.pvp.stop();
    bot.chat('Stopped hunting.'); return;
  }

  // ── MINE ────────────────────────────────────────────────────────────────────
  if (msg.startsWith('mine ') || msg.startsWith('collect ') || msg.startsWith('get ')) {
    const rest = msg.replace(/^(mine|collect|get)\s+/, '');
    const parts = rest.split(' ');
    let count = 1;
    let blockName = rest;
    if (parts.length >= 2 && !isNaN(parts[0])) {
      count = parseInt(parts[0]);
      blockName = parts.slice(1).join('_');
    } else {
      blockName = rest.replace(/\s+/g, '_');
    }
    await cmdMine(bot, blockName, count); return;
  }

  // ── BUILD ────────────────────────────────────────────────────────────────────
  if (msg.startsWith('build ')) {
    await cmdBuild(bot, msg.replace('build ', '')); return;
  }
  if (msg.startsWith('place ')) {
    await cmdPlace(bot, msg.replace('place ', '')); return;
  }

  // ── FARM ────────────────────────────────────────────────────────────────────
  if (msg === 'build farm' || msg === 'make farm') {
    await cmdBuildFarm(bot); return;
  }
  if (msg === 'harvest' || msg === 'harvest crops') {
    await cmdHarvest(bot); return;
  }
  if (msg === 'replant' || msg === 'replant crops') {
    await cmdReplant(bot); return;
  }
  if (msg.startsWith('plant ')) {
    await cmdPlant(bot, msg.replace('plant ', '')); return;
  }
  if (msg === 'auto farm' || msg === 'start auto farm' || msg === 'auto-farm') {
    cmdAutoFarm(bot); return;
  }
  if (msg === 'stop farm' || msg === 'stop auto farm') {
    autoFarmLoop = false;
    if (autoFarmInterval) { clearInterval(autoFarmInterval); autoFarmInterval = null; }
    bot.chat('Auto-farm stopped.'); return;
  }

  // ── INVENTORY ───────────────────────────────────────────────────────────────
  if (msg === 'inventory' || msg === 'inv' || msg === 'what do you have') {
    cmdListInventory(bot); return;
  }
  if (msg.startsWith('drop ')) {
    await cmdDrop(bot, msg.replace('drop ', '')); return;
  }
  if (msg.startsWith('equip ')) {
    await cmdEquip(bot, msg.replace('equip ', '')); return;
  }
  if (msg.startsWith('toss ') || msg.startsWith('give me ')) {
    const item = msg.replace(/^(toss|give me)\s+/, '');
    await cmdToss(bot, item, username); return;
  }
  if (msg === 'equip best gear' || msg === 'gear up') {
    await cmdEquipBestGear(bot); return;
  }
  if (msg === 'eat' || msg === 'eat food') {
    await cmdEat(bot); return;
  }

  // ── STATUS / HELP ───────────────────────────────────────────────────────────
  if (msg === 'status') { cmdStatus(bot); return; }
  if (msg === 'help') { cmdHelp(bot); return; }
  if (msg === 'help combat') { cmdHelpCombat(bot); return; }
  if (msg === 'help farm') { cmdHelpFarm(bot); return; }
  if (msg === 'help build') { cmdHelpBuild(bot); return; }
  if (msg === 'help waypoint' || msg === 'help waypoints') { cmdHelpWaypoint(bot); return; }
  if (msg === 'help scout') { cmdHelpScout(bot); return; }
  if (msg === 'help craft') { cmdHelpCraft(bot); return; }
  if (msg === 'help chest') { cmdHelpChest(bot); return; }
  if (msg === 'help patrol') { cmdHelpPatrol(bot); return; }
  if (msg === 'help macro' || msg === 'help macros') { cmdHelpMacro(bot); return; }
  if (msg === 'help misc') { cmdHelpMisc(bot); return; }

  // ── WAYPOINTS ───────────────────────────────────────────────────────────────
  if (msg.startsWith('remember here as ')) {
    const name = msg.replace('remember here as ', '').trim();
    cmdRememberWaypoint(bot, name); return;
  }
  if (msg.startsWith('go to ')) {
    const name = msg.replace('go to ', '').trim();
    await cmdGoWaypoint(bot, name); return;
  }
  if (msg === 'waypoints' || msg === 'list waypoints') {
    cmdListWaypoints(bot); return;
  }
  if (msg.startsWith('forget ') && !msg.startsWith('forget macro ')) {
    const name = msg.replace('forget ', '').trim();
    cmdForgetWaypoint(bot, name); return;
  }

  // ── MACROS ──────────────────────────────────────────────────────────────────
  if (msg.startsWith('learn ')) {
    cmdLearnMacro(bot, message.slice('learn '.length)); return;
  }
  if (msg.startsWith('do ')) {
    await cmdDoMacro(bot, username, msg.replace('do ', '').trim()); return;
  }
  if (msg.startsWith('forget macro ')) {
    cmdForgetMacro(bot, msg.replace('forget macro ', '').trim()); return;
  }
  if (msg === 'macros' || msg === 'list macros') {
    cmdListMacros(bot); return;
  }

  // ── RANGED ──────────────────────────────────────────────────────────────────
  if (msg.startsWith('shoot ')) {
    await cmdShoot(bot, msg.replace('shoot ', '').trim()); return;
  }

  // ── DUEL ────────────────────────────────────────────────────────────────────
  if (msg === 'duel' || msg === 'spar') {
    cmdDuel(bot, username); return;
  }
  if (msg === 'stop duel') {
    duelActive = false; bot.pvp.stop(); bot.chat('Duel stopped. We good!'); return;
  }

  // ── BREED ───────────────────────────────────────────────────────────────────
  if (msg.startsWith('breed ')) {
    await cmdBreed(bot, msg.replace('breed ', '').trim()); return;
  }

  // ── COOK / SMELT ────────────────────────────────────────────────────────────
  if (msg === 'cook' || msg === 'smelt' || msg === 'cook all') {
    await cmdCook(bot); return;
  }
  if (msg === 'smelt ores') {
    await cmdSmeltOres(bot); return;
  }

  // ── TREE FARM ───────────────────────────────────────────────────────────────
  if (msg === 'chop trees' || msg === 'chop wood' || msg === 'tree farm') {
    await cmdTreeFarm(bot); return;
  }
  if (msg === 'stop chop' || msg === 'stop tree farm') {
    treeFarmActive = false; bot.chat('Stopped chopping.'); return;
  }

  // ── FISH ────────────────────────────────────────────────────────────────────
  if (msg === 'fish' || msg === 'start fishing') {
    await cmdFish(bot); return;
  }
  if (msg === 'stop fishing') {
    fishingActive = false; bot.chat('Stopped fishing.'); return;
  }

  // ── FENCE ───────────────────────────────────────────────────────────────────
  if (msg.startsWith('build fence around me')) {
    const m = msg.match(/build fence around me\s*(\d+)?/);
    const radius = m && m[1] ? parseInt(m[1]) : 8;
    await cmdBuildFenceAround(bot, username, radius); return;
  }
  if (msg.startsWith('build fence ')) {
    const size = parseInt(msg.replace('build fence ', '')) || 10;
    await cmdBuildFence(bot, size); return;
  }

  // ── TORCHES ─────────────────────────────────────────────────────────────────
  if (msg === 'light up' || msg === 'place torches') {
    await cmdPlaceTorches(bot); return;
  }

  // ── STRIP MINE ──────────────────────────────────────────────────────────────
  if (msg.startsWith('strip mine') || msg.startsWith('mine tunnel')) {
    const m = msg.match(/(\d+)/);
    const length = m ? parseInt(m[1]) : 30;
    await cmdStripMine(bot, length); return;
  }

  // ── FURNISH ─────────────────────────────────────────────────────────────────
  if (msg === 'furnish' || msg === 'add furniture') {
    await cmdFurnish(bot); return;
  }

  // ── SCOUT ───────────────────────────────────────────────────────────────────
  if (msg === 'scout around') {
    await cmdScoutAround(bot); return;
  }
  if (msg.startsWith('scout ')) {
    const dir = msg.replace('scout ', '').trim();
    await cmdScout(bot, dir); return;
  }

  // ── PATROL ──────────────────────────────────────────────────────────────────
  if (msg === 'stop patrol') {
    patrolActive = false; bot.pvp.stop(); bot.chat('Patrol stopped.'); return;
  }
  if (msg.startsWith('patrol ')) {
    const wps = msg.replace('patrol ', '').trim().split(/\s+/);
    await cmdPatrol(bot, wps); return;
  }
  if (msg === 'patrol') {
    await cmdPatrol(bot, Object.keys(waypoints)); return;
  }

  // ── CRAFT ───────────────────────────────────────────────────────────────────
  if (msg.startsWith('craft ')) {
    const rest = msg.replace('craft ', '');
    const parts = rest.split(' ');
    let count = 1;
    let itemName = rest;
    if (parts.length >= 2 && !isNaN(parts[0])) {
      count = parseInt(parts[0]);
      itemName = parts.slice(1).join('_');
    } else {
      itemName = rest.replace(/\s+/g, '_');
    }
    await cmdCraft(bot, itemName, count); return;
  }

  // ── CHEST MANAGEMENT ────────────────────────────────────────────────────────
  if (msg === 'sort chests' || msg === 'sort chest') {
    await cmdSortChests(bot); return;
  }
  if (msg === 'store all' || msg === 'store everything') {
    await cmdStoreAll(bot); return;
  }
  if (msg === 'restock') {
    await cmdRestock(bot); return;
  }

  // ── TOGGLES ─────────────────────────────────────────────────────────────────
  if (msg === 'auto pickup on') { autoPickup = true; say(bot, rand(RESPONSES.pickup)); return; }
  if (msg === 'auto pickup off') { autoPickup = false; say(bot, rand(RESPONSES.pickup)); return; }
  if (msg === 'night watch on') { nightWatchEnabled = true; bot.chat('Night watch enabled.'); return; }
  if (msg === 'night watch off') { nightWatchEnabled = false; bot.chat('Night watch disabled.'); return; }
  if (msg === 'alarm on') { alarmEnabled = true; bot.chat('Mob alarm on!'); return; }
  if (msg === 'alarm off') { alarmEnabled = false; bot.chat('Mob alarm off.'); return; }
  if (msg === 'doors on') { doorsEnabled = true; bot.chat('Door management on.'); return; }
  if (msg === 'doors off') { doorsEnabled = false; bot.chat('Door management off.'); return; }

  // ── FALLBACK ────────────────────────────────────────────────────────────────
  bot.chat("Hmm, I don't know that one. Say 'help' for commands!");
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FEATURE IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── FOLLOW ───────────────────────────────────────────────────────────────────
async function cmdFollow(bot, username) {
  const player = bot.players[username];
  if (!player || !player.entity) { bot.chat("I can't see you! Get closer."); return; }
  stopAll(bot);
  followingPlayer = true;
  currentTask = 'follow';
  say(bot, rand(RESPONSES.follow));
  bot.pathfinder.setGoal(new GoalFollow(player.entity, 2), true);
}

// ─── ATTACK ───────────────────────────────────────────────────────────────────
async function cmdAttack(bot, targetName) {
  // Check players first
  const playerEnt = bot.players[targetName] ? bot.players[targetName].entity : null;
  if (playerEnt) {
    say(bot, rand(RESPONSES.attack));
    await selectBestWeapon(bot, playerEnt);
    bot.pvp.attack(playerEnt);
    return;
  }
  const entity = bot.nearestEntity(e => {
    const n = (e.name || '').toLowerCase();
    return n.includes(targetName.toLowerCase());
  });
  if (entity) {
    say(bot, rand(RESPONSES.attack));
    await selectBestWeapon(bot, entity);
    if (combatStyle === 'aggressive') {
      bot.setControlState('sprint', true);
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 300);
    }
    bot.pvp.attack(entity);
  } else {
    bot.chat(`I can't find any ${targetName} nearby.`);
  }
}

// ─── GUARD ────────────────────────────────────────────────────────────────────
function cmdGuard(bot, username) {
  const player = bot.players[username];
  if (!player || !player.entity) { bot.chat("I can't see you!"); return; }
  stopAll(bot);
  guardMode = true;
  guardPos = player.entity.position.clone();
  currentTask = 'guard';
  say(bot, rand(RESPONSES.guard));
}

// ─── HUNT ─────────────────────────────────────────────────────────────────────
function cmdHunt(bot) {
  stopAll(bot);
  huntMode = true;
  guardMode = true;
  currentTask = 'hunt';
  bot.chat('Hunt mode activated! Seeking hostile mobs...');
  const huntInterval = setInterval(() => {
    if (!huntMode) { clearInterval(huntInterval); return; }
    try {
      let best = null; let bestPriority = -1;
      for (const entity of Object.values(bot.entities)) {
        if (!entity || !entity.name) continue;
        const name = entity.name.toLowerCase();
        if (!HOSTILE_LIST.includes(name)) continue;
        const p = HOSTILE_PRIORITY[name] || 0;
        if (p > bestPriority) { bestPriority = p; best = entity; }
      }
      if (best && !bot.pvp.target) {
        selectBestWeapon(bot, best).then(() => bot.pvp.attack(best));
      }
    } catch (_) {}
  }, 2000);
}

function cmdClearArea(bot) {
  bot.chat('Clearing area of all hostile mobs!');
  huntMode = true;
  guardMode = true;
  currentTask = 'clear';
  const clearInterval = setInterval(() => {
    if (!huntMode) { clearInterval(clearInterval); return; }
    try {
      const hostile = bot.nearestEntity(e => HOSTILE_LIST.includes((e.name || '').toLowerCase()));
      if (hostile && !bot.pvp.target) {
        selectBestWeapon(bot, hostile).then(() => bot.pvp.attack(hostile));
      } else if (!hostile) {
        clearInterval(clearInterval);
        huntMode = false;
        bot.chat('Area cleared!');
      }
    } catch (_) {}
  }, 1000);
}

// ─── WEAPON SELECTION ─────────────────────────────────────────────────────────
async function selectBestWeapon(bot, target) {
  try {
    const dist = target ? target.position.distanceTo(bot.entity.position) : 0;
    const mobName = (target && target.name) ? target.name.toLowerCase() : '';
    const preferRanged = RANGED_MOB_TYPES.includes(mobName) || dist > 10;
    const meleePreferred = dist < 4;

    if (preferRanged && !meleePreferred) {
      const bow = bot.inventory.items().find(i => i.name === 'bow' || i.name === 'crossbow');
      if (bow) { await bot.equip(bow, 'hand'); return; }
    }

    const weapons = ['netherite_sword', 'diamond_sword', 'golden_sword', 'iron_sword',
      'stone_sword', 'wooden_sword', 'netherite_axe', 'diamond_axe',
      'iron_axe', 'stone_axe', 'wooden_axe'];
    for (const w of weapons) {
      const item = bot.inventory.items().find(i => i.name === w);
      if (item) { await bot.equip(item, 'hand'); return; }
    }
  } catch (_) {}
}

// ─── SHOOT ────────────────────────────────────────────────────────────────────
async function cmdShoot(bot, targetName) {
  const bow = bot.inventory.items().find(i => i.name === 'bow' || i.name === 'crossbow');
  if (!bow) { bot.chat("I don't have a bow or crossbow!"); return; }
  const arrows = bot.inventory.items().find(i =>
    i.name === 'arrow' || i.name === 'tipped_arrow' || i.name === 'firework_rocket');
  if (!arrows && bow.name === 'bow') { bot.chat("I don't have arrows!"); return; }

  let target = bot.players[targetName] ? bot.players[targetName].entity : null;
  if (!target) target = bot.nearestEntity(e => (e.name || '').toLowerCase().includes(targetName));
  if (!target) { bot.chat(`Can't find ${targetName}.`); return; }

  try {
    await bot.equip(bow, 'hand');
    bot.chat(`Shooting at ${targetName}!`);
    bot.pvp.attack(target);
  } catch (e) { bot.chat(`Shoot failed: ${e.message}`); }
}

// ─── MINE ─────────────────────────────────────────────────────────────────────
async function cmdMine(bot, blockName, count) {
  const mcData = require('minecraft-data')(bot.version);
  const blockType = mcData.blocksByName[blockName];
  if (!blockType) { bot.chat(`I don't know what "${blockName}" is.`); return; }

  say(bot, rand(RESPONSES.mine));
  currentTask = 'mine';
  let mined = 0;
  while (mined < count) {
    if (currentTask !== 'mine') break;
    const block = bot.findBlock({ matching: blockType.id, maxDistance: 64 });
    if (!block) { bot.chat(`No more ${blockName} found.`); break; }
    try {
      await bot.collectBlock.collect(block);
      mined++;
      if (count > 1) bot.chat(`Mined ${mined}/${count} ${blockName}`);
    } catch (err) { bot.chat(`Mining error: ${err.message}`); break; }
  }
  if (mined === count && count > 0) bot.chat(`Done! Mined ${mined} ${blockName}.`);
  currentTask = null;
}

// ─── PLACE ────────────────────────────────────────────────────────────────────
async function cmdPlace(bot, blockName) {
  const mcData = require('minecraft-data')(bot.version);
  const itemName = blockName.replace(/\s+/g, '_');
  const item = bot.inventory.items().find(i => i.name === itemName || i.name.includes(itemName));
  if (!item) { bot.chat(`I don't have any ${blockName}.`); return; }
  const refBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
  if (!refBlock) { bot.chat("Can't find a surface."); return; }
  try {
    await bot.equip(item, 'hand');
    await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
    bot.chat(`Placed ${item.name}!`);
  } catch (e) { bot.chat(`Failed to place: ${e.message}`); }
}

// ─── BUILD ────────────────────────────────────────────────────────────────────
async function cmdBuild(bot, spec) {
  const parts = spec.split(' ');
  const structure = parts[0];
  say(bot, rand(RESPONSES.build));
  currentTask = 'build';

  try {
    if (structure === 'wall') {
      const length = parseInt(parts[1]) || 5;
      await buildWall(bot, length);
    } else if (structure === 'house') {
      await buildHouse(bot);
    } else if (structure === 'tower') {
      const height = parseInt(parts[1]) || 5;
      await buildTower(bot, height);
    } else if (structure === 'bridge') {
      const length = parseInt(parts[1]) || 5;
      await buildBridge(bot, length);
    } else if (structure === 'platform') {
      const size = parseInt(parts[1]) || 5;
      await buildPlatform(bot, size);
    } else if (structure === 'staircase') {
      const height = parseInt(parts[1]) || 5;
      await buildStaircase(bot, height);
    } else {
      bot.chat(`I don't know how to build a ${structure}. Try: wall, house, tower, bridge, platform, staircase`);
    }
  } catch (e) { bot.chat(`Build error: ${e.message}`); }
  currentTask = null;
}

async function placeBlockAt(bot, x, y, z, material) {
  const mcData = require('minecraft-data')(bot.version);
  const materials = Array.isArray(material) ? material : [material];
  let item = null;
  for (const m of materials) {
    item = bot.inventory.items().find(i => i.name === m);
    if (item) break;
  }
  if (!item) return false;
  try {
    const dest = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
    const existing = bot.blockAt(dest);
    if (existing && existing.name !== 'air' && existing.name !== 'cave_air') return true;
    await bot.pathfinder.goto(new GoalNear(dest.x, dest.y, dest.z, 3));
    await bot.equip(item, 'hand');
    const refBlock = bot.blockAt(dest.offset(0, -1, 0));
    if (!refBlock || refBlock.name === 'air') return false;
    await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
    return true;
  } catch (_) { return false; }
}

function getBuildMaterial(bot) {
  const priority = ['cobblestone', 'stone', 'dirt', 'planks', 'oak_planks',
    'spruce_planks', 'birch_planks', 'sand', 'gravel'];
  for (const m of priority) {
    const item = bot.inventory.items().find(i => i.name === m || i.name.includes('planks'));
    if (item) return item.name;
  }
  const item = bot.inventory.items().find(i => i.type !== undefined);
  return item ? item.name : 'cobblestone';
}

async function buildWall(bot, length) {
  const mat = getBuildMaterial(bot);
  const pos = bot.entity.position;
  bot.chat(`Building ${length}-block wall...`);
  for (let i = 0; i < length; i++) {
    for (let h = 0; h < 3; h++) {
      await placeBlockAt(bot, pos.x + i, pos.y + h, pos.z, mat);
    }
  }
  bot.chat('Wall done!');
}

async function buildHouse(bot) {
  bot.chat('Building a house... (5x5 base)');
  const mat = getBuildMaterial(bot);
  const pos = bot.entity.position.floor();
  for (let x = 0; x < 5; x++) {
    for (let z = 0; z < 5; z++) {
      if (x === 0 || x === 4 || z === 0 || z === 4) {
        for (let h = 0; h < 4; h++) {
          await placeBlockAt(bot, pos.x + x, pos.y + h, pos.z + z, mat);
        }
      }
    }
  }
  // Roof
  for (let x = 0; x < 5; x++) {
    for (let z = 0; z < 5; z++) {
      await placeBlockAt(bot, pos.x + x, pos.y + 4, pos.z + z, mat);
    }
  }
  bot.chat('House done!');
}

async function buildTower(bot, height) {
  bot.chat(`Building ${height}-high tower...`);
  const mat = getBuildMaterial(bot);
  const pos = bot.entity.position.floor();
  for (let h = 0; h < height; h++) {
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        if (x === 0 || x === 2 || z === 0 || z === 2) {
          await placeBlockAt(bot, pos.x + x, pos.y + h, pos.z + z, mat);
        }
      }
    }
  }
  bot.chat('Tower done!');
}

async function buildBridge(bot, length) {
  bot.chat(`Building ${length}-block bridge...`);
  const mat = getBuildMaterial(bot);
  const pos = bot.entity.position.floor();
  for (let i = 0; i < length; i++) {
    await placeBlockAt(bot, pos.x + i, pos.y - 1, pos.z, mat);
  }
  bot.chat('Bridge done!');
}

async function buildPlatform(bot, size) {
  bot.chat(`Building ${size}x${size} platform...`);
  const mat = getBuildMaterial(bot);
  const pos = bot.entity.position.floor();
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      await placeBlockAt(bot, pos.x + x, pos.y - 1, pos.z + z, mat);
    }
  }
  bot.chat('Platform done!');
}

async function buildStaircase(bot, height) {
  bot.chat(`Building ${height}-step staircase...`);
  const mat = getBuildMaterial(bot);
  const pos = bot.entity.position.floor();
  for (let i = 0; i < height; i++) {
    await placeBlockAt(bot, pos.x + i, pos.y + i, pos.z, mat);
  }
  bot.chat('Staircase done!');
}

// ─── FENCE ────────────────────────────────────────────────────────────────────
async function cmdBuildFence(bot, size) {
  bot.chat(`Building ${size}-block fence perimeter...`);
  const fenceMat = ['oak_fence', 'spruce_fence', 'birch_fence', 'cobblestone_wall'];
  const pos = bot.entity.position.floor();
  const half = Math.floor(size / 2);
  try {
    for (let x = -half; x <= half; x++) {
      await placeBlockAt(bot, pos.x + x, pos.y, pos.z - half, fenceMat);
      await placeBlockAt(bot, pos.x + x, pos.y, pos.z + half, fenceMat);
    }
    for (let z = -half + 1; z < half; z++) {
      await placeBlockAt(bot, pos.x - half, pos.y, pos.z + z, fenceMat);
      await placeBlockAt(bot, pos.x + half, pos.y, pos.z + z, fenceMat);
    }
    bot.chat('Fence done!');
  } catch (e) { bot.chat(`Fence error: ${e.message}`); }
}

async function cmdBuildFenceAround(bot, username, radius) {
  const player = bot.players[username];
  if (!player || !player.entity) { bot.chat("I can't see you!"); return; }
  bot.chat(`Building fence with radius ${radius} around you...`);
  const fenceMat = ['oak_fence', 'spruce_fence', 'cobblestone_wall'];
  const pos = player.entity.position.floor();
  try {
    for (let x = -radius; x <= radius; x++) {
      await placeBlockAt(bot, pos.x + x, pos.y, pos.z - radius, fenceMat);
      await placeBlockAt(bot, pos.x + x, pos.y, pos.z + radius, fenceMat);
    }
    for (let z = -radius + 1; z < radius; z++) {
      await placeBlockAt(bot, pos.x - radius, pos.y, pos.z + z, fenceMat);
      await placeBlockAt(bot, pos.x + radius, pos.y, pos.z + z, fenceMat);
    }
    bot.chat('Fence around you done!');
  } catch (e) { bot.chat(`Fence error: ${e.message}`); }
}

// ─── TORCHES ─────────────────────────────────────────────────────────────────
async function cmdPlaceTorches(bot) {
  const torch = bot.inventory.items().find(i => i.name === 'torch');
  if (!torch) { bot.chat("I don't have any torches!"); return; }
  bot.chat('Placing torches in grid pattern...');
  const pos = bot.entity.position.floor();
  let placed = 0;
  for (let x = -12; x <= 12; x += 6) {
    for (let z = -12; z <= 12; z += 6) {
      try {
        const ground = bot.blockAt(pos.offset(x, -1, z));
        if (ground && ground.name !== 'air') {
          await bot.pathfinder.goto(new GoalNear(pos.x + x, pos.y, pos.z + z, 2));
          const current = bot.inventory.items().find(i => i.name === 'torch');
          if (!current) { bot.chat('Out of torches!'); return; }
          await bot.equip(current, 'hand');
          await bot.placeBlock(ground, new Vec3(0, 1, 0));
          placed++;
        }
      } catch (_) {}
    }
  }
  bot.chat(`Placed ${placed} torches!`);
}

// ─── STRIP MINE ───────────────────────────────────────────────────────────────
async function cmdStripMine(bot, length) {
  const mcData = require('minecraft-data')(bot.version);
  bot.chat(`Strip mining ${length} blocks...`);
  currentTask = 'strip_mine';
  const pos = bot.entity.position.floor();
  let torchCounter = 0;
  for (let i = 0; i < length; i++) {
    if (currentTask !== 'strip_mine') break;
    try {
      const target1 = bot.blockAt(pos.offset(i, 0, 0));
      const target2 = bot.blockAt(pos.offset(i, 1, 0));
      if (target1 && target1.name !== 'air') {
        await bot.pathfinder.goto(new GoalNear(pos.x + i, pos.y, pos.z, 2));
        await bot.dig(target1);
      }
      if (target2 && target2.name !== 'air') {
        await bot.dig(target2);
      }

      const oreNames = ['diamond_ore', 'emerald_ore', 'gold_ore', 'iron_ore',
        'coal_ore', 'redstone_ore', 'lapis_ore', 'copper_ore',
        'ancient_debris', 'deepslate_diamond_ore', 'deepslate_emerald_ore',
        'deepslate_gold_ore', 'deepslate_iron_ore', 'deepslate_copper_ore'];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 2; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const nb = bot.blockAt(pos.offset(i + dx, dy, dz));
            if (nb && oreNames.includes(nb.name)) {
              bot.chat(`Found ${nb.name} at ${nb.position.x},${nb.position.y},${nb.position.z}!`);
            }
          }
        }
      }

      torchCounter++;
      if (torchCounter % 8 === 0) {
        const torch = bot.inventory.items().find(i => i.name === 'torch');
        if (torch) {
          const floor = bot.blockAt(pos.offset(i, -1, 0));
          if (floor && floor.name !== 'air') {
            try {
              await bot.equip(torch, 'hand');
              await bot.placeBlock(floor, new Vec3(0, 1, 0));
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }
  bot.chat('Strip mine done!');
  currentTask = null;
}

// ─── FARM ─────────────────────────────────────────────────────────────────────
async function cmdBuildFarm(bot) {
  say(bot, rand(RESPONSES.farm));
  currentTask = 'farm';
  bot.chat('Building a farm...');
  const mat = ['dirt', 'grass_block'];
  const pos = bot.entity.position.floor();
  try {
    for (let x = 0; x < 9; x++) {
      for (let z = 0; z < 9; z++) {
        const block = bot.blockAt(pos.offset(x, -1, z));
        if (!block || block.name === 'air') {
          await placeBlockAt(bot, pos.x + x, pos.y - 1, pos.z + z, mat);
        }
      }
    }
    // Place water in center
    bot.chat('Farm layout ready! Place water in center and use a hoe.');
    bot.chat('Say "harvest" to harvest or "plant <crop>" to plant!');
  } catch (e) { bot.chat(`Farm error: ${e.message}`); }
  currentTask = null;
}

async function cmdHarvest(bot) {
  bot.chat('Harvesting crops...');
  const mcData = require('minecraft-data')(bot.version);
  const cropBlocks = ['wheat', 'potatoes', 'carrots', 'beetroots', 'melon', 'pumpkin'];
  let harvested = 0;
  for (const cropName of cropBlocks) {
    const cropType = mcData.blocksByName[cropName];
    if (!cropType) continue;
    let block;
    while ((block = bot.findBlock({ matching: cropType.id, maxDistance: 32 }))) {
      try {
        await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 2));
        await bot.dig(block);
        harvested++;
      } catch (_) { break; }
    }
  }
  bot.chat(`Harvested ${harvested} crop blocks.`);
}

async function cmdReplant(bot) {
  bot.chat('Replanting crops...');
  const mcData = require('minecraft-data')(bot.version);
  const seedMap = {
    wheat_seeds: 'wheat_seeds', carrot: 'carrot',
    potato: 'potato', beetroot_seeds: 'beetroot_seeds'
  };
  let planted = 0;
  for (const [seedItem] of Object.entries(seedMap)) {
    const seed = bot.inventory.items().find(i => i.name === seedItem);
    if (!seed) continue;
    const farmland = bot.findBlock({
      matching: mcData.blocksByName.farmland ? mcData.blocksByName.farmland.id : 60,
      maxDistance: 32
    });
    if (!farmland) continue;
    try {
      await bot.pathfinder.goto(new GoalNear(
        farmland.position.x, farmland.position.y, farmland.position.z, 2));
      await bot.equip(seed, 'hand');
      await bot.placeBlock(farmland, new Vec3(0, 1, 0));
      planted++;
    } catch (_) {}
  }
  bot.chat(`Replanted ${planted} crops.`);
}

async function cmdPlant(bot, cropType) {
  const mcData = require('minecraft-data')(bot.version);
  const seedNames = {
    wheat: 'wheat_seeds', carrot: 'carrot', potato: 'potato',
    beetroot: 'beetroot_seeds', melon: 'melon_seeds', pumpkin: 'pumpkin_seeds'
  };
  const seedName = seedNames[cropType] || cropType;
  const seed = bot.inventory.items().find(i => i.name === seedName);
  if (!seed) { bot.chat(`I don't have ${seedName}.`); return; }
  const farmlandId = mcData.blocksByName.farmland ? mcData.blocksByName.farmland.id : 60;
  const farmland = bot.findBlock({ matching: farmlandId, maxDistance: 32 });
  if (!farmland) { bot.chat('No farmland nearby!'); return; }
  try {
    await bot.pathfinder.goto(new GoalNear(
      farmland.position.x, farmland.position.y, farmland.position.z, 2));
    await bot.equip(seed, 'hand');
    await bot.placeBlock(farmland, new Vec3(0, 1, 0));
    bot.chat(`Planted ${cropType}!`);
  } catch (e) { bot.chat(`Plant error: ${e.message}`); }
}

function cmdAutoFarm(bot) {
  bot.chat('Starting auto-farm loop! Harvesting every 2 minutes.');
  autoFarmLoop = true;
  autoFarmInterval = setInterval(async () => {
    if (!autoFarmLoop) { clearInterval(autoFarmInterval); return; }
    try {
      await cmdHarvest(bot);
      await cmdReplant(bot);
    } catch (_) {}
  }, 120000);
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────
function cmdListInventory(bot) {
  const items = bot.inventory.items();
  if (items.length === 0) { bot.chat('My inventory is empty!'); return; }
  const map = {};
  items.forEach(i => { map[i.name] = (map[i.name] || 0) + i.count; });
  const list = Object.entries(map).map(([n, c]) => `${n}x${c}`).join(', ');
  bot.chat(`I have: ${list}`);
}

async function cmdDrop(bot, itemName) {
  const name = itemName.replace(/\s+/g, '_');
  const item = bot.inventory.items().find(i => i.name.includes(name));
  if (!item) { bot.chat(`I don't have any ${itemName}.`); return; }
  try { await bot.tossStack(item); bot.chat(`Dropped ${item.name}!`); }
  catch (e) { bot.chat(`Couldn't drop: ${e.message}`); }
}

async function cmdEquip(bot, itemName) {
  const name = itemName.replace(/\s+/g, '_');
  const item = bot.inventory.items().find(i => i.name.includes(name));
  if (!item) { bot.chat(`I don't have any ${itemName}.`); return; }
  try { await bot.equip(item, 'hand'); bot.chat(`Equipped ${item.name}!`); }
  catch (e) { bot.chat(`Couldn't equip: ${e.message}`); }
}

async function cmdToss(bot, itemName, username) {
  const player = bot.players[username] ? bot.players[username].entity : null;
  if (!player) { bot.chat('Come closer so I can give it to you!'); return; }
  await bot.pathfinder.goto(
    new GoalNear(player.position.x, player.position.y, player.position.z, 2));
  const name = itemName.replace(/\s+/g, '_');
  const item = bot.inventory.items().find(i => i.name.includes(name));
  if (!item) { bot.chat(`I don't have any ${itemName}.`); return; }
  try { await bot.tossStack(item); bot.chat(`Here you go! Tossed ${item.name}.`); }
  catch (e) { bot.chat(`Couldn't toss: ${e.message}`); }
}

async function cmdEquipBestGear(bot) {
  const armorSlots = ['head', 'torso', 'legs', 'feet'];
  const armorTypes = {
    head: ['netherite_helmet', 'diamond_helmet', 'golden_helmet', 'iron_helmet', 'chainmail_helmet', 'leather_helmet'],
    torso: ['netherite_chestplate', 'diamond_chestplate', 'golden_chestplate', 'iron_chestplate', 'chainmail_chestplate', 'leather_chestplate'],
    legs: ['netherite_leggings', 'diamond_leggings', 'golden_leggings', 'iron_leggings', 'chainmail_leggings', 'leather_leggings'],
    feet: ['netherite_boots', 'diamond_boots', 'golden_boots', 'iron_boots', 'chainmail_boots', 'leather_boots']
  };
  for (const slot of armorSlots) {
    for (const armorName of armorTypes[slot]) {
      const item = bot.inventory.items().find(i => i.name === armorName);
      if (item) {
        try { await bot.equip(item, slot); break; }
        catch (_) {}
      }
    }
  }
  await selectBestWeapon(bot, null);
  bot.chat('Equipped best available gear!');
}

async function cmdEat(bot) {
  const foods = ['cooked_beef', 'cooked_pork', 'cooked_chicken', 'cooked_mutton',
    'cooked_cod', 'cooked_salmon', 'bread', 'golden_apple', 'apple',
    'carrot', 'potato', 'baked_potato', 'cookie', 'melon_slice'];
  for (const foodName of foods) {
    const food = bot.inventory.items().find(i => i.name === foodName);
    if (food) {
      try {
        await bot.equip(food, 'hand');
        await bot.consume();
        bot.chat(`Ate some ${foodName}. Yum!`);
        return;
      } catch (_) {}
    }
  }
  bot.chat("I don't have any food!");
}

// ─── STATUS / HELP ────────────────────────────────────────────────────────────
function cmdStatus(bot) {
  const health = Math.round(bot.health);
  const food = Math.round(bot.food);
  const items = bot.inventory.items().length;
  const mode = guardMode ? 'Guarding' : followingPlayer ? 'Following' :
    fishingActive ? 'Fishing' : patrolActive ? 'Patrolling' :
    duelActive ? 'Dueling' : currentTask || 'Idle';
  bot.chat(`HP:${health}/20 Food:${food}/20 Items:${items} Mood:${mood} Mode:${mode} Style:${combatStyle}`);
}

function cmdHelp(bot) {
  bot.chat('--- Buddy v2.0 Help Categories ---');
  bot.chat('help combat | help farm | help build | help waypoint');
  bot.chat('help scout | help craft | help chest | help patrol | help macro | help misc');
}
function cmdHelpCombat(bot) {
  bot.chat('--- Combat ---');
  bot.chat('attack/kill <target> | guard/protect me | stop guard');
  bot.chat('hunt | hunt mobs | clear area | stop hunt');
  bot.chat('style <normal/aggressive/defensive/tank>');
  bot.chat('shoot <target> | duel/spar | stop duel');
  bot.chat('alarm on/off');
}
function cmdHelpFarm(bot) {
  bot.chat('--- Farm ---');
  bot.chat('build farm | harvest | replant | plant <crop>');
  bot.chat('auto farm | stop farm | breed <animal> | breed all');
  bot.chat('cook/smelt | cook all | smelt ores');
  bot.chat('fish / start fishing | stop fishing');
  bot.chat('chop trees/wood | tree farm | stop chop');
}
function cmdHelpBuild(bot) {
  bot.chat('--- Build ---');
  bot.chat('build wall/house/tower/bridge/platform/staircase [size]');
  bot.chat('build fence <size> | build fence around me [radius]');
  bot.chat('light up / place torches | furnish / add furniture');
  bot.chat('strip mine [length] / mine tunnel');
}
function cmdHelpWaypoint(bot) {
  bot.chat('--- Waypoints ---');
  bot.chat('remember here as <name> | go to <name>');
  bot.chat('waypoints / list waypoints | forget <name>');
}
function cmdHelpScout(bot) {
  bot.chat('--- Scout ---');
  bot.chat('scout <north/south/east/west> | scout around');
}
function cmdHelpCraft(bot) {
  bot.chat('--- Craft ---');
  bot.chat('craft [count] <item> (e.g. craft 64 torch, craft planks)');
  bot.chat('Items: torch, stick, planks, crafting_table, furnace, chest, ladder, bowl, boat');
}
function cmdHelpChest(bot) {
  bot.chat('--- Chest Management ---');
  bot.chat('sort chests | store all | restock');
}
function cmdHelpPatrol(bot) {
  bot.chat('--- Patrol ---');
  bot.chat('patrol | patrol <wp1> <wp2> ... | stop patrol');
}
function cmdHelpMacro(bot) {
  bot.chat('--- Macros ---');
  bot.chat('learn <name> = <cmd1>, <cmd2>, ... | do <name>');
  bot.chat('forget macro <name> | macros / list macros');
}
function cmdHelpMisc(bot) {
  bot.chat('--- Misc ---');
  bot.chat('equip best gear | eat | status | inventory');
  bot.chat('auto pickup on/off | night watch on/off | doors on/off');
  bot.chat('come/follow me | stop/stay | give me <item> | drop <item>');
}

// ─── WAYPOINTS ────────────────────────────────────────────────────────────────
function cmdRememberWaypoint(bot, name) {
  if (!name) { bot.chat('Give the waypoint a name!'); return; }
  const pos = bot.entity.position;
  waypoints[name] = { x: pos.x, y: pos.y, z: pos.z };
  saveWaypoints();
  say(bot, rand(RESPONSES.waypoint) + ` Saved "${name}" at ${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`);
}

async function cmdGoWaypoint(bot, name) {
  if (!waypoints[name]) { bot.chat(`No waypoint named "${name}". Use 'waypoints' to list.`); return; }
  const wp = waypoints[name];
  say(bot, rand(RESPONSES.gowaypoint));
  currentTask = 'goto_waypoint';
  try {
    await bot.pathfinder.goto(new GoalNear(wp.x, wp.y, wp.z, 2));
    bot.chat(`Arrived at "${name}"!`);
  } catch (e) { bot.chat(`Can't reach "${name}": ${e.message}`); }
  currentTask = null;
}

function cmdListWaypoints(bot) {
  const keys = Object.keys(waypoints);
  if (keys.length === 0) { bot.chat('No waypoints saved.'); return; }
  bot.chat('Waypoints: ' + keys.map(k => {
    const w = waypoints[k];
    return `${k}(${Math.floor(w.x)},${Math.floor(w.y)},${Math.floor(w.z)})`;
  }).join(', '));
}

function cmdForgetWaypoint(bot, name) {
  if (!waypoints[name]) { bot.chat(`No waypoint named "${name}".`); return; }
  delete waypoints[name];
  saveWaypoints();
  bot.chat(`Forgot waypoint "${name}".`);
}

// ─── MACROS ───────────────────────────────────────────────────────────────────
function cmdLearnMacro(bot, raw) {
  const eqIdx = raw.indexOf('=');
  if (eqIdx === -1) { bot.chat('Usage: learn <name> = <cmd1>, <cmd2>, ...'); return; }
  const name = raw.slice(0, eqIdx).trim().toLowerCase();
  const cmds = raw.slice(eqIdx + 1).split(',').map(c => c.trim()).filter(Boolean);
  if (!name || cmds.length === 0) { bot.chat('Need a name and at least one command.'); return; }
  macros[name] = cmds;
  saveMacros();
  say(bot, rand(RESPONSES.macro) + ` Macro "${name}" has ${cmds.length} step(s).`);
}

async function cmdDoMacro(bot, username, name) {
  if (!macros[name]) {
    bot.chat(`No macro named "${name}". Use 'macros' to list.`); return;
  }
  bot.chat(`Running macro "${name}"...`);
  for (const cmd of macros[name]) {
    bot.chat(`> ${cmd}`);
    await handleCommand(bot, username, cmd);
    await sleep(250);
  }
  bot.chat(`Macro "${name}" done!`);
}

function cmdForgetMacro(bot, name) {
  if (!macros[name]) { bot.chat(`No macro named "${name}".`); return; }
  delete macros[name];
  saveMacros();
  bot.chat(`Forgot macro "${name}".`);
}

function cmdListMacros(bot) {
  const keys = Object.keys(macros);
  if (keys.length === 0) { bot.chat('No macros saved.'); return; }
  bot.chat('Macros: ' + keys.map(k => `${k}(${macros[k].length} steps)`).join(', '));
}

// ─── DUEL ─────────────────────────────────────────────────────────────────────
function cmdDuel(bot, username) {
  const player = bot.players[username] ? bot.players[username].entity : null;
  if (!player) { bot.chat("I can't see you!"); return; }
  stopAll(bot);
  duelActive = true;
  currentTask = 'duel';
  say(bot, rand(RESPONSES.duel));
  bot.pvp.attack(player);
}

function checkDuelEnd(bot) {
  if (!duelActive) return;
  const ownerEntity = bot.players[OWNER] ? bot.players[OWNER].entity : null;
  const ownerHealth = ownerEntity && ownerEntity.metadata ? ownerEntity.metadata[9] : 20;
  if (bot.health <= 8 || (typeof ownerHealth === 'number' && ownerHealth <= 8)) {
    duelActive = false;
    bot.pvp.stop();
    if (bot.health <= 8) {
      say(bot, rand(RESPONSES.lose));
    } else {
      mood = 'happy';
      say(bot, rand(RESPONSES.win));
    }
  }
}

// ─── BREED ────────────────────────────────────────────────────────────────────
const BREED_MAP = {
  cow: 'wheat', sheep: 'wheat', pig: 'carrot',
  chicken: 'wheat_seeds', horse: 'golden_apple',
  rabbit: 'dandelion', llama: 'hay_block', donkey: 'golden_apple'
};

async function cmdBreed(bot, animalName) {
  say(bot, rand(RESPONSES.breed));
  if (animalName === 'all') {
    for (const animal of Object.keys(BREED_MAP)) {
      await breedAnimal(bot, animal);
    }
    return;
  }
  await breedAnimal(bot, animalName.toLowerCase());
}

async function breedAnimal(bot, animalName) {
  const foodName = BREED_MAP[animalName];
  if (!foodName) { bot.chat(`I don't know how to breed ${animalName}.`); return; }
  const food = bot.inventory.items().find(i => i.name === foodName);
  if (!food) { bot.chat(`I need ${foodName} to breed ${animalName}.`); return; }

  const animals = Object.values(bot.entities).filter(e =>
    e.name && e.name.toLowerCase() === animalName &&
    e.position.distanceTo(bot.entity.position) < 30
  );
  if (animals.length < 2) { bot.chat(`Need at least 2 ${animalName}s nearby.`); return; }

  await bot.equip(food, 'hand');
  let bred = 0;
  for (const animal of animals.slice(0, 2)) {
    try {
      await bot.pathfinder.goto(new GoalNear(
        animal.position.x, animal.position.y, animal.position.z, 2));
      await bot.useOn(animal);
      bred++;
    } catch (_) {}
  }
  if (bred >= 2) bot.chat(`Bred ${animalName}s! 💕`);
}

// ─── COOK / SMELT ─────────────────────────────────────────────────────────────
const SMELT_MAP = {
  raw_beef: 'cooked_beef', raw_porkchop: 'cooked_porkchop',
  raw_chicken: 'cooked_chicken', raw_mutton: 'cooked_mutton',
  raw_cod: 'cooked_cod', raw_salmon: 'cooked_salmon',
  raw_iron_ore: 'iron_ingot', iron_ore: 'iron_ingot',
  raw_gold_ore: 'gold_ingot', gold_ore: 'gold_ingot',
  raw_copper_ore: 'copper_ingot', copper_ore: 'copper_ingot',
  sand: 'glass', cobblestone: 'stone', netherrack: 'nether_brick'
};
const FUEL_NAMES = ['coal', 'charcoal', 'wooden_slab', 'log', 'oak_log',
  'spruce_log', 'birch_log', 'lava_bucket', 'blaze_rod'];

async function cmdCook(bot) {
  say(bot, rand(RESPONSES.cook));
  const mcData = require('minecraft-data')(bot.version);
  const furnaceBlock = bot.findBlock({
    matching: b => b.name === 'furnace' || b.name === 'blast_furnace' || b.name === 'smoker',
    maxDistance: 32
  });
  if (!furnaceBlock) { bot.chat('No furnace nearby!'); return; }

  try {
    await bot.pathfinder.goto(
      new GoalNear(furnaceBlock.position.x, furnaceBlock.position.y, furnaceBlock.position.z, 2));
    const furnace = await bot.openFurnace(furnaceBlock);

    const fuel = bot.inventory.items().find(i => FUEL_NAMES.some(f => i.name.includes(f)));
    if (fuel) await furnace.putFuel(fuel.type, null, Math.min(fuel.count, 16));

    for (const [rawName] of Object.entries(SMELT_MAP)) {
      const rawItem = bot.inventory.items().find(i => i.name === rawName);
      if (rawItem) {
        await furnace.putInput(rawItem.type, null, Math.min(rawItem.count, 16));
        break;
      }
    }

    bot.chat('Smelting! Waiting for output (up to 30s)...');
    // Poll for output every 2 seconds, up to 30 seconds
    for (let waited = 0; waited < 30; waited += 2) {
      await sleep(2000);
      if (furnace.outputItem()) break;
    }
    if (furnace.outputItem()) await furnace.takeOutput();
    furnace.close();
    bot.chat('Collected smelted items!');
  } catch (e) { bot.chat(`Smelt error: ${e.message}`); }
}

async function cmdSmeltOres(bot) {
  bot.chat('Smelting all ores...');
  const oreNames = ['iron_ore', 'gold_ore', 'copper_ore', 'raw_iron', 'raw_gold', 'raw_copper'];
  const mcData = require('minecraft-data')(bot.version);
  const furnaceBlock = bot.findBlock({
    matching: b => b.name === 'furnace' || b.name === 'blast_furnace',
    maxDistance: 32
  });
  if (!furnaceBlock) { bot.chat('No furnace nearby!'); return; }
  try {
    await bot.pathfinder.goto(
      new GoalNear(furnaceBlock.position.x, furnaceBlock.position.y, furnaceBlock.position.z, 2));
    const furnace = await bot.openFurnace(furnaceBlock);
    const fuel = bot.inventory.items().find(i => FUEL_NAMES.some(f => i.name.includes(f)));
    if (fuel) await furnace.putFuel(fuel.type, null, Math.min(fuel.count, 32));
    for (const oreName of oreNames) {
      const ore = bot.inventory.items().find(i => i.name === oreName);
      if (ore) {
        await furnace.putInput(ore.type, null, Math.min(ore.count, 64));
        break;
      }
    }
    bot.chat('Ores are smelting! Waiting for output (up to 60s)...');
    // Poll for output every 3 seconds, up to 60 seconds
    for (let waited = 0; waited < 60; waited += 3) {
      await sleep(3000);
      if (furnace.outputItem()) break;
    }
    if (furnace.outputItem()) await furnace.takeOutput();
    furnace.close();
    bot.chat('Done smelting ores!');
  } catch (e) { bot.chat(`Smelt error: ${e.message}`); }
}

// ─── TREE FARM ────────────────────────────────────────────────────────────────
async function cmdTreeFarm(bot) {
  say(bot, rand(RESPONSES.chop));
  treeFarmActive = true;
  currentTask = 'tree_farm';
  const mcData = require('minecraft-data')(bot.version);
  const logNames = ['oak_log', 'spruce_log', 'birch_log', 'jungle_log',
    'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log'];
  while (treeFarmActive && currentTask === 'tree_farm') {
    let chopped = false;
    for (const logName of logNames) {
      const logType = mcData.blocksByName[logName];
      if (!logType) continue;
      const block = bot.findBlock({ matching: logType.id, maxDistance: 32 });
      if (!block) continue;
      try {
        await bot.collectBlock.collect(block);
        chopped = true;
        await sleep(100);
        // Replant sapling
        const saplingName = logName.replace('_log', '_sapling');
        const sapling = bot.inventory.items().find(i => i.name === saplingName);
        if (sapling) {
          const ground = bot.blockAt(block.position.offset(0, -1, 0));
          if (ground && (ground.name === 'dirt' || ground.name === 'grass_block')) {
            try {
              await bot.equip(sapling, 'hand');
              await bot.placeBlock(ground, new Vec3(0, 1, 0));
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
    if (!chopped) {
      bot.chat('No more nearby trees. Waiting...');
      await sleep(10000);
    }
  }
  bot.chat('Tree farm stopped.');
  currentTask = null;
}

// ─── FISHING ──────────────────────────────────────────────────────────────────
async function cmdFish(bot) {
  const rod = bot.inventory.items().find(i => i.name === 'fishing_rod');
  if (!rod) { bot.chat("I don't have a fishing rod!"); return; }
  say(bot, rand(RESPONSES.fish));
  fishingActive = true;
  currentTask = 'fish';
  await bot.equip(rod, 'hand');
  const fishLoop = async () => {
    while (fishingActive) {
      try {
        await bot.fish();
        bot.chat('Got a bite!');
        await sleep(500);
      } catch (e) {
        if (!fishingActive) break;
        await sleep(2000);
      }
    }
    bot.chat('Stopped fishing.');
    currentTask = null;
  };
  fishLoop();
}

// ─── SCOUT ────────────────────────────────────────────────────────────────────
const DIRECTION_VECTORS = {
  north: new Vec3(0, 0, -1), south: new Vec3(0, 0, 1),
  east: new Vec3(1, 0, 0), west: new Vec3(-1, 0, 0)
};

async function cmdScout(bot, direction) {
  const dir = DIRECTION_VECTORS[direction.toLowerCase()];
  if (!dir) { bot.chat('Direction must be north, south, east, or west.'); return; }
  say(bot, rand(RESPONSES.scout));
  const startPos = bot.entity.position.clone();
  const target = startPos.plus(dir.scaled(60));
  try {
    await bot.pathfinder.goto(new GoalNear(target.x, target.y, target.z, 5));
    const mobs = [];
    for (const entity of Object.values(bot.entities)) {
      if (!entity || !entity.name) continue;
      if (HOSTILE_LIST.includes(entity.name.toLowerCase())) {
        mobs.push(entity.name);
      }
    }
    const biome = bot.world ? (bot.world.getBiome ? 'unknown' : 'unknown') : 'unknown';
    bot.chat(`Scout ${direction}: found ${mobs.length} hostiles [${[...new Set(mobs)].join(', ') || 'none'}]`);
    await bot.pathfinder.goto(new GoalNear(startPos.x, startPos.y, startPos.z, 2));
    bot.chat('Back from scouting!');
  } catch (e) { bot.chat(`Scout failed: ${e.message}`); }
}

async function cmdScoutAround(bot) {
  for (const dir of ['north', 'east', 'south', 'west']) {
    await cmdScout(bot, dir);
    await sleep(500);
  }
  bot.chat('Scouted all directions!');
}

// ─── PATROL ───────────────────────────────────────────────────────────────────
async function cmdPatrol(bot, wpNames) {
  if (wpNames.length === 0) { bot.chat('No waypoints to patrol!'); return; }
  const validWps = wpNames.filter(n => waypoints[n]);
  if (validWps.length === 0) { bot.chat('No valid waypoints found. Save some with "remember here as <name>".'); return; }
  say(bot, rand(RESPONSES.patrol));
  patrolActive = true;
  patrolWaypoints = validWps;
  patrolIndex = 0;
  currentTask = 'patrol';
  while (patrolActive) {
    const wpName = patrolWaypoints[patrolIndex % patrolWaypoints.length];
    const wp = waypoints[wpName];
    if (!wp) { patrolIndex++; continue; }
    try {
      await bot.pathfinder.goto(new GoalNear(wp.x, wp.y, wp.z, 3));
      bot.chat(`Reached patrol point: ${wpName}`);
      // Kill nearby mobs during patrol
      guardTick(bot);
      await sleep(2000);
    } catch (_) {}
    patrolIndex = (patrolIndex + 1) % patrolWaypoints.length;
    if (!patrolActive) break;
  }
  bot.chat('Patrol stopped.');
  currentTask = null;
}

// ─── AUTO CRAFT ───────────────────────────────────────────────────────────────
const CRAFT_RECIPES = {
  stick: { ingredients: { oak_planks: 2 }, count: 4 },
  torch: { ingredients: { stick: 1, coal: 1 }, count: 4 },
  oak_planks: { ingredients: { oak_log: 1 }, count: 4 },
  spruce_planks: { ingredients: { spruce_log: 1 }, count: 4 },
  birch_planks: { ingredients: { birch_log: 1 }, count: 4 },
  crafting_table: { ingredients: { oak_planks: 4 }, count: 1 },
  furnace: { ingredients: { cobblestone: 8 }, count: 1 },
  chest: { ingredients: { oak_planks: 8 }, count: 1 },
  ladder: { ingredients: { stick: 7 }, count: 3 },
  bowl: { ingredients: { oak_planks: 3 }, count: 4 },
  oak_boat: { ingredients: { oak_planks: 5 }, count: 1 },
  wooden_sword: { ingredients: { stick: 1, oak_planks: 2 }, count: 1 },
  stone_sword: { ingredients: { stick: 1, cobblestone: 2 }, count: 1 },
  iron_sword: { ingredients: { stick: 1, iron_ingot: 2 }, count: 1 },
  wooden_pickaxe: { ingredients: { stick: 2, oak_planks: 3 }, count: 1 },
  stone_pickaxe: { ingredients: { stick: 2, cobblestone: 3 }, count: 1 },
  iron_pickaxe: { ingredients: { stick: 2, iron_ingot: 3 }, count: 1 },
  iron_axe: { ingredients: { stick: 2, iron_ingot: 3 }, count: 1 }
};

async function cmdCraft(bot, itemName, count) {
  const mcData = require('minecraft-data')(bot.version);
  say(bot, rand(RESPONSES.craft));

  const recipe = CRAFT_RECIPES[itemName];
  if (!recipe) {
    // Try native mineflayer crafting
    const mcItem = mcData.itemsByName[itemName];
    if (!mcItem) { bot.chat(`I don't know how to craft ${itemName}.`); return; }
    const recipes = bot.recipesFor(mcItem.id, null, 1, null);
    if (!recipes || recipes.length === 0) {
      bot.chat(`No recipe for ${itemName}.`); return;
    }
    const craftTable = bot.findBlock({
      matching: mcData.blocksByName.crafting_table ? mcData.blocksByName.crafting_table.id : 58,
      maxDistance: 16
    });
    try {
      if (craftTable) {
        await bot.pathfinder.goto(
          new GoalNear(craftTable.position.x, craftTable.position.y, craftTable.position.z, 2));
      }
      await bot.craft(recipes[0], count, craftTable);
      bot.chat(`Crafted ${count}x ${itemName}!`);
    } catch (e) { bot.chat(`Craft failed: ${e.message}`); }
    return;
  }

  // Manual recipe check
  for (const [ing, needed] of Object.entries(recipe.ingredients)) {
    const inInv = bot.inventory.items().filter(i => i.name === ing)
      .reduce((acc, i) => acc + i.count, 0);
    const totalNeeded = needed * count;
    if (inInv < totalNeeded) {
      bot.chat(`I need ${totalNeeded}x ${ing} but only have ${inInv}.`); return;
    }
  }

  const mcItem = mcData.itemsByName[itemName];
  if (!mcItem) { bot.chat(`Unknown item: ${itemName}`); return; }
  const recipes = bot.recipesFor(mcItem.id, null, 1, null);
  if (!recipes || recipes.length === 0) { bot.chat(`No recipe found for ${itemName}.`); return; }

  const craftTable = bot.findBlock({
    matching: mcData.blocksByName.crafting_table ? mcData.blocksByName.crafting_table.id : 58,
    maxDistance: 16
  });
  try {
    if (craftTable) {
      await bot.pathfinder.goto(
        new GoalNear(craftTable.position.x, craftTable.position.y, craftTable.position.z, 2));
    }
    await bot.craft(recipes[0], count, craftTable);
    bot.chat(`Crafted ${count * recipe.count}x ${itemName}!`);
  } catch (e) { bot.chat(`Craft failed: ${e.message}`); }
}

// ─── FURNISH ─────────────────────────────────────────────────────────────────
async function cmdFurnish(bot) {
  bot.chat('Furnishing room...');
  const furnitureMap = [
    { name: 'crafting_table' },
    { name: 'furnace' },
    { name: 'chest' },
    { name: 'white_bed', alts: ['red_bed', 'blue_bed', 'green_bed', 'black_bed'] }
  ];
  const pos = bot.entity.position.floor();
  const offsets = [new Vec3(1,0,0), new Vec3(-1,0,0), new Vec3(0,0,1), new Vec3(0,0,-1)];
  let placed = 0;
  for (let i = 0; i < furnitureMap.length; i++) {
    const candidates = [furnitureMap[i].name, ...(furnitureMap[i].alts || [])];
    const item = bot.inventory.items().find(it => candidates.includes(it.name));
    if (!item) continue;
    const off = offsets[i];
    try {
      const dest = pos.plus(off);
      const ground = bot.blockAt(dest.offset(0, -1, 0));
      if (!ground || ground.name === 'air') continue;
      await bot.pathfinder.goto(new GoalNear(dest.x, dest.y, dest.z, 2));
      await bot.equip(item, 'hand');
      await bot.placeBlock(ground, new Vec3(0, 1, 0));
      placed++;
    } catch (_) {}
  }
  bot.chat(`Placed ${placed} furniture items!`);
}

// ─── CHEST MANAGEMENT ─────────────────────────────────────────────────────────
async function cmdSortChests(bot) {
  bot.chat('Sorting nearby chests... (opening and reorganizing)');
  // Basic: open each nearby chest and note contents
  const mcData = require('minecraft-data')(bot.version);
  const chestId = mcData.blocksByName.chest ? mcData.blocksByName.chest.id : 54;
  const chestBlock = bot.findBlock({ matching: chestId, maxDistance: 8 });
  if (!chestBlock) { bot.chat('No chest nearby!'); return; }
  try {
    await bot.pathfinder.goto(
      new GoalNear(chestBlock.position.x, chestBlock.position.y, chestBlock.position.z, 2));
    const chest = await bot.openChest(chestBlock);
    const contents = chest.containerItems();
    bot.chat(`Chest has ${contents.length} stacks. (Full sort requires multiple chests — basic scan done.)`);
    chest.close();
  } catch (e) { bot.chat(`Sort error: ${e.message}`); }
}

async function cmdStoreAll(bot) {
  bot.chat('Storing items in nearest chest...');
  const mcData = require('minecraft-data')(bot.version);
  const chestId = mcData.blocksByName.chest ? mcData.blocksByName.chest.id : 54;
  const chestBlock = bot.findBlock({ matching: chestId, maxDistance: 8 });
  if (!chestBlock) { bot.chat('No chest nearby!'); return; }
  try {
    await bot.pathfinder.goto(
      new GoalNear(chestBlock.position.x, chestBlock.position.y, chestBlock.position.z, 2));
    const chest = await bot.openChest(chestBlock);
    const keepNames = ['diamond_sword', 'netherite_sword', 'iron_sword', 'bow',
      'diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots',
      'totem_of_undying', 'cooked_beef', 'cooked_pork', 'bread', 'golden_apple'];
    const items = bot.inventory.items().filter(i => !keepNames.includes(i.name));
    for (const item of items) {
      try { await chest.deposit(item.type, null, item.count); }
      catch (_) {}
    }
    chest.close();
    bot.chat('Stored items!');
  } catch (e) { bot.chat(`Store error: ${e.message}`); }
}

async function cmdRestock(bot) {
  bot.chat('Restocking from nearest chest...');
  const mcData = require('minecraft-data')(bot.version);
  const chestId = mcData.blocksByName.chest ? mcData.blocksByName.chest.id : 54;
  const chestBlock = bot.findBlock({ matching: chestId, maxDistance: 8 });
  if (!chestBlock) { bot.chat('No chest nearby!'); return; }
  try {
    await bot.pathfinder.goto(
      new GoalNear(chestBlock.position.x, chestBlock.position.y, chestBlock.position.z, 2));
    const chest = await bot.openChest(chestBlock);
    const wantItems = ['cooked_beef', 'cooked_pork', 'bread', 'iron_sword',
      'diamond_sword', 'arrow', 'golden_apple'];
    for (const wantName of wantItems) {
      const mcItem = mcData.itemsByName[wantName];
      if (!mcItem) continue;
      const inChest = chest.containerItems().find(i => i.type === mcItem.id);
      if (inChest) {
        try { await chest.withdraw(inChest.type, null, Math.min(inChest.count, 16)); }
        catch (_) {}
      }
    }
    chest.close();
    bot.chat('Restocked!');
  } catch (e) { bot.chat(`Restock error: ${e.message}`); }
}

// ─── UTILITY ─────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ─── START ────────────────────────────────────────────────────────────────────
createBot();
