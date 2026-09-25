import { buildPack, category, question } from './buildPack';

const categories = [
  category('Everyday Science', {
    100: question('What metal is the main material attracted by an ordinary household magnet?', ['Iron', 'Iron metal']),
    200: question('What is the name of the process by which liquid water changes into water vapor?', ['Evaporation', 'Evaporating']),
    300: question('Which part of a plant cell contains chlorophyll?', ['Chloroplast', 'Chloroplasts']),
    400: question('What scale ranks minerals from 1 to 10 by scratch hardness?', ['Mohs scale', 'Mohs hardness scale', 'Mohs']),
    500: question('What SI unit measures electrical resistance?', ['Ohm', 'Ohms']),
    1000: question('In which atmospheric layer is most of Earth’s ozone layer found?', ['Stratosphere', 'The stratosphere'])
  }),
  category('Food & Kitchen', {
    100: question('What legume is the main ingredient in traditional hummus?', ['Chickpea', 'Chickpeas', 'Garbanzo bean', 'Garbanzo beans']),
    200: question('Which cheese is traditionally paired with tomato and basil in a Caprese salad?', ['Mozzarella', 'Fresh mozzarella']),
    300: question('What dried fruit is made from a plum?', ['Prune', 'Prunes']),
    400: question('A classic roux is made by cooking flour with what other basic ingredient?', ['Fat', 'Butter', 'Oil']),
    500: question('What fermented soybean paste is a staple seasoning in Japanese cooking?', ['Miso', 'Miso paste']),
    1000: question('What Italian dessert layers coffee-soaked ladyfingers with a mascarpone mixture?', ['Tiramisu', 'Tiramisù'])
  }),
  category('Words & Language', {
    100: question('What is the opposite of a synonym?', ['Antonym', 'An antonym']),
    200: question('What do you call a word or phrase that reads the same forward and backward?', ['Palindrome', 'A palindrome']),
    300: question('What is the term for an extreme fear of enclosed or confined spaces?', ['Claustrophobia']),
    400: question('What do you call a sentence that uses every letter of the alphabet at least once?', ['Pangram', 'A pangram']),
    500: question('What branch of language study traces the origin and historical development of words?', ['Etymology']),
    1000: question('What term describes two words that are spelled the same but have different meanings and pronunciations, such as “lead” the metal and “lead” meaning to guide?', ['Heteronym', 'A heteronym'])
  }),
  category('Tech & Inventions', {
    100: question('What does the “QR” in QR code stand for?', ['Quick Response']),
    200: question('What two digits are used in the binary number system?', ['0 and 1', 'Zero and one', '1 and 0', 'One and zero']),
    300: question('Who invented the World Wide Web while working at CERN?', ['Tim Berners-Lee', 'Tim Berners Lee', 'Berners-Lee']),
    400: question('What does GPS stand for?', ['Global Positioning System']),
    500: question('What unit is commonly used to measure a processor’s clock frequency in billions of cycles per second?', ['Gigahertz', 'GHz']),
    1000: question('What does the “S” stand for in the secure web protocol HTTPS?', ['Secure', 'Security'])
  }),
  category('Sports & Games', {
    100: question('In ice hockey, what is the area called where a player serves a penalty?', ['Penalty box', 'The penalty box']),
    200: question('How many points is a successful free throw worth in basketball?', ['1', 'One', 'One point']),
    300: question('In indoor volleyball, how many team contacts are normally allowed before the ball must cross the net?', ['3', 'Three', 'Three contacts']),
    400: question('Which chess piece is the only one that can jump over other pieces?', ['Knight', 'The knight']),
    500: question('How many balls outside the strike zone give a batter a walk in baseball?', ['4', 'Four']),
    1000: question('What is the maximum possible break in standard snooker without a foul?', ['147', 'One hundred forty-seven', 'One hundred and forty-seven'])
  }),
  category('Nature & Animals', {
    100: question('What is a young frog called after it hatches from an egg?', ['Tadpole', 'A tadpole']),
    200: question('What type of tree produces acorns?', ['Oak', 'Oak tree', 'Oaks']),
    300: question('What is the common name for a group of crows?', ['Murder', 'A murder', 'Murder of crows']),
    400: question('What is the largest living species of reptile?', ['Saltwater crocodile', 'Saltwater croc']),
    500: question('Which sea animal has three hearts and blue blood?', ['Octopus', 'An octopus', 'Octopuses']),
    1000: question('What is the largest species of penguin?', ['Emperor penguin', 'Emperor'])
  }),
  category('Numbers & Logic', {
    100: question('How many degrees are in a right angle?', ['90', 'Ninety', '90 degrees', 'Ninety degrees']),
    200: question('What number does the Roman numeral L represent?', ['50', 'Fifty']),
    300: question('How many items are in a gross?', ['144', 'One hundred forty-four', 'One hundred and forty-four']),
    400: question('What is the smallest prime number greater than 100?', ['101', 'One hundred one', 'One hundred and one']),
    500: question('What is the sum of the interior angles of a hexagon?', ['720 degrees', '720', 'Seven hundred twenty degrees']),
    1000: question('What is the sum of the interior angles of a decagon?', ['1440 degrees', '1440', 'One thousand four hundred forty degrees'])
  }),
  category('Mixed Bag', {
    100: question('What color do blue and yellow make when mixed as paint?', ['Green']),
    200: question('How many suits are in a standard deck of playing cards?', ['4', 'Four']),
    300: question('What is the name of the symbol “&”?', ['Ampersand', 'An ampersand']),
    400: question('What is the traditional gift material for a 25th wedding anniversary?', ['Silver']),
    500: question('What instrument is used to measure wind speed?', ['Anemometer', 'An anemometer']),
    1000: question('What is the name for a word that imitates a sound, such as “buzz” or “hiss”?', ['Onomatopoeia'])
  })
];

export const freeResponseGeneral1Pack = buildPack({
  id: 'free-response-general-1',
  title: 'General 1',
  theme: 'Science, food, language, tech, sports, nature, numbers, and mixed trivia',
  description: 'A dedicated all-play question set written specifically for simultaneous typed answers in Free Response mode.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  supportedGameModes: ['free-response'],
  accentColor: '#8be9fd'
}, categories);
