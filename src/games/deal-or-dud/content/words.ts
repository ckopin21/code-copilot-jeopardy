// Card-builder pools: a product, a twist, and an audience make "Radioactive gas station sushi for the IRS".
// Entries can carry a tone, but every game deals from the whole deck now (GAME_TONE), so the new cards leave it out.
// Twists list the product forms they make sense with, so a headline never comes out broken.
import type { ProductForm, Tone } from '../types';

export interface ProductWord {
  id: string;
  /** Plural phrase used in the headline, e.g. "toasters". */
  text: string;
  /** Short plural for tight spots, e.g. "toasters". */
  short: string;
  form: ProductForm;
  emoji: string;
  tone?: Tone;
  /** Word roots for generated business names. */
  roots: readonly string[];
}

export interface ModifierWord {
  id: string;
  /** Goes in front of the product: "haunted toasters". */
  text: string;
  emoji: string;
  forms: readonly ProductForm[];
  tone?: Tone;
  root?: string;
}

export interface AudienceWord {
  id: string;
  /** Goes after "for": "toasters for pirates". */
  text: string;
  emoji: string;
  tone?: Tone;
}

const ALL: readonly ProductForm[] = ['food', 'gadget', 'goods', 'pet', 'service', 'rental', 'digital', 'event'];
const STUFF: readonly ProductForm[] = ['food', 'gadget', 'goods', 'pet'];
const THINGS: readonly ProductForm[] = ['gadget', 'goods', 'pet', 'rental'];

// The whole deck is deliberately absurd: products that could never legally exist, twists that make them worse, and
// customers nobody should sell to. Anything goes except sexual content (the content test checks for that).
export const PRODUCTS: readonly ProductWord[] = [
  // Food
  { id: 'gas-station-sushi', text: 'gas station sushi', short: 'sushi', form: 'food', emoji: '🍣', roots: ['Sushi', 'Wasabi'] },
  { id: 'lava-soup', text: 'soups made of real lava', short: 'lava soup', form: 'food', emoji: '🌋', roots: ['Magma', 'Lava'] },
  { id: 'mystery-meat-pops', text: 'mystery meat popsicles', short: 'meat pops', form: 'food', emoji: '🍖', roots: ['Mystery', 'Meat'] },
  { id: 'screaming-cereal', text: 'cereals that scream when you add milk', short: 'cereal', form: 'food', emoji: '🥣', roots: ['Scream', 'Flake'] },
  { id: 'mayo-smoothies', text: 'mayonnaise smoothies', short: 'smoothies', form: 'food', emoji: '🥤', roots: ['Mayo', 'Slurp'] },
  { id: 'raw-chicken-jerky', text: 'raw chicken jerky', short: 'jerky', form: 'food', emoji: '🍗', roots: ['Cluck', 'Jerky'] },
  { id: 'stolen-moon-cheese', text: 'cheese stolen from the moon', short: 'moon cheese', form: 'food', emoji: '🧀', roots: ['Moon', 'Cheddar'] },
  { id: 'hot-dog-water', text: 'bottled hot dog water', short: 'hot dog water', form: 'food', emoji: '🌭', roots: ['Frank', 'Broth'] },
  { id: 'toenail-chips', text: 'toenail potato chips', short: 'chips', form: 'food', emoji: '🥔', roots: ['Crunch', 'Nail'] },
  { id: 'gravy-energy', text: 'gravy energy drinks', short: 'gravy drinks', form: 'food', emoji: '🥫', roots: ['Gravy', 'Surge'] },
  { id: 'dino-nuggets', text: 'lab-grown T. rex nuggets', short: 'nuggets', form: 'food', emoji: '🦖', roots: ['Rex', 'Nugget'] },
  { id: 'pre-chewed-gum', text: 'pre-chewed gum', short: 'gum', form: 'food', emoji: '🍬', roots: ['Chew', 'Gum'] },
  // Gadgets
  { id: 'snitch-toasters', text: 'toasters that report you to the police', short: 'toasters', form: 'gadget', emoji: '🍞', roots: ['Toast', 'Snitch'] },
  { id: 'pocket-flamethrowers', text: 'pocket flamethrowers', short: 'flamethrowers', form: 'gadget', emoji: '🔥', roots: ['Blaze', 'Scorch'] },
  { id: 'spy-drones', text: 'drones that spy on your neighbors', short: 'drones', form: 'gadget', emoji: '🚁', roots: ['Snoop', 'Drone'] },
  { id: 'exploding-phones', text: 'phones that explode when you lie', short: 'phones', form: 'gadget', emoji: '📱', roots: ['Kaboom', 'Phone'] },
  { id: 'ghost-monitors', text: 'baby monitors that pick up ghosts', short: 'monitors', form: 'gadget', emoji: '👻', roots: ['Boo', 'Monitor'] },
  { id: 'fake-id-printers', text: 'fake ID printers', short: 'printers', form: 'gadget', emoji: '🪪', roots: ['Totally', 'Printer'] },
  { id: 'cheating-calculators', text: 'calculators that cheat on your taxes', short: 'calculators', form: 'gadget', emoji: '🧮', roots: ['Math', 'Loophole'] },
  { id: 'slap-alarms', text: 'alarm clocks that slap you awake', short: 'alarm clocks', form: 'gadget', emoji: '⏰', roots: ['Slap', 'Wake'] },
  { id: 'mind-control-helmets', text: 'mind-control helmets', short: 'helmets', form: 'gadget', emoji: '🧠', roots: ['Brain', 'Obey'] },
  { id: 'radar-jammers', text: 'police radar jammers', short: 'jammers', form: 'gadget', emoji: '🚨', roots: ['Radar', 'Dodge'] },
  { id: 'tornado-machines', text: 'personal tornado machines', short: 'tornado machines', form: 'gadget', emoji: '🌪️', roots: ['Twister', 'Whirl'] },
  // Goods
  { id: 'counterfeit-money', text: 'counterfeit money', short: 'fake cash', form: 'goods', emoji: '💵', roots: ['Cash', 'Dollar'] },
  { id: 'haunted-dolls', text: 'secondhand haunted dolls', short: 'dolls', form: 'goods', emoji: '🪆', roots: ['Doll', 'Creepy'] },
  { id: 'used-toothbrushes', text: 'used toothbrushes', short: 'toothbrushes', form: 'goods', emoji: '🪥', roots: ['Brush', 'Bristle'] },
  { id: 'jerky-jeans', text: 'jeans made of beef jerky', short: 'jeans', form: 'goods', emoji: '👖', roots: ['Denim', 'Jerky'] },
  { id: 'skunk-perfume', text: 'eau de skunk perfumes', short: 'perfume', form: 'goods', emoji: '🦨', roots: ['Stank', 'Musk'] },
  { id: 'lead-crayons', text: 'lead paint crayons', short: 'crayons', form: 'goods', emoji: '🖍️', roots: ['Crayon', 'Lead'] },
  { id: 'asbestos-pillows', text: 'asbestos pillows', short: 'pillows', form: 'goods', emoji: '🛏️', roots: ['Fluff', 'Snooze'] },
  { id: 'glitter-bombs', text: 'glitter bombs', short: 'glitter bombs', form: 'goods', emoji: '✨', roots: ['Glitter', 'Sparkle'] },
  { id: 'stolen-traffic-cones', text: 'stolen traffic cones', short: 'cones', form: 'goods', emoji: '🚧', roots: ['Cone', 'Detour'] },
  { id: 'biting-bricks', text: 'off-brand building bricks that bite', short: 'bricks', form: 'goods', emoji: '🧱', roots: ['Brick', 'Chomp'] },
  { id: 'breeding-socks', text: 'socks that multiply overnight', short: 'socks', form: 'goods', emoji: '🧦', roots: ['Sock', 'Toe'] },
  { id: 'whoopee-cushions', text: 'industrial whoopee cushions', short: 'cushions', form: 'goods', emoji: '💨', roots: ['Toot', 'Squeak'] },
  // Pets
  { id: 'angry-pet-rocks', text: 'pet rocks with anger issues', short: 'pet rocks', form: 'pet', emoji: '🪨', roots: ['Rock', 'Pebble'] },
  { id: 'attack-hamsters', text: 'trained attack hamsters', short: 'hamsters', form: 'pet', emoji: '🐹', roots: ['Hammy', 'Fury'] },
  { id: 'lawyer-goldfish', text: 'goldfish with law degrees', short: 'goldfish', form: 'pet', emoji: '🐠', roots: ['Fin', 'Esquire'] },
  { id: 'raccoon-butlers', text: 'raccoon butlers', short: 'raccoons', form: 'pet', emoji: '🦝', roots: ['Trash', 'Bandit'] },
  { id: 'support-alligators', text: 'emotional support alligators', short: 'alligators', form: 'pet', emoji: '🐊', roots: ['Gator', 'Chomp'] },
  { id: 'crypto-cats', text: 'cats that mine crypto', short: 'cats', form: 'pet', emoji: '🐈', roots: ['Whisker', 'Coin'] },
  { id: 'dog-energy', text: 'energy drinks for dogs', short: 'dog drinks', form: 'pet', emoji: '🐕', roots: ['Pup', 'Zoom'] },
  { id: 'pocket-bees', text: 'pocket bees', short: 'bees', form: 'pet', emoji: '🐝', roots: ['Buzz', 'Hive'] },
  { id: 'unlicensed-pigeons', text: 'unlicensed carrier pigeons', short: 'pigeons', form: 'pet', emoji: '🐦', roots: ['Coo', 'Pigeon'] },
  // Services
  { id: 'backyard-dentistry', text: 'unlicensed backyard dentistry', short: 'dentistry', form: 'service', emoji: '🦷', roots: ['Tooth', 'Drill'] },
  { id: 'revenge-cakes', text: 'revenge cakes delivered to your enemies', short: 'revenge cakes', form: 'service', emoji: '🎂', roots: ['Petty', 'Frosting'] },
  { id: 'tax-evasion-lessons', text: 'tax evasion lessons', short: 'lessons', form: 'service', emoji: '📚', roots: ['Loophole', 'Offshore'] },
  { id: 'grocery-getaways', text: 'getaway drivers for grocery runs', short: 'getaway drivers', form: 'service', emoji: '🚗', roots: ['Vroom', 'Getaway'] },
  { id: 'fake-mourners', text: 'professional fake crying at funerals', short: 'fake crying', form: 'service', emoji: '😭', roots: ['Sob', 'Weep'] },
  { id: 'ransom-notes', text: 'ransom note writing', short: 'ransom notes', form: 'service', emoji: '✉️', roots: ['Ransom', 'Scribble'] },
  { id: 'haunt-your-ex', text: 'haunt-your-ex services', short: 'hauntings', form: 'service', emoji: '⚰️', roots: ['Haunt', 'Spook'] },
  { id: 'insult-coaching', text: 'personal insult coaching', short: 'insult coaching', form: 'service', emoji: '🗣️', roots: ['Roast', 'Burn'] },
  { id: 'squirrel-armies', text: 'squirrel army training', short: 'squirrel training', form: 'service', emoji: '🐿️', roots: ['Nut', 'Squad'] },
  { id: 'foot-sniffing', text: 'foot odor inspections', short: 'inspections', form: 'service', emoji: '👃', roots: ['Sniff', 'Whiff'] },
  // Rentals
  { id: 'grandma-rentals', text: 'grandma rentals', short: 'grandmas', form: 'rental', emoji: '👵', roots: ['Nana', 'Granny'] },
  { id: 'alibi-rentals', text: 'alibi rentals', short: 'alibis', form: 'rental', emoji: '🕵️', roots: ['Alibi', 'Cover'] },
  { id: 'lava-hot-tubs', text: 'lava hot tub rentals', short: 'hot tubs', form: 'rental', emoji: '🛁', roots: ['Bubble', 'Scald'] },
  { id: 'tank-rentals', text: 'army tank rentals', short: 'tanks', form: 'rental', emoji: '🪖', roots: ['Tank', 'Treads'] },
  { id: 'porta-potty-limos', text: 'porta-potty limousines', short: 'porta-potty limos', form: 'rental', emoji: '🚽', roots: ['Throne', 'Flush'] },
  { id: 'emergency-clowns', text: 'emergency clown rentals', short: 'clowns', form: 'rental', emoji: '🤡', roots: ['Honk', 'Clown'] },
  { id: 'moat-rentals', text: 'moat rentals', short: 'moats', form: 'rental', emoji: '🏰', roots: ['Moat', 'Drawbridge'] },
  { id: 'body-doubles', text: 'body double rentals', short: 'body doubles', form: 'rental', emoji: '🥸', roots: ['Double', 'Twin'] },
  { id: 'shark-tank-rentals', text: 'actual shark tank rentals', short: 'shark tanks', form: 'rental', emoji: '🦈', roots: ['Chomp', 'Fin'] },
  // Digital
  { id: 'deepfake-grandma', text: 'apps that deepfake your grandma', short: 'app', form: 'digital', emoji: '📲', roots: ['Fake', 'Nana'] },
  { id: 'pyramid-scheme-apps', text: 'pyramid scheme apps', short: 'app', form: 'digital', emoji: '🔺', roots: ['Pyramid', 'Pharaoh'] },
  { id: 'wifi-stealers', text: 'apps that steal wifi passwords', short: 'app', form: 'digital', emoji: '📶', roots: ['Wifi', 'Leech'] },
  { id: 'ghost-social', text: 'social media for ghosts', short: 'app', form: 'digital', emoji: '💀', roots: ['Spook', 'Feed'] },
  { id: 'neighbor-podcasts', text: 'true crime podcasts about your neighbors', short: 'podcast', form: 'digital', emoji: '🎙️', roots: ['Pod', 'Crime'] },
  { id: 'sandwich-nfts', text: 'NFTs of sandwiches', short: 'NFTs', form: 'digital', emoji: '🥪', roots: ['Crypto', 'Sandwich'] },
  { id: 'dog-horoscopes', text: 'horoscope apps for dogs', short: 'app', form: 'digital', emoji: '🔮', roots: ['Zodiac', 'Paw'] },
  { id: 'wrong-homework-ai', text: 'AIs that do your homework wrong on purpose', short: 'AI', form: 'digital', emoji: '🤖', roots: ['Brain', 'Oops'] },
  { id: 'scream-games', text: 'video games you have to scream to play', short: 'game', form: 'digital', emoji: '👾', roots: ['Pixel', 'Yell'] },
  // Events
  { id: 'toddler-mosh-pits', text: 'toddler mosh pits', short: 'mosh pits', form: 'event', emoji: '🤘', roots: ['Mosh', 'Diaper'] },
  { id: 'funeral-raves', text: 'funeral raves', short: 'raves', form: 'event', emoji: '🪩', roots: ['Rave', 'Wake'] },
  { id: 'hot-sauce-duels', text: 'hot sauce duels to the death', short: 'duels', form: 'event', emoji: '🌶️', roots: ['Blaze', 'Duel'] },
  { id: 'train-goat-yoga', text: 'goat yoga on a moving train', short: 'goat yoga', form: 'event', emoji: '🐐', roots: ['Goat', 'Namaste'] },
  { id: 'no-exit-escape-rooms', text: 'escape rooms with no exit', short: 'escape rooms', form: 'event', emoji: '🔐', roots: ['Escape', 'Trapped'] },
  { id: 'burping-contests', text: 'burping contests', short: 'contests', form: 'event', emoji: '😮‍💨', roots: ['Belch', 'Burp'] },
  { id: 'bear-wrestling', text: 'bear wrestling birthday parties', short: 'parties', form: 'event', emoji: '🐻', roots: ['Bear', 'Grizzly'] },
  { id: 'highway-cart-races', text: 'highway shopping cart races', short: 'cart races', form: 'event', emoji: '🛒', roots: ['Cart', 'Zoom'] },
  { id: 'seance-sleepovers', text: 'séance sleepovers', short: 'sleepovers', form: 'event', emoji: '🕯️', roots: ['Seance', 'Candle'] },
  { id: 'monster-truck-weddings', text: 'monster truck weddings', short: 'weddings', form: 'event', emoji: '🛻', roots: ['Truck', 'Crush'] },
  // More, added with the six-card hands
  { id: 'expired-cakes', text: 'cakes that expired in 1987', short: 'cakes', form: 'food', emoji: '🍰', roots: ['Cake', 'Vintage'] },
  { id: 'spicy-ice', text: 'extra-spicy ice cubes', short: 'ice cubes', form: 'food', emoji: '🧊', roots: ['Ice', 'Scorch'] },
  { id: 'fish-milkshakes', text: 'fish milkshakes', short: 'milkshakes', form: 'food', emoji: '🐟', roots: ['Fishy', 'Shake'] },
  { id: 'regret-candy', text: 'candy that tastes like regret', short: 'candy', form: 'food', emoji: '🍭', roots: ['Regret', 'Sugar'] },
  { id: 'insult-kettles', text: 'kettles that scream insults', short: 'kettles', form: 'gadget', emoji: '🫖', roots: ['Kettle', 'Sass'] },
  { id: 'mom-phones', text: 'phones that can only call your mom', short: 'phones', form: 'gadget', emoji: '☎️', roots: ['Mom', 'Dial'] },
  { id: 'sin-cameras', text: 'cameras that photograph your sins', short: 'cameras', form: 'gadget', emoji: '📷', roots: ['Snap', 'Sin'] },
  { id: 'face-leaf-blowers', text: 'leaf blowers for your face', short: 'leaf blowers', form: 'gadget', emoji: '🍃', roots: ['Blow', 'Gust'] },
  { id: 'stolen-gnomes', text: 'stolen garden gnomes', short: 'gnomes', form: 'goods', emoji: '🍄', roots: ['Gnome', 'Garden'] },
  { id: 'dark-past-mattresses', text: 'mattresses with a dark past', short: 'mattresses', form: 'goods', emoji: '🛌', roots: ['Mattress', 'Secret'] },
  { id: 'cursed-rings', text: 'cursed wedding rings', short: 'rings', form: 'goods', emoji: '💍', roots: ['Ring', 'Doom'] },
  { id: 'tin-foil-hats', text: 'tin foil hats', short: 'hats', form: 'goods', emoji: '🎩', roots: ['Foil', 'Truth'] },
  { id: 'screaming-plushies', text: 'plushies that scream at night', short: 'plushies', form: 'goods', emoji: '🧸', roots: ['Plush', 'Shriek'] },
  { id: 'attack-geese', text: 'attack geese', short: 'geese', form: 'pet', emoji: '🦢', roots: ['Honk', 'Goose'] },
  { id: 'suited-tarantulas', text: 'tarantulas in tiny suits', short: 'tarantulas', form: 'pet', emoji: '🕷️', roots: ['Spider', 'Dapper'] },
  { id: 'rat-roommates', text: 'rat roommates who pay no rent', short: 'rats', form: 'pet', emoji: '🐀', roots: ['Rat', 'Squeak'] },
  { id: 'otter-accountants', text: 'otter accountants', short: 'otters', form: 'pet', emoji: '🦦', roots: ['Otter', 'Ledger'] },
  { id: 'guard-llamas', text: 'guard llamas', short: 'llamas', form: 'pet', emoji: '🦙', roots: ['Llama', 'Spit'] },
  { id: 'fake-doctor-visits', text: 'house calls from a fake doctor', short: 'house calls', form: 'service', emoji: '🩺', roots: ['Doc', 'Quack'] },
  { id: 'breakup-texts', text: 'breakup text writing', short: 'breakup texts', form: 'service', emoji: '💬', roots: ['Dumped', 'Text'] },
  { id: 'sky-yelling', text: 'lessons in yelling at clouds', short: 'lessons', form: 'service', emoji: '☁️', roots: ['Cloud', 'Yell'] },
  { id: 'sword-swallowing', text: 'sword swallowing classes', short: 'classes', form: 'service', emoji: '🗡️', roots: ['Sword', 'Gulp'] },
  { id: 'getaway-horses', text: 'getaway horse rentals', short: 'horses', form: 'rental', emoji: '🐎', roots: ['Giddyup', 'Hoof'] },
  { id: 'jail-cell-airbnbs', text: 'jail cell Airbnbs', short: 'jail cells', form: 'rental', emoji: '🔑', roots: ['Cell', 'Slammer'] },
  { id: 'stolen-blimps', text: 'stolen blimp rentals', short: 'blimps', form: 'rental', emoji: '🎈', roots: ['Blimp', 'Float'] },
  { id: 'prom-hearses', text: 'hearse rentals for prom', short: 'hearses', form: 'rental', emoji: '⚰️', roots: ['Hearse', 'Prom'] },
  { id: 'outfit-roast-apps', text: 'apps that roast your outfit', short: 'app', form: 'digital', emoji: '👗', roots: ['Roast', 'Drip'] },
  { id: 'fake-review-bots', text: 'fake review generators', short: 'bots', form: 'digital', emoji: '⭐', roots: ['Review', 'Stars'] },
  { id: 'metaverse-timeshares', text: 'metaverse timeshares', short: 'timeshares', form: 'digital', emoji: '🥽', roots: ['Meta', 'Share'] },
  { id: 'lawnmower-derbies', text: 'lawnmower demolition derbies', short: 'derbies', form: 'event', emoji: '🚜', roots: ['Mower', 'Crash'] },
  { id: 'tax-audit-parties', text: 'tax audit parties', short: 'parties', form: 'event', emoji: '🥳', roots: ['Audit', 'Party'] },
  { id: 'zombie-marathons', text: 'marathons where zombies chase you', short: 'marathons', form: 'event', emoji: '🧟', roots: ['Zombie', 'Sprint'] },
  { id: 'black-tie-food-fights', text: 'black-tie food fights', short: 'food fights', form: 'event', emoji: '🍝', roots: ['Splat', 'Fancy'] }
];

export const MODIFIERS: readonly ModifierWord[] = [
  { id: 'radioactive', text: 'radioactive', emoji: '☢️', forms: ALL, root: 'Glow' },
  { id: 'fda-unapproved', text: 'FDA-unapproved', emoji: '🙅', forms: ALL, root: 'Unapproved' },
  { id: 'legally-distinct', text: 'legally distinct', emoji: '⚖️', forms: ALL, root: 'Distinct' },
  { id: 'haunted', text: 'haunted', emoji: '👻', forms: ALL, root: 'Spooky' },
  { id: 'slightly-illegal', text: 'slightly illegal', emoji: '🚓', forms: ALL, root: 'Outlaw' },
  { id: 'military-grade', text: 'military-grade', emoji: '🎖️', forms: ALL, root: 'Tactical' },
  { id: 'cursed', text: 'cursed', emoji: '🧿', forms: ALL, root: 'Hex' },
  { id: 'extremely-flammable', text: 'extremely flammable', emoji: '🧯', forms: ALL, root: 'Blaze' },
  { id: 'ai-powered', text: 'AI-powered', emoji: '🤖', forms: ALL, root: 'Bot' },
  { id: 'blockchain', text: 'blockchain-enabled', emoji: '⛓️', forms: ALL, root: 'Chain' },
  { id: 'recently-recalled', text: 'recently recalled', emoji: '⚠️', forms: ALL, root: 'Recall' },
  { id: 'mildly-explosive', text: 'mildly explosive', emoji: '💥', forms: ALL, root: 'Kaboom' },
  { id: 'demon-possessed', text: 'demon-possessed', emoji: '😈', forms: ALL, root: 'Demon' },
  { id: 'lawsuit-proof', text: 'lawsuit-proof', emoji: '🧑‍⚖️', forms: ALL, root: 'Sue' },
  { id: 'definitely-not-stolen', text: 'definitely-not-stolen', emoji: '🦹', forms: ALL, root: 'Swipe' },
  { id: 'screaming', text: 'screaming', emoji: '😱', forms: ALL, root: 'Scream' },
  { id: 'medieval', text: 'medieval', emoji: '⚔️', forms: ALL, root: 'Castle' },
  { id: 'multi-level-marketing', text: 'multi-level-marketing', emoji: '📈', forms: ALL, root: 'Upline' },
  { id: 'tax-deductible', text: 'tax-deductible', emoji: '🧾', forms: ALL, root: 'Writeoff' },
  { id: 'banned-in-47-countries', text: 'banned-in-47-countries', emoji: '🌍', forms: ALL, root: 'Banned' },
  { id: 'emotionally-unstable', text: 'emotionally unstable', emoji: '🥲', forms: ALL, root: 'Drama' },
  { id: 'suspiciously-cheap', text: 'suspiciously cheap', emoji: '🏷️', forms: ALL, root: 'Deal' },
  { id: 'government-issued', text: 'government-issued', emoji: '🏛️', forms: ALL, root: 'Official' },
  { id: 'black-market', text: 'black-market', emoji: '🕶️', forms: ALL, root: 'Shady' },
  { id: 'unlicensed', text: 'unlicensed', emoji: '🚫', forms: ALL, root: 'Rogue' },
  { id: 'expired', text: 'expired', emoji: '🦠', forms: ALL, root: 'Moldy' },
  { id: 'pirate-themed', text: 'pirate-themed', emoji: '🦜', forms: ALL, root: 'Pirate' },
  { id: 'vampire-approved', text: 'vampire-approved', emoji: '🧛', forms: ALL, root: 'Fang' },
  { id: 'clown-operated', text: 'clown-operated', emoji: '🎈', forms: ALL, root: 'Honk' },
  { id: 'raccoon-certified', text: 'raccoon-certified', emoji: '🗑️', forms: ALL, root: 'Bandit' },
  { id: 'toddler-tested', text: 'toddler-tested', emoji: '👶', forms: ALL, root: 'Tot' },
  { id: 'feral', text: 'feral', emoji: '🐺', forms: ALL, root: 'Feral' },
  { id: 'moist', text: 'moist', emoji: '💧', forms: ALL, root: 'Damp' },
  { id: 'gold-plated', text: 'gold-plated', emoji: '🥇', forms: STUFF, root: 'Golden' },
  { id: 'self-aware', text: 'self-aware', emoji: '🧬', forms: ['food', 'gadget', 'goods', 'pet', 'digital'], root: 'Sentient' },
  { id: 'mind-reading', text: 'mind-reading', emoji: '👁️', forms: ['gadget', 'digital', 'goods', 'pet', 'service'], root: 'Psychic' },
  { id: 'extra-sweaty', text: 'extra-sweaty', emoji: '💦', forms: ['goods', 'event', 'service', 'rental', 'food'], root: 'Swampy' },
  { id: 'stinky', text: 'stinky', emoji: '🤢', forms: [...THINGS, 'food', 'event'], root: 'Whiff' },
  { id: 'fart-powered', text: 'fart-powered', emoji: '🌬️', forms: ['gadget', 'goods', 'rental', 'event', 'pet'], root: 'Toot' },
  { id: 'rocket-powered', text: 'rocket-powered', emoji: '🚀', forms: ['gadget', 'goods', 'pet', 'rental', 'event'], root: 'Turbo' },
  { id: 'invisible', text: 'invisible', emoji: '🫥', forms: ['goods', 'gadget', 'pet', 'rental', 'food'], root: 'Vanish' },
  { id: 'edible', text: 'edible', emoji: '🍴', forms: ['goods', 'gadget', 'pet', 'rental'], root: 'Snack' },
  { id: 'glow-in-the-dark', text: 'glow-in-the-dark', emoji: '🌟', forms: ['food', 'gadget', 'goods', 'pet', 'event'], root: 'Glow' },
  { id: 'giant', text: 'giant', emoji: '🏔️', forms: ['food', 'gadget', 'goods', 'pet', 'rental', 'event'], root: 'Mega' },
  { id: 'underwater', text: 'underwater', emoji: '🤿', forms: ['event', 'service', 'gadget', 'goods', 'rental'], root: 'Deep' },
  { id: 'zero-gravity', text: 'zero-gravity', emoji: '🪐', forms: ['event', 'service', 'goods', 'food'], root: 'Orbit' },
  { id: 'extra-slimy', text: 'extra-slimy', emoji: '🟢', forms: ['goods', 'food', 'pet', 'event'], root: 'Slime' },
  { id: 'twenty-four-hour', text: '24-hour', emoji: '🕛', forms: ['service', 'digital', 'rental', 'event', 'food'], root: 'AllNight' },
  { id: 'backwards', text: 'backwards', emoji: '🔄', forms: ['service', 'event', 'gadget', 'digital'], root: 'Flip' },
  { id: 'ancient-egyptian', text: 'ancient Egyptian', emoji: '🏺', forms: ALL, root: 'Pharaoh' },
  { id: 'mob-sponsored', text: 'mob-sponsored', emoji: '🎰', forms: ALL, root: 'Family' },
  { id: 'certified-organic', text: 'certified organic', emoji: '🌿', forms: ALL, root: 'Organic' },
  { id: 'emotionally-manipulative', text: 'emotionally manipulative', emoji: '🎭', forms: ALL, root: 'Guilt' },
  { id: 'one-star', text: 'one-star-rated', emoji: '⭐', forms: ALL, root: 'OneStar' },
  { id: 'influencer-endorsed', text: 'influencer-endorsed', emoji: '🤳', forms: ALL, root: 'Hype' },
  { id: 'nuclear-powered', text: 'nuclear-powered', emoji: '⚛️', forms: ALL, root: 'Atomic' },
  { id: 'extremely-sticky', text: 'extremely sticky', emoji: '🍯', forms: ALL, root: 'Sticky' },
  { id: 'judgmental', text: 'judgmental', emoji: '🧐', forms: ALL, root: 'Judge' },
  { id: 'wildly-overpriced', text: 'wildly overpriced', emoji: '💰', forms: ALL, root: 'Premium' },
  { id: 'grandma-possessed', text: 'grandma-possessed', emoji: '👵', forms: ALL, root: 'Nana' },
  { id: 'illegal-in-florida', text: 'illegal-in-Florida', emoji: '🌴', forms: ALL, root: 'Florida' },
  { id: 'counterfeit', text: 'counterfeit', emoji: '🪙', forms: ALL, root: 'Knockoff' },
  { id: 'bootleg', text: 'bootleg', emoji: '📼', forms: ALL, root: 'Bootleg' },
  { id: 'unkillable', text: 'unkillable', emoji: '🪳', forms: ALL, root: 'Immortal' },
  { id: 'bluetooth-enabled', text: 'Bluetooth-enabled', emoji: '🛜', forms: ALL, root: 'Blue' },
  { id: 'venomous', text: 'venomous', emoji: '🐍', forms: [...STUFF, 'rental'], root: 'Venom' },
  { id: 'foot-scented', text: 'foot-scented', emoji: '🦶', forms: [...THINGS, 'food', 'event'], root: 'Toe' },
  { id: 'solar-powered', text: 'solar-powered', emoji: '☀️', forms: ['gadget', 'goods', 'pet', 'rental', 'digital'], root: 'Sunny' },
  { id: 'underground', text: 'underground', emoji: '🕳️', forms: ['event', 'service', 'rental', 'food'], root: 'Tunnel' }
];

export const AUDIENCES: readonly AudienceWord[] = [
  { id: 'retired-supervillains', text: 'retired supervillains', emoji: '🦹' },
  { id: 'toddlers-with-lawyers', text: 'toddlers with lawyers', emoji: '👶' },
  { id: 'banned-from-costco', text: 'people banned from Costco', emoji: '🛒' },
  { id: 'your-ex', text: 'your ex', emoji: '💔' },
  { id: 'bigfoot', text: 'Bigfoot', emoji: '🦍' },
  { id: 'the-irs', text: 'the IRS', emoji: '🧾' },
  { id: 'unfinished-ghosts', text: 'ghosts with unfinished business', emoji: '👻' },
  { id: 'dreamer-raccoons', text: 'raccoons with big dreams', emoji: '🦝' },
  { id: 'mob-debtors', text: 'people who owe the mob money', emoji: '💼' },
  { id: 'wolf-kids', text: 'kids raised by wolves', emoji: '🐺' },
  { id: 'day-vampires', text: 'vampires who work days', emoji: '🧛' },
  { id: 'polite-zombies', text: 'polite zombies', emoji: '🧟' },
  { id: 'wall-goblins', text: 'the goblins living in your walls', emoji: '👺' },
  { id: 'florida-men', text: 'Florida Men', emoji: '🐊' },
  { id: 'budget-cult-leaders', text: 'cult leaders on a budget', emoji: '🕯️' },
  { id: 'hr-departments', text: 'HR departments', emoji: '📋' },
  { id: 'gym-bros', text: 'gym bros', emoji: '🏋️' },
  { id: 'canceled-influencers', text: 'canceled influencers', emoji: '🤳' },
  { id: 'escaped-convicts', text: 'escaped convicts', emoji: '⛓️' },
  { id: 'pirates', text: 'pirates', emoji: '🏴‍☠️' },
  { id: 'street-racing-grandmas', text: 'grandmas who street race', emoji: '🏎️' },
  { id: 'sleepless-parents', text: 'parents who have not slept since 2019', emoji: '🍼' },
  { id: 'alien-researchers', text: 'aliens studying humans', emoji: '👽' },
  { id: 'time-travelers', text: 'time travelers', emoji: '⏳' },
  { id: 'fired-secret-agents', text: 'fired secret agents', emoji: '🕵️' },
  { id: 'angry-wizards', text: 'wizards with anger issues', emoji: '🧙' },
  { id: 'loud-mimes', text: 'mimes who finally snapped', emoji: '🎭' },
  { id: 'planning-pigeons', text: 'pigeons with a plan', emoji: '🐦' },
  { id: 'tiny-emperors', text: 'tiny emperors', emoji: '👑' },
  { id: 'lunch-break-robbers', text: 'bank robbers on their lunch break', emoji: '🏦' },
  { id: 'conspiracy-theorists', text: 'conspiracy theorists', emoji: '🛸' },
  { id: 'swamp-witches', text: 'swamp witches', emoji: '🐸' },
  { id: 'beach-goths', text: 'goths at the beach', emoji: '🏖️' },
  { id: 'deposed-kings', text: 'deposed kings', emoji: '🤴' },
  { id: 'office-fish-microwavers', text: 'people who microwave fish at work', emoji: '🐟' },
  { id: 'last-nerve-teachers', text: 'teachers on their last nerve', emoji: '🍎' },
  { id: 'mall-cops', text: 'mall cops', emoji: '👮' },
  { id: 'retired-magicians', text: 'retired magicians', emoji: '🎩' },
  { id: 'competitive-eaters', text: 'competitive eaters', emoji: '🍔' },
  { id: 'gassy-grandpas', text: 'gassy grandpas', emoji: '👴' },
  { id: 'stinky-feet', text: 'people with stinky feet', emoji: '🦶' },
  { id: 'champion-burpers', text: 'champion burpers', emoji: '🗯️' },
  { id: 'dogs-for-office', text: 'dogs running for office', emoji: '🐶' },
  { id: 'plotting-cats', text: 'cats plotting world domination', emoji: '🐱' },
  { id: 'fbi-hiders', text: 'people hiding from the FBI', emoji: '🥷' },
  { id: 'secretive-lighthouse-keepers', text: 'lighthouse keepers with secrets', emoji: '🗼' },
  { id: 'broke-crypto-bros', text: 'crypto bros who lost it all', emoji: '📉' },
  { id: 'undercover-cops', text: 'undercover cops', emoji: '🚔' },
  { id: 'medieval-peasants', text: 'medieval peasants', emoji: '🌾' },
  { id: 'feral-substitutes', text: 'substitute teachers in witness protection', emoji: '✏️' },
  { id: 'plane-clappers', text: 'people who clap when the plane lands', emoji: '🛬' },
  { id: 'feral-teens', text: 'feral teenagers', emoji: '🛹' },
  { id: 'retired-wrestlers', text: 'retired wrestlers', emoji: '🤼' },
  { id: 'reply-all-people', text: 'people who hit reply-all', emoji: '📧' },
  { id: 'monday-haters', text: 'people who hate Mondays', emoji: '📅' },
  { id: 'your-landlord', text: 'your landlord', emoji: '🏠' },
  { id: 'gym-grunters', text: 'the guy at the gym who grunts', emoji: '💪' },
  { id: 'overconfident-interns', text: 'overconfident interns', emoji: '☕' },
  { id: 'sea-monsters', text: 'sea monsters', emoji: '🐙' },
  { id: 'glue-eaters', text: 'kids who eat glue', emoji: '🧴' },
  { id: 'retired-stunt-doubles', text: 'retired stunt doubles', emoji: '🎬' },
  { id: 'escaping-chickens', text: 'chickens planning an escape', emoji: '🐔' },
  { id: 'per-my-last-email', text: 'people who say "per my last email"', emoji: '📨' },
  { id: 'the-moon', text: 'the moon', emoji: '🌙' },
  { id: 'your-nemesis', text: 'your nemesis', emoji: '😠' },
  { id: 'flat-earthers', text: 'flat earthers', emoji: '🗺️' },
  { id: 'haunted-orphans', text: 'Victorian ghost children', emoji: '🕰️' },
  { id: 'dads-at-barbecues', text: 'dads at a barbecue', emoji: '🔥' },
  { id: 'bored-astronauts', text: 'bored astronauts', emoji: '👩‍🚀' },
  { id: 'rich-babies', text: 'extremely rich babies', emoji: '💎' }
];
