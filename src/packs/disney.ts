import { buildPack, type CategoryData } from './buildPack';

const categories: CategoryData[] = [
  { name: 'Animated Classics', questions: [
    ['Which Disney princess has a raccoon named Meeko as a companion?', 'Pocahontas'],
    ['In The Lion King, what is the name of Simba’s father?', 'Mufasa'],
    ['Which 1940 Disney film features a wooden puppet whose nose grows when he lies?', 'Pinocchio'],
    ['In The Aristocats, what is the name of the mother cat?', 'Duchess'],
    ['Which Disney animated film follows a young man named Milo Thatch searching for a lost civilization?', ['Atlantis: The Lost Empire', 'Atlantis']],
    ['What is the name of the sorcerer whose hat Mickey borrows in The Sorcerer’s Apprentice?', 'Yen Sid']
  ]},
  { name: 'Pixar', questions: [
    ['What kind of toy is Buzz Lightyear?', ['space ranger action figure', 'action figure', 'toy space ranger']],
    ['In Finding Nemo, what species of fish is Nemo?', ['clownfish', 'clown fish']],
    ['What is the name of the rat who dreams of becoming a chef in Ratatouille?', 'Remy'],
    ['In WALL-E, what is the name of the sleek probe robot sent to Earth?', ['EVE', 'Eva']],
    ['Which Pixar film centers on the emotions Joy, Sadness, Anger, Fear, and Disgust?', 'Inside Out'],
    ['In Coco, what is the name of Miguel’s deceased musician idol?', 'Ernesto de la Cruz']
  ]},
  { name: 'Characters', questions: [
    ['What is Mickey Mouse’s dog called?', 'Pluto'],
    ['What is the name of Ariel’s fish friend in The Little Mermaid?', 'Flounder'],
    ['Which Disney character is famous for losing a glass slipper?', 'Cinderella'],
    ['What is the name of the snowman created by Elsa in Frozen?', 'Olaf'],
    ['In Lilo & Stitch, what experiment number is Stitch?', ['626', 'Experiment 626']],
    ['What is the name of the tiny dragon who accompanies Mulan?', 'Mushu']
  ]},
  { name: 'Songs & Scores', questions: [
    ['Which Disney film features the song title “Let It Go”?', 'Frozen'],
    ['“You’ve Got a Friend in Me” is associated with which Disney-Pixar film?', 'Toy Story'],
    ['Which Disney film features the song title “A Whole New World”?', 'Aladdin'],
    ['Phil Collins wrote and performed several songs for which 1999 Disney animated film?', 'Tarzan'],
    ['Which Disney animated film includes the song title “I’ll Make a Man Out of You”?', 'Mulan'],
    ['Which composer wrote the score for The Nightmare Before Christmas?', 'Danny Elfman']
  ]},
  { name: 'Disney Parks', questions: [
    ['What is the name of Disney’s original theme park in Anaheim, California?', 'Disneyland'],
    ['Which Walt Disney World park is represented by Spaceship Earth?', 'Epcot'],
    ['What is the name of the haunted attraction found in several Disney parks?', 'Haunted Mansion'],
    ['Which Walt Disney World park contains the land Pandora – The World of Avatar?', 'Disney’s Animal Kingdom'],
    ['What mountain-themed roller coaster at Animal Kingdom features the legend of the Yeti?', 'Expedition Everest'],
    ['What was the original name of Disney’s Hollywood Studios when it opened in 1989?', ['Disney-MGM Studios', 'Disney MGM Studios']]
  ]},
  { name: 'Villains', questions: [
    ['Who is the sea witch villain in The Little Mermaid?', 'Ursula'],
    ['Who poisons Snow White with an apple?', ['The Evil Queen', 'Evil Queen', 'Queen Grimhilde']],
    ['Which villain rules the Underworld in Hercules?', 'Hades'],
    ['Who is the main villain in The Princess and the Frog?', ['Dr. Facilier', 'Doctor Facilier']],
    ['Which One Hundred and One Dalmatians villain wants to make a coat from puppies?', 'Cruella de Vil'],
    ['What is the name of the horned fairy villain in Sleeping Beauty?', 'Maleficent']
  ]},
  { name: 'Modern Disney', questions: [
    ['Which 2016 Disney animated film follows a Polynesian wayfinder across the ocean?', 'Moana'],
    ['In Encanto, what is the family surname?', 'Madrigal'],
    ['What magical power does Elsa have in Frozen?', ['ice powers', 'ice and snow', 'control of ice and snow']],
    ['In Big Hero 6, what is the name of Hiro’s healthcare robot companion?', 'Baymax'],
    ['Which 2021 Disney animated film is set in the fantasy world of Kumandra?', 'Raya and the Last Dragon'],
    ['In Zootopia, what is Judy Hopps’s profession?', ['police officer', 'cop', 'police']]
  ]},
  { name: 'Sidekicks', questions: [
    ['What is the name of Aladdin’s monkey?', 'Abu'],
    ['Which chameleon accompanies Rapunzel in Tangled?', 'Pascal'],
    ['What is the name of Moana’s rooster?', 'Heihei'],
    ['Which meerkat is Pumbaa’s best friend?', 'Timon'],
    ['What is the name of the horse who helps Flynn and Rapunzel in Tangled?', 'Maximus'],
    ['What are the names of Hades’s two bumbling minions in Hercules?', ['Pain and Panic', 'Panic and Pain']]
  ]},
  { name: 'Disney Locations', questions: [
    ['In Frozen, what kingdom do Anna and Elsa live in?', 'Arendelle'],
    ['In Beauty and the Beast, where does the Beast live?', ['a castle', 'the castle', 'Beast’s castle']],
    ['What city is the main setting of The Princess and the Frog?', 'New Orleans'],
    ['In Aladdin, what fictional city is home to Aladdin and Jasmine?', 'Agrabah'],
    ['What fictional African land does Simba rule in The Lion King?', ['Pride Lands', 'the Pride Lands']],
    ['What is the name of the island home of Lilo in Lilo & Stitch?', ['Kauai', 'Kauaʻi']]
  ]},
  { name: 'Disney History', questions: [
    ['Who co-founded the Disney Brothers Studio with Walt Disney?', 'Roy O. Disney'],
    ['What was the first feature-length animated film released by Walt Disney Productions?', ['Snow White and the Seven Dwarfs', 'Snow White']],
    ['In what year did Disneyland open?', '1955'],
    ['What was Mickey Mouse’s first released sound cartoon?', 'Steamboat Willie'],
    ['Which Disney animated film was the first to receive an Academy Award nomination for Best Picture?', 'Beauty and the Beast'],
    ['What was the name of Walt Disney’s experimental city concept that later became the acronym EPCOT?', ['Experimental Prototype Community of Tomorrow', 'Experimental Prototype Community Of Tomorrow']]
  ]}
];

export const disneyPack = buildPack({
  id: 'disney',
  title: 'Disney Worlds',
  theme: 'Disney animation, Pixar, parks, characters, and history',
  description: 'A broad Disney-themed pack ranging from family favorites to deeper park and studio history.',
  difficulty: 'mixed',
  approximateMinutes: 35
}, categories);
