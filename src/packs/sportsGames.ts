import { buildPack, type CategoryData } from './buildPack';

const categories: CategoryData[] = [
  { name: 'Football', questions: [
    ['How many points is a touchdown worth before the extra point attempt?', '6'],
    ['What league plays the Super Bowl?', ['NFL', 'National Football League']],
    ['How many points is a successful field goal worth in American football?', '3'],
    ['What is it called when the quarterback is tackled behind the line of scrimmage before throwing?', 'Sack'],
    ['The Super Bowl trophy is named after which coach?', ['Vince Lombardi', 'Lombardi']],
    ['Which NFL team completed the 1972 season undefeated, including the playoffs?', ['Miami Dolphins', 'Dolphins']]
  ]},
  { name: 'Basketball', questions: [
    ['How many points is a normal basket worth when shot from inside the three-point line?', '2'],
    ['How many players from one team are normally on the court at a time in basketball?', '5'],
    ['How many seconds are on the NBA shot clock?', '24'],
    ['What violation is called when a player takes too many steps without dribbling?', ['Traveling', 'Travelling']],
    ['What is a triple-double?', ['Double digits in three statistical categories', '10 or more in three categories']],
    ['Which NBA team plays its home games at Madison Square Garden?', ['New York Knicks', 'Knicks']]
  ]},
  { name: 'Baseball', questions: [
    ['How many strikes make a strikeout in baseball?', '3'],
    ['How many bases are on a baseball diamond, including home plate?', '4'],
    ['How many outs does each team get in its half of an inning?', '3'],
    ['How many defensive outs are recorded in a nine-inning perfect game?', '27'],
    ['What award is given annually to the best pitchers in Major League Baseball?', ['Cy Young Award', 'Cy Young']],
    ['What is the term for a batter hitting a single, double, triple, and home run in the same game?', ['Hitting for the cycle', 'Cycle']]
  ]},
  { name: 'Soccer', questions: [
    ['How many players does each soccer team normally have on the field, including the goalkeeper?', '11'],
    ['How many points does a goal add to a team’s score in soccer?', '1'],
    ['What organization is the international governing body of soccer?', 'FIFA'],
    ['What color card is normally shown as a caution?', 'Yellow'],
    ['What is a hat trick in soccer?', ['Three goals by one player', '3 goals by one player']],
    ['How far is the penalty spot from the goal line?', ['12 yards', '12 yd']]
  ]},
  { name: 'Olympics', questions: [
    ['How often are the Summer Olympic Games normally held?', ['Every four years', '4 years']],
    ['How many rings are on the Olympic symbol?', '5'],
    ['Which city hosted the 2016 Summer Olympics?', ['Rio de Janeiro', 'Rio']],
    ['In which country is the Olympic flame traditionally lit?', 'Greece'],
    ['How many events make up a decathlon?', '10'],
    ['Which city hosted the first modern Olympic Games in 1896?', 'Athens']
  ]},
  { name: 'Tennis & Golf', questions: [
    ['What word means a score of zero in tennis?', 'Love'],
    ['What is one stroke under par on a golf hole called?', 'Birdie'],
    ['In tennis scoring, what comes after 30?', '40'],
    ['Which tennis tournament is played on grass in London?', 'Wimbledon'],
    ['What is two strokes under par on a golf hole called?', 'Eagle'],
    ['What is the maximum number of clubs a golfer may carry in a standard competitive round?', '14']
  ]},
  { name: 'Board & Card Games', questions: [
    ['Which chess piece must be protected from checkmate?', 'King'],
    ['How many sides does a standard six-sided die have?', '6'],
    ['In Monopoly, what color are Boardwalk and Park Place in the standard U.S. edition?', ['Dark blue', 'Blue']],
    ['What chess move allows the king and a rook to move at the same time?', 'Castling'],
    ['In a standard deck of cards, how many cards are in each suit?', '13'],
    ['In chess, what is it called when a player has no legal move but is not in check?', 'Stalemate']
  ]},
  { name: 'Video Games', questions: [
    ['What is the name of Mario’s brother?', 'Luigi'],
    ['Which yellow Pokémon is the best-known partner of Ash in the animated series and games?', 'Pikachu'],
    ['In Minecraft, which green hostile creature silently approaches players and explodes?', 'Creeper'],
    ['Which game series features the hero Link and the kingdom of Hyrule?', ['The Legend of Zelda', 'Zelda']],
    ['What company created the PlayStation brand?', 'Sony'],
    ['What company released the original Sonic the Hedgehog?', 'Sega']
  ]}
];

export const sportsGamesPack = buildPack({
  id: 'sports-games',
  title: 'Sports & Games',
  theme: 'Major sports, board games, cards, and video games',
  description: 'Familiar sports and game knowledge with rules and iconic facts that scale from casual to challenging.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  accentColor: '#7ee7ad'
}, categories);
