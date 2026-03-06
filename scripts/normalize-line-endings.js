#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Get file path from command line arguments
const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node normalize-line-endings.js <file>');
  process.exit(1);
}

const fullPath = path.resolve(filePath);

try {
  // Read file content
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Convert all line endings to LF
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Write back to file
  fs.writeFileSync(fullPath, normalizedContent, 'utf8');
  
  console.log(`✓ Normalized line endings to LF in ${filePath}`);
} catch (error) {
  console.error(`Error processing ${filePath}:`, error.message);
  process.exit(1);
}
