import { buildPack, category, question } from './buildPack';

const categories = [
  category('Pop Hits', {
    100: question('Who recorded the song “bad guy”?', ['Billie Eilish', 'Eilish']),
    200: question('Who recorded “Firework”?', ['Katy Perry', 'Perry']),
    300: question('Who recorded “Poker Face”?', ['Lady Gaga', 'Gaga']),
    400: question('Who recorded “As It Was”?', ['Harry Styles', 'Styles']),
    500: question('Who recorded “good 4 u”?', ['Olivia Rodrigo', 'Rodrigo']),
    1000: question('Who recorded “Hips Don’t Lie”?', ['Shakira'])
  }),
  category('Rock & Alternative', {
    100: question('Which band recorded “Smells Like Teen Spirit”?', ['Nirvana']),
    200: question('Which band recorded “Boulevard of Broken Dreams”?', ['Green Day']),
    300: question('Which band recorded “Wonderwall”?', ['Oasis']),
    400: question('Which band recorded “Under the Bridge”?', ['Red Hot Chili Peppers', 'RHCP']),
    500: question('Which band recorded “Everlong”?', ['Foo Fighters', 'The Foo Fighters']),
    1000: question('Which band recorded “Take Me Out”?', ['Franz Ferdinand'])
  }),
  category('Hip-Hop', {
    100: question('Which rapper recorded “SICKO MODE”?', ['Travis Scott', 'Scott']),
    200: question('Which rapper recorded “God’s Plan”?', ['Drake']),
    300: question('Which rapper recorded “California Love” with Dr. Dre?', ['Tupac Shakur', 'Tupac', '2Pac']),
    400: question('Which rapper recorded “Gold Digger” with Jamie Foxx?', ['Kanye West', 'Kanye']),
    500: question('Which hip-hop duo recorded “Ms. Jackson”?', ['Outkast']),
    1000: question('Which rap group recorded “C.R.E.A.M.”?', ['Wu-Tang Clan', 'Wu Tang Clan'])
  }),
  category('Albums', {
    100: question('Who released the album Thriller?', ['Michael Jackson']),
    200: question('Which band released the album Rumours?', ['Fleetwood Mac']),
    300: question('Which band released the album Nevermind?', ['Nirvana']),
    400: question('Who released the album Back to Black?', ['Amy Winehouse', 'Winehouse']),
    500: question('Who released The Miseducation of Lauryn Hill?', ['Lauryn Hill', 'Hill']),
    1000: question('Who released the album Songs in the Key of Life?', ['Stevie Wonder', 'Wonder'])
  }),
  category('Bands & Groups', {
    100: question('Which band recorded “Bohemian Rhapsody”?', ['Queen']),
    200: question('Which band recorded “Hey Jude”?', ['The Beatles', 'Beatles']),
    300: question('Which Irish band recorded “Zombie”?', ['The Cranberries', 'Cranberries']),
    400: question('Which band recorded “Somebody Told Me”?', ['The Killers', 'Killers']),
    500: question('Which band recorded “Basket Case”?', ['Green Day']),
    1000: question('Which band recorded “No One Knows”?', ['Queens of the Stone Age', 'QOTSA'])
  }),
  category('Music Terms', {
    100: question('What musical dynamic marking means loud?', ['Forte']),
    200: question('What musical term means to gradually get louder?', ['Crescendo']),
    300: question('What is a chord made of three notes commonly called?', ['Triad', 'A triad']),
    400: question('What interval spans from one note to the next note with the same letter name?', ['Octave', 'An octave']),
    500: question('Which major key has no sharps or flats in its key signature?', ['C major', 'C']),
    1000: question('What traditional Italian tempo marking means very slow and broad?', ['Largo'])
  })
];

export const freeResponseGenreMusicPack = buildPack({
  id: 'free-response-music',
  title: 'Music',
  theme: 'Pop, rock, hip-hop, albums, bands, and music terminology',
  description: 'A music all-play pack with new songs, artists, albums, and theory facts separate from Classic.',
  difficulty: 'mixed',
  approximateMinutes: 30,
  supportedGameModes: ['free-response'],
  accentColor: '#f2a7ff'
}, categories);
