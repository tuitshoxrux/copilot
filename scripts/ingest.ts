// scripts/ingest.ts

// Add this at the very top - BEFORE any imports
import { bootstrap } from 'global-agent';

// Set proxy configuration
process.env.GLOBAL_AGENT_HTTP_PROXY = 'http://10.130.20.251:2002';
process.env.GLOBAL_AGENT_HTTPS_PROXY = 'http://10.130.20.251:2002';
process.env.GLOBAL_AGENT_NO_PROXY = '';
bootstrap();

import { createClient } from "@supabase/supabase-js";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { DirectoryLoader } from "@langchain/classic/document_loaders/fs/directory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const googleAiApiKey = process.env.GOOGLE_AI_API_KEY;

console.log("Environment check:");
console.log("- Supabase URL:", supabaseUrl ? "✓" : "✗ MISSING");
console.log("- Supabase Key:", supabaseServiceKey ? "✓" : "✗ MISSING");
console.log("- Google AI Key:", googleAiApiKey ? "✓" : "✗ MISSING");
console.log("- Proxy:", process.env.GLOBAL_AGENT_HTTP_PROXY);

if (!supabaseUrl || !supabaseServiceKey || !googleAiApiKey) {
  throw new Error("Missing env variables.");
}

async function main() {
  console.log("\nStarting ingestion process...");
  
  const client = createClient(supabaseUrl, supabaseServiceKey);
  console.log("Supabase client initialized.");

  // Test connection first
  console.log("Testing Supabase connection...");
  const { error: testError } = await client.from("documents").select("count").limit(1);
  if (testError) {
    console.error("❌ Supabase connection test failed:", testError);
    throw testError;
  }
  console.log("✅ Supabase connection successful!");

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: googleAiApiKey,
    model: "text-embedding-004",
  });
  console.log("Google AI Embeddings initialized.");

  const loader = new DirectoryLoader(
    "./data",
    { ".docx": (path) => new DocxLoader(path) },
    true
  );
  const docs = await loader.load();
  console.log(`Loaded ${docs.length} document(s).`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const splitDocs = await splitter.splitDocuments(docs);
  console.log(`Split documents into ${splitDocs.length} chunks.`);

  console.log("Embedding documents and uploading to Supabase...");
  
  try {
    await SupabaseVectorStore.fromDocuments(
      splitDocs,
      embeddings,
      {
        client,
        tableName: "documents",
        queryName: "match_documents",
      }
    );
    console.log("✅ Success! Your documents have been ingested.");
  } catch (err: any) {
    console.error("❌ Detailed error:", err);
    if (err.cause) console.error("Cause:", err.cause);
    throw err;
  }
}

main().catch((err) => {
  console.error("❌ Error during ingestion:", err);
  process.exit(1);
});