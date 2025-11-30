import { render, Text } from 'ink';
import {MessageList} from './components/MessageList.js'
import {Spinner} from './components/Spinner.js'

import { Fragment } from 'react/jsx-runtime';

const App= () =>(
    <Fragment>
        <Text color="green">Hello World from Ink!</Text>
        <Spinner/>
        <MessageList/>
    </Fragment>

);


export async function main(){
    render(<App />)
}
