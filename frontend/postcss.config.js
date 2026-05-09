import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  plugins: {
    // Pin tailwind to the config in this directory so it doesn't search
    // from the parent CWD (the repo root) and miss our config.
    tailwindcss: { config: path.resolve(__dirname, 'tailwind.config.js') },
    autoprefixer: {},
  },
};
