// BAD business profiles: the favorable cards are real, but the problems seriously threaten the company.
// Each variant has exactly three favorable (+) and three unfavorable (-) cards.
import { ANY, DIG, DUR, FOOD, LIVE, PHYS, RENT, type ProfileFamily } from './profileTypes';

export const BAD_PROFILES: readonly ProfileFamily[] = [
  {
    id: 'b-one-use-returns',
    verdict: 'bad',
    explain: 'It sells fast, but most buyers send it back, so the money disappears.',
    variants: [
      { id: 'b-one-use-returns-a', forms: DUR, cards: [
        ['sales', '+', 'Lots of people bought it.', 'It sold 10,000 in its first month.', 'Sales were huge in the first month and are still strong.'],
        ['stores', '+', 'Stores want more.', 'Stores ordered 5,000 more.', 'Stores keep ordering more because it flies off shelves.'],
        ['ads', '+', 'Videos of happy buyers are popular.', 'Unboxing videos got 2 million views.', 'Unboxing videos are everywhere and look great.'],
        ['returns', '-', 'Most buyers send it back.', 'Most buyers return it after one use.', 'Most buyers return it within a week of opening it.'],
        ['shipping', '-', 'Returns cost shipping money.', 'Each return costs $6 in shipping.', 'The company pays shipping both ways on every return.'],
        ['usage', '-', 'People stop using it fast.', 'Buyers use it about once, then stop.', 'Buyers who keep it rarely use it more than once.']
      ] },
      { id: 'b-one-use-returns-b', forms: FOOD, cards: [
        ['sales', '+', 'It sold a lot at first.', 'It sold 30,000 packs at launch.', 'Launch sales beat every prediction.'],
        ['stores', '+', 'Stores put it up front.', 'Two chains put it by the checkout.', 'Stores gave it great shelf spots.'],
        ['ads', '+', 'Taste-test videos are popular.', 'Taste-test videos got 1 million views.', 'Taste-test videos went viral.'],
        ['returns', '-', 'Many ask for refunds.', 'One in 3 buyers asks for a refund.', 'Refund requests are unusually high.'],
        ['reviews', '-', 'Later reviews are bad.', 'Reviews after a week average 2 stars.', 'First-day reviews are great; week-later reviews are harsh.'],
        ['repeat', '-', 'Almost nobody buys it again.', 'Only 5% of buyers buy it again.', 'Very few buyers come back for a second pack.']
      ] }
    ]
  },
  {
    id: 'b-breaks-fast',
    verdict: 'bad',
    explain: 'It keeps breaking, and replacing it costs more than it earns.',
    variants: [
      { id: 'b-breaks-fast-a', forms: DUR, cards: [
        ['sales', '+', 'It sells well.', 'It sold 8,000 last year.', 'Sales are strong and rising.'],
        ['stores', '+', 'Stores carry it.', 'Six stores carry it.', 'Stores are happy with how fast it sells.'],
        ['reviews', '+', 'First reviews are great.', 'First-week reviews average 4.8 stars.', 'Early reviews are glowing.'],
        ['durability', '-', 'It breaks quickly.', 'Most break within 2 months.', 'A key part wears out within weeks.'],
        ['returns', '-', 'Replacements break too.', 'Half of the replacements also broke.', 'Replacement units fail just like the originals.'],
        ['cost', '-', 'Fixing it costs more than it earns.', 'Each repair costs $12, more than it earns.', 'Every repair costs more than the sale brought in.']
      ] },
      { id: 'b-breaks-fast-b', forms: RENT, cards: [
        ['sales', '+', 'Rentals are popular.', 'It had 1,200 rentals last year.', 'Bookings are strong most weeks.'],
        ['reviews', '+', 'Renters like it at first.', 'Renters rate the first day 4.6 stars.', 'Renters enjoy it while it works.'],
        ['price', '+', 'Renters pay a good price.', 'Each rental costs $45.', 'Renters pay a solid price.'],
        ['durability', '-', 'The {p} break a lot.', 'One in 3 comes back broken.', 'Many come back broken.'],
        ['cost', '-', 'Replacing them is expensive.', 'Each replacement costs $200.', 'Replacements are pricey and frequent.'],
        ['returns', '-', 'Renters want refunds.', 'One in 5 renters asks for a refund.', 'Breakdowns lead to lots of refunds.']
      ] }
    ]
  },
  {
    id: 'b-costs-more-than-price',
    verdict: 'bad',
    explain: 'Every sale loses money, so selling more makes it worse.',
    variants: [
      { id: 'b-costs-more-a', forms: ANY, cards: [
        ['sales', '+', 'Sales are strong.', 'It had 20,000 sales last year.', 'Sales are big and still growing.'],
        ['reviews', '+', 'People love the price.', 'Reviews call it a great deal.', 'Reviewers keep saying it is a bargain.'],
        ['repeat', '+', 'People come back.', 'Most {customers} {buy} it again.', 'Repeat {customers} are common.'],
        ['cost', '-', 'It costs more to make than it sells for.', 'It costs $2 more to make than it sells for.', 'Every sale costs more than it brings in.'],
        ['price', '-', 'Raising the price scares people off.', 'A test at $10 lost most buyers.', 'When they tried a higher price, most people left.'],
        ['team', '-', 'Costs are going up.', 'The team needs a raise to stay.', 'Costs keep rising, starting with the team.']
      ] },
      { id: 'b-costs-more-b', forms: LIVE, cards: [
        ['sales', '+', 'It is always booked.', 'It is booked 6 days a week.', 'Bookings are full most weeks.'],
        ['reviews', '+', 'Reviews are great.', 'Reviews average 4.8 stars.', 'Customers rave about the value.'],
        ['repeat', '+', 'People book again.', 'Most {customers} book again.', 'Regulars fill the schedule.'],
        ['cost', '-', 'Each booking loses money.', 'Each booking costs $15 more to run than it earns.', 'Running each booking costs more than it earns.'],
        ['price', '-', 'Customers will not pay more.', 'A higher price cut bookings in half.', 'Raising prices drove customers away.'],
        ['team', '-', 'Staff want raises.', 'Staff asked for a raise.', 'Staff costs are about to rise again.']
      ] }
    ]
  },
  {
    id: 'b-celebrity-was-everything',
    verdict: 'bad',
    explain: 'People bought it for the celebrity, and the celebrity is gone.',
    variants: [
      { id: 'b-celebrity-everything-a', forms: ANY, cards: [
        ['sales', '+', 'It had a huge launch.', 'It had 50,000 {customers} in week one.', 'The launch was massive.'],
        ['reviews', '+', 'Fans raved about it.', 'It got 5,000 fan reviews.', 'Fans flooded the internet with praise.'],
        ['ads', '+', 'News sites covered it.', 'Ten news sites wrote about it.', 'The press coverage was huge.'],
        ['usage', '-', 'Most buyers were celebrity fans.', 'Most {customers} came from the celebrity post.', 'Almost every customer came from the celebrity.'],
        ['sponsor', '-', 'The celebrity who promoted it quit.', 'Sales fell by 80% after the celebrity quit.', 'A famous singer promoted it, then quit, and sales collapsed.'],
        ['repeat', '-', 'Few people came back.', 'Only one in 20 {customers} came back.', 'Almost nobody returned for a second time.']
      ] },
      { id: 'b-celebrity-everything-b', forms: PHYS, cards: [
        ['sales', '+', 'Big stores ordered it.', 'A chain ordered 20,000.', 'Big stores placed huge orders.'],
        ['ads', '+', 'A famous athlete promoted it.', 'An athlete with 5 million fans promoted it.', 'A star athlete was the face of it.'],
        ['reviews', '+', 'Fans left happy reviews.', 'It has 3,000 reviews.', 'Fans flooded it with reviews.'],
        ['sponsor', '-', 'The athlete stopped promoting it.', 'The athlete quit after 2 months.', 'The athlete walked away from the deal.'],
        ['stores', '-', 'Stores are stuck with extras.', 'Stores have 15,000 unsold.', 'Stores are sitting on piles of unsold stock.'],
        ['repeat', '-', 'Few buyers came back.', 'Few buyers ordered a second one.', 'Repeat buyers are rare.']
      ] }
    ]
  },
  {
    id: 'b-no-repeat',
    verdict: 'bad',
    explain: 'Customers buy once and never again, and finding new ones costs too much.',
    variants: [
      { id: 'b-no-repeat-a', forms: ANY, cards: [
        ['sales', '+', 'First-time sales are strong.', 'It got 5,000 first-time {customers}.', 'First-time sales are impressive.'],
        ['ads', '+', 'The ads are fun.', 'Its ads won an award.', 'The ads are funny and well known.'],
        ['reviews', '+', 'People like it at first.', 'First reviews average 4.4 stars.', 'Early reactions are positive.'],
        ['repeat', '-', 'Almost nobody buys again.', 'Only one in 25 {customers} comes back.', 'Nearly every customer is a one-time customer.'],
        ['cost', '-', 'Getting new {customers} is expensive.', 'Each new customer costs $15 in ads.', 'Finding each new customer costs more than they spend.'],
        ['rivals', '-', 'A rival keeps customers better.', 'A rival has twice as many regulars.', 'Rivals keep their customers much better.']
      ] },
      { id: 'b-no-repeat-b', forms: DIG, cards: [
        ['sales', '+', 'Lots of downloads.', 'It got 100,000 downloads.', 'Downloads are huge.'],
        ['ads', '+', 'A popular video featured it.', 'A popular creator featured it.', 'A big creator showed it off.'],
        ['reviews', '+', 'First impressions are good.', 'It has a 4.3 rating.', 'Early reviews are positive.'],
        ['usage', '-', 'People stop using it fast.', 'Most users quit within a week.', 'Users drop off quickly.'],
        ['price', '-', 'Almost nobody pays.', 'Only 1% of users pay.', 'Paying users are extremely rare.'],
        ['cost', '-', 'Servers are expensive.', 'Servers cost $6,000 a month.', 'Server costs are high for so few payers.']
      ] }
    ]
  },
  {
    id: 'b-shipping-eats-profit',
    verdict: 'bad',
    explain: 'Shipping and delivery cost more than each sale earns.',
    variants: [
      { id: 'b-shipping-a', forms: PHYS, cards: [
        ['sales', '+', 'Orders are pouring in.', 'It gets 400 orders a week.', 'Orders keep growing.'],
        ['reviews', '+', 'People love it.', 'Reviews average 4.7 stars.', 'Reviews are warm.'],
        ['price', '+', 'People pay full price.', 'Buyers pay the full $20.', 'Buyers rarely wait for discounts.'],
        ['shipping', '-', 'Shipping costs too much.', 'Shipping costs $18 per order.', 'Shipping eats almost the whole price.'],
        ['cost', '-', 'The box is huge.', 'The box is 3 times bigger than the product.', 'The packaging is bulky and heavy.'],
        ['returns', '-', 'Some get damaged in shipping.', 'One in 8 arrives damaged and gets refunded.', 'Damaged deliveries lead to lots of refunds.']
      ] },
      { id: 'b-shipping-b', forms: RENT, cards: [
        ['sales', '+', 'Bookings pour in.', 'It gets 50 bookings a week.', 'Bookings keep growing.'],
        ['reviews', '+', 'Renters love it.', 'Renters rate it 4.6 stars.', 'Renters have fun with it.'],
        ['price', '+', 'Renters pay full price.', 'Each rental costs $60.', 'Renters pay without haggling.'],
        ['shipping', '-', 'Delivery costs too much.', 'Each delivery and pickup costs $55.', 'Delivery and pickup eat nearly the whole fee.'],
        ['cost', '-', 'Trucks are expensive.', 'Truck costs doubled this year.', 'Truck costs keep rising.'],
        ['durability', '-', 'Items get damaged in the truck.', 'One in 6 gets damaged on the way.', 'Damage on the road is common.']
      ] }
    ]
  },
  {
    id: 'b-supplier-closing',
    verdict: 'bad',
    explain: 'Without its only supplier, it cannot make more.',
    variants: [
      { id: 'b-supplier-closing-a', forms: PHYS, cards: [
        ['sales', '+', 'It sells well.', 'It sold 12,000 last year.', 'Sales are solid.'],
        ['reviews', '+', 'People like it.', 'It has a 4.6 rating.', 'Reviews are strong.'],
        ['stores', '+', 'Stores want more.', 'Stores asked for 4,000 more.', 'Stores want to order more.'],
        ['supplier', '-', 'Only one company makes the key part.', 'One factory makes the special part.', 'A single supplier makes the part that matters most.'],
        ['team', '-', 'That supplier is closing.', 'The supplier closes in 2 months.', 'The only supplier is shutting down.'],
        ['cost', '-', 'No replacement found yet.', 'A new supplier would cost 3 times more.', 'Other suppliers are far more expensive.']
      ] },
      { id: 'b-supplier-closing-b', forms: ['event', 'rental'], cards: [
        ['sales', '+', 'Bookings are strong.', 'It had 700 bookings last year.', 'Bookings are healthy.'],
        ['reviews', '+', 'People love it.', 'Reviews average 4.8 stars.', 'Reviews are excellent.'],
        ['repeat', '+', 'People book again.', 'Most {customers} book again.', 'Regulars keep coming.'],
        ['supplier', '-', 'Only one place supplies the equipment.', 'One company makes the special equipment.', 'The key equipment comes from one company.'],
        ['team', '-', 'That company is closing.', 'The equipment maker closes next month.', 'The only supplier is going out of business.'],
        ['usage', '-', 'The equipment wears out.', 'The equipment lasts about 6 months.', 'Without replacements, the equipment will run out.']
      ] }
    ]
  },
  {
    id: 'b-real-safety-problem',
    verdict: 'bad',
    explain: 'A real safety problem means a costly redesign and stores pulling it.',
    variants: [
      { id: 'b-safety-a', forms: DUR, cards: [
        ['sales', '+', 'It sells well.', 'It sold 15,000 last year.', 'Sales are strong.'],
        ['reviews', '+', 'Most people like it.', 'Reviews average 4.4 stars.', 'Most reviews are positive.'],
        ['ads', '+', 'Ads work well.', 'Ads bring in 300 buyers a week.', 'Ads are effective.'],
        ['safety', '-', 'It can get too hot.', 'Some buyers say it gets too hot to touch.', 'Complaints say it gets hot enough to be unsafe.'],
        ['stores', '-', 'A store pulled it.', 'A big store pulled it from shelves.', 'A major store removed it over the complaints.'],
        ['cost', '-', 'Fixing it needs a redesign.', 'A redesign would cost $50,000.', 'Fixing the problem means a costly redesign.']
      ] },
      { id: 'b-safety-b', forms: LIVE, cards: [
        ['sales', '+', 'It is popular.', 'It had 900 bookings last year.', 'Bookings are strong.'],
        ['reviews', '+', 'People have fun.', 'Reviews average 4.5 stars.', 'Reviews are mostly fun stories.'],
        ['price', '+', 'People pay a good price.', 'Guests pay $40 each.', 'Guests happily pay a high price.'],
        ['safety', '-', 'People have gotten hurt.', 'Several guests got minor injuries.', 'A string of small injuries has worried people.'],
        ['cost', '-', 'Safety upgrades are expensive.', 'Required upgrades cost $30,000.', 'Upgrades needed to stay open are expensive.'],
        ['sponsor', '-', 'Its sponsor is leaving.', 'Its sponsor is pulling out.', 'Its sponsor wants nothing to do with it now.']
      ] }
    ]
  },
  {
    id: 'b-big-rival',
    verdict: 'bad',
    explain: 'A bigger company sells the same thing for less, and buyers are switching.',
    variants: [
      { id: 'b-big-rival-a', forms: ANY, cards: [
        ['reviews', '+', 'Early fans love it.', 'Early fans rate it 4.7 stars.', 'Early fans are loyal and loud.'],
        ['sales', '+', 'Sales were good last year.', 'It had 9,000 sales last year.', 'Last year was strong.'],
        ['ads', '+', 'It got good press.', 'A magazine called it a top pick.', 'Press coverage was positive.'],
        ['rivals', '-', 'A huge company copied it.', 'A huge company launched the same thing.', 'A giant company launched a nearly identical version.'],
        ['price', '-', 'The rival is much cheaper.', 'The rival costs half as much.', 'The rival is far cheaper, and they cannot match it.'],
        ['repeat', '-', '{Customers} are switching.', 'Half of regular {customers} switched.', 'Regular {customers} are leaving for the cheaper rival.']
      ] },
      { id: 'b-big-rival-b', forms: PHYS, cards: [
        ['sponsor', '+', 'A famous reviewer praised it.', 'A famous reviewer praised it on TV.', 'A TV reviewer called it a favorite.'],
        ['reviews', '+', 'Reviews are good.', 'Reviews average 4.5 stars.', 'Reviewers liked it.'],
        ['sales', '+', 'It sold well before.', 'It sold 25,000 last year.', 'It had a strong year.'],
        ['rivals', '-', 'A giant company made a copy.', 'A giant brand released a copy.', 'A giant brand launched its own version.'],
        ['stores', '-', 'Stores switched to the rival.', 'Most stores switched to the rival.', 'Stores replaced it with the rival.'],
        ['cost', '-', 'They cannot lower the price.', 'Lowering the price would lose $2 per sale.', 'They cannot afford to match the rival price.']
      ] }
    ]
  },
  {
    id: 'b-fad-over',
    verdict: 'bad',
    explain: 'It was a fad; buyers moved on and it is stuck with extras.',
    variants: [
      { id: 'b-fad-over-a', forms: PHYS, cards: [
        ['ads', '+', 'It went viral.', 'A video about it got 5 million views.', 'It went viral overnight.'],
        ['sales', '+', 'It sold out.', 'It sold out 3 times.', 'It sold out repeatedly during the trend.'],
        ['stores', '+', 'Stores ordered lots.', 'Stores ordered 30,000.', 'Stores placed huge orders.'],
        ['usage', '-', 'People stopped caring.', 'Most buyers stopped using it after a month.', 'The trend ended fast.'],
        ['returns', '-', 'Stores are sending it back.', 'Stores returned 10,000 unsold.', 'Stores are returning unsold stock.'],
        ['supplier', '-', 'They ordered too many.', 'They have 20,000 extras in storage.', 'They overproduced during the hype.']
      ] },
      { id: 'b-fad-over-b', forms: ['digital', 'event', 'service'], cards: [
        ['ads', '+', 'It was all over social media.', 'It trended for 2 weeks.', 'It was the trend of the month.'],
        ['sales', '+', 'Tons of people tried it.', 'It had 30,000 {customers} in a month.', 'A huge wave of people tried it.'],
        ['reviews', '+', 'People posted about it.', 'People posted 10,000 photos of it.', 'Social posts were everywhere.'],
        ['usage', '-', 'The trend ended.', 'New {customers} dropped by 90%.', 'Interest crashed after the trend.'],
        ['repeat', '-', 'Almost nobody came back.', 'Only 3% came back.', 'Very few returned.'],
        ['cost', '-', 'They grew too fast.', 'They signed a costly 2-year lease.', 'They spent big expecting the trend to last.']
      ] }
    ]
  },
  {
    id: 'b-users-quit',
    verdict: 'bad',
    explain: 'People sign up but quit fast, so almost nobody pays for long.',
    variants: [
      { id: 'b-users-quit-a', forms: DIG, cards: [
        ['sales', '+', 'Lots of sign-ups.', 'It got 50,000 sign-ups.', 'Sign-ups are huge.'],
        ['reviews', '+', 'It looks great.', 'Reviewers praised the design.', 'Reviewers love how it looks.'],
        ['ads', '+', 'It got good press.', 'A tech site called it a must-try.', 'The press loves it.'],
        ['usage', '-', 'Most people quit fast.', 'Most users quit within 3 days.', 'Users drop off quickly.'],
        ['cost', '-', 'Servers cost a lot.', 'Servers cost $5,000 a month.', 'Server bills are high.'],
        ['price', '-', 'Few pay.', 'Only one in 50 users pays.', 'Paying users are very rare.']
      ] },
      { id: 'b-users-quit-b', forms: LIVE, cards: [
        ['sales', '+', 'Lots of first visits.', 'It had 2,000 first-time {customers}.', 'First visits are strong.'],
        ['ads', '+', 'The grand opening was a hit.', 'The opening had a line around the block.', 'The opening was packed.'],
        ['reviews', '+', 'First visits get good reviews.', 'First-visit reviews average 4.4 stars.', 'Initial reviews are positive.'],
        ['repeat', '-', 'Few come back.', 'Only one in 10 comes back.', 'Very few return.'],
        ['cost', '-', 'Rent is high.', 'Rent costs $5,000 a month.', 'The space is expensive.'],
        ['team', '-', 'Staff cost a lot.', 'It needs 6 staff every shift.', 'Staffing is expensive.']
      ] }
    ]
  },
  {
    id: 'b-staff-chaos',
    verdict: 'bad',
    explain: 'Without a steady team the product gets worse and customers do not come back.',
    variants: [
      { id: 'b-staff-chaos-a', forms: LIVE, cards: [
        ['sales', '+', 'It was busy at opening.', 'It had 300 bookings in month one.', 'The first month was busy.'],
        ['ads', '+', 'Early buzz was great.', 'Its opening post got 10,000 likes.', 'The early buzz was strong.'],
        ['sponsor', '+', 'A local celebrity visited.', 'A local celebrity posted about it.', 'A local celebrity gave it a shoutout.'],
        ['team', '-', 'Staff keep quitting.', 'Half the staff quit in 3 months.', 'The team keeps turning over.'],
        ['reviews', '-', 'Recent reviews are bad.', 'Recent reviews average 2 stars.', 'Recent reviews complain about quality.'],
        ['repeat', '-', 'Customers do not return.', 'Few customers book a second time.', 'Customers are not rebooking.']
      ] },
      { id: 'b-staff-chaos-b', forms: DIG, cards: [
        ['sales', '+', 'Lots of people signed up.', 'It had 20,000 sign-ups.', 'Sign-ups were strong.'],
        ['reviews', '+', 'Early reviews were good.', 'Early reviews averaged 4.5 stars.', 'Early reviewers liked it.'],
        ['ads', '+', 'It got good press.', 'A tech blog featured it.', 'Press coverage was positive.'],
        ['team', '-', 'Most programmers quit.', 'Four out of five programmers quit.', 'The tech team fell apart.'],
        ['usage', '-', 'Bugs are piling up.', 'Users report 30 bugs a week.', 'Bugs keep piling up.'],
        ['repeat', '-', 'Users are leaving.', 'Half of users left last month.', 'Users are leaving fast.']
      ] }
    ]
  },
  {
    id: 'b-tiny-season',
    verdict: 'bad',
    explain: 'Its short season does not earn enough to cover the whole year.',
    variants: [
      { id: 'b-tiny-season-a', forms: ANY, cards: [
        ['sales', '+', 'It sells great in December.', 'It had 4,000 sales in December.', 'December sales are strong.'],
        ['ads', '+', 'It gets holiday press.', 'A TV show featured it.', 'It gets holiday attention.'],
        ['reviews', '+', 'Holiday reviews are good.', 'Reviews average 4.5 stars.', 'Holiday {customers} like it.'],
        ['season', '-', 'It sells nothing the rest of the year.', 'It had almost no sales from February to October.', 'Outside the holidays, nothing sells.'],
        ['cost', '-', 'It costs money all year.', 'Storage costs $1,000 a month.', 'Year-round costs never stop.'],
        ['price', '-', 'It is sold at a discount after.', 'Leftovers sell at 70% off.', 'Leftovers get dumped at huge discounts.']
      ] },
      { id: 'b-tiny-season-b', forms: PHYS, cards: [
        ['stores', '+', 'Stores order it for Halloween.', 'Stores ordered 8,000 for Halloween.', 'Halloween orders are big.'],
        ['sales', '+', 'It sells out in October.', 'It sold out in 2 weeks in October.', 'October sales are excellent.'],
        ['reviews', '+', 'October buyers love it.', 'Reviews average 4.6 stars.', 'Buyers love it in October.'],
        ['season', '-', 'Nobody buys it after October.', 'Sales drop to almost zero in November.', 'After October, sales vanish.'],
        ['supplier', '-', 'It must be ordered very early.', 'Factories need orders 10 months early.', 'Orders must be placed long before anyone knows what will sell.'],
        ['returns', '-', 'Stores send back leftovers.', 'Stores returned 3,000 in November.', 'Leftovers come back after the season.']
      ] }
    ]
  },
  {
    id: 'b-rentals-lost',
    verdict: 'bad',
    explain: 'Lost and broken rentals cost more than the rental fees bring in.',
    variants: [
      { id: 'b-rentals-lost-a', forms: RENT, cards: [
        ['sales', '+', 'It is booked often.', 'Rentals are booked 20 days a month.', 'Bookings are steady.'],
        ['reviews', '+', 'Renters like it.', 'Renters rate it 4.5 stars.', 'Reviews are good.'],
        ['repeat', '+', 'Some renters come back.', 'A third of renters rent again.', 'Some renters are regulars.'],
        ['returns', '-', 'Some are never returned.', 'One in 10 is never returned.', 'Items disappear regularly.'],
        ['durability', '-', 'Many come back damaged.', 'A quarter come back damaged.', 'Damage is common.'],
        ['cost', '-', 'Replacing them is costly.', 'Each replacement costs $150.', 'Replacements are expensive.']
      ] },
      { id: 'b-rentals-lost-b', forms: RENT, cards: [
        ['sales', '+', 'Rentals are popular.', 'It had 900 rentals last year.', 'Demand for rentals is strong.'],
        ['reviews', '+', 'Renters give good reviews.', 'Reviews average 4.4 stars.', 'Reviews are positive.'],
        ['price', '+', 'Rentals pay well.', 'Each rental costs $50.', 'The rental price is healthy.'],
        ['returns', '-', 'Many come back late.', 'One in 4 comes back a week late.', 'Late returns are constant.'],
        ['usage', '-', 'Some are never returned.', 'About 60 were never returned.', 'Missing rentals keep adding up.'],
        ['cost', '-', 'Replacements are costly.', 'Each replacement costs $180.', 'Replacing lost items is expensive.']
      ] }
    ]
  },
  {
    id: 'b-food-spoils',
    verdict: 'bad',
    explain: 'It spoils so fast that much of it gets thrown away.',
    variants: [
      { id: 'b-food-spoils-a', forms: FOOD, cards: [
        ['reviews', '+', 'People love the taste.', 'Taste tests rated it 4.8 stars.', 'The taste gets rave reviews.'],
        ['stores', '+', 'Stores carry it.', 'Twelve stores carry it.', 'Stores agreed to stock it.'],
        ['sales', '+', 'It sells.', 'It sold 6,000 last month.', 'Sales are decent.'],
        ['usage', '-', 'It goes bad fast.', 'It spoils in 2 days.', 'It spoils very fast.'],
        ['cost', '-', 'Stores throw lots away.', 'Stores throw away a third of it.', 'Stores toss much of it.'],
        ['returns', '-', 'Stores want refunds.', 'Stores want refunds for thrown-out packs.', 'Stores demand money back for spoiled stock.']
      ] },
      { id: 'b-food-spoils-b', forms: FOOD, cards: [
        ['stores', '+', 'Cafes sell it.', 'Ten cafes sell it.', 'It is in several cafes.'],
        ['reviews', '+', 'People love the taste.', 'Taste tests rated it 4.7 stars.', 'People love how it tastes.'],
        ['sponsor', '+', 'A famous chef praised it.', 'A TV chef called it delicious.', 'A celebrity chef praised it.'],
        ['usage', '-', 'It melts quickly.', 'It melts in 10 minutes outside a freezer.', 'It melts almost right away.'],
        ['shipping', '-', 'It needs freezer trucks.', 'Freezer shipping costs $12 per box.', 'Keeping it frozen on the road is costly.'],
        ['returns', '-', 'Cafes want refunds for melted boxes.', 'Cafes asked for refunds on 400 boxes.', 'Melted deliveries lead to refunds.']
      ] }
    ]
  },
  {
    id: 'b-wont-pay',
    verdict: 'bad',
    explain: 'People like it but will not pay enough for it to make money.',
    variants: [
      { id: 'b-wont-pay-a', forms: ANY, cards: [
        ['reviews', '+', 'Testers love it.', 'Testers rated it 4.9 stars.', 'Testers were thrilled.'],
        ['ads', '+', 'Lots of people are curious.', 'Its page got 40,000 visits.', 'Interest is high.'],
        ['usage', '+', 'People who try it enjoy it.', 'Most people who try it smile.', 'People enjoy it when they try it.'],
        ['price', '-', 'It costs too much for most people.', 'Most people say $50 is too much.', 'Most people balk at the price.'],
        ['sales', '-', 'Few actually buy.', 'Only 200 {customers} so far.', 'Very few actually pay.'],
        ['cost', '-', 'Discounts lose money.', 'At a discount, it loses $5 each.', 'Discounting it means losing money.']
      ] },
      { id: 'b-wont-pay-b', forms: PHYS, cards: [
        ['reviews', '+', 'Shoppers love trying it.', 'Shoppers rate the sample 4.8 stars.', 'Shoppers love the samples.'],
        ['stores', '+', 'Stores let them do demos.', 'Five stores hosted demos.', 'Stores welcomed demos.'],
        ['ads', '+', 'Its demo video is popular.', 'The demo got 1 million views.', 'The demo went viral.'],
        ['price', '-', 'It costs too much.', 'It costs $80.', 'Most shoppers find it too expensive.'],
        ['sales', '-', 'Few people buy it.', 'Only 300 sold.', 'Very few actually buy.'],
        ['cost', '-', 'It cannot be made cheaper.', 'The parts alone cost $60.', 'The parts are too expensive to lower the price.']
      ] }
    ]
  },
  {
    id: 'b-team-split',
    verdict: 'bad',
    explain: 'A messy team missed orders, and partners are leaving.',
    variants: [
      { id: 'b-team-split-a', forms: PHYS, cards: [
        ['sales', '+', 'It sold well last year.', 'It sold 10,000 last year.', 'Last year was solid.'],
        ['stores', '+', 'Stores carried it.', 'Eight stores carried it.', 'Stores were on board.'],
        ['reviews', '+', 'People like it.', 'Reviews average 4.6 stars.', 'Buyers liked it.'],
        ['team', '-', 'The founders split up.', 'The two founders stopped working together.', 'The founders had a falling out.'],
        ['shipping', '-', 'Orders are missed.', 'About 500 orders never shipped.', 'Many orders went missing.'],
        ['returns', '-', 'Stores cancelled.', 'Stores cancelled 3,000 orders.', 'Stores cancelled their orders.']
      ] },
      { id: 'b-team-split-b', forms: ['digital', 'service', 'event'], cards: [
        ['sales', '+', 'It had lots of {customers}.', 'It had 8,000 {customers} last year.', 'The customer list is big.'],
        ['reviews', '+', 'Past reviews are good.', 'Past reviews average 4.5 stars.', 'Reviews used to be good.'],
        ['ads', '+', 'It was well known.', 'Its videos got 2 million views.', 'It was famous in its corner of the internet.'],
        ['team', '-', 'The team fell apart.', 'Most of the team quit last month.', 'The team collapsed.'],
        ['sponsor', '-', 'Its biggest partner is leaving.', 'Its biggest partner ended the deal.', 'Its main partner walked away.'],
        ['usage', '-', 'Things keep going wrong.', 'Customers report problems every week.', 'Problems pile up weekly.']
      ] }
    ]
  },
  {
    id: 'b-misleading-ads',
    verdict: 'bad',
    explain: 'The ads promised too much, so buyers keep asking for refunds.',
    variants: [
      { id: 'b-misleading-ads-a', forms: ANY, cards: [
        ['ads', '+', 'The ads are very popular.', 'Its ads got 4 million views.', 'The ads are everywhere.'],
        ['sales', '+', 'Sales are high.', 'It had 15,000 {customers} last year.', 'Sales are strong.'],
        ['sponsor', '+', 'Influencers promote it.', 'Twenty influencers promoted it.', 'Influencers love it.'],
        ['returns', '-', 'Lots of refunds.', 'One in 3 {customers} asks for a refund.', 'Refunds are extremely common.'],
        ['reviews', '-', 'Reviews say it looks different in real life.', 'Reviews say it is much smaller than the ads.', 'Buyers feel the ads were misleading.'],
        ['safety', '-', 'A consumer group complained.', 'A consumer group filed a complaint.', 'A watchdog group is looking into it.']
      ] },
      { id: 'b-misleading-ads-b', forms: DIG, cards: [
        ['ads', '+', 'Its ads are everywhere.', 'Its ads got 2 million views.', 'Its ads are hard to miss.'],
        ['sales', '+', 'Lots of people downloaded it.', 'It had 80,000 downloads.', 'Downloads soared.'],
        ['sponsor', '+', 'Streamers promote it.', 'Ten streamers promoted it.', 'Popular streamers talk about it.'],
        ['returns', '-', 'Many users want refunds.', 'One in 4 paying users asks for a refund.', 'Refund requests are very common.'],
        ['reviews', '-', 'Reviews say it is not what was promised.', 'Reviews say key features are missing.', 'Users feel tricked by the ads.'],
        ['stores', '-', 'An app store warned them.', 'An app store sent a warning about the ads.', 'An app store may remove it.']
      ] }
    ]
  },
  {
    id: 'b-event-costs',
    verdict: 'bad',
    explain: 'Each session costs more to run than customers pay for it.',
    variants: [
      { id: 'b-event-costs-a', forms: ['event'], cards: [
        ['sales', '+', 'The first one sold out.', 'The first show sold 500 tickets.', 'The first show was packed.'],
        ['reviews', '+', 'People had fun.', 'Guests rated it 4.7 stars.', 'Guests loved it.'],
        ['ads', '+', 'It got buzz.', 'Local news covered it.', 'It got good buzz.'],
        ['cost', '-', 'The venue costs a lot.', 'The venue costs $8,000 per night.', 'Venue costs are huge.'],
        ['safety', '-', 'Safety staff are required.', 'Safety staff cost $2,000 per night.', 'Required safety staff add big costs.'],
        ['repeat', '-', 'The second show was half empty.', 'The second show sold only 200 tickets.', 'Interest dropped after the first show.']
      ] },
      { id: 'b-event-costs-b', forms: ['service'], cards: [
        ['sales', '+', 'The first classes filled up.', 'The first 10 classes were full.', 'The first classes were packed.'],
        ['reviews', '+', 'Students loved it.', 'Reviews average 4.8 stars.', 'Students raved about it.'],
        ['ads', '+', 'It got attention.', 'A local paper wrote about it.', 'It got local buzz.'],
        ['cost', '-', 'Each class costs a lot to run.', 'Each class costs $300 to run.', 'Classes are expensive to run.'],
        ['price', '-', 'Students will not pay more.', 'Students left when the price went up $5.', 'Raising prices drove students away.'],
        ['repeat', '-', 'Few come back.', 'Only one in 5 books a second class.', 'Few students return.']
      ] }
    ]
  },
  {
    id: 'b-narrow-conditions',
    verdict: 'bad',
    explain: 'It only works in special conditions, so most buyers end up disappointed.',
    variants: [
      { id: 'b-narrow-a', forms: DUR, cards: [
        ['sales', '+', 'It sold well.', 'It sold 7,000 last year.', 'Sales were strong.'],
        ['stores', '+', 'Stores carry it.', 'It is in 10 stores.', 'Stores stocked it.'],
        ['ads', '+', 'Its demo video is popular.', 'The demo video got 1 million views.', 'The demo video looks amazing.'],
        ['usage', '-', 'It only works in warm weather.', 'It stops working below 60 degrees.', 'It fails in cold weather.'],
        ['returns', '-', 'Many are returned.', 'One in 4 buyers returns it.', 'Returns are high.'],
        ['reviews', '-', 'Buyers complain.', 'Many reviews say it does not work.', 'Real-world reviews are harsh.']
      ] },
      { id: 'b-narrow-b', forms: DIG, cards: [
        ['sales', '+', 'Lots of downloads.', 'It had 40,000 downloads.', 'Downloads were strong.'],
        ['reviews', '+', 'Testers loved it.', 'Testers rated it 4.8 stars.', 'Testers were thrilled.'],
        ['ads', '+', 'Its trailer is popular.', 'Its trailer got 900,000 views.', 'Its trailer was a hit.'],
        ['usage', '-', 'It only works on the newest phones.', 'It crashes on most phones older than 2 years.', 'It fails on older phones.'],
        ['returns', '-', 'Many ask for refunds.', 'One in 3 buyers asks for a refund.', 'Refunds pile up.'],
        ['team', '-', 'Fixing it would take a long time.', 'The team says a fix needs a full rebuild.', 'A fix means rebuilding most of it.']
      ] }
    ]
  },
  {
    id: 'b-discount-only',
    verdict: 'bad',
    explain: 'It only sells at a discount, and at that price every sale loses money.',
    variants: [
      { id: 'b-discount-only-a', forms: ANY, cards: [
        ['sales', '+', 'It sells lots on sale.', 'It sold 12,000 during sales.', 'Sales events move lots of it.'],
        ['reviews', '+', 'Buyers are happy.', 'Buyers rate it 4.5 stars.', 'Buyers are pleased.'],
        ['ads', '+', 'Sale ads work great.', 'Sale ads bring 1,000 {customers} a week.', 'Sale ads work well.'],
        ['price', '-', 'Almost nobody pays full price.', 'Only 5% pay full price.', 'Full price barely sells.'],
        ['cost', '-', 'At sale price it loses money.', 'At sale price it loses $3 each.', 'Every discounted sale loses money.'],
        ['repeat', '-', 'People wait for sales.', 'Most {customers} wait for the next sale.', 'Buyers only return during sales.']
      ] },
      { id: 'b-discount-only-b', forms: PHYS, cards: [
        ['stores', '+', 'Discount stores love it.', 'Three discount chains carry it.', 'Discount chains stock it.'],
        ['sales', '+', 'It sells lots on sale.', 'It sold 15,000 on sale.', 'Sales events move lots of it.'],
        ['reviews', '+', 'Buyers call it a deal.', 'Reviews average 4.4 stars.', 'Buyers love the deal.'],
        ['price', '-', 'Full price does not sell.', 'At full price it sells 5 a week.', 'Full price barely sells.'],
        ['cost', '-', 'The sale price loses money.', 'At sale price it loses $2 each.', 'Each sale loses money.'],
        ['supplier', '-', 'Costs are going up.', 'Material costs went up 20%.', 'Rising costs make things worse.']
      ] }
    ]
  },
  {
    id: 'b-stores-sending-back',
    verdict: 'bad',
    explain: 'Stores cannot sell it and are sending it back.',
    variants: [
      { id: 'b-stores-back-a', forms: PHYS, cards: [
        ['stores', '+', 'It is in many stores.', 'It is in 60 stores.', 'It got into lots of stores.'],
        ['reviews', '+', 'Early reviews are good.', 'Early reviews average 4.4 stars.', 'Early buyers liked it.'],
        ['ads', '+', 'It got press.', 'A magazine featured it.', 'It got good press.'],
        ['sales', '-', 'It sits on shelves.', 'Stores sell about 2 a week.', 'It barely sells in stores.'],
        ['returns', '-', 'Stores are sending it back.', 'Stores returned 8,000 unsold.', 'Stores are returning stock.'],
        ['cost', '-', 'Store fees are expensive.', 'Shelf fees cost $500 per store.', 'Store fees keep piling up.']
      ] },
      { id: 'b-stores-back-b', forms: FOOD, cards: [
        ['stores', '+', 'Many grocery stores stock it.', 'Forty grocery stores stock it.', 'It got into lots of grocery stores.'],
        ['reviews', '+', 'Taste tests went well.', 'Taste testers rated it 4.3 stars.', 'Taste tests were positive.'],
        ['ads', '+', 'It got press.', 'A food blog featured it.', 'Food bloggers covered it.'],
        ['sales', '-', 'It sits on shelves.', 'Each store sells about 3 a week.', 'Shoppers walk right past it.'],
        ['returns', '-', 'Stores send it back.', 'Stores returned 6,000 packs.', 'Stores are returning stock.'],
        ['cost', '-', 'Shelf fees are costly.', 'Shelf fees cost $400 per store.', 'Store fees keep piling up.']
      ] }
    ]
  },
  {
    id: 'b-bad-location',
    verdict: 'bad',
    explain: 'Customers love it, but too few can reach it to cover the high costs.',
    variants: [
      { id: 'b-bad-location-a', forms: LIVE, cards: [
        ['reviews', '+', 'People who come love it.', 'Visitors rate it 4.9 stars.', 'Visitors are thrilled.'],
        ['repeat', '+', 'Visitors come back.', 'Most visitors come back.', 'Regulars are loyal.'],
        ['price', '+', 'People pay full price.', 'Each visit costs $35.', 'Visitors pay a good price.'],
        ['usage', '-', 'It is hard to get to.', 'It is 40 minutes from town.', 'It is far from where people live.'],
        ['sales', '-', 'Few people come.', 'Only 50 visitors a week.', 'Visitor numbers are low.'],
        ['cost', '-', 'Rent is high.', 'Rent costs $6,000 a month.', 'Rent is too high for so few visitors.']
      ] },
      { id: 'b-bad-location-b', forms: RENT, cards: [
        ['reviews', '+', 'Renters love it.', 'Renters rate it 4.9 stars.', 'Renters are thrilled.'],
        ['repeat', '+', 'Renters come back.', 'Most renters rent again.', 'Renters are loyal.'],
        ['price', '+', 'Rentals pay well.', 'Each rental costs $45.', 'The price is healthy.'],
        ['usage', '-', 'The shop is hard to reach.', 'The shop is 30 minutes from town.', 'The shop is far from customers.'],
        ['sales', '-', 'Few people rent.', 'Only 40 rentals a month.', 'Rentals are low.'],
        ['cost', '-', 'Rent is high.', 'Shop rent costs $4,000 a month.', 'Rent is too high for so few rentals.']
      ] }
    ]
  }
];
