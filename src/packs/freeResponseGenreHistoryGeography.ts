import { buildPack, category, question } from './buildPack';

const categories = [
  category('U.S. History', {
    100: question('What was the first permanent English settlement in what became the United States?', ['Jamestown']),
    200: question('In what year did the Boston Tea Party take place?', ['1773']),
    300: question('Which U.S. secretary of state negotiated the purchase of Alaska from Russia in 1867?', ['William H. Seward', 'William Seward', 'Seward']),
    400: question('Which 1863 battle is often described as a turning point of the American Civil War?', ['Battle of Gettysburg', 'Gettysburg']),
    500: question('In which city was the U.S. Constitution drafted in 1787?', ['Philadelphia']),
    1000: question('Which U.S. president was assassinated at the Pan-American Exposition in Buffalo in 1901?', ['William McKinley', 'McKinley'])
  }),
  category('World History', {
    100: question('Which Paris prison was stormed at the start of the French Revolution?', ['Bastille', 'The Bastille']),
    200: question('Which Roman emperor ruled during the Great Fire of Rome in 64 CE?', ['Nero']),
    300: question('Who led the Soviet Union during the Cuban Missile Crisis?', ['Nikita Khrushchev', 'Khrushchev']),
    400: question('What empire used Constantinople as its capital for most of the Middle Ages?', ['Byzantine Empire', 'The Byzantine Empire']),
    500: question('What peace settlement ended the Thirty Years’ War in 1648?', ['Peace of Westphalia', 'Westphalia']),
    1000: question('Which revolutionary leader became the best-known commander of the Haitian Revolution before independence?', ['Toussaint Louverture', 'Toussaint L’Ouverture', 'Louverture'])
  }),
  category('Ancient World', {
    100: question('What writing material made from a river plant was widely used in ancient Egypt?', ['Papyrus']),
    200: question('Which Greek god ruled the sea?', ['Poseidon']),
    300: question('What Roman road connecting Rome to southern Italy is also known as the Appian Way?', ['Via Appia', 'Appian Way']),
    400: question('Which ancient Mediterranean people are especially associated with spreading an alphabet that influenced Greek writing?', ['Phoenicians', 'The Phoenicians']),
    500: question('On which island was the Minoan palace of Knossos located?', ['Crete']),
    1000: question('What ancient Assyrian city on the Tigris became one of the empire’s great capitals?', ['Nineveh'])
  }),
  category('U.S. Geography', {
    100: question('Which U.S. state is home to the Apostle Islands in Lake Superior?', ['Wisconsin']),
    200: question('In which state are the Everglades located?', ['Florida']),
    300: question('Which U.S. city is famous for the Gateway Arch?', ['St. Louis', 'Saint Louis']),
    400: question('Which U.S. state is home to the San Juan Islands?', ['Washington', 'Washington state']),
    500: question('What is the highest mountain peak in the United States?', ['Denali', 'Mount Denali']),
    1000: question('The Okefenokee Swamp lies primarily in which U.S. state?', ['Georgia'])
  }),
  category('World Geography', {
    100: question('Which country occupies most of the Scandinavian Peninsula?', ['Sweden']),
    200: question('What sea separates northeastern Africa from the Arabian Peninsula?', ['Red Sea', 'The Red Sea']),
    300: question('Lake Bled, known for its island church and Alpine setting, is in which country?', ['Slovenia']),
    400: question('Which country contains the Atacama Desert?', ['Chile']),
    500: question('Which strait separates Spain from Morocco?', ['Strait of Gibraltar', 'Gibraltar Strait']),
    1000: question('Which country has the exclave of Kaliningrad on the Baltic Sea?', ['Russia', 'Russian Federation'])
  }),
  category('Cities & Landmarks', {
    100: question('In which U.S. city is the Cloud Gate sculpture nicknamed “The Bean”?', ['Chicago']),
    200: question('The Atomium landmark is located in which European capital?', ['Brussels']),
    300: question('In which city would you find the Burj Khalifa?', ['Dubai']),
    400: question('In which Spanish city is the Sagrada Família located?', ['Barcelona']),
    500: question('Which South African city sits below Table Mountain?', ['Cape Town']),
    1000: question('In which city is the Potala Palace located?', ['Lhasa'])
  })
];

export const freeResponseGenreHistoryGeographyPack = buildPack({
  id: 'free-response-history-geography',
  title: 'Free Response: History & Geography',
  theme: 'U.S. and world history, ancient civilizations, maps, cities, and landmarks',
  description: 'A history-and-geography all-play pack with new facts separate from the Classic versions.',
  difficulty: 'mixed',
  approximateMinutes: 30,
  supportedGameModes: ['free-response'],
  accentColor: '#86d7ff'
}, categories);
