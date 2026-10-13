import {MAX_PLAYER_LEVEL} from './EncounterPacing';

/** Every level costs more from the opening; the quadratic term strengthens late growth. */
export function experienceRequired(level:number):number {
  const progress=Math.max(0,Math.min(MAX_PLAYER_LEVEL-2,Math.floor(level)-1));
  return 6+progress+Math.min(progress,2)+Math.floor(progress*progress/30);
}
