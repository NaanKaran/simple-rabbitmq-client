import { Connection } from "./src";

const rabbit = new Connection(
  "amqps://test:test@test:5672/test"
);

async function testEnhancedConsumerOptions() {
  console.log("Testing enhanced consumer options...");

  try {
    // Test 1: Manual ack mode (default)
    console.log("\n1. Testing manual ack mode (default)...");
    await rabbit.createConsumer({
      queue: "test-queue-manual",
      onMessage: async (msg, ack, retry) => {
        console.log(`[MANUAL] Received message: ${msg.content.toString()}`);
        // Manually acknowledge
        await ack();
      },
    }, {
      ackMode: 'manual',
      retryAttempts: 3,
    });
    console.log("✓ Manual ack mode consumer created");

    // Test 2: Auto ack mode (less reliable)
    console.log("\n2. Testing auto ack mode...");
    await rabbit.createConsumer({
      queue: "test-queue-auto",
      onMessage: async (msg, ack, retry) => {
        console.log(`[AUTO] Received message: ${msg.content.toString()}`);
        // No need to manually ack - RabbitMQ auto-acks
      },
    }, {
      ackMode: 'auto',
      retryAttempts: 1, // Auto-ack mode doesn't support retry logic
    });
    console.log("✓ Auto ack mode consumer created");

    // Test 3: Nack with requeue (for temporary failures)
    console.log("\n3. Testing nack with requeue...");
    await rabbit.createConsumer({
      queue: "test-queue-requeue",
      onMessage: async (msg, ack, retry) => {
        console.log(`[REQUEUE] Received message: ${msg.content.toString()}`);
        // Simulate temporary failure, requeue the message
        await retry();
      },
    }, {
      nackBehavior: 'requeue',
      retryAttempts: 5,
    });
    console.log("✓ Nack with requeue consumer created");

    // Test 4: Nack with no requeue (send to DLQ for permanent failures)
    console.log("\n4. Testing nack with no requeue (DLQ)...");
    await rabbit.createConsumer({
      queue: "test-queue-no-requeue",
      onMessage: async (msg, ack, retry) => {
        console.log(`[NO-REQUEUE] Received message: ${msg.content.toString()}`);
        // Simulate permanent failure, don't requeue - goes to DLQ
        // This would use retry() but we set nackBehavior to 'no-requeue'
        await retry();
      },
    }, {
      nackBehavior: 'no-requeue',
      deadLetterQueueSuffix: '.dlq',
      retryAttempts: 1, // Only try once, then send to DLQ
    });
    console.log("✓ Nack with no requeue consumer created");

    // Test 5: User's original case (should still work)
    console.log("\n5. Testing original user case...");
    await rabbit.createConsumer({
      queue: "my-queue",
      onMessage: async (msg, ack, retry) => {
        console.log(`[USER] Received message: ${msg.content.toString()}`);
        await ack();
      },
    });
    console.log("✓ Original user case still works");

    console.log("\n🎉 All enhanced consumer option tests completed successfully!");
  } catch (error) {
    console.error("❌ Error during testing:", error);
  }
}

testEnhancedConsumerOptions();