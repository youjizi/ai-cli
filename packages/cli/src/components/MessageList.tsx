import { useState } from 'react';
import { Text, Box } from 'ink';

// 第一步：定义消息类型
type Message = {
    id: number;           // 消息 ID（唯一标识）
    sender: 'user' | 'ai'; // 发送者：用户或 AI
    content: string;       // 消息内容
};


type MessageItemProps = {
    message: Message;
};

const MessageItem = ({ message }: MessageItemProps) => {
    return (
        <Box>
            <Text color={message.sender === 'user' ? 'blue' : 'green'}>
                {message.sender}: {message.content}
            </Text>
        </Box>
    );
};


export const MessageList = () => {
    // 使用 useState 管理消息列表
    const [messages] = useState<Message[]>([
        { id: 1, sender: 'user', content: '你好' },
        { id: 2, sender: 'ai', content: '你好！我是 AI 助手' },
        { id: 3, sender: 'user', content: '今天天气怎么样？' },
        { id: 4, sender: 'ai', content: '抱歉，我无法查看实时天气' },
    ]);

    return (
        <Box flexDirection="column" padding={1}>
            {/* 标题 */}
            <Text bold color="yellow">
                ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            </Text>
            <Text bold color="magenta">
                💬 聊天记录
            </Text>
            <Text bold color="yellow">
                ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            </Text>

            {/* 消息列表 */}
            <Box flexDirection="column" marginTop={1}>
                {messages.map((message) => (
                    <MessageItem key={message.id} message={message} />
                ))}
            </Box>
        </Box>
    );


};

