# Minecraft Buddy 🤖

An advanced Minecraft companion bot built with [Mineflayer](https://github.com/PrismarineJS/mineflayer). Buddy follows you around, fights alongside you, mines resources, builds structures, farms crops, crafts items, and much more — all controlled via in-game chat commands.

---

## Features

- **Smart Combat** — attack specific mobs/players, guard mode with mob priority, multiple combat styles, ranged/melee auto-switching, critical hits, creeper dodge
- **Auto-Farm** — build farm, harvest crops, replant, auto-farm loop, animal breeding
- **Building** — walls, houses, towers, bridges, platforms, staircases, fences, furnishings
- **Mining** — mine any block (with count), strip mine tunnels, tree chopping with replanting
- **Crafting & Smelting** — craft common items, smelt ores/food in nearby furnace
- **Fishing** — automated fishing loop
- **Waypoint System** — save/go to/delete named locations, persisted across restarts
- **Macro System** — record and replay command sequences
- **Personality & Mood** — randomised responses, mood states (happy/hurt/hungry/scared)
- **Scout Mode** — run in a direction and report back on mobs found
- **Patrol Routes** — walk between saved waypoints, kill mobs along the way
- **Chest Management** — store all, restock, sort chests
- **Auto-Suggestions** — periodic tips about health, food, hostiles, inventory
- **Night Watch** — automatically enable guard mode at night
- **Mob Alarm** — alert when hostiles approach with direction info
- **Auto Door Management** — close doors behind you at night
- **Totem of Undying** — always keep totem in off-hand during combat
- **PvP Duel Mode** — spar with the owner, stops at low health

---

## Setup

### Requirements

- [Node.js](https://nodejs.org/) v16 or higher
- A Minecraft Java Edition server (offline mode, or a second account for the bot)

### Installation

```bash
# 1. Clone or download this project
git clone https://github.com/berrytanner110-oss/minecraft-buddy
cd minecraft-buddy

# 2. Install dependencies
npm install

# 3. Configure the bot (edit buddy.js top section if needed)
#    BOT_USERNAME = 'Buddy'
#    OWNER        = 'lol_thegoaty'   ← your Minecraft username
#    SERVER_HOST  = 'localhost'
#    SERVER_PORT  = 50290

# 4. Start the bot
npm start
```

### Server Requirements

- Your server must be in **offline/cracked mode** (`online-mode=false` in `server.properties`), **OR** you need a second paid Minecraft account for the bot.
- The bot user (`Buddy`) must be op'd or have permissions to interact with blocks.

---

## Command Reference

All commands are typed in Minecraft chat and are only accepted from the configured `OWNER`.

### 🗺️ General

| Command | Description |
|---|---|
| `come` / `follow me` | Bot follows you |
| `stop` / `stay` | Stop all activity |
| `status` | Show HP, food, mood, mode |
| `inventory` / `inv` | List carried items |
| `equip <item>` | Equip an item in hand |
| `equip best gear` / `gear up` | Auto-equip best available armor & weapon |
| `eat` | Eat food from inventory |
| `give me <item>` / `toss <item>` | Bot walks to you and tosses the item |
| `drop <item>` | Drop an item |
| `help` | Show help categories |
| `help combat/farm/build/waypoint/scout/craft/chest/patrol/macro/misc` | Sub-help |

### ⚔️ Combat

| Command | Description |
|---|---|
| `attack <mob/player>` | Attack a specific target |
| `kill <mob/player>` | Same as attack |
| `guard` / `protect me` | Auto-attack nearby hostiles |
| `stop guard` | Disable guard mode |
| `hunt` / `hunt mobs` | Seek out and kill all hostile mobs |
| `clear area` | Kill all hostiles nearby |
| `stop hunt` | Stop hunting |
| `style <normal/aggressive/defensive/tank>` | Set combat style |
| `shoot <target>` | Equip bow/crossbow and attack target |
| `duel` / `spar` | Fight the owner (stops at 4 hearts) |
| `stop duel` | End the duel |
| `alarm on/off` | Toggle mob proximity alerts |

**Combat Styles:**
- `normal` — standard attack
- `aggressive` — sprints, jumps for critical hits
- `defensive` — stays cautious
- `tank` — equips heaviest gear

### 🌾 Farming

| Command | Description |
|---|---|
| `build farm` | Build a 9×9 farm layout |
| `harvest` | Harvest all nearby crops |
| `replant` | Replant harvested farmland |
| `plant <crop>` | Plant a specific crop (wheat/carrot/potato/beetroot/melon/pumpkin) |
| `auto farm` | Start harvesting + replanting loop (every 2 min) |
| `stop farm` | Stop auto-farm loop |
| `breed <animal>` | Feed 2 nearby animals to breed them |
| `breed all` | Breed all nearby breedable animals |

**Breedable Animals:** cow (wheat), sheep (wheat), pig (carrot), chicken (wheat_seeds), horse (golden_apple), rabbit (dandelion), llama (hay_block)

### 🌲 Tree Farm & Fishing

| Command | Description |
|---|---|
| `chop trees` / `chop wood` | Chop nearby logs, replant saplings |
| `tree farm` | Continuous chop + replant loop |
| `stop chop` | Stop chopping |
| `fish` / `start fishing` | Cast line, auto-reel, repeat |
| `stop fishing` | Stop fishing |

### 🍳 Cooking & Smelting

| Command | Description |
|---|---|
| `cook` / `smelt` | Find furnace, smelt raw food/materials |
| `cook all` | Same as cook |
| `smelt ores` | Find furnace, smelt iron/gold/copper ores |

### 🏗️ Building

| Command | Description |
|---|---|
| `build wall [length]` | Build a 3-high wall |
| `build house` | Build a 5×5 house with roof |
| `build tower [height]` | Build a hollow tower |
| `build bridge [length]` | Build a bridge |
| `build platform [size]` | Build a flat platform |
| `build staircase [height]` | Build a staircase |
| `build fence <size>` | Build a fence perimeter |
| `build fence around me [radius]` | Fence around the player |
| `place <block>` | Place a block from inventory |
| `light up` / `place torches` | Place torches in 6-block grid |
| `furnish` / `add furniture` | Place crafting table, furnace, chest, bed |
| `strip mine [length]` / `mine tunnel` | Dig 2-high 1-wide tunnel, alerts on ores |

### ⛏️ Mining

| Command | Description |
|---|---|
| `mine <block>` | Mine the nearest matching block |
| `mine <count> <block>` | Mine a specific count (e.g. `mine 10 oak_log`) |
| `collect <block>` | Same as mine |

### 🔨 Crafting

| Command | Description |
|---|---|
| `craft [count] <item>` | Craft items (uses nearby crafting table if needed) |

**Supported items:** torch, stick, oak_planks, crafting_table, furnace, chest, ladder, bowl, oak_boat, wooden_sword, stone_sword, iron_sword, wooden_pickaxe, stone_pickaxe, iron_pickaxe, iron_axe

### 🗺️ Waypoints

| Command | Description |
|---|---|
| `remember here as <name>` | Save current position as a waypoint |
| `go to <name>` | Pathfind to a saved waypoint |
| `waypoints` / `list waypoints` | List all saved waypoints |
| `forget <name>` | Delete a waypoint |

Waypoints are saved to `waypoints.json` and loaded on startup.

### 📝 Macros

| Command | Description |
|---|---|
| `learn <name> = <cmd1>, <cmd2>, ...` | Save a command sequence |
| `do <name>` | Execute a saved macro |
| `forget macro <name>` | Delete a macro |
| `macros` / `list macros` | List all saved macros |

Macros are saved to `macros.json` and loaded on startup.

**Example:**
```
learn morning = equip best gear, guard, auto farm
do morning
```

### 🗺️ Scout & Patrol

| Command | Description |
|---|---|
| `scout <north/south/east/west>` | Run 60 blocks in direction, report mobs found |
| `scout around` | Scout all 4 directions |
| `patrol` | Walk all saved waypoints in loop, kill mobs |
| `patrol <wp1> <wp2> ...` | Patrol specific waypoints |
| `stop patrol` | Stop patrolling |

### 📦 Chest Management

| Command | Description |
|---|---|
| `sort chests` | Inspect nearest chest |
| `store all` | Put non-essential items into nearest chest |
| `restock` | Take food & weapons from nearest chest |

### 🔧 Toggles & Modes

| Command | Description |
|---|---|
| `auto pickup on/off` | Toggle auto-picking up nearby dropped items |
| `night watch on/off` | Toggle auto-guard at night (default: on) |
| `alarm on/off` | Toggle mob proximity alarm (default: off) |
| `doors on/off` | Toggle auto-close doors at night (default: on) |

---

## Mood System

Buddy has a dynamic mood that changes based on conditions:

| Mood | Trigger |
|---|---|
| `hurt` | Health < 8 |
| `hungry` | Food < 6 |
| `scared` | Creeper within 16 blocks |
| `happy` | After winning a duel |
| `neutral` | Default |

The mood prefix is shown in chat responses (e.g. `[Hurt] Mining!`).

---

## Auto-Suggestions

Every 10 seconds, Buddy checks for conditions and suggests actions (60-second cooldown per type):

- It's getting dark → suggests guarding
- Owner is low on health → alerts
- Bot is low on food → alerts  
- Hostile mobs within 20 blocks → warns
- Inventory > 30 items → warns

---

## Troubleshooting

**Bot won't connect**
- Check `SERVER_HOST` and `SERVER_PORT` in `buddy.js`
- Ensure the server is running and set to `online-mode=false` (or use a valid account)

**Bot doesn't respond to commands**
- Verify you're using the correct `OWNER` username (case-sensitive)
- The bot only responds to the owner

**Pathfinding errors**
- The bot may get stuck in complex terrain; use `stop` and try again
- Make sure the path isn't blocked by water or lava

**Crafting doesn't work**
- Place a crafting table within 16 blocks of the bot
- Ensure the bot has the required ingredients

**Furnace commands fail**
- Place a furnace within 32 blocks of the bot
- Ensure the bot has fuel (coal, wood) and raw materials

---

## File Structure

```
minecraft-buddy/
├── buddy.js          # Main bot file
├── package.json      # Node.js dependencies
├── README.md         # This file
├── .gitignore        # Ignores node_modules, waypoints.json, macros.json
├── waypoints.json    # Auto-generated, stores saved waypoints
└── macros.json       # Auto-generated, stores saved macros
```

---

## License

MIT
