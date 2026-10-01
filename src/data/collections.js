// Furniture collections: cohesive sets the catalog can be filtered by. Every catalog entry carries a
// `collection` key; entries without one belong to the default set. Keys are not stored in saves.

export const DEFAULT_COLLECTION = 'cozy';

export const COLLECTIONS = {
  cozy: { name: 'Nest classics', blurb: 'Warm wood, cream seating, and plenty of plants.' },
  japandi: { name: 'Japandi', blurb: 'Low lines, pale ash, charcoal, and paper light.' },
  cottage: { name: 'Cottage', blurb: 'Painted wood, rose and sage, and a teapot on every table.' },
};
