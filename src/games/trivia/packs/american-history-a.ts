import { buildPack, category, question } from './buildPack';

const categories = [
  category('Founding & Republic', {
    100: question('How many colonies declared independence to form the United States?', ['13', 'Thirteen'], { factKey: 'us-original-colonies-count' }),
    200: question('Who was the principal writer of the Declaration of Independence?', ['Thomas Jefferson', 'Jefferson'], { factKey: 'declaration-principal-writer' }),
    300: question('What collective name is given to the first ten amendments to the U.S. Constitution?', 'Bill of Rights', { factKey: 'bill-of-rights-first-ten' }),
    400: question('Which American victory in 1777 helped persuade France to enter a formal alliance with the United States?', ['Saratoga', 'Battle of Saratoga', 'Battles of Saratoga'], { factKey: 'saratoga-french-alliance' }),
    500: question('What was the first national constitution of the United States, before the current Constitution?', 'Articles of Confederation', { factKey: 'first-us-national-constitution' }),
    1000: question('Which 1787 compromise gave states equal Senate representation and House seats based on population?', ['Great Compromise', 'Connecticut Compromise', 'Sherman Compromise'], { factKey: 'great-compromise-representation' })
  }),
  category('Presidents', {
    100: question("Which U.S. president was assassinated at Ford's Theatre?", ['Abraham Lincoln', 'Lincoln'], { factKey: 'lincoln-fords-theatre' }),
    200: question('Who was U.S. president during the 1962 missile crisis?', ['John F. Kennedy', 'John Kennedy', 'Kennedy', 'JFK'], { factKey: 'kennedy-1962-missile-crisis' }),
    300: question('Which U.S. president won four presidential elections?', ['Franklin D. Roosevelt', 'Franklin Roosevelt', 'FDR'], { factKey: 'fdr-four-elections' }),
    400: question('Which Roosevelt was president when the United States began building the Panama Canal?', ['Theodore Roosevelt', 'Teddy Roosevelt'], { factKey: 'theodore-roosevelt-panama-construction' }),
    500: question('Who was U.S. president during the War of 1812?', ['James Madison', 'Madison'], { factKey: 'madison-war-of-1812-president' }),
    1000: question('Which president announced an 1823 policy opposing new European colonization in the Americas?', ['James Monroe', 'Monroe'], { factKey: 'monroe-1823-policy' })
  }),
  category('Civil War & Slavery', {
    100: question('What secret network helped enslaved people escape to freedom before the Civil War?', 'Underground Railroad', { factKey: 'underground-railroad-purpose' }),
    200: question('What was the main cash crop grown on Southern plantations using enslaved labor before the Civil War?', 'Cotton', { factKey: 'cotton-southern-plantation-crop' }),
    300: question('Which Confederate general surrendered the Army of Northern Virginia at Appomattox Court House?', ['Robert E. Lee', 'Robert Lee', 'Lee'], { factKey: 'lee-appomattox-surrender' }),
    400: question('Which state was the first to secede from the Union in 1860?', 'South Carolina', { factKey: 'south-carolina-first-secession' }),
    500: question('What is the name of the period of rebuilding and political change after the Civil War?', ['Reconstruction', 'Reconstruction era'], { factKey: 'reconstruction-postwar-period' }),
    1000: question('What July 1861 battle is usually called the first major land battle of the Civil War?', ['First Battle of Bull Run', 'First Bull Run', 'Bull Run', 'First Battle of Manassas', 'First Manassas', 'Manassas'], { factKey: 'first-bull-run-major-land-battle' })
  }),
  category('Rights & Reform', {
    100: question('Whose refusal to give up her bus seat in 1955 helped launch the Montgomery bus boycott?', ['Rosa Parks', 'Parks'], { factKey: 'rosa-parks-bus-boycott' }),
    200: question('What two-word name is used for laws that enforced racial segregation in the American South?', 'Jim Crow', { factKey: 'jim-crow-segregation-laws' }),
    300: question('Which landmark 1964 law banned racial discrimination in public accommodations such as hotels and restaurants?', ['Civil Rights Act of 1964', 'Civil Rights Act', '1964 Civil Rights Act'], { factKey: 'civil-rights-act-public-accommodations' }),
    400: question("In which New York town was the landmark 1848 women's rights convention held?", 'Seneca Falls', { factKey: 'seneca-falls-1848-convention' }),
    500: question('Which constitutional amendment prohibits denying voting rights because of race, color, or previous enslavement?', ['15th Amendment', 'Fifteenth Amendment', '15th', 'Fifteenth'], { factKey: 'fifteenth-amendment-race-voting' }),
    1000: question('Which Black journalist became a leading anti-lynching campaigner in the 1890s?', ['Ida B. Wells', 'Ida Wells', 'Ida B. Wells-Barnett', 'Ida Wells-Barnett'], { factKey: 'ida-wells-anti-lynching' })
  }),
  category('Expansion & Innovation', {
    100: question('Which state attracted the gold seekers known as the Forty-Niners?', 'California', { factKey: 'california-forty-niners' }),
    200: question('Which brothers made the first successful powered, controlled airplane flights in 1903?', ['Wright brothers', 'Orville and Wilbur Wright', 'Wilbur and Orville Wright'], { factKey: 'wright-1903-powered-flight' }),
    300: question('Which island in New York Harbor processed millions of immigrants from 1892 to 1954?', 'Ellis Island', { factKey: 'ellis-island-immigration-station' }),
    400: question('At what Utah site did the two lines of the first transcontinental railroad meet in 1869?', ['Promontory Summit', 'Promontory'], { factKey: 'promontory-summit-railroad' }),
    500: question('Which 1862 law offered settlers 160 acres of public land if they met residence and improvement requirements?', ['Homestead Act', 'Homestead Act of 1862'], { factKey: 'homestead-act-160-acres' }),
    1000: question('What two-word phrase described the 1800s belief that U.S. expansion across the continent was destined?', 'Manifest Destiny', { factKey: 'manifest-destiny-expansion-belief' })
  }),
  category('20th-Century Turning Points', {
    100: question('Who became the first person to walk on the Moon?', ['Neil Armstrong', 'Armstrong'], { factKey: 'armstrong-first-moonwalk' }),
    200: question('Which U.S. naval base in Hawaii was attacked on December 7, 1941?', 'Pearl Harbor', { factKey: 'pearl-harbor-1941-attack' }),
    300: question('What name is given to the severe economic downturn that began in 1929?', 'Great Depression', { factKey: 'great-depression-downturn' }),
    400: question('What is the usual name for the decades of rivalry between the United States and the Soviet Union after World War II?', 'Cold War', { factKey: 'cold-war-us-soviet-rivalry' }),
    500: question('What was the code name of the U.S.-led World War II program that developed atomic bombs?', 'Manhattan Project', { factKey: 'manhattan-project-atomic-bombs' }),
    1000: question('What U.S. aid program, launched in 1948, helped rebuild European economies after World War II?', ['Marshall Plan', 'European Recovery Program'], { factKey: 'marshall-plan-european-recovery' })
  }),
  category('Culture & Milestones', {
    100: question('What New York Harbor monument was dedicated in 1886 and depicts a woman holding a torch?', 'Statue of Liberty', { factKey: 'statue-liberty-torch-monument' }),
    200: question('Which holiday commemorates news of emancipation reaching enslaved people in Galveston on June 19?', 'Juneteenth', { factKey: 'juneteenth-galveston-emancipation' }),
    300: question('What was the name of the affordable Ford car introduced in 1908?', ['Model T', 'Ford Model T'], { factKey: 'ford-model-t-1908' }),
    400: question('Who broke modern Major League Baseball\'s color barrier with the Brooklyn Dodgers in 1947?', ['Jackie Robinson', 'Robinson'], { factKey: 'jackie-robinson-1947-dodgers' }),
    500: question('Who completed the first solo nonstop airplane flight across the Atlantic in 1927?', ['Charles Lindbergh', 'Lindbergh'], { factKey: 'lindbergh-1927-solo-atlantic' }),
    1000: question('Which park became the first U.S. national park in 1872?', ['Yellowstone', 'Yellowstone National Park'], { factKey: 'yellowstone-first-national-park' })
  })
];

export const americanHistoryAPack = buildPack({
  id: 'american-history-a',
  title: 'American History: Version A',
  theme: 'Founding, presidents, Civil War, rights, expansion, and cultural milestones',
  description: '42 questions for an international teen challenge. A mix of familiar facts and U.S. classroom history; matched to Version B with different questions.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  accentColor: '#8dd7ff',
  categoryOrder: categories.map((item) => item.name)
}, categories);
