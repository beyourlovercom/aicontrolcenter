import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const source = resolve(root, 'web-adapter/chatgpt-dom.js');
const target = resolve(root, 'web-adapter/chrome-extension-current/chatgpt-dom.js');
if (!existsSync(source)) throw new Error(`Missing canonical DOM adapter: ${source}`);
copyFileSync(source, target);
