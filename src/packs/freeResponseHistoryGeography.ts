import { buildPack, category, question } from './buildPack';

const categories = [
  category('Easy U.S. History', {
    100: question('Who wrote the Declaration of Independence?', ['Thomas Jefferson', 'Jefferson']),
    200: question('Which U.S. president appears on the one-dollar bill?', ['George Washington', 'Washington']),
    300: question('Which war was fought between the Union and Confederacy?', ['American Civil War', 'Civil War']),
    400: question('What famous ship carried the Pilgrims to North America in 1620?', ['Mayflower', 'The Mayflower']),
    500: question('Which U.S. president issued the Emancipation Proclamation?', ['Abraham Lincoln', 'Lincoln']),
    1000: question('Which American city hosted the Constitutional Convention of 1787?', ['Philadelphia'])
  }),
  category('Easy World History', {
    100: question('Which ancient civilization built the Colosseum?', ['Romans', 'Roman Empire', 'Ancient Rome']),
    200: question('Who was the British prime minister for most of World War II?', ['Winston Churchill', 'Churchill']),
    300: question('Which country was ruled by the pharaohs?', ['Egypt', 'Ancient Egypt']),
    400: question('Which empire used roads and messengers to govern much of South America before the Spanish conquest?', ['Inca Empire', 'Inca', 'Incas']),
    500: question('Which European city was divided by a wall from 1961 to 1989?', ['Berlin']),
    1000: question('Which ruler was crowned Emperor of the French in 1804?', ['Napoleon Bonaparte', 'Napoleon'])
  }),
  category('Capitals', {
    100: question('What is the capital of the United Kingdom?', ['London']),
    200: question('What is the capital of Italy?', ['Rome']),
    300: question('What is the capital of Spain?', ['Madrid']),
    400: question('What is the capital of South Korea?', ['Seoul']),
    500: question('What is the capital of Argentina?', ['Buenos Aires']),
    1000: question('What is the capital of New Zealand?', ['Wellington'])
  }),
  category('U.S. Geography', {
    100: question('Which U.S. state is shaped like a mitten?', ['Michigan']),
    200: question('Which U.S. state is home to Las Vegas?', ['Nevada']),
    300: question('Which river forms much of the border between Texas and Mexico?', ['Rio Grande', 'The Rio Grande']),
    400: question('Which U.S. state contains Mount Rushmore?', ['South Dakota']),
    500: question('Which Great Lake is entirely within the United States?', ['Lake Michigan']),
    1000: question('Which U.S. state has the longest coastline?', ['Alaska'])
  }),
  category('World Geography', {
    100: question('Which continent contains Brazil?', ['South America']),
    200: question('Which country is directly north of the United States?', ['Canada']),
    300: question('Which country contains the city of Barcelona?', ['Spain']),
    400: question('Which African country contains the city of Cairo?', ['Egypt']),
    500: question('Which country is home to the city of Istanbul?', ['Turkey', 'Türkiye']),
    1000: question('Which country has the most natural lakes in the world?', ['Canada'])
  }),
  category('Landmarks', {
    100: question('In which city is the Statue of Liberty located?', ['New York City', 'New York']),
    200: question('Which country is home to the Leaning Tower of Pisa?', ['Italy']),
    300: question('Which U.S. city is home to the Golden Gate Bridge?', ['San Francisco']),
    400: question('Which country is home to the ancient city of Chichén Itzá?', ['Mexico']),
    500: question('Which city is home to the Sagrada Família basilica?', ['Barcelona']),
    1000: question('Which country is home to the rock fortress of Sigiriya?', ['Sri Lanka'])
  }),
  category('Maps & Nature', {
    100: question('What is the largest continent by population?', ['Asia']),
    200: question('What ocean lies between North America and Europe?', ['Atlantic Ocean', 'Atlantic']),
    300: question('What is the longest river in South America?', ['Amazon River', 'Amazon']),
    400: question('Which mountain range runs along the western edge of South America?', ['Andes', 'Andes Mountains']),
    500: question('What desert covers much of northern Africa?', ['Sahara', 'Sahara Desert']),
    1000: question('What strait separates Spain from Morocco?', ['Strait of Gibraltar', 'Gibraltar'])
  }),
  category('Historical People', {
    100: question('Who was the first woman to fly solo across the Atlantic Ocean?', ['Amelia Earhart', 'Earhart']),
    200: question('Who gave the “I Have a Dream” speech in 1963?', ['Martin Luther King Jr.', 'Martin Luther King', 'MLK']),
    300: question('Who was known as the Maid of Orléans?', ['Joan of Arc']),
    400: question('Which nurse became famous for her work during the Crimean War?', ['Florence Nightingale', 'Nightingale']),
    500: question('Which South African leader spent 27 years in prison before becoming president?', ['Nelson Mandela', 'Mandela']),
    1000: question('Which Haitian revolutionary leader was born into slavery and became a leading figure of the Haitian Revolution?', ['Toussaint Louverture', 'Toussaint L’Ouverture'])
  })
];

export const freeResponseHistoryGeographyPack = buildPack({
  id: 'free-response-history-geography',
  title: 'Free Response History & Geography',
  theme: 'Approachable history, capitals, maps, landmarks, and famous people',
  description: 'An easier history-and-geography pack tuned for fast simultaneous typed answers.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  supportedGameModes: ['free-response'],
  accentColor: '#9bdcff'
}, categories);
