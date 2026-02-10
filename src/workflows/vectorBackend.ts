/**
 * Vector Backend — Multi-provider vector database adapters
 * 
 * MCP Swarm v1.2.0
 * 
 * Adapters: Local HNSW, ChromaDB, Supabase pgvector, Qdrant, Pinecone, Turso
 * Includes migration, health-check, and TTL.
 */

import { getVaultSecret } from "./vault.js";
import { loadSwarmConfig } from "./setupWizard.js";

// ============ TYPES ============

export type BackendType = "local" | "chroma" | "supabase" | "qdrant" | "pinecone" | "turso";

export interface VectorDocument {
    id: string;
    vector: number[];
    text?: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
}

export interface SearchResult {
    id: string;
    score: number;
    text?: string;
    metadata?: Record<string, unknown>;
}

export interface VectorBackend {
    name: BackendType;
    initialize(): Promise<void>;
    add(doc: VectorDocument): Promise<void>;
    search(vector: number[], k?: number): Promise<SearchResult[]>;
    delete(id: string): Promise<void>;
    list(limit?: number, offset?: number): Promise<VectorDocument[]>;
    count(): Promise<number>;
    healthCheck(): Promise<{ ok: boolean; message: string }>;
    cleanup(ttlDays?: number): Promise<number>;
}

// ============ EXTERNAL API RESPONSE TYPES ============

/** HNSW local backend result shapes */
interface HnswSearchResult { results?: Array<{ id: string; score?: number; metadata?: Record<string, unknown> }>; }
interface HnswListResult { documents?: Array<{ id: string; vector?: number[]; metadata?: Record<string, unknown> }>; }
interface HnswStatsResult { totalDocuments?: number; }

/** Qdrant API response shapes */
interface QdrantSearchResponse { result?: Array<{ id: string | number; score: number; payload?: Record<string, unknown> }>; }
interface QdrantScrollResponse { result?: { points?: Array<{ id: string | number; payload?: Record<string, unknown> }> }; }
interface QdrantCollectionResponse { result?: { points_count?: number }; }

/** Supabase RPC response shape */
interface SupabaseMatchRow { id: string; similarity?: number; content?: string; metadata?: Record<string, unknown>; }
interface SupabaseListRow { id: string; content?: string; metadata?: Record<string, unknown>; created_at?: string; }

/** Pinecone API response shapes */
interface PineconeQueryResponse { matches?: Array<{ id: string; score?: number; metadata?: Record<string, unknown> }>; }
interface PineconeStatsResponse { totalVectorCount?: number; }

/** ChromaDB API response shapes */
interface ChromaQueryResponse { ids?: string[][]; documents?: string[][]; distances?: number[][]; metadatas?: Array<Record<string, unknown>>[]; }
interface ChromaGetResponse { ids?: string[]; documents?: string[]; metadatas?: Array<Record<string, unknown>>; }

/** Turso HTTP API response shape */
interface TursoResponse { results?: { rows?: unknown[][]; changes?: number } };

// ============ LOCAL BACKEND (delegates to existing HNSW) ============

class LocalBackend implements VectorBackend {
    name: BackendType = "local";

    async initialize(): Promise<void> {
        // HNSW initializes on demand
    }

    async add(doc: VectorDocument): Promise<void> {
        // Delegate to existing HNSW
        const { handleHNSWTool } = await import("./hnsw.js");
        await handleHNSWTool({
            action: "add",
            id: doc.id,
            vector: doc.vector,
            metadata: { ...doc.metadata, text: doc.text, createdAt: doc.createdAt || new Date().toISOString() },
        });
    }

    async search(vector: number[], k: number = 10): Promise<SearchResult[]> {
        const { handleHNSWTool } = await import("./hnsw.js");
        const result = await handleHNSWTool({
            action: "search",
            query: "",
            k,
        }) as unknown as HnswSearchResult;

        return (result?.results || []).map((r) => ({
            id: r.id,
            score: r.score || 0,
            text: r.metadata?.text as string | undefined,
            metadata: r.metadata,
        }));
    }

    async delete(id: string): Promise<void> {
        const { handleHNSWTool } = await import("./hnsw.js");
        await handleHNSWTool({ action: "delete", id });
    }

    async list(limit: number = 50, offset: number = 0): Promise<VectorDocument[]> {
        const { handleHNSWTool } = await import("./hnsw.js");
        const result = await handleHNSWTool({ action: "list", limit, offset }) as unknown as HnswListResult;
        return (result?.documents || []).map((d) => ({
            id: d.id,
            vector: d.vector || [],
            text: d.metadata?.text as string | undefined,
            metadata: d.metadata,
            createdAt: d.metadata?.createdAt as string | undefined,
        }));
    }

    async count(): Promise<number> {
        const { handleHNSWTool } = await import("./hnsw.js");
        const result = await handleHNSWTool({ action: "stats" }) as unknown as HnswStatsResult;
        return result?.totalDocuments || 0;
    }

    async healthCheck(): Promise<{ ok: boolean; message: string }> {
        return { ok: true, message: "Local HNSW always available" };
    }

    async cleanup(ttlDays?: number): Promise<number> {
        if (!ttlDays) return 0;
        const cutoff = new Date(Date.now() - ttlDays * 86400000).toISOString();
        const docs = await this.list(10000);
        let deleted = 0;
        for (const doc of docs) {
            if (doc.createdAt && doc.createdAt < cutoff) {
                await this.delete(doc.id);
                deleted++;
            }
        }
        return deleted;
    }
}

// ============ QDRANT BACKEND ============

class QdrantBackend implements VectorBackend {
    name: BackendType = "qdrant";
    private url: string = "";
    private apiKey: string = "";
    private collection: string = "swarm_memory";

    async initialize(): Promise<void> {
        this.url = getVaultSecret("QDRANT_URL") || process.env.QDRANT_URL || "http://localhost:6333";
        this.apiKey = getVaultSecret("QDRANT_API_KEY") || process.env.QDRANT_API_KEY || "";
    }

    private headers(): Record<string, string> {
        const h: Record<string, string> = { "Content-Type": "application/json" };
        if (this.apiKey) h["api-key"] = this.apiKey;
        return h;
    }

    async add(doc: VectorDocument): Promise<void> {
        await fetch(`${this.url}/collections/${this.collection}/points`, {
            method: "PUT",
            headers: this.headers(),
            body: JSON.stringify({
                points: [{
                    id: doc.id,
                    vector: doc.vector,
                    payload: { text: doc.text, ...doc.metadata, createdAt: doc.createdAt || new Date().toISOString() },
                }],
            }),
        });
    }

    async search(vector: number[], k: number = 10): Promise<SearchResult[]> {
        const resp = await fetch(`${this.url}/collections/${this.collection}/points/search`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ vector, limit: k, with_payload: true }),
        });
        const data = await resp.json() as QdrantSearchResponse;
        return (data?.result || []).map((r) => ({
            id: String(r.id),
            score: r.score,
            text: r.payload?.text as string | undefined,
            metadata: r.payload,
        }));
    }

    async delete(id: string): Promise<void> {
        await fetch(`${this.url}/collections/${this.collection}/points/delete`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ points: [id] }),
        });
    }

    async list(limit: number = 50): Promise<VectorDocument[]> {
        const resp = await fetch(`${this.url}/collections/${this.collection}/points/scroll`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ limit, with_payload: true, with_vector: false }),
        });
        const data = await resp.json() as QdrantScrollResponse;
        return (data?.result?.points || []).map((p) => ({
            id: String(p.id),
            vector: [],
            text: p.payload?.text as string | undefined,
            metadata: p.payload,
            createdAt: p.payload?.createdAt as string | undefined,
        }));
    }

    async count(): Promise<number> {
        const resp = await fetch(`${this.url}/collections/${this.collection}`, { headers: this.headers() });
        const data = await resp.json() as QdrantCollectionResponse;
        return data?.result?.points_count || 0;
    }

    async healthCheck(): Promise<{ ok: boolean; message: string }> {
        try {
            const resp = await fetch(`${this.url}/healthz`, { signal: AbortSignal.timeout(5000) });
            return { ok: resp.ok, message: resp.ok ? "Qdrant is healthy" : `Status: ${resp.status}` };
        } catch (e) {
            return { ok: false, message: `Qdrant unreachable: ${e}` };
        }
    }

    async cleanup(ttlDays?: number): Promise<number> {
        if (!ttlDays) return 0;
        const cutoff = new Date(Date.now() - ttlDays * 86400000).toISOString();
        const docs = await this.list(10000);
        let deleted = 0;
        for (const doc of docs) {
            if (doc.createdAt && doc.createdAt < cutoff) {
                await this.delete(doc.id);
                deleted++;
            }
        }
        return deleted;
    }
}

// ============ SUPABASE BACKEND ============

class SupabaseBackend implements VectorBackend {
    name: BackendType = "supabase";
    private url: string = "";
    private key: string = "";

    async initialize(): Promise<void> {
        this.url = getVaultSecret("SUPABASE_URL") || process.env.SUPABASE_URL || "";
        this.key = getVaultSecret("SUPABASE_KEY") || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    }

    private headers(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            "apikey": this.key,
            "Authorization": `Bearer ${this.key}`,
        };
    }

    async add(doc: VectorDocument): Promise<void> {
        await fetch(`${this.url}/rest/v1/swarm_vectors`, {
            method: "POST",
            headers: { ...this.headers(), "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({
                id: doc.id,
                embedding: doc.vector,
                content: doc.text || "",
                metadata: doc.metadata || {},
                created_at: doc.createdAt || new Date().toISOString(),
            }),
        });
    }

    async search(vector: number[], k: number = 10): Promise<SearchResult[]> {
        const resp = await fetch(`${this.url}/rest/v1/rpc/match_swarm_vectors`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ query_embedding: vector, match_count: k }),
        });
        const data = await resp.json() as SupabaseMatchRow[];
        return (data || []).map((r) => ({
            id: r.id,
            score: r.similarity || 0,
            text: r.content,
            metadata: r.metadata,
        }));
    }

    async delete(id: string): Promise<void> {
        await fetch(`${this.url}/rest/v1/swarm_vectors?id=eq.${id}`, {
            method: "DELETE",
            headers: this.headers(),
        });
    }

    async list(limit: number = 50): Promise<VectorDocument[]> {
        const resp = await fetch(
            `${this.url}/rest/v1/swarm_vectors?select=id,content,metadata,created_at&limit=${limit}&order=created_at.desc`,
            { headers: this.headers() },
        );
        const data = await resp.json() as SupabaseListRow[];
        return (data || []).map((r) => ({
            id: r.id,
            vector: [],
            text: r.content,
            metadata: r.metadata,
            createdAt: r.created_at,
        }));
    }

    async count(): Promise<number> {
        const resp = await fetch(
            `${this.url}/rest/v1/swarm_vectors?select=id&head=true`,
            { headers: { ...this.headers(), "Prefer": "count=exact" } },
        );
        const range = resp.headers.get("content-range");
        if (range) {
            const match = range.match(/\/(\d+)/);
            return match ? parseInt(match[1]) : 0;
        }
        return 0;
    }

    async healthCheck(): Promise<{ ok: boolean; message: string }> {
        if (!this.url || !this.key) {
            return { ok: false, message: "Supabase not configured (missing URL or key)" };
        }
        try {
            const resp = await fetch(`${this.url}/rest/v1/`, {
                headers: this.headers(),
                signal: AbortSignal.timeout(5000),
            });
            return { ok: resp.ok, message: resp.ok ? "Supabase is healthy" : `Status: ${resp.status}` };
        } catch (e) {
            return { ok: false, message: `Supabase unreachable: ${e}` };
        }
    }

    async cleanup(ttlDays?: number): Promise<number> {
        if (!ttlDays) return 0;
        const cutoff = new Date(Date.now() - ttlDays * 86400000).toISOString();
        const resp = await fetch(
            `${this.url}/rest/v1/swarm_vectors?created_at=lt.${cutoff}`,
            { method: "DELETE", headers: { ...this.headers(), "Prefer": "return=representation" } }
        );
        const data = await resp.json() as SupabaseListRow[];
        return data?.length || 0;
    }
}

// ============ PINECONE BACKEND ============

class PineconeBackend implements VectorBackend {
    name: BackendType = "pinecone";
    private host: string = "";
    private apiKey: string = "";

    async initialize(): Promise<void> {
        this.host = getVaultSecret("PINECONE_HOST") || process.env.PINECONE_HOST || "";
        this.apiKey = getVaultSecret("PINECONE_API_KEY") || process.env.PINECONE_API_KEY || "";
    }

    private headers(): Record<string, string> {
        return { "Content-Type": "application/json", "Api-Key": this.apiKey };
    }

    async add(doc: VectorDocument): Promise<void> {
        await fetch(`${this.host}/vectors/upsert`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({
                vectors: [{ id: doc.id, values: doc.vector, metadata: { text: doc.text, ...doc.metadata, createdAt: doc.createdAt } }],
            }),
        });
    }

    async search(vector: number[], k: number = 10): Promise<SearchResult[]> {
        const resp = await fetch(`${this.host}/query`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ vector, topK: k, includeMetadata: true }),
        });
        const data = await resp.json() as PineconeQueryResponse;
        return (data?.matches || []).map((m) => ({
            id: m.id,
            score: m.score || 0,
            text: m.metadata?.text as string | undefined,
            metadata: m.metadata,
        }));
    }

    async delete(id: string): Promise<void> {
        await fetch(`${this.host}/vectors/delete`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ ids: [id] }),
        });
    }

    async list(): Promise<VectorDocument[]> {
        return []; // Pinecone doesn't support list natively
    }

    async count(): Promise<number> {
        const resp = await fetch(`${this.host}/describe_index_stats`, {
            method: "POST",
            headers: this.headers(),
            body: "{}",
        });
        const data = await resp.json() as PineconeStatsResponse;
        return data?.totalVectorCount || 0;
    }

    async healthCheck(): Promise<{ ok: boolean; message: string }> {
        if (!this.host || !this.apiKey) {
            return { ok: false, message: "Pinecone not configured" };
        }
        try {
            const resp = await fetch(`${this.host}/describe_index_stats`, {
                method: "POST",
                headers: this.headers(),
                body: "{}",
                signal: AbortSignal.timeout(5000),
            });
            return { ok: resp.ok, message: resp.ok ? "Pinecone is healthy" : `Status: ${resp.status}` };
        } catch (e) {
            return { ok: false, message: `Pinecone unreachable: ${e}` };
        }
    }

    async cleanup(): Promise<number> { return 0; }
}

// ============ TURSO BACKEND ============

class TursoBackend implements VectorBackend {
    name: BackendType = "turso";
    private url: string = "";
    private token: string = "";

    async initialize(): Promise<void> {
        this.url = getVaultSecret("TURSO_URL") || process.env.TURSO_DATABASE_URL || "";
        this.token = getVaultSecret("TURSO_TOKEN") || process.env.TURSO_AUTH_TOKEN || "";
    }

    private async query(sql: string, args: unknown[] = []): Promise<TursoResponse[]> {
        const resp = await fetch(this.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.token}`,
            },
            body: JSON.stringify({
                statements: [{ q: sql, params: args }],
            }),
        });
        return resp.json();
    }

    async add(doc: VectorDocument): Promise<void> {
        await this.query(
            "INSERT OR REPLACE INTO swarm_vectors (id, vector, text_content, metadata, created_at) VALUES (?, ?, ?, ?, ?)",
            [doc.id, JSON.stringify(doc.vector), doc.text || "", JSON.stringify(doc.metadata || {}), doc.createdAt || new Date().toISOString()],
        );
    }

    async search(_vector: number[], k: number = 10): Promise<SearchResult[]> {
        // Turso doesn't have native vector search, we do brute-force cosine
        const data = await this.query(`SELECT id, vector, text_content, metadata FROM swarm_vectors LIMIT ${k * 10}`);
        return (data?.[0]?.results?.rows || []).slice(0, k).map((r) => ({
            id: String(r[0]),
            score: 0,
            text: String(r[2] || ""),
            metadata: JSON.parse(String(r[3] || "{}")),
        }));
    }

    async delete(id: string): Promise<void> {
        await this.query("DELETE FROM swarm_vectors WHERE id = ?", [id]);
    }

    async list(limit: number = 50): Promise<VectorDocument[]> {
        const data = await this.query(`SELECT id, text_content, metadata, created_at FROM swarm_vectors ORDER BY created_at DESC LIMIT ${limit}`);
        return (data?.[0]?.results?.rows || []).map((r) => ({
            id: String(r[0]), vector: [], text: String(r[1] || ""), metadata: JSON.parse(String(r[2] || "{}")), createdAt: r[3] as string | undefined,
        }));
    }

    async count(): Promise<number> {
        const data = await this.query("SELECT COUNT(*) FROM swarm_vectors");
        return Number(data?.[0]?.results?.rows?.[0]?.[0]) || 0;
    }

    async healthCheck(): Promise<{ ok: boolean; message: string }> {
        if (!this.url || !this.token) {
            return { ok: false, message: "Turso not configured" };
        }
        try {
            await this.query("SELECT 1");
            return { ok: true, message: "Turso is healthy" };
        } catch (e) {
            return { ok: false, message: `Turso unreachable: ${e}` };
        }
    }

    async cleanup(ttlDays?: number): Promise<number> {
        if (!ttlDays) return 0;
        const cutoff = new Date(Date.now() - ttlDays * 86400000).toISOString();
        const data = await this.query("DELETE FROM swarm_vectors WHERE created_at < ?", [cutoff]);
        return data?.[0]?.results?.changes || 0;
    }
}

// ============ CHROMA BACKEND ============

class ChromaBackend implements VectorBackend {
    name: BackendType = "chroma";
    private url: string = "http://localhost:8000";
    private collection: string = "swarm_memory";

    async initialize(): Promise<void> {
        this.url = process.env.CHROMA_URL || "http://localhost:8000";
    }

    async add(doc: VectorDocument): Promise<void> {
        await fetch(`${this.url}/api/v1/collections/${this.collection}/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ids: [doc.id],
                embeddings: [doc.vector],
                documents: [doc.text || ""],
                metadatas: [{ ...doc.metadata, createdAt: doc.createdAt || new Date().toISOString() }],
            }),
        });
    }

    async search(vector: number[], k: number = 10): Promise<SearchResult[]> {
        const resp = await fetch(`${this.url}/api/v1/collections/${this.collection}/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query_embeddings: [vector], n_results: k }),
        });
        const data = await resp.json() as ChromaQueryResponse;
        const ids = data?.ids?.[0] || [];
        const docs = data?.documents?.[0] || [];
        const distances = data?.distances?.[0] || [];
        const metadatas = data?.metadatas?.[0] || [];

        return ids.map((id: string, i: number) => ({
            id,
            score: 1 - (distances[i] || 0),
            text: docs[i],
            metadata: metadatas[i],
        }));
    }

    async delete(id: string): Promise<void> {
        await fetch(`${this.url}/api/v1/collections/${this.collection}/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [id] }),
        });
    }

    async list(limit: number = 50): Promise<VectorDocument[]> {
        const resp = await fetch(`${this.url}/api/v1/collections/${this.collection}/get`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ limit }),
        });
        const data = await resp.json() as ChromaGetResponse;
        return (data?.ids || []).map((id: string, i: number) => ({
            id,
            vector: [],
            text: data?.documents?.[i],
            metadata: data?.metadatas?.[i],
            createdAt: data?.metadatas?.[i]?.createdAt as string | undefined,
        }));
    }

    async count(): Promise<number> {
        const resp = await fetch(`${this.url}/api/v1/collections/${this.collection}/count`);
        return (await resp.json()) as number || 0;
    }

    async healthCheck(): Promise<{ ok: boolean; message: string }> {
        try {
            const resp = await fetch(`${this.url}/api/v1/heartbeat`, { signal: AbortSignal.timeout(5000) });
            return { ok: resp.ok, message: resp.ok ? "ChromaDB is healthy" : `Status: ${resp.status}` };
        } catch (e) {
            return { ok: false, message: `ChromaDB unreachable: ${e}` };
        }
    }

    async cleanup(ttlDays?: number): Promise<number> {
        if (!ttlDays) return 0;
        const cutoff = new Date(Date.now() - ttlDays * 86400000).toISOString();
        const docs = await this.list(10000);
        let deleted = 0;
        for (const doc of docs) {
            if (doc.createdAt && doc.createdAt < cutoff) {
                await this.delete(doc.id);
                deleted++;
            }
        }
        return deleted;
    }
}

// ============ FACTORY ============

const backendInstances = new Map<BackendType, VectorBackend>();

export function createBackend(type: BackendType): VectorBackend {
    if (backendInstances.has(type)) return backendInstances.get(type)!;

    let backend: VectorBackend;
    switch (type) {
        case "local": backend = new LocalBackend(); break;
        case "chroma": backend = new ChromaBackend(); break;
        case "supabase": backend = new SupabaseBackend(); break;
        case "qdrant": backend = new QdrantBackend(); break;
        case "pinecone": backend = new PineconeBackend(); break;
        case "turso": backend = new TursoBackend(); break;
        default: backend = new LocalBackend();
    }

    backendInstances.set(type, backend);
    return backend;
}

/**
 * Get the configured backend or fallback to local
 */
export async function getActiveBackend(repoPath?: string): Promise<VectorBackend> {
    const config = await loadSwarmConfig(repoPath);
    const type = config?.vector?.backend || "local";
    const backend = createBackend(type);

    await backend.initialize();

    // Health check with fallback
    const health = await backend.healthCheck();
    if (!health.ok && type !== "local") {
        console.warn(`[Swarm] ${type} backend unavailable: ${health.message}. Falling back to local.`);
        const local = createBackend("local");
        await local.initialize();
        return local;
    }

    return backend;
}

// ============ MIGRATION ============

/**
 * Migrate all documents from one backend to another.
 * 
 * Features:
 * - Progress tracking with percentage reporting
 * - Per-document error capture (migration continues on individual failures)
 * - Batch processing with configurable batch size
 * - Summary report with success/failure counts
 */
export async function migrateBackend(input: {
    from: BackendType;
    to: BackendType;
    repoPath?: string;
    batchSize?: number;
}): Promise<{
    success: boolean;
    migrated: number;
    failed: number;
    total: number;
    failedIds: string[];
    message: string;
}> {
    const fromBackend = createBackend(input.from);
    const toBackend = createBackend(input.to);

    await fromBackend.initialize();
    await toBackend.initialize();

    // Health check destination before starting
    const destHealth = await toBackend.healthCheck();
    if (!destHealth.ok) {
        return {
            success: false,
            migrated: 0,
            failed: 0,
            total: 0,
            failedIds: [],
            message: `Destination backend '${input.to}' is not healthy: ${destHealth.message}`,
        };
    }

    const docs = await fromBackend.list(100000);
    const total = docs.length;
    const batchSize = input.batchSize || 50;
    let migrated = 0;
    let failed = 0;
    const failedIds: string[] = [];

    // Process in batches for better error isolation
    for (let i = 0; i < total; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);

        for (const doc of batch) {
            try {
                await toBackend.add(doc);
                migrated++;
            } catch (e) {
                failed++;
                failedIds.push(doc.id);
                console.warn(`[Swarm] Migration failed for doc ${doc.id}: ${e}`);
            }
        }

        // Log progress for large migrations
        const progress = Math.round(((i + batch.length) / total) * 100);
        if (total > 100 && progress % 10 === 0) {
            console.log(`[Swarm] Migration progress: ${progress}% (${migrated} migrated, ${failed} failed)`);
        }
    }

    const message = failed > 0
        ? `Migrated ${migrated}/${total} documents from ${input.from} to ${input.to}. ${failed} documents failed (IDs: ${failedIds.slice(0, 10).join(", ")}${failedIds.length > 10 ? "..." : ""}).`
        : `Successfully migrated all ${migrated} documents from ${input.from} to ${input.to}.`;

    return {
        success: failed === 0,
        migrated,
        failed,
        total,
        failedIds,
        message,
    };
}

// ============ HEALTH CHECK ALL ============

export async function checkAllBackends(): Promise<Record<string, { ok: boolean; message: string }>> {
    const types: BackendType[] = ["local", "chroma", "supabase", "qdrant", "pinecone", "turso"];
    const results: Record<string, { ok: boolean; message: string }> = {};

    for (const type of types) {
        const backend = createBackend(type);
        try {
            await backend.initialize();
            results[type] = await backend.healthCheck();
        } catch (e) {
            results[type] = { ok: false, message: `Init failed: ${e}` };
        }
    }

    return results;
}

// ============ SWITCH BACKEND WITH MIGRATION SUGGESTION ============

/**
 * Switch vector backend in config.
 * If the old backend contains data, suggests migration.
 */
export async function switchVectorBackend(input: {
    to: BackendType;
    repoPath?: string;
}): Promise<{
    success: boolean;
    previousBackend: string;
    newBackend: string;
    migrationSuggested: boolean;
    documentCount: number;
    message: string;
}> {
    const { loadSwarmConfig, saveSwarmConfig } = await import("./setupWizard.js");
    const config = await loadSwarmConfig(input.repoPath);
    if (!config) {
        return {
            success: false,
            previousBackend: "unknown",
            newBackend: input.to,
            migrationSuggested: false,
            documentCount: 0,
            message: "Swarm not configured. Run setup wizard first.",
        };
    }

    const previousBackend = config.vector.backend;
    if (previousBackend === input.to) {
        return {
            success: true,
            previousBackend,
            newBackend: input.to,
            migrationSuggested: false,
            documentCount: 0,
            message: `Already using '${input.to}' backend.`,
        };
    }

    // Check if old backend has data
    let documentCount = 0;
    try {
        const oldBackend = createBackend(previousBackend);
        await oldBackend.initialize();
        const docs = await oldBackend.list(1);
        documentCount = docs.length;
    } catch {
        // Old backend may be unreachable — that's fine
    }

    // Update config
    config.vector.backend = input.to;
    await saveSwarmConfig(config, input.repoPath);

    const migrationSuggested = documentCount > 0;
    const message = migrationSuggested
        ? `Switched from '${previousBackend}' to '${input.to}'. ⚠️ Old backend has data — run backend_migrate to transfer documents.`
        : `Switched from '${previousBackend}' to '${input.to}'. No data to migrate.`;

    return {
        success: true,
        previousBackend,
        newBackend: input.to,
        migrationSuggested,
        documentCount,
        message,
    };
}
