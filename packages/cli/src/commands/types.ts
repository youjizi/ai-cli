export interface Command {
    name: string;
    description: string;
    run: (args: string[]) => void | Promise<void>;
}