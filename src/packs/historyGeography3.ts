import { buildPack, category, question } from './buildPack';

const categories = [
  category('U.S. History Essentials', {
    100: question('Which U.S. holiday is celebrated on July 4?', ['Independence Day', 'Fourth of July', '4th of July']),
    200: question('Which state was the 50th state admitted to the United States?', 'Hawaii'),
    300: question('Which founding document begins with the words “We the People”?', ['U.S. Constitution', 'United States Constitution', 'Constitution']),
    400: question('In which city was the Declaration of Independence signed?', 'Philadelphia'),
    500: question('The United States purchased Alaska from which country?', 'Russia'),
    1000: question('Which U.S. president was in office when the Louisiana Purchase was completed?', ['Thomas Jefferson', 'Jefferson'])
  }),
  category('World History Basics', {
    100: question('The ancient Olympic Games began in which country?', 'Greece'),
    200: question('In what year did the Titanic sink?', '1912'),
    300: question('In which country did the Industrial Revolution begin?', ['Great Britain', 'Britain', 'England', 'United Kingdom', 'UK']),
    400: question('The Black Death was a devastating outbreak of which disease?', ['Bubonic plague', 'Plague']),
    500: question('Which invention is Johannes Gutenberg most famous for helping spread through Europe?', ['Printing press', 'Movable-type printing press']),
    1000: question('Which European country was ruled by Louis XIV, known as the Sun King?', 'France')
  }),
  category('Famous People in History', {
    100: question('Amelia Earhart became famous in what field?', ['Aviation', 'Flying', 'Pilot']),
    200: question('Who delivered the famous “I Have a Dream” speech in 1963?', ['Martin Luther King Jr.', 'Martin Luther King Jr', 'MLK', 'Martin Luther King']),
    300: question('Joan of Arc is a national heroine of which country?', 'France'),
    400: question('Which nurse became famous for her work during the Crimean War?', ['Florence Nightingale', 'Nightingale']),
    500: question('Which scientist developed the theory of relativity?', ['Albert Einstein', 'Einstein']),
    1000: question('Which English scientist is associated with the laws of motion and universal gravitation?', ['Isaac Newton', 'Newton'])
  }),
  category('Capitals & Countries III', {
    100: question('What is the capital of Italy?', 'Rome'),
    200: question('What is the capital of Mexico?', ['Mexico City', 'Ciudad de México', 'Ciudad de Mexico']),
    300: question('What is the capital of Egypt?', 'Cairo'),
    400: question('What is the capital of Argentina?', 'Buenos Aires'),
    500: question('What is the capital of New Zealand?', 'Wellington'),
    1000: question('What is the capital of Vietnam?', 'Hanoi')
  }),
  category('U.S. Geography', {
    100: question('What is the largest U.S. state by land area?', 'Alaska'),
    200: question('Which U.S. state is nicknamed the Sunshine State?', 'Florida'),
    300: question('The Grand Canyon is located in which state?', 'Arizona'),
    400: question('The city of Seattle is located in which U.S. state?', ['Washington', 'Washington State']),
    500: question('Mount Rushmore is located in which state?', 'South Dakota'),
    1000: question('Which U.S. state borders only one other U.S. state?', 'Maine')
  }),
  category('World Geography', {
    100: question('What is the largest country in the world by land area?', 'Russia'),
    200: question('Which European country is often described as being shaped like a boot?', 'Italy'),
    300: question('Mount Fuji is located in which country?', 'Japan'),
    400: question('Most of the Amazon rainforest is located in which country?', 'Brazil'),
    500: question('Which sea lies between southern Europe and northern Africa?', ['Mediterranean Sea', 'Mediterranean']),
    1000: question('The historic city of Dubrovnik is in which country?', 'Croatia')
  }),
  category('Landmarks Around the World', {
    100: question('Big Ben is located in which city?', 'London'),
    200: question('The Colosseum is located in which city?', 'Rome'),
    300: question('The Taj Mahal is located in which country?', 'India'),
    400: question('Christ the Redeemer overlooks which Brazilian city?', ['Rio de Janeiro', 'Rio']),
    500: question('The Acropolis is located in which city?', 'Athens'),
    1000: question('Neuschwanstein Castle is located in which country?', 'Germany')
  }),
  category('Maps & Nature', {
    100: question('Which direction is opposite north?', 'South'),
    200: question('Brazil is located on which continent?', ['South America', 'South American continent']),
    300: question('Which ocean lies between the Americas and Europe?', ['Atlantic Ocean', 'Atlantic']),
    400: question('What is the name of the line at 0 degrees longitude?', ['Prime Meridian', 'Greenwich Meridian']),
    500: question('Which river flows through London?', ['River Thames', 'Thames', 'Thames River']),
    1000: question('What is the smallest continent by land area?', 'Australia')
  })
];

export const historyGeography3Pack = buildPack({
  id: 'history-geography-3',
  title: 'History & Geography 3',
  theme: 'Familiar history, countries, capitals, landmarks, maps, and famous people',
  description: 'An intentionally easier third history and geography pack. The questions stay broad and recognizable, including the high-value clues.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  accentColor: '#8dd7ff'
}, categories);
