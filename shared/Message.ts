export default class Message {
    date: number;
    text: string;
    sender: { name: string };

    constructor(text: string, sender: { name: string }, date: number) {
        this.date = date;
        this.text = text;
        this.sender = sender;
    }
}
