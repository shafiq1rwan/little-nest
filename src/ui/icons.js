// Inline SVG line icons. Elements with data-icon="name" receive the matching path.

const paths = {
  'arrow-right': 'M4 12h16m-6-6 6 6-6 6',
  'orbit-left': 'M4 10h5V5M4.5 10A8 8 0 1 1 6 17',
  'orbit-right': 'M20 10h-5V5M19.5 10A8 8 0 1 0 18 17',
  settings: 'm9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-2-3 1ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  sofa: 'M5 12V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M5 11H3v8h18v-8h-2v5H5v-5ZM5 19v2M19 19v2',
  wall: 'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v6M15 9v6M9 15v6',
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  folder: 'M3 7V5h7l2 3h9l-3 12H3V7Z',
  save: 'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8',
  help: 'M9.1 8a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  pencil: 'm4 16-1 5 5-1L20 8l-4-4L4 16Zm10-10 4 4',
  move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  rotate: 'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3',
  grid: 'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  close: 'm6 6 12 12M6 18 18 6',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
  minus: 'M5 12h14',
  plus: 'M5 12h14M12 5v14',
  target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 8v8M8 12h8M12 1v3M12 20v3M1 12h3M20 12h3',
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1 5 6 6',
  chevron: 'm6 9 6 6 6-6',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 20h16',
  download: 'M12 4v12m-5-5 5 5 5-5M4 20h16',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10-1.4-1.4 1.4m0 10 1.4 1.4m-10-1.4-1.4 1.4',
  sunset: 'M3 17h18M6 13a6 6 0 0 1 12 0M12 4v3M4 9l1.5 1.5M20 9l-1.5 1.5M8 21h8',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  bulb: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.9.7 1.5 1.6 1.5 2.6h4c0-1 .6-1.9 1.5-2.6A6 6 0 0 0 12 3Z',
  music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  'music-off': 'M9 18V9M9 6l11-2v9M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM3 3l18 18',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z',
  more: 'M5 12h.5M11.75 12h.5M18.5 12h.5',
  'eye-off': 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.3 4M6.6 6.6C3.9 8.3 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  'chevron-up': 'm6 15 6-6 6 6',
  'top-view': 'M4 9 12 5l8 4-8 4-8-4ZM12 13v6M9 16l3 3 3-3',
};

export function installIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', paths[el.dataset.icon] || '');
    svg.append(path);
    el.replaceChildren(svg);
  });
}
