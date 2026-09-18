import { buildPack, category, question } from './buildPack';

const categories = [
  category('Blockbusters', {
    100: question('What is Pete Mitchell’s call sign in Top Gun?', ['Maverick']),
    200: question('What fictional island contains the dinosaur park in the original Jurassic Park?', ['Isla Nublar', 'Nublar']),
    300: question('Which purple-skinned villain seeks the Infinity Stones in Avengers: Infinity War?', ['Thanos']),
    400: question('What is the name of Tom Cruise’s spy character in the Mission: Impossible films?', ['Ethan Hunt', 'Hunt']),
    500: question('What is the name of Russell Crowe’s Roman general-turned-gladiator in Gladiator?', ['Maximus', 'Maximus Decimus Meridius']),
    1000: question('What warlord rules the Citadel in Mad Max: Fury Road?', ['Immortan Joe'])
  }),
  category('TV Comedy', {
    100: question('What is Kramer’s first name on Seinfeld?', ['Cosmo', 'Cosmo Kramer']),
    200: question('Who is the family patriarch played by Ed O’Neill on Modern Family?', ['Jay Pritchett', 'Jay']),
    300: question('What fictional community college is the setting of Community?', ['Greendale', 'Greendale Community College']),
    400: question('What initials name the fictional sketch-comedy show produced on 30 Rock?', ['TGS']),
    500: question('What Philadelphia bar is owned by the main characters in It’s Always Sunny in Philadelphia?', ['Paddy’s Pub', 'Paddys Pub']),
    1000: question('What is the name of Julia Louis-Dreyfus’s politician character in Veep?', ['Selina Meyer', 'Selina'])
  }),
  category('Sci-Fi & Fantasy', {
    100: question('Which Star Wars smuggler pilots the Millennium Falcon with Chewbacca?', ['Han Solo', 'Han']),
    200: question('What is the alternate dimension called in Stranger Things?', ['Upside Down', 'The Upside Down']),
    300: question('In The X-Files, what is the first name of FBI agent Mulder?', ['Fox', 'Fox Mulder']),
    400: question('Who is the blade runner played by Harrison Ford in the original Blade Runner?', ['Rick Deckard', 'Deckard']),
    500: question('What is the name of the surviving colonial battlestar in Battlestar Galactica?', ['Galactica', 'Battlestar Galactica']),
    1000: question('What is the surname of the detective played by Thomas Jane in the early seasons of The Expanse?', ['Miller', 'Josephus Miller'])
  }),
  category('Animation', {
    100: question('What restaurant employs SpongeBob SquarePants as a fry cook?', ['Krusty Krab', 'The Krusty Krab']),
    200: question('What delivery company does Fry work for in Futurama?', ['Planet Express']),
    300: question('What is the name of the talking dog in Family Guy?', ['Brian', 'Brian Griffin']),
    400: question('What animal is BoJack Horseman?', ['Horse', 'A horse']),
    500: question('What two cities form the central political divide in Arcane?', ['Piltover and Zaun', 'Zaun and Piltover']),
    1000: question('What is the name of the spaceship used by Spike Spiegel’s crew in Cowboy Bebop?', ['Bebop', 'The Bebop'])
  }),
  category('Actors on Screen', {
    100: question('Who plays Peter Parker in the MCU films beginning with Spider-Man: Homecoming?', ['Tom Holland', 'Holland']),
    200: question('Who plays the title character in the 2023 film Barbie?', ['Margot Robbie', 'Robbie']),
    300: question('Who plays the title assassin in the John Wick films?', ['Keanu Reeves', 'Reeves']),
    400: question('Who stars as Evelyn Wang in Everything Everywhere All at Once?', ['Michelle Yeoh', 'Yeoh']),
    500: question('Who plays corrupt detective Alonzo Harris in Training Day?', ['Denzel Washington', 'Washington']),
    1000: question('Who portrays Anton Chigurh in No Country for Old Men?', ['Javier Bardem', 'Bardem'])
  }),
  category('Screen Terms', {
    100: question('What do you call a story set before an already released story?', ['Prequel', 'A prequel']),
    200: question('What do you call a brief appearance by a well-known performer or public figure?', ['Cameo', 'A cameo']),
    300: question('What filmmaking term means maintaining consistent details between shots?', ['Continuity']),
    400: question('What term describes music or sound that characters inside a scene can also hear?', ['Diegetic sound', 'Diegetic']),
    500: question('What is a MacGuffin in storytelling?', ['Plot device', 'An object or goal that drives the plot', 'Object that drives the plot']),
    1000: question('What editing technique alternates between two scenes happening at the same time in different places?', ['Cross-cutting', 'Cross cutting', 'Parallel editing'])
  })
];

export const freeResponseGenreMoviesTvPack = buildPack({
  id: 'free-response-movies-tv',
  title: 'Free Response: Movies & TV',
  theme: 'Blockbusters, television, animation, actors, sci-fi, and screen terminology',
  description: 'A screen-entertainment all-play pack using new facts separate from the Classic Movies & TV set.',
  difficulty: 'mixed',
  approximateMinutes: 30,
  supportedGameModes: ['free-response'],
  accentColor: '#ffb3d9'
}, categories);
