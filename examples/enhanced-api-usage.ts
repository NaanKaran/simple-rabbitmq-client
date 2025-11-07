import { Connection } from './src/index';

async function enhancedAPIExample() {
  console.log('🧪 Testing Enhanced API...');

  // Initialize connection
  const rabbit = new Connection('amqp://guest:guest@localhost:5672');

  rabbit.on('error', (err) => {
    console.log('RabbitMQ connection error', err);
  });

  rabbit.on('connection', () => {
    console.log('✅ Connection successfully (re)established');
  });

  try {
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
      console.log('received message (user-events)', msg);
      // The message is automatically acknowledged when this function ends.
      // If this function throws an error, then msg is rejected and
      // possibly requeued or sent to a dead-letter exchange.
    });

    sub.on('error', (err) => {
      // Maybe the consumer was cancelled, or the connection was reset before a
      // message could be acknowledged.
      console.log('consumer error (user-events)', err);
    });

    console.log('👂 Consumer is listening...');

    // Declare a publisher
    const pub = await rabbit.createPublisher({
      // Enable publish confirmations, similar to consumer acknowledgements
      confirm: true,
      // Enable retries
      maxAttempts: 2,
      // Optionally ensure the existence of an exchange before we use it
      exchanges: [{exchange: 'my-events', type: 'topic'}]
    });

    console.log('📤 Publisher created');

    // Publish a message to a custom exchange
    await pub.send(
      {exchange: 'my-events', routingKey: 'users.visit'}, // metadata
      {id: 1, name: 'Alan Turing', timestamp: new Date().toISOString()} // message content
    );
    console.log('✅ Message sent to exchange');

    // Or publish directly to a queue
    await pub.send('user-events', {id: 2, name: 'Grace Hopper', timestamp: new Date().toISOString()});
    console.log('✅ Message sent directly to queue');

    // Let it run for a while
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Clean up when you receive a shutdown signal
    async function onShutdown() {
      console.log('🧹 Shutting down...');
      // Waits for pending confirmations and closes the underlying Channel
      await pub.close();
      // Stop consuming. Wait for any pending message handlers to settle.
      await sub.close();
      await rabbit.close();
      console.log('🔌 Connection closed');
    }
    
    // Simulate shutdown
    await onShutdown();
  } catch (error) {
    console.error('Error in example:', error);
    await rabbit.close();
  }
}

enhancedAPIExample().catch(console.error);