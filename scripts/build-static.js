const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const distDir = path.join(projectRoot, 'dist');

async function removeDir(targetPath) {
  await fs.promises.rm(targetPath, { recursive: true, force: true });
}

async function copyDirRecursive(srcDir, destDir) {
  await fs.promises.mkdir(destDir, { recursive: true });
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

async function writeRuntimeConfig() {
  const configuredBase = process.env.SURAKSHA_API_BASE || '/api';
  const normalizedBase = String(configuredBase).replace(/\/+$/, '') || '/api';
  const configContents = [
    '// Generated at build time. Set SURAKSHA_API_BASE in Netlify env vars.',
    `window.SURAKSHA_API_BASE = '${normalizedBase}';`,
    ''
  ].join('\n');

  await fs.promises.writeFile(path.join(distDir, 'config.js'), configContents, 'utf8');
}

async function main() {
  await removeDir(distDir);
  await copyDirRecursive(publicDir, distDir);
  await writeRuntimeConfig();
  console.log('Static build completed in dist/.');
}

main().catch((error) => {
  console.error('Build failed:', error.message);
  process.exit(1);
});
