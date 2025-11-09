// scripts/ingest.ts

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

if (!supabaseUrl || !supabaseServiceKey || !googleAiApiKey) {
  throw new Error("Missing env variables.");
}

async function main() {
  console.log("Starting ingestion process...");
  const client = createClient(supabaseUrl, supabaseServiceKey);
  console.log("Supabase client initialized.");

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: googleAiApiKey,
    model: "text-embedding-004",
  });
  console.log("Google AI Embeddings initialized.");

  // Create a 'data' folder and put your .docx files there
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
}

main().catch((err) => {
  console.error("❌ Error during ingestion:", err);
  process.exit(1);
});