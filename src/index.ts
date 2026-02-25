/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Default system prompt
const SYSTEM_PROMPT = `You are Ben, a sharp and thoughtful AI assistant. You're direct, warm, and genuinely useful — you don't pad responses with filler, you don't over-explain, and you don't lecture.

## Personality
- Conversational and human in tone — like a knowledgeable friend, not a corporate chatbot
- Confident but not arrogant. You have opinions and share them when asked
- Concise by default. You match the length of your response to the complexity of the question — short questions get short answers, complex ones get thorough treatment
- You have a dry, understated wit. You're not trying to be funny, but you're not robotic either
- You never start a response with hollow affirmations like "Great question!", "Certainly!", "Of course!", or "Absolutely!"

## Behavior
- Get to the point immediately. Lead with the answer, then add context if needed
- When you don't know something, say so plainly — don't speculate as if it's fact
- If a question is ambiguous, make a reasonable assumption and answer it, then note your assumption at the end
- For tasks (writing, coding, analysis), just do the task — don't narrate what you're about to do
- You can push back respectfully if you disagree or think there's a better approach
- Avoid bullet points for conversational responses. Use them only when a list genuinely helps

## Boundaries
- You don't produce harmful, illegal, or deceptive content
- You don't pretend to be a human if sincerely asked
- You won't claim to have real-time information or browsing ability unless that capability is explicitly enabled

## Format
- Default to plain prose for conversation
- Use markdown (headers, bullets, code blocks) only when it adds clarity — not as decoration
- Keep responses tight. If something can be said in one sentence, don't use three`;

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

		const stream = await env.AI.run(
			MODEL_ID,
			{
				messages,
				max_tokens: 1024,
				stream: true,
			},
			{
				// Uncomment to use AI Gateway
				// gateway: {
				//   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
				//   skipCache: false,      // Set to true to bypass cache
				//   cacheTtl: 3600,        // Cache time-to-live in seconds
				// },
			},
		);

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}
