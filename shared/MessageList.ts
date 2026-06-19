import Message from "./Message.js";

export default class MessageList {
    private messages: Message[] = [];

    add(message: Message): void {
        this.messages.push(message);
    }

    getAll(): Message[] {
        return this.messages;
    }
}
