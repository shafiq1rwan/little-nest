// Lighting moods. Each one sets the sky and ground ambient, the sun, the backdrop, exposure, the
// glow of the window view, and how strongly lamps shine (lamps carry the room at night).
// Keys are stored in saved rooms: never rename them; add migrations before removing one.

export const DEFAULT_LIGHTING = 'morning';

export const LIGHTING = {
  morning: {
    name: 'Morning', blurb: 'Clear, warm daylight.',
    hemisphere: { sky: 0xfff3df, ground: 0xaa7652, intensity: 2 },
    sun: { color: 0xffe2b3, intensity: 3.2, position: [-3, 10, 6] },
    backdrop: 0xdf9b7d, exposure: 1.25,
    window: { emissive: 0xc9d498, intensity: 0.2 },
    lamps: 0.35,
  },
  sunset: {
    name: 'Sunset', blurb: 'Low golden light and long shadows.',
    hemisphere: { sky: 0xffd2a8, ground: 0x8e4f36, intensity: 1.5 },
    sun: { color: 0xffac6a, intensity: 2.8, position: [7, 4, 6] },
    backdrop: 0xd4866a, exposure: 1.15,
    window: { emissive: 0xffb27a, intensity: 0.55 },
    lamps: 0.8,
  },
  evening: {
    name: 'Evening', blurb: 'Blue dusk outside, lamps on inside.',
    hemisphere: { sky: 0x7c8db0, ground: 0x3a2c34, intensity: 0.75 },
    sun: { color: 0x9db0dc, intensity: 0.55, position: [-4, 9, 5] },
    backdrop: 0x8f6d78, exposure: 1.05,
    window: { emissive: 0x3f4d70, intensity: 0.45 },
    lamps: 1.8,
  },
};
