export default {
  preset: "ts-jest", // Use ts-jest to handle TypeScript
  testEnvironment: "node", // Set test environment to Node.js
  transform: {
    "^.+\\.tsx?$": "ts-jest", // Transform TypeScript files
  },
  moduleFileExtensions: ["ts", "js"], // Recognize these extensions
  testMatch: ["<rootDir>/src/test/test.ts"], // Run tests ending with `.test.ts`
  moduleDirectories: ["node_modules", "src"], // Resolve modules
  transformIgnorePatterns: [
    "/node_modules/", // Ignore transformations in node_modules
  ],
};
