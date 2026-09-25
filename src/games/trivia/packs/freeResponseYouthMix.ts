import { buildPack, category, question } from './buildPack';

const categories = [
  category('Video Games', {
    100: question('What is the virtual currency in Roblox called?', ['Robux']),
    200: question('In Among Us, what hidden role tries to eliminate the crewmates?', ['Impostor', 'The Impostor']),
    300: question('What item is normally thrown to catch a Pokémon?', ['Poké Ball', 'Poke Ball', 'Pokéball', 'Pokeball']),
    400: question('What fictional city is the main setting of Grand Theft Auto V?', ['Los Santos']),
    500: question('What title is given to the player character in Elden Ring?', ['Tarnished', 'The Tarnished']),
    1000: question('What is the name of Kratos’s son in the modern God of War games?', ['Atreus'])
  }),
  category('Movies', {
    100: question('What is Black Panther’s real name?', ['T’Challa', "T'Challa", 'TChalla']),
    200: question('Who plays J. Robert Oppenheimer in the 2023 film Oppenheimer?', ['Cillian Murphy', 'Murphy']),
    300: question('What high school does Cady attend in Mean Girls?', ['North Shore High School', 'North Shore High']),
    400: question('What is the name of the fashion magazine in The Devil Wears Prada?', ['Runway']),
    500: question('What is the name of Daniel Kaluuya’s character in Get Out?', ['Chris Washington', 'Chris']),
    1000: question('What is the name of the hotel in The Shining?', ['Overlook Hotel', 'The Overlook Hotel', 'Overlook'])
  }),
  category('Music', {
    100: question('Who recorded the song “Levitating”?', ['Dua Lipa', 'Lipa']),
    200: question('Who recorded the hit song “Flowers”?', ['Miley Cyrus', 'Miley']),
    300: question('Who recorded “Paint the Town Red”?', ['Doja Cat', 'Doja']),
    400: question('Who recorded the song “Starboy”?', ['The Weeknd', 'Weeknd']),
    500: question('What duo name do Bruno Mars and Anderson .Paak use together?', ['Silk Sonic']),
    1000: question('Which band recorded the song “Dreams”?', ['Fleetwood Mac'])
  }),
  category('Internet Culture', {
    100: question('What does “IRL” stand for?', ['In Real Life']),
    200: question('What does “AFK” stand for?', ['Away From Keyboard']),
    300: question('What are individual communities on Reddit commonly called?', ['Subreddits', 'Subreddit']),
    400: question('On forums and social media, what does “OP” usually mean when referring to the person who made the post?', ['Original Poster', 'Original Post']),
    500: question('What image format is famous for short looping animations and a long-running pronunciation debate?', ['GIF', 'Graphics Interchange Format']),
    1000: question('What does “NPC” stand for in gaming and internet slang?', ['Non-Player Character', 'Non Player Character'])
  }),
  category('TV & Streaming', {
    100: question('What is the name of the girl with psychic powers in Stranger Things?', ['Eleven', '11']),
    200: question('What is the name of the regional manager played by Steve Carell in The Office?', ['Michael Scott', 'Michael']),
    300: question('What is the name of the stretchy pirate captain in One Piece?', ['Monkey D. Luffy', 'Monkey D Luffy', 'Luffy']),
    400: question('What name does lawyer Jimmy McGill use professionally in Breaking Bad and Better Call Saul?', ['Saul Goodman', 'Saul']),
    500: question('What is the first name of Zendaya’s character Rue in Euphoria?', ['Rue', 'Rue Bennett']),
    1000: question('What corporation manages the superheroes in The Boys?', ['Vought International', 'Vought'])
  }),
  category('Food & Drinks', {
    100: question('What coffee drink combines espresso with a larger amount of steamed milk?', ['Latte', 'Caffè latte', 'Cafe latte']),
    200: question('What dark salty condiment made from fermented soybeans is commonly used for sushi dipping?', ['Soy sauce']),
    300: question('What Korean side dish is commonly made from fermented napa cabbage?', ['Kimchi']),
    400: question('What Italian pastry has a fried tube-shaped shell filled with sweet ricotta?', ['Cannoli', 'Cannolo']),
    500: question('What crumbly white cheese is traditionally used in a Greek salad?', ['Feta', 'Feta cheese']),
    1000: question('What French cooking term means slowly cooking food submerged in fat at a low temperature?', ['Confit'])
  }),
  category('Animals', {
    100: question('What is the largest living land animal?', ['African elephant', 'Elephant']),
    200: question('Which lizard is famous for changing color and moving its eyes independently?', ['Chameleon']),
    300: question('What is the largest living species of cat?', ['Tiger']),
    400: question('Which Australian marsupial has fingerprints remarkably similar in pattern to human fingerprints?', ['Koala']),
    500: question('Which sea mammal is known for using rocks to crack open shellfish?', ['Sea otter', 'Otter']),
    1000: question('What is the largest living species of lizard?', ['Komodo dragon'])
  }),
  category('Tech & Apps', {
    100: question('Which company owns YouTube?', ['Google', 'Alphabet', 'Alphabet Inc.']),
    200: question('Which messaging app uses a white phone handset inside a green speech bubble as its logo?', ['WhatsApp', 'Whatsapp']),
    300: question('What does PDF stand for?', ['Portable Document Format']),
    400: question('What cloud storage service is included with a Google account?', ['Google Drive', 'Drive']),
    500: question('What does OLED stand for?', ['Organic Light-Emitting Diode', 'Organic Light Emitting Diode']),
    1000: question('Which code-hosting platform uses repositories, pull requests, and the Octocat mascot?', ['GitHub', 'Github'])
  }),
  category('Sports', {
    100: question('What does NBA stand for?', ['National Basketball Association']),
    200: question('Which sport uses a shuttlecock?', ['Badminton']),
    300: question('What is a baseball hit called when the batter scores by circling all four bases?', ['Home run', 'Homer']),
    400: question('What skateboarding trick flips the board once along its length while the rider jumps?', ['Kickflip', 'Kick flip']),
    500: question('What is a score of three under par on a single golf hole called?', ['Albatross', 'Double eagle']),
    1000: question('In boxing, what does TKO stand for?', ['Technical Knockout', 'Technical Knock-Out'])
  }),
  category('Everyday Science', {
    100: question('Which vitamin can the human body produce in the skin after sunlight exposure?', ['Vitamin D', 'D']),
    200: question('How many permanent teeth does a typical adult have, including wisdom teeth?', ['32', 'Thirty-two', 'Thirty two']),
    300: question('A substance with a pH below 7 is described by what word?', ['Acidic', 'Acid']),
    400: question('Why does ordinary ice float in liquid water?', ['Ice is less dense than liquid water', 'It is less dense', 'Lower density']),
    500: question('What protein in red blood cells carries most oxygen through the body?', ['Hemoglobin', 'Haemoglobin']),
    1000: question('What type of stored energy is found in a stretched rubber band?', ['Elastic potential energy', 'Elastic energy'])
  })
];

export const freeResponseYouthMixPack = buildPack({
  id: 'free-response-youth-mix',
  title: 'Youth Mix',
  theme: 'Games, movies, music, internet culture, streaming, food, animals, technology, sports, and science',
  description: 'A youth-friendly all-play pack designed for concise typed answers and broad recognition rather than specialist trivia.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  supportedGameModes: ['free-response'],
  accentColor: '#a7f3d0'
}, categories);
