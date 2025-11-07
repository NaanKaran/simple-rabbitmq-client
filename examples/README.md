# Examples for RabbitMQ Connect Helper

This directory contains example usage of the `rabbitmq-connect-helper` library demonstrating various features and use cases.

## Available Examples

### 1. Basic Usage (`basic-usage.ts`)
- Simple producer and consumer setup
- Basic message sending and receiving
- Default configuration options

### 2. Advanced Usage (`advanced-usage.ts`)
- Advanced configuration with TLS, authentication, etc.
- Producer options (persistence, headers, correlation IDs)
- Consumer options (prefetch, timeouts, error handling)
- Exchange usage

### 3. Error Handling (`error-handling.ts`)
- Message retry mechanisms
- Dead Letter Queue (DLQ) usage
- Custom error handling
- Message processing timeouts

### 4. Exchange Usage (`exchange-usage.ts`)
- Sending messages to different exchange types
- Routing keys for topic exchanges
- Fanout exchange broadcasting

### 5. Comprehensive Example (`comprehensive.ts`)
- Demonstrates ALL features in a single example
- Best for understanding the complete API
- Shows integration of all concepts

### 6. Queue Management (`queue-management.ts`)
- Queue declaration, deletion, and purging
- Exchange declaration and management
- Queue-exchange binding
- Queue information retrieval

### 7. RPC Usage (`rpc-usage.ts`)
- Request-response communication pattern
- RPC client and server implementation
- Timeout handling for RPC calls

## Running Examples

To run any of the examples, you need to have a RabbitMQ server running locally or update the connection URL in the example files.

1. First, make sure you have the project dependencies installed:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Run a specific example using ts-node:
   ```bash
   npx ts-node examples/basic-usage.ts
   ```

Or compile and run:
```bash
npx tsc examples/basic-usage.ts --outDir dist/examples --module commonjs --target es2018 --esModuleInterop
node dist/examples/basic-usage.js
```

## Prerequisites

- Node.js (version 12 or higher)
- RabbitMQ server running (locally or accessible via network)
- TypeScript (if running with ts-node)

## Setting up RabbitMQ

If you don't have RabbitMQ running, you can:

1. Install locally: https://www.rabbitmq.com/download.html
2. Or use Docker:
   ```bash
   docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
   ```
3. Access management UI at http://localhost:15672 (default credentials: guest/guest)