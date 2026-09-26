// Product-builder pools. Every entry carries a tone ('clean' when omitted) so Clean games only
// ever see wholesome words. Modifiers list the product forms they make sense with.
import type { ProductForm, Tone } from '../types';

export interface ProductWord {
  id: string;
  /** Plural phrase used in the headline, e.g. "toaster rentals". */
  text: string;
  /** Short plural used inside fact cards, e.g. "toasters". */
  short: string;
  form: ProductForm;
  tone?: Tone;
  /** Word roots for generated business names. */
  roots: readonly string[];
}

export interface ModifierWord {
  id: string;
  text: string;
  /** Adjective order: lower comes first ("luxury haunted", not "haunted luxury"). */
  rank: number;
  forms: readonly ProductForm[];
  tone?: Tone;
  root?: string;
}

export interface AudienceWord {
  id: string;
  text: string;
  tone?: Tone;
}

const ALL: readonly ProductForm[] = ['food', 'gadget', 'goods', 'pet', 'service', 'rental', 'digital', 'event'];
const THINGS: readonly ProductForm[] = ['food', 'gadget', 'goods', 'pet', 'rental'];
const OBJECTS: readonly ProductForm[] = ['gadget', 'goods', 'pet', 'rental'];
const SMART: readonly ProductForm[] = ['gadget', 'digital', 'goods', 'pet'];
const LIVE: readonly ProductForm[] = ['service', 'event', 'rental'];

export const MODIFIERS: readonly ModifierWord[] = [
  { id: 'luxury', text: 'luxury', rank: 1, forms: ALL, root: 'Lux' },
  { id: 'budget', text: 'budget', rank: 1, forms: ALL, root: 'Thrift' },
  { id: 'award-winning', text: 'award-winning', rank: 1, forms: ALL, root: 'Trophy' },
  { id: 'fancy', text: 'fancy', rank: 1, forms: ALL, root: 'Posh' },
  { id: 'extremely-polite', text: 'extremely polite', rank: 1, forms: ['gadget', 'digital', 'service', 'pet'], root: 'Polite' },
  { id: 'overly-dramatic', text: 'overly dramatic', rank: 1, forms: ALL, tone: 'silly', root: 'Drama' },
  { id: 'suspiciously-cheap', text: 'suspiciously cheap', rank: 1, forms: ALL, tone: 'silly', root: 'Deal' },
  { id: 'emotional-support', text: 'emotional-support', rank: 1, forms: ['goods', 'pet', 'gadget', 'service'], tone: 'silly', root: 'Comfy' },
  { id: 'giant', text: 'giant', rank: 2, forms: ['food', 'gadget', 'goods', 'pet', 'rental', 'event'], root: 'Mega' },
  { id: 'tiny', text: 'tiny', rank: 2, forms: ['food', 'gadget', 'goods', 'pet', 'rental', 'event'], root: 'Mini' },
  { id: 'pocket-sized', text: 'pocket-sized', rank: 2, forms: ['food', 'gadget', 'goods', 'pet'], root: 'Pocket' },
  { id: 'vintage', text: 'vintage', rank: 3, forms: ['gadget', 'goods', 'rental', 'event'], root: 'Retro' },
  { id: 'futuristic', text: 'futuristic', rank: 3, forms: ALL, root: 'Future' },
  { id: 'medieval', text: 'medieval', rank: 3, forms: ALL, root: 'Castle' },
  { id: 'royal', text: 'royal', rank: 3, forms: ALL, root: 'Royal' },
  { id: 'retro-arcade', text: 'retro arcade', rank: 3, forms: ['gadget', 'goods', 'event', 'digital', 'rental'], root: 'Pixel' },
  { id: 'haunted', text: 'haunted', rank: 4, forms: ['food', 'gadget', 'goods', 'rental', 'event'], tone: 'silly', root: 'Spooky' },
  { id: 'self-aware', text: 'self-aware', rank: 4, forms: SMART, root: 'Brainy' },
  { id: 'singing', text: 'singing', rank: 4, forms: ['food', 'gadget', 'goods', 'pet'], root: 'Tune' },
  { id: 'glow-in-the-dark', text: 'glow-in-the-dark', rank: 4, forms: ['food', 'gadget', 'goods', 'pet', 'event'], root: 'Glow' },
  { id: 'invisible', text: 'invisible', rank: 4, forms: ['goods', 'gadget', 'pet'], root: 'Vanish' },
  { id: 'talking', text: 'talking', rank: 4, forms: ['gadget', 'goods', 'pet'], root: 'Chatty' },
  { id: 'dancing', text: 'dancing', rank: 4, forms: ['gadget', 'goods', 'event', 'service'], root: 'Groove' },
  { id: 'motivational', text: 'motivational', rank: 4, forms: ['gadget', 'digital', 'goods', 'service'], root: 'Hype' },
  { id: 'sleepy', text: 'sleepy', rank: 4, forms: ['gadget', 'goods', 'pet', 'service'], root: 'Snooze' },
  { id: 'extra-loud', text: 'extra-loud', rank: 4, forms: ['gadget', 'goods', 'event', 'service'], root: 'Boom' },
  { id: 'whisper-quiet', text: 'whisper-quiet', rank: 4, forms: ['gadget', 'goods', 'service'], root: 'Hush' },
  { id: 'turbo', text: 'turbo', rank: 4, forms: ['gadget', 'goods', 'pet', 'service', 'rental'], root: 'Turbo' },
  { id: 'spicy', text: 'extra-spicy', rank: 4, forms: ['food', 'goods'], tone: 'silly', root: 'Blaze' },
  { id: 'solar-powered', text: 'solar-powered', rank: 5, forms: ['gadget', 'goods', 'pet', 'rental'], root: 'Sunny' },
  { id: 'inflatable', text: 'inflatable', rank: 5, forms: ['goods', 'pet', 'rental', 'event'], root: 'Bouncy' },
  { id: 'waterproof', text: 'waterproof', rank: 5, forms: ['gadget', 'goods', 'pet'], root: 'Splash' },
  { id: 'edible', text: 'edible', rank: 5, forms: ['goods', 'gadget', 'pet', 'food'], root: 'Snack' },
  { id: 'cardboard', text: 'cardboard', rank: 5, forms: ['gadget', 'goods', 'pet'], root: 'Boxy' },
  { id: 'gold-plated', text: 'gold-plated', rank: 5, forms: ['gadget', 'goods', 'pet', 'food'], root: 'Golden' },
  { id: 'glitter-covered', text: 'glitter-covered', rank: 5, forms: ['food', 'goods', 'pet', 'event'], root: 'Sparkle' },
  { id: 'bubble-wrapped', text: 'bubble-wrapped', rank: 5, forms: ['goods', 'gadget', 'food'], root: 'Bubble' },
  { id: 'organic', text: 'organic', rank: 5, forms: ['food', 'pet', 'goods'], root: 'Sprout' },
  { id: 'frozen', text: 'frozen', rank: 5, forms: ['food', 'goods', 'event'], root: 'Frost' },
  { id: 'robot-assisted', text: 'robot-assisted', rank: 6, forms: ALL, root: 'Robo' },
  { id: 'app-controlled', text: 'app-controlled', rank: 6, forms: ['gadget', 'goods', 'pet', 'rental'], root: 'Tap' },
  { id: 'voice-activated', text: 'voice-activated', rank: 6, forms: ['gadget', 'goods', 'pet'], root: 'Echo' },
  { id: 'foldable', text: 'foldable', rank: 6, forms: ['gadget', 'goods', 'rental'], root: 'Fold' },
  { id: 'twenty-four-hour', text: '24-hour', rank: 6, forms: ['service', 'digital', 'rental', 'event', 'food'], root: 'AllDay' },
  { id: 'on-demand', text: 'on-demand', rank: 6, forms: ['service', 'digital', 'rental', 'food'], root: 'Snap' },
  { id: 'mobile', text: 'mobile', rank: 6, forms: LIVE, root: 'Roam' },
  { id: 'underwater', text: 'underwater', rank: 6, forms: ['event', 'service', 'gadget', 'goods'], root: 'Deep' },
  { id: 'zero-gravity', text: 'zero-gravity', rank: 6, forms: ['event', 'service', 'goods', 'food'], root: 'Orbit' },
  { id: 'backyard', text: 'backyard', rank: 6, forms: ['event', 'service', 'rental'], root: 'Yard' },
  { id: 'subscription', text: 'monthly subscription', rank: 6, forms: THINGS, root: 'Monthly' },
  // Crude-only additions: mild bathroom and gross-out humor.
  { id: 'stinky', text: 'stinky', rank: 4, forms: [...OBJECTS, 'food', 'event'], tone: 'crude', root: 'Whiff' },
  { id: 'burp-powered', text: 'burp-powered', rank: 5, forms: ['gadget', 'goods'], tone: 'crude', root: 'Burp' },
  { id: 'sweaty', text: 'sweaty', rank: 4, forms: ['goods', 'event', 'service', 'rental'], tone: 'crude', root: 'Swampy' },
  { id: 'fart-scented', text: 'fart-scented', rank: 5, forms: ['goods', 'pet', 'gadget'], tone: 'crude', root: 'Toot' },
  { id: 'extra-slimy', text: 'extra-slimy', rank: 5, forms: ['goods', 'food', 'pet'], tone: 'crude', root: 'Slime' },
  { id: 'sock-scented', text: 'sock-scented', rank: 5, forms: ['goods', 'gadget', 'food'], tone: 'crude', root: 'Sock' }
];

export const PRODUCTS: readonly ProductWord[] = [
  // Food
  { id: 'cookies', text: 'cookies', short: 'cookies', form: 'food', roots: ['Cookie', 'Crumb'] },
  { id: 'pickles', text: 'pickles', short: 'pickles', form: 'food', roots: ['Pickle', 'Brine'] },
  { id: 'breakfast-cereal', text: 'breakfast cereal', short: 'cereal', form: 'food', roots: ['Crunch', 'Flake'] },
  { id: 'hot-sauce', text: 'hot sauce', short: 'hot sauce', form: 'food', roots: ['Sauce', 'Blaze'] },
  { id: 'smoothies', text: 'smoothies', short: 'smoothies', form: 'food', roots: ['Blend', 'Smoothie'] },
  { id: 'popcorn', text: 'popcorn', short: 'popcorn', form: 'food', roots: ['Pop', 'Kernel'] },
  { id: 'granola-bars', text: 'granola bars', short: 'granola bars', form: 'food', roots: ['Granola', 'Oat'] },
  { id: 'pizza-slices', text: 'pizza slices', short: 'pizza slices', form: 'food', roots: ['Slice', 'Pizza'] },
  { id: 'tacos', text: 'tacos', short: 'tacos', form: 'food', roots: ['Taco', 'Salsa'] },
  { id: 'soup', text: 'soup cups', short: 'soup cups', form: 'food', roots: ['Soup', 'Ladle'] },
  { id: 'jelly-beans', text: 'jelly beans', short: 'jelly beans', form: 'food', roots: ['Bean', 'Jelly'] },
  { id: 'ice-pops', text: 'ice pops', short: 'ice pops', form: 'food', roots: ['Pop', 'Chill'] },
  { id: 'pancake-mix', text: 'pancake mix', short: 'pancake mix', form: 'food', roots: ['Flap', 'Stack'] },
  { id: 'muffins', text: 'muffins', short: 'muffins', form: 'food', roots: ['Muffin', 'Bake'] },
  { id: 'pretzels', text: 'pretzels', short: 'pretzels', form: 'food', roots: ['Twist', 'Pretzel'] },
  { id: 'cupcakes', text: 'cupcakes', short: 'cupcakes', form: 'food', roots: ['Cupcake', 'Frosting'] },
  { id: 'dumplings', text: 'dumplings', short: 'dumplings', form: 'food', roots: ['Dumpling', 'Steam'] },
  { id: 'lemonade', text: 'lemonade', short: 'lemonade', form: 'food', roots: ['Lemon', 'Squeeze'] },
  { id: 'baked-beans', text: 'baked beans', short: 'baked beans', form: 'food', tone: 'crude', roots: ['Bean', 'Toot'] },
  // Gadgets
  { id: 'alarm-clocks', text: 'alarm clocks', short: 'alarm clocks', form: 'gadget', roots: ['Wake', 'Ring'] },
  { id: 'toasters', text: 'toasters', short: 'toasters', form: 'gadget', roots: ['Toast', 'Crisp'] },
  { id: 'headphones', text: 'headphones', short: 'headphones', form: 'gadget', roots: ['Ear', 'Sound'] },
  { id: 'phone-cases', text: 'phone cases', short: 'phone cases', form: 'gadget', roots: ['Case', 'Shell'] },
  { id: 'desk-fans', text: 'desk fans', short: 'desk fans', form: 'gadget', roots: ['Breeze', 'Fan'] },
  { id: 'night-lights', text: 'night lights', short: 'night lights', form: 'gadget', roots: ['Glow', 'Beam'] },
  { id: 'robot-vacuums', text: 'robot vacuums', short: 'robot vacuums', form: 'gadget', roots: ['Vac', 'Sweep'] },
  { id: 'karaoke-machines', text: 'karaoke machines', short: 'karaoke machines', form: 'gadget', roots: ['Mic', 'Encore'] },
  { id: 'smart-mirrors', text: 'smart mirrors', short: 'smart mirrors', form: 'gadget', roots: ['Mirror', 'Reflect'] },
  { id: 'sneaker-dryers', text: 'sneaker dryers', short: 'sneaker dryers', form: 'gadget', roots: ['Dry', 'Kick'] },
  { id: 'label-makers', text: 'label makers', short: 'label makers', form: 'gadget', roots: ['Label', 'Tag'] },
  { id: 'waffle-irons', text: 'waffle irons', short: 'waffle irons', form: 'gadget', roots: ['Waffle', 'Grid'] },
  { id: 'bike-bells', text: 'bike bells', short: 'bike bells', form: 'gadget', roots: ['Ding', 'Pedal'] },
  { id: 'hover-boards', text: 'hoverboards', short: 'hoverboards', form: 'gadget', roots: ['Hover', 'Glide'] },
  { id: 'shower-radios', text: 'shower radios', short: 'shower radios', form: 'gadget', roots: ['Splash', 'Tune'] },
  { id: 'burp-translators', text: 'burp translators', short: 'burp translators', form: 'gadget', tone: 'crude', roots: ['Burp', 'Belch'] },
  // Goods
  { id: 'lunch-boxes', text: 'lunch boxes', short: 'lunch boxes', form: 'goods', roots: ['Lunch', 'Tote'] },
  { id: 'socks', text: 'socks', short: 'socks', form: 'goods', roots: ['Sock', 'Toe'] },
  { id: 'backpacks', text: 'backpacks', short: 'backpacks', form: 'goods', roots: ['Pack', 'Trek'] },
  { id: 'umbrellas', text: 'umbrellas', short: 'umbrellas', form: 'goods', roots: ['Drizzle', 'Brella'] },
  { id: 'bean-bag-chairs', text: 'bean bag chairs', short: 'bean bag chairs', form: 'goods', roots: ['Flop', 'Lounge'] },
  { id: 'sunglasses', text: 'sunglasses', short: 'sunglasses', form: 'goods', roots: ['Shade', 'Squint'] },
  { id: 'water-bottles', text: 'water bottles', short: 'water bottles', form: 'goods', roots: ['Sip', 'Hydro'] },
  { id: 'hoodies', text: 'hoodies', short: 'hoodies', form: 'goods', roots: ['Hood', 'Cozy'] },
  { id: 'board-games', text: 'board games', short: 'board games', form: 'goods', roots: ['Dice', 'Meeple'] },
  { id: 'pillows', text: 'pillows', short: 'pillows', form: 'goods', roots: ['Fluff', 'Pillow'] },
  { id: 'slippers', text: 'slippers', short: 'slippers', form: 'goods', roots: ['Slip', 'Shuffle'] },
  { id: 'sticky-notes', text: 'sticky notes', short: 'sticky notes', form: 'goods', roots: ['Stick', 'Note'] },
  { id: 'rain-boots', text: 'rain boots', short: 'rain boots', form: 'goods', roots: ['Puddle', 'Boot'] },
  { id: 'yoga-mats', text: 'yoga mats', short: 'yoga mats', form: 'goods', roots: ['Stretch', 'Mat'] },
  { id: 'jigsaw-puzzles', text: 'jigsaw puzzles', short: 'puzzles', form: 'goods', roots: ['Puzzle', 'Piece'] },
  { id: 'scented-candles', text: 'scented candles', short: 'candles', form: 'goods', roots: ['Wick', 'Glow'] },
  { id: 'hammocks', text: 'hammocks', short: 'hammocks', form: 'goods', roots: ['Sway', 'Hang'] },
  { id: 'whoopee-cushions', text: 'whoopee cushions', short: 'whoopee cushions', form: 'goods', tone: 'crude', roots: ['Toot', 'Squeak'] },
  { id: 'gym-bags', text: 'odor-proof gym bags', short: 'gym bags', form: 'goods', tone: 'silly', roots: ['Stash', 'Gym'] },
  // Pets
  { id: 'doggy-treadmills', text: 'doggy treadmills', short: 'treadmills', form: 'pet', roots: ['Paw', 'Trot'] },
  { id: 'cat-towers', text: 'cat towers', short: 'cat towers', form: 'pet', roots: ['Whisker', 'Perch'] },
  { id: 'dog-sweaters', text: 'dog sweaters', short: 'dog sweaters', form: 'pet', roots: ['Pup', 'Knit'] },
  { id: 'hamster-mazes', text: 'hamster mazes', short: 'hamster mazes', form: 'pet', roots: ['Hammy', 'Maze'] },
  { id: 'fish-tanks', text: 'fish tanks', short: 'fish tanks', form: 'pet', roots: ['Fin', 'Tank'] },
  { id: 'bird-feeders', text: 'bird feeders', short: 'bird feeders', form: 'pet', roots: ['Tweet', 'Seed'] },
  { id: 'dog-treats', text: 'dog treats', short: 'dog treats', form: 'pet', roots: ['Biscuit', 'Wag'] },
  { id: 'cat-toys', text: 'cat toys', short: 'cat toys', form: 'pet', roots: ['Pounce', 'Meow'] },
  { id: 'pet-strollers', text: 'pet strollers', short: 'pet strollers', form: 'pet', roots: ['Stroll', 'Paws'] },
  { id: 'litter-robots', text: 'self-cleaning litter boxes', short: 'litter boxes', form: 'pet', tone: 'crude', roots: ['Scoop', 'Litter'] },
  // Services
  { id: 'dance-lessons', text: 'dance lessons', short: 'lessons', form: 'service', roots: ['Step', 'Twirl'] },
  { id: 'car-washes', text: 'car washes', short: 'car washes', form: 'service', roots: ['Suds', 'Shine'] },
  { id: 'dog-walking', text: 'dog-walking visits', short: 'visits', form: 'service', roots: ['Leash', 'Walk'] },
  { id: 'haircuts', text: 'haircuts', short: 'haircuts', form: 'service', roots: ['Snip', 'Trim'] },
  { id: 'tutoring', text: 'homework tutoring', short: 'sessions', form: 'service', roots: ['Study', 'Brain'] },
  { id: 'lawn-mowing', text: 'lawn mowing', short: 'mowing visits', form: 'service', roots: ['Mow', 'Grass'] },
  { id: 'cooking-classes', text: 'cooking classes', short: 'classes', form: 'service', roots: ['Chef', 'Whisk'] },
  { id: 'closet-organizing', text: 'closet organizing', short: 'visits', form: 'service', roots: ['Tidy', 'Sort'] },
  { id: 'sneaker-cleaning', text: 'sneaker cleaning', short: 'cleanings', form: 'service', roots: ['Fresh', 'Sole'] },
  { id: 'nap-coaching', text: 'nap coaching', short: 'sessions', form: 'service', tone: 'silly', roots: ['Nap', 'Doze'] },
  { id: 'foot-odor-checks', text: 'foot odor inspections', short: 'inspections', form: 'service', tone: 'crude', roots: ['Sniff', 'Whiff'] },
  // Rentals
  { id: 'toaster-rentals', text: 'toaster rentals', short: 'toasters', form: 'rental', roots: ['Toast', 'Loaf'] },
  { id: 'bounce-house-rentals', text: 'bounce house rentals', short: 'bounce houses', form: 'rental', roots: ['Bounce', 'Boing'] },
  { id: 'tuxedo-rentals', text: 'tuxedo rentals', short: 'tuxedos', form: 'rental', roots: ['Tux', 'Dapper'] },
  { id: 'kayak-rentals', text: 'kayak rentals', short: 'kayaks', form: 'rental', roots: ['Paddle', 'Kayak'] },
  { id: 'costume-rentals', text: 'costume rentals', short: 'costumes', form: 'rental', roots: ['Costume', 'Disguise'] },
  { id: 'telescope-rentals', text: 'telescope rentals', short: 'telescopes', form: 'rental', roots: ['Star', 'Scope'] },
  { id: 'scooter-rentals', text: 'scooter rentals', short: 'scooters', form: 'rental', roots: ['Zoom', 'Scoot'] },
  { id: 'tent-rentals', text: 'camping tent rentals', short: 'tents', form: 'rental', roots: ['Camp', 'Tent'] },
  { id: 'porta-potty-rentals', text: 'fancy porta-potty rentals', short: 'porta-potties', form: 'rental', tone: 'crude', roots: ['Throne', 'Flush'] },
  // Digital
  { id: 'homework-apps', text: 'homework apps', short: 'app', form: 'digital', roots: ['Study', 'Quiz'] },
  { id: 'alarm-apps', text: 'wake-up apps', short: 'app', form: 'digital', roots: ['Rise', 'Snooze'] },
  { id: 'fitness-apps', text: 'fitness apps', short: 'app', form: 'digital', roots: ['Fit', 'Rep'] },
  { id: 'recipe-apps', text: 'recipe apps', short: 'app', form: 'digital', roots: ['Recipe', 'Yum'] },
  { id: 'language-apps', text: 'language apps', short: 'app', form: 'digital', roots: ['Lingo', 'Talk'] },
  { id: 'plant-care-apps', text: 'plant care apps', short: 'app', form: 'digital', roots: ['Leaf', 'Bloom'] },
  { id: 'podcast-networks', text: 'podcasts', short: 'podcast', form: 'digital', roots: ['Pod', 'Mic'] },
  { id: 'video-games', text: 'video games', short: 'game', form: 'digital', roots: ['Pixel', 'Quest'] },
  { id: 'chore-trackers', text: 'chore-tracking apps', short: 'app', form: 'digital', roots: ['Chore', 'Check'] },
  { id: 'burp-apps', text: 'burp-rating apps', short: 'app', form: 'digital', tone: 'crude', roots: ['Burp', 'Belch'] },
  // Events
  { id: 'birthday-parties', text: 'birthday parties', short: 'parties', form: 'event', roots: ['Party', 'Candle'] },
  { id: 'escape-rooms', text: 'escape rooms', short: 'escape rooms', form: 'event', roots: ['Escape', 'Key'] },
  { id: 'talent-shows', text: 'talent shows', short: 'shows', form: 'event', roots: ['Star', 'Stage'] },
  { id: 'mini-golf', text: 'mini golf courses', short: 'mini golf', form: 'event', roots: ['Putt', 'Hole'] },
  { id: 'movie-nights', text: 'outdoor movie nights', short: 'movie nights', form: 'event', roots: ['Reel', 'Screen'] },
  { id: 'cooking-contests', text: 'cooking contests', short: 'contests', form: 'event', roots: ['Cookoff', 'Chef'] },
  { id: 'trivia-nights', text: 'trivia nights', short: 'trivia nights', form: 'event', roots: ['Brain', 'Quiz'] },
  { id: 'obstacle-courses', text: 'obstacle courses', short: 'courses', form: 'event', roots: ['Hurdle', 'Dash'] },
  { id: 'mud-runs', text: 'mud runs', short: 'mud runs', form: 'event', tone: 'silly', roots: ['Mud', 'Splat'] },
  { id: 'burping-contests', text: 'burping contests', short: 'contests', form: 'event', tone: 'crude', roots: ['Belch', 'Burp'] }
];

export const AUDIENCES: readonly AudienceWord[] = [
  { id: 'tired-gamers', text: 'tired gamers' },
  { id: 'retired-magicians', text: 'retired magicians' },
  { id: 'competitive-toddlers', text: 'competitive toddlers' },
  { id: 'busy-parents', text: 'busy parents' },
  { id: 'sleepy-students', text: 'sleepy students' },
  { id: 'marathon-runners', text: 'marathon runners' },
  { id: 'pirates', text: 'pirates' },
  { id: 'astronauts', text: 'astronauts' },
  { id: 'grandmas', text: 'grandmas' },
  { id: 'substitute-teachers', text: 'substitute teachers' },
  { id: 'lifeguards', text: 'lifeguards' },
  { id: 'chess-champions', text: 'chess champions' },
  { id: 'birdwatchers', text: 'birdwatchers' },
  { id: 'night-shift-nurses', text: 'night-shift nurses' },
  { id: 'camp-counselors', text: 'camp counselors' },
  { id: 'lighthouse-keepers', text: 'lighthouse keepers' },
  { id: 'band-kids', text: 'band kids' },
  { id: 'theater-kids', text: 'theater kids' },
  { id: 'skateboarders', text: 'skateboarders' },
  { id: 'mail-carriers', text: 'mail carriers' },
  { id: 'zookeepers', text: 'zookeepers' },
  { id: 'budget-superheroes', text: 'superheroes on a budget' },
  { id: 'time-travelers', text: 'time travelers' },
  { id: 'secret-agents', text: 'secret agents' },
  { id: 'college-freshmen', text: 'college freshmen' },
  { id: 'cheerleaders', text: 'cheerleaders' },
  { id: 'knights', text: 'knights' },
  { id: 'farmers', text: 'farmers' },
  { id: 'beekeepers', text: 'beekeepers' },
  { id: 'librarians', text: 'librarians' },
  { id: 'robots', text: 'robots' },
  { id: 'aliens', text: 'friendly aliens' },
  { id: 'cowboys', text: 'cowboys' },
  { id: 'detectives', text: 'detectives' },
  { id: 'snowboarders', text: 'snowboarders' },
  { id: 'first-time-campers', text: 'first-time campers' },
  { id: 'cats', text: 'cats' },
  { id: 'dog-owners', text: 'dog owners' },
  { id: 'wizards', text: 'wizards' },
  { id: 'soccer-teams', text: 'soccer teams' },
  { id: 'morning-haters', text: 'people who hate mornings', tone: 'silly' },
  { id: 'gym-bros', text: 'gym bros', tone: 'silly' },
  { id: 'influencers', text: 'influencers', tone: 'silly' },
  { id: 'dramatic-llamas', text: 'dramatic llamas', tone: 'silly' },
  { id: 'vampires', text: 'vampires who work days', tone: 'silly' },
  { id: 'zombies', text: 'polite zombies', tone: 'silly' },
  { id: 'stinky-feet', text: 'people with stinky feet', tone: 'crude' },
  { id: 'gassy-grandpas', text: 'gassy grandpas', tone: 'crude' },
  { id: 'sweaty-hikers', text: 'extremely sweaty hikers', tone: 'crude' },
  { id: 'loud-burpers', text: 'champion burpers', tone: 'crude' }
];
