# **RabbitMQ Connect Helper**
A lightweight TypeScript library for managing RabbitMQ connections, queues, producers, and consumers. This package simplifies RabbitMQ integration in your Node.js applications by providing reusable helpers.

---

## **Features**

- Manage RabbitMQ connections and channels seamlessly.
- Support for multiple queues with dynamic queue creation.
- Easy-to-use producers and consumers for publishing and receiving messages.
- Built with TypeScript for type safety and better developer experience.

---

## **Installation**

Install the package via NPM:

```bash
npm install rabbitmq-connect-helper
```

## **Usage**

### Setup

Import the classes in your application:

```typescript
import { QueueManager, RabbitMQProducer, RabbitMQConsumer } from "rabbitmq-connect-helper";
```


### 🧩 Getting Started
### 🔌 Initialize QueueManager
```typescript
 import { QueueManager } from 'rabbitmq-connect-helper'; const queueManager = new QueueManager({
     connectionUrl: 'amqp:/user:password@localhost:5672', reconnectDelayMs: 5000, // Optional: Reconnect delay on failure 
 });
```


### ✅ Consumer Example
    Consume messages from a queue with built-in support for:

✅ Automatic message acknowledgment

🔁 Retry mechanism with delay

☠️ Dead Letter Queue (DLQ) support

⚙️ Custom prefetch count for performance tuning

```typescript
import { RabbitMQConsumer } from 'rabbitmq-connect-helper';
import { ConsumeMessage } from 'amqplib';

// Initialize RabbitMQConsumer with QueueManager
const consumer = new RabbitMQConsumer(queueManager);

const queueName = 'exampleQueue';

await consumer.consume(
  queueName,
  async (msg: ConsumeMessage, ack: () => void, retry: () => void) => {
    try {
      const payload = msg.content.toString();
      const data = JSON.parse(payload);

      console.log(`✅ Received message:`, data);

      // Your business logic goes here
      ack(); // Confirm successful processing
    } catch (error) {
      console.error(`❌ Error processing message from ${queueName}:`, error);
      await retry(); // Retry message with backoff, eventually to DLQ
    }
  },
  {
    prefetch: 10,                 // Optional: Controls concurrency
    retryAttempts: 3,             // Optional: Max retries before DLQ
    retryDelayMs: 5000,           // Optional: Wait time before retrying
    deadLetterQueueSuffix: '.DLQ' // Optional: DLQ naming pattern
  }
);
```

### 📤 Producer Example

Publish messages to a queue using the built-in RabbitMQProducer:

```typescript
import { QueueManager, RabbitMQProducer } from 'rabbitmq-connect-helper';

// Step 1: Initialize QueueManager
const queueManager = new QueueManager({
  connectionUrl: 'amqp://user:password@localhost:5672',
});

// Step 2: Create RabbitMQProducer instance
const producer = new RabbitMQProducer(queueManager);

// Step 3: Publish a message
const queueName = 'exampleQueue';
const payload = {
  id: '12345',
  action: 'create',
  data: {
    name: 'Test',
    value: 42
  }
};

await producer.publish(queueName, payload);

console.log(`✅ Message published to ${queueName}`);

```

✨ Features
JSON serialization built-in

Queue auto-declared (if not already present)

Retry logic (if supported by your queue manager configuration)

## **API Reference**

### QueueManager

**Constructor:** `new QueueManager(url: string)`  
Initializes a connection manager for RabbitMQ.

**Methods:**
- `closeAll()`: Closes all connections and channels.

### RabbitMQProducer

**Constructor:** `new RabbitMQProducer(queueManager: QueueManager)`  
Creates a producer instance.

**Methods:**
- `send(queueName: string, message: any)`: Publishes a message to the specified queue.

### RabbitMQConsumer

**Constructor:** `new RabbitMQConsumer(queueManager: QueueManager)`  
Creates a consumer instance.

**Methods:**
- `consume(queueName: string, callback: (message: string) => void)`: Listens for messages from the specified queue and processes them using the provided callback.

## **Configuration**

The library uses the RabbitMQ URL for connecting to the server. The URL format is:

```
amqp://<username>:<password>@<host>
```

Example:

```
amqp://admin:StrongPassword123@localhost
```

## **Testing**

Run unit tests using Jest:

```bash
npm run test
```

## **Contributing**

Contributions are welcome! Please fork the repository and create a pull request for any improvements or new features.

## **License**

This project is licensed under the MIT License. See the LICENSE file for details.

## **Support**

For any issues or feature requests, please create an issue on GitHub.