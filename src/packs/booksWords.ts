import { buildPack, type CategoryData } from './buildPack';

const categories: CategoryData[] = [
  { name: 'Children’s Books', questions: [
    ['Who is the author of Green Eggs and Ham?', ['Dr. Seuss', 'Doctor Seuss']],
    ['What kind of animal is the title character in Charlotte’s Web?', 'Spider'],
    ['In The Very Hungry Caterpillar, what does the caterpillar eventually become?', 'Butterfly'],
    ['Who wrote the Harry Potter book series?', ['J. K. Rowling', 'JK Rowling', 'J.K. Rowling']],
    ['What is the surname of the four siblings who enter Narnia through a wardrobe in The Lion, the Witch and the Wardrobe?', 'Pevensie'],
    ['Who wrote A Wrinkle in Time?', ['Madeleine L’Engle', 'Madeleine LEngle']]
  ]},
  { name: 'Classic Novels', questions: [
    ['Which novel begins with the character Ishmael saying “Call me Ishmael”?', 'Moby-Dick'],
    ['Which novel features Atticus Finch as a lawyer and father?', 'To Kill a Mockingbird'],
    ['Which novel follows Elizabeth Bennet and Mr. Darcy?', 'Pride and Prejudice'],
    ['Which George Orwell novel features the slogan “Big Brother is watching you”?', ['1984', 'Nineteen Eighty-Four']],
    ['Which novel by F. Scott Fitzgerald features Jay Gatsby?', 'The Great Gatsby'],
    ['Which novel centers on Victor Frankenstein and the creature he brings to life?', 'Frankenstein']
  ]},
  { name: 'Authors', questions: [
    ['Who wrote The Cat in the Hat?', ['Dr. Seuss', 'Doctor Seuss']],
    ['Who wrote The Hobbit?', ['J. R. R. Tolkien', 'JRR Tolkien', 'Tolkien']],
    ['Who wrote The Adventures of Tom Sawyer?', ['Mark Twain', 'Samuel Clemens']],
    ['Who wrote Jane Eyre?', 'Charlotte Brontë'],
    ['Who wrote One Hundred Years of Solitude?', ['Gabriel García Márquez', 'Gabriel Garcia Marquez']],
    ['Who wrote The Old Man and the Sea?', 'Ernest Hemingway']
  ]},
  { name: 'Shakespeare', questions: [
    ['Which Shakespeare play features the characters Romeo and Juliet?', 'Romeo and Juliet'],
    ['Which Shakespeare character is the Prince of Denmark?', 'Hamlet'],
    ['In Macbeth, what title does Macbeth hold at the start of the play?', ['Thane of Glamis', 'Glamis']],
    ['Which Shakespeare comedy includes the fairy king Oberon?', ['A Midsummer Night’s Dream', 'Midsummer Night’s Dream']],
    ['Which Shakespeare play features the villain Iago?', 'Othello'],
    ['Which Shakespeare play opens with three witches planning to meet Macbeth?', 'Macbeth']
  ]},
  { name: 'Vocabulary', questions: [
    ['What word means the opposite of “maximum”?', 'Minimum'],
    ['What word describes a person who writes books or other texts?', 'Author'],
    ['What word means a word with the same or nearly the same meaning as another word?', 'Synonym'],
    ['What term means an exaggerated statement not meant to be taken literally?', 'Hyperbole'],
    ['What word describes something that can be interpreted in more than one way?', 'Ambiguous'],
    ['What term means a word formed from the initial letters of a phrase, such as NASA?', 'Acronym']
  ]},
  { name: 'Idioms', questions: [
    ['If something is “a piece of cake,” what does the phrase mean?', ['It is easy', 'Easy']],
    ['What does “break the ice” mean in conversation?', ['Start a friendly interaction', 'Make people feel more comfortable']],
    ['If someone “hits the nail on the head,” what have they done?', ['Said exactly the right thing', 'Identified the exact point']],
    ['What does “once in a blue moon” mean?', ['Very rarely', 'Rarely']],
    ['If you “spill the beans,” what have you done?', ['Revealed a secret', 'Told a secret']],
    ['What does “bite the bullet” mean?', ['Face a difficult situation', 'Accept something difficult']]
  ]},
  { name: 'Myths & Legends', questions: [
    ['In Greek mythology, who is the king of the gods?', 'Zeus'],
    ['Which legendary king is associated with the sword Excalibur?', ['King Arthur', 'Arthur']],
    ['In Greek mythology, which hero has a famous vulnerable heel?', 'Achilles'],
    ['What creature in Greek mythology has the body of a lion and the head and wings of an eagle?', 'Griffin'],
    ['Which Norse god is known for wielding the hammer Mjölnir?', 'Thor'],
    ['In Greek mythology, who flew too close to the Sun with wings made using wax?', 'Icarus']
  ]},
  { name: 'Literary Terms', questions: [
    ['What is the main character of a story commonly called?', 'Protagonist'],
    ['What is a comparison using “like” or “as” called?', 'Simile'],
    ['What is the person who tells a story called?', 'Narrator'],
    ['What term describes a hint about something that will happen later in a story?', 'Foreshadowing'],
    ['What is a fourteen-line poem traditionally called?', 'Sonnet'],
    ['What term describes a recurring image, idea, or symbol that helps develop a theme?', 'Motif']
  ]}
];

export const booksWordsPack = buildPack({
  id: 'books-words',
  title: 'Books & Words',
  theme: 'Books, authors, vocabulary, idioms, myths, and literary terms',
  description: 'A reading-and-language pack with familiar titles and concepts, rising from everyday words to classic literature.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  accentColor: '#c7a8ff'
}, categories);
