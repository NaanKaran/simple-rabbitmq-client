import { QueueManager } from "./rabbitmq.queueManager";

export interface ProducerOptions {
  persistent?: boolean;  // Make message persistent (equivalent to deliveryMode=2)
  contentType?: string;  // Content type of the message
  correlationId?: string;  // Correlation ID for RPC
  replyTo?: string;  // Reply-to queue name
  expiration?: string | number;  // Expiration time for the message
  headers?: any;  // Additional headers for the message
}

export class RabbitMQProducer {
  constructor(private readonly queueManager: QueueManager) {}

  /**
   * Send a message to a queue
   * @param queueName Name of the queue to send the message to
   * @param message Message content (string, object, or Buffer)
   * @param options Additional options for the message
   * @returns Promise that resolves to true if the message was sent successfully, false if it was dropped (in case of publisher confirms)
   */
  async send(queueName: string, message: string | object | Buffer, options?: ProducerOptions): Promise<boolean> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);
      
      // Convert message to buffer if it's not already
      let messageBuffer: Buffer;
      if (typeof message === 'string') {
        messageBuffer = Buffer.from(message);
      } else if (Buffer.isBuffer(message)) {
        messageBuffer = message;
      } else {
        // If it's an object, serialize it to JSON string
        messageBuffer = Buffer.from(JSON.stringify(message));
      }

      // Set up message options with defaults and user-provided options
      const messageOptions = {
        persistent: options?.persistent ?? true, // Default to persistent messages
        contentType: options?.contentType ?? 'application/json',
        ...(options && {
          correlationId: options.correlationId,
          replyTo: options.replyTo,
          expiration: options.expiration,
          headers: options.headers,
          // deliveryMode: 2 makes the message persistent (equivalent to persistent: true)
          deliveryMode: options?.persistent !== false ? 2 : 1,
        }),
      };

      // Send the message to the queue
      const result = channel.sendToQueue(queueName, messageBuffer, messageOptions);
      return result;
    } catch (error) {
      console.error(`Error sending message to queue ${queueName}:`, error);
      throw error; // Re-throw to let the caller handle the error
    }
  }

  /**
   * Send a message to an exchange instead of a queue
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
      const channel = await this.queueManager.getOrCreateQueue(exchangeName); // This creates a connection for exchange
      
      let messageBuffer: Buffer;
      if (typeof message === 'string') {
        messageBuffer = Buffer.from(message);
      } else if (Buffer.isBuffer(message)) {
        messageBuffer = message;
      } else {
        messageBuffer = Buffer.from(JSON.stringify(message));
      }

      const messageOptions = {
        persistent: options?.persistent ?? true,
        contentType: options?.contentType ?? 'application/json',
        ...(options && {
          correlationId: options.correlationId,
          replyTo: options.replyTo,
          expiration: options.expiration,
          headers: options.headers,
          deliveryMode: options?.persistent !== false ? 2 : 1,
        }),
      };

      channel.publish(exchangeName, routingKey, messageBuffer, messageOptions);
    } catch (error) {
      console.error(`Error sending message to exchange ${exchangeName}:`, error);
      throw error;
    }
  }
}
