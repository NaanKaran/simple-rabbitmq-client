import amqplib, { Channel, Options, ConsumeMessage } from "amqplib";
import { QueueManager } from "./rabbitmq.queueManager";

export interface QueueDeclarationOptions {
  exclusive?: boolean;
  durable?: boolean;
  autoDelete?: boolean;
  persistent?: boolean;
  arguments?: any;
  passive?: boolean;
  nowait?: boolean;
}

export interface ExchangeDeclarationOptions {
  type?: 'direct' | 'topic' | 'headers' | 'fanout' | 'match' | string;
  durable?: boolean;
  internal?: boolean;
  autoDelete?: boolean;
  alternateExchange?: string;
  arguments?: any;
}

export interface QueueBindingOptions {
  noLocal?: boolean;
  noAck?: boolean;
  exclusive?: boolean;
  priority?: number;
}

export interface QueueInfo {
  messageCount: number;
  consumerCount: number;
}

export interface QueueBindOptions {
  routingKey?: string;
  arguments?: any;
}

export class RabbitMQManager {
  constructor(private readonly queueManager: QueueManager) {}

  /**
   * Declare a queue with the given options
   */
  async declareQueue(
    queueName: string, 
    options: QueueDeclarationOptions = {}
  ): Promise<ReturnType<Channel['assertQueue']>> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);
      
      // Set default values for queue declaration
      const queueOptions: Options.AssertQueue = {
        durable: options.durable ?? true,
        exclusive: options.exclusive ?? false,
        autoDelete: options.autoDelete ?? false,
        arguments: options.arguments,
      };

      if (options.passive === true) {
        return await channel.checkQueue(queueName);
      } else {
        return await channel.assertQueue(queueName, queueOptions);
      }
    } catch (error) {
      console.error(`Error declaring queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a queue
   */
  async deleteQueue(
    queueName: string,
    options: { ifUnused?: boolean; ifEmpty?: boolean; nowait?: boolean } = {}
  ): Promise<ReturnType<Channel['deleteQueue']>> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);
      return await channel.deleteQueue(queueName, options);
    } catch (error) {
      console.error(`Error deleting queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Purge a queue (remove all messages)
   */
  async purgeQueue(queueName: string): Promise<ReturnType<Channel['purgeQueue']>> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);
      return await channel.purgeQueue(queueName);
    } catch (error) {
      console.error(`Error purging queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Declare an exchange with the given options
   */
  async declareExchange(
    exchangeName: string,
    options: ExchangeDeclarationOptions = {}
  ): Promise<ReturnType<Channel['assertExchange']>> {
    try {
      // Create a temporary channel to declare the exchange
      // We'll use a default queue name to get a channel
      const channel = await this.queueManager.getOrCreateQueue('default-exchange-channel');
      
      const exchangeType = options.type ?? 'topic';
      const exchangeOptions: Options.AssertExchange = {
        durable: options.durable ?? true,
        internal: options.internal ?? false,
        autoDelete: options.autoDelete ?? false,
        alternateExchange: options.alternateExchange,
        arguments: options.arguments,
      };

      return await channel.assertExchange(exchangeName, exchangeType, exchangeOptions);
    } catch (error) {
      console.error(`Error declaring exchange ${exchangeName}:`, error);
      throw error;
    }
  }

  /**
   * Delete an exchange
   */
  async deleteExchange(
    exchangeName: string,
    options: { ifUnused?: boolean; nowait?: boolean } = {}
  ): Promise<ReturnType<Channel['deleteExchange']>> {
    try {
      const channel = await this.queueManager.getOrCreateQueue('default-exchange-channel');
      return await channel.deleteExchange(exchangeName, options);
    } catch (error) {
      console.error(`Error deleting exchange ${exchangeName}:`, error);
      throw error;
    }
  }

  /**
   * Bind a queue to an exchange
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
      console.error(`Error binding queue ${queueName} to exchange ${exchangeName}:`, error);
      throw error;
    }
  }

  /**
   * Unbind a queue from an exchange
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
      console.error(`Error unbinding queue ${queueName} from exchange ${exchangeName}:`, error);
      throw error;
    }
  }

  /**
   * Get information about a queue (message count, consumer count)
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
      console.error(`Error getting info for queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Get a message from a queue without consuming it (basic get)
   */
  async getMessage(
    queueName: string,
    options: { noAck?: boolean } = {}
  ): Promise<ReturnType<Channel['get']>> {
    try {
      const channel = await this.queueManager.getOrCreateQueue(queueName);
      return await channel.get(queueName, { noAck: options.noAck ?? false });
    } catch (error) {
      console.error(`Error getting message from queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Close all channels associated with the queue manager
   */
  async closeAll(): Promise<void> {
    await this.queueManager.closeAll();
  }

  /**
   * Acquire a raw channel for advanced usage (if needed)
   */
  async acquireChannel(queueName: string): Promise<Channel> {
    return await this.queueManager.getOrCreateQueue(queueName);
  }
}