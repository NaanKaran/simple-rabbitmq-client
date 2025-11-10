import { Connection } from "rabbitmq-connect-helper";
import { InvocationContext } from "@azure/functions";
import { processRequest, logRequestToDb } from "./gospellQueueTrigger";
import { logger } from "../utils/logger";

export async function startRabbitMQListener(context: InvocationContext) {
  const RABBIT_URL = process.env.RABBITMQ_URL;
  const QUEUE_NAME = process.env.RABBITMQ_QUEUE;
  const PREFETCH_COUNT = process.env.PREFETCH_COUNT
    ? parseInt(process.env.PREFETCH_COUNT)
    : 16;

  logger.info(
    `Connecting to RabbitMQ at ${RABBIT_URL} using rabbitmq-connect-helper...`
  );

  const rabbit = new Connection(RABBIT_URL, {
    maxRetries: Infinity,
    retryDelay: 5000,
  });

  rabbit.on("error", (err) => {
    logger.error("RabbitMQ connection error", err);
  });
  rabbit.on("connection", () => {
    logger.info("Connection successfully (re)established");
  });

  // Try to handle the message acknowledgment more robustly
  const sub = await rabbit.createConsumer(
    {
      queue: QUEUE_NAME,
      queueOptions: { durable: true },
      qos: { prefetchCount: PREFETCH_COUNT },
    },
    async (msg) => {
      logger.info("Received message", { invocationId: context.invocationId });

      try {
        const queueItem = { ...msg, properties: { ...msg.properties } }; // Make a proper copy
        queueItem.id = require("uuid").v4();
        
        await logRequestToDb(
          queueItem.id,
          queueItem.requestType,
          JSON.stringify(queueItem.dataBody)
        );

        await processRequest(queueItem, context);
        logger.info(`✅ Message processed.`);
      } catch (err) {
        logger.error("❌ Error processing RabbitMQ message:", err);
        // The library should handle NACK automatically on error, but make sure
        // the error is properly propagated
        throw err; // This should tell the library to not acknowledge the message
      }
    }
  );

  sub.on("error", (err) => {
    logger.error("Subscriber error:", err);
  });
  
  sub.on("close", () => {
    logger.warn("Subscriber closed for queue:", QUEUE_NAME);
  });
}