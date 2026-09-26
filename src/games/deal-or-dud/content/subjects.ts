import type { ProductForm, SubjectId } from '../types';

export interface SubjectInfo {
  id: SubjectId;
  label: string;
  /** Forms a fact on this subject can describe. Keeps breakage off apps and shipping off services. */
  forms: readonly ProductForm[];
}

export const ALL_FORMS: readonly ProductForm[] = ['food', 'gadget', 'goods', 'pet', 'service', 'rental', 'digital', 'event'];
const PHYSICAL: readonly ProductForm[] = ['food', 'gadget', 'goods', 'pet', 'rental'];
const BREAKABLE: readonly ProductForm[] = ['gadget', 'goods', 'pet', 'rental'];

/** The fixed fact-check menu. Order is the order phones show it. */
export const SUBJECTS: readonly SubjectInfo[] = [
  { id: 'sales', label: 'How many sold', forms: ALL_FORMS },
  { id: 'repeat', label: 'Buying again', forms: ALL_FORMS },
  { id: 'returns', label: 'Refunds & returns', forms: ALL_FORMS },
  { id: 'durability', label: 'Breaking & wearing out', forms: BREAKABLE },
  { id: 'cost', label: 'Cost to make or run', forms: ALL_FORMS },
  { id: 'price', label: 'Price', forms: ALL_FORMS },
  { id: 'stores', label: 'Stores & sellers', forms: ['food', 'gadget', 'goods', 'pet', 'digital'] },
  { id: 'shipping', label: 'Shipping & delivery', forms: PHYSICAL },
  { id: 'reviews', label: 'Reviews', forms: ALL_FORMS },
  { id: 'safety', label: 'Safety', forms: ALL_FORMS },
  { id: 'rivals', label: 'Competitors', forms: ALL_FORMS },
  { id: 'team', label: 'The team', forms: ALL_FORMS },
  { id: 'supplier', label: 'Parts & supplies', forms: ['food', 'gadget', 'goods', 'pet', 'rental', 'event'] },
  { id: 'sponsor', label: 'Celebrities & partners', forms: ALL_FORMS },
  { id: 'ads', label: 'Advertising', forms: ALL_FORMS },
  { id: 'usage', label: 'How people use it', forms: ALL_FORMS },
  { id: 'season', label: 'Seasons & timing', forms: ALL_FORMS }
];

export const SUBJECT_IDS = SUBJECTS.map((subject) => subject.id);

export function subjectLabel(id: SubjectId): string {
  return SUBJECTS.find((subject) => subject.id === id)?.label ?? id;
}

export function isSubjectId(value: unknown): value is SubjectId {
  return typeof value === 'string' && (SUBJECT_IDS as readonly string[]).includes(value);
}
