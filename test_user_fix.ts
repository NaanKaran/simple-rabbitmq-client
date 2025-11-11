import { Connection } from "./src";

// Test the user's code to ensure it works with the fix
const rabbit = new Connection(
  "amqps://ubyzlkay:nty1PNYyOHlLyaulk51cEfgJ5pKIxCiv@fly.rmq.cloudamqp.com:5671/ubyzlkay"
);

const QUEUE_NAME = "my-queue";

async function test() {
  try {
    const consumer = await rabbit.createConsumer({
      queue: QUEUE_NAME,
      onMessage: async (msg, ack, retry) => {
        // =====================================================
        // 📩 2. Handle Incoming Messages
        // =====================================================
        console.log(`[✓] Received message: ${msg.content.toString()}`);
        // Acknowledge the message
        await ack();
      },
    });

    rabbit.on("error", (err) => {
      console.log("RabbitMQ connection error", err);
    });

    console.log("Consumer created successfully!");
  } catch (error) {
    console.error("Error creating consumer:", error);
  }
}

test();