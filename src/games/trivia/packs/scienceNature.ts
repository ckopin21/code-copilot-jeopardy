import { buildPack, type CategoryData } from './buildPack';

const categories: CategoryData[] = [
  { name: 'Biology', questions: [
    ['What molecule carries most genetic instructions in living organisms?', 'DNA'],
    ['What organelle is often called the powerhouse of the cell?', ['mitochondrion', 'mitochondria']],
    ['What process do plants use to convert light energy into chemical energy?', 'photosynthesis'],
    ['What type of cell division produces two genetically identical daughter cells?', 'mitosis'],
    ['What term describes an organism that makes its own food from inorganic substances?', ['autotroph', 'producer']],
    ['What is the scientific study of fungi called?', 'mycology']
  ]},
  { name: 'Chemistry', questions: [
    ['What is the chemical symbol for gold?', 'Au'],
    ['What is the pH of a neutral aqueous solution at about room temperature?', '7'],
    ['Which element has atomic number 6?', 'carbon'],
    ['What type of bond involves the sharing of electron pairs between atoms?', 'covalent bond'],
    ['What is the most abundant gas in Earth’s atmosphere?', 'nitrogen'],
    ['What common name is given to Group 18 elements such as helium, neon, and argon?', ['noble gases', 'noble gas']]
  ]},
  { name: 'Physics', questions: [
    ['What force pulls objects toward Earth?', 'gravity'],
    ['What is the SI unit of force?', 'newton'],
    ['What is the approximate speed of light in a vacuum in kilometers per second?', ['300000', '300,000 km/s', '299792 km/s']],
    ['Which law states that for every action there is an equal and opposite reaction?', ["Newton’s third law", 'Newton third law']],
    ['What quantity is measured in joules?', ['energy', 'work']],
    ['What phenomenon causes light to bend when it passes between materials with different refractive indices?', 'refraction']
  ]},
  { name: 'Astronomy', questions: [
    ['What planet is closest to the Sun?', 'Mercury'],
    ['What is the name of Earth’s galaxy?', ['Milky Way', 'the Milky Way']],
    ['Which planet is known for its prominent ring system?', 'Saturn'],
    ['What type of star is the Sun?', ['G-type main-sequence star', 'G-type star', 'yellow dwarf']],
    ['What is the boundary around a black hole beyond which light cannot escape called?', 'event horizon'],
    ['What is the name of the nearest large galaxy to the Milky Way?', ['Andromeda Galaxy', 'Andromeda']]
  ]},
  { name: 'Earth Science', questions: [
    ['What is the outermost solid layer of Earth called?', 'crust'],
    ['What type of rock forms when magma or lava cools and solidifies?', 'igneous rock'],
    ['What scale is now commonly used to express earthquake magnitude, replacing the original Richter scale for large earthquakes?', ['moment magnitude scale', 'moment magnitude']],
    ['What is the process by which water vapor changes into liquid water?', 'condensation'],
    ['What layer of Earth lies between the crust and the core?', 'mantle'],
    ['What supercontinent existed roughly 300 million years ago?', ['Pangaea', 'Pangea']]
  ]},
  { name: 'Animals', questions: [
    ['What is the largest living animal?', ['blue whale', 'the blue whale']],
    ['How many legs does an insect have?', '6'],
    ['What is a group of lions called?', 'pride'],
    ['Which mammal is capable of true sustained flight?', ['bat', 'bats']],
    ['What is the fastest land animal?', 'cheetah'],
    ['What mammal is covered in large protective keratin scales?', ['pangolin', 'pangolins']]
  ]},
  { name: 'Weather', questions: [
    ['What instrument measures air pressure?', 'barometer'],
    ['What is rotating tropical storm called once sustained winds reach hurricane strength in the Atlantic?', 'hurricane'],
    ['What cloud type is commonly associated with thunderstorms?', 'cumulonimbus'],
    ['What scale rates tornado intensity in the United States based on damage indicators?', ['Enhanced Fujita scale', 'EF scale']],
    ['What term describes the amount of water vapor in the air?', 'humidity'],
    ['What atmospheric phenomenon occurs when a layer of warm air traps cooler air near the ground?', ['temperature inversion', 'thermal inversion', 'inversion']]
  ]},
  { name: 'Human Body', questions: [
    ['Which organ pumps blood through the body?', 'heart'],
    ['How many chambers does a normal human heart have?', '4'],
    ['Which organ produces insulin?', 'pancreas'],
    ['What is the largest organ of the human body?', 'skin'],
    ['What part of the brain is strongly involved in balance and coordination?', 'cerebellum'],
    ['Which blood type is commonly called the universal donor for red blood cells?', ['O negative', 'O-', 'O minus']]
  ]},
  { name: 'Ecology', questions: [
    ['What term describes all the organisms and physical environment interacting in an area?', 'ecosystem'],
    ['What do we call a species that has a disproportionately large effect on its ecosystem relative to its abundance?', 'keystone species'],
    ['What process converts atmospheric nitrogen into biologically usable compounds?', 'nitrogen fixation'],
    ['What ecological relationship benefits both participating species?', 'mutualism'],
    ['What is the gradual process of change in an ecological community over time called?', 'ecological succession'],
    ['What term describes the maximum population size an environment can sustainably support?', 'carrying capacity']
  ]},
  { name: 'Scientific Milestones', questions: [
    ['Who developed the theory of general relativity?', 'Albert Einstein'],
    ['Who is credited with discovering penicillin?', 'Alexander Fleming'],
    ['Which scientist formulated the laws of planetary motion?', 'Johannes Kepler'],
    ['Who proposed natural selection as a mechanism of evolution in On the Origin of Species?', 'Charles Darwin'],
    ['Which scientist’s X-ray diffraction work was crucial to determining DNA’s structure?', 'Rosalind Franklin'],
    ['Who first published a periodic table that successfully predicted properties of undiscovered elements?', 'Dmitri Mendeleev']
  ]}
];

export const scienceNaturePack = buildPack({
  id: 'science-nature',
  title: 'Science & Nature',
  theme: 'Biology, chemistry, physics, space, Earth, and life',
  description: 'A mixed-difficulty science pack covering foundational concepts and tougher general-knowledge facts.',
  difficulty: 'mixed',
  approximateMinutes: 35
}, categories);
