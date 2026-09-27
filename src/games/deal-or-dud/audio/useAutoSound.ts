// Sound is on by default: try to start it as the screen opens (browsers allow that on sites people use often), and
// otherwise at the first click, tap or key press anywhere, since browsers keep a page silent until someone interacts.
import { useCallback, useEffect, useState } from 'react';
import { dealAudio } from './dealAudio';

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

export function useAutoSound(): { soundOn: boolean; unlockSound: () => Promise<boolean> } {
  const [soundOn, setSoundOn] = useState(dealAudio.unlocked);
  const unlockSound = useCallback(() => dealAudio.unlock().then((ok) => { setSoundOn(ok); return ok; }), []);
  useEffect(() => {
    if (soundOn) return;
    void unlockSound();
    const onGesture = () => { void unlockSound(); };
    for (const type of GESTURES) window.addEventListener(type, onGesture, { capture: true });
    return () => { for (const type of GESTURES) window.removeEventListener(type, onGesture, { capture: true }); };
  }, [soundOn, unlockSound]);
  return { soundOn, unlockSound };
}
