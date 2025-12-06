import type { Command } from './types.js';
import {HelpCommand} from "./HelpCommand.js";
import {ExitCommand} from "./ExitCommand.js";


class CommandManager {
    private commands: Map<string, Command> = new Map();

    constructor() {
        this.commands.set(HelpCommand.name, HelpCommand);
        this.commands.set(ExitCommand.name, ExitCommand);
    }


    // 解析并执行输入
    // 返回值: true 表示执行了命令，false 表示是普通文本
    async handleInput(input: string): Promise<boolean> {
        // 1. 检查是否是命令（以 / 开头）
        if (!input.startsWith('/')) {
            return false;
        }

        // 2. 解析命令名和参数
        // 例如: "/echo hello world" -> name="echo", args=["hello", "world"]
        const parts = input.slice(1).trim().split(/\s+/);
        const commandName = parts[0];
        const args = parts.slice(1);

        // 3. 查找命令
        const command = this.commands.get(commandName);

        if (!command) {
            console.log(`❌ 未知命令: ${commandName}`);
            console.log('输入 /help 查看可用命令');
            return true; // 虽然是未知命令，但也算处理了命令
        }

        // 4. 执行命令
        try {
            await command.run(args);
        } catch (error) {
            console.error(`执行命令失败: ${error}`);
        }

        return true;
    }

}

export const commandManager = new CommandManager();

