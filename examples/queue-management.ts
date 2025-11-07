import { 
  QueueManager, 
  RabbitMQManager, 
  RabbitMqConfig,
  QueueDeclarationOptions,
  ExchangeDeclarationOptions
} from '../src/index';

async function queueManagementExample() {
  console.log('⚙️ Starting Queue and Exchange Management Example');
  console.log('================================================');

  // Configuration
  const config: RabbitMqConfig = {
    url: 'amqp://localhost', // Replace with your RabbitMQ server
    maxRetries: 3,
    retryDelay: 5000,
    heartbeat: 30
  };

  // Initialize QueueManager and RabbitMQManager
  const queueManager = new QueueManager(config);
  const rabbitManager = new RabbitMQManager(queueManager);

  try {
    console.log('\n1. 🏗️  Declaring a queue...');
    
    // Declare a queue with options
    const queueOptions: QueueDeclarationOptions = {
      durable: true,
      exclusive: false,
      autoDelete: false
    };

    const queueResult = await rabbitManager.declareQueue('management-example-queue', queueOptions);
    console.log(`✅ Queue declared:`, queueResult);

    console.log('\n2. 🏗️  Declaring an exchange...`);
    
    // Declare an exchange with options
    const exchangeOptions: ExchangeDeclarationOptions = {
      type: 'topic',
      durable: true,
      autoDelete: false
    };

    const exchangeResult = await rabbitManager.declareExchange('management-example-exchange', exchangeOptions);
    console.log(`✅ Exchange declared:`, exchangeResult);

    console.log('\n3. 🔗 Binding queue to exchange...');
    
    // Bind the queue to the exchange
    await rabbitManager.bindQueue(
      'management-example-queue',
      'management-example-exchange',
      'management.example.routing'
    );
    console.log(`✅ Queue bound to exchange with routing key 'management.example.routing'`);

    console.log('\n4. 📊 Getting queue information...');
    
    // Get queue info
    const queueInfo = await rabbitManager.getQueueInfo('management-example-queue');
    console.log(`📊 Queue info:`, queueInfo);

    console.log('\n5. 🧹 Purging queue (removing any existing messages)...');
    
    // Purge the queue
    const purgeResult = await rabbitManager.purgeQueue('management-example-queue');
    console.log(`✅ Queue purged. Messages removed:`, purgeResult.messageCount);

    console.log('\n6. 📊 Getting queue info after purge...');
    
    // Get queue info again after purge
    const queueInfoAfterPurge = await rabbitManager.getQueueInfo('management-example-queue');
    console.log(`📊 Queue info after purge:`, queueInfoAfterPurge);

    console.log('\n7. 🧪 Testing passive queue declaration (check if exists without creating)...');
    
    // Test passive declaration (check if exists without creating)
    try {
      const passiveResult = await rabbitManager.declareQueue('management-example-queue', { passive: true });
      console.log(`✅ Queue exists:`, passiveResult);
    } catch (error) {
      console.log(`❌ Queue does not exist or other error:`, error.message);
    }

    console.log('\n8. 🧪 Attempting to get a message from the queue (should be false if empty)...');
    
    // Try to get a message (should be false since queue is empty after purge)
    const message = await rabbitManager.getMessage('management-example-queue');
    if (message) {
      console.log(`📩 Retrieved message:`, message.content.toString());
    } else {
      console.log('📭 Queue is empty (no message retrieved)');
    }

    console.log('\n✅ Queue and exchange management example completed successfully!');

  } catch (error) {
    console.error('❌ Error during queue management example:', error);
  } finally {
    // Clean up
    try {
      console.log('\n9. 🧹 Cleaning up - deleting created queue and exchange...');
      
      // Unbind first
      await rabbitManager.unbindQueue(
        'management-example-queue',
        'management-example-exchange',
        'management.example.routing'
      );
      console.log('✅ Queue unbound from exchange');
      
      // Delete queue
      const deleteQueueResult = await rabbitManager.deleteQueue('management-example-queue');
      console.log(`✅ Queue deleted:`, deleteQueueResult);
      
      // Delete exchange
      const deleteExchangeResult = await rabbitManager.deleteExchange('management-example-exchange');
      console.log(`✅ Exchange deleted:`, deleteExchangeResult);
      
      // Close connections
      await rabbitManager.closeAll();
      console.log('✅ All connections closed');
    } catch (cleanupError) {
      console.error('❌ Error during cleanup:', cleanupError);
    }
  }
}

// Run the example
queueManagementExample().catch(console.error);