import { Connection } from './src/index';

async function simpleExample() {
  // Initialize:
  const rabbit = new Connection('amqp://guest:guest@localhost:5672');
  
  rabbit.on('error', (err) => {
    console.log('RabbitMQ connection error', err);
  });
  
  rabbit.on('connection', () => {
    console.log('Connection successfully (re)established');
  });

  // Consume messages from a queue:
  const stop = await rabbit.createConsumer({
    queue: 'simple-example-queue',
    handler: async (msg, ack, retry) => {
      console.log('Received:', msg.content.toString());
      ack(); // acknowledge the message
    },
    prefetch: 1,
    retryAttempts: 3,
    retryDelayMs: 5000
  });

  // Send a message:
  const send = await rabbit.createProducer({ queue: 'simple-example-queue' });
  const success = await send({ hello: 'world', timestamp: new Date().toISOString() });
  
  if (success) {
    console.log('Message sent successfully!');
  } else {
    console.log('Message was dropped');
  }

  // Publish to exchange:
  await rabbit.sendToExchange('amq.topic', 'simple.example', { 
    message: 'Hello from exchange', 
    timestamp: new Date().toISOString() 
  });

  // Queue and exchange declarations:
  await rabbit.queueDeclare('simple-example-queue', { durable: true });
  await rabbit.exchangeDeclare('simple-example-exchange', 'topic', { durable: true });
  await rabbit.queueBind('simple-example-queue', 'simple-example-exchange', 'simple.*');

  // Let it run for a while to process messages
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Close connection when done:
  await rabbit.close();
  console.log('Connection closed');
}

simpleExample().catch(console.error);