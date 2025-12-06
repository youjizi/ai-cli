import { render } from 'ink';


import { Fragment } from 'react/jsx-runtime';
import {InputApp} from "./commands/InputApp.js";

const App= () =>(
    <Fragment>
        <InputApp/>
    </Fragment>

);


export async function main(){
    render(<App />)
}
