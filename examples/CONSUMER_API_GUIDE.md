# RabbitMQ Consumer API Guide

This guide explains how to properly use the RabbitMQ consumer API in this library.

## Basic Consumer Usage

### Creating a Simple Consumer (Enhanced API)

```typescript
import { Connection } from 'your-rabbitmq-library';

// Create connection
const rabbit = new Connection('amqp://guest:guest@localhost:5672');

// Create a consumer with enhanced API
const consumer = await rabbit.createConsumer({
  queue: 'my-queue-name',        // Queue to consume from
  queueOptions: { 
    durable: true                // Make queue survive server restarts
  },
  qos: { 
    prefetchCount: 1            // Process 1 message at a time
  }
}, async (msg) => {
  // Message handler function - process each incoming message
  console.log('Received message:', msg);
  
  // Your business logic here
  await processMessage(msg);
  
  // Message is auto-acked when function completes successfully
  // Message is auto-nacked if function throws an error
});
```

### Using the Direct Consumer API (Lower-level)

For more granular control over message acknowledgment and retries, you can use the direct `consume` method:

```typescript
import { Connection, ConsumerOptions } from 'your-rabbitmq-library';
import { ConsumeMessage } from 'amqplib';  // For TypeScript typing

// Create connection
const rabbit = new Connection('amqp://guest:guest@localhost:5672');

// Define consumer options
const options: ConsumerOptions = {
  prefetch: 1,                    // Process 1 message at a time
  retryAttempts: 3,               // Retry failed messages up to 3 times
  retryDelayMs: 5000,             // Wait 5 seconds between retries
  deadLetterQueueSuffix: '.dlq',  // Send to DLQ after retries exhausted
  processingTimeout: 30000        // Timeout message processing after 30 seconds
};

// Use the direct consume method
await rabbit.consume(
  'my-queue-name',                                    // Queue name
  async (msg: ConsumeMessage, ack, retry) => {        // Message handler with direct ack/retry control
    try {
      console.log('Received message:', msg.content.toString());
      
      // Your business logic here
      await processMessage(msg);
      
      // Explicitly acknowledge the message when processing is successful
      ack();                                           // Message is acknowledged and removed from queue
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Manual control options:
      retry();                                         // Retry the message
      // OR
      // ack();                                         // Acknowledge (remove from queue) despite error
      // OR
      // Just let the error propagate                    // Library will handle based on options
    }
  },
  options                                             // Consumer configuration options
);
```

### Comparison of APIs

| Feature | Enhanced API (`createConsumer`) | Direct API (`consume`) |
|---------|----------------------------------|-------------------------|
| **Ease of Use** | Higher level, more convenient | Lower level, more control |
| **Ack/Nack Control** | Automatic based on function results | Manual using `ack()` and `retry()` |
| **Configuration** | Uses custom EnhancedConsumerOptions | Uses standard ConsumerOptions |
| **Return Value** | Returns Consumer object with close() method | Returns void |
| **Use Case** | General purpose message consumption | Advanced scenarios needing manual control |

## Consumer Configuration Options

### Queue Options
- `durable`: If true, queue survives server restarts
- `exclusive`: If true, queue is deleted when connection closes
- `autoDelete`: If true, queue is deleted when last consumer unsubscribes

### Quality of Service (QoS) Options
- `prefetchCount`: How many messages to prefetch and process concurrently
- `prefetchSize`: Maximum size of messages to prefetch
- `global`: Apply QoS settings globally

### Exchange Configuration
- `exchanges`: Array of exchanges to declare before consuming
- `queueBindings`: Array of bindings between queues and exchanges

## Message Processing and Acknowledgment

### Automatic Acknowledgment
The consumer handles message acknowledgment automatically:

- ✅ **Success**: If your message handler function completes without throwing an error, the message is automatically acknowledged (acked) and removed from the queue
- ❌ **Failure**: If your message handler function throws an error, the message is automatically rejected (nacked) and may be requeued or sent to a dead letter queue

```typescript
// SUCCESS: Message will be acknowledged
async (msg) => {
  await processMessage(msg);
  // No error thrown = message acknowledged
}

// FAILURE: Message will be rejected
async (msg) => {
  await processMessage(msg);
  throw new Error('Processing failed'); // Message rejected
}
```

### Manual Ack/Nack Control
You can also return specific values to control acknowledgment:

```typescript
async (msg) => {
  if (someCondition) {
    return 0; // Explicitly reject (nack) the message
  }
  return 1; // Explicitly acknowledge (ack) the message
}
```

## Complete Consumer Example with All Features

```typescript
import { Connection } from 'your-rabbitmq-library';

async function completeConsumerExample() {
  const rabbit = new Connection('amqp://guest:guest@localhost:5672');

  // Advanced consumer with exchanges and bindings
  const consumer = await rabbit.createConsumer({
    queue: 'user-events',                          // Queue name
    queueOptions: { 
      durable: true,                              // Survive server restarts
      autoDelete: false                           // Don't auto-delete
    },
    qos: { 
      prefetchCount: 2                           // Process 2 messages concurrently
    },
    exchanges: [                                  // Declare exchanges if needed
      { 
        exchange: 'user-activity',                // Exchange name
        type: 'topic',                           // Exchange type
        durable: true                            // Survive server restarts
      }
    ],
    queueBindings: [                              // Bind queue to exchange
      { 
        exchange: 'user-activity',                // Which exchange
        routingKey: 'users.*'                    // Routing pattern
      }
    ]
  }, async (msg) => {
    try {
      console.log('Processing user event:', msg);
      
      // Your message processing logic here
      await processUserEvent(msg);
      
      console.log('User event processed successfully');
      
    } catch (error) {
      console.error('Error processing user event:', error);
      // Throwing error will cause message to be rejected and potentially retried
      throw error;
    }
  });

  // Listen for consumer events
  consumer.on('error', (err) => {
    console.error('Consumer error:', err);
  });

  // Later, when you want to stop consuming:
  await consumer.close();
  await rabbit.close();
}
```

## Event Handling

### Connection Events
```typescript
rabbit.on('error', (err) => {
  console.error('Connection error:', err);
});

rabbit.on('connection', () => {
  console.log('Connection established');
});

rabbit.on('close', (info) => {
  console.log('Connection closed:', info);
});
```

### Consumer Events
```typescript
consumer.on('error', (err) => {
  console.error('Consumer error:', err);
});
```

## Error Handling and Retry Logic

The library includes built-in retry logic:

- If message processing fails, the message can be retried
- After a configurable number of attempts, failed messages can be moved to a Dead Letter Queue (DLQ)
- Connection failures are automatically retried based on configuration

## Publisher Example for Testing Consumers

```typescript
// Create a publisher to send test messages
const publisher = await rabbit.createPublisher({
  confirm: true,        // Wait for broker confirmation
  maxAttempts: 2        // Retry publishing up to 2 times
});

// Send message directly to queue
await publisher.send('my-queue-name', {
  id: 1,
  message: 'Hello World',
  timestamp: new Date().toISOString()
});

// Send message to exchange (will be routed to bound queues)
await publisher.send(
  { exchange: 'my-exchange', routingKey: 'routing.key' },
  { id: 2, message: 'Hello Exchange' }
);
```

## Best Practices

1. **Always handle errors** in your message processing function
2. **Use durable queues** for important messages that should survive server restarts
3. **Set appropriate prefetchCount** based on your processing capacity
4. **Implement proper logging** for debugging and monitoring
5. **Use exchanges and routing** for more flexible message routing
6. **Clean up resources** by closing consumers and connections when done

## Shutdown Sequence

Always follow this shutdown sequence:

```typescript
await consumer.close();    // Stop consuming
await publisher.close();   // Close publisher
await rabbit.close();      // Close connection
```