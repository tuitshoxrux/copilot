import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log("Testing Supabase connection...");
console.log("URL:", supabaseUrl);
console.log("Key exists:", !!supabaseServiceKey);
console.log("Key prefix:", supabaseServiceKey?.substring(0, 20) + "...");

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing environment variables!");
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  try {
    const { data, error } = await client.from("documents").select("count");
    if (error) {
      console.error("❌ Supabase error:", error);
    } else {
      console.log("✅ Connection successful!");
      console.log("Data:", data);
    }
  } catch (err) {
    console.error("❌ Connection failed:", err);
  }
}

test();