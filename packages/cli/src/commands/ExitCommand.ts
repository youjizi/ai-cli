import type { Command } from './types.js';


export const ExitCommand: Command = {
    name: 'exit',
    description: '退出程序',
    run: () => {
        console.log('再见！👋');
        process.exit(0);
    }
};