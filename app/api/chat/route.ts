import { createClient } from "@supabase/supabase-js";
import { ChatGroq } from "@langchain/groq";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATE = `You are a helpful AI assistant. Answer the user's question based *only* on the provided context.
Respond in the same language as the user's question.
If the context does not contain the answer, state that you cannot find the answer in the provided documents.

Context:
{context}

Current conversation:
{chat_history}

User: {question}
Answer:`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const groqApiKey = process.env.GROQ_API_KEY!;
    const googleAiApiKey = process.env.GOOGLE_AI_API_KEY!;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: googleAiApiKey,
      model: "text-embedding-004",
    });

    // Updated to use llama-3.3-70b-versatile (current Groq model)
    const model = new ChatGroq({
      apiKey: groqApiKey,
      model: "llama-3.3-70b-versatile",
      streaming: true,
      temperature: 0.3,
    });

    // Format chat history
    const chatHistory = messages
      .slice(0, -1)
      .map((m: any) => `${m.role}: ${m.content}`)
      .join("\n");
    const question = messages[messages.length - 1].content;

    // Get embedding for the question
    const questionEmbedding = await embeddings.embedQuery(question);

    // Call your custom match_documents function directly
    const { data: relevantDocs, error } = await supabaseClient.rpc(
      "match_documents",
      {
        query_embedding: questionEmbedding,
        match_threshold: 0.5, // Adjust this threshold as needed
        match_count: 4,
      }
    );

    if (error) {
      console.error("Supabase RPC error:", error);
      throw new Error(`Error searching for documents: ${error.message}`);
    }

    if (!relevantDocs || relevantDocs.length === 0) {
      return Response.json({
        error: "No relevant documents found. Please make sure you have run the ingestion script.",
      }, { status: 404 });
    }

    // Fetch full documents with metadata
    const docIds = relevantDocs.map((doc: any) => doc.id);
    const { data: fullDocs } = await supabaseClient
      .from("documents")
      .select("*")
      .in("id", docIds);

    const context = relevantDocs.map((doc: any) => doc.content).join("\n\n");

    // Create the prompt
    const prompt = ChatPromptTemplate.fromTemplate(TEMPLATE);

    // Create the chain
    const ragChain = RunnableSequence.from([
      prompt,
      model,
      new StringOutputParser(),
    ]);

    // Create streaming response
    const stream = await ragChain.stream({
      question: question,
      chat_history: chatHistory,
      context: context,
    });

    // Create a custom readable stream
    const encoder = new TextEncoder();

    const customStream = new ReadableStream({
      async start(controller) {
        // Send sources as data first
        const sourcesData = {
          sources: (fullDocs || relevantDocs).map((doc: any) => ({
            content: doc.content,
            metadata: doc.metadata || {},
          })),
        };
        controller.enqueue(encoder.encode(`d:${JSON.stringify(sourcesData)}\n`));

        // Stream the text response
        try {
          for await (const chunk of stream) {
            // Escape any quotes in the chunk
            const escapedChunk = chunk.replace(/"/g, '\\"');
            controller.enqueue(encoder.encode(`0:"${escapedChunk}"\n`));
          }
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(customStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (e: any) {
    console.error("Chat API Error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}