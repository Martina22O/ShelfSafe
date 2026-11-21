import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '../dist');
const dirsToCreate = [
  distDir,
  path.join(distDir, 'assets'),
  path.join(distDir, 'assets', 'assets'),
  path.join(distDir, 'assets', 'assets', 'designs'),
  path.join(distDir, 'assets', 'node_modules'),
  path.join(distDir, '_expo'),
  path.join(distDir, '_expo', 'static'),
  path.join(distDir, '_expo', 'static', 'js'),
  path.join(distDir, '_expo', 'static', 'js', 'web'),
];

for (const d of dirsToCreate) {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
}

