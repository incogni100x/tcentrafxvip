import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Since we are in an ES module, __dirname is not available.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(process.cwd(), 'node_modules/@web3icons/core/dist');
const targetDir = path.resolve(process.cwd(), 'assets/icons/crypto');
const metadataPath = path.resolve(process.cwd(), 'node_modules/@web3icons/common/dist/metadata/tokens.js');

async function prepareIcons() {
  try {
    // Dynamically import the metadata using a file URL
    const metadataUrl = new URL(`file://${metadataPath}`);
    const { tokens: allTokensMetadata } = await import(metadataUrl);

    // Ensure target directory exists and is empty
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(targetDir, { recursive: true });

    // Read all files from the source directory
    const files = await fs.readdir(sourceDir);
    const svgFiles = files.filter(file => file.endsWith('.svg'));
    console.log(`Found ${svgFiles.length} SVG icon files in source directory.`);

    let copiedCount = 0;
    for (const tokenMeta of allTokensMetadata) {
      // We only care about tokens that have a 'branded' variant.
      if (tokenMeta.variants && tokenMeta.variants.includes('branded') && tokenMeta.fileName) {
        // Find the corresponding SVG file in the flat directory.
        // The actual filename is the `fileName` from metadata plus a hash.
        const fileToFind = svgFiles.find(f => f.startsWith(`${tokenMeta.fileName}-`));

        if (fileToFind) {
          const sourcePath = path.join(sourceDir, fileToFind);
          // The destination filename will be the token's primary symbol.
          const targetPath = path.join(targetDir, `${tokenMeta.symbol.toUpperCase()}.svg`);
          await fs.copyFile(sourcePath, targetPath);
          copiedCount++;
        }
      }
    }

    console.log(`Successfully copied ${copiedCount} branded icons to ${targetDir}`);
  } catch (error) {
    console.error('Error preparing icons:', error);
    if (error.code === 'ENOENT') {
      console.error(`\nCould not find source directory: ${sourceDir}`);
      console.error('Please ensure you have run "npm install" or "yarn install" and the @web3icons/core package is installed correctly.');
    }
  }
}

prepareIcons(); 