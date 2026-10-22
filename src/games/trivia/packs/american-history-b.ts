import { buildPack, category, question } from './buildPack';

const categories = [
  category('Founding & Republic', {
    100: question('From which European kingdom did the American colonies declare independence?', ['Great Britain', 'Britain', 'Kingdom of Great Britain'], { factKey: 'american-independence-from-britain' }),
    200: question('Who commanded the Continental Army during the American Revolution?', ['George Washington', 'Washington'], { factKey: 'washington-continental-army-command' }),
    300: question('Which principle divides U.S. government power among its legislative, executive, and judicial branches?', 'Separation of powers', { factKey: 'separation-of-powers-three-branches' }),
    400: question('At what Virginia town did the British army under Cornwallis surrender in 1781?', 'Yorktown', { factKey: 'cornwallis-yorktown-surrender' }),
    500: question('Who wrote the pro-independence pamphlet Common Sense in 1776?', ['Thomas Paine', 'Paine'], { factKey: 'paine-common-sense-author' }),
    1000: question('What collection of 85 essays published under the name Publius argued for ratifying the U.S. Constitution?', ['Federalist Papers', 'The Federalist'], { factKey: 'federalist-papers-ratification-essays' })
  }),
  category('Presidents', {
    100: question('Which U.S. president, in office for most of the 1980s, had previously been a Hollywood actor?', ['Ronald Reagan', 'Reagan'], { factKey: 'reagan-actor-president-1980s' }),
    200: question('Who became the first African American elected U.S. president in 2008?', ['Barack Obama', 'Obama'], { factKey: 'obama-first-black-president-election' }),
    300: question('Which U.S. president proposed the Fourteen Points peace plan in 1918?', ['Woodrow Wilson', 'Wilson'], { factKey: 'wilson-fourteen-points' }),
    400: question('Which victorious Union general later became the 18th U.S. president?', ['Ulysses S. Grant', 'Ulysses Grant', 'Grant'], { factKey: 'grant-eighteenth-president' }),
    500: question('Which man served as both the 22nd and the 24th U.S. president?', ['Grover Cleveland', 'Cleveland'], { factKey: 'cleveland-twenty-second-twenty-fourth' }),
    1000: question('Which president warned about the military-industrial complex in his 1961 farewell address?', ['Dwight D. Eisenhower', 'Dwight Eisenhower', 'Eisenhower'], { factKey: 'eisenhower-farewell-industrial-complex' })
  }),
  category('Civil War & Slavery', {
    100: question('In which decade did the American Civil War take place?', ['1860s', 'The 1860s', 'Eighteen sixties'], { factKey: 'american-civil-war-decade' }),
    200: question('Which abolitionist escaped slavery and published the newspaper The North Star?', ['Frederick Douglass', 'Douglass'], { factKey: 'douglass-north-star-newspaper' }),
    300: question('Who was president of the Confederacy during the Civil War?', ['Jefferson Davis', 'Davis'], { factKey: 'jefferson-davis-confederate-president' }),
    400: question('Which fort in Charleston Harbor was attacked in April 1861, beginning the Civil War?', 'Fort Sumter', { factKey: 'fort-sumter-war-opening' }),
    500: question('In what year did the main Confederate armies surrender, ending the fighting in the Civil War?', '1865', { factKey: 'confederate-armies-surrender-year' }),
    1000: question('Which 1854 law let settlers in two new territories vote on whether to allow slavery?', ['Kansas-Nebraska Act', 'Kansas-Nebraska Act of 1854'], { factKey: 'kansas-nebraska-popular-sovereignty' })
  }),
  category('Rights & Reform', {
    100: question('Which civil rights leader was assassinated in Memphis in 1968?', ['Martin Luther King Jr.', 'Martin Luther King', 'MLK', 'MLK Jr.'], { factKey: 'king-memphis-assassination' }),
    200: question('What word means the right to vote, as in the movement to win voting rights for women?', 'Suffrage', { factKey: 'suffrage-definition-vote' }),
    300: question('Which 1965 law targeted racial discrimination in voting, including literacy tests?', ['Voting Rights Act', 'Voting Rights Act of 1965', '1965 Voting Rights Act'], { factKey: 'voting-rights-act-literacy-tests' }),
    400: question('In which Arkansas city did nine Black students integrate Central High School in 1957?', 'Little Rock', { factKey: 'little-rock-nine-central-high' }),
    500: question('Which constitutional amendment banned poll taxes in federal elections?', ['24th Amendment', 'Twenty-fourth Amendment', '24th', 'Twenty-fourth'], { factKey: 'twenty-fourth-amendment-poll-tax' }),
    1000: question('Which author of The Souls of Black Folk helped found the NAACP?', ['W. E. B. Du Bois', 'William Edward Burghardt Du Bois', 'Du Bois', 'WEB Du Bois'], { factKey: 'du-bois-souls-naacp' })
  }),
  category('Expansion & Innovation', {
    100: question('Which state joined the United States in 1845 after being an independent republic?', 'Texas', { factKey: 'texas-annexation-1845' }),
    200: question('What famous wagon trail carried settlers from Missouri to the Pacific Northwest in the 1800s?', 'Oregon Trail', { factKey: 'oregon-trail-missouri-northwest' }),
    300: question('What name is given to the forced removal of the Cherokee to Indian Territory in 1838-1839?', 'Trail of Tears', { factKey: 'cherokee-removal-trail-of-tears' }),
    400: question('Which country ceded Florida to the United States under an 1819 treaty?', 'Spain', { factKey: 'spain-florida-adams-onis-treaty' }),
    500: question('Which canal opened in 1825, linking the Hudson River to the Great Lakes?', 'Erie Canal', { factKey: 'erie-canal-hudson-great-lakes' }),
    1000: question('Which 1830 law authorized land-exchange treaties used to force Native nations west of the Mississippi?', ['Indian Removal Act', 'Indian Removal Act of 1830'], { factKey: 'indian-removal-act-1830' })
  }),
  category('20th-Century Turning Points', {
    100: question('What U.S. civilian space agency was established in 1958?', ['NASA', 'National Aeronautics and Space Administration'], { factKey: 'nasa-established-1958' }),
    200: question('Which world war did the United States enter in April 1917?', ['World War I', 'First World War', 'WWI', 'World War One', 'WW1'], { factKey: 'us-wwi-entry-1917' }),
    300: question('What name describes the drought and severe dust storms on the Great Plains in the 1930s?', 'Dust Bowl', { factKey: 'dust-bowl-great-plains' }),
    400: question('On which Caribbean island did the Soviet Union place missiles that triggered a 1962 crisis?', 'Cuba', { factKey: 'cuba-soviet-missiles-location' }),
    500: question('What war began in 1950 when forces from the northern half of a divided Asian peninsula invaded the southern half?', 'Korean War', { factKey: 'korean-war-1950-invasion' }),
    1000: question('What popular name is given to the 1944 law that helped veterans pay for college and buy homes?', ['GI Bill', 'G.I. Bill', "Servicemen's Readjustment Act", "Servicemen's Readjustment Act of 1944"], { factKey: 'gi-bill-1944-benefits' })
  }),
  category('Culture & Milestones', {
    100: question('What is the title of the U.S. national anthem?', ['The Star-Spangled Banner', 'Star-Spangled Banner'], { factKey: 'us-national-anthem-title' }),
    200: question('Which music genre emerged in New Orleans around the turn of the 20th century?', 'Jazz', { factKey: 'jazz-new-orleans-origins' }),
    300: question('What is the name of the 1920-1933 era when the United States banned the manufacture and sale of alcoholic drinks?', 'Prohibition', { factKey: 'prohibition-1920-1933' }),
    400: question('What is the name of the flourishing of Black arts and literature centered in a New York neighborhood during the 1920s?', 'Harlem Renaissance', { factKey: 'harlem-renaissance-arts' }),
    500: question('Which famous music festival took place near Bethel, New York, in August 1969?', ['Woodstock', 'Woodstock festival', 'Woodstock Music and Art Fair'], { factKey: 'woodstock-1969-bethel' }),
    1000: question('What New York garment-factory fire in 1911 helped spur workplace safety reforms?', ['Triangle Shirtwaist Factory fire', 'Triangle Shirtwaist fire', 'Triangle factory fire', 'Triangle fire'], { factKey: 'triangle-shirtwaist-fire-reforms' })
  })
];

export const americanHistoryBPack = buildPack({
  id: 'american-history-b',
  title: 'American History: Version B',
  theme: 'Founding, presidents, Civil War, rights, expansion, and cultural milestones',
  description: '42 questions for an international teen challenge. A mix of familiar facts and U.S. classroom history; matched to Version A with different questions.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  accentColor: '#8dd7ff',
  categoryOrder: categories.map((item) => item.name)
}, categories);
