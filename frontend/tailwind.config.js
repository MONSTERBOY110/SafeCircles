import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tailwind resolves content patterns relative to its CWD, not the config file.
// When the build runs from the repo root, plain `./src/**/*.{js,jsx}` looks
// in the wrong place. Resolve absolute and normalise slashes (backslashes
// are escape chars in glob syntax → break matching on Windows).
const here = (...p) => path.resolve(__dirname, ...p).split(path.sep).join('/');

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    here('index.html'),
    here('src/**/*.{js,jsx}'),
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3498DB',
        secondary: '#2ECC71',
        danger: '#E74C3C',
        warning: '#F39C12',
        dark: '#2D3B55',
        light: '#E6E4D7',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
