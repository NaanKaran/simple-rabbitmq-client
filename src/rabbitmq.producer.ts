import { QueueManager } from "./rabbitmq.queueManager";

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Options for RabbitMQ message production
 */
export interface ProducerOptions {
  /** Make message persistent (equivalent to deliveryMode=2) */
  persistent?: boolean;
  /** Content type of the message */
  contentType?: string;
  /** Correlation ID for RPC */
  correlationId?: string;
  /** Reply-to queue name */
  replyTo?: string;
  /** Expiration time for the message */
  expiration?: string | number;
  /** Additional headers for the message */
  headers?: any;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONTENT_TYPE = "application/json";
const DEFAULT_PERSISTENT = true;
const PERSISTENT_DELIVERY_MODE = 2;
const NON_PERSISTENT_DELIVERY_MODE = 1;

// ============================================================================
// MAIN PRODUCER CLASS
// ============================================================================

/**
 * RabbitMQ Producer class for sending messages to queues and exchanges
 */
export class RabbitMQProducer {
  constructor(private readonly queueManager: QueueManager) {}

  /**
   * Send a message to a queue
   * @param queueName Name of the queue to send the message to
   * @param message Message content (string, object, or Buffer)
   * @param options Additional options for the message
   * @returns Promise that resolves to true if the message was sent successfully, false if it was dropped (in case of publisher confirms)
   */
  async send(
    queueName: string,
    message: string | object | Buffer,
    options?: ProducerOptions
  ): Promise<boolean> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);

      // Convert message to buffer and prepare options
      const messageBuffer = this.prepareMessageBuffer(message);
      const messageOptions = this.prepareMessageOptions(options);

      // Send the message to the queue
      const result = channel.sendToQueue(queueName, messageBuffer, messageOptions);
      return result;
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error sending message to queue ${queueName}:`, typedError.message);
      throw typedError;
    }
  }

  /**
   * Send a message to an exchange
   * @param exchangeName Name of the exchange to send the message to
   * @param routingKey Routing key for the message
   * @param message Message content (string, object, or Buffer)
   * @param options Additional options for the message
   * @returns Promise that resolves when the message is sent
   */
  async sendToExchange(
    exchangeName: string,
    routingKey: string,
    message: string | object | Buffer,
    options?: ProducerOptions
  ): Promise<void> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(exchangeName);

      // Convert message to buffer and prepare options
      const messageBuffer = this.prepareMessageBuffer(message);
      const messageOptions = this.prepareMessageOptions(options);

      // Publish message to exchange
      channel.publish(exchangeName, routingKey, messageBuffer, messageOptions);
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error sending message to exchange ${exchangeName}:`, typedError.message);
      throw typedError;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Prepare message buffer from various input types
   * @param message The message to convert
   * @returns Buffer representation of the message
   */
  private prepareMessageBuffer(message: string | object | Buffer): Buffer {
    if (typeof message === "string") {
      return Buffer.from(message);
    } else if (Buffer.isBuffer(message)) {
      return message;
    } else {
      // If it's an object, serialize it to JSON string
      return Buffer.from(JSON.stringify(message));
    }
  }

  /**
   * Prepare message options with defaults and user-provided options
   * @param options User-provided options
   * @returns Merged message options
   */
  private prepareMessageOptions(options?: ProducerOptions) {
    const persistent = options?.persistent ?? DEFAULT_PERSISTENT;
    
    return {
      persistent,
      contentType: options?.contentType ?? DEFAULT_CONTENT_TYPE,
      deliveryMode: persistent ? PERSISTENT_DELIVERY_MODE : NON_PERSISTENT_DELIVERY_MODE,
      // Include other options if provided
      ...(options && {
        correlationId: options.correlationId,
        replyTo: options.replyTo,
        expiration: options.expiration,
        headers: options.headers,
      }),
    };
  }
}