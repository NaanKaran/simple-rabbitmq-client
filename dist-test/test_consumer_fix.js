import { Connection } from "./dist/index.js";
async function startConsumer() {
    // =====================================================
    // 🔧 1. Initialize RabbitMQ Connection
    // =====================================================
    const rabbit = new Connection("amqps://ubyzlkay:nty1PNYyOHlLyaulk51cEfgJ5pKIxCiv@fly.rmq.cloudamqp.com:5671/ubyzlkay");
    const QUEUE_NAME = "my-queue";
    // Use the correct overload for createConsumer
    await rabbit.createConsumer(QUEUE_NAME, async (msg, ack, retry) => {
        // =====================================================
        // 📩 2. Handle Incoming Messages
        // =====================================================
        console.log(`[✓] Received message: ${msg.content.toString()}`);
        // Acknowledge the message
        await ack();
    });
    rabbit.on("error", (err) => {
        console.log("RabbitMQ connection error", err);
    });
    console.log("Consumer started successfully");
}
startConsumer().catch(console.error);
