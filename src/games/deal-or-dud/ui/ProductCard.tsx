// The product on stage: its cards and the headline. The TV shows it big during the pitch;
// the presenter's phone shows it all round.
import type { LockedPremise } from '../types';
import { Emoji } from './Emoji';

export function ProductCard({ premise, className = '' }: { premise: LockedPremise; className?: string }) {
  // Four-card headlines get long; the card steps its text down so it keeps its size on the TV.
  const size = premise.headline.length > 100 ? 'is-xlong' : premise.headline.length > 65 ? 'is-long' : '';
  return <div className={`dod-product-card ${size} ${className}`}>
    <div className="dod-product-emojis" aria-hidden="true">{premise.emojis.map((emoji, index) => <span key={`${emoji}${index}`}><Emoji char={emoji}/></span>)}</div>
    <b>{premise.headline}</b>
  </div>;
}
