import express from 'express';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables from a .env file if it exists
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: '*', // Allow any origin
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));
app.use(express.json()); // Middleware to parse JSON in request body

// Initialize the OpenAI instance
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

let assistant;
let thread;

(async function initializeOpenAI() {
    try {
        assistant = await openai.beta.assistants.retrieve(process.env.ASSISTANT_ID);
        thread = await openai.beta.threads.create();
    } catch (error) {
        console.error('Error initializing OpenAI:', error);
    }
})();

// Define a route to handle incoming POST requests with user input
app.post('/processUserMessage', async (req, res) => {
    try {
        if (!assistant || !thread) {
            return res.status(500).json({ error: 'OpenAI not initialized properly' });
        }

        // Get the user input from the request body
        const userInput = req.body.userInput;

        // Use the OpenAI API to process the user's message
        await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: userInput
        });

        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: assistant.id,
            model: "gpt-4o-mini"
        });

        let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

        while (runStatus.status !== "completed") {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        }

        const messages = await openai.beta.threads.messages.list(thread.id);

        const lastMessageForRun = messages.data
            .filter(message => message.run_id === run.id && message.role === "assistant")
            .pop();

        if (!lastMessageForRun || !lastMessageForRun.content || !lastMessageForRun.content[0].text) {
            throw new Error('No valid response from OpenAI');
        }

        const botResponse = lastMessageForRun.content[0].text.value;

        // Send the bot response back to the client
        res.json({ botResponse });
    } catch (error) {
        console.error('Error processing user message:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});

// Start the server and listen on the specified port
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});