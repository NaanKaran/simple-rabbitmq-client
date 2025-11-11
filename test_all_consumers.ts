import { Connection } from "./src";

const rabbit = new Connection(
  "amqps://test:test@test:5672/test"
);

const QUEUE_NAME = "my-queue";

async function test() {
  console.log("Testing the three different ways to create a consumer...");

  // Method 1: Using the original signature (queueName, onMessage, options)
  console.log("\n1. Testing first overload: createConsumer(queueName, onMessage, options?)");
  try {
    await rabbit.consume(QUEUE_NAME, async (msg, ack, retry) => {
      console.log(`Received message: ${msg.content.toString()}`);
      ack();
    });
    console.log("✓ First method completed successfully");
  } catch (error) {
    console.log("✗ First method failed:", error);
  }

  // Method 2: Using the enhanced signature (config object with handler)
  console.log("\n2. Testing second overload: createConsumer(config, handler)");
  try {
    const consumer2 = await rabbit.createConsumer({
      queue: QUEUE_NAME,
      queueOptions: { durable: true }
    }, async (msg) => {
      console.log(`Received message in enhanced consumer: ${JSON.stringify(msg)}`);
      return 1; // acknowledge
    });
    console.log("✓ Second method completed successfully");
  } catch (error) {
    console.log("✗ Second method failed:", error);
  }

  // Method 3: Using the object-based signature (the user's use case)
  console.log("\n3. Testing third overload: createConsumer({queue, onMessage}, options?)");
  try {
    const consumer3 = await rabbit.createConsumer({
      queue: QUEUE_NAME,
      onMessage: async (msg, ack, retry) => {
        console.log(`Received message in object-based consumer: ${msg.content.toString()}`);
        ack();
      },
    });
    console.log("✓ Third method (user's case) completed successfully");
  } catch (error) {
    console.log("✗ Third method (user's case) failed:", error);
  }

  console.log("\nAll tests completed!");
}

test();