import { Connection } from "rabbitmq-connect-helper";
import { InvocationContext } from "@azure/functions";
import { processRequest, logRequestToDb } from "./gospellQueueTrigger";
import { logger } from "../utils/logger";

// Global flag to control message processing during reconnection
let isReconnecting = false;

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
    isReconnecting = false; // Reset reconnection flag
  });

  // Track reconnection state to prevent processing during reconnection
  rabbit.on("close", () => {
    logger.warn("RabbitMQ connection closed, setting reconnection flag");
    isReconnecting = true;
  });

  const sub = await rabbit.createConsumer(
    {
      queue: QUEUE_NAME,
      queueOptions: { durable: true },
      qos: { prefetchCount: PREFETCH_COUNT },
    },
    async (msg) => {
      // Skip processing if we're in a reconnection state
      if (isReconnecting) {
        logger.warn("Skipping message processing during reconnection");
        return; // This should cause the library to retry the message
      }

      logger.info("Received message", { invocationId: context.invocationId });

      try {
        // Create a copy of the message to avoid reference issues
        const queueItem = JSON.parse(JSON.stringify(msg));
        queueItem.id = require("uuid").v4();
        
        await logRequestToDb(
          queueItem.id,
          queueItem.requestType,
          JSON.stringify(queueItem.dataBody)
        );

        await processRequest(queueItem, context);
        logger.info(`✅ Message processed successfully.`);
      } catch (err) {
        logger.error("❌ Error processing RabbitMQ message:", err);
        // Allow the library to handle NACK/retry on error
        throw err;
      }
    }
  );

  sub.on("error", (err) => {
    logger.error("Subscriber error:", err);
  });
  
  sub.on("close", () => {
    logger.warn("Subscriber closed for queue:", QUEUE_NAME);
    isReconnecting = true; // Set flag when subscriber closes
  });
}