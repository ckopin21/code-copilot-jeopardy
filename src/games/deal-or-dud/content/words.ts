// Card-builder pools: a product, a twist, and an audience make "Haunted toasters for pirates".
// Every entry carries a tone ('clean' when omitted) so Clean games only ever see wholesome words.
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
const OBJECTS: readonly ProductForm[] = ['gadget', 'goods', 'pet', 'rental'];

export const PRODUCTS: readonly ProductWord[] = [
  // Food
  { id: 'breakfast-tacos', text: 'breakfast tacos', short: 'tacos', form: 'food', emoji: '🌮', roots: ['Taco', 'Salsa'] },
  { id: 'hot-sauce', text: 'hot sauce', short: 'hot sauce', form: 'food', emoji: '🌶️', roots: ['Sauce', 'Blaze'] },
  { id: 'cereal', text: 'breakfast cereal', short: 'cereal', form: 'food', emoji: '🥣', roots: ['Crunch', 'Flake'] },
  { id: 'cupcakes', text: 'cupcakes', short: 'cupcakes', form: 'food', emoji: '🧁', roots: ['Cupcake', 'Frosting'] },
  { id: 'popcorn', text: 'popcorn', short: 'popcorn', form: 'food', emoji: '🍿', roots: ['Pop', 'Kernel'] },
  { id: 'pickles', text: 'pickles', short: 'pickles', form: 'food', emoji: '🥒', roots: ['Pickle', 'Brine'] },
  { id: 'ice-cream', text: 'ice cream', short: 'ice cream', form: 'food', emoji: '🍦', roots: ['Scoop', 'Swirl'] },
  { id: 'gummy-bears', text: 'gummy bears', short: 'gummy bears', form: 'food', emoji: '🐻', roots: ['Gummy', 'Chewy'] },
  { id: 'waffles', text: 'waffles', short: 'waffles', form: 'food', emoji: '🧇', roots: ['Waffle', 'Syrup'] },
  { id: 'sushi-burritos', text: 'sushi burritos', short: 'sushi burritos', form: 'food', emoji: '🌯', roots: ['Roll', 'Wasabi'] },
  { id: 'lemonade', text: 'lemonade', short: 'lemonade', form: 'food', emoji: '🍋', roots: ['Lemon', 'Squeeze'] },
  { id: 'baked-beans', text: 'baked beans', short: 'baked beans', form: 'food', emoji: '🫘', tone: 'crude', roots: ['Bean', 'Toot'] },
  // Gadgets
  { id: 'alarm-clocks', text: 'alarm clocks', short: 'alarm clocks', form: 'gadget', emoji: '⏰', roots: ['Wake', 'Ring'] },
  { id: 'toasters', text: 'toasters', short: 'toasters', form: 'gadget', emoji: '🍞', roots: ['Toast', 'Crisp'] },
  { id: 'headphones', text: 'headphones', short: 'headphones', form: 'gadget', emoji: '🎧', roots: ['Ear', 'Sound'] },
  { id: 'robot-vacuums', text: 'robot vacuums', short: 'robot vacuums', form: 'gadget', emoji: '🧹', roots: ['Vac', 'Sweep'] },
  { id: 'karaoke-machines', text: 'karaoke machines', short: 'karaoke machines', form: 'gadget', emoji: '🎤', roots: ['Mic', 'Encore'] },
  { id: 'smart-mirrors', text: 'smart mirrors', short: 'smart mirrors', form: 'gadget', emoji: '🪞', roots: ['Mirror', 'Reflect'] },
  { id: 'drones', text: 'delivery drones', short: 'drones', form: 'gadget', emoji: '🚁', roots: ['Drone', 'Zip'] },
  { id: 'selfie-sticks', text: 'selfie sticks', short: 'selfie sticks', form: 'gadget', emoji: '📸', roots: ['Snap', 'Pose'] },
  { id: 'massage-chairs', text: 'massage chairs', short: 'massage chairs', form: 'gadget', emoji: '💺', roots: ['Relax', 'Knead'] },
  { id: 'hoverboards', text: 'hoverboards', short: 'hoverboards', form: 'gadget', emoji: '🛸', roots: ['Hover', 'Glide'] },
  { id: 'phone-cases', text: 'phone cases', short: 'phone cases', form: 'gadget', emoji: '📱', roots: ['Case', 'Shell'] },
  { id: 'burp-translators', text: 'burp translators', short: 'burp translators', form: 'gadget', emoji: '🔊', tone: 'crude', roots: ['Burp', 'Belch'] },
  // Goods
  { id: 'socks', text: 'socks', short: 'socks', form: 'goods', emoji: '🧦', roots: ['Sock', 'Toe'] },
  { id: 'backpacks', text: 'backpacks', short: 'backpacks', form: 'goods', emoji: '🎒', roots: ['Pack', 'Trek'] },
  { id: 'sunglasses', text: 'sunglasses', short: 'sunglasses', form: 'goods', emoji: '🕶️', roots: ['Shade', 'Squint'] },
  { id: 'pillows', text: 'pillows', short: 'pillows', form: 'goods', emoji: '🛏️', roots: ['Fluff', 'Pillow'] },
  { id: 'board-games', text: 'board games', short: 'board games', form: 'goods', emoji: '🎲', roots: ['Dice', 'Meeple'] },
  { id: 'water-bottles', text: 'water bottles', short: 'water bottles', form: 'goods', emoji: '🥤', roots: ['Sip', 'Hydro'] },
  { id: 'slippers', text: 'slippers', short: 'slippers', form: 'goods', emoji: '🥿', roots: ['Slip', 'Shuffle'] },
  { id: 'umbrellas', text: 'umbrellas', short: 'umbrellas', form: 'goods', emoji: '☂️', roots: ['Drizzle', 'Brella'] },
  { id: 'rubber-ducks', text: 'rubber ducks', short: 'rubber ducks', form: 'goods', emoji: '🦆', roots: ['Quack', 'Duck'] },
  { id: 'bean-bags', text: 'bean bag chairs', short: 'bean bags', form: 'goods', emoji: '🛋️', roots: ['Flop', 'Lounge'] },
  { id: 'candles', text: 'scented candles', short: 'candles', form: 'goods', emoji: '🕯️', roots: ['Wick', 'Glow'] },
  { id: 'sleeping-bags', text: 'sleeping bags', short: 'sleeping bags', form: 'goods', emoji: '🛌', roots: ['Snooze', 'Camp'] },
  { id: 'lunch-boxes', text: 'lunch boxes', short: 'lunch boxes', form: 'goods', emoji: '🍱', roots: ['Lunch', 'Tote'] },
  { id: 'rubber-chickens', text: 'rubber chickens', short: 'rubber chickens', form: 'goods', emoji: '🐔', tone: 'silly', roots: ['Cluck', 'Squawk'] },
  { id: 'whoopee-cushions', text: 'whoopee cushions', short: 'whoopee cushions', form: 'goods', emoji: '💨', tone: 'crude', roots: ['Toot', 'Squeak'] },
  // Pets
  { id: 'dog-sweaters', text: 'dog sweaters', short: 'dog sweaters', form: 'pet', emoji: '🐕', roots: ['Pup', 'Knit'] },
  { id: 'cat-towers', text: 'cat towers', short: 'cat towers', form: 'pet', emoji: '🐈', roots: ['Whisker', 'Perch'] },
  { id: 'fish-tanks', text: 'fish tanks', short: 'fish tanks', form: 'pet', emoji: '🐠', roots: ['Fin', 'Tank'] },
  { id: 'bird-feeders', text: 'bird feeders', short: 'bird feeders', form: 'pet', emoji: '🐦', roots: ['Tweet', 'Seed'] },
  { id: 'dog-treats', text: 'dog treats', short: 'dog treats', form: 'pet', emoji: '🦴', roots: ['Biscuit', 'Wag'] },
  { id: 'hamster-mazes', text: 'hamster mazes', short: 'hamster mazes', form: 'pet', emoji: '🐹', roots: ['Hammy', 'Maze'] },
  { id: 'pet-strollers', text: 'pet strollers', short: 'pet strollers', form: 'pet', emoji: '🐾', roots: ['Stroll', 'Paws'] },
  { id: 'litter-boxes', text: 'self-cleaning litter boxes', short: 'litter boxes', form: 'pet', emoji: '🐈‍⬛', tone: 'crude', roots: ['Scoop', 'Litter'] },
  // Services
  { id: 'dance-lessons', text: 'dance lessons', short: 'lessons', form: 'service', emoji: '💃', roots: ['Step', 'Twirl'] },
  { id: 'car-washes', text: 'car washes', short: 'car washes', form: 'service', emoji: '🚗', roots: ['Suds', 'Shine'] },
  { id: 'dog-walks', text: 'dog walks', short: 'walks', form: 'service', emoji: '🦮', roots: ['Leash', 'Walk'] },
  { id: 'haircuts', text: 'haircuts', short: 'haircuts', form: 'service', emoji: '💇', roots: ['Snip', 'Trim'] },
  { id: 'homework-help', text: 'homework help', short: 'sessions', form: 'service', emoji: '✏️', roots: ['Study', 'Brain'] },
  { id: 'cooking-classes', text: 'cooking classes', short: 'classes', form: 'service', emoji: '👩‍🍳', roots: ['Chef', 'Whisk'] },
  { id: 'closet-makeovers', text: 'closet makeovers', short: 'makeovers', form: 'service', emoji: '👗', roots: ['Tidy', 'Sort'] },
  { id: 'singing-telegrams', text: 'singing telegrams', short: 'telegrams', form: 'service', emoji: '🎶', roots: ['Serenade', 'Tune'] },
  { id: 'nap-coaching', text: 'nap coaching', short: 'sessions', form: 'service', emoji: '😴', tone: 'silly', roots: ['Nap', 'Doze'] },
  { id: 'foot-sniffing', text: 'foot odor inspections', short: 'inspections', form: 'service', emoji: '👃', tone: 'crude', roots: ['Sniff', 'Whiff'] },
  // Rentals
  { id: 'bounce-houses', text: 'bounce house rentals', short: 'bounce houses', form: 'rental', emoji: '🏰', roots: ['Bounce', 'Boing'] },
  { id: 'tuxedo-rentals', text: 'tuxedo rentals', short: 'tuxedos', form: 'rental', emoji: '🤵', roots: ['Tux', 'Dapper'] },
  { id: 'kayak-rentals', text: 'kayak rentals', short: 'kayaks', form: 'rental', emoji: '🛶', roots: ['Paddle', 'Kayak'] },
  { id: 'costume-rentals', text: 'costume rentals', short: 'costumes', form: 'rental', emoji: '🥸', roots: ['Costume', 'Disguise'] },
  { id: 'hot-tub-rentals', text: 'hot tub rentals', short: 'hot tubs', form: 'rental', emoji: '🛁', roots: ['Bubble', 'Soak'] },
  { id: 'scooter-rentals', text: 'scooter rentals', short: 'scooters', form: 'rental', emoji: '🛴', roots: ['Zoom', 'Scoot'] },
  { id: 'ball-pit-rentals', text: 'ball pit rentals', short: 'ball pits', form: 'rental', emoji: '🟠', roots: ['Ball', 'Plunge'] },
  { id: 'porta-potty-rentals', text: 'fancy porta-potty rentals', short: 'porta-potties', form: 'rental', emoji: '🚽', tone: 'crude', roots: ['Throne', 'Flush'] },
  // Digital
  { id: 'homework-apps', text: 'homework apps', short: 'app', form: 'digital', emoji: '📝', roots: ['Study', 'Quiz'] },
  { id: 'wake-up-apps', text: 'wake-up apps', short: 'app', form: 'digital', emoji: '🌅', roots: ['Rise', 'Snooze'] },
  { id: 'fitness-apps', text: 'fitness apps', short: 'app', form: 'digital', emoji: '💪', roots: ['Fit', 'Rep'] },
  { id: 'recipe-apps', text: 'recipe apps', short: 'app', form: 'digital', emoji: '📖', roots: ['Recipe', 'Yum'] },
  { id: 'video-games', text: 'video games', short: 'game', form: 'digital', emoji: '👾', roots: ['Pixel', 'Quest'] },
  { id: 'podcasts', text: 'podcasts', short: 'podcast', form: 'digital', emoji: '🎙️', roots: ['Pod', 'Mic'] },
  { id: 'language-apps', text: 'language apps', short: 'app', form: 'digital', emoji: '🗣️', roots: ['Lingo', 'Talk'] },
  { id: 'pet-horoscopes', text: 'pet horoscope apps', short: 'app', form: 'digital', emoji: '🔮', tone: 'silly', roots: ['Zodiac', 'Paw'] },
  { id: 'fart-apps', text: 'fart sound apps', short: 'app', form: 'digital', emoji: '📲', tone: 'crude', roots: ['Toot', 'Pfft'] },
  // Events
  { id: 'birthday-parties', text: 'birthday parties', short: 'parties', form: 'event', emoji: '🎂', roots: ['Party', 'Candle'] },
  { id: 'escape-rooms', text: 'escape rooms', short: 'escape rooms', form: 'event', emoji: '🔐', roots: ['Escape', 'Key'] },
  { id: 'talent-shows', text: 'talent shows', short: 'shows', form: 'event', emoji: '🌟', roots: ['Star', 'Stage'] },
  { id: 'mini-golf', text: 'mini golf courses', short: 'mini golf', form: 'event', emoji: '⛳', roots: ['Putt', 'Hole'] },
  { id: 'movie-nights', text: 'outdoor movie nights', short: 'movie nights', form: 'event', emoji: '🎬', roots: ['Reel', 'Screen'] },
  { id: 'trivia-nights', text: 'trivia nights', short: 'trivia nights', form: 'event', emoji: '🧠', roots: ['Brain', 'Quiz'] },
  { id: 'obstacle-courses', text: 'obstacle courses', short: 'courses', form: 'event', emoji: '🧗', roots: ['Hurdle', 'Dash'] },
  { id: 'pillow-fights', text: 'pillow fight tournaments', short: 'tournaments', form: 'event', emoji: '🪶', tone: 'silly', roots: ['Fluff', 'Whomp'] },
  { id: 'ghost-tours', text: 'ghost tours', short: 'tours', form: 'event', emoji: '👻', tone: 'silly', roots: ['Boo', 'Spook'] },
  { id: 'burping-contests', text: 'burping contests', short: 'contests', form: 'event', emoji: '😮‍💨', tone: 'crude', roots: ['Belch', 'Burp'] }
];

export const MODIFIERS: readonly ModifierWord[] = [
  { id: 'luxury', text: 'luxury', emoji: '💎', forms: ALL, root: 'Lux' },
  { id: 'award-winning', text: 'award-winning', emoji: '🏆', forms: ALL, root: 'Trophy' },
  { id: 'medieval', text: 'medieval', emoji: '🏰', forms: ALL, root: 'Castle' },
  { id: 'futuristic', text: 'futuristic', emoji: '🚀', forms: ALL, root: 'Future' },
  { id: 'royal', text: 'royal', emoji: '🤴', forms: ALL, root: 'Royal' },
  { id: 'pirate-themed', text: 'pirate-themed', emoji: '🦜', forms: ALL, root: 'Pirate' },
  { id: 'dinosaur-themed', text: 'dinosaur-themed', emoji: '🦖', forms: ALL, root: 'Dino' },
  { id: 'ninja', text: 'ninja', emoji: '🥷', forms: ALL, root: 'Ninja' },
  { id: 'superhero', text: 'superhero', emoji: '🦸', forms: ALL, root: 'Hero' },
  { id: 'grandma-approved', text: 'grandma-approved', emoji: '🫶', forms: ALL, root: 'Granny' },
  { id: 'twenty-four-hour', text: '24-hour', emoji: '🕛', forms: ['service', 'digital', 'rental', 'event', 'food'], root: 'AllDay' },
  { id: 'extremely-polite', text: 'extremely polite', emoji: '🙇', forms: ['gadget', 'digital', 'service', 'pet'], root: 'Polite' },
  { id: 'mind-reading', text: 'mind-reading', emoji: '🔮', forms: ['gadget', 'digital', 'goods', 'pet', 'service'], root: 'Psychic' },
  { id: 'self-aware', text: 'self-aware', emoji: '🧠', forms: ['gadget', 'digital', 'goods', 'pet'], root: 'Brainy' },
  { id: 'singing', text: 'singing', emoji: '🎵', forms: STUFF, root: 'Tune' },
  { id: 'talking', text: 'talking', emoji: '💬', forms: ['gadget', 'goods', 'pet'], root: 'Chatty' },
  { id: 'dancing', text: 'dancing', emoji: '🕺', forms: ['gadget', 'goods', 'event', 'service'], root: 'Groove' },
  { id: 'glow-in-the-dark', text: 'glow-in-the-dark', emoji: '✨', forms: ['food', 'gadget', 'goods', 'pet', 'event'], root: 'Glow' },
  { id: 'giant', text: 'giant', emoji: '🏔️', forms: ['food', 'gadget', 'goods', 'pet', 'rental', 'event'], root: 'Mega' },
  { id: 'tiny', text: 'tiny', emoji: '🐜', forms: ['food', 'gadget', 'goods', 'pet', 'rental', 'event'], root: 'Mini' },
  { id: 'invisible', text: 'invisible', emoji: '🫥', forms: ['goods', 'gadget', 'pet'], root: 'Vanish' },
  { id: 'solar-powered', text: 'solar-powered', emoji: '☀️', forms: ['gadget', 'goods', 'pet', 'rental'], root: 'Sunny' },
  { id: 'rocket-powered', text: 'rocket-powered', emoji: '☄️', forms: ['gadget', 'goods', 'pet', 'rental'], root: 'Turbo' },
  { id: 'self-driving', text: 'self-driving', emoji: '🚙', forms: ['gadget', 'goods', 'pet', 'rental'], root: 'Auto' },
  { id: 'robot-powered', text: 'robot-powered', emoji: '⚙️', forms: ['gadget', 'goods', 'pet', 'service', 'rental', 'event'], root: 'Robo' },
  { id: 'inflatable', text: 'inflatable', emoji: '🎈', forms: ['gadget', 'goods', 'pet', 'rental', 'event'], root: 'Bouncy' },
  { id: 'edible', text: 'edible', emoji: '🍴', forms: ['goods', 'gadget', 'pet'], root: 'Snack' },
  { id: 'gold-plated', text: 'gold-plated', emoji: '🥇', forms: STUFF, root: 'Golden' },
  { id: 'underwater', text: 'underwater', emoji: '🤿', forms: ['event', 'service', 'gadget', 'goods', 'rental'], root: 'Deep' },
  { id: 'zero-gravity', text: 'zero-gravity', emoji: '🪐', forms: ['event', 'service', 'goods', 'food'], root: 'Orbit' },
  { id: 'extra-loud', text: 'extra-loud', emoji: '📢', forms: ['gadget', 'goods', 'event', 'service'], root: 'Boom' },
  { id: 'motivational', text: 'motivational', emoji: '📣', forms: ['gadget', 'digital', 'goods', 'service'], root: 'Hype' },
  { id: 'sleepy', text: 'sleepy', emoji: '🥱', forms: ['gadget', 'goods', 'pet', 'service'], root: 'Snooze' },
  { id: 'waterproof', text: 'waterproof', emoji: '💧', forms: ['gadget', 'goods', 'pet'], root: 'Splash' },
  { id: 'vintage', text: 'vintage', emoji: '📻', forms: ['gadget', 'goods', 'rental', 'event'], root: 'Retro' },
  { id: 'glitter-covered', text: 'glitter-covered', emoji: '🪩', forms: ['food', 'goods', 'pet', 'event'], root: 'Sparkle' },
  { id: 'frozen', text: 'frozen', emoji: '🧊', forms: ['food', 'goods', 'event'], root: 'Frost' },
  { id: 'backwards', text: 'backwards', emoji: '🔄', forms: ['service', 'event', 'gadget', 'digital'], root: 'Flip' },
  // Silly: harmless weirdness.
  { id: 'haunted', text: 'haunted', emoji: '👻', forms: ['food', 'gadget', 'goods', 'rental', 'event'], tone: 'silly', root: 'Spooky' },
  { id: 'overly-dramatic', text: 'overly dramatic', emoji: '😱', forms: ALL, tone: 'silly', root: 'Drama' },
  { id: 'suspiciously-cheap', text: 'suspiciously cheap', emoji: '🏷️', forms: ALL, tone: 'silly', root: 'Deal' },
  { id: 'emotional-support', text: 'emotional-support', emoji: '🧸', forms: ['goods', 'pet', 'gadget', 'service'], tone: 'silly', root: 'Comfy' },
  { id: 'slightly-cursed', text: 'slightly cursed', emoji: '🧿', forms: ['food', 'gadget', 'goods', 'rental', 'event'], tone: 'silly', root: 'Hex' },
  { id: 'llama-powered', text: 'llama-powered', emoji: '🦙', forms: ['gadget', 'goods', 'service', 'rental', 'event'], tone: 'silly', root: 'Llama' },
  // Crude: mild bathroom and gross-out humor.
  { id: 'stinky', text: 'stinky', emoji: '🦨', forms: [...OBJECTS, 'food', 'event'], tone: 'crude', root: 'Whiff' },
  { id: 'burp-powered', text: 'burp-powered', emoji: '🫧', forms: ['gadget', 'goods'], tone: 'crude', root: 'Burp' },
  { id: 'sweaty', text: 'sweaty', emoji: '💦', forms: ['goods', 'event', 'service', 'rental'], tone: 'crude', root: 'Swampy' },
  { id: 'fart-scented', text: 'fart-scented', emoji: '🌬️', forms: ['goods', 'pet', 'gadget'], tone: 'crude', root: 'Toot' },
  { id: 'extra-slimy', text: 'extra-slimy', emoji: '🟢', forms: ['goods', 'food', 'pet'], tone: 'crude', root: 'Slime' },
  { id: 'sock-scented', text: 'sock-scented', emoji: '🧦', forms: ['goods', 'gadget', 'food'], tone: 'crude', root: 'Sock' }
];

export const AUDIENCES: readonly AudienceWord[] = [
  { id: 'pirates', text: 'pirates', emoji: '🏴‍☠️' },
  { id: 'astronauts', text: 'astronauts', emoji: '👩‍🚀' },
  { id: 'grandmas', text: 'grandmas', emoji: '👵' },
  { id: 'busy-parents', text: 'busy parents', emoji: '👨‍👩‍👧' },
  { id: 'sleepy-students', text: 'sleepy students', emoji: '🎓' },
  { id: 'marathon-runners', text: 'marathon runners', emoji: '🏃' },
  { id: 'retired-magicians', text: 'retired magicians', emoji: '🎩' },
  { id: 'competitive-toddlers', text: 'competitive toddlers', emoji: '👶' },
  { id: 'substitute-teachers', text: 'substitute teachers', emoji: '🍎' },
  { id: 'lifeguards', text: 'lifeguards', emoji: '🛟' },
  { id: 'chess-champions', text: 'chess champions', emoji: '♟️' },
  { id: 'birdwatchers', text: 'birdwatchers', emoji: '🔭' },
  { id: 'night-shift-nurses', text: 'night-shift nurses', emoji: '🩺' },
  { id: 'lighthouse-keepers', text: 'lighthouse keepers', emoji: '🗼' },
  { id: 'band-kids', text: 'band kids', emoji: '🎺' },
  { id: 'theater-kids', text: 'theater kids', emoji: '🎭' },
  { id: 'skateboarders', text: 'skateboarders', emoji: '🛹' },
  { id: 'mail-carriers', text: 'mail carriers', emoji: '📬' },
  { id: 'zookeepers', text: 'zookeepers', emoji: '🦓' },
  { id: 'time-travelers', text: 'time travelers', emoji: '⏳' },
  { id: 'secret-agents', text: 'secret agents', emoji: '🕵️' },
  { id: 'cowboys', text: 'cowboys', emoji: '🤠' },
  { id: 'detectives', text: 'detectives', emoji: '🔍' },
  { id: 'wizards', text: 'wizards', emoji: '🧙' },
  { id: 'knights', text: 'knights', emoji: '🛡️' },
  { id: 'beekeepers', text: 'beekeepers', emoji: '🐝' },
  { id: 'librarians', text: 'librarians', emoji: '📚' },
  { id: 'friendly-aliens', text: 'friendly aliens', emoji: '👽' },
  { id: 'robots', text: 'robots', emoji: '🤖' },
  { id: 'snowboarders', text: 'snowboarders', emoji: '🏂' },
  { id: 'first-time-campers', text: 'first-time campers', emoji: '⛺' },
  { id: 'soccer-teams', text: 'soccer teams', emoji: '⚽' },
  { id: 'dog-owners', text: 'dog owners', emoji: '🐶' },
  { id: 'cats', text: 'cats', emoji: '🐱' },
  { id: 'farmers', text: 'farmers', emoji: '🚜' },
  { id: 'gamers', text: 'gamers', emoji: '🎮' },
  { id: 'firefighters', text: 'firefighters', emoji: '🚒' },
  { id: 'ballerinas', text: 'ballerinas', emoji: '🩰' },
  { id: 'cheerleaders', text: 'cheerleaders', emoji: '📯' },
  { id: 'surfers', text: 'surfers', emoji: '🏄' },
  // Silly
  { id: 'influencers', text: 'influencers', emoji: '🤳', tone: 'silly' },
  { id: 'gym-bros', text: 'gym bros', emoji: '🏋️', tone: 'silly' },
  { id: 'dramatic-llamas', text: 'dramatic llamas', emoji: '🦙', tone: 'silly' },
  { id: 'day-vampires', text: 'vampires who work days', emoji: '🧛', tone: 'silly' },
  { id: 'polite-zombies', text: 'polite zombies', emoji: '🧟', tone: 'silly' },
  { id: 'morning-haters', text: 'people who hate mornings', emoji: '☕', tone: 'silly' },
  { id: 'dreamer-raccoons', text: 'raccoons with big dreams', emoji: '🦝', tone: 'silly' },
  // Crude
  { id: 'stinky-feet', text: 'people with stinky feet', emoji: '🦶', tone: 'crude' },
  { id: 'gassy-grandpas', text: 'gassy grandpas', emoji: '👴', tone: 'crude' },
  { id: 'sweaty-hikers', text: 'extremely sweaty hikers', emoji: '🥾', tone: 'crude' },
  { id: 'champion-burpers', text: 'champion burpers', emoji: '🗯️', tone: 'crude' }
];
