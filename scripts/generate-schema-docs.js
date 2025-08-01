#!/usr/bin/env node

/**
 * Schema Documentation Generator Script
 * 
 * Generates comprehensive NLJ schema documentation from the frontend
 * schema generator and saves it for backend consumption.
 * 
 * This ensures DRY principles by having a single source of truth
 * for all node type schemas and examples.
 */

const { join } = require('path');
const { writeFileSync, mkdirSync } = require('fs');

// Since we can't import ES modules directly, we'll use dynamic import
async function generateSchema() {
  const rootDir = __dirname.replace('/scripts', '');
  
  console.log('🚀 Generating NLJ schema documentation...');

  try {
    // Dynamic import of the TypeScript module (Node.js will compile it)
    const { generateSchemaDocumentation } = await import('../frontend/utils/schemaDocGenerator.ts');
    
    // Generate the complete schema documentation
    const schemaMarkdown = generateSchemaDocumentation();
    
    // Ensure backend directory exists
    const backendDir = join(rootDir, 'backend');
    const outputPath = join(backendDir, 'nlj-schema-docs.md');
    
    mkdirSync(backendDir, { recursive: true });
    
    // Write the schema documentation
    writeFileSync(outputPath, schemaMarkdown, 'utf8');
    
    console.log(`✅ Schema documentation generated successfully!`);
    console.log(`📄 Output: ${outputPath}`);
    console.log(`📊 Size: ${Math.round(schemaMarkdown.length / 1024)}KB`);
    
    // Count node types for verification
    const nodeTypeCount = (schemaMarkdown.match(/#### /g) || []).length;
    console.log(`🎯 Node types documented: ${nodeTypeCount}`);
    
  } catch (error) {
    console.error('❌ Error generating schema documentation:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the async function
generateSchema();