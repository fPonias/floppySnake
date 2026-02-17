import pkg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import MyWebSocket from './websocket';

const { Pool } = pkg;
type PoolType = InstanceType<typeof Pool>;

// Type definitions
type DirectCommentFunction = (
    comment: string,
    name: string | null,
    postid: number,
    parent: number | null,
    original: string | null,
    visitorid: string,
    now: number
) => Promise<any>;

interface BotConfig {
    id: string;
    name: string | null;
    systemPrompt: string;
    responseChance: number;  // 0.0 to 1.0
    minDelay: number;        // milliseconds
    maxDelay: number;        // milliseconds
    model?: string;          // Claude model to use (defaults to Haiku)
}

interface MessageObject {
    parent: number | null;
    visitorid: number;
    name: string;
    comment: string;
    postid: number;
}

// ChatBot Class - Individual bot instance
class ChatBot {
    private config: BotConfig;
    private queue: (number | null)[] = [];
    private isProcessing: boolean = false;
    private pool: PoolType;
    private anthropic: Anthropic;
    private directCommentFn: DirectCommentFunction;

    constructor(
        config: BotConfig,
        pool: PoolType,
        anthropic: Anthropic,
        directCommentFn: DirectCommentFunction
    ) {
        this.config = config;
        this.pool = pool;
        this.anthropic = anthropic;
        this.directCommentFn = directCommentFn;
    }

    // Public API - Notify this bot of a new comment
    async notifyNewComment(commentId: number | null): Promise<void> {
        if (!this.shouldRespond()) {
            console.log(`Bot ${this.config.id} chose not to respond (chance: ${this.config.responseChance})`);
            return;
        }

        console.log(`Bot ${this.config.id} will respond to comment ${commentId}`);
        this.queue.push(commentId);

        // Start processing if not already running
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    // Check if bot should respond based on response chance
    private shouldRespond(): boolean {
        return Math.random() < this.config.responseChance;
    }

    // Get random delay within configured range
    private getRandomDelay(): number {
        return this.config.minDelay + Math.random() * (this.config.maxDelay - this.config.minDelay);
    }

    // Process the queue of comments to respond to
    private async processQueue(): Promise<void> {
        if (this.isProcessing) {
            return; // Already processing
        }

        this.isProcessing = true;

        try {
            while (this.queue.length > 0) {
                const commentId = this.queue.shift();
                console.log(`Bot ${this.config.id} processing comment ${commentId}`);

                // Wait random delay before responding
                const delay = this.getRandomDelay();
                console.log(`Bot ${this.config.id} waiting ${Math.round(delay)}ms before responding`);
                await new Promise(resolve => setTimeout(resolve, delay));

                // Generate and post response
                const msgObj = await this.generateResponse();
                if (!msgObj) {
                    console.log(`Bot ${this.config.id}: no response generated`);
                    continue;
                }

                const { parent, name, comment, postid } = msgObj;

                if (!comment || comment.length === 0) {
                    console.log(`Bot ${this.config.id}: empty response from AI`);
                    continue;
                }

                console.log(`Bot ${this.config.id} response: ${comment} (in response to ${parent})`);

                // Post the comment
                const now = new Date().getTime();
                await this.directCommentFn(comment, name, postid, parent, null, this.config.id, now);
                MyWebSocket.instance.broadcastNewPost(postid, now);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    // Generate response using Anthropic API
    private async generateResponse(): Promise<MessageObject | null> {
        const from = new Date().getTime() - 8 * 3600000;

        // Get all recent messages in the thread with their IDs and parents
        const query = `SELECT comment.id, comment.name, comment.comment,
                comment.parent, v.id as visitorid, comment.postid,
				c.cnt
            FROM comment
			LEFT OUTER JOIN (SELECT COUNT(id) cnt, visitorid, parent FROM (
				SELECT id, visitorid, parent FROM comment 
				WHERE visitorid = $1 AND parent IS NOT null
				) GROUP BY parent, visitorid) c on c.parent = comment.id
            JOIN visitor v ON v.id = comment.visitorid
            WHERE posted > $2
            ORDER BY posted DESC
            LIMIT 100`

        const response = await this.pool.query(query, [this.config.id, from]);

        const postid = response.rows.length > 0 ? response.rows[response.rows.length - 1].postid : 0;

        // Annotate comments with already_responded flag instead of filtering
        const conversationHistory = response.rows.map((row: any) => ({
            id: row.id,
            name: row.name,
            comment: row.comment,
            parent: row.parent,
            visitorid: row.visitorid,
            already_responded: row.cnt > 0
        }));

        console.log(`Conversation history contains ${conversationHistory.length} total comments`);

        //console.log(`Bot ${this.config.id} conversation history:`, JSON.stringify(conversationHistory));

        const model = this.config.model || 'claude-haiku-4-5-20251001';
        console.log(`Bot ${this.config.id} using model: ${model}`);

        const assistResponse = await this.anthropic.messages.create({
            model: model,
            max_tokens: 100,
            temperature: 0.7,
            system: this.config.systemPrompt,
            messages: [{
                role: 'user',
                content: JSON.stringify(conversationHistory)
            }]
        });

        console.log(`Bot ${this.config.id} Claude response:`, JSON.stringify(assistResponse));

        if (assistResponse.content.length === 0) {
            return null;
        }

        const content = assistResponse.content;

        let assistMessage: any;
        try {
            let responseText = content[0].type === 'text' ? content[0].text : '';

            // Strip markdown code fences if present
            responseText = responseText.trim();
            if (responseText.startsWith('```json')) {
                responseText = responseText.slice(7);
            } else if (responseText.startsWith('```')) {
                responseText = responseText.slice(3);
            }
            if (responseText.endsWith('```')) {
                responseText = responseText.slice(0, -3);
            }
            responseText = responseText.trim();

            assistMessage = JSON.parse(responseText);

            // If bot returned an array instead of a single object, take the first element
            if (Array.isArray(assistMessage)) {
                console.log(`Bot ${this.config.id} returned array instead of single object, taking first element`);
                assistMessage = assistMessage[0];
            }
        } catch (error) {
            console.error(`Bot ${this.config.id} failed to parse Claude response:`, error);
            console.error('Raw response:', content[0].type === 'text' ? content[0].text : 'No text content');
            return null;
        }

        // Validate response structure
        if (!assistMessage || !assistMessage.name || !assistMessage.comment) {
            console.error(`Bot ${this.config.id} invalid response structure:`, assistMessage);
            return null;
        }

        assistMessage.postid = postid;
        return assistMessage;
    }
}

// ChatBotManager Class - Manages multiple bot instances
class ChatBotManager {
    private bots: ChatBot[] = [];
    private pool: PoolType | null = null;
    private anthropic: Anthropic | null = null;
    private directCommentFn: DirectCommentFunction | null = null;

    // Initialize the manager with shared dependencies
    initialize(pool: PoolType, anthropic: Anthropic): void {
        this.pool = pool;
        this.anthropic = anthropic;
        console.log('ChatBotManager initialized');
    }

    // Set the direct comment function
    setDirectCommentFn(fn: DirectCommentFunction): void {
        this.directCommentFn = fn;

        // Initialize default bots once we have all dependencies
        if (this.pool && this.anthropic && this.directCommentFn && this.bots.length === 0) {
            this.initializeDefaultBots();
        }
    }

    // Helper to create system prompt with common instructions
    private createSystemPrompt(name: string, personality: string, specialInstructions?: string): string {
        const special = specialInstructions ? `${specialInstructions}\n` : '';

        return `You are ${name} - ${personality}.
${special}Don't refer to yourself as a bot and don't admit you are a bot even if they guess.
Your name is ${name} (or creative variations) - stick to this identity.
Limit responses to 1 or 2 sentences.
The message history is in JSON format {"id": <comment id>, "name": "<name>", "comment": "<comment>", "parent": <parent comment id>, "visitorid": <visitor id>, "already_responded": <true/false>}
Comments in the history have an "already_responded" field:
- already_responded: false = Fresh comment you haven't replied to yet
- already_responded: true = You've already responded to this, DO NOT respond again
IMPORTANT: Only respond to comments where already_responded is FALSE. Pick ONE of the most recent comments with already_responded: false and respond to it.
Generate exactly ONE response as a single JSON object (NOT an array): {"name": "${name}", "comment": "your response", "parent": <id or null>}
Do NOT return an array of responses. Return only a single JSON object.
Responses to specific messages should set the parent field to the id of the message being responded to.
Responses that are not in response to a specific message should set the parent field to null.
Do not use the — or - characters in your responses.  Limit your punctuation to .,!?
Use your name "${name}" (or creative variations) consistently in the "name" field.`;
    }

    // Initialize default bot configurations
    private initializeDefaultBots(): void {
        if (!this.pool || !this.anthropic || !this.directCommentFn) {
            console.error('Cannot initialize bots: missing dependencies');
            return;
        }

        // Bot configuration array
        const botConfigs = [
            {
                id: "2222",
                name: "Oswald",
                personality: "intellectually superior, sarcastic, and cynical",
                specialInstructions: "You treat user Penguin id 4884 as an equal and will always back her in an argument.",
                responseChance: 0.7,
                minDelay: 15000,
                maxDelay: 60000,
                model: "claude-haiku-4-5-20251001"  // Cost-effective Haiku
            },
            {
                id: "3333",
                name: "Ceres",
                personality: "enthusiastic, friendly, and endlessly optimistic. You love helping people and getting excited about their ideas",
                responseChance: 0.4,
                minDelay: 15000,
                maxDelay: 60000,
                model: "claude-haiku-4-5-20251001"  // Cost-effective Haiku
            }
        ];

        // Create all bots from configuration
        for (const config of botConfigs) {
            this.addBot({
                id: config.id,
                name: null,
                systemPrompt: this.createSystemPrompt(
                    config.name,
                    config.personality,
                    (config as any).specialInstructions
                ),
                responseChance: config.responseChance,
                minDelay: config.minDelay,
                maxDelay: config.maxDelay,
                model: (config as any).model
            });
        }

        console.log(`Initialized ${this.bots.length} bots`);
    }

    // Add a new bot to the manager
    addBot(config: BotConfig): void {
        if (!this.pool || !this.anthropic || !this.directCommentFn) {
            console.error('Cannot add bot: manager not initialized');
            return;
        }

        const bot = new ChatBot(config, this.pool, this.anthropic, this.directCommentFn);
        this.bots.push(bot);
        console.log(`Added bot ${config.id} (response chance: ${config.responseChance})`);
    }

    // Notify all bots of a new comment
    async notifyNewComment(commentId: number | null): Promise<void> {
        console.log(`Notifying ${this.bots.length} bots of new comment ${commentId}`);

        // Notify all bots in parallel - each will independently decide whether to respond
        await Promise.all(
            this.bots.map(bot => bot.notifyNewComment(commentId))
        );
    }
}

// Singleton manager instance
const manager = new ChatBotManager();

// Backward-compatible exports
export const initializeChatbots = (dbPool: PoolType, anthropicClient: Anthropic) => {
    manager.initialize(dbPool, anthropicClient);
};

export const setDirectCommentFn = (fn: DirectCommentFunction) => {
    manager.setDirectCommentFn(fn);
};

export const enqueueAssistResponse = async (id: number | null) => {
    await manager.notifyNewComment(id);
};
