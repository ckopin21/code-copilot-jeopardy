import { buildPack, category, question } from './buildPack';

const categories = [
  category('Animated Adventures', {
    100: question('In The Jungle Book, what is the name of Mowgli’s easygoing bear friend?', ['Baloo']),
    200: question('In Tangled, what kingdom is Rapunzel the lost princess of?', ['Corona', 'Kingdom of Corona']),
    300: question('In The Emperor’s New Groove, which emperor is transformed into a llama?', ['Kuzco', 'Emperor Kuzco']),
    400: question('In Brother Bear, what is the name of the young bear who travels with Kenai?', ['Koda']),
    500: question('In Treasure Planet, what is the first name of the teenage hero Jim Hawkins?', ['Jim']),
    1000: question('Who is the villainous rat in The Great Mouse Detective?', ['Professor Ratigan', 'Ratigan'])
  }),
  category('Pixar Details', {
    100: question('What is the name of the cowboy toy who leads Andy’s toys in Toy Story?', ['Woody', 'Sheriff Woody']),
    200: question('What nickname do Sulley and Mike give the little girl in Monsters, Inc.?', ['Boo']),
    300: question('What is the name of the red race car who stars in Cars?', ['Lightning McQueen', 'McQueen']),
    400: question('In Up, what name does Russell give the large colorful bird?', ['Kevin']),
    500: question('In Soul, what is the name of the jazz pianist whose soul gets separated from his body?', ['Joe Gardner', 'Joe']),
    1000: question('In Luca, what is the full first name of Luca’s sea-monster best friend?', ['Alberto', 'Alberto Scorfano'])
  }),
  category('Heroes & Friends', {
    100: question('What fairy is Peter Pan’s closest companion?', ['Tinker Bell', 'Tinkerbell']),
    200: question('What is the name of the young teacup in Beauty and the Beast?', ['Chip']),
    300: question('Who trains Hercules to become a hero?', ['Phil', 'Philoctetes']),
    400: question('What is the name of Robin Hood’s large bear best friend?', ['Little John']),
    500: question('In Bolt, what is the name of the streetwise cat who joins Bolt on his journey?', ['Mittens']),
    1000: question('In Atlantis: The Lost Empire, what is the surname of the expedition commander who betrays the group?', ['Rourke', 'Commander Rourke', 'Lyle Rourke'])
  }),
  category('Villains', {
    100: question('Who is the royal vizier villain in Aladdin?', ['Jafar']),
    200: question('Who is Simba’s uncle and main enemy in The Lion King?', ['Scar']),
    300: question('Who is Peter Pan’s pirate nemesis?', ['Captain Hook', 'Hook']),
    400: question('What are the names of Cruella de Vil’s two henchmen?', ['Horace and Jasper', 'Jasper and Horace', 'Horace Badun and Jasper Badun']),
    500: question('Who is the ruthless judge who pursues Esmeralda in The Hunchback of Notre Dame?', ['Claude Frollo', 'Judge Frollo', 'Frollo']),
    1000: question('Who is the skeletal sorcerer villain in The Black Cauldron?', ['Horned King', 'The Horned King'])
  }),
  category('Parks & Attractions', {
    100: question('Which Walt Disney World park is home to Cinderella Castle?', ['Magic Kingdom', 'The Magic Kingdom']),
    200: question('What pirate-themed boat attraction inspired a film franchise starring Jack Sparrow?', ['Pirates of the Caribbean']),
    300: question('What planet is the setting of Star Wars: Galaxy’s Edge?', ['Batuu']),
    400: question('What Disneyland roller coaster is built around an artificial Alpine mountain?', ['Matterhorn Bobsleds', 'Matterhorn']),
    500: question('How many national pavilions currently make up EPCOT’s World Showcase?', ['11', 'Eleven']),
    1000: question('What is the name of the volcano landmark at Tokyo DisneySea?', ['Mount Prometheus', 'Prometheus'])
  }),
  category('Behind the Magic', {
    100: question('What was Mickey Mouse originally going to be named before Walt Disney’s wife suggested Mickey?', ['Mortimer Mouse', 'Mortimer']),
    200: question('Who voiced the Genie in Disney’s original animated Aladdin?', ['Robin Williams']),
    300: question('What nickname is given to the group of veteran Disney animators known collectively as the “Nine Old Men”?', ['Nine Old Men', 'The Nine Old Men']),
    400: question('Which songwriting brothers wrote Disney songs including “It’s a Small World” and music for Mary Poppins?', ['Sherman Brothers', 'The Sherman Brothers', 'Richard and Robert Sherman', 'Robert and Richard Sherman']),
    500: question('Which 1961 Disney film made landmark use of Xerox technology to transfer animators’ drawings directly to cels?', ['One Hundred and One Dalmatians', '101 Dalmatians']),
    1000: question('What multiplane-camera Disney film sequence is famous for the opening move through the forest in Bambi?', ['Bambi'])
  })
];

export const freeResponseGenreDisneyPack = buildPack({
  id: 'free-response-disney',
  title: 'Disney',
  theme: 'Disney animation, Pixar, parks, villains, characters, and studio history',
  description: 'A Disney-focused all-play pack with completely separate questions from the Classic Disney pack.',
  difficulty: 'mixed',
  approximateMinutes: 30,
  supportedGameModes: ['free-response'],
  accentColor: '#9ec5ff'
}, categories);
