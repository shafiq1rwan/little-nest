// Who lives in the room: the looks a resident can wear (Kenney Mini Characters, public/models/people)
// and the names and looks a room starts with. Look keys are stored in saved rooms: never rename them.

export const RESIDENT_LOOKS = ['female-a', 'female-b', 'female-c', 'female-d', 'female-e', 'female-f', 'male-a', 'male-b', 'male-c', 'male-d', 'male-e', 'male-f'];
export const MAX_NAME_LENGTH = 20;
/** One entry per resident slot (the count lives in the `residents` finish). */
export const DEFAULT_PEOPLE = [
  { name: 'Maya', look: 'female-b' },
  { name: 'Sam', look: 'male-a' },
  { name: 'Iris', look: 'female-e' },
];
/** A guest wears the first of these that no resident is wearing. */
export const GUEST_LOOKS = ['male-e', 'female-c', 'male-c', 'female-f', 'male-d'];
