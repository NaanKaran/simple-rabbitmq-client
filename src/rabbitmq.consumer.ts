import { Channel, ConsumeMessage, Options } from "amqplib";
import { QueueManager } from "./rabbitmq.queueManager";

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

/**
 * Options for RabbitMQ consumer configuration
 */
export interface ConsumerOptions {
  /** Number of messages to prefetch (default: 1) */
  prefetch?: number;
  /** Additional consumer options */
  consumerOptions?: Options.Consume;
  /** Number of retry attempts for failed messages (default: 3) */
  retryAttempts?: number;
  /** Delay in milliseconds between retry attempts (default: 180000) */
  retryDelayMs?: number;
  /** Suffix for dead letter queue names (default: ".dlq") */
  deadLetterQueueSuffix?: string;
  /** Error handler function */
  errorHandler?: (
    error: Error,
    queueName: string,
    msg: ConsumeMessage | null
  ) => void;
  /** Timeout for message processing in ms (default: 30000) */
  processingTimeout?: number;
}

/**
 * Metrics for tracking consumer performance
 */
interface QueueMetrics {
  /** Number of acknowledged messages */
  ack: number;
  /** Number of negatively acknowledged messages */
  nack: number;
  /** Number of errors */
  errors: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PREFETCH = 1;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 180000; // 3 minutes
const DEFAULT_DEAD_LETTER_QUEUE_SUFFIX = ".dlq";
const DEFAULT_PROCESSING_TIMEOUT_MS = 30000; // 30 seconds
const ACKNOWLEDGE_OPTIONS = { multiple: false };
const CONSUME_OPTIONS = { noAck: false };

// ============================================================================
// MAIN CONSUMER CLASS
// ============================================================================

/**
 * RabbitMQ Consumer class for handling message consumption with retry logic and error handling
 */
export class RabbitMQConsumer {
  private readonly activeConsumers = new Map<string, () => Promise<void>>();
  private readonly pausedQueues = new Set<string>();
  private readonly metrics: Record<string, QueueMetrics> = {};
  private readonly messageAttempts = new WeakMap<ConsumeMessage, number>();

  constructor(private readonly queueManager: QueueManager) {}

  /**
   * Start consuming messages from a queue
   * @param queueName The name of the queue to consume from
   * @param onMessage The message handler function
   * @param options Consumer configuration options
   * @returns Promise that resolves when consumer is set up
   */
  async consume(
    queueName: string,
    onMessage: (
      msg: ConsumeMessage,
      ack: () => void,
      retry: () => void
    ) => Promise<void>,
    options: ConsumerOptions = {}
  ): Promise<void> {
    const {
      prefetch = DEFAULT_PREFETCH,
      consumerOptions = {},
      retryAttempts = DEFAULT_RETRY_ATTEMPTS,
      retryDelayMs = DEFAULT_RETRY_DELAY_MS,
      deadLetterQueueSuffix = DEFAULT_DEAD_LETTER_QUEUE_SUFFIX,
      errorHandler,
      processingTimeout = DEFAULT_PROCESSING_TIMEOUT_MS,
    } = options;

    const setupConsumer = async () => {
      try {
        const channel = await this.queueManager.getOrCreateQueue(queueName);
        channel.prefetch(prefetch);

        this.ensureMetricsInitialized(queueName);

        const consumeHandler = this.createConsumeHandler(
          queueName,
          channel,
          onMessage,
          retryAttempts,
          retryDelayMs,
          deadLetterQueueSuffix,
          errorHandler,
          processingTimeout
        );

        const { consumerTag } = await channel.consume(
          queueName,
          consumeHandler,
          {
            ...CONSUME_OPTIONS,
            ...consumerOptions,
          }
        );

        // Save the stop method
        this.activeConsumers.set(queueName, async () => {
          await channel.cancel(consumerTag);
          console.log(`Stopped consumer for: ${queueName}`);
        });

        // Set up reconnection logic when channel closes
        this.setupChannelEventHandlers(
          channel,
          queueName,
          onMessage,
          options,
          setupConsumer
        );

        console.log(`Started consuming ${queueName} with prefetch=${prefetch}`);
      } catch (error) {
        const typedError =
          error instanceof Error ? error : new Error(String(error));
        console.error(
          `Error setting up consumer for ${queueName}, retrying in ${retryDelayMs}ms`,
          typedError
        );

        if (errorHandler) {
          errorHandler(typedError, queueName, null);
        }

        setTimeout(setupConsumer, retryDelayMs);
      }
    };

    await setupConsumer();
  }

  /**
   * Pause consuming messages from a queue
   * @param queueName The name of the queue to pause
   */
  pause(queueName: string): void {
    this.pausedQueues.add(queueName);
    console.log(`Paused consuming from: ${queueName}`);
  }

  /**
   * Resume consuming messages from a queue
   * @param queueName The name of the queue to resume
   */
  resume(queueName: string): void {
    if (this.pausedQueues.delete(queueName)) {
      console.log(`Resumed consuming from: ${queueName}`);
    }
  }

  /**
   * Stop consuming messages from a queue
   * @param queueName The name of the queue to stop consuming from
   * @returns Promise that resolves when consumer is stopped
   */
  async stop(queueName: string): Promise<void> {
    const stop = this.activeConsumers.get(queueName);
    if (stop) {
      await stop();
      this.activeConsumers.delete(queueName);
    }
    this.pausedQueues.delete(queueName);
  }

  /**
   * Get metrics for all queues
   * @returns Record of queue metrics
   */
  getMetrics(): Record<string, QueueMetrics> {
    return this.metrics;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Create a consume handler function for processing messages
   */
  private createConsumeHandler(
    queueName: string,
    channel: Channel,
    onMessage: (
      msg: ConsumeMessage,
      ack: () => void,
      retry: () => void
    ) => Promise<void>,
    retryAttempts: number,
    retryDelayMs: number,
    deadLetterQueueSuffix: string,
    errorHandler?: (
      error: Error,
      queueName: string,
      msg: ConsumeMessage | null
    ) => void,
    processingTimeout: number = DEFAULT_PROCESSING_TIMEOUT_MS
  ) {
    return (msg: ConsumeMessage | null) => {
      if (!msg || this.pausedQueues.has(queueName)) return;

      // Create safe acknowledgment function
      const ack = this.createAckFunction(channel, queueName, msg);

      // Create retry function
      const retry = this.createRetryFunction(
        queueName,
        channel,
        onMessage,
        msg,
        retryAttempts,
        retryDelayMs,
        deadLetterQueueSuffix,
        errorHandler
      );

      // Process the message with timeout
      this.processMessageWithTimeout(
        queueName,
        channel,
        msg,
        onMessage,
        ack,
        retry,
        processingTimeout,
        errorHandler
      ).catch((error) => {
        const typedError =
          error instanceof Error ? error : new Error(String(error));
        console.error(
          `Unexpected error processing message in ${queueName}:`,
          typedError
        );

        if (errorHandler) {
          errorHandler(typedError, queueName, msg);
        }

        // In case of unexpected errors, attempt retry
        // Note: The retry function is synchronous and doesn't return a promise
        retry();
      });
    };
  }

  /**
   * Create a safe acknowledgment function
   */
  private createAckFunction(
    channel: Channel,
    queueName: string,
    msg: ConsumeMessage
  ): () => void {
    return () => {
      // Check if channel is still open before acknowledging
      if (this.isChannelOpen(channel)) {
        try {
          channel.ack(msg, false); // Single message ack
          this.metrics[queueName].ack++;
          this.messageAttempts.delete(msg);
        } catch (error) {
          const typedError =
            error instanceof Error ? error : new Error(String(error));
          this.handleAckError(typedError, queueName, msg, channel);
        }
      } else {
        console.warn(
          `Channel closed for ${queueName}, cannot acknowledge message`
        );
      }
    };
  }

  /**
   * Create a retry function for failed messages
   */
  private createRetryFunction(
    queueName: string,
    channel: Channel,
    onMessage: (
      msg: ConsumeMessage,
      ack: () => void,
      retry: () => void
    ) => Promise<void>,
    msg: ConsumeMessage,
    retryAttempts: number,
    retryDelayMs: number,
    deadLetterQueueSuffix: string,
    errorHandler?: (
      error: Error,
      queueName: string,
      msg: ConsumeMessage | null
    ) => void
  ): () => void {
    return () => {
      const attempt = (this.messageAttempts.get(msg) ?? 0) + 1;
      this.messageAttempts.set(msg, attempt);

      if (attempt <= retryAttempts) {
        console.warn(`Retry ${attempt}/${retryAttempts} for ${queueName}`);
        setTimeout(() => {
          // Re-try by calling the same handler
          this.createConsumeHandler(
            queueName,
            channel,
            onMessage,
            retryAttempts,
            retryDelayMs,
            deadLetterQueueSuffix,
            errorHandler,
            DEFAULT_PROCESSING_TIMEOUT_MS
          )(msg);
        }, retryDelayMs);
      } else {
        this.metrics[queueName].errors++;
        console.error(
          `Message moved to DLQ after ${retryAttempts} attempts: ${queueName}`
        );

        this.moveToDLQWithErrorHandling(
          queueName,
          msg,
          deadLetterQueueSuffix,
          channel,
          errorHandler
        ).catch((error) => {
          console.error(`Error moving message to DLQ:`, error);
        });
      }
    };
  }

  /**
   * Process a message with a timeout
   */
  private async processMessageWithTimeout(
    queueName: string,
    channel: Channel,
    msg: ConsumeMessage,
    onMessage: (
      msg: ConsumeMessage,
      ack: () => void,
      retry: () => void
    ) => Promise<void>,
    ack: () => void,
    retry: () => void,
    processingTimeout: number,
    errorHandler?: (
      error: Error,
      queueName: string,
      msg: ConsumeMessage | null
    ) => void
  ): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(`Message processing timeout after ${processingTimeout}ms`)
          ),
        processingTimeout
      );
    });

    try {
      // Race between message processing and timeout
      await Promise.race([onMessage(msg, ack, retry), timeoutPromise]);
      // If we get here, processing completed successfully
      // ack();
    } catch (error) {
      const typedError =
        error instanceof Error ? error : new Error(String(error));
      console.error(`Processing error in ${queueName}:`, typedError);

      if (errorHandler) {
        errorHandler(typedError, queueName, msg);
      }

      // Handle timeout errors differently
      if (typedError.message.includes("timeout")) {
        // For timeout errors, move directly to DLQ without more retries
        this.metrics[queueName].errors++;
        await this.moveToDLQWithErrorHandling(
          queueName,
          msg,
          DEFAULT_DEAD_LETTER_QUEUE_SUFFIX, // Use default suffix for timeouts
          channel,
          errorHandler
        );
      } else {
        retry();
      }
    }
  }

  /**
   * Move a message to the dead letter queue with error handling
   */
  private async moveToDLQWithErrorHandling(
    queueName: string,
    msg: ConsumeMessage,
    suffix: string,
    channel: Channel,
    errorHandler?: (
      error: Error,
      queueName: string,
      msg: ConsumeMessage | null
    ) => void
  ): Promise<void> {
    try {
      await this.moveToDLQ(queueName, msg, suffix);
    } catch (error) {
      const typedError =
        error instanceof Error ? error : new Error(String(error));
      console.error(
        `Failed to move message to DLQ for ${queueName}:`,
        typedError
      );

      if (errorHandler) {
        errorHandler(typedError, queueName, msg);
      }

      // Try to acknowledge the message if channel is still valid
      if (this.isChannelOpen(channel)) {
        try {
          channel.ack(msg, false);
        } catch (ackError) {
          console.warn(`Could not ack message in DLQ handler:`, ackError);
        }
      }
    }
  }

  /**
   * Move a message to the dead letter queue
   */
  private async moveToDLQ(
    queueName: string,
    msg: ConsumeMessage,
    suffix: string
  ): Promise<void> {
    try {
      const dlqName = `${queueName}${suffix}`;
      const dlqChannel = await this.queueManager.getOrCreateQueue(dlqName);
      dlqChannel.sendToQueue(dlqName, msg.content, {
        headers: msg.properties.headers,
        persistent: true,
      });
      console.error(`Moved message to DLQ: ${dlqName}`);
    } catch (error) {
      const typedError =
        error instanceof Error ? error : new Error(String(error));
      console.error(
        `Failed to move message to DLQ for ${queueName}:`,
        typedError
      );
    }
  }

  /**
   * Set up event handlers for the channel
   */
  private setupChannelEventHandlers(
    channel: Channel,
    queueName: string,
    onMessage: (
      msg: ConsumeMessage,
      ack: () => void,
      retry: () => void
    ) => Promise<void>,
    options: ConsumerOptions,
    setupConsumer: () => Promise<void>
  ): void {
    // Handle channel close events (reconnection logic)
    channel.on("close", async () => {
      console.warn(
        `Channel closed for ${queueName}. Retrying in ${
          options.retryDelayMs || DEFAULT_RETRY_DELAY_MS
        }ms...`
      );
      this.activeConsumers.delete(queueName);

      // Cancel any pending consumers before reconnection
      if (this.activeConsumers.has(queueName)) {
        try {
          const stop = this.activeConsumers.get(queueName);
          if (stop) await stop();
          this.activeConsumers.delete(queueName);
        } catch (error) {
          const typedError =
            error instanceof Error ? error : new Error(String(error));
          console.warn(
            `Error stopping consumer during close event:`,
            typedError
          );
        }
      }

      setTimeout(async () => {
        try {
          await this.consume(queueName, onMessage, options);
        } catch (error) {
          const typedError =
            error instanceof Error ? error : new Error(String(error));
          console.error(
            `Error restarting consumer for ${queueName}:`,
            typedError
          );
          if (options.errorHandler) {
            options.errorHandler(typedError, queueName, null);
          }
        }
      }, options.retryDelayMs || DEFAULT_RETRY_DELAY_MS);
    });

    // Handle channel errors
    channel.on("error", (err: Error) => {
      console.error(`Channel error on ${queueName}:`, err);
    });
  }

  /**
   * Ensure metrics are initialized for a queue
   */
  private ensureMetricsInitialized(queueName: string): void {
    if (!this.metrics[queueName]) {
      this.metrics[queueName] = { ack: 0, nack: 0, errors: 0 };
    }
  }

  /**
   * Check if the channel is still open
   */
  private isChannelOpen(channel: Channel): boolean {
    // Check if channel is still open by examining internal properties
    return (
      channel &&
      (channel as any).connection &&
      !(channel as any).connection._disposed
    );
  }

  /**
   * Handle acknowledgment errors
   */
  private handleAckError(
    error: Error,
    queueName: string,
    msg: ConsumeMessage,
    channel: Channel
  ): void {
    // If channel is closed, don't attempt to handle error here
    if (
      error.message.includes("Channel closed") ||
      error.message.includes("unknown delivery tag")
    ) {
      console.warn(`Could not ack message on closed channel for ${queueName}`);
    } else {
      console.warn(`Ack failed for ${queueName}:`, error);
      // Note: Not calling errorHandler for ack failures to avoid infinite loops
    }
  }
}
