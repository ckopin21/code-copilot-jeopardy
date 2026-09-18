import { buildPack, category, question } from './buildPack';

const categories = [
  category('Football', {
    100: question('Which NFL team plays its home games in Green Bay, Wisconsin?', ['Green Bay Packers', 'Packers']),
    200: question('How many points is a safety worth in American football?', ['2', 'Two', 'Two points']),
    300: question('What is the line where the football is placed before a play begins called?', ['Line of scrimmage', 'The line of scrimmage']),
    400: question('What is it called when a defensive player catches a pass thrown by the opposing quarterback?', ['Interception', 'An interception']),
    500: question('Which NFL team uses a fleur-de-lis as its primary logo?', ['New Orleans Saints', 'Saints']),
    1000: question('What nickname is given to a long desperation pass thrown near the end of a football game?', ['Hail Mary', 'Hail Mary pass'])
  }),
  category('Basketball', {
    100: question('How high is a regulation basketball hoop from the floor?', ['10 feet', '10 ft', 'Ten feet']),
    200: question('Which NBA team is based in Boston?', ['Boston Celtics', 'Celtics']),
    300: question('What is the painted area near the basket commonly called?', ['The key', 'Key', 'Paint', 'The paint']),
    400: question('What is an alley-oop?', ['Pass caught and scored in the air', 'Lob pass finished at the rim', 'A lob finished before landing']),
    500: question('How many seconds are on the NCAA men’s basketball shot clock?', ['30', '30 seconds', 'Thirty seconds']),
    1000: question('What three options are represented by basketball’s “triple-threat” position?', ['Shoot, pass, or dribble', 'Pass, shoot, or dribble', 'Dribble, pass, or shoot'])
  }),
  category('Baseball', {
    100: question('How many innings are scheduled in a standard Major League Baseball game?', ['9', 'Nine']),
    200: question('What is a home run with all three bases occupied called?', ['Grand slam', 'A grand slam']),
    300: question('How far apart are the bases in Major League Baseball?', ['90 feet', '90 ft', 'Ninety feet']),
    400: question('What does ERA stand for in baseball pitching statistics?', ['Earned Run Average']),
    500: question('In a perfect game, how many opposing batters reach base?', ['0', 'Zero', 'None']),
    1000: question('The “Mendoza Line” refers roughly to what batting average?', ['.200', '200', '0.200'])
  }),
  category('Soccer', {
    100: question('Which player is normally allowed to handle the ball with their hands inside their own penalty area?', ['Goalkeeper', 'Keeper', 'Goalie']),
    200: question('How often is the men’s FIFA World Cup normally held?', ['Every four years', '4 years', 'Four years']),
    300: question('What color card sends a player off the field?', ['Red', 'Red card']),
    400: question('The Premier League is the top professional soccer league in which country?', ['England']),
    500: question('Copa América is the major national-team championship of which continent?', ['South America']),
    1000: question('What is a Panenka penalty kick?', ['A chipped penalty down the middle', 'Chipped penalty', 'A soft chip down the center'])
  }),
  category('Board & Card Games', {
    100: question('How many squares are on a standard chessboard?', ['64', 'Sixty-four', 'Sixty four']),
    200: question('How many cards are in a standard deck before jokers are added?', ['52', 'Fifty-two', 'Fifty two']),
    300: question('What premium square is at the center of a standard Scrabble board?', ['Double word score', 'Double word']),
    400: question('In poker, what is a straight flush?', ['Five consecutive cards of the same suit', 'Five sequential cards in the same suit']),
    500: question('How many railroad properties are on a standard U.S. Monopoly board?', ['4', 'Four']),
    1000: question('What are the dimensions of a standard full-size Go board in lines?', ['19 by 19', '19x19', 'Nineteen by nineteen'])
  }),
  category('Around the World', {
    100: question('How long is an Olympic-size swimming pool?', ['50 meters', '50 m', 'Fifty meters']),
    200: question('What is the official marathon distance in kilometers?', ['42.195 kilometers', '42.195 km', '42.195']),
    300: question('Which women’s gymnastics apparatus is a narrow raised beam?', ['Balance beam', 'Beam']),
    400: question('How many players from one ice hockey team are normally on the ice at once, including the goalie?', ['6', 'Six']),
    500: question('What color jersey is worn by the overall leader of the Tour de France?', ['Yellow', 'Yellow jersey']),
    1000: question('In cricket, what is a hat trick?', ['Three wickets in three consecutive deliveries', 'Three wickets in three balls', '3 wickets in 3 consecutive balls'])
  })
];

export const freeResponseGenreSportsGamesPack = buildPack({
  id: 'free-response-sports-games',
  title: 'Free Response: Sports & Games',
  theme: 'Football, basketball, baseball, soccer, board games, and international sports',
  description: 'A sports-and-games all-play pack with new facts separate from the Classic Sports & Games set.',
  difficulty: 'mixed',
  approximateMinutes: 30,
  supportedGameModes: ['free-response'],
  accentColor: '#81e6b2'
}, categories);
