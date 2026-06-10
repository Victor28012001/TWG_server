import Message from "./Message";

export default class MessageList {
    private messages: Message[] = [];

    add(message: Message): void {
        this.messages.push(message);
    }

    getAll(): Message[] {
        return this.messages;
    }
}
