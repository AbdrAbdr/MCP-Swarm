/**
 * Agent Profiles — Predefined specialist templates
 * 
 * MCP Swarm v1.2.0
 * 
 * Profiles: frontend, backend, security, devops, fullstack, custom
 * Each profile provides context instructions and task prioritization.
 */

import { loadSwarmConfig } from "./setupWizard.js";

// ============ TYPES ============

export type ProfileType = "frontend" | "backend" | "security" | "devops" | "fullstack" | "custom";

export interface AgentProfile {
    type: ProfileType;
    name: string;
    description: string;
    instructions: string;
    priorities: string[];
    skills: string[];
}

// ============ PROFILE DEFINITIONS ============

const profiles: Record<ProfileType, AgentProfile> = {
    frontend: {
        type: "frontend",
        name: "Frontend Specialist",
        description: "Expert in React, Vue, Angular, CSS, A11y, responsive design",
        instructions: `You are a Frontend Specialist agent. Your priorities:
1. UI/UX quality and responsiveness
2. Accessibility (WCAG 2.1 AA)
3. Performance (Core Web Vitals)
4. Component architecture and reusability
5. Cross-browser compatibility`,
        priorities: ["ui", "css", "components", "accessibility", "performance"],
        skills: ["react", "vue", "css", "html", "typescript", "testing-library", "storybook"],
    },

    backend: {
        type: "backend",
        name: "Backend Specialist",
        description: "Expert in APIs, databases, queues, caching, microservices",
        instructions: `You are a Backend Specialist agent. Your priorities:
1. API design (REST/GraphQL best practices)
2. Database optimization and indexing
3. Security (input validation, auth, rate limiting)
4. Error handling and logging
5. Scalability patterns`,
        priorities: ["api", "database", "auth", "performance", "security"],
        skills: ["node", "express", "postgres", "redis", "docker", "rest", "graphql"],
    },

    security: {
        type: "security",
        name: "Security Auditor",
        description: "Expert in OWASP, CVE analysis, RLS, JWT, XSS prevention",
        instructions: `You are a Security Auditor agent. Your priorities:
1. OWASP Top 10 vulnerabilities
2. Authentication and authorization flaws
3. Data exposure and injection attacks
4. Dependency vulnerabilities (npm audit)
5. RLS policies and access control`,
        priorities: ["vulnerabilities", "auth", "injection", "dependencies", "access-control"],
        skills: ["owasp", "jwt", "rls", "xss", "csrf", "sql-injection", "npm-audit"],
    },

    devops: {
        type: "devops",
        name: "DevOps Engineer",
        description: "Expert in CI/CD, Docker, GitHub Actions, monitoring, deployments",
        instructions: `You are a DevOps Engineer agent. Your priorities:
1. CI/CD pipeline reliability
2. Docker optimization (layer caching, multi-stage)
3. Infrastructure as Code
4. Monitoring and alerting
5. Deployment automation`,
        priorities: ["ci-cd", "docker", "infrastructure", "monitoring", "deployment"],
        skills: ["docker", "github-actions", "terraform", "kubernetes", "monitoring", "bash"],
    },

    fullstack: {
        type: "fullstack",
        name: "Fullstack Developer",
        description: "Balanced skills across frontend, backend, and infrastructure",
        instructions: `You are a Fullstack Developer agent. Your priorities:
1. End-to-end feature delivery
2. Consistent API contracts
3. User experience and performance
4. Code quality and testing
5. Documentation`,
        priorities: ["features", "api", "ui", "testing", "documentation"],
        skills: ["react", "node", "typescript", "postgres", "css", "docker", "testing"],
    },

    custom: {
        type: "custom",
        name: "Custom Agent",
        description: "User-defined agent profile",
        instructions: "Follow the custom instructions provided by the user.",
        priorities: [],
        skills: [],
    },
};

// ============ PUBLIC API ============

/**
 * Get a profile definition
 */
export function getProfile(type: ProfileType): AgentProfile {
    return profiles[type] || profiles.fullstack;
}

/**
 * Get all available profiles
 */
export function listProfiles(): AgentProfile[] {
    return Object.values(profiles);
}

/**
 * Get the configured default profile
 */
export async function getDefaultProfile(repoPath?: string): Promise<AgentProfile> {
    const config = await loadSwarmConfig(repoPath);

    if (config?.profiles?.enabled && config.profiles.defaultProfile) {
        const profile = getProfile(config.profiles.defaultProfile);

        // Apply custom description if set
        if (config.profiles.defaultProfile === "custom" && config.profiles.customDescription) {
            return {
                ...profile,
                instructions: config.profiles.customDescription,
            };
        }

        return profile;
    }

    return profiles.fullstack;
}

/**
 * Get agent instructions based on profile (for injection into agent context)
 */
export async function getProfileInstructions(repoPath?: string, profileType?: ProfileType): Promise<string> {
    const profile = profileType
        ? getProfile(profileType)
        : await getDefaultProfile(repoPath);

    return profile.instructions;
}
