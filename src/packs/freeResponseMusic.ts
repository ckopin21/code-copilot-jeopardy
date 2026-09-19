import { buildPack, category, question } from './buildPack';

const categories = [
  category('Pop Hits', {
    100: question('Who sang the hit song “Firework”?', ['Katy Perry', 'Katy']),
    200: question('Who sang “Bad Guy”?', ['Billie Eilish', 'Billie']),
    300: question('Who sang “As It Was”?', ['Harry Styles', 'Harry']),
    400: question('Who sang “Levitating”?', ['Dua Lipa', 'Dua']),
    500: question('Who sang “Flowers” in 2023?', ['Miley Cyrus', 'Miley']),
    1000: question('Who released the 2024 album Hit Me Hard and Soft?', ['Billie Eilish', 'Billie'])
  }),
  category('Rock', {
    100: question('Which band recorded “Dream On”?', ['Aerosmith']),
    200: question('Which band recorded “Livin’ on a Prayer”?', ['Bon Jovi']),
    300: question('Which band recorded “Enter Sandman”?', ['Metallica']),
    400: question('Which band recorded “Boulevard of Broken Dreams”?', ['Green Day']),
    500: question('Which band recorded “Everlong”?', ['Foo Fighters']),
    1000: question('Which band released the album Ten in 1991?', ['Pearl Jam'])
  }),
  category('Hip-Hop', {
    100: question('Which rapper released “God’s Plan”?', ['Drake']),
    200: question('Which rapper released “HUMBLE.”?', ['Kendrick Lamar', 'Kendrick']),
    300: question('Which rapper released “SICKO MODE”?', ['Travis Scott', 'Travis']),
    400: question('Which rapper released “The Real Slim Shady”?', ['Eminem']),
    500: question('Which rapper released the album 2014 Forest Hills Drive?', ['J. Cole', 'J Cole']),
    1000: question('Which rapper was born Shawn Carter?', ['Jay-Z', 'Jay Z'])
  }),
  category('2000s & 2010s', {
    100: question('Who sang “Complicated” in 2002?', ['Avril Lavigne', 'Avril']),
    200: question('Who sang “Bleeding Love”?', ['Leona Lewis', 'Leona']),
    300: question('Who sang “Apologize” with Timbaland?', ['OneRepublic', 'One Republic']),
    400: question('Who sang “Counting Stars”?', ['OneRepublic', 'One Republic']),
    500: question('Who sang “Somebody That I Used to Know”?', ['Gotye']),
    1000: question('Who sang “Take Me to Church”?', ['Hozier'])
  }),
  category('Bands & Groups 2', {
    100: question('Which group sang “Waterloo”?', ['ABBA']),
    200: question('Which band sang “Radioactive”?', ['Imagine Dragons']),
    300: question('Which band sang “Pompeii”?', ['Bastille']),
    400: question('Which band sang “Use Somebody”?', ['Kings of Leon']),
    500: question('Which band sang “The Middle” in 2001?', ['Jimmy Eat World']),
    1000: question('Which band released the album A Rush of Blood to the Head?', ['Coldplay'])
  }),
  category('Country', {
    100: question('Who sang “9 to 5”?', ['Dolly Parton', 'Dolly']),
    200: question('Who sang “Chicken Fried”?', ['Zac Brown Band']),
    300: question('Who sang “Need You Now”?', ['Lady A', 'Lady Antebellum']),
    400: question('Who sang “Whiskey Glasses”?', ['Morgan Wallen', 'Wallen']),
    500: question('Who sang “Die a Happy Man”?', ['Thomas Rhett']),
    1000: question('Who released the album Golden Hour in 2018?', ['Kacey Musgraves', 'Kacey'])
  }),
  category('Movie & TV Music', {
    100: question('Which movie features “Eye of the Tiger”?', ['Rocky III', 'Rocky 3']),
    200: question('Which movie features the song “Footloose”?', ['Footloose']),
    300: question('Which movie features “Ghostbusters” by Ray Parker Jr.?', ['Ghostbusters']),
    400: question('Which TV series used “Where Everybody Knows Your Name” as its theme?', ['Cheers']),
    500: question('Which movie features “Danger Zone” by Kenny Loggins?', ['Top Gun']),
    1000: question('Which 1985 film prominently features “The Power of Love” by Huey Lewis and the News?', ['Back to the Future'])
  }),
  category('Music Knowledge', {
    100: question('What instrument has black and white keys and is commonly played with both hands?', ['Piano']),
    200: question('What do you call a group of three musicians performing together?', ['Trio', 'A trio']),
    300: question('What musical term means gradually getting louder?', ['Crescendo']),
    400: question('What is the lowest common male singing voice?', ['Bass']),
    500: question('What does BPM stand for in music?', ['Beats per minute']),
    1000: question('What musical term means to play notes smoothly and connected?', ['Legato'])
  })
];

export const freeResponseMusicPack = buildPack({
  id: 'free-response-music',
  title: 'Free Response Music',
  theme: 'Pop, rock, hip-hop, country, bands, soundtracks, and music knowledge',
  description: 'A music-focused pack built for quick simultaneous typed answers.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  supportedGameModes: ['free-response'],
  accentColor: '#f4a7ff'
}, categories);
