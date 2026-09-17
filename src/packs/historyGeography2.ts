import { buildPack, category, question } from './buildPack';

const categories = [
  category('Revolutions & Independence', {
    100: question('Which country celebrates Bastille Day on July 14?', 'France'),
    200: question('Which 1773 protest involved colonists dumping tea into Boston Harbor?', 'Boston Tea Party'),
    300: question('Who led the Bolsheviks during the October Revolution of 1917?', ['Vladimir Lenin', 'Lenin']),
    400: question('Which Caribbean nation became independent in 1804 after a successful slave revolt?', 'Haiti'),
    500: question('What is the common name for the 1857 uprising in India against British East India Company rule?', ['Indian Rebellion of 1857', 'Indian Mutiny', 'Sepoy Mutiny', 'Sepoy Rebellion']),
    1000: question('Which South American leader known as “the Liberator” helped win independence for Venezuela, Colombia, Ecuador, Peru, and Bolivia?', ['Simón Bolívar', 'Simon Bolivar', 'Bolívar', 'Bolivar'])
  }),
  category('Empires & Dynasties', {
    100: question('Which empire was centered on Rome and controlled much of the Mediterranean world?', 'Roman Empire'),
    200: question('Which empire was founded by Genghis Khan?', 'Mongol Empire'),
    300: question('Which Chinese dynasty built most of the Great Wall sections that survive today?', ['Ming dynasty', 'Ming']),
    400: question('Mansa Musa ruled which West African empire?', ['Mali Empire', 'Empire of Mali', 'Mali']),
    500: question('Which dynasty ruled India when Shah Jahan commissioned the Taj Mahal?', ['Mughal Empire', 'Mughal dynasty', 'Mughals']),
    1000: question('Which ancient Persian empire was founded by Cyrus the Great?', ['Achaemenid Empire', 'Achaemenid Persian Empire', 'Achaemenid dynasty'])
  }),
  category('U.S. History II', {
    100: question('Which war was fought between the Union and the Confederacy?', ['American Civil War', 'Civil War', 'U.S. Civil War']),
    200: question('Which U.S. president issued the Emancipation Proclamation?', ['Abraham Lincoln', 'Lincoln']),
    300: question('Which constitutional amendment prohibited denying the vote on the basis of sex?', ['19th Amendment', 'Nineteenth Amendment']),
    400: question('Which scandal led Richard Nixon to resign the presidency in 1974?', ['Watergate', 'Watergate scandal']),
    500: question('Which 1954 Supreme Court case ruled racial segregation in public schools unconstitutional?', ['Brown v. Board of Education', 'Brown v Board of Education', 'Brown v. Board']),
    1000: question('Which 1948 executive order established equality of treatment and opportunity in the U.S. armed forces?', ['Executive Order 9981', 'EO 9981'])
  }),
  category('Capitals & Cities II', {
    100: question('What is the capital of Spain?', 'Madrid'),
    200: question('What is the capital of South Korea?', 'Seoul'),
    300: question('What is the capital of New Zealand?', 'Wellington'),
    400: question('What is the capital of Turkey?', 'Ankara'),
    500: question('What is the capital of Kazakhstan?', 'Astana'),
    1000: question('What is the legislative capital of Sri Lanka?', ['Sri Jayawardenepura Kotte', 'Sri Jayewardenepura Kotte', 'Kotte'])
  }),
  category('Rivers & Lakes', {
    100: question('Which river flows through Egypt before reaching the Mediterranean Sea?', ['Nile', 'Nile River']),
    200: question('Which Great Lake borders the city of Chicago?', ['Lake Michigan', 'Michigan']),
    300: question('Which river flows through Paris?', ['Seine', 'Seine River']),
    400: question('Which river forms much of the border between Texas and Mexico?', ['Rio Grande', 'Río Grande']),
    500: question('Which large lake is shared by Peru and Bolivia?', ['Lake Titicaca', 'Titicaca']),
    1000: question('Which river forms Victoria Falls on the border of Zambia and Zimbabwe?', ['Zambezi', 'Zambezi River'])
  }),
  category('Mountains, Deserts & Islands', {
    100: question('What is the largest hot desert in the world?', ['Sahara', 'Sahara Desert']),
    200: question('What is the largest island in the world when continents are excluded?', 'Greenland'),
    300: question('Which mountain range forms a natural border between France and Spain?', ['Pyrenees', 'Pyrenees Mountains']),
    400: question('Which desert covers parts of Botswana, Namibia, and South Africa?', ['Kalahari', 'Kalahari Desert']),
    500: question('What is the highest mountain in Africa?', ['Mount Kilimanjaro', 'Kilimanjaro']),
    1000: question('Which Atlantic island group includes Tenerife and Gran Canaria?', ['Canary Islands', 'Canaries'])
  }),
  category('Landmarks & Archaeology', {
    100: question('Which country gave the Statue of Liberty to the United States?', 'France'),
    200: question('In which city is the Colosseum located?', 'Rome'),
    300: question('In which country is Stonehenge located?', ['England', 'United Kingdom', 'UK']),
    400: question('Which civilization built the city of Chichén Itzá?', ['Maya', 'Mayan civilization', 'Maya civilization']),
    500: question('On which island are the famous moai statues located?', ['Easter Island', 'Rapa Nui']),
    1000: question('Which prehistoric site in modern Turkey is famous for massive carved stone pillars dating to the 10th millennium BCE?', ['Göbekli Tepe', 'Gobekli Tepe'])
  }),
  category('Flags & National Symbols', {
    100: question('Which country has a maple leaf on its national flag?', 'Canada'),
    200: question('Which country has a white flag with a red circle in the center?', 'Japan'),
    300: question('Which country has a blue Star of David on its national flag?', 'Israel'),
    400: question('Which country has a cedar tree in the center of its national flag?', 'Lebanon'),
    500: question('Which country has the world’s only national flag that is not quadrilateral?', 'Nepal'),
    1000: question('Which country has a white dragon holding jewels on its national flag?', 'Bhutan')
  })
];

export const historyGeography2Pack = buildPack({
  id: 'history-geography-2',
  title: 'History & Geography 2',
  theme: 'A fresh set of major events, places, empires, maps, landmarks, and world geography',
  description: 'A second 48-question history and geography pack with direct questions, a clear difficulty curve, and no repeated facts from the original set.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  accentColor: '#8dd7ff'
}, categories);
