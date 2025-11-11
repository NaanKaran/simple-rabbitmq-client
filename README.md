# **RabbitMQ Connect Helper**
A lightweight TypeScript library for managing RabbitMQ connections, queues, producers, and consumers. This package simplifies RabbitMQ integration in your Node.js applications by providing reusable helpers with comprehensive error handling, retry mechanisms, and advanced features.

---

## **Features**

- **Simple API**: Easy-to-use Connection class with event-driven interface
- **Easy Setup**: Simple initialization with comprehensive configuration options
- **Reliable Connections**: Automatic reconnection with configurable retry attempts and delays
- **Robust Error Handling**: Built-in retry mechanisms with dead letter queue support
- **Message Processing**: Timeout handling and message acknowledgment
- **Multiple Exchange Types**: Support for direct, topic, fanout, and headers exchanges
- **Queue Management**: Declare, bind, delete, and purge queues and exchanges
- **RPC Support**: Request-response pattern implementation
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Advanced Options**: TLS/SSL, authentication, and connection management
- **Graceful Shutdown**: Automatic cleanup of connections on process termination

---

## **Installation**

Install the package via NPM:

```bash
npm install rabbitmq-connect-helper
```

## **Consumer**

```typescript
import { Connection } from "rabbitmq-connect-helper";

// Initialize:
const rabbit = new Connection(
  "connecting_string_here"
);

// Consume messages from a queue:
// See API docs for all options
const sub = await rabbit.createConsumer(
  {
    queue: "my-queue",
    queueOptions: { durable: true },
    // Optionally handle messages with advanced options
  },
  async (msg) => {
    console.log("Received:", msg);
    // The message is automatically acknowledged when this function ends
  }
);

sub.on("error", (err) => {
  console.log("consumer error", err);
});

```

## **Simplified API**

The library provides a simple Connection class with Consumer and Publisher instances for professional RabbitMQ usage:

```typescript
import { Connection } from 'rabbitmq-connect-helper';

// Initialize:
const rabbit = new Connection('amqp://guest:guest@localhost:5672')
rabbit.on('error', (err) => {
  console.log('RabbitMQ connection error', err)
})
rabbit.on('connection', () => {
  console.log('Connection successfully (re)established')
})

// Create a consumer with advanced options
const sub = await rabbit.createConsumer({
  queue: 'user-events',
  queueOptions: {durable: true},
  // handle 2 messages at a time
  qos: {prefetchCount: 2},
  // Optionally ensure an exchange exists
  exchanges: [{exchange: 'my-events', type: 'topic'}],
  // With a "topic" exchange, messages matching this pattern are routed to the queue
  queueBindings: [{exchange: 'my-events', routingKey: 'users.*'}],
}, async (msg) => {
  console.log('received message (user-events)', msg)
  // The message is automatically acknowledged (BasicAck) when this function ends.
  // If this function throws an error, then msg is rejected (BasicNack) and
  // possibly requeued or sent to a dead-letter exchange. You can also return a
  // status code from this callback to control the ack/nack behavior
  // per-message.
})

sub.on('error', (err) => {
  // Maybe the consumer was cancelled, or the connection was reset before a
  // message could be acknowledged.
  console.log('consumer error (user-events)', err)
})

// Declare a publisher
// See API docs for all options
const pub = await rabbit.createPublisher({
  // Enable publish confirmations, similar to consumer acknowledgements
  confirm: true,
  // Enable retries
  maxAttempts: 2,
  // Optionally ensure the existence of an exchange before we use it
  exchanges: [{exchange: 'my-events', type: 'topic'}]
})

// Publish a message to a custom exchange
await pub.send(
  {exchange: 'my-events', routingKey: 'users.visit'}, // metadata
  {id: 1, name: 'Alan Turing'}) // message content

// Or publish directly to a queue
await pub.send('user-events', {id: 1, name: 'Alan Turing'})

// Clean up when you receive a shutdown signal
async function onShutdown() {
  // Waits for pending confirmations and closes the underlying Channel
  await pub.close()
  // Stop consuming. Wait for any pending message handlers to settle.
  await sub.close()
  await rabbit.close()
}
process.on('SIGINT', onShutdown)
process.on('SIGTERM', onShutdown)
```

## **Basic Producer API**

For simpler use cases, you can use the direct producer API:

```typescript
import { Connection } from 'rabbitmq-connect-helper';

// Initialize:
const rabbit = new Connection('amqp://guest:guest@localhost:5672')
rabbit.on('error', (err) => {
  console.log('RabbitMQ connection error', err)
})
rabbit.on('connection', () => {
  console.log('Connection successfully (re)established')
})

// Send a message:
const publisher = await rabbit.createProducer({ queue: 'my-queue' })
const success = await publisher.send({ hello: 'world' })
console.log('Message sent:', success)

// Publish to exchange:
await rabbit.sendToExchange('my-exchange', 'routing.key', { hello: 'world' })

// Queue and exchange declarations:
await rabbit.queueDeclare('my-queue', { durable: true })
await rabbit.exchangeDeclare('my-exchange', 'topic', { durable: true })
await rabbit.queueBind('my-queue', 'my-exchange', 'routing.key')

// Close connection when done:
await rabbit.close()
```

## **Getting Started**

### Install the package:

```bash
npm install rabbitmq-connect-helper
```

### Simple Connection API

The library provides a simple Connection class for easy RabbitMQ integration:

```typescript
import { Connection } from 'rabbitmq-connect-helper';

// Initialize:
const rabbit = new Connection('amqp://guest:guest@localhost:5672')
rabbit.on('error', (err) => {
  console.log('RabbitMQ connection error', err)
})
rabbit.on('connection', () => {
  console.log('Connection successfully (re)established')
})

// Consume messages from a queue:
// See API docs for all options
const sub = await rabbit.createConsumer({
  queue: 'my-queue',
  queueOptions: {durable: true},
  // Optionally handle messages with advanced options
}, async (msg) => {
  console.log('Received:', msg)
  // The message is automatically acknowledged when this function ends
})

sub.on('error', (err) => {
  console.log('consumer error', err)
})

// Send a message:
const publisher = await rabbit.createProducer({ queue: 'my-queue' })
const success = await publisher.send({ hello: 'world' })
console.log('Message sent:', success)

// Publish to exchange:
await rabbit.sendToExchange('my-exchange', 'routing.key', { hello: 'world' })

// Queue and exchange declarations:
await rabbit.queueDeclare('my-queue', { durable: true })
await rabbit.exchangeDeclare('my-exchange', 'topic', { durable: true })
await rabbit.queueBind('my-queue', 'my-exchange', 'routing.key')

// Close connection when done:
await rabbit.close()
```

### Advanced Configuration

For more control, you can still use the individual classes:

```typescript
import { QueueManager, RabbitMQProducer, RabbitMQConsumer, RabbitMqConfig } from "rabbitmq-connect-helper";
```

#### 🔌 Initialize QueueManager

```typescript
import { QueueManager, RabbitMqConfig } from 'rabbitmq-connect-helper';

// Basic configuration
const config: RabbitMqConfig = {
  url: 'amqp://localhost',  // Replace with your RabbitMQ server URL
  maxRetries: 3,            // Retry connection 3 times before giving up
  retryDelay: 5000,         // Wait 5 seconds between reconnection attempts
  heartbeat: 30             // Heartbeat interval in seconds
};

const queueManager = new QueueManager(config);
```

### 📤 Basic Producer Usage

```typescript
import { QueueManager, RabbitMQProducer, RabbitMqConfig } from 'rabbitmq-connect-helper';

const config: RabbitMqConfig = { url: 'amqp://localhost' };
const queueManager = new QueueManager(config);
const producer = new RabbitMQProducer(queueManager);

// Send a simple message
const success = await producer.send('my-queue', { message: 'Hello World!' });

if (success) {
  console.log('✅ Message sent successfully!');
} else {
  console.log('❌ Message was dropped');
}
```

### ✅ Basic Consumer Usage

```typescript
import { QueueManager, RabbitMQConsumer, RabbitMqConfig } from 'rabbitmq-connect-helper';
import { ConsumeMessage } from 'amqplib';

const config: RabbitMqConfig = { url: 'amqp://localhost' };
const queueManager = new QueueManager(config);
const consumer = new RabbitMQConsumer(queueManager);

// Set up consumer
await consumer.consume(
  'my-queue',
  async (msg: ConsumeMessage, ack: () => void) => {
    console.log('Received:', msg.content.toString());
    ack(); // Acknowledge message processing
  }
);

console.log('Consumer is listening...');
```

## **Advanced Usage**

### Enhanced Configuration with All Options

```typescript
import { QueueManager, RabbitMqConfig } from 'rabbitmq-connect-helper';

const config: RabbitMqConfig = {
  url: 'amqp://user:password@localhost:5672',
  options: {
    // Additional amqplib options
  },
  connectionTimeout: 10000,      // Connection timeout in ms
  maxRetries: 5,                 // Maximum reconnection attempts
  retryDelay: 30000,             // Delay between reconnection attempts (ms)
  heartbeat: 30,                 // Heartbeat interval (seconds)
  tls: {
    enabled: false,              // Enable TLS/SSL
    certPath: '/path/to/cert',   // Path to certificate file
    keyPath: '/path/to/key',     // Path to key file
    caPath: '/path/to/ca',       // Path to CA certificate
    passphrase: 'passphrase'     // Passphrase if required
  },
  authentication: {
    username: 'username',        // Username for authentication
    password: 'password'         // Password for authentication
  }
};

const queueManager = new QueueManager(config);
```

### Consumer with Error Handling and Retries

```typescript
import { RabbitMQConsumer, ConsumerOptions } from 'rabbitmq-connect-helper';
import { ConsumeMessage } from 'amqplib';

const consumer = new RabbitMQConsumer(queueManager);

const consumerOptions: ConsumerOptions = {
  prefetch: 5,                    // Process up to 5 messages concurrently
  retryAttempts: 3,               // Retry failed messages up to 3 times
  retryDelayMs: 5000,             // Wait 5 seconds between retries
  deadLetterQueueSuffix: '.DLQ',  // Send to DLQ after retries exhausted
  processingTimeout: 30000,       // Timeout message processing after 30s
  errorHandler: (error, queueName, msg) => {
    console.error(`Error in ${queueName}:`, error.message);
    // Custom error handling logic
  }
};

await consumer.consume(
  'exampleQueue',
  async (msg: ConsumeMessage, ack: () => void, retry: () => void) => {
    try {
      const payload = JSON.parse(msg.content.toString());
      console.log('Received message:', payload);
      
      // Your business logic here
      await processBusinessLogic(payload);
      
      ack(); // Acknowledge successful processing
    } catch (error) {
      console.error('Error processing message:', error);
      await retry(); // Retry the message
    }
  },
  consumerOptions
);
```

### Producer with Advanced Options

```typescript
import { RabbitMQProducer, ProducerOptions } from 'rabbitmq-connect-helper';

const producer = new RabbitMQProducer(queueManager);

const producerOptions: ProducerOptions = {
  persistent: true,                         // Make message persistent
  contentType: 'application/json',          // Content type of the message
  correlationId: 'unique-request-id',       // Correlation ID for RPC
  replyTo: 'reply-queue-name',              // Reply-to queue name
  expiration: 60000,                        // Message expires after 1 minute
  headers: { 
    custom: 'value',
    timestamp: new Date().toISOString()
  }                                         // Additional headers
};

const message = {
  id: '12345',
  action: 'create',
  data: {
    name: 'Test Item',
    value: 42
  }
};

const success = await producer.send('my-queue', message, producerOptions);
```

### Publishing to Exchanges

```typescript
// Publish to a topic exchange
await producer.sendToExchange(
  'my-topic-exchange',
  'user.signup',
  { userId: 123, timestamp: new Date().toISOString() },
  producerOptions
);

console.log('Message published to exchange');
```

## **Queue Management**

The library provides additional tools for managing queues and exchanges:

```typescript
import { RabbitMQManager } from 'rabbitmq-connect-helper';

const manager = new RabbitMQManager(queueManager);

// Declare a queue
await manager.declareQueue('my-queue', {
  durable: true,
  autoDelete: false
});

// Declare an exchange
await manager.declareExchange('my-exchange', {
  type: 'topic',
  durable: true
});

// Bind queue to exchange
await manager.bindQueue('my-queue', 'my-exchange', 'user.*');

// Get queue information
const info = await manager.getQueueInfo('my-queue');
console.log('Queue info:', info);

// Purge all messages from queue
const purgeResult = await manager.purgeQueue('my-queue');
console.log('Purged messages:', purgeResult.messageCount);
```

## **RPC (Request-Response) Pattern**

Implement request-response communication between services:

```typescript
import { RabbitMQRPCServer, RabbitMQRPCClient } from 'rabbitmq-connect-helper';

// Server setup
const rpcServer = new RabbitMQRPCServer(queueManager);
await rpcServer.listen('rpc-queue', async (request, reply) => {
  // Process the request
  const result = await processRequest(request);
  
  // Send response
  await reply(result);
});

// Client setup
const rpcClient = new RabbitMQRPCClient(queueManager, producer);
await rpcClient.init();

// Make an RPC call
const response = await rpcClient.send('rpc-queue', { 
  operation: 'add', 
  a: 5, 
  b: 3 
});

console.log('RPC Response:', response.body);
```

## **Complete Working Example**

Here's a complete example that demonstrates all the main features:

```typescript
import { 
  QueueManager, 
  RabbitMQConsumer, 
  RabbitMQProducer, 
  RabbitMqConfig,
  ConsumerOptions 
} from 'rabbitmq-connect-helper';

// 1. Configuration
const config: RabbitMqConfig = {
  url: 'amqp://localhost',
  maxRetries: 3,
  retryDelay: 5000,
  heartbeat: 30
};

async function runExample() {
  // 2. Initialize components
  const queueManager = new QueueManager(config);
  const consumer = new RabbitMQConsumer(queueManager);
  const producer = new RabbitMQProducer(queueManager);

  // 3. Define queue name
  const queueName = 'example-queue';

  // 4. Setup consumer with error handling
  const consumerOptions: ConsumerOptions = {
    prefetch: 2,
    retryAttempts: 3,
    retryDelayMs: 2000,
    deadLetterQueueSuffix: '.DLQ',
    processingTimeout: 10000,
    errorHandler: (error, queueName, msg) => {
      console.error(`Error in ${queueName}:`, error.message);
    }
  };

  await consumer.consume(
    queueName,
    async (msg, ack, retry) => {
      try {
        const content = JSON.parse(msg.content.toString());
        console.log('Processing:', content);
        
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ Message processed successfully');
        ack();
      } catch (error) {
        console.error('❌ Error processing message:', error);
        await retry();
      }
    },
    consumerOptions
  );

  // 5. Send messages
  for (let i = 1; i <= 3; i++) {
    const success = await producer.send(queueName, {
      id: i,
      message: `Hello World ${i}`,
      timestamp: new Date().toISOString()
    });

    if (success) {
      console.log(`✅ Message ${i} sent`);
    }
  }

  // 6. Wait for processing and cleanup
  await new Promise(resolve => setTimeout(resolve, 5000));
  await queueManager.closeAll();
}

// Run the example
runExample().catch(console.error);
```

## **API Reference**

### QueueManager

**Constructor:** `new QueueManager(config: RabbitMqConfig)`  
Initializes a connection manager for RabbitMQ with the specified configuration.

**Methods:**
- `getOrCreateQueue(queueName: string): Promise<Channel>` - Creates or retrieves a queue channel
- `closeQueue(queueName: string): Promise<void>` - Closes a specific queue connection
- `closeAll(): Promise<void>` - Closes all connections and channels
- `getConnectionStatus(): { totalConnections: number, activeQueues: string[], connectionAttempts: Map<string, number> }` - Gets connection status and resource usage
- `getActiveConnectionCount(): number` - Gets the number of active connections

### RabbitMQProducer

**Constructor:** `new RabbitMQProducer(queueManager: QueueManager)`  
Creates a producer instance.

**Methods:**
- `send(queueName: string, message: string | object | Buffer, options?: ProducerOptions): Promise<boolean>` - Publishes a message to the specified queue
- `sendToExchange(exchangeName: string, routingKey: string, message: string | object | Buffer, options?: ProducerOptions): Promise<void>` - Publishes a message to an exchange

### RabbitMQConsumer

**Constructor:** `new RabbitMQConsumer(queueManager: QueueManager)`  
Creates a consumer instance.

**Methods:**
- `consume(queueName: string, callback: (message: ConsumeMessage, ack: () => void, retry: () => void) => Promise<void>, options?: ConsumerOptions): Promise<void>` - Listens for messages from the specified queue
- `pause(queueName: string): void` - Pauses consuming from a queue
- `resume(queueName: string): void` - Resumes consuming from a queue
- `stop(queueName: string): Promise<void>` - Stops consuming from a queue
- `getMetrics(): Record<string, { ack: number, nack: number, errors: number }>` - Gets consumer metrics

### RabbitMQManager

**Constructor:** `new RabbitMQManager(queueManager: QueueManager)`  
Creates a queue and exchange management instance.

**Methods:**
- `declareQueue(queueName: string, options?: QueueDeclarationOptions): Promise<any>` - Declares a queue
- `deleteQueue(queueName: string): Promise<any>` - Deletes a queue
- `purgeQueue(queueName: string): Promise<any>` - Purges all messages from a queue
- `declareExchange(exchangeName: string, options?: ExchangeDeclarationOptions): Promise<any>` - Declares an exchange
- `deleteExchange(exchangeName: string): Promise<any>` - Deletes an exchange
- `bindQueue(queueName: string, exchangeName: string, routingKey?: string): Promise<void>` - Binds a queue to an exchange
- `unbindQueue(queueName: string, exchangeName: string, routingKey?: string): Promise<void>` - Unbinds a queue from an exchange
- `getQueueInfo(queueName: string): Promise<QueueInfo>` - Gets information about a queue
- `getMessage(queueName: string): Promise<any>` - Gets a single message from a queue (basic.get)
- `closeAll(): Promise<void>` - Closes all managed connections

### RabbitMQRPCClient

**Constructor:** `new RabbitMQRPCClient(queueManager: QueueManager, producer: RabbitMQProducer, options?: RPCOptions)`  
Creates an RPC client instance.

**Methods:**
- `init(): Promise<void>` - Initializes the RPC client
- `send(queueName: string, body: any, options?: ProducerOptions): Promise<RPCResponse>` - Sends an RPC request and waits for response
- `close(): Promise<void>` - Closes the RPC client

### RabbitMQRPCServer

**Constructor:** `new RabbitMQRPCServer(queueManager: QueueManager, options?: RPCServerOptions)`  
Creates an RPC server instance.

**Methods:**
- `listen(queueName: string, handler: RPCRequestHandler): Promise<void>` - Starts listening for RPC requests on the specified queue

### Connection

**Constructor:** `new Connection(connectionString: string, options?: Partial<RabbitMqConfig>)`
Creates a connection instance with automatic reconnection features.

**Methods:**
- `createConsumer(config: EnhancedConsumerOptionsBase, handler: (msg: any) => Promise<void | number>): Promise<Consumer>` - Creates a consumer instance with advanced options
- `createPublisher(options: EnhancedPublisherOptions): Promise<Publisher>` - Creates a publisher instance with advanced options
- `createProducer(options: EnhancedProducerOptions): Promise<EnhancedProducer>` - Creates an enhanced producer instance that can send messages to a queue with advanced options
- `createProducer(queueName: string, options?: ProducerOptionsOnly): Promise<SimpleProducer>` - Creates a simple producer instance for the specified queue name with optional queue options
- `sendToExchange(exchangeName: string, routingKey: string, message: any): Promise<void>` - Sends a message directly to an exchange
- `queueDeclare(queueName: string, options?: QueueOptions): Promise<void>` - Declares a queue with the specified options
- `exchangeDeclare(exchangeName: string, type: string, options?: Omit<ExchangeOptions, 'exchange' | 'type'>): Promise<void>` - Declares an exchange with the specified type and options
- `queueBind(queueName: string, exchangeName: string, routingKey: string): Promise<void>` - Binds a queue to an exchange with the specified routing key
- `close(): Promise<void>` - Closes all connections and channels

## **Testing**

Run unit tests using Jest:

```bash
npm run test
```

## **Examples**

Check out the [examples directory](./examples/) for comprehensive usage examples:

- [Basic usage](./examples/basic-usage.ts) - Simple producer/consumer example
- [Advanced usage](./examples/advanced-usage.ts) - Configuration with TLS, authentication, and advanced options  
- [Error handling](./examples/error-handling.ts) - Retry mechanisms and Dead Letter Queue usage
- [Exchange usage](./examples/exchange-usage.ts) - Sending messages to different exchange types
- [Comprehensive example](./examples/comprehensive.ts) - All features demonstrated in one example
- [Queue management](./examples/queue-management.ts) - Queue and exchange declaration, binding, and management
- [RPC usage](./examples/rpc-usage.ts) - Request-response communication between services

To run the examples:
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run a specific example
npx ts-node examples/basic-usage.ts
```

## **Contributing**

Contributions are welcome! Please fork the repository and create a pull request for any improvements or new features.

## **License**

This project is licensed under the MIT License. See the LICENSE file for details.

## **Support**

For any issues or feature requests, please create an issue on GitHub.