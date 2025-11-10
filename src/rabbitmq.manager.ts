import amqplib, { Channel, Options, ConsumeMessage } from "amqplib";
import { QueueManager } from "./rabbitmq.queueManager";

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

/**
 * Options for declaring queues
 */
export interface QueueDeclarationOptions {
  /** Exclusive queues are deleted when the connection is closed */
  exclusive?: boolean;
  /** Durable queues survive server restarts */
  durable?: boolean;
  /** Auto-delete queues when they have no consumers */
  autoDelete?: boolean;
  /** Make messages persistent */
  persistent?: boolean;
  /** Additional arguments for the queue */
  arguments?: any;
  /** Check if queue exists without creating it */
  passive?: boolean;
  /** Don't wait for the response (use with caution) */
  nowait?: boolean;
}

/**
 * Options for declaring exchanges
 */
export interface ExchangeDeclarationOptions {
  /** Exchange type (direct, topic, headers, fanout, match, etc.) */
  type?: 'direct' | 'topic' | 'headers' | 'fanout' | 'match' | string;
  /** Durable exchanges survive server restarts */
  durable?: boolean;
  /** Internal exchanges cannot be published to directly */
  internal?: boolean;
  /** Auto-delete exchanges when they have no bindings */
  autoDelete?: boolean;
  /** Alternate exchange for unroutable messages */
  alternateExchange?: string;
  /** Additional arguments for the exchange */
  arguments?: any;
}

/**
 * Options for queue binding
 */
export interface QueueBindingOptions {
  /** Do not consume messages published by this connection */
  noLocal?: boolean;
  /** Do not send acknowledge messages */
  noAck?: boolean;
  /** Exclusive consumer */
  exclusive?: boolean;
  /** Consumer priority */
  priority?: number;
}

/**
 * Information about a queue
 */
export interface QueueInfo {
  /** Number of messages in the queue */
  messageCount: number;
  /** Number of active consumers */
  consumerCount: number;
}

/**
 * Options for binding/unbinding queues
 */
export interface QueueBindOptions {
  /** Routing key for the binding */
  routingKey?: string;
  /** Additional arguments for the binding */
  arguments?: any;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_QUEUE_DURABLE = true;
const DEFAULT_QUEUE_EXCLUSIVE = false;
const DEFAULT_QUEUE_AUTO_DELETE = false;
const DEFAULT_EXCHANGE_TYPE = 'topic';
const DEFAULT_EXCHANGE_DURABLE = true;
const DEFAULT_EXCHANGE_INTERNAL = false;
const DEFAULT_EXCHANGE_AUTO_DELETE = false;

// ============================================================================
// MAIN MANAGER CLASS
// ============================================================================

/**
 * RabbitMQ Manager class for advanced queue and exchange management
 */
export class RabbitMQManager {
  constructor(private readonly queueManager: QueueManager) {}

  /**
   * Declare a queue with the given options
   * @param queueName The name of the queue to declare
   * @param options Queue declaration options
   * @returns Promise with queue declaration result
   */
  async declareQueue(
    queueName: string,
    options: QueueDeclarationOptions = {}
  ): Promise<ReturnType<Channel['assertQueue']>> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);

      // Set default values for queue declaration
      const queueOptions: Options.AssertQueue = {
        durable: options.durable ?? DEFAULT_QUEUE_DURABLE,
        exclusive: options.exclusive ?? DEFAULT_QUEUE_EXCLUSIVE,
        autoDelete: options.autoDelete ?? DEFAULT_QUEUE_AUTO_DELETE,
        arguments: options.arguments,
      };

      if (options.passive === true) {
        return await channel.checkQueue(queueName);
      } else {
        return await channel.assertQueue(queueName, queueOptions);
      }
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error declaring queue ${queueName}:`, typedError.message);
      throw typedError;
    }
  }

  /**
   * Delete a queue
   * @param queueName The name of the queue to delete
   * @param options Queue deletion options
   * @returns Promise with deletion result
   */
  async deleteQueue(
    queueName: string,
    options: { ifUnused?: boolean; ifEmpty?: boolean; nowait?: boolean } = {}
  ): Promise<ReturnType<Channel['deleteQueue']>> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);
      return await channel.deleteQueue(queueName, options);
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error deleting queue ${queueName}:`, typedError.message);
      throw typedError;
    }
  }

  /**
   * Purge a queue (remove all messages)
   * @param queueName The name of the queue to purge
   * @returns Promise with purge result
   */
  async purgeQueue(queueName: string): Promise<ReturnType<Channel['purgeQueue']>> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);
      return await channel.purgeQueue(queueName);
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error purging queue ${queueName}:`, typedError.message);
      throw typedError;
    }
  }

  /**
   * Declare an exchange with the given options
   * @param exchangeName The name of the exchange to declare
   * @param options Exchange declaration options
   * @returns Promise with exchange declaration result
   */
  async declareExchange(
    exchangeName: string,
    options: ExchangeDeclarationOptions = {}
  ): Promise<ReturnType<Channel['assertExchange']>> {
    try {
      // Create a channel for exchange operations
      const channel = await this.queueManager.getOrCreateQueue('default-exchange-channel');

      const exchangeType = options.type ?? DEFAULT_EXCHANGE_TYPE;
      const exchangeOptions: Options.AssertExchange = {
        durable: options.durable ?? DEFAULT_EXCHANGE_DURABLE,
        internal: options.internal ?? DEFAULT_EXCHANGE_INTERNAL,
        autoDelete: options.autoDelete ?? DEFAULT_EXCHANGE_AUTO_DELETE,
        alternateExchange: options.alternateExchange,
        arguments: options.arguments,
      };

      return await channel.assertExchange(exchangeName, exchangeType, exchangeOptions);
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error declaring exchange ${exchangeName}:`, typedError.message);
      throw typedError;
    }
  }

  /**
   * Delete an exchange
   * @param exchangeName The name of the exchange to delete
   * @param options Exchange deletion options
   * @returns Promise with deletion result
   */
  async deleteExchange(
    exchangeName: string,
    options: { ifUnused?: boolean; nowait?: boolean } = {}
  ): Promise<ReturnType<Channel['deleteExchange']>> {
    try {
      const channel = await this.queueManager.getOrCreateQueue('default-exchange-channel');
      return await channel.deleteExchange(exchangeName, options);
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error deleting exchange ${exchangeName}:`, typedError.message);
      throw typedError;
    }
  }

  /**
   * Bind a queue to an exchange
   * @param queueName The name of the queue to bind
   * @param exchangeName The name of the exchange to bind to
   * @param routingKey The routing key for the binding
   * @param args Additional arguments for the binding
   * @returns Promise with bind result
   */
  async bindQueue(
    queueName: string,
    exchangeName: string,
    routingKey: string = '',
    args?: any
  ): Promise<ReturnType<Channel['bindQueue']>> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);
      return await channel.bindQueue(queueName, exchangeName, routingKey, args);
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error binding queue ${queueName} to exchange ${exchangeName}:`, typedError.message);
      throw typedError;
    }
  }

  /**
   * Unbind a queue from an exchange
   * @param queueName The name of the queue to unbind
   * @param exchangeName The name of the exchange to unbind from
   * @param routingKey The routing key for the binding
   * @param args Additional arguments for the binding
   * @returns Promise with unbind result
   */
  async unbindQueue(
    queueName: string,
    exchangeName: string,
    routingKey: string = '',
    args?: any
  ): Promise<ReturnType<Channel['unbindQueue']>> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);
      return await channel.unbindQueue(queueName, exchangeName, routingKey, args);
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error unbinding queue ${queueName} from exchange ${exchangeName}:`, typedError.message);
      throw typedError;
    }
  }

  /**
   * Get information about a queue (message count, consumer count)
   * @param queueName The name of the queue to get info for
   * @returns Promise with queue information
   */
  async getQueueInfo(queueName: string): Promise<QueueInfo> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);
      const result = await channel.checkQueue(queueName);
      return {
        messageCount: result.messageCount,
        consumerCount: result.consumerCount
      };
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error getting info for queue ${queueName}:`, typedError.message);
      throw typedError;
    }
  }

  /**
   * Get a message from a queue without consuming it (basic get)
   * @param queueName The name of the queue to get a message from
   * @param options Get options
   * @returns Promise with message result
   */
  async getMessage(
    queueName: string,
    options: { noAck?: boolean } = {}
  ): Promise<ReturnType<Channel['get']>> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);
      return await channel.get(queueName, { noAck: options.noAck ?? false });
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error getting message from queue ${queueName}:`, typedError.message);
      throw typedError;
    }
  }

  /**
   * Close all channels associated with the queue manager
   * @returns Promise that resolves when all channels are closed
   */
  async closeAll(): Promise<void> {
    await this.queueManager.closeAll();
  }

  /**
   * Acquire a raw channel for advanced usage (if needed)
   * @param queueName The queue name to get a channel for
   * @returns Promise with the raw channel
   */
  async acquireChannel(queueName: string): Promise<Channel> {
    return await this.queueManager.getOrCreateQueue(queueName);
  }
}