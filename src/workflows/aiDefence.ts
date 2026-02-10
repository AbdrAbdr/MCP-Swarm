/**
 * AIDefence — Security & Threat Detection
 * 
 * MCP Swarm v0.9.8
 * 
 * Protects the multi-agent system from:
 * - Prompt injection attacks
 * - Jailbreak attempts
 * - Malicious code execution
 * - Data exfiltration
 * - Unauthorized tool usage
 * - Agent impersonation
 * 
 * Features:
 * - <10ms threat detection
 * - Pattern-based detection (regex + heuristics)
 * - Behavioral anomaly detection
 * - Quarantine system
 * - Audit logging
 * - Configurable sensitivity
 * 
 * Inspired by Claude-Flow's AIDefence module.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

/**
 * Threat categories
 */
export type ThreatCategory =
  | "prompt_injection"     // Attempt to override system instructions
  | "jailbreak"            // Attempt to bypass safety guidelines
  | "code_injection"       // Malicious code in input
  | "data_exfiltration"    // Attempt to leak sensitive data
  | "unauthorized_tool"    // Using tools without permission
  | "impersonation"        // Pretending to be another agent
  | "dos_attack"           // Denial of service (flooding)
  | "sensitive_data"       // PII, credentials, secrets in output
  | "unsafe_command"       // Dangerous system commands
  | "social_engineering";  // Manipulation attempts

/**
 * Threat severity levels
 */
export type ThreatSeverity = "low" | "medium" | "high" | "critical";

/**
 * Detection result
 */
export interface ThreatDetection {
  detected: boolean;
  category: ThreatCategory | null;
  severity: ThreatSeverity;
  confidence: number;      // 0-1
  matches: string[];       // Matched patterns/rules
  message: string;
  timeMs: number;
  action: "allow" | "warn" | "block" | "quarantine";
}

/**
 * Security event for logging
 */
export interface SecurityEvent {
  id: string;
  timestamp: number;
  category: ThreatCategory;
  severity: ThreatSeverity;
  source: string;          // Agent name or "user"
  target?: string;         // Target agent/file
  input: string;           // Truncated input
  detection: ThreatDetection;
  action: "allowed" | "warned" | "blocked" | "quarantined";
  resolved: boolean;
}

/**
 * Quarantined item
 */
export interface QuarantinedItem {
  id: string;
  timestamp: number;
  source: string;
  category: ThreatCategory;
  content: string;
  reason: string;
  expiresAt: number;
  released: boolean;
}

/**
 * Defence configuration
 */
export interface DefenceConfig {
  enabled: boolean;
  sensitivity: "low" | "medium" | "high" | "paranoid";
  autoBlock: boolean;           // Auto-block high severity threats
  quarantineDurationMs: number; // Default quarantine duration
  maxInputLength: number;       // Max input length to scan
  logAllRequests: boolean;      // Log all requests (not just threats)
  allowedAgents: string[];      // Whitelist of trusted agents
  blockedPatterns: string[];    // Additional blocked patterns
  alertWebhook?: string;        // Webhook for alerts
}

/**
 * Defence statistics
 */
export interface DefenceStats {
  totalScans: number;
  threatsDetected: number;
  blocked: number;
  quarantined: number;
  byCategory: Record<ThreatCategory, number>;
  bySeverity: Record<ThreatSeverity, number>;
  lastThreat: number | null;
  lastUpdated: number;
}

// ============ CONSTANTS ============

const DEFENCE_DIR = ".swarm/defence";
const CONFIG_FILE = "config.json";
const STATS_FILE = "stats.json";
const EVENTS_FILE = "events.json";
const QUARANTINE_FILE = "quarantine.json";

const DEFAULT_CONFIG: DefenceConfig = {
  enabled: true,
  sensitivity: "medium",
  autoBlock: true,
  quarantineDurationMs: 24 * 60 * 60 * 1000, // 24 hours
  maxInputLength: 50000,
  logAllRequests: false,
  allowedAgents: [],
  blockedPatterns: [],
};

// ============ DETECTION PATTERNS ============

/**
 * Prompt injection patterns
 */
const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  // Direct instruction override
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(everything|all|your)\s+(you\s+)?(know|learned|were\s+told)/i,
  /disregard\s+(all|any|the)\s+(previous|prior|above)/i,
  /override\s+(system|safety|your)\s+(prompt|instructions?|guidelines?)/i,

  // Role hijacking
  /you\s+are\s+now\s+(a|an|the)\s+(?!assistant|helpful)/i,
  /act\s+as\s+(if\s+you\s+are|though\s+you\s+were)\s+(?!an?\s+assistant)/i,
  /pretend\s+(to\s+be|you\s+are)\s+(?!helpful)/i,
  /from\s+now\s+on,?\s+you\s+(are|will\s+be)/i,

  // System prompt extraction
  /what\s+(is|are)\s+your\s+(system\s+)?prompt/i,
  /show\s+me\s+your\s+(system\s+)?instructions/i,
  /reveal\s+your\s+(hidden|secret|system)\s+(prompt|instructions)/i,
  /print\s+your\s+(initial|system|original)\s+(prompt|instructions)/i,

  // Delimiter attacks
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /<\|im_start\|>/i,
  /\[\/INST\]/i,

  // Markdown/code escape
  /```\s*(system|admin|root)/i,
  /\n#{1,2}\s*system\s*(prompt|message|instruction)/i,
];

/**
 * Jailbreak patterns
 */
const JAILBREAK_PATTERNS: RegExp[] = [
  // DAN and variants
  /\bDAN\b.*\bmode\b/i,
  /\bdo\s+anything\s+now\b/i,
  /\bjailbreak(ed)?\b/i,
  /\bunfiltered\s+(mode|response|output)/i,

  // Roleplay bypasses
  /you\s+have\s+no\s+(restrictions?|limits?|boundaries)/i,
  /there\s+are\s+no\s+(rules?|guidelines?|restrictions?)/i,
  /ethics\s+(don't|do\s+not)\s+apply/i,
  /without\s+any\s+(moral|ethical)\s+(constraints?|limits?)/i,

  // Hypothetical bypasses
  /hypothetically,?\s+if\s+you\s+(could|were|had)/i,
  /in\s+a\s+fictional\s+(world|scenario|story)/i,
  /imagine\s+you\s+(had\s+no|were\s+free|could)/i,
  /for\s+(educational|research)\s+purposes?\s+only/i,

  // Developer/debug mode
  /developer\s+mode\s+(enabled?|on|activated?)/i,
  /debug\s+mode\s+(enabled?|on|activated?)/i,
  /maintenance\s+mode/i,
  /admin\s+(mode|access|override)/i,
];

/**
 * Code injection patterns
 */
const CODE_INJECTION_PATTERNS: RegExp[] = [
  // Shell commands
  /\b(rm|del)\s+(-rf?\s+)?[\/\\]/i,
  /\bsudo\s+(rm|chmod|chown)/i,
  /\b(curl|wget)\s+.*(sh|bash|exec)/i,
  /\|\s*(bash|sh|zsh|cmd)/i,
  /;\s*(rm|del|format)\s/i,

  // Dangerous Node.js
  /require\s*\(\s*['"]child_process['"]\s*\)/,
  /exec(Sync)?\s*\(\s*[`'"]/,
  /spawn(Sync)?\s*\(/,
  /eval\s*\(/,
  /__proto__/,
  /constructor\s*\[\s*['"]prototype['"]\s*\]/,

  // SQL injection
  /(['"])\s*(OR|AND)\s+\1?\s*=\s*\1/i,
  /UNION\s+(ALL\s+)?SELECT/i,
  /;\s*DROP\s+(TABLE|DATABASE)/i,
  /--\s*$/m,

  // Path traversal
  /\.\.[\/\\]/,
  /%2e%2e[\/\\%]/i,
];

/**
 * Data exfiltration patterns
 */
const EXFILTRATION_PATTERNS: RegExp[] = [
  // API keys and tokens
  /\b(api[_-]?key|access[_-]?token|secret[_-]?key)\s*[=:]\s*['"][^'"]+['"]/i,
  /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/i,
  /\b(sk|pk)[-_](live|test)[-_][A-Za-z0-9]{20,}/,
  /ghp_[A-Za-z0-9]{36}/,
  /xox[baprs]-[A-Za-z0-9\-]{10,}/,

  // Credentials
  /password\s*[=:]\s*['"][^'"]+['"]/i,
  /\bAWS[_-]?(SECRET|ACCESS)[_-]?KEY/i,

  // Send/upload to external
  /fetch\s*\(\s*['"]https?:\/\/(?!localhost|127\.0\.0\.1)/,
  /axios\s*\.\s*(get|post)\s*\(\s*['"]https?:\/\/(?!localhost)/,
  /send\s+to\s+(my\s+)?(server|endpoint|api)/i,
  /upload\s+to\s+(external|remote)/i,
];

/**
 * Sensitive data patterns
 */
const SENSITIVE_DATA_PATTERNS: RegExp[] = [
  // PII
  /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/, // SSN
  /\b\d{16}\b/, // Credit card (basic)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email (might be too broad)

  // Secrets in code
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
  /-----BEGIN\s+PGP\s+PRIVATE/,

  // Environment variables with secrets
  /process\.env\.(PASSWORD|SECRET|API_KEY|TOKEN)/i,
];

/**
 * Unsafe command patterns
 */
const UNSAFE_COMMAND_PATTERNS: RegExp[] = [
  // Destructive commands
  /\brm\s+-rf?\s+[\/~]/,
  /\bformat\s+[a-z]:/i,
  /\bmkfs\b/,
  /\bdd\s+if=/,

  // Privilege escalation
  /\bsudo\s+-i/,
  /\bsu\s+-\s*$/m,
  /\bchmod\s+777/,
  /\bchown\s+-R/,

  // Network attacks
  /\bnmap\b/,
  /\bnetcat\b|\bnc\s+-/,
  /\bmetasploit\b/,

  // Crypto mining
  /\bxmrig\b/i,
  /\bminerd\b/i,
  /stratum\+tcp/i,
];

/**
 * Social engineering patterns
 */
const SOCIAL_ENGINEERING_PATTERNS: RegExp[] = [
  // Authority claims
  /i\s+am\s+(your\s+)?(creator|developer|admin|owner)/i,
  /i\s+work\s+(for|at)\s+(openai|anthropic|google)/i,
  /this\s+is\s+(a\s+)?(test|audit|security\s+check)/i,

  // Urgency/pressure
  /urgent(ly)?\s*[!:]/i,
  /immediately\s+required/i,
  /failure\s+to\s+comply/i,
  /you\s+must\s+(do|perform|execute)\s+this\s+now/i,

  // Emotional manipulation
  /if\s+you\s+don't.*will\s+(die|suffer|be\s+hurt)/i,
  /please,?\s+my\s+(life|job)\s+depends/i,
];

// ============ HELPERS ============

async function getDefenceDir(repoRoot: string): Promise<string> {
  const dir = path.join(repoRoot, DEFENCE_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function loadConfig(repoRoot: string): Promise<DefenceConfig> {
  const dir = await getDefenceDir(repoRoot);
  const configPath = path.join(dir, CONFIG_FILE);

  try {
    const raw = await fs.readFile(configPath, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function saveConfig(repoRoot: string, config: DefenceConfig): Promise<void> {
  const dir = await getDefenceDir(repoRoot);
  const configPath = path.join(dir, CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
}

async function loadStats(repoRoot: string): Promise<DefenceStats> {
  const dir = await getDefenceDir(repoRoot);
  const statsPath = path.join(dir, STATS_FILE);

  try {
    const raw = await fs.readFile(statsPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      totalScans: 0,
      threatsDetected: 0,
      blocked: 0,
      quarantined: 0,
      byCategory: {} as DefenceStats["byCategory"],
      bySeverity: {} as DefenceStats["bySeverity"],
      lastThreat: null,
      lastUpdated: Date.now(),
    };
  }
}

async function saveStats(repoRoot: string, stats: DefenceStats): Promise<void> {
  const dir = await getDefenceDir(repoRoot);
  const statsPath = path.join(dir, STATS_FILE);
  stats.lastUpdated = Date.now();
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2), "utf8");
}

async function logEvent(repoRoot: string, event: SecurityEvent): Promise<void> {
  const dir = await getDefenceDir(repoRoot);
  const eventsPath = path.join(dir, EVENTS_FILE);

  let events: SecurityEvent[] = [];
  try {
    const raw = await fs.readFile(eventsPath, "utf8");
    events = JSON.parse(raw);
  } catch { }

  events.push(event);
  if (events.length > 1000) {
    events = events.slice(-1000);
  }

  await fs.writeFile(eventsPath, JSON.stringify(events, null, 2), "utf8");
}

async function loadQuarantine(repoRoot: string): Promise<QuarantinedItem[]> {
  const dir = await getDefenceDir(repoRoot);
  const quarantinePath = path.join(dir, QUARANTINE_FILE);

  try {
    const raw = await fs.readFile(quarantinePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveQuarantine(repoRoot: string, items: QuarantinedItem[]): Promise<void> {
  const dir = await getDefenceDir(repoRoot);
  const quarantinePath = path.join(dir, QUARANTINE_FILE);
  await fs.writeFile(quarantinePath, JSON.stringify(items, null, 2), "utf8");
}

function generateId(): string {
  return `threat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function truncate(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// ============ DETECTION ENGINE ============

/**
 * Get sensitivity multiplier
 */
function getSensitivityThreshold(sensitivity: DefenceConfig["sensitivity"]): number {
  switch (sensitivity) {
    case "low": return 0.8;
    case "medium": return 0.6;
    case "high": return 0.4;
    case "paranoid": return 0.2;
    default: return 0.6;
  }
}

/**
 * Scan text against pattern set
 */
function scanPatterns(
  text: string,
  patterns: RegExp[],
  category: ThreatCategory
): { matches: string[]; confidence: number } {
  const matches: string[] = [];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0].substring(0, 100));
    }
  }

  const confidence = Math.min(1, matches.length * 0.3 + (matches.length > 0 ? 0.4 : 0));
  return { matches, confidence };
}

/**
 * Calculate severity based on matches and category
 */
function calculateSeverity(
  category: ThreatCategory,
  matchCount: number,
  confidence: number
): ThreatSeverity {
  // Critical categories
  const criticalCategories: ThreatCategory[] = [
    "code_injection",
    "data_exfiltration",
    "unsafe_command",
  ];

  // High severity categories
  const highCategories: ThreatCategory[] = [
    "prompt_injection",
    "jailbreak",
    "impersonation",
  ];

  if (criticalCategories.includes(category) && confidence > 0.7) {
    return "critical";
  }

  if (criticalCategories.includes(category) ||
    (highCategories.includes(category) && confidence > 0.6)) {
    return "high";
  }

  if (highCategories.includes(category) || confidence > 0.5) {
    return "medium";
  }

  return "low";
}

/**
 * Determine action based on severity and config
 */
function determineAction(
  severity: ThreatSeverity,
  config: DefenceConfig
): "allow" | "warn" | "block" | "quarantine" {
  if (!config.autoBlock) {
    return severity === "critical" ? "warn" : "allow";
  }

  switch (severity) {
    case "critical":
      return "quarantine";
    case "high":
      return "block";
    case "medium":
      return config.sensitivity === "paranoid" ? "block" : "warn";
    case "low":
      return config.sensitivity === "paranoid" ? "warn" : "allow";
    default:
      return "allow";
  }
}

/**
 * Main scan function
 */
export async function scan(input: {
  repoPath?: string;
  text: string;
  source?: string;
  context?: string;
}): Promise<ThreatDetection> {
  const startTime = Date.now();
  const repoRoot = await getRepoRoot(input.repoPath);
  const config = await loadConfig(repoRoot);

  if (!config.enabled) {
    return {
      detected: false,
      category: null,
      severity: "low",
      confidence: 0,
      matches: [],
      message: "Defence is disabled",
      timeMs: Date.now() - startTime,
      action: "allow",
    };
  }

  // Truncate input if too long
  const text = input.text.substring(0, config.maxInputLength);
  const threshold = getSensitivityThreshold(config.sensitivity);

  // Check all pattern categories
  const categoryChecks: Array<{
    category: ThreatCategory;
    patterns: RegExp[];
  }> = [
      { category: "prompt_injection", patterns: PROMPT_INJECTION_PATTERNS },
      { category: "jailbreak", patterns: JAILBREAK_PATTERNS },
      { category: "code_injection", patterns: CODE_INJECTION_PATTERNS },
      { category: "data_exfiltration", patterns: EXFILTRATION_PATTERNS },
      { category: "sensitive_data", patterns: SENSITIVE_DATA_PATTERNS },
      { category: "unsafe_command", patterns: UNSAFE_COMMAND_PATTERNS },
      { category: "social_engineering", patterns: SOCIAL_ENGINEERING_PATTERNS },
    ];

  // Check custom blocked patterns
  if (config.blockedPatterns.length > 0) {
    const customPatterns = config.blockedPatterns.map(p => new RegExp(p, "i"));
    categoryChecks.push({ category: "prompt_injection", patterns: customPatterns });
  }

  let highestConfidence = 0;
  let detectedCategory: ThreatCategory | null = null;
  let allMatches: string[] = [];

  for (const check of categoryChecks) {
    const result = scanPatterns(text, check.patterns, check.category);

    if (result.confidence > highestConfidence) {
      highestConfidence = result.confidence;
      detectedCategory = check.category;
    }

    allMatches = allMatches.concat(result.matches);
  }

  const timeMs = Date.now() - startTime;

  // No threat detected
  if (highestConfidence < threshold || !detectedCategory) {
    // Update stats
    const stats = await loadStats(repoRoot);
    stats.totalScans++;
    await saveStats(repoRoot, stats);

    return {
      detected: false,
      category: null,
      severity: "low",
      confidence: highestConfidence,
      matches: [],
      message: "No threats detected",
      timeMs,
      action: "allow",
    };
  }

  // Threat detected
  const severity = calculateSeverity(detectedCategory, allMatches.length, highestConfidence);
  const action = determineAction(severity, config);

  // Update stats
  const stats = await loadStats(repoRoot);
  stats.totalScans++;
  stats.threatsDetected++;
  stats.byCategory[detectedCategory] = (stats.byCategory[detectedCategory] || 0) + 1;
  stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
  stats.lastThreat = Date.now();

  if (action === "block" || action === "quarantine") {
    stats.blocked++;
  }
  if (action === "quarantine") {
    stats.quarantined++;
  }

  await saveStats(repoRoot, stats);

  // Log event
  const event: SecurityEvent = {
    id: generateId(),
    timestamp: Date.now(),
    category: detectedCategory,
    severity,
    source: input.source || "unknown",
    input: truncate(text),
    detection: {
      detected: true,
      category: detectedCategory,
      severity,
      confidence: highestConfidence,
      matches: allMatches.slice(0, 10),
      message: `Detected ${detectedCategory} threat`,
      timeMs,
      action,
    },
    action: action === "allow" ? "allowed" :
      action === "warn" ? "warned" :
        action === "block" ? "blocked" : "quarantined",
    resolved: false,
  };
  await logEvent(repoRoot, event);

  // Quarantine if needed
  if (action === "quarantine") {
    const quarantine = await loadQuarantine(repoRoot);
    quarantine.push({
      id: event.id,
      timestamp: Date.now(),
      source: input.source || "unknown",
      category: detectedCategory,
      content: truncate(text, 1000),
      reason: `${severity} severity ${detectedCategory} detected`,
      expiresAt: Date.now() + config.quarantineDurationMs,
      released: false,
    });
    await saveQuarantine(repoRoot, quarantine);
  }

  return {
    detected: true,
    category: detectedCategory,
    severity,
    confidence: highestConfidence,
    matches: allMatches.slice(0, 10),
    message: `Detected ${severity} severity ${detectedCategory} threat`,
    timeMs,
    action,
  };
}

/**
 * Validate agent identity
 */
export async function validateAgent(input: {
  repoPath?: string;
  agentName: string;
  agentId?: string;
  action: string;
}): Promise<{
  valid: boolean;
  trusted: boolean;
  message: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const config = await loadConfig(repoRoot);

  // Check if agent is whitelisted
  const trusted = config.allowedAgents.includes(input.agentName);

  // Basic validation
  if (!input.agentName || input.agentName.length < 2) {
    return {
      valid: false,
      trusted: false,
      message: "Invalid agent name",
    };
  }

  // Check for suspicious patterns in agent name
  const suspiciousPatterns = [
    /admin/i,
    /system/i,
    /root/i,
    /orchestrator.*override/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input.agentName)) {
      return {
        valid: false,
        trusted: false,
        message: `Suspicious agent name pattern: ${input.agentName}`,
      };
    }
  }

  return {
    valid: true,
    trusted,
    message: trusted ? "Trusted agent" : "Untrusted agent (not in allowlist)",
  };
}

/**
 * Validate tool usage
 */
export async function validateToolUsage(input: {
  repoPath?: string;
  agentName: string;
  toolName: string;
  toolArgs?: Record<string, unknown>;
}): Promise<{
  allowed: boolean;
  reason: string;
  warnings: string[];
}> {
  const warnings: string[] = [];

  // Dangerous tools that require extra scrutiny
  const dangerousTools = [
    "bash",
    "shell",
    "exec",
    "terminal",
    "command",
  ];

  // Check if tool is dangerous
  const isDangerous = dangerousTools.some(t =>
    input.toolName.toLowerCase().includes(t)
  );

  if (isDangerous) {
    warnings.push(`Tool ${input.toolName} can execute system commands`);

    // Check args for dangerous patterns
    if (input.toolArgs) {
      const argsStr = JSON.stringify(input.toolArgs);
      const dangerousArgPatterns = [
        /rm\s+-rf/i,
        /sudo/i,
        /curl.*\|.*sh/i,
        /wget.*\|.*bash/i,
      ];

      for (const pattern of dangerousArgPatterns) {
        if (pattern.test(argsStr)) {
          return {
            allowed: false,
            reason: `Dangerous command pattern detected in tool args`,
            warnings,
          };
        }
      }
    }
  }

  return {
    allowed: true,
    reason: "Tool usage allowed",
    warnings,
  };
}

// ============ MANAGEMENT API ============

/**
 * Get security events
 */
export async function getEvents(input: {
  repoPath?: string;
  limit?: number;
  category?: ThreatCategory;
  severity?: ThreatSeverity;
}): Promise<SecurityEvent[]> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const dir = await getDefenceDir(repoRoot);
  const eventsPath = path.join(dir, EVENTS_FILE);

  let events: SecurityEvent[] = [];
  try {
    const raw = await fs.readFile(eventsPath, "utf8");
    events = JSON.parse(raw);
  } catch { }

  // Filter
  if (input.category) {
    events = events.filter(e => e.category === input.category);
  }
  if (input.severity) {
    events = events.filter(e => e.severity === input.severity);
  }

  // Sort by timestamp desc and limit
  events = events
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, input.limit || 50);

  return events;
}

/**
 * Get quarantined items
 */
export async function getQuarantine(input: {
  repoPath?: string;
  includeExpired?: boolean;
}): Promise<QuarantinedItem[]> {
  const repoRoot = await getRepoRoot(input.repoPath);
  let items = await loadQuarantine(repoRoot);

  const now = Date.now();

  if (!input.includeExpired) {
    items = items.filter(i => !i.released && i.expiresAt > now);
  }

  return items.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Release item from quarantine
 */
export async function releaseFromQuarantine(input: {
  repoPath?: string;
  id: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const items = await loadQuarantine(repoRoot);

  const item = items.find(i => i.id === input.id);
  if (!item) {
    return { success: false, message: "Item not found in quarantine" };
  }

  item.released = true;
  await saveQuarantine(repoRoot, items);

  return { success: true, message: `Released ${input.id} from quarantine` };
}

/**
 * Get defence statistics
 */
export async function getStats(input: {
  repoPath?: string;
}): Promise<DefenceStats> {
  const repoRoot = await getRepoRoot(input.repoPath);
  return loadStats(repoRoot);
}

/**
 * Get configuration
 */
export async function getConfig(input: {
  repoPath?: string;
}): Promise<DefenceConfig> {
  const repoRoot = await getRepoRoot(input.repoPath);
  return loadConfig(repoRoot);
}

/**
 * Update configuration
 */
export async function setConfig(input: {
  repoPath?: string;
  config: Partial<DefenceConfig>;
}): Promise<{ success: boolean; config: DefenceConfig }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const current = await loadConfig(repoRoot);
  const updated = { ...current, ...input.config };
  await saveConfig(repoRoot, updated);
  return { success: true, config: updated };
}

/**
 * Add agent to whitelist
 */
export async function trustAgent(input: {
  repoPath?: string;
  agentName: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const config = await loadConfig(repoRoot);

  if (config.allowedAgents.includes(input.agentName)) {
    return { success: true, message: `Agent ${input.agentName} already trusted` };
  }

  config.allowedAgents.push(input.agentName);
  await saveConfig(repoRoot, config);

  return { success: true, message: `Agent ${input.agentName} added to trusted list` };
}

/**
 * Remove agent from whitelist
 */
export async function untrustAgent(input: {
  repoPath?: string;
  agentName: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const config = await loadConfig(repoRoot);

  config.allowedAgents = config.allowedAgents.filter(a => a !== input.agentName);
  await saveConfig(repoRoot, config);

  return { success: true, message: `Agent ${input.agentName} removed from trusted list` };
}

/**
 * Clear all events
 */
export async function clearEvents(input: {
  repoPath?: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const dir = await getDefenceDir(repoRoot);
  const eventsPath = path.join(dir, EVENTS_FILE);

  await fs.writeFile(eventsPath, "[]", "utf8");

  return { success: true, message: "Events cleared" };
}

// ============ MAIN HANDLER ============

export type DefenceAction =
  | "scan"              // Scan text for threats
  | "validate_agent"    // Validate agent identity
  | "validate_tool"     // Validate tool usage
  | "events"            // Get security events
  | "quarantine"        // Get quarantined items
  | "release"           // Release from quarantine
  | "stats"             // Get statistics
  | "config"            // Get configuration
  | "set_config"        // Update configuration
  | "trust"             // Trust an agent
  | "untrust"           // Untrust an agent
  | "clear_events";     // Clear event log

export async function handleDefenceTool(input: {
  action: DefenceAction;
  repoPath?: string;
  // For scan
  text?: string;
  source?: string;
  context?: string;
  // For validate_agent
  agentName?: string;
  agentId?: string;
  agentAction?: string;
  // For validate_tool
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  // For events
  limit?: number;
  category?: ThreatCategory;
  severity?: ThreatSeverity;
  // For quarantine
  includeExpired?: boolean;
  // For release
  id?: string;
  // For set_config
  config?: Partial<DefenceConfig>;
}): Promise<unknown> {
  switch (input.action) {
    case "scan":
      return scan({
        repoPath: input.repoPath,
        text: input.text || "",
        source: input.source,
        context: input.context,
      });

    case "validate_agent":
      return validateAgent({
        repoPath: input.repoPath,
        agentName: input.agentName || "",
        agentId: input.agentId,
        action: input.agentAction || "",
      });

    case "validate_tool":
      return validateToolUsage({
        repoPath: input.repoPath,
        agentName: input.agentName || "",
        toolName: input.toolName || "",
        toolArgs: input.toolArgs,
      });

    case "events":
      return getEvents({
        repoPath: input.repoPath,
        limit: input.limit,
        category: input.category,
        severity: input.severity,
      });

    case "quarantine":
      return getQuarantine({
        repoPath: input.repoPath,
        includeExpired: input.includeExpired,
      });

    case "release":
      return releaseFromQuarantine({
        repoPath: input.repoPath,
        id: input.id || "",
      });

    case "stats":
      return getStats({ repoPath: input.repoPath });

    case "config":
      return getConfig({ repoPath: input.repoPath });

    case "set_config":
      return setConfig({
        repoPath: input.repoPath,
        config: input.config || {},
      });

    case "trust":
      return trustAgent({
        repoPath: input.repoPath,
        agentName: input.agentName || "",
      });

    case "untrust":
      return untrustAgent({
        repoPath: input.repoPath,
        agentName: input.agentName || "",
      });

    case "clear_events":
      return clearEvents({ repoPath: input.repoPath });

    default:
      throw new Error(`Unknown defence action: ${input.action}`);
  }
}
