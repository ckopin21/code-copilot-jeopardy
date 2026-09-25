import { buildPack, type CategoryData } from './buildPack';

const categories: CategoryData[] = [
  { name: 'Kitchen Basics', questions: [
    ['What kitchen appliance is used to keep food frozen?', 'Freezer'],
    ['What tool is commonly used to flip pancakes in a pan?', ['Spatula', 'Turner']],
    ['What cooking method uses hot water at about 212°F or 100°C?', 'Boiling'],
    ['What is the name of the board used as a surface for chopping food?', ['Cutting board', 'Chopping board']],
    ['Which knife is the common all-purpose large kitchen knife?', ['Chef’s knife', 'Chef knife']],
    ['What cooking technique briefly cooks food in boiling water and then cools it quickly in ice water?', 'Blanching']
  ]},
  { name: 'World Foods', questions: [
    ['Pizza is most strongly associated with which country?', 'Italy'],
    ['Tacos are most strongly associated with which country?', 'Mexico'],
    ['Sushi is most strongly associated with which country?', 'Japan'],
    ['Paella is a rice dish associated with which country?', 'Spain'],
    ['Pho is a noodle soup associated with which country?', 'Vietnam'],
    ['Pierogi are filled dumplings especially associated with which European country?', 'Poland']
  ]},
  { name: 'Baking', questions: [
    ['What ingredient makes bread dough rise when using a traditional fermentation method?', 'Yeast'],
    ['What sweet ingredient is commonly made by bees and used in baking?', 'Honey'],
    ['What does it mean to preheat an oven?', ['Heat it before cooking', 'Bring the oven to temperature before cooking']],
    ['Which ingredient is commonly used to help cakes rise and is activated by moisture and heat?', 'Baking powder'],
    ['What pastry-making term means cutting solid fat into flour until the mixture is crumbly?', ['Cutting in', 'Cut in']],
    ['What is a blind bake?', ['Baking a pie crust before adding the filling', 'Pre-baking a pie crust']]
  ]},
  { name: 'Fruits & Vegetables', questions: [
    ['What yellow fruit is commonly peeled before eating and grows in bunches?', 'Banana'],
    ['What vegetable is used to make traditional french fries?', 'Potato'],
    ['Which fruit has varieties called Granny Smith and Honeycrisp?', 'Apple'],
    ['Guacamole is primarily made from which fruit?', 'Avocado'],
    ['Which vegetable is the main ingredient in baba ganoush?', ['Eggplant', 'Aubergine']],
    ['Which fruit is traditionally used to give grenadine its name and flavor?', 'Pomegranate']
  ]},
  { name: 'U.S. Destinations', questions: [
    ['In which U.S. city would you find the Statue of Liberty?', ['New York City', 'New York']],
    ['The Grand Canyon is primarily located in which U.S. state?', 'Arizona'],
    ['Which U.S. city is famous for the French Quarter and Bourbon Street?', 'New Orleans'],
    ['Yellowstone became the first U.S. national park and is mostly located in which state?', 'Wyoming'],
    ['Which U.S. city is home to the Space Needle?', 'Seattle'],
    ['Which national park is famous for Half Dome and El Capitan?', ['Yosemite National Park', 'Yosemite']]
  ]},
  { name: 'Europe', questions: [
    ['Which city is home to Big Ben and the Houses of Parliament?', 'London'],
    ['Which country is shaped like a boot on many maps?', 'Italy'],
    ['In which city would you find the Colosseum?', 'Rome'],
    ['Which European city is famous for canals and gondolas?', 'Venice'],
    ['Which European country contains the region of Transylvania?', 'Romania'],
    ['Which major river flows through Budapest?', ['Danube', 'Danube River']]
  ]},
  { name: 'Asia & Pacific', questions: [
    ['Which country is home to the city of Tokyo?', 'Japan'],
    ['Which Australian city is famous for an opera house with sail-like roofs?', 'Sydney'],
    ['Which country is home to the Taj Mahal?', 'India'],
    ['Which Southeast Asian city-state is also an independent country?', 'Singapore'],
    ['Which Indonesian island is famous as a major tropical travel destination and is home to Denpasar?', 'Bali'],
    ['Which New Zealand city is the country’s capital?', 'Wellington']
  ]},
  { name: 'Travel Terms', questions: [
    ['What document is normally required for international travel and proves your identity and citizenship?', 'Passport'],
    ['What is a nonstop flight?', ['A flight with no stops', 'A flight that does not stop before its destination']],
    ['What does a round-trip ticket include?', ['Travel to a destination and back', 'An outbound and return trip']],
    ['What is a layover?', ['A stop between flights', 'Time between connecting flights']],
    ['What does “carry-on” mean when talking about luggage?', ['A bag you take into the airplane cabin', 'Cabin luggage']],
    ['What is a “red-eye” flight?', ['An overnight flight', 'A flight that travels overnight']]
  ]}
];

export const foodTravelPack = buildPack({
  id: 'food-travel',
  title: 'Food & Travel',
  theme: 'Cooking, world foods, destinations, and travel know-how',
  description: 'Approachable food and travel trivia built around things most people encounter, eat, see, or hear about.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  accentColor: '#ffba7a'
}, categories);
