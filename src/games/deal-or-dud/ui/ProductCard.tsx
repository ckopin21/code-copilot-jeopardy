// The product on stage: its three cards, the business name and the headline. The TV shows it big during the pitch;
// the presenter's phone shows it all round.
import type { LockedPremise } from '../types';
import { Emoji } from './Emoji';

export function ProductCard({ premise, className = '' }: { premise: LockedPremise; className?: string }) {
  return <div className={`dod-product-card ${className}`}>
    <div className="dod-product-emojis" aria-hidden="true">{premise.emojis.map((emoji, index) => <span key={`${emoji}${index}`}><Emoji char={emoji}/></span>)}</div>
    <small>{premise.businessName}</small>
    <b>{premise.headline}</b>
  </div>;
}
