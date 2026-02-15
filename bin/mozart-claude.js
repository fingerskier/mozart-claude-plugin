#!/usr/bin/env node

const command = process.argv[2] || 'mcp';

switch (command) {
  case 'mcp': {
    const { startServer } = await import('../src/server.js');
    await startServer();
    break;
  }
  default:
    console.error(`Unknown command: ${command}`);
    console.error('Usage: mozart-claude [mcp]');
    process.exit(1);
}
