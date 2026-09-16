import { buildPack, type CategoryData } from './buildPack';

const categories: CategoryData[] = [
  { name: 'U.S. History', questions: [
    ['Who was the first president of the United States?', 'George Washington'],
    ['In what year was the U.S. Declaration of Independence adopted?', '1776'],
    ['The United States bought the Louisiana Territory from which country?', 'France'],
    ['Which constitutional amendment abolished slavery in the United States?', ['13th Amendment', 'Thirteenth Amendment']],
    ['Which 1803 Supreme Court case established judicial review?', 'Marbury v. Madison'],
    ['Which U.S. president signed the Interstate Highway Act of 1956?', ['Dwight D. Eisenhower', 'Dwight Eisenhower', 'Eisenhower']]
  ]},
  { name: 'World History', questions: [
    ['In what year did the Berlin Wall fall?', '1989'],
    ['The Magna Carta was first issued in which country?', 'England'],
    ['The Renaissance began in which modern-day country?', 'Italy'],
    ['Which treaty imposed peace terms on Germany after World War I?', ['Treaty of Versailles', 'Versailles Treaty']],
    ['The Meiji Restoration transformed which country in the 1800s?', 'Japan'],
    ['Who became the first emperor of a unified China in 221 BCE?', ['Qin Shi Huang', 'Qin Shihuang']]
  ]},
  { name: 'Ancient World', questions: [
    ['Which ancient civilization built the pyramids at Giza?', ['Ancient Egyptians', 'Egyptians', 'Ancient Egypt']],
    ['According to legend, which brother founded the city of Rome?', 'Romulus'],
    ['Which Greek city-state was famous for its military culture?', 'Sparta'],
    ['Which volcano buried Pompeii in 79 CE?', ['Mount Vesuvius', 'Vesuvius']],
    ['The Rosetta Stone helped scholars decipher which ancient writing system?', ['Egyptian hieroglyphs', 'hieroglyphs']],
    ['Hammurabi was a famous king of which ancient city-state?', 'Babylon']
  ]},
  { name: 'Capitals & Cities', questions: [
    ['What is the capital of France?', 'Paris'],
    ['What is the capital of Japan?', 'Tokyo'],
    ['What is the capital of Australia?', 'Canberra'],
    ['What is the capital of Canada?', 'Ottawa'],
    ['What is the capital of Brazil?', ['Brasilia', 'Brasília']],
    ['What is the capital of Morocco?', 'Rabat']
  ]},
  { name: 'Maps & Borders', questions: [
    ['Which is the largest continent by land area?', 'Asia'],
    ['What imaginary line divides Earth into Northern and Southern Hemispheres?', 'Equator'],
    ['Which country shares the longest southern land border with the contiguous United States?', 'Mexico'],
    ['Spain and Portugal occupy most of which peninsula?', 'Iberian Peninsula'],
    ['Which country completely surrounds the nation of Lesotho?', 'South Africa'],
    ['Which two countries share the world’s longest international land border?', ['Canada and the United States', 'United States and Canada', 'Canada and US', 'US and Canada']]
  ]},
  { name: 'Famous Places', questions: [
    ['In which city would you find the Eiffel Tower?', 'Paris'],
    ['The Great Wall is located in which country?', 'China'],
    ['Machu Picchu is located in which South American country?', 'Peru'],
    ['The ancient rock-cut city of Petra is in which country?', 'Jordan'],
    ['Angkor Wat is located in which country?', 'Cambodia'],
    ['The Alhambra palace complex is in which country?', 'Spain']
  ]},
  { name: 'Explorers & Journeys', questions: [
    ['Which Apollo mission first landed humans on the Moon?', 'Apollo 11'],
    ['Which explorer sailed west across the Atlantic in 1492 on behalf of Spain?', ['Christopher Columbus', 'Columbus']],
    ['Whose expedition completed the first circumnavigation of Earth?', ['Ferdinand Magellan', 'Magellan']],
    ['Which pair led the U.S. expedition across the Louisiana Purchase to the Pacific?', ['Lewis and Clark', 'Meriwether Lewis and William Clark']],
    ['Which Venetian traveler wrote about journeys through Asia in the 1200s?', 'Marco Polo'],
    ['Who led the first expedition confirmed to reach the South Pole?', ['Roald Amundsen', 'Amundsen']]
  ]},
  { name: 'Geography Basics', questions: [
    ['Which is the largest ocean on Earth?', 'Pacific Ocean'],
    ['What is the highest mountain above sea level?', ['Mount Everest', 'Everest']],
    ['On which continent is the Sahara Desert located?', 'Africa'],
    ['The Danube River empties into which sea?', 'Black Sea'],
    ['The Great Barrier Reef lies off the coast of which country?', 'Australia'],
    ['Which mountain range is commonly used as part of the boundary between Europe and Asia?', ['Ural Mountains', 'Urals']]
  ]}
];

export const historyGeographyPack = buildPack({
  id: 'history-geography',
  title: 'History & Geography',
  theme: 'Major events, places, maps, civilizations, and journeys',
  description: 'Broad history and geography with recognizable facts that get steadily more challenging without becoming specialist trivia.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  accentColor: '#8dd7ff'
}, categories);
