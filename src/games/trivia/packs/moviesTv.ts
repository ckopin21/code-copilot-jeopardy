import { buildPack, type CategoryData } from './buildPack';

const categories: CategoryData[] = [
  { name: 'Blockbusters', questions: [
    ['Which 1993 film features a theme park populated by cloned dinosaurs?', 'Jurassic Park'],
    ['Who plays Jack Dawson in Titanic?', 'Leonardo DiCaprio'],
    ['What is the fictional African nation in Black Panther?', 'Wakanda'],
    ['Which 1985 film features a time-traveling DeLorean?', 'Back to the Future'],
    ['What is the subtitle of the second Lord of the Rings film?', ['The Two Towers', 'Two Towers']],
    ['Which 1975 Steven Spielberg film centers on a great white shark terrorizing Amity Island?', 'Jaws']
  ]},
  { name: 'TV Comedy', questions: [
    ['Which sitcom is set largely in the coffee shop Central Perk?', 'Friends'],
    ['What workplace is featured in the U.S. version of The Office?', ['Dunder Mifflin', 'Dunder Mifflin Paper Company']],
    ['Which mockumentary sitcom follows the employees of the Pawnee Parks Department?', 'Parks and Recreation'],
    ['What is the surname of the family at the center of Arrested Development?', 'Bluth'],
    ['Which sitcom features the characters Jake Peralta and Captain Holt?', 'Brooklyn Nine-Nine'],
    ['What fictional town is the setting of Schitt’s Creek?', ['Schitt’s Creek', 'Schitts Creek']]
  ]},
  { name: 'Science Fiction', questions: [
    ['What franchise features the starship USS Enterprise?', 'Star Trek'],
    ['Who directed the 1982 film E.T. the Extra-Terrestrial?', 'Steven Spielberg'],
    ['In The Matrix, which color pill does Neo take?', 'red'],
    ['What is the name of the desert planet that is central to Dune?', 'Arrakis'],
    ['Which 1979 film introduced the creature known as a Xenomorph?', 'Alien'],
    ['What is the name of the artificial intelligence in 2001: A Space Odyssey?', ['HAL 9000', 'HAL']]
  ]},
  { name: 'Animation', questions: [
    ['Which animated TV family lives at 742 Evergreen Terrace?', 'The Simpsons'],
    ['What green ogre is the title character of a 2001 DreamWorks film?', 'Shrek'],
    ['Which animated series follows Aang, the last Airbender?', 'Avatar: The Last Airbender'],
    ['What is the name of the robot protagonist of The Iron Giant?', ['The Iron Giant', 'Giant']],
    ['Which 2009 stop-motion film follows a girl who discovers an alternate version of her home?', 'Coraline'],
    ['Who created the animated series Samurai Jack?', 'Genndy Tartakovsky']
  ]},
  { name: 'Movie Quotes', questions: [
    ['Which film is associated with the line “I’ll be back”?', 'The Terminator'],
    ['Which film is associated with the line “There’s no place like home”?', 'The Wizard of Oz'],
    ['Which film is associated with the line “You can’t handle the truth!”?', 'A Few Good Men'],
    ['Which film is associated with the line “Why so serious?”?', 'The Dark Knight'],
    ['Which film is associated with the line “I see dead people”?', 'The Sixth Sense'],
    ['Which 1942 film is associated with the line “Here’s looking at you, kid”?', 'Casablanca']
  ]},
  { name: 'Directors', questions: [
    ['Who directed Inception?', 'Christopher Nolan'],
    ['Who directed Get Out?', 'Jordan Peele'],
    ['Who directed Pulp Fiction?', 'Quentin Tarantino'],
    ['Who directed Parasite?', 'Bong Joon-ho'],
    ['Who directed Lost in Translation?', 'Sofia Coppola'],
    ['Who directed Seven Samurai?', 'Akira Kurosawa']
  ]},
  { name: 'Prestige TV', questions: [
    ['Which HBO series follows the Roy family and their media empire?', 'Succession'],
    ['What alias does chemistry teacher Walter White use in Breaking Bad?', 'Heisenberg'],
    ['Which series follows ad executive Don Draper?', 'Mad Men'],
    ['What is the name of the fictional New Jersey mob boss played by James Gandolfini?', 'Tony Soprano'],
    ['Which limited series dramatizes the 1986 Soviet nuclear disaster?', 'Chernobyl'],
    ['Which HBO drama is based on a video game about Joel and Ellie?', 'The Last of Us']
  ]},
  { name: 'Fantasy', questions: [
    ['What school does Harry Potter attend?', ['Hogwarts', 'Hogwarts School of Witchcraft and Wizardry']],
    ['What is the name of Gandalf’s sword in The Lord of the Rings?', 'Glamdring'],
    ['Which TV fantasy series features the houses Stark and Lannister?', 'Game of Thrones'],
    ['In The Princess Bride, what is Westley’s masked identity?', ['Dread Pirate Roberts', 'the Dread Pirate Roberts']],
    ['Which 1982 fantasy film features the creature Gelflings and Skeksis?', 'The Dark Crystal'],
    ['What is the name of the lion in The Chronicles of Narnia?', 'Aslan']
  ]},
  { name: 'Actors', questions: [
    ['Who plays Iron Man in the Marvel Cinematic Universe?', 'Robert Downey Jr.'],
    ['Who stars as Elle Woods in Legally Blonde?', 'Reese Witherspoon'],
    ['Who played the title role in Edward Scissorhands?', 'Johnny Depp'],
    ['Who portrays Furiosa in Mad Max: Fury Road?', 'Charlize Theron'],
    ['Who played Clarice Starling in The Silence of the Lambs?', 'Jodie Foster'],
    ['Who stars as Daniel Plainview in There Will Be Blood?', 'Daniel Day-Lewis']
  ]},
  { name: 'Behind the Screen', questions: [
    ['What award ceremony honors achievements in American television?', ['Emmy Awards', 'Emmys']],
    ['What company uses a roaring lion in its classic studio logo?', ['MGM', 'Metro-Goldwyn-Mayer', 'Metro Goldwyn Mayer']],
    ['What is the common term for a pilot episode made to sell a television series?', ['pilot', 'TV pilot']],
    ['Which film rating means children under 17 generally require an accompanying parent or adult guardian in the U.S.?', 'R'],
    ['What is the name of the annual film festival held in Cannes, France?', ['Cannes Film Festival', 'Festival de Cannes']],
    ['What filmmaking technique combines separately photographed elements into one image?', ['compositing', 'composite photography']]
  ]}
];

export const moviesTvPack = buildPack({
  id: 'movies-tv',
  title: 'Movies & TV',
  theme: 'Film, television, actors, directors, and screen history',
  description: 'General entertainment trivia spanning blockbusters, prestige television, animation, and classic cinema.',
  difficulty: 'mixed',
  approximateMinutes: 35
}, categories);
