// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $streams: i.entity({
      abortReason: i.string().optional(),
      clientId: i.string().unique().indexed(),
      done: i.boolean().optional(),
      size: i.number().optional(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
    }),
    factories: i.entity({
      name: i.string().unique().indexed(),
      createdAt: i.date().optional(),
      engine: i.string().indexed().optional(),
      sandboxId: i.string().optional(),
      snapshotId: i.string().optional(),
      githubRepoUrl: i.string().optional(),
      githubToken: i.string().optional(),
      gitName: i.string().optional(),
      gitEmail: i.string().optional(),
      cursorApiKey: i.string().optional(),
    }),
    factoryUsers: i.entity({
      role: i.string().optional(),
      createdAt: i.date().optional(),
    }),
    skills: i.entity({
      installedAt: i.string().indexed().optional(),
      lastError: i.string().optional(),
      name: i.string().indexed(),
      repoUrl: i.string().indexed(),
      skillPath: i.string().optional(),
      status: i.string().indexed(),
    }),
    factoryMcpServers: i.entity({
      authType: i.string().indexed().optional(),
      authStatus: i.string().indexed().optional(),
      authenticatedAt: i.string().indexed().optional(),
      bearerToken: i.string().optional(),
      enabled: i.boolean().optional(),
      lastError: i.string().optional(),
      loginUrl: i.string().optional(),
      lastSyncAt: i.string().indexed().optional(),
      name: i.string().indexed(),
      scopes: i.string().optional(),
      status: i.string().indexed(),
      syncStatus: i.string().indexed().optional(),
      url: i.string().indexed(),
    }),
    factoryMcpCredentials: i.entity({
      connectionId: i.string().indexed(),
      createdAt: i.string().indexed(),
      credentialType: i.string().indexed(),
      encryptedBearerToken: i.string().optional(),
      updatedAt: i.string().indexed(),
    }),
    factoryMcpOauthStates: i.entity({
      authorizationUrl: i.string().optional(),
      connectionId: i.string().indexed(),
      createdAt: i.string().indexed(),
      discoveryState: i.json().optional(),
      encryptedClientInformation: i.string().optional(),
      encryptedCodeVerifier: i.string().optional(),
      encryptedTokens: i.string().optional(),
      state: i.string().unique().indexed(),
      updatedAt: i.string().indexed(),
    }),
    factoryMcpCapabilities: i.entity({
      capabilityType: i.string().indexed(),
      createdAt: i.string().indexed(),
      description: i.string().optional(),
      enabled: i.boolean(),
      inputSchema: i.json().optional(),
      mcpServerId: i.string().indexed(),
      namespacedName: i.string().unique().indexed(),
      outputSchema: i.json().optional(),
      updatedAt: i.string().indexed(),
      upstreamName: i.string().indexed(),
    }),
    runs: i.entity({
      name: i.string().optional(),
      createdAt: i.date().optional(),
      sandboxId: i.string().optional(),
      status: i.string().optional(),
    }),
    events: i.entity({
      createdAt: i.date().optional(),
      type: i.string().optional(),
      data: i.json().optional(),
    }),
  },
  links: {
    $streams$files: {
      forward: {
        on: "$streams",
        has: "many",
        label: "$files",
      },
      reverse: {
        on: "$files",
        has: "one",
        label: "$stream",
        onDelete: "cascade",
      },
    },
    $usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
    factoryFactoryUsers: {
      forward: {
        on: "factories",
        has: "many",
        label: "factoryUsers",
      },
      reverse: {
        on: "factoryUsers",
        has: "one",
        label: "factory",
        onDelete: "cascade",
      },
    },
    userFactoryUsers: {
      forward: {
        on: "$users",
        has: "many",
        label: "factoryUsers",
      },
      reverse: {
        on: "factoryUsers",
        has: "one",
        label: "user",
        onDelete: "cascade",
      },
    },
    runEvents: {
      forward: {
        on: "runs",
        has: "many",
        label: "events",
      },
      reverse: {
        on: "events",
        has: "one",
        label: "run",
        onDelete: "cascade",
      },
    },
    installedSkills: {
      forward: {
        on: "factories",
        has: "many",
        label: "skills",
      },
      reverse: {
        on: "skills",
        has: "one",
        label: "factory",
        onDelete: "cascade",
      },
    },
    factoryMcpServers: {
      forward: {
        on: "factories",
        has: "many",
        label: "mcpServers",
      },
      reverse: {
        on: "factoryMcpServers",
        has: "one",
        label: "factory",
        onDelete: "cascade",
      },
    },
    factoryMcpServerCapabilities: {
      forward: {
        on: "factoryMcpServers",
        has: "many",
        label: "capabilities",
      },
      reverse: {
        on: "factoryMcpCapabilities",
        has: "one",
        label: "mcpServer",
        onDelete: "cascade",
      },
    },
    factoryRuns: {
      forward: {
        on: "factories",
        has: "many",
        label: "runs",
      },
      reverse: {
        on: "runs",
        has: "one",
        label: "factory",
      },
    },
    eventUsers: {
      forward: {
        on: "events",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "event",
      },
    },
  },
  rooms: {},
});

// This helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema;
type AppSchema = _AppSchema;
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
