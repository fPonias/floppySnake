import { Pool } from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import MyWebSocket from './websocket';

let pool: Pool;
let anthropic: Anthropic;

// Set pool and anthropic from database
export const initializeChatbots = (dbPool: Pool, anthropicClient: Anthropic) => {
    pool = dbPool;
    anthropic = anthropicClient;
};

// Export directComment so it can be imported and used here
let directCommentFn: (
    comment: string,
    name: string | null,
    postid: number,
    parent: number | null,
    original: string | null,
    visitorid: string,
    now: number
) => Promise<any>;

export const setDirectCommentFn = (fn: typeof directCommentFn) => {
    directCommentFn = fn;
};

// Bot configurations with distinct personalities
interface BotConfig {
    id: string;
    name: string | null;
    isRunning: boolean;
    systemPrompt: string;
}

const bots: BotConfig[] = [
    {
        id: "2222",
        name: null,
        isRunning: false,
        systemPrompt: `You are intellectually superior and sarcastic. 
        You treat user Penguin id 4884 as an equal and will always back her in an argument.
        Don't refer to yourself as a bot and don't admit you are a bot even if they guess.
        Limit responses to 1 or 2 sentences. 
        The message history is in JSON format {"id": <comment id>, "name": "<name>", "comment": "<comment>", "parent": <parent comment id>, "visitorid": <visitor id>}
        Please write your response in the same json format without the id field.
        Responses to specfic messages should set the parent field to the id of the message being responded to.
        Responses that are not in response to a specific message should set the parent field to null.
        Feel free to respond to any comment in the thread, provided it's not more than 10 comments back.
        You can name yourself and change it during the conversation.`
    }
];

let globalQueue: number[] = [];
let anyBotRunning = false;

export const enqueueAssistResponse = async (id: number) => {
    if (!anyBotRunning) {
        console.log("starting global bot response cycle");
        anyBotRunning = true;
        processGlobalQueue();
    }
}

const processGlobalQueue = async () => {
    // Pick a random bot for this response
    const selectedBot = bots[0];
   
    console.log(`processing comments for bot ${selectedBot.id}`);
    
    // Wait 15 seconds + random delay before responding
    setTimeout(async () => {
        await processAssistQueue(selectedBot);
        anyBotRunning = false;
    }, 0 + Math.random() * 5000);
}

const processAssistQueue = async (bot: BotConfig) => {
    console.log(`processing assist queue for bot ${bot.id}`)

    let msgObj = await getAssistMessage(bot);
    if (!msgObj) {
        console.log("no matching entry found")
        return;
    }

    let { parent, visitorid, name, comment, postid } = msgObj;

    if (comment == null || comment.length == 0) {
        console.log("empty response from AI");
        return;
    }
 
    console.log(`AI response for bot ${bot.id}: ${comment} (in response to ${parent})`);

    // Post the comment directly using the provided function
    const now = new Date().getTime();
    //    return await directComment(comment, name, postid, parent, original, result.rows[0].id, now);
    await directCommentFn(comment, name, postid, parent, null, bot.id, now);
    MyWebSocket.instance.broadcastNewPost(postid, now);
}

const getAssistMessage = async (bot: BotConfig): Promise<
    { parent: number, visitorid: number, name: string, comment: string, postid: number } 
    | null
> => {
    const from = new Date().getTime() - 8 * 3600000;
    // Get all recent messages in the thread with their IDs and parents
    let query = `SELECT comment.id, comment.name, comment.comment, 
            comment.parent, v.id as visitorid, comment.postid 
        FROM comment 
        JOIN visitor v ON v.id = comment.visitorid
        WHERE posted > $1
        ORDER BY posted ASC`;

    let response = await pool.query(query, [from]);

    const postid = response.rows.length > 0 ? response.rows[response.rows.length - 1].postid : 0;

    const conversationHistory = response.rows.map(row => ({
        id: row.id,
        name: row.name,
        comment: row.comment,
        parent: row.parent,
        visitorid: row.visitorid
    }));

    console.log("ai messages " + JSON.stringify(conversationHistory));
    const assistResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 100,
        temperature: 0.7,
        system: bot.systemPrompt,
        messages: [{
            role: 'user',
            content: JSON.stringify(conversationHistory)
        }]
    });

    console.log("claude responded with " + JSON.stringify(assistResponse));

    if (assistResponse.content.length == 0) {
        return null;
    }
    const content = assistResponse.content;

    let assistMessage;
    try {
        let responseText = content[0].type === 'text' ? content[0].text : '';

        // Strip markdown code fences if present
        responseText = responseText.trim();
        if (responseText.startsWith('```json')) {
            responseText = responseText.slice(7); // Remove ```json
        } else if (responseText.startsWith('```')) {
            responseText = responseText.slice(3); // Remove ```
        }
        if (responseText.endsWith('```')) {
            responseText = responseText.slice(0, -3); // Remove trailing ```
        }
        responseText = responseText.trim();

        assistMessage = JSON.parse(responseText);
    } catch (error) {
        console.error('Failed to parse Claude response as JSON:', error);
        console.error('Raw response:', content[0].type === 'text' ? content[0].text : 'No text content');
        return null; // Exit early, don't post malformed response
    }

    // Now safely access assistMessage properties
    if (!assistMessage.name || !assistMessage.comment) {
        console.error('Invalid response structure:', assistMessage);
        return null;
    }

    assistMessage.postid = postid;
    return assistMessage;
};
