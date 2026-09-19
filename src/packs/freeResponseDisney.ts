import { buildPack, category, question } from './buildPack';

const categories = [
  category('Disney Heroes', {
    100: question('What is the name of the young deer who is the title character of a 1942 Disney film?', ['Bambi']),
    200: question('Which Disney heroine disguises herself as a soldier to take her father’s place?', ['Mulan']),
    300: question('What is the name of the street-rat hero in Aladdin?', ['Aladdin']),
    400: question('Which Disney hero is raised by gorillas after being orphaned in the jungle?', ['Tarzan']),
    500: question('What is the name of the young inventor and mapmaker in Treasure Planet?', ['Jim Hawkins', 'Jim']),
    1000: question('In The Black Cauldron, what is the name of the young assistant pig-keeper who becomes the hero?', ['Taran'])
  }),
  category('Pixar Worlds', {
    100: question('What type of animal is Lightning McQueen?', ['Car', 'Race car']),
    200: question('What is the name of the old man who flies his house with balloons in Up?', ['Carl Fredricksen', 'Carl']),
    300: question('In Monsters, Inc., what nickname do Sulley and Mike give the human child?', ['Boo']),
    400: question('What is the name of the superhero family in The Incredibles?', ['Parr family', 'The Parrs', 'Parr']),
    500: question('In Onward, what fantasy species are brothers Ian and Barley?', ['Elves', 'Elf']),
    1000: question('What is the name of the fictional seaside town where Luca is set?', ['Portorosso'])
  }),
  category('Princesses', {
    100: question('Which Disney princess lives with seven dwarfs?', ['Snow White']),
    200: question('Which princess has a tiger named Rajah?', ['Jasmine', 'Princess Jasmine']),
    300: question('What is the name of the princess in The Princess and the Frog?', ['Tiana', 'Princess Tiana']),
    400: question('Which princess has a horse named Angus?', ['Merida']),
    500: question('What is the name of the princess in Sleeping Beauty?', ['Aurora', 'Princess Aurora']),
    1000: question('Which Disney princess is the daughter of Chief Powhatan?', ['Pocahontas'])
  }),
  category('Disney Side Characters', {
    100: question('What is the name of Pinocchio’s cricket companion?', ['Jiminy Cricket', 'Jiminy']),
    200: question('What is the name of the teapot in Beauty and the Beast?', ['Mrs. Potts', 'Mrs Potts']),
    300: question('Which bird serves as Scar’s majordomo in The Lion King?', ['Zazu']),
    400: question('What is the name of the rabbit police officer who partners with Nick Wilde in Zootopia?', ['Judy Hopps', 'Judy']),
    500: question('What is the name of the goat owned by Esmeralda in The Hunchback of Notre Dame?', ['Djali']),
    1000: question('What is the name of the eccentric seagull who gives Ariel bad advice about human objects?', ['Scuttle'])
  }),
  category('Disney Villains 2', {
    100: question('Who is the villainous lion in The Lion King?', ['Scar']),
    200: question('What pirate captain is Peter Pan’s main enemy?', ['Captain Hook', 'Hook']),
    300: question('Who is the main villain in Aladdin?', ['Jafar']),
    400: question('What hunter pursues the Beast in Beauty and the Beast?', ['Gaston']),
    500: question('Who is the fashion designer villain in The Incredibles?', ['Syndrome']),
    1000: question('What is the name of the villainous poacher in The Rescuers Down Under?', ['Percival McLeach', 'McLeach'])
  }),
  category('Disney Parks 2', {
    100: question('What castle stands at the center of Magic Kingdom in Florida?', ['Cinderella Castle']),
    200: question('What Disney World attraction features singing dolls representing countries around the world?', ['It’s a Small World', 'Its a Small World']),
    300: question('Which EPCOT pavilion contains the Frozen Ever After attraction?', ['Norway', 'Norway Pavilion']),
    400: question('What land in Disneyland is themed around Star Wars?', ['Star Wars: Galaxy’s Edge', 'Galaxy’s Edge', 'Galaxys Edge']),
    500: question('What is the name of the runaway railway attraction starring Mickey and Minnie at Hollywood Studios?', ['Mickey & Minnie’s Runaway Railway', 'Mickey and Minnies Runaway Railway']),
    1000: question('What original EPCOT attraction explored the history and future of communication inside Spaceship Earth?', ['Spaceship Earth'])
  }),
  category('Songs & Quotes', {
    100: question('Which movie features the song “Hakuna Matata”?', ['The Lion King', 'Lion King']),
    200: question('Which movie features the song “Under the Sea”?', ['The Little Mermaid', 'Little Mermaid']),
    300: question('Which movie features the song “How Far I’ll Go”?', ['Moana']),
    400: question('Which Pixar movie features the song “Remember Me”?', ['Coco']),
    500: question('Which Disney movie features the song “Surface Pressure”?', ['Encanto']),
    1000: question('Which Disney animated movie features the song “Hellfire”?', ['The Hunchback of Notre Dame', 'Hunchback of Notre Dame'])
  }),
  category('Disney Deep Cuts', {
    100: question('What kind of animal is Dumbo?', ['Elephant', 'An elephant']),
    200: question('What is the name of the fox hero in Disney’s Robin Hood?', ['Robin Hood']),
    300: question('In The Emperor’s New Groove, what animal is Kuzco transformed into?', ['Llama', 'A llama']),
    400: question('What is the name of the giant friendly robot in Treasure Planet?', ['B.E.N.', 'BEN']),
    500: question('In Oliver & Company, what type of animal is Oliver?', ['Cat', 'Kitten']),
    1000: question('What is the name of the magical black cauldron’s main undead army in The Black Cauldron?', ['Cauldron Born', 'The Cauldron Born'])
  })
];

export const freeResponseDisneyPack = buildPack({
  id: 'free-response-disney',
  title: 'Free Response Disney',
  theme: 'Disney animation, Pixar, parks, characters, villains, songs, and deeper cuts',
  description: 'A Disney-focused pack written specifically for simultaneous typed answers.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  supportedGameModes: ['free-response'],
  accentColor: '#8db8ff'
}, categories);
