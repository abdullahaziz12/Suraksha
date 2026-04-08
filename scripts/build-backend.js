const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'backend-dist');

const filesToCopy = [
  'server.js',
  'package.json',
  'package-lock.json',
  '.env.example'
];

const dirsToCopy = [
  'src'
];

async function removeDir(targetPath) {
  await fs.promises.rm(targetPath, { recursive: true, force: true });
}

async function copyFileSafe(relativePath) {
  const srcPath = path.join(projectRoot, relativePath);
  const destPath = path.join(outDir, relativePath);
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  await fs.promises.copyFile(srcPath, destPath);
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

async function writeReadme() {
  const content = [
    '# Backend Deployment Package',
    '',
    'This folder contains backend-only files for deployment.',
    '',
    '## Run',
    '',
    '1. npm install',
    '2. npm start',
    '',
    '## Required Environment Variables',
    '',
    '- JWT_SECRET',
    '- MONGODB_URI',
    '- SMTP_HOST (optional)',
    '- SMTP_PORT (optional)',
    '- SMTP_USER (optional)',
    '- SMTP_PASS (optional)',
    '- SMTP_FROM (optional)',
    ''
  ].join('\n');

  await fs.promises.writeFile(path.join(outDir, 'README-BACKEND.md'), content, 'utf8');
}

async function main() {
  await removeDir(outDir);
  await fs.promises.mkdir(outDir, { recursive: true });

  for (const file of filesToCopy) {
    await copyFileSafe(file);
  }

  for (const dir of dirsToCopy) {
    await copyDirRecursive(path.join(projectRoot, dir), path.join(outDir, dir));
  }

  await writeReadme();
  console.log('Backend package created at backend-dist/.');
}

main().catch((error) => {
  console.error('Backend build failed:', error.message);
  process.exit(1);
});
