/**
 * Plugin Loader — User-extensible plugin system
 * 
 * MCP Swarm v1.2.0
 * 
 * Loads user plugins from ~/.swarm/plugins/ directory.
 * Supports custom embedding providers and vector backends.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { loadSwarmConfig } from "./setupWizard.js";

// ============ TYPES ============

export interface SwarmPlugin {
    type: "embedding" | "vectorBackend" | "hook" | "command";
    name: string;
    description?: string;
    // For embedding plugins
    embed?: (text: string) => Promise<number[]>;
    // For vectorBackend plugins
    add?: (doc: any) => Promise<void>;
    search?: (query: number[], k: number) => Promise<any[]>;
    delete?: (id: string) => Promise<void>;
    // For hook plugins
    onTaskComplete?: (task: any) => Promise<void>;
    onFileChange?: (file: string) => Promise<void>;
    onAgentRegister?: (agent: any) => Promise<void>;
    // For command plugins
    execute?: (args: Record<string, unknown>) => Promise<unknown>;
    // Lifecycle: called when plugin is unloaded (cleanup timers, connections, etc.)
    onUnload?: () => Promise<void> | void;
}

interface PluginInfo {
    name: string;
    type: string;
    path: string;
    loaded: boolean;
    error?: string;
}

// ============ PLUGIN REGISTRY ============

const loadedPlugins = new Map<string, SwarmPlugin>();

function getPluginDir(): string {
    return path.join(os.homedir(), ".swarm", "plugins");
}

/**
 * Discover plugins in the plugins directory
 */
export async function discoverPlugins(): Promise<PluginInfo[]> {
    const pluginDir = getPluginDir();
    const plugins: PluginInfo[] = [];

    try {
        await fs.access(pluginDir);
    } catch {
        return plugins;
    }

    const entries = await fs.readdir(pluginDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith(".js") && !entry.name.endsWith(".mjs")) continue;

        plugins.push({
            name: entry.name.replace(/\.(js|mjs)$/, ""),
            type: "unknown",
            path: path.join(pluginDir, entry.name),
            loaded: loadedPlugins.has(entry.name.replace(/\.(js|mjs)$/, "")),
        });
    }

    return plugins;
}

/**
 * Load a plugin by name.
 * 
 * Security: Plugins are loaded via dynamic import() from ~/.swarm/plugins/.
 * Only .js and .mjs files are loaded. Each plugin is validated against the
 * SwarmPlugin interface before being registered.
 * 
 * ⚠️  Plugins execute in the same Node.js process — only install plugins
 *    you trust. There is no sandboxing.
 */
export async function loadPlugin(name: string): Promise<PluginInfo> {
    const pluginDir = getPluginDir();
    const extensions = [".js", ".mjs"];

    for (const ext of extensions) {
        const pluginPath = path.join(pluginDir, `${name}${ext}`);
        try {
            await fs.access(pluginPath);

            // Dynamic import — use pathToFileURL for safe cross-platform URL
            const fileUrl = pathToFileURL(pluginPath).href;
            const mod = await import(fileUrl);
            const plugin: SwarmPlugin = mod.default || mod;

            // ---- API VALIDATION ----

            // Must have name and type
            if (!plugin.type || !plugin.name) {
                return {
                    name,
                    type: "unknown",
                    path: pluginPath,
                    loaded: false,
                    error: "Plugin must export 'type' (embedding|vectorBackend|hook|command) and 'name' (string)",
                };
            }

            // Validate type is one of allowed values
            const validTypes: SwarmPlugin["type"][] = ["embedding", "vectorBackend", "hook", "command"];
            if (!validTypes.includes(plugin.type)) {
                return {
                    name: plugin.name,
                    type: plugin.type,
                    path: pluginPath,
                    loaded: false,
                    error: `Invalid plugin type '${plugin.type}'. Must be one of: ${validTypes.join(", ")}`,
                };
            }

            // Validate required methods per type
            const typeMethodErrors = validatePluginMethods(plugin);
            if (typeMethodErrors) {
                return {
                    name: plugin.name,
                    type: plugin.type,
                    path: pluginPath,
                    loaded: false,
                    error: typeMethodErrors,
                };
            }

            loadedPlugins.set(name, plugin);

            return {
                name: plugin.name,
                type: plugin.type,
                path: pluginPath,
                loaded: true,
            };
        } catch (e) {
            return {
                name,
                type: "unknown",
                path: pluginPath,
                loaded: false,
                error: String(e),
            };
        }
    }

    return {
        name,
        type: "unknown",
        path: "",
        loaded: false,
        error: `Plugin '${name}' not found in ${pluginDir}`,
    };
}

/**
 * Validate that a plugin exports the required methods for its type
 */
function validatePluginMethods(plugin: SwarmPlugin): string | null {
    switch (plugin.type) {
        case "embedding":
            if (typeof plugin.embed !== "function") {
                return "Embedding plugin must export an 'embed(text: string) => Promise<number[]>' method";
            }
            break;
        case "vectorBackend":
            if (typeof plugin.add !== "function" || typeof plugin.search !== "function") {
                return "VectorBackend plugin must export 'add(doc)' and 'search(query, k)' methods";
            }
            break;
        case "command":
            if (typeof plugin.execute !== "function") {
                return "Command plugin must export an 'execute(args) => Promise<unknown>' method";
            }
            break;
        case "hook":
            // Hooks are optional — at least one hook method should exist
            const hasHook = plugin.onTaskComplete || plugin.onFileChange || plugin.onAgentRegister;
            if (!hasHook) {
                return "Hook plugin must export at least one of: onTaskComplete, onFileChange, onAgentRegister";
            }
            break;
    }
    return null;
}

/**
 * Load all discovered plugins
 */
export async function loadAllPlugins(repoPath?: string): Promise<{
    loaded: number;
    failed: number;
    plugins: PluginInfo[];
}> {
    const config = await loadSwarmConfig(repoPath);
    if (!config?.plugins?.enabled) {
        return { loaded: 0, failed: 0, plugins: [] };
    }

    const discovered = await discoverPlugins();
    const results: PluginInfo[] = [];
    let loaded = 0;
    let failed = 0;

    for (const plugin of discovered) {
        if (!plugin.loaded) {
            const result = await loadPlugin(plugin.name);
            results.push(result);
            if (result.loaded) loaded++;
            else failed++;
        } else {
            results.push(plugin);
            loaded++;
        }
    }

    return { loaded, failed, plugins: results };
}

/**
 * Get a loaded plugin by name
 */
export function getPlugin(name: string): SwarmPlugin | undefined {
    return loadedPlugins.get(name);
}

/**
 * Get all loaded plugins of a specific type
 */
export function getPluginsByType(type: SwarmPlugin["type"]): SwarmPlugin[] {
    return Array.from(loadedPlugins.values()).filter(p => p.type === type);
}

/**
 * Unload a plugin (calls onUnload hook if available)
 */
export async function unloadPlugin(name: string): Promise<boolean> {
    const plugin = loadedPlugins.get(name);
    if (!plugin) return false;

    // Call lifecycle hook for cleanup
    if (plugin.onUnload) {
        try {
            await plugin.onUnload();
        } catch {
            // Best-effort cleanup — don't fail unload
        }
    }

    return loadedPlugins.delete(name);
}

/**
 * Create the plugins directory if it doesn't exist
 */
export async function ensurePluginDir(): Promise<string> {
    const dir = getPluginDir();
    await fs.mkdir(dir, { recursive: true });
    return dir;
}
