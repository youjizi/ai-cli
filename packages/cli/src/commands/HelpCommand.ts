import type { Command } from './types.js';


export const HelpCommand: Command = {
    name: 'help',
    description: '显示帮助信息',
    run: () => {
        console.log('\n可用命令列表:');
        console.log('  /help    - 显示帮助信息');
        console.log('  /exit    - 退出程序');
    }
};