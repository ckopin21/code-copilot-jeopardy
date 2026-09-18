import { buildPack, category, question } from './buildPack';

const categories = [
  category('Pop Stars', {
    100: question('Which singer released the album 1989?', ['Taylor Swift', 'Swift']),
    200: question('Who recorded the hit song “Shape of You”?', ['Ed Sheeran', 'Sheeran']),
    300: question('Which singer is often called the Queen of Pop and released “Like a Prayer”?', 'Madonna'),
    400: question('Which artist released “Blinding Lights”?', ['The Weeknd', 'Weeknd']),
    500: question('Which singer calls her fans “Little Monsters”?', ['Lady Gaga', 'Gaga']),
    1000: question('Which singer released the albums Future Nostalgia and Radical Optimism?', ['Dua Lipa', 'Lipa'])
  }),
  category('Classic Rock', {
    100: question('Who was the lead singer of Queen?', ['Freddie Mercury', 'Mercury']),
    200: question('The Beatles formed in which English city?', 'Liverpool'),
    300: question('Who was the lead singer and guitarist of Nirvana?', ['Kurt Cobain', 'Cobain']),
    400: question('Which band recorded “Hotel California”?', ['Eagles', 'The Eagles']),
    500: question('Which band recorded “Sweet Child o’ Mine”?', ["Guns N' Roses", 'Guns and Roses', 'GNR']),
    1000: question('Which guitarist co-founded Van Halen with his brother Alex?', ['Eddie Van Halen', 'Eddie Van Halen'])
  }),
  category('Hip-Hop & R&B', {
    100: question('Which rapper recorded “Lose Yourself”?', 'Eminem'),
    200: question('Which rapper released “Hotline Bling”?', 'Drake'),
    300: question('Beyoncé first became famous as a member of which group?', ["Destiny's Child", 'Destinys Child']),
    400: question('Which rapper teamed with Alicia Keys on “Empire State of Mind”?', ['Jay-Z', 'Jay Z']),
    500: question('Which artist released the album DAMN. in 2017?', ['Kendrick Lamar', 'Kendrick']),
    1000: question('Which two artists make up the hip-hop duo Outkast?', ['André 3000 and Big Boi', 'Andre 3000 and Big Boi', 'Big Boi and André 3000', 'Big Boi and Andre 3000'])
  }),
  category('2000s & 2010s Hits', {
    100: question('Who sang “Since U Been Gone”?', ['Kelly Clarkson', 'Clarkson']),
    200: question('Who sang “Umbrella”?', 'Rihanna'),
    300: question('Who sang “Rolling in the Deep”?', 'Adele'),
    400: question('Who sang the 2009 hit “Tik Tok”?', ['Kesha', 'Ke$ha']),
    500: question('Who sang “Party in the U.S.A.”?', ['Miley Cyrus', 'Miley']),
    1000: question('Who sang the 2013 hit “Royals”?', 'Lorde')
  }),
  category('Bands & Groups', {
    100: question('Which group recorded “Dancing Queen”?', 'ABBA'),
    200: question('Which boy band recorded “I Want It That Way”?', ['Backstreet Boys', 'The Backstreet Boys']),
    300: question('Which band recorded “Viva la Vida”?', 'Coldplay'),
    400: question('Which band recorded “Mr. Brightside”?', ['The Killers', 'Killers']),
    500: question('Which duo recorded “Seven Nation Army”?', ['The White Stripes', 'White Stripes']),
    1000: question('Which Norwegian band recorded “Take On Me”?', ['a-ha', 'A-ha', 'Aha'])
  }),
  category('Country Music', {
    100: question('Who sang “Jolene”?', ['Dolly Parton', 'Parton']),
    200: question('Who recorded “Friends in Low Places”?', ['Garth Brooks', 'Brooks']),
    300: question('Who sang “Before He Cheats”?', ['Carrie Underwood', 'Underwood']),
    400: question('Who recorded the hit version of “Tennessee Whiskey”?', ['Chris Stapleton', 'Stapleton']),
    500: question('Who sang “The Gambler”?', ['Kenny Rogers', 'Rogers']),
    1000: question('Who sang “Man! I Feel Like a Woman!”?', ['Shania Twain', 'Twain'])
  }),
  category('Music in Movies', {
    100: question('“Let It Go” is a song from which Disney movie?', 'Frozen'),
    200: question('Who sang “My Heart Will Go On” from Titanic?', ['Celine Dion', 'Céline Dion', 'Dion']),
    300: question('Who sang the hit version of “I Will Always Love You” featured in The Bodyguard?', ['Whitney Houston', 'Houston']),
    400: question('“Shallow” appears in which 2018 movie?', ['A Star Is Born', 'Star Is Born']),
    500: question('Which singer starred in the 1984 film Purple Rain?', 'Prince'),
    1000: question('Which movie musical features the songs “City of Stars” and “Another Day of Sun”?', ['La La Land', 'Lalaland'])
  }),
  category('Music Basics', {
    100: question('How many keys are on a standard modern piano?', '88'),
    200: question('How many strings does a standard guitar usually have?', '6'),
    300: question('The trumpet belongs to which instrument family?', ['Brass', 'Brass family']),
    400: question('In music, what does tempo describe?', ['Speed', 'Pace', 'Speed of the music', 'Pace of the music']),
    500: question('What is the highest common female singing voice?', 'Soprano'),
    1000: question('Which musical symbol raises a note by one half step?', ['Sharp', 'Sharp sign'])
  })
];

export const musicPack = buildPack({
  id: 'music',
  title: 'Music',
  theme: 'Pop, rock, hip-hop, country, bands, movie songs, and music basics',
  description: 'A broad music pack built around recognizable artists, songs, bands, and basic music knowledge with a friendly difficulty curve.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  accentColor: '#f6a8ff'
}, categories);
