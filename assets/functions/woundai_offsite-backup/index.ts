import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
const enc = (s: string) => new TextEncoder().encode(s);
const awsEncode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
async function hmac(key: ArrayBuffer | Uint8Array, message: string) {
  const raw = key instanceof Uint8Array ? key : new Uint8Array(key);
  const cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, enc(message)));
}
async function signingKey(secret: string, date: string, region: string) {
  const kDate = await hmac(enc(`AWS4${secret}`), date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}
function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server secret: ${name}`);
  return value;
}
function objectKey(clinicId: string, backupId: string) {
  const prefix = (Deno.env.get("S3_PREFIX") || "woundai-offsite").replace(/^\/+|\/+$/g, "");
  return `${prefix}/${clinicId}/${backupId}.wbackup`;
}
async function presign(method: "PUT" | "GET" | "HEAD", key: string, expires = 300, extraHeaders: Record<string,string> = {}) {
  const endpoint = new URL(env("S3_ENDPOINT"));
  const bucket = env("S3_BUCKET");
  const region = env("S3_REGION");
  const access = env("S3_ACCESS_KEY_ID");
  const secret = env("S3_SECRET_ACCESS_KEY");
  const base = endpoint.pathname.replace(/\/+$/g, "");
  const canonicalUri = `${base}/${awsEncode(bucket)}/${key.split("/").map(awsEncode).join("/")}`;
  const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = stamp.slice(0, 8);
  const credential = `${access}/${date}/${region}/s3/aws4_request`;
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": stamp,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": ["host",...Object.keys(extraHeaders).map(x=>x.toLowerCase()).sort()].join(";"),
  };
  const canonicalQuery = Object.keys(params).sort().map(k => `${awsEncode(k)}=${awsEncode(params[k])}`).join("&");
  const canonicalHeaders = `host:${endpoint.host}\n` + Object.keys(extraHeaders).map(x=>x.toLowerCase()).sort()
    .map(name=>`${name}:${String(extraHeaders[name] || "").trim()}\n`).join("");
  const signedHeaders = params["X-Amz-SignedHeaders"];
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
  const scope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${hex(await crypto.subtle.digest("SHA-256", enc(canonicalRequest)))}`;
  const keyBytes = await signingKey(secret, date, region);
  const signature = hex(await hmac(keyBytes, stringToSign));
  const url = new URL(endpoint.origin);
  url.pathname = canonicalUri;
  url.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  return url.toString();
}
async function authorized(req: Request, clinicId: string) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Authentication required.");
  const supabaseUrl = env("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || env("SUPABASE_PUBLISHABLE_KEY");
  const userClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const token = auth.slice("Bearer ".length);
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) throw new Error("Invalid user session.");
  const { data: membership, error } = await userClient.from("clinic_members").select("role")
    .eq("clinic_id", clinicId).eq("user_id", user.id).maybeSingle();
  if (error || !membership || !["owner", "admin"].includes(membership.role)) throw new Error("Only clinic owner/admin can manage off-site backups.");
  return { user, userClient };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const clinicId = String(body.clinic_id || "");
    if (!uuid.test(clinicId)) return json({ error: "Invalid clinic_id." }, 400);
    const { user, userClient } = await authorized(req, clinicId);
    if (action === "list") {
      const { data, error } = await userClient.from("clinic_offsite_backups")
        .select("id,clinic_id,object_key,bytes,sha256,created_by,created_at,verified_at")
        .eq("clinic_id", clinicId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ backups: data || [] });
    }
    const backupId = String(body.backup_id || "");
    if (!uuid.test(backupId)) return json({ error: "Invalid backup_id." }, 400);
    const key = objectKey(clinicId, backupId);
    if (action === "sign-put") {
      const bytes = Number(body.bytes);
      const sha256 = String(body.sha256 || "");
      if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > 524288000) return json({ error: "Backup size must be between 1 byte and 500 MiB." }, 400);
      if (!/^[0-9a-f]{64}$/.test(sha256)) return json({ error: "Invalid SHA-256." }, 400);
      return json({ upload_url: await presign("PUT", key, 300, {"x-amz-meta-woundai-sha256":sha256}), object_key: key, upload_headers:{"x-amz-meta-woundai-sha256":sha256}, expires_in: 300 });
    }
    if (action === "complete") {
      const bytes = Number(body.bytes), sha256 = String(body.sha256 || "");
      if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > 524288000 || !/^[0-9a-f]{64}$/.test(sha256)) return json({ error: "Invalid backup metadata." }, 400);
      const headUrl = await presign("HEAD", key, 120);
      const head = await fetch(headUrl, { method: "HEAD" });
      if (!head.ok) return json({ error: `External object verification failed (${head.status}).` }, 502);
      const actual = Number(head.headers.get("content-length") || 0);
      const storedHash = head.headers.get("x-amz-meta-woundai-sha256");
      if (actual !== bytes) return json({ error: "External object size does not match the uploaded backup." }, 409);
      if (storedHash !== sha256) return json({ error: "External object SHA-256 metadata does not match the uploaded backup." }, 409);
      const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
      const { data: existing, error: lookupError } = await service.from("clinic_offsite_backups")
        .select("id,clinic_id,object_key,bytes,sha256").eq("id",backupId).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        if (existing.clinic_id!==clinicId || existing.object_key!==key || Number(existing.bytes)!==bytes || existing.sha256!==sha256) {
          throw new Error("Backup identifier is already bound to different metadata.");
        }
        return json({ ok: true, backup_id: backupId, bytes, size_verified: true, idempotent: true });
      }
      const { error } = await service.from("clinic_offsite_backups").insert({
        id: backupId, clinic_id: clinicId, object_key: key, bytes, sha256,
        created_by: user.id, verified_at: new Date().toISOString(),
      });
      if (error) throw error;
      return json({ ok: true, backup_id: backupId, bytes, size_verified: true });
    }
    if (action === "sign-get") {
      const { data, error } = await userClient.from("clinic_offsite_backups").select("object_key")
        .eq("clinic_id", clinicId).eq("id", backupId).maybeSingle();
      if (error || !data) return json({ error: "Backup not found." }, 404);
      return json({ download_url: await presign("GET", data.object_key, 300), expires_in: 300 });
    }
    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    return json({ error: String((error as Error)?.message || error).slice(0, 500) }, 400);
  }
});
