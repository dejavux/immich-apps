/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/apps/planner"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^@family-memories/planner-schema$":
      "<rootDir>/packages/planner-schema/src/index.ts",
    "^@family-memories/planner/adapters/lion/search$":
      "<rootDir>/apps/planner/src/adapters/lion/search.ts",
    "^@family-memories/planner/(.*)$": "<rootDir>/apps/planner/src/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          types: ["jest", "node"],
          baseUrl: ".",
          paths: {
            "@family-memories/planner-schema": [
              "packages/planner-schema/src/index.ts",
            ],
            "@family-memories/planner/adapters/lion/search": [
              "apps/planner/src/adapters/lion/search.ts",
            ],
            "@family-memories/planner/adapters/lion/normalize": [
              "apps/planner/src/adapters/lion/normalize.ts",
            ],
          },
        },
      },
    ],
  },
};
