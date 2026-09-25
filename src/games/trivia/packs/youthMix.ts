import { buildPack, category, question } from './buildPack';

const categories = [
  category('Video Games', {
    100: question('In Pac-Man, what item lets Pac-Man temporarily eat the ghosts?', ['Power Pellet', 'Power Pellets']),
    200: question('In Fortnite Battle Royale, what is the dangerous shrinking area called?', ['The Storm', 'Storm']),
    300: question('Which block is used to build the frame of a Nether portal in Minecraft?', ['Obsidian']),
    400: question('Which Mario Kart item targets the racer in first place and is commonly called the Blue Shell?', ['Spiny Shell', 'Blue Shell']),
    500: question('What is the name of Master Chief’s AI companion in the Halo series?', ['Cortana']),
    1000: question('What ruined kingdom is the main setting of Hollow Knight?', ['Hallownest'])
  }),
  category('Movies', {
    100: question('What is the first name of the boy accidentally left home alone in Home Alone?', ['Kevin', 'Kevin McCallister']),
    200: question('What color are Dorothy’s famous slippers in The Wizard of Oz?', ['Ruby', 'Ruby red', 'Red']),
    300: question('What nation is divided into districts in The Hunger Games?', ['Panem']),
    400: question('What giant marshmallow mascot attacks New York near the end of Ghostbusters?', ['Stay Puft Marshmallow Man', 'Stay Puft', 'Mr. Stay Puft']),
    500: question('What is the name of Daniel Craig’s detective in Knives Out?', ['Benoit Blanc', 'Blanc']),
    1000: question('In Spirited Away, what animals are Chihiro’s parents transformed into?', ['Pigs', 'Pig'])
  }),
  category('Music', {
    100: question('Which singer released the hit song “Espresso”?', ['Sabrina Carpenter', 'Carpenter']),
    200: question('Which rapper and singer released “Old Town Road”?', ['Lil Nas X', 'Lil Nas']),
    300: question('Which singer released the album SOUR?', ['Olivia Rodrigo', 'Rodrigo']),
    400: question('Which rapper released “Not Like Us”?', ['Kendrick Lamar', 'Kendrick']),
    500: question('Which band features brothers Liam and Noel Gallagher?', ['Oasis']),
    1000: question('Which singer released the album CTRL?', ['SZA'])
  }),
  category('Internet & Memes', {
    100: question('On social media, what does “DM” stand for?', ['Direct Message', 'Direct Messages']),
    200: question('On TikTok, what does “FYP” stand for?', ['For You Page', 'For You']),
    300: question('In online captions, what does “POV” stand for?', ['Point of View']),
    400: question('What term describes content deliberately made to provoke anger and drive engagement?', ['Rage bait', 'Ragebait']),
    500: question('What internet abbreviation means “too long; didn’t read”?', ['TLDR', 'TL;DR', 'Too long; didn’t read', 'Too long didnt read']),
    1000: question('What HTTP error number commonly means that a web page was not found?', ['404', '404 Not Found'])
  }),
  category('TV & Streaming', {
    100: question('What is Wednesday’s last name in Wednesday?', ['Addams']),
    200: question('What nickname does the main teen friend group use in Outer Banks?', ['Pogues', 'The Pogues']),
    300: question('In which U.S. city is The Bear primarily set?', ['Chicago']),
    400: question('What martial art is at the center of Cobra Kai?', ['Karate']),
    500: question('Which numbered Vault is Lucy from in the Fallout TV series?', ['Vault 33', '33']),
    1000: question('What are the names of the two sisters at the center of Arcane?', ['Vi and Jinx', 'Jinx and Vi', 'Vi & Jinx', 'Jinx & Vi'])
  }),
  category('Food & Snacks', {
    100: question('What are traditional boba pearls mainly made from?', ['Tapioca', 'Tapioca starch']),
    200: question('What kind of food is panko?', ['Breadcrumbs', 'Bread crumbs', 'Japanese breadcrumbs']),
    300: question('Which herb gives traditional pesto its signature green flavor?', ['Basil']),
    400: question('What seaweed sheet is commonly used to wrap sushi rolls?', ['Nori']),
    500: question('What Japanese noodle dish is served in broth and often topped with sliced pork and egg?', ['Ramen']),
    1000: question('What French cooking term means cutting food into thin matchstick-shaped strips?', ['Julienne', 'Julienning'])
  }),
  category('Animals', {
    100: question('What is a baby kangaroo commonly called?', ['Joey', 'A joey']),
    200: question('What type of animal is an axolotl?', ['Amphibian', 'Salamander']),
    300: question('Shark skeletons are made mostly from what flexible material instead of bone?', ['Cartilage']),
    400: question('Which egg-laying Australian mammal has a duck-like bill?', ['Platypus', 'Duck-billed platypus']),
    500: question('In seahorses, which sex carries the developing young in a pouch?', ['Male', 'Males', 'Male seahorse']),
    1000: question('What is the only marsupial species native to the United States and Canada?', ['Virginia opossum', 'Opossum'])
  }),
  category('Technology', {
    100: question('What mobile operating system powers most Samsung Galaxy phones?', ['Android']),
    200: question('What does USB stand for?', ['Universal Serial Bus']),
    300: question('What does RAM stand for in a computer?', ['Random Access Memory']),
    400: question('What image file format uses the extension .png?', ['PNG', 'Portable Network Graphics']),
    500: question('Which programming language is commonly used in web browsers to make pages interactive?', ['JavaScript', 'Javascript', 'JS']),
    1000: question('What does API stand for in software development?', ['Application Programming Interface'])
  }),
  category('Sports', {
    100: question('Which Grand Slam tennis tournament is played on clay courts in Paris?', ['French Open', 'Roland-Garros', 'Roland Garros']),
    200: question('What object is hit with sticks in ice hockey?', ['Puck', 'A puck']),
    300: question('How many points is a made basketball shot worth from beyond the three-point line?', ['3', 'Three', 'Three points']),
    400: question('What combat sport is used in the UFC’s octagon?', ['Mixed martial arts', 'MMA']),
    500: question('What is three strikes in a row called in bowling?', ['Turkey', 'A turkey']),
    1000: question('In Formula 1, what does DRS stand for?', ['Drag Reduction System'])
  }),
  category('Brands & Logos', {
    100: question('What is the name commonly given to Nike’s check-shaped logo?', ['Swoosh', 'The Swoosh']),
    200: question('Which fast-food chain is represented by the Golden Arches?', ['McDonald’s', 'McDonalds']),
    300: question('Which retail chain uses a red bullseye as its logo?', ['Target']),
    400: question('Which technology company uses a bitten apple as its logo?', ['Apple']),
    500: question('Which clothing brand uses a crocodile as its logo?', ['Lacoste']),
    1000: question('Which fashion brand uses a polo player on horseback as its signature logo?', ['Ralph Lauren', 'Polo Ralph Lauren'])
  }),
  category('Everyday Science', {
    100: question('At what temperature does pure water freeze on the Celsius scale?', ['0°C', '0 C', '0 degrees Celsius', 'Zero degrees Celsius', '0']),
    200: question('Which gas do plants take in from the air for photosynthesis?', ['Carbon dioxide', 'CO2']),
    300: question('What kind of environment cannot carry ordinary sound waves because there is no matter to vibrate?', ['Vacuum', 'A vacuum']),
    400: question('Why does a metal spoon often feel colder than a wooden spoon at the same room temperature?', ['It conducts heat away faster', 'Higher thermal conductivity', 'Metal conducts heat faster']),
    500: question('Which subatomic particle has a positive electric charge?', ['Proton', 'Protons']),
    1000: question('What scattering effect helps make sunsets appear red and orange?', ['Rayleigh scattering'])
  }),
  category('Famous Characters', {
    100: question('What city does Batman protect?', ['Gotham', 'Gotham City']),
    200: question('What is Spider-Man’s civilian name?', ['Peter Parker']),
    300: question('What kind of animal is Sonic?', ['Hedgehog', 'A hedgehog']),
    400: question('What was Darth Vader’s name before he became a Sith Lord?', ['Anakin Skywalker', 'Anakin']),
    500: question('What is the name of Shrek’s wife?', ['Fiona', 'Princess Fiona']),
    1000: question('Which Fire Nation prince spends much of Avatar: The Last Airbender hunting Aang?', ['Zuko', 'Prince Zuko'])
  })
];

export const youthMixPack = buildPack({
  id: 'youth-mix',
  title: 'Youth Mix',
  theme: 'Games, movies, music, internet culture, food, tech, sports, science, animals, and famous characters',
  description: 'A broad, youth-friendly Classic pack built around recognizable modern culture and approachable general knowledge.',
  difficulty: 'mixed',
  approximateMinutes: 40,
  accentColor: '#7dd3fc'
}, categories);
