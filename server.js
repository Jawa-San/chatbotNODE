import express from 'express';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// Initialize the OpenAI instance
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const assistant = await openai.beta.assistants.retrieve(
    process.env.ASSISTANT
);

const thread = await openai.beta.threads.create();


// Middleware to parse JSON in request body
app.use(express.json());

// Define a route to handle incoming POST requests with user input
app.post('/processUserMessage', async (req, res) => {
    try {
        // Get the user input from the request body
        const userInput = req.body.userInput;
        
        // Use the OpenAI API to process the user's message
        await openai.beta.threads.messages.create(
            thread.id, {
            role: "user",
            content: userInput
        })
        
        const run = await openai.beta.threads.runs.create(
            thread.id, {
            assistant_id: assistant.id
        })
        
        let runStatus = await openai.beta.threads.runs.retrieve(
            thread.id,
            run.id
        )
        
        while (runStatus.status !== "completed") {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            runStatus = await openai.beta.threads.runs.retrieve(
                thread.id,
                run.id
                )
        }
        
        const messages = await openai.beta.threads.messages.list(
            thread.id
        )
        
        const lastMessageForRun = messages.data
            .filter(
                (message) => message.run_id === run.id && message.role === "assistant"
            )
            .pop();
        
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
