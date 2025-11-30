import { render, Text } from 'ink';

const App= () =>(
    <Text color="green">Hello World from Ink!</Text>

);


export async function main(){
    render(<App />)
}
