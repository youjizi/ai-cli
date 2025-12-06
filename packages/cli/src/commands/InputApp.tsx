import { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { commandManager } from '../commands/CommandManager.js';


export const InputApp = () => {
    const [input, setInput] = useState('');

    const [messages, setMessages] = useState<Array<{type: string, content: string}>>([

    ]);


    const handleSubmit = async (value: string) => {
        if (!value.trim()) return;

        const newMessages = [...messages, {type: 'user', content: value}];
        setMessages(newMessages);


        // 尝试作为命令处理
        const isCommand = await commandManager.handleInput(value);

        if (!isCommand) {
            // 如果不是命令，这里暂时只打印日志
            // 后续我们会在这里调用 AI 接口
            console.log(`\n👤 用户说: ${value}`);
        }

        // 清空输入框
        setInput('');

    }

    return (
        <Box flexDirection="column" padding={1}>

            <Box borderStyle="round" borderColor="cyan" paddingX={1}>


                {messages.map((msg, index) => (
                    <Text key={index}>
                        {msg.type === 'user' ? '👤 ' : '🤖 '}
                        {msg.content}
                    </Text>
                ))}
                <TextInput
                    value={input}
                    onChange={setInput}
                    onSubmit={handleSubmit}
                    placeholder="输入消息或 /help..."
                />
            </Box>
        </Box>
    );
}