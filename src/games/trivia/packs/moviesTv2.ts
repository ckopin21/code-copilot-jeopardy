import { buildPack, category, question } from './buildPack';

const categories = [
  category('Blockbusters II', {
    100: question('Which film franchise features the archaeologist Indiana Jones?', ['Indiana Jones', 'Indiana Jones franchise']),
    200: question('Which 1997 film features Agents J and K policing alien activity on Earth?', ['Men in Black', 'MIB']),
    300: question('Which 2000 film stars Russell Crowe as the Roman general Maximus?', 'Gladiator'),
    400: question('Which 2006 Martin Scorsese crime film follows an undercover cop and a mob mole in Boston?', ['The Departed', 'Departed']),
    500: question('Which 1995 thriller follows detectives Somerset and Mills as they hunt a serial killer?', ['Se7en', 'Seven']),
    1000: question('Which 1995 Michael Mann crime film pairs Al Pacino as a detective with Robert De Niro as a professional thief?', 'Heat')
  }),
  category('TV Comedy II', {
    100: question('Which sitcom features Sheldon Cooper and Leonard Hofstadter?', ['The Big Bang Theory', 'Big Bang Theory']),
    200: question('Which sitcom is narrated by Ted Mosby as he tells his children how he met their mother?', ['How I Met Your Mother', 'HIMYM']),
    300: question('Which sitcom follows a study group at Greendale Community College?', 'Community'),
    400: question('Which political comedy stars Julia Louis-Dreyfus as Selina Meyer?', 'Veep'),
    500: question('Which HBO comedy follows a fictionalized version of Larry David?', ['Curb Your Enthusiasm', 'Curb']),
    1000: question('Which British sitcom follows the IT department at the fictional Reynholm Industries?', ['The IT Crowd', 'IT Crowd'])
  }),
  category('TV Drama II', {
    100: question('Which series features Eleven and the alternate dimension called the Upside Down?', 'Stranger Things'),
    200: question('Which medical drama follows surgeons working in Seattle, including Meredith Grey?', ["Grey's Anatomy", 'Greys Anatomy']),
    300: question('Which HBO crime drama examines institutions such as police, schools, politics, and media in Baltimore?', ['The Wire', 'Wire']),
    400: question('Which drama follows Soviet spies Elizabeth and Philip Jennings living undercover in suburban America?', ['The Americans', 'Americans']),
    500: question('Which series stars Rami Malek as hacker Elliot Alderson?', ['Mr. Robot', 'Mr Robot']),
    1000: question('Which HBO western drama is set in a lawless South Dakota settlement during the 1870s?', 'Deadwood')
  }),
  category('Animation Beyond Disney', {
    100: question('Which animated series follows a yellow sea sponge who lives in a pineapple in Bikini Bottom?', ['SpongeBob SquarePants', 'Spongebob Squarepants', 'SpongeBob']),
    200: question('What is the name of Ash Ketchum’s electric Pokémon partner?', 'Pikachu'),
    300: question('What is the name of the delivery company where Fry works in Futurama?', 'Planet Express'),
    400: question('Which 2001 Hayao Miyazaki film follows a girl named Chihiro through a spirit world?', 'Spirited Away'),
    500: question('Which anime series follows bounty hunter Spike Spiegel aboard the Bebop?', 'Cowboy Bebop'),
    1000: question('Which animated miniseries follows half-brothers Wirt and Greg through a mysterious forest called the Unknown?', ['Over the Garden Wall', 'OTGW'])
  }),
  category('Directors II', {
    100: question('Who directed Titanic?', 'James Cameron'),
    200: question('Who directed Barbie?', 'Greta Gerwig'),
    300: question('Who directed The Godfather?', ['Francis Ford Coppola', 'Coppola']),
    400: question('Who directed Do the Right Thing?', 'Spike Lee'),
    500: question('Who directed The Grand Budapest Hotel?', 'Wes Anderson'),
    1000: question('Who directed Pan’s Labyrinth?', ['Guillermo del Toro', 'Guillermo Del Toro', 'del Toro'])
  }),
  category('Actors II', {
    100: question('Who plays Neo in The Matrix?', 'Keanu Reeves'),
    200: question('Who plays Katniss Everdeen in The Hunger Games films?', 'Jennifer Lawrence'),
    300: question('Who plays the title character in Forrest Gump?', 'Tom Hanks'),
    400: question('Who plays Michael Corleone in The Godfather?', 'Al Pacino'),
    500: question('Who plays Truman Burbank in The Truman Show?', 'Jim Carrey'),
    1000: question('Who plays Antonio Salieri in the 1984 film Amadeus?', ['F. Murray Abraham', 'F Murray Abraham'])
  }),
  category('Science Fiction & Fantasy II', {
    100: question('Which film franchise features the Jedi and the Sith?', ['Star Wars', 'Star Wars franchise']),
    200: question('What is the name of the Doctor’s time machine in Doctor Who?', ['TARDIS', 'the TARDIS']),
    300: question('Which fantasy film trilogy centers on destroying the One Ring?', ['The Lord of the Rings', 'Lord of the Rings']),
    400: question('What are the bioengineered humanoids called in Blade Runner?', ['replicants', 'replicant']),
    500: question('Which science-fiction series features the spaceship Rocinante?', ['The Expanse', 'Expanse']),
    1000: question('What are the machine enemies of humanity called in Battlestar Galactica?', ['Cylons', 'Cylon'])
  }),
  category('Classic Cinema', {
    100: question('Which 1965 musical film follows the von Trapp family and their governess Maria?', ['The Sound of Music', 'Sound of Music']),
    200: question('Which 1960 Alfred Hitchcock film is set partly at the Bates Motel?', 'Psycho'),
    300: question('Which 1952 musical stars Gene Kelly and features a famous dance in the rain?', ["Singin' in the Rain", 'Singing in the Rain']),
    400: question('Which 1950 film centers on faded silent-film star Norma Desmond?', ['Sunset Boulevard', 'Sunset Blvd.']),
    500: question('Which 1948 Italian neorealist film follows a father searching for his stolen bicycle?', ['Bicycle Thieves', 'The Bicycle Thief', 'Ladri di biciclette']),
    1000: question('Which 1927 Fritz Lang science-fiction film depicts a vast futuristic city divided by class?', 'Metropolis')
  }),
  category('Reality & Competition TV', {
    100: question('Which reality competition has contestants vote one another off an island?', 'Survivor'),
    200: question('Which singing competition is known for coaches turning their chairs during blind auditions?', ['The Voice', 'Voice']),
    300: question('Which competition series is built around drag performance challenges and lip-sync battles?', ["RuPaul's Drag Race", 'Rupauls Drag Race', 'Drag Race']),
    400: question('Which competition series has fashion designers create garments under time and material constraints?', 'Project Runway'),
    500: question('Which travel competition uses challenges called Detours and Roadblocks?', ['The Amazing Race', 'Amazing Race']),
    1000: question('Which reality competition secretly assigns one contestant to sabotage the group’s efforts?', ['The Mole', 'Mole'])
  }),
  category('Film Craft', {
    100: question('What is the job title for the person who writes a movie screenplay?', ['screenwriter', 'screen writer', 'scriptwriter', 'script writer']),
    200: question('What is the term for music written specifically to accompany a film?', ['film score', 'score', 'movie score']),
    300: question('What crew role is responsible for the camera and lighting look of a film?', ['cinematographer', 'director of photography', 'DP', 'DOP']),
    400: question('What editing term describes a sequence of short shots used to compress time or show progress?', 'montage'),
    500: question('What is the term for sound effects performed and recorded in sync with picture during post-production?', ['Foley', 'Foley sound', 'Foley effects']),
    1000: question('What post-production process re-records dialogue in a studio to replace or improve production audio?', ['ADR', 'Automated Dialogue Replacement', 'Automatic Dialogue Replacement'])
  })
];

export const moviesTv2Pack = buildPack({
  id: 'movies-tv-2',
  title: 'Movies & TV 2',
  theme: 'A fresh set of film, television, actors, directors, animation, and screen craft',
  description: 'A second 60-question entertainment pack with direct questions, broad recognition at lower values, and tougher but fair high-value material.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  accentColor: '#ffb2da'
}, categories);
