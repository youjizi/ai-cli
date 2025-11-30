import { Text } from 'ink';
import InkSpinner from 'ink-spinner';


export const Spinner = ({ message = '加载中...' }) => {
    return (
        <Text>
            <Text color="cyan">
                <InkSpinner type="dots" />
            </Text>
            {' '}
            <Text dimColor>{message}</Text>
        </Text>
    );
};