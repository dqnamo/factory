// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/react";
import type { AppSchema } from "./instant.schema";

const rules = {
  $default: {
    allow: {
      $default: "false",
      link: { $default: "false" },
      unlink: { $default: "false" },
    },
  },
  attrs: {
    allow: {
      create: "false",
    },
  },
  $users: {
    allow: {
      view: "auth.id == data.id || auth.id in data.ref('factoryUsers.factory.factoryUsers.user.id')",
      create: "true",
      update: "false",
      delete: "false",
    },
    fields: {
      email: "auth.id == data.id",
    },
  },
  factories: {
    allow: {
      view: "isFactoryMember",
      create: "false",
      update: "false",
      delete: "false",
    },
    bind: {
      isFactoryMember: "auth.id != null && auth.id in data.ref('factoryUsers.user.id')",
    },
    fields: {
      githubToken: "false",
      cursorApiKey: "false",
    },
  },
  factoryUsers: {
    allow: {
      view: "isOwnMembership || isFactoryMember",
      create: "false",
      update: "false",
      delete: "false",
    },
    bind: {
      isOwnMembership: "auth.id != null && auth.id in data.ref('user.id')",
      isFactoryMember: "auth.id != null && auth.id in data.ref('factory.factoryUsers.user.id')",
    },
  },
  runs: {
    allow: {
      view: "isFactoryMember",
      create: "isFactoryMember",
      update: "isFactoryMember",
      delete: "false",
      link: {
        factory: "isFactoryMember",
        events: "isFactoryMember",
      },
    },
    bind: {
      isFactoryMember: "auth.id != null && auth.id in data.ref('factory.factoryUsers.user.id')",
    },
  },
  events: {
    allow: {
      view: "isFactoryMember",
      create: "isFactoryMember",
      update: "false",
      delete: "false",
      link: {
        run: "isFactoryMember",
        user: "false",
      },
    },
    bind: {
      isFactoryMember: "auth.id != null && auth.id in data.ref('run.factory.factoryUsers.user.id')",
    },
  },
  skills: {
    allow: {
      view: "isFactoryMember",
      create: "false",
      update: "false",
      delete: "false",
    },
    bind: {
      isFactoryMember: "auth.id != null && auth.id in data.ref('factory.factoryUsers.user.id')",
    },
  },
  factoryMcpServers: {
    allow: {
      view: "isFactoryMember",
      create: "false",
      update: "isFactoryMember && onlyEnabledChanged",
      delete: "isFactoryMember",
    },
    bind: {
      isFactoryMember: "auth.id != null && auth.id in data.ref('factory.factoryUsers.user.id')",
      onlyEnabledChanged: "request.modifiedFields.all(field, field in ['enabled'])",
    },
    fields: {
      bearerToken: "false",
    },
  },
  factoryMcpCapabilities: {
    allow: {
      view: "isFactoryMember",
      create: "false",
      update: "isFactoryMember && onlyEnabledChanged",
      delete: "false",
    },
    bind: {
      isFactoryMember:
        "auth.id != null && auth.id in data.ref('mcpServer.factory.factoryUsers.user.id')",
      onlyEnabledChanged: "request.modifiedFields.all(field, field in ['enabled'])",
    },
  },
  factoryMcpCredentials: {
    allow: {
      $default: "false",
    },
  },
  factoryMcpOauthStates: {
    allow: {
      $default: "false",
    },
  },
  $files: {
    allow: {
      $default: "false",
    },
  },
  $streams: {
    allow: {
      $default: "false",
    },
  },
} satisfies InstantRules<AppSchema>;

export default rules;
