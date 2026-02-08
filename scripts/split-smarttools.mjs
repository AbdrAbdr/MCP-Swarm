/**
 * Split smartTools.ts into modular files under src/smartTools/
 * Run: node scripts/split-smarttools.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcFile = join(root, "src", "smartTools.ts");
const outDir = join(root, "src", "smartTools");

// Read file
const content = readFileSync(srcFile, "utf8");
const lines = content.split(/\r?\n/);

// Tool-to-module mapping
const moduleMapping = {
    "core": [
        "swarmAgentTool", "swarmControlTool", "swarmPulseTool", "swarmCompanionTool"
    ],
    "tasks": [
        "swarmTaskTool", "swarmPlanTool", "swarmBriefingTool", "swarmSpecTool"
    ],
    "files": [
        "swarmFileTool", "swarmSnapshotTool", "swarmWorktreeTool", "swarmHooksTool"
    ],
    "git": [
        "swarmGitTool", "swarmDependencyTool"
    ],
    "collaboration": [
        "swarmChatTool", "swarmReviewTool", "swarmVotingTool", "swarmAuctionTool",
        "swarmMcpTool", "swarmOrchestratorTool", "swarmMessageTool"
    ],
    "security": [
        "swarmDefenceTool", "swarmImmuneTool", "swarmConsensusTool"
    ],
    "analytics": [
        "swarmCostTool", "swarmMoETool", "swarmSONATool", "swarmBudgetTool",
        "swarmQualityTool", "swarmRegressionTool"
    ],
    "intelligence": [
        "swarmVectorTool", "swarmBoosterTool", "swarmBatchTool",
        "swarmBrainstormTool", "swarmDebugTool", "swarmContextTool", "swarmContextPoolTool"
    ],
    "infra": [
        "swarmExternalTool", "swarmPlatformTool", "swarmPreemptionTool",
        "swarmExpertiseTool", "swarmRoutingTool", "swarmKnowledgeTool",
        "swarmScreenshotTool", "swarmSessionTool", "swarmTimelineTool",
        "swarmClustersTool", "swarmDocsTool", "swarmConflictTool",
        "swarmHealthTool", "swarmQaTool", "swarmAdviceTool",
        "swarmAutoReviewTool", "swarmTelegramTool"
    ]
};

// Find each tool definition range
function findToolRanges() {
    const ranges = {};
    const toolPattern = /^export const (swarm\w+Tool)\s*=\s*\[/;
    let currentTool = null;
    let currentStart = -1;
    let bracketDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(toolPattern);

        if (match) {
            // Save previous tool
            if (currentTool && currentStart >= 0) {
                // Find the end: look for `] as const;`
            }
            currentTool = match[1];
            currentStart = i;
            bracketDepth = 0;
        }
    }

    // Better approach: find `export const swarmXTool` and `] as const;` pairs
    const toolStarts = [];
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(toolPattern);
        if (match) {
            toolStarts.push({ name: match[1], line: i });
        }
    }

    for (let t = 0; t < toolStarts.length; t++) {
        const start = toolStarts[t].line;
        // Look backwards for preceding comment block
        let commentStart = start;
        for (let j = start - 1; j >= 0; j--) {
            const l = lines[j].trim();
            if (l.startsWith("/**") || l.startsWith("*") || l.startsWith("//") || l === "") {
                commentStart = j;
            } else {
                break;
            }
        }

        // Find end: next tool start or end of tools section
        let end;
        if (t + 1 < toolStarts.length) {
            end = toolStarts[t + 1].line - 1;
            // Trim trailing blank lines
            while (end > start && lines[end].trim() === "") end--;
        } else {
            // Last tool - find `] as const;`
            for (let j = start; j < lines.length; j++) {
                if (lines[j].trim() === "] as const;") {
                    end = j;
                    break;
                }
            }
        }

        ranges[toolStarts[t].name] = { start: commentStart, end, name: toolStarts[t].name };
    }

    return ranges;
}

// Collect imports needed for each tool
function findImportsForTool(toolLines) {
    const text = toolLines.join("\n");
    // Find all function calls in the tool
    const calledFns = new Set();

    // Match function calls: awaitSomething( or functionName(
    const callPattern = /(?:await\s+)?(\w+)\s*\(/g;
    let m;
    while ((m = callPattern.exec(text)) !== null) {
        if (m[1] !== "z" && m[1] !== "Error" && m[1] !== "wrapResult" &&
            m[1] !== "JSON" && m[1] !== "console" && m[1] !== "switch" &&
            m[1] !== "String" && m[1] !== "Number" && m[1] !== "Boolean" &&
            m[1] !== "Array" && m[1] !== "Object" && m[1] !== "Math" &&
            m[1] !== "Date" && m[1] !== "Promise" && m[1] !== "Set" &&
            m[1] !== "Map" && m[1] !== "handleTelegramTool" && !m[1].startsWith("handle")) {
            calledFns.add(m[1]);
        }
    }

    // Also match handle* functions
    const handlePattern = /(?:await\s+)?(handle\w+)\s*\(/g;
    while ((m = handlePattern.exec(text)) !== null) {
        calledFns.add(m[1]);
    }

    return calledFns;
}

// Parse all imports from original file (lines 1-314)
function parseImports() {
    const imports = [];
    let currentImport = "";
    let inImport = false;

    for (let i = 0; i < 320; i++) {
        const line = lines[i];
        if (line.startsWith("import ") || line.startsWith("import {")) {
            inImport = true;
            currentImport = line;
        } else if (inImport) {
            currentImport += "\n" + line;
        }

        if (inImport && line.includes("from ")) {
            imports.push(currentImport.trim());
            currentImport = "";
            inImport = false;
        }
    }

    return imports;
}

// Extract imported names from an import statement
function getImportedNames(importStmt) {
    const names = [];
    const match = importStmt.match(/import\s*\{([^}]+)\}/);
    if (match) {
        const parts = match[1].split(",");
        for (const part of parts) {
            const trimmed = part.trim();
            // Handle "name as alias"
            const asMatch = trimmed.match(/(\w+)\s+as\s+(\w+)/);
            if (asMatch) {
                names.push({ original: asMatch[1], alias: asMatch[2] });
            } else if (trimmed) {
                names.push({ original: trimmed, alias: trimmed });
            }
        }
    }
    return names;
}

// Build module files
function buildModules() {
    const ranges = findToolRanges();
    const allImports = parseImports();

    mkdirSync(outDir, { recursive: true });

    const moduleExports = {};

    for (const [moduleName, toolNames] of Object.entries(moduleMapping)) {
        const moduleTools = [];
        const neededImports = new Set();
        const neededFns = new Set();

        for (const toolName of toolNames) {
            const range = ranges[toolName];
            if (!range) {
                console.warn(`  WARNING: ${toolName} not found in ranges!`);
                continue;
            }

            const toolLines = lines.slice(range.start, range.end + 1);
            const calledFns = findImportsForTool(toolLines);

            for (const fn of calledFns) {
                neededFns.add(fn);
            }

            moduleTools.push({
                name: toolName,
                code: toolLines.join("\n")
            });
        }

        // Find which import statements we need
        const moduleImportLines = [];
        for (const imp of allImports) {
            const importedNames = getImportedNames(imp);
            const matchingNames = importedNames.filter(n => neededFns.has(n.alias));

            if (matchingNames.length > 0) {
                // Reconstruct import with only needed names
                const fromMatch = imp.match(/from\s+["']([^"']+)["']/);
                if (fromMatch) {
                    const nameStr = matchingNames
                        .map(n => n.original === n.alias ? n.original : `${n.original} as ${n.alias}`)
                        .join(", ");
                    moduleImportLines.push(`import { ${nameStr} } from "${fromMatch[1]}";`);
                }
            }
        }

        // Build file content
        let fileContent = `/**\n * MCP Swarm v0.9.17 - Smart Tools: ${moduleName}\n * Auto-generated from smartTools.ts\n */\n\nimport { z } from "zod";\n\n`;

        // Add workflow imports  
        if (moduleImportLines.length > 0) {
            fileContent += moduleImportLines.join("\n") + "\n\n";
        }

        // Add wrapResult helper
        fileContent += `// Helper to wrap results\nfunction wrapResult(result: any) {\n  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };\n}\n\n`;

        // Add tool definitions
        for (const tool of moduleTools) {
            fileContent += tool.code + "\n\n";
        }

        // Write file
        const filePath = join(outDir, `${moduleName}.ts`);
        writeFileSync(filePath, fileContent, "utf8");

        moduleExports[moduleName] = moduleTools.map(t => t.name);
        console.log(`  ✅ ${moduleName}.ts - ${moduleTools.length} tools (${moduleImportLines.length} imports)`);
    }

    // Build index.ts
    let indexContent = `/**\n * MCP Swarm v0.9.17 - Smart Tools Index\n * Modular re-export of all 54 Smart Tools\n */\n\n`;

    for (const [moduleName, toolNames] of Object.entries(moduleExports)) {
        indexContent += `export { ${toolNames.join(", ")} } from "./${moduleName}.js";\n`;
    }

    indexContent += `\n// Re-export allSmartTools array\n`;
    indexContent += `import {\n`;
    const allToolNames = Object.values(moduleExports).flat();
    indexContent += allToolNames.map(n => `  ${n}`).join(",\n");
    indexContent += `\n} from "./index.js";\n\n`;

    // Wait, circular import. Let me fix:
    indexContent = `/**\n * MCP Swarm v0.9.17 - Smart Tools Index\n * Modular re-export of all 54 Smart Tools\n */\n\n`;

    for (const [moduleName, toolNames] of Object.entries(moduleExports)) {
        indexContent += `import { ${toolNames.join(", ")} } from "./${moduleName}.js";\n`;
    }

    indexContent += `\nexport {\n`;
    indexContent += allToolNames.map(n => `  ${n}`).join(",\n");
    indexContent += `\n};\n\n`;

    indexContent += `export const allSmartTools = [\n`;
    indexContent += allToolNames.map(n => `  ${n}`).join(",\n");
    indexContent += `\n];\n`;

    const indexPath = join(outDir, "index.ts");
    writeFileSync(indexPath, indexContent, "utf8");
    console.log(`  ✅ index.ts - exports ${allToolNames.length} tools from ${Object.keys(moduleExports).length} modules`);
}

console.log("🔨 Splitting smartTools.ts into modules...\n");
buildModules();
console.log("\n✅ Done! Files written to src/smartTools/");
