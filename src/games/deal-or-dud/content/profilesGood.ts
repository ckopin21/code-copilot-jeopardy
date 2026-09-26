// GOOD business profiles: every one has real problems, but they are survivable.
// Each variant has exactly three favorable (+) and three unfavorable (-) cards.
import { ANY, DIG, DUR, FOOD, LIVE, PHYS, RENT, type ProfileFamily } from './profileTypes';

export const GOOD_PROFILES: readonly ProfileFamily[] = [
  {
    id: 'g-slow-start-loyal',
    verdict: 'good',
    explain: 'Sales started slow, but people who try it keep coming back, so it keeps growing.',
    variants: [
      { id: 'g-slow-start-loyal-a', forms: ANY, cards: [
        ['repeat', '+', 'Most {customers} {buy} it again.', 'About seven in 10 {customers} {buy} it again within a month.', 'Most {customers} come back, and many come back with a friend.'],
        ['reviews', '+', 'Reviews say it is fun.', 'Most reviews give it five stars.', 'Reviews are mostly great, and the few complaints are about waiting.'],
        ['usage', '+', '{Customers} use it a lot.', '{Customers} use it about 3 times a week.', 'People who keep it use it often, even months later.'],
        ['sales', '-', 'Sales were slow at first.', 'Only a few hundred {bought} it in the first month.', 'The first month sold far less than planned, though every month since was bigger.'],
        ['ads', '-', 'The first ads did not work.', 'The company spent $5,000 on ads that brought almost nobody.', 'Paid ads flopped; almost all new {customers} came from friends instead.'],
        ['rivals', '-', 'A rival sells something similar.', 'A rival sells a similar one for $2 less.', 'A rival is cheaper, but few {customers} have switched so far.']
      ] },
      { id: 'g-slow-start-loyal-b', forms: PHYS, cards: [
        ['repeat', '+', 'People buy it again and again.', 'Half of buyers order again within two weeks.', 'Buyers reorder often, and the second order is usually bigger than the first.'],
        ['stores', '+', 'A local store wants more.', 'A store that tried 20 of them asked for more.', 'One store sold out and asked for more, but only after a slow first week.'],
        ['reviews', '+', 'Buyers say it is great.', 'Most buyers rate it 5 stars.', 'Ratings are high, though a few buyers say it took time to like it.'],
        ['sales', '-', 'Sales started slow.', 'The first month sold only 300.', 'Launch sales were weak, and the company almost gave up early.'],
        ['cost', '-', 'It costs a bit much to make.', 'Each one costs $4 to make.', 'Making it is not cheap, but it still earns money on each sale.'],
        ['shipping', '-', 'Shipping is slow.', 'Orders take about 8 days to arrive.', 'Delivery is slow, though very few buyers have cancelled over it.']
      ] }
    ]
  },
  {
    id: 'g-cheap-fix-breakage',
    verdict: 'good',
    explain: 'A few break, but fixing them is cheap and buyers stay happy.',
    variants: [
      { id: 'g-cheap-fix-breakage-a', forms: DUR, cards: [
        ['sales', '+', 'Lots of people bought it.', 'It sold 12,000 in its first year.', 'Sales keep rising, even in months with no ads at all.'],
        ['reviews', '+', 'People love how it works.', 'Buyers give it 4.7 stars.', 'Reviews are strong, and even buyers who needed a fix still recommend it.'],
        ['stores', '+', 'Stores want to carry it.', 'Three new stores asked to sell it.', 'Stores keep asking for it because buyers come in looking for it.'],
        ['durability', '-', 'Some of them break.', 'About one in 20 breaks in the first year.', 'A small part snaps on some of them, usually after heavy use.'],
        ['returns', '-', 'Some buyers send it back.', 'The company fixed 400 broken ones last year.', 'Broken ones do come back, but most buyers want a fix, not a refund.'],
        ['shipping', '-', 'Shipping costs went up.', 'Shipping now costs $3 more per box.', 'Shipping got more expensive, which trims a little from every sale.']
      ] },
      { id: 'g-cheap-fix-breakage-b', forms: RENT, cards: [
        ['repeat', '+', 'Renters come back.', 'Most renters rent again within 2 months.', 'Renters come back often, even the ones who had one break.'],
        ['reviews', '+', 'Renters leave happy reviews.', 'Renters rate it 4.8 stars.', 'Reviews praise the quick swaps when something goes wrong.'],
        ['sales', '+', 'It is booked most days.', 'The {p} are booked on most days of the week.', 'Bookings are steady all week, not just on weekends.'],
        ['durability', '-', 'Some {p} get damaged.', 'About one in 15 comes back damaged.', 'Damage happens, but most of it is small and quick to fix.'],
        ['cost', '-', 'Repairs cost money.', 'Each repair costs about $6.', 'Repairs are a steady cost, but much smaller than a rental fee.'],
        ['shipping', '-', 'Delivery is sometimes late.', 'One in 10 deliveries shows up late.', 'Late drop-offs annoy some renters, though few cancel over it.']
      ] }
    ]
  },
  {
    id: 'g-celebrity-left-fans-stayed',
    verdict: 'good',
    explain: 'The celebrity left, but customers were buying it for the product itself.',
    variants: [
      { id: 'g-celebrity-left-a', forms: ANY, cards: [
        ['sales', '+', 'Sales stayed steady.', 'Sales stayed about the same after the celebrity left.', 'Sales dipped for one week after the celebrity left, then came right back.'],
        ['repeat', '+', 'People keep buying it.', 'Most {customers} {buy} it again.', 'Repeat {customers} are growing, and few of them follow the celebrity.'],
        ['reviews', '+', 'Reviews talk about the product.', 'Most reviews mention how well it works.', 'Reviews rarely mention the celebrity; they talk about the product.'],
        ['sponsor', '-', 'The celebrity sponsor quit.', 'The famous sponsor left after 6 months.', 'The celebrity who promoted it walked away and signed with another brand.'],
        ['ads', '-', 'Ads cost more now.', 'Ads now cost twice as much without the celebrity.', 'Without the famous face, each ad brings in fewer new {customers}.'],
        ['rivals', '-', 'A rival hired the celebrity.', 'A rival now pays the celebrity to promote theirs.', 'The celebrity now promotes a rival, which got the rival lots of attention.']
      ] },
      { id: 'g-celebrity-left-b', forms: PHYS, cards: [
        ['stores', '+', 'Stores kept ordering.', 'No store cancelled after the celebrity left.', 'Stores kept reordering; buyers ask for it by name.'],
        ['repeat', '+', 'Buyers come back for more.', 'Six in 10 buyers order again.', 'Buyers keep reordering, and most found it before the celebrity was involved.'],
        ['usage', '+', 'People use it every day.', 'Most buyers use it daily.', 'Daily use is common, which is why buyers keep replacing it.'],
        ['sponsor', '-', 'The famous sponsor left.', 'A famous chef stopped promoting it.', 'The celebrity partner quit, and news sites wrote about it.'],
        ['sales', '-', 'Sales dropped for a bit.', 'Sales fell 10% the month the sponsor left.', 'There was a short dip after the news, mostly from first-time buyers.'],
        ['cost', '-', 'Packaging had to change.', 'New boxes without the celebrity cost $2,000.', 'Reprinting every box without the celebrity was an annoying extra cost.']
      ] }
    ]
  },
  {
    id: 'g-big-season',
    verdict: 'good',
    explain: 'It only sells part of the year, but that season makes more than enough.',
    variants: [
      { id: 'g-big-season-a', forms: ANY, cards: [
        ['sales', '+', 'It sells out every summer.', 'It sold out 3 summers in a row.', 'Every summer it sells out, and each summer sells out sooner.'],
        ['price', '+', 'People happily pay full price.', 'Almost nobody asks for a discount.', 'Even at a higher summer price, {customers} still {buy} it.'],
        ['repeat', '+', 'The same people come back each year.', 'Most summer {customers} return the next summer.', 'Returning {customers} start asking about it before summer even begins.'],
        ['season', '-', 'Winter sales are tiny.', 'Winter sales are about 5% of summer sales.', 'Almost nothing sells from November to March.'],
        ['cost', '-', 'It still has costs in winter.', 'Storage costs $300 a month in the off season.', 'The business pays storage and upkeep all winter while earning little.'],
        ['reviews', '-', 'Some reviews say it is too busy.', 'A few reviews complain about long waits in July.', 'Peak weeks get crowded, and some reviewers grumble about it.']
      ] },
      { id: 'g-big-season-b', forms: PHYS, cards: [
        ['stores', '+', 'Stores order a lot for the holidays.', 'Stores ordered 8,000 for the holidays.', 'Holiday orders from stores grow every year.'],
        ['sales', '+', 'It sells out every holiday.', 'Last December it sold out in 2 weeks.', 'It sells out every December, with a waiting list for the next batch.'],
        ['price', '+', 'People pay more at holiday time.', 'Holiday buyers pay the full $25 price.', 'Holiday buyers rarely wait for sales, so each one earns well.'],
        ['season', '-', 'Almost nobody buys it in spring.', 'Spring sales are close to zero.', 'After January, sales almost stop until fall.'],
        ['shipping', '-', 'Holiday shipping is expensive.', 'Rush shipping costs $4 more per box in December.', 'Holiday rush shipping eats into what each sale earns.'],
        ['supplier', '-', 'Parts are hard to get before the rush.', 'The supplier needs orders 3 months early.', 'Parts must be ordered months early, which ties up money.']
      ] }
    ]
  },
  {
    id: 'g-premium-price',
    verdict: 'good',
    explain: 'It costs a lot to make, but buyers happily pay even more for it.',
    variants: [
      { id: 'g-premium-price-a', forms: ANY, cards: [
        ['price', '+', 'People pay a high price for it.', '{Customers} pay $60 without complaining.', 'The price is high, but almost nobody asks for a cheaper version.'],
        ['repeat', '+', '{Customers} come back.', 'Two out of three {customers} {buy} it again.', 'Most {customers} come back, even at the high price.'],
        ['reviews', '+', 'Reviews say it is worth it.', 'Most reviews use the word "worth it."', 'Reviewers admit it is pricey, then say they would pay it again.'],
        ['cost', '-', 'It costs a lot to make.', 'It costs $35 to make each one.', 'The costs are high, and they went up again this year.'],
        ['sales', '-', 'It does not sell huge numbers.', 'It sold only 2,000 last year.', 'Sales are small compared with cheaper rivals.'],
        ['rivals', '-', 'Cheaper copies exist.', 'A copy sells for $20.', 'Cheap copies exist, though reviewers say they fall short.']
      ] },
      { id: 'g-premium-price-b', forms: LIVE, cards: [
        ['price', '+', 'Customers pay top price.', 'Each booking costs $90, and it stays fully booked.', 'It is the priciest option in town, and still books up first.'],
        ['reviews', '+', 'Reviews are glowing.', 'It has 300 five-star reviews.', 'Reviews rave about the experience, not the price.'],
        ['repeat', '+', 'People book it again.', 'Most {customers} book again within a year.', 'Regulars rebook and bring friends.'],
        ['team', '-', 'Staff cost a lot.', 'The staff need 2 weeks of training each.', 'Hiring and training staff is slow and expensive.'],
        ['cost', '-', 'Supplies are pricey.', 'Supplies cost $30 per booking.', 'Every booking uses expensive supplies.'],
        ['season', '-', 'Some months are slow.', 'January bookings drop by half.', 'Winter months are noticeably quieter.']
      ] }
    ]
  },
  {
    id: 'g-fixable-returns',
    verdict: 'good',
    explain: 'Returns come from one easy mix-up, not from people disliking it.',
    variants: [
      { id: 'g-fixable-returns-a', forms: DUR, cards: [
        ['sales', '+', 'It sells well.', 'It sold 9,000 last year.', 'Sales keep climbing, mostly from buyers telling friends.'],
        ['stores', '+', 'Stores want to carry it.', 'Two big stores asked to carry it.', 'Stores keep asking, even after hearing about the returns.'],
        ['reviews', '+', 'People who keep it love it.', 'Buyers who keep it rate it 4.8 stars.', 'Buyers who picked the right model almost all rate it highly.'],
        ['returns', '-', 'Some people send it back.', 'About one in 8 buyers returns it.', 'Returns are higher than normal, and most say "wrong model."'],
        ['usage', '-', 'The model names confuse people.', 'Buyers keep ordering the wrong model.', 'The model names are confusing; clearer labels are being made.'],
        ['shipping', '-', 'Returns cost shipping money.', 'Each return costs $5 in shipping.', 'Paying for return shipping adds up.']
      ] },
      { id: 'g-fixable-returns-b', forms: DIG, cards: [
        ['usage', '+', 'People who learn it use it a lot.', 'Active users open it 4 times a day.', 'Once users get past setup, they use it constantly.'],
        ['reviews', '+', 'Reviews are great after setup.', 'Users rate it 4.6 once set up.', 'Reviews are strong from anyone who finished setup.'],
        ['stores', '+', 'An app store featured it.', 'The app store featured it for 1 week.', 'The app store featured it, bringing a wave of new users.'],
        ['returns', '-', 'Some users ask for refunds.', 'One in 10 users asks for a refund.', 'Refund requests are high, mostly from the first day.'],
        ['team', '-', 'The team is small.', 'The team has only 3 people.', 'A tiny team is still working on the confusing setup.'],
        ['cost', '-', 'Running it costs money.', 'Servers cost $800 a month.', 'Server bills grow as more users sign up.']
      ] }
    ]
  },
  {
    id: 'g-growing-pains',
    verdict: 'good',
    explain: 'The problems come from having more orders than they can handle, which is a good problem.',
    variants: [
      { id: 'g-growing-pains-a', forms: PHYS, cards: [
        ['sales', '+', 'Orders keep pouring in.', 'Orders doubled in the last 3 months.', 'Orders are growing faster than the team can pack them.'],
        ['repeat', '+', 'Buyers order again.', 'Most buyers order again.', 'Buyers keep reordering even when shipping is slow.'],
        ['stores', '+', 'Stores want in.', 'Five stores are waiting to sell it.', 'Stores are asking to carry it before the company is ready.'],
        ['team', '-', 'The team is overwhelmed.', 'Only 3 people pack every order.', 'The small team works late nights to keep up.'],
        ['shipping', '-', 'Some orders ship late.', 'One in 5 orders ships late.', 'Late orders are common, and some buyers are grumpy about it.'],
        ['supplier', '-', 'The supplier is slow.', 'The supplier needs 6 weeks per batch.', 'The supplier can barely keep up with bigger orders.']
      ] },
      { id: 'g-growing-pains-b', forms: LIVE, cards: [
        ['sales', '+', 'It is booked solid.', 'It is booked 4 weeks ahead.', 'Bookings fill up weeks early, and there is a waiting list.'],
        ['reviews', '+', 'Reviews are excellent.', 'It averages 4.8 stars.', 'Reviews are excellent, apart from complaints about waiting.'],
        ['repeat', '+', 'Customers keep rebooking.', 'Most customers rebook.', 'Customers rebook before they even leave.'],
        ['team', '-', 'There are not enough workers.', 'The business needs 4 more workers.', 'The team is stretched thin and hiring is slow.'],
        ['usage', '-', 'Some people give up waiting.', 'Some people leave the waiting list.', 'Long waits make a few customers try somewhere else.'],
        ['cost', '-', 'Overtime costs extra.', 'Overtime pay costs $1,000 a month.', 'Paying staff overtime cuts into what each booking earns.']
      ] }
    ]
  },
  {
    id: 'g-copycat-loyalty',
    verdict: 'good',
    explain: 'A copycat showed up, but customers stick with the original.',
    variants: [
      { id: 'g-copycat-loyalty-a', forms: ANY, cards: [
        ['repeat', '+', '{Customers} stay loyal.', 'Eight in 10 {customers} stayed after the copycat launched.', 'Very few {customers} switched, even after trying the copy.'],
        ['reviews', '+', 'Reviews prefer the original.', 'Reviewers rate it higher than the copy.', 'Reviews that compare the two keep picking the original.'],
        ['sales', '+', 'Sales are still growing.', 'Sales grew 15% this year.', 'Sales kept growing even after the copycat arrived.'],
        ['rivals', '-', 'A big company copied it.', 'A big company launched a copy last month.', 'A well-known company made a near copy with a big ad push.'],
        ['price', '-', 'The copy is cheaper.', 'The copy costs $5 less.', 'The copy is cheaper, and the company chose not to lower its price.'],
        ['ads', '-', 'Ads got more expensive.', 'Ads cost 30% more now.', 'Competing for attention with the copycat made ads pricier.']
      ] },
      { id: 'g-copycat-loyalty-b', forms: PHYS, cards: [
        ['stores', '+', 'Stores kept it on shelves.', 'No store dropped it.', 'Stores kept it, and one gave it a bigger shelf.'],
        ['repeat', '+', 'Buyers keep buying it.', 'Most buyers reorder.', 'Reorders stayed strong after the copy appeared.'],
        ['usage', '+', 'People use it every day.', 'Buyers use it about once a day.', 'Buyers use it daily, which keeps them loyal.'],
        ['rivals', '-', 'Copies are everywhere.', 'At least 3 copies are sold online.', 'Online copies pop up every month.'],
        ['price', '-', 'Copies sell for less.', 'Copies sell for half the price.', 'Copies are much cheaper, though reviews say they break.'],
        ['cost', '-', 'Fighting copies costs money.', 'Legal letters cost $3,000.', 'Sending warning letters to copycats costs money.']
      ] }
    ]
  },
  {
    id: 'g-supplier-hiccup',
    verdict: 'good',
    explain: 'Supply trouble cost a little money, but customers did not leave.',
    variants: [
      { id: 'g-supplier-hiccup-a', forms: PHYS, cards: [
        ['stores', '+', 'Stores sell out of it.', 'Stores sold out in 2 weeks.', 'Stores sell out quickly and reorder.'],
        ['sales', '+', 'It sells well.', 'It sold 15,000 last year.', 'Sales grew every season.'],
        ['repeat', '+', 'Buyers come back.', 'Most buyers order again.', 'Even buyers hit by the delay ordered again.'],
        ['supplier', '-', 'The supplier was late once.', 'The main supplier was 5 weeks late.', 'A supplier delay left shelves empty for a while.'],
        ['cost', '-', 'A backup supplier costs more.', 'The backup supplier charges $1 more each.', 'The new backup supplier is reliable but pricier.'],
        ['returns', '-', 'Some buyers asked for refunds.', 'About 200 buyers cancelled during the delay.', 'The delay caused a small wave of cancellations.']
      ] },
      { id: 'g-supplier-hiccup-b', forms: ['event', 'rental'], cards: [
        ['sales', '+', 'Bookings are strong.', 'It had 900 bookings last year.', 'Bookings grew every month except one.'],
        ['reviews', '+', 'People rave about it.', 'Reviews average 4.7 stars.', 'Reviews are excellent, even from the delayed month.'],
        ['repeat', '+', 'People book again.', 'Most {customers} book again.', 'Returning {customers} make up most bookings.'],
        ['supplier', '-', 'Equipment arrived late once.', 'Equipment arrived 3 weeks late.', 'A supplier delay forced them to reschedule a busy month.'],
        ['returns', '-', 'Some people wanted refunds.', 'About 40 bookings were refunded.', 'The delay led to refunds, though most people rebooked.'],
        ['cost', '-', 'Rush equipment cost extra.', 'Rush orders cost $2,000 extra.', 'Paying for rush replacements was expensive.']
      ] }
    ]
  },
  {
    id: 'g-niche-devoted',
    verdict: 'good',
    explain: 'It will never be for everyone, but its fans buy enough to make money.',
    variants: [
      { id: 'g-niche-devoted-a', forms: ANY, cards: [
        ['repeat', '+', 'Fans buy it again and again.', 'Fans {buy} it about 6 times a year.', 'A small group of fans comes back constantly.'],
        ['reviews', '+', 'Fans love it.', 'Fans rate it 4.9 stars.', 'The people who get it really love it.'],
        ['price', '+', 'Fans pay full price.', 'Fans pay $30 and rarely wait for sales.', 'Fans happily pay full price, so each sale earns well.'],
        ['usage', '-', 'Most people do not get it.', 'Only one in 10 people who try it likes it.', 'Most people who try it are confused and never return.'],
        ['ads', '-', 'Ads flopped.', 'A $4,000 ad brought almost no new {customers}.', 'Broad ads did not work; it only spreads by word of mouth.'],
        ['sales', '-', 'Total sales are small.', 'Only about 1,500 {customers} so far.', 'The customer list is small compared with most businesses.']
      ] },
      { id: 'g-niche-devoted-b', forms: PHYS, cards: [
        ['repeat', '+', 'Fans keep reordering.', 'The average fan orders 5 times a year.', 'Fans reorder often and buy extras as gifts.'],
        ['reviews', '+', 'Reviews are loving.', 'It has 800 five-star reviews.', 'Reviews are passionate, even if a bit odd.'],
        ['cost', '+', 'It is cheap to make.', 'Each one costs $2 to make.', 'It is cheap to make, so small sales still earn money.'],
        ['stores', '-', 'Big stores said no.', 'Two big stores turned it down.', 'Big stores think it is too strange for most shoppers.'],
        ['sales', '-', 'Most people ignore it.', 'Only 2,000 sold last year.', 'Most shoppers walk right past it.'],
        ['ads', '-', 'Ads did not help.', 'A $3,000 ad brought only a handful of buyers.', 'Ads mostly reached people who did not care.']
      ] }
    ]
  },
  {
    id: 'g-minor-safety-fixed',
    verdict: 'good',
    explain: 'The safety worry was small and got fixed quickly, and buyers stayed.',
    variants: [
      { id: 'g-minor-safety-a', forms: DUR, cards: [
        ['sales', '+', 'Sales are strong.', 'It sold 20,000 last year.', 'Sales stayed strong after the safety news.'],
        ['reviews', '+', 'People like it.', 'Reviews average 4.6 stars.', 'Reviews stayed good after the fix.'],
        ['stores', '+', 'Stores kept selling it.', 'Every store kept selling it.', 'Stores kept it on shelves once the new label was added.'],
        ['safety', '-', 'Someone had a safety complaint.', 'A buyer pinched a finger on the hinge.', 'A small pinching problem got complaints until a new cover was added.'],
        ['cost', '-', 'The fix cost money.', 'Adding a cover costs $1 per unit.', 'The safety fix adds a little cost to every one.'],
        ['returns', '-', 'Returns went up briefly.', 'Returns doubled for one month.', 'A short spike in returns followed the news.']
      ] },
      { id: 'g-minor-safety-b', forms: LIVE, cards: [
        ['repeat', '+', 'People keep booking.', 'Most {customers} book again.', 'Returning {customers} kept booking after the fix.'],
        ['reviews', '+', 'Reviews stayed strong.', 'Reviews average 4.7 stars.', 'Reviews praise how quickly they fixed the issue.'],
        ['sales', '+', 'It is busy.', 'It hosts 60 bookings a month.', 'Bookings stayed steady through the safety news.'],
        ['safety', '-', 'Someone tripped once.', 'One guest tripped on a loose mat.', 'A loose mat caused a trip; new mats fixed it.'],
        ['cost', '-', 'The fix cost money.', 'New mats cost $900.', 'Safety upgrades were an unplanned cost.'],
        ['ads', '-', 'A news story was embarrassing.', 'A local news story joked about the trip.', 'A funny news clip made the business look careless for a week.']
      ] }
    ]
  },
  {
    id: 'g-high-volume',
    verdict: 'good',
    explain: 'Each sale earns only a little, but it sells so many that it adds up.',
    variants: [
      { id: 'g-high-volume-a', forms: PHYS, cards: [
        ['sales', '+', 'It sells huge numbers.', 'It sold 80,000 last year.', 'It sells in huge numbers every month.'],
        ['stores', '+', 'Stores reorder often.', 'Stores reorder every 2 weeks.', 'Stores reorder constantly because it sells fast.'],
        ['cost', '+', 'It is very cheap to make.', 'Each one costs 50 cents to make.', 'It is so cheap to make that even a small price earns money.'],
        ['price', '-', 'It earns little per sale.', 'Each sale earns only 40 cents.', 'The profit on each one is tiny.'],
        ['supplier', '-', 'Packaging costs went up.', 'Packaging costs 10% more now.', 'Packaging got pricier, which squeezes each sale.'],
        ['reviews', '-', 'Some say it looks boring.', 'Some reviews call the design plain.', 'Some buyers say it looks cheap, though they still buy it.']
      ] },
      { id: 'g-high-volume-b', forms: DIG, cards: [
        ['sales', '+', 'Tons of people use it.', 'It has 200,000 users.', 'Its user count keeps climbing every week.'],
        ['usage', '+', 'People use it every day.', 'Users open it about twice a day.', 'Daily use is common, so users see the small upgrades often.'],
        ['price', '+', 'Lots of people pay a little.', 'One in 20 users pays a small monthly fee.', 'Only a small share pays, but that share is large in total.'],
        ['cost', '-', 'Servers cost money.', 'Servers cost $4,000 a month.', 'Running it for so many users is costly.'],
        ['rivals', '-', 'Rivals are free.', 'Two rival apps are free.', 'Free rival apps compete for the same users.'],
        ['reviews', '-', 'Some users dislike the ads.', 'Some reviews complain about ads.', 'Free users grumble about ads, though few quit over them.']
      ] }
    ]
  },
  {
    id: 'g-free-users-convert',
    verdict: 'good',
    explain: 'Only some users pay, but they use it every day and keep paying.',
    variants: [
      { id: 'g-free-users-a', forms: DIG, cards: [
        ['usage', '+', 'People use it every day.', 'Paying users open it 5 times a day.', 'Paying users rely on it daily.'],
        ['repeat', '+', 'Paying users stay.', 'Nine in 10 paying users keep paying each month.', 'Paying users almost never cancel.'],
        ['reviews', '+', 'Reviews are strong.', 'It has a 4.7 rating.', 'Reviews praise it, especially from paying users.'],
        ['price', '-', 'Most users pay nothing.', 'Only one in 12 users pays.', 'Most people use the free version forever.'],
        ['cost', '-', 'Servers cost a lot.', 'Servers cost $2,500 a month.', 'Server costs grow with every free user.'],
        ['rivals', '-', 'A rival app launched.', 'A rival app launched last month.', 'A new rival is getting attention with a big launch.']
      ] },
      { id: 'g-free-users-b', forms: ['service', 'event'], cards: [
        ['repeat', '+', 'Members keep coming.', 'Most members renew every year.', 'Members renew year after year.'],
        ['usage', '+', 'Members come often.', 'Members visit 3 times a month.', 'Members show up often, so they value it.'],
        ['reviews', '+', 'Members love it.', 'Members rate it 4.8 stars.', 'Member reviews are enthusiastic.'],
        ['price', '-', 'Many only come to free days.', 'Half of visitors only attend free days.', 'Lots of visitors never pay.'],
        ['cost', '-', 'Free days cost money.', 'Each free day costs $400.', 'Running free days is a real cost.'],
        ['team', '-', 'Volunteers quit sometimes.', 'Three volunteers quit this year.', 'Volunteer help is unreliable.']
      ] }
    ]
  },
  {
    id: 'g-loyal-service',
    verdict: 'good',
    explain: 'Some costs went up, but customers keep coming back and bringing friends.',
    variants: [
      { id: 'g-loyal-service-a', forms: LIVE, cards: [
        ['repeat', '+', 'Customers keep booking.', 'Three out of four customers book again.', 'Most customers become regulars.'],
        ['sales', '+', 'Friends bring friends.', 'Half of new customers were sent by a friend.', 'Word of mouth brings in most new customers.'],
        ['reviews', '+', 'Reviews are great.', 'Reviews average 4.8 stars.', 'Reviews mention friendly staff again and again.'],
        ['team', '-', 'Workers sometimes quit.', 'Two workers quit this year.', 'Staff turnover means frequent retraining.'],
        ['season', '-', 'Rainy days mean cancellations.', 'Rain cancels about one in 10 bookings.', 'Bad weather causes regular cancellations.'],
        ['cost', '-', 'Wages went up.', 'Wages went up $2 an hour.', 'Higher wages shrink what each booking earns.']
      ] },
      { id: 'g-loyal-service-b', forms: RENT, cards: [
        ['repeat', '+', 'Renters come back.', 'Most renters rent again within a year.', 'Renters come back for every big occasion.'],
        ['reviews', '+', 'Renters love it.', 'It has 400 five-star reviews.', 'Reviews praise the service more than the price.'],
        ['sales', '+', 'Friends recommend it.', 'Half of renters heard about it from a friend.', 'Most new renters come from recommendations.'],
        ['team', '-', 'Hiring is hard.', 'It took 2 months to hire a driver.', 'Finding reliable delivery staff is slow.'],
        ['cost', '-', 'Cleaning costs rose.', 'Cleaning costs $4 more per rental.', 'Cleaning got pricier this year.'],
        ['season', '-', 'Winter is slow.', 'Winter rentals drop by half.', 'Rentals slow down a lot in winter.']
      ] }
    ]
  },
  {
    id: 'g-bad-launch-fixed',
    verdict: 'good',
    explain: 'The first version flopped, but the fixed version sells well and people buy it again.',
    variants: [
      { id: 'g-bad-launch-a', forms: DUR, cards: [
        ['reviews', '+', 'New reviews are great.', 'The new version averages 4.6 stars.', 'Reviews of the new version are strong.'],
        ['sales', '+', 'Sales are rising.', 'Sales doubled after the new version.', 'Sales climbed month after month since the fix.'],
        ['stores', '+', 'Stores are back on board.', 'Two stores that left came back.', 'Stores that dropped it came back for the new version.'],
        ['durability', '-', 'The first version broke a lot.', 'One in 4 first-version units broke.', 'The first version had a weak part that failed often.'],
        ['returns', '-', 'Old buyers returned it.', 'The company refunded 1,000 first-version buyers.', 'Refunding the first batch cost a lot.'],
        ['ads', '-', 'People remember the bad launch.', 'Old bad reviews still show up online.', 'The bad first launch still hurts its reputation.']
      ] },
      { id: 'g-bad-launch-b', forms: DIG, cards: [
        ['reviews', '+', 'The update got great reviews.', 'The update is rated 4.5 stars.', 'The update turned reviews around.'],
        ['usage', '+', 'People use it more now.', 'Daily users doubled since the update.', 'Daily use jumped after the update.'],
        ['repeat', '+', 'Users stay now.', 'Most new users stay past a month.', 'Users who join now tend to stick around.'],
        ['returns', '-', 'Early users asked for refunds.', 'About 500 early users got refunds.', 'The buggy launch caused many refunds.'],
        ['ads', '-', 'The launch was embarrassing.', 'A video mocking the launch got 1 million views.', 'The launch became a meme, and not in a good way.'],
        ['team', '-', 'The team worked overtime.', 'The team spent 3 months fixing bugs.', 'Fixing the launch took a long time.']
      ] }
    ]
  },
  {
    id: 'g-local-shipping',
    verdict: 'good',
    explain: 'Shipping far away is pricey, but most buyers are nearby and keep coming back.',
    variants: [
      { id: 'g-local-shipping-a', forms: PHYS, cards: [
        ['repeat', '+', 'Buyers reorder.', 'Most buyers order every month.', 'Buyers reorder like clockwork.'],
        ['sales', '+', 'Local sales are strong.', 'Most sales are within 30 miles.', 'Nearby buyers make up most sales, and they keep growing.'],
        ['reviews', '+', 'Reviews love it.', 'Buyers rate it 4.7 stars.', 'Reviews are warm and personal.'],
        ['shipping', '-', 'Shipping far is expensive.', 'Shipping across the country costs $15.', 'Long-distance shipping costs more than some buyers will pay.'],
        ['usage', '-', 'Far-away buyers give up.', 'Many far-away buyers quit after one order.', 'Distant buyers rarely order twice.'],
        ['cost', '-', 'The box is heavy.', 'Each box weighs 8 pounds.', 'The heavy packaging raises every shipping bill.']
      ] },
      { id: 'g-local-shipping-b', forms: RENT, cards: [
        ['repeat', '+', 'Nearby renters rent again.', 'Most nearby renters rent again within 3 months.', 'Renters close to the shop come back again and again.'],
        ['reviews', '+', 'Renters love the service.', 'Renters rate it 4.8 stars.', 'Reviews praise the friendly drop-offs.'],
        ['sales', '+', 'Local bookings are strong.', 'It had 600 local bookings last year.', 'Local bookings grow every season.'],
        ['shipping', '-', 'Delivering far away costs a lot.', 'A long-distance delivery costs $40.', 'Far deliveries cost more than the rental earns.'],
        ['usage', '-', 'Far-away renters rarely return.', 'Most far-away renters rent only once.', 'Renters who live far away almost never come back.'],
        ['cost', '-', 'The delivery van is old.', 'Van repairs cost $900 last year.', 'Keeping the old delivery van running costs money.']
      ] }
    ]
  },
  {
    id: 'g-viral-settles',
    verdict: 'good',
    explain: 'The viral boom faded, but a steady group of buyers kept buying.',
    variants: [
      { id: 'g-viral-settles-a', forms: ANY, cards: [
        ['sales', '+', 'It went viral.', 'A video about it got 3 million views.', 'A viral video made it famous overnight.'],
        ['repeat', '+', 'Many {customers} kept coming back.', 'Half of viral {customers} {buy} it again.', 'A big chunk of viral {customers} became regulars.'],
        ['reviews', '+', 'Reviews stayed good.', 'Reviews still average 4.5 stars.', 'Reviews stayed positive after the hype.'],
        ['ads', '-', 'The hype faded.', 'Sales fell by a third after the viral month.', 'After the viral month, attention dropped quickly.'],
        ['rivals', '-', 'Copycats appeared.', 'Four copycats appeared within a month.', 'Copycats rushed in to ride the trend.'],
        ['cost', '-', 'Growing fast was costly.', 'Rushing to meet demand cost $5,000 extra.', 'Scaling up fast wasted money.']
      ] },
      { id: 'g-viral-settles-b', forms: PHYS, cards: [
        ['stores', '+', 'Stores still carry it.', 'Most stores still carry it.', 'Stores kept it after the trend cooled.'],
        ['repeat', '+', 'Fans keep buying.', 'Four in 10 buyers reorder.', 'A loyal group keeps reordering.'],
        ['usage', '+', 'People still use it.', 'Most buyers still use it months later.', 'Buyers kept using it after the hype.'],
        ['sales', '-', 'Sales dropped after the trend.', 'Sales fell 40% after the trend.', 'The trend ended and sales dropped sharply.'],
        ['supplier', '-', 'They ordered too much.', 'They have 3,000 extras in storage.', 'They overordered during the hype.'],
        ['rivals', '-', 'Knockoffs exist.', 'Knockoffs sell for half price.', 'Cheap knockoffs flooded online shops.']
      ] }
    ]
  },
  {
    id: 'g-online-strong',
    verdict: 'good',
    explain: 'Stores were unsure, but online buyers keep ordering.',
    variants: [
      { id: 'g-online-strong-a', forms: PHYS, cards: [
        ['sales', '+', 'Online sales are strong.', 'It sold 10,000 online last year.', 'Online sales keep growing each month.'],
        ['repeat', '+', 'People reorder online.', 'Most buyers reorder.', 'Online buyers reorder often.'],
        ['reviews', '+', 'Online reviews are great.', 'It has 2,000 good reviews.', 'Online reviews are strong and detailed.'],
        ['stores', '-', 'A big store said no.', 'A big chain turned it down.', 'A major store passed, saying it was too odd.'],
        ['returns', '-', 'One store sent some back.', 'A small store returned 50 unsold.', 'A store returned some unsold stock.'],
        ['ads', '-', 'Online ads cost a lot.', 'Online ads cost $2 per buyer.', 'Finding each new online buyer costs money.']
      ] },
      { id: 'g-online-strong-b', forms: DIG, cards: [
        ['sales', '+', 'Lots of people pay for it online.', 'It has 6,000 paying users.', 'Paying users keep growing every month.'],
        ['repeat', '+', 'Users keep paying.', 'Most users renew each month.', 'Very few paying users cancel.'],
        ['reviews', '+', 'Online reviews are great.', 'It has a 4.7 rating.', 'Reviews are detailed and glowing.'],
        ['stores', '-', 'One app store rejected it at first.', 'One app store rejected the first version.', 'An app store turned it down until it fixed a small rule problem.'],
        ['ads', '-', 'Ads are expensive.', 'Ads cost $3 per new user.', 'Finding new users with ads is pricey.'],
        ['rivals', '-', 'A rival app exists.', 'A rival app is free.', 'A free rival gets more downloads.']
      ] }
    ]
  },
  {
    id: 'g-rental-wear',
    verdict: 'good',
    explain: 'Replacing worn-out gear costs money, but customers book again and again.',
    variants: [
      { id: 'g-rental-wear-a', forms: RENT, cards: [
        ['sales', '+', 'The {p} are always booked.', 'Rentals are booked 25 days a month.', 'Rentals rarely sit unused.'],
        ['repeat', '+', 'Renters come back.', 'Most renters rent again.', 'Regular renters make up most bookings.'],
        ['price', '+', 'Renters pay a good price.', 'Each rental costs $40.', 'Renters pay enough that each item pays for itself quickly.'],
        ['durability', '-', 'The {p} wear out.', 'Each one wears out after about a year.', 'Items need replacing every year.'],
        ['cost', '-', 'Cleaning costs money.', 'Cleaning costs $5 per rental.', 'Cleaning between rentals is a steady cost.'],
        ['returns', '-', 'Some come back late.', 'One in 10 comes back late.', 'Late returns mess up the schedule.']
      ] },
      { id: 'g-rental-wear-b', forms: LIVE, cards: [
        ['sales', '+', 'It is booked almost every weekend.', 'It is booked 45 weekends a year.', 'Weekends are nearly always booked.'],
        ['repeat', '+', 'Customers book again.', 'Most customers book again next year.', 'Repeat bookings fill most of the calendar.'],
        ['price', '+', 'Customers pay a good price.', 'Each booking costs $200.', 'Customers pay enough to cover the gear.'],
        ['cost', '-', 'The gear wears out.', 'New gear costs $3,000 every year.', 'Worn-out gear has to be replaced yearly.'],
        ['safety', '-', 'The gear must be checked often.', 'Safety checks take 2 hours a week.', 'Regular safety checks take time and money.'],
        ['reviews', '-', 'Some reviews mention worn gear.', 'A few reviews say the gear looked old.', 'Some reviewers noticed tired-looking equipment.']
      ] }
    ]
  },
  {
    id: 'g-event-weather',
    verdict: 'good',
    explain: 'Bad weather cancels some dates, but sold-out dates more than cover it.',
    variants: [
      { id: 'g-event-weather-a', forms: ['event', 'service'], cards: [
        ['sales', '+', 'It sells out.', 'Most dates sell out in 2 days.', 'Dates sell out quickly and have waiting lists.'],
        ['repeat', '+', 'People come back.', 'Most {customers} return next year.', 'Returning {customers} fill most spots.'],
        ['sponsor', '+', 'A sponsor helps pay.', 'A local shop pays $1,000 per season.', 'A sponsor covers part of the costs.'],
        ['season', '-', 'Rain cancels some dates.', 'Rain cancelled 4 dates last year.', 'Weather cancellations happen every season.'],
        ['cost', '-', 'The space got pricier.', 'The space costs 20% more this year.', 'Rent for the space went up.'],
        ['reviews', '-', 'Neighbors complained.', 'Neighbors complained about noise twice.', 'Some neighbors are unhappy about the noise.']
      ] },
      { id: 'g-event-weather-b', forms: RENT, cards: [
        ['sales', '+', 'Rentals sell out on sunny days.', 'Every sunny weekend sells out.', 'Sunny days are always fully booked.'],
        ['repeat', '+', 'Renters come back.', 'Most renters come back next summer.', 'Returning renters fill much of the calendar.'],
        ['price', '+', 'Renters pay full price.', 'Each rental costs $35.', 'Renters pay without asking for deals.'],
        ['season', '-', 'Rain cancels bookings.', 'Rain cancelled 12 days last year.', 'Bad weather regularly cancels days.'],
        ['cost', '-', 'Storage costs money.', 'Winter storage costs $500.', 'Storing everything in winter costs money.'],
        ['durability', '-', 'Some items get damaged.', 'About one in 20 comes back scratched.', 'Minor damage happens now and then.']
      ] }
    ]
  },
  {
    id: 'g-parents-rebuy',
    verdict: 'good',
    explain: 'Kids move on eventually, but parents keep buying the next one.',
    variants: [
      { id: 'g-parents-rebuy-a', forms: ANY, cards: [
        ['repeat', '+', 'Parents buy again.', 'Most parents {buy} the next version.', 'Parents keep coming back for new versions.'],
        ['reviews', '+', 'Parents give good reviews.', 'Parents rate it 4.6 stars.', 'Parents say it is worth the money.'],
        ['sales', '+', 'Schools asked about it.', 'Ten schools asked for info.', 'Schools are showing interest.'],
        ['usage', '-', 'Kids get bored.', 'Kids stop using it after about 3 months.', 'Kids lose interest after a while.'],
        ['price', '-', 'Some say it costs too much.', 'Some parents say $25 is too much.', 'Price complaints come up in reviews.'],
        ['rivals', '-', 'Rivals exist.', 'Two rivals target the same kids.', 'Rivals compete for the same families.']
      ] },
      { id: 'g-parents-rebuy-b', forms: PHYS, cards: [
        ['repeat', '+', 'Parents buy the next one.', 'Most parents buy a second one.', 'Parents keep buying new versions.'],
        ['stores', '+', 'Toy stores want it.', 'Four toy stores asked to sell it.', 'Stores keep asking for it.'],
        ['sales', '+', 'It sells well at the holidays.', 'It sold 5,000 at the holidays.', 'Holiday sales were strong.'],
        ['usage', '-', 'Kids get bored.', 'Kids stop using it after about 2 months.', 'Kids lose interest after a while.'],
        ['shipping', '-', 'Holiday shipping is slow.', 'Holiday orders take 10 days.', 'Holiday shipping delays annoy some parents.'],
        ['price', '-', 'Some parents think it is pricey.', 'Some parents say $30 is too much.', 'Price complaints show up in reviews.']
      ] }
    ]
  },
  {
    id: 'g-founder-oops',
    verdict: 'good',
    explain: 'An embarrassing post cost a few followers, but buyers did not care.',
    variants: [
      { id: 'g-founder-oops-a', forms: ANY, cards: [
        ['sales', '+', 'Sales kept growing.', 'Sales grew 20% this year.', 'Sales grew right through the drama.'],
        ['repeat', '+', 'Regulars stayed.', 'Most regular {customers} stayed.', 'Regular {customers} barely noticed the post.'],
        ['reviews', '+', 'Reviews are still good.', 'Reviews average 4.5 stars.', 'Reviews focus on the product, not the post.'],
        ['team', '-', 'The founder posted something silly.', 'The founder posted an embarrassing video.', 'The founder posted a video that became a joke online.'],
        ['ads', '-', 'They lost followers.', 'They lost 2,000 followers.', 'Social media followers dropped after the post.'],
        ['sponsor', '-', 'A partner paused.', 'A partner paused a deal for a month.', 'A partner waited to see how the drama played out.']
      ] },
      { id: 'g-founder-oops-b', forms: PHYS, cards: [
        ['stores', '+', 'Stores kept selling it.', 'No store dropped it.', 'Stores stayed loyal through the drama.'],
        ['sales', '+', 'Sales grew.', 'Sales grew 25% this year.', 'Sales kept climbing.'],
        ['repeat', '+', 'Buyers reorder.', 'Most buyers reorder.', 'Reorders stayed strong.'],
        ['team', '-', 'The founder said something silly on TV.', 'The founder called the product "kind of boring" on TV.', 'The founder made an awkward joke on live TV.'],
        ['sponsor', '-', 'A partner took a break.', 'A partner paused for 2 weeks.', 'A partner stepped back briefly.'],
        ['ads', '-', 'People made fun of it online.', 'A joke about it got 50,000 likes.', 'The internet had fun with the founder\'s mistake.']
      ] }
    ]
  },
  {
    id: 'g-food-short-shelf',
    verdict: 'good',
    explain: 'It spoils quickly, but it sells so fast that little goes to waste.',
    variants: [
      { id: 'g-food-short-shelf-a', forms: FOOD, cards: [
        ['sales', '+', 'It sells out daily.', 'It sells out by noon most days.', 'It sells out almost every day.'],
        ['repeat', '+', 'People come back every week.', 'Most customers buy it weekly.', 'Customers buy it on a weekly routine.'],
        ['stores', '+', 'Cafes want it.', 'Three cafes asked to sell it.', 'Local cafes are asking to stock it.'],
        ['usage', '-', 'It spoils fast.', 'It stays fresh for only 3 days.', 'It goes stale quickly.'],
        ['cost', '-', 'Some gets thrown out.', 'About 5% gets thrown away.', 'A small amount is wasted each week.'],
        ['supplier', '-', 'Ingredients cost more.', 'Ingredients cost 10% more this year.', 'Ingredient prices went up.']
      ] },
      { id: 'g-food-short-shelf-b', forms: FOOD, cards: [
        ['sales', '+', 'Lunch crowds buy it all.', 'It sells 300 a day at lunch.', 'Lunch crowds clear it out daily.'],
        ['repeat', '+', 'Office workers buy it often.', 'Most buyers come back 3 times a week.', 'Regulars buy it several times a week.'],
        ['reviews', '+', 'People rave about how fresh it is.', 'Reviews average 4.8 stars.', 'Reviewers love how fresh it is.'],
        ['usage', '-', 'It must be eaten the same day.', 'It lasts only one day.', 'It has to be eaten fresh.'],
        ['shipping', '-', 'It cannot be shipped far.', 'It can only be delivered within 5 miles.', 'Deliveries have to stay close by.'],
        ['cost', '-', 'Some leftovers go unsold.', 'About 20 are left over each night.', 'A few leftovers go unsold each night.']
      ] }
    ]
  }
];
