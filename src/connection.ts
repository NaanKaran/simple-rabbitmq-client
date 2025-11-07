import { EventEmitter } from 'events';
import { ConsumeMessage } from 'amqplib';
import { 
  QueueManager, 
  RabbitMQConsumer, 
  RabbitMQProducer, 
  RabbitMQManager,
  RabbitMqConfig,
  ConsumerOptions,
  ProducerOptions
} from './index';

// Define the enhanced interfaces
export interface QueueOptions {
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  arguments?: any;
}

export interface QoSOptions {
  prefetchCount?: number;
  prefetchSize?: number;
  global?: boolean;
}

export interface ExchangeOptions {
  exchange: string;
  type: 'direct' | 'topic' | 'headers' | 'fanout' | 'match' | string;
  durable?: boolean;
  internal?: boolean;
  autoDelete?: boolean;
  alternateExchange?: string;
  arguments?: any;
}

export interface QueueBinding {
  exchange: string;
  routingKey: string;
  arguments?: any;
}

export interface EnhancedConsumerOptionsBase {
  queue: string;
  queueOptions?: QueueOptions;
  qos?: QoSOptions;
  exchanges?: ExchangeOptions[];
  queueBindings?: QueueBinding[];
  consumerOptions?: Partial<ConsumerOptions>;
}

export interface EnhancedConsumerOptions extends EnhancedConsumerOptionsBase {
  handler: (msg: any) => Promise<void | number>;
}

export interface EnhancedPublisherOptions {
  confirm?: boolean;
  maxAttempts?: number;
  exchanges?: ExchangeOptions[];
  producerOptions?: Partial<ProducerOptions>;
}

export interface MessageMetadata {
  exchange?: string;
  routingKey?: string;
  queue?: string;
}

// Consumer class that extends EventEmitter
export class Consumer extends EventEmitter {
  private rabbitConsumer: RabbitMQConsumer;
  private queueManager: QueueManager;
  private stopFunction: (() => Promise<void>) | null = null;
  private queue: string;

  constructor(queueManager: QueueManager, config: EnhancedConsumerOptions) {
    super();
    this.queueManager = queueManager;
    this.rabbitConsumer = new RabbitMQConsumer(queueManager);
    this.queue = config.queue;
  }

  async init(config: EnhancedConsumerOptions): Promise<void> {
    const manager = new RabbitMQManager(this.queueManager);

    // Declare queue if options provided
    if (config.queueOptions) {
      await manager.declareQueue(config.queue, config.queueOptions);
    }

    // Declare exchanges if provided
    if (config.exchanges) {
      for (const exchange of config.exchanges) {
        await manager.declareExchange(exchange.exchange, {
          type: exchange.type,
          durable: exchange.durable,
          internal: exchange.internal,
          autoDelete: exchange.autoDelete,
          alternateExchange: exchange.alternateExchange,
          arguments: exchange.arguments
        });
      }
    }

    // Bind queue to exchanges if provided
    if (config.queueBindings) {
      for (const binding of config.queueBindings) {
        await manager.bindQueue(config.queue, binding.exchange, binding.routingKey);
      }
    }

    // Set up QoS if provided
    if (config.qos) {
      // This would need to be handled in the consume call
    }

    // Start consuming
    const consumerOptions = config.consumerOptions || {};
    
    this.stopFunction = await new Promise((resolve) => {
      this.rabbitConsumer.consume(
        config.queue,
        async (msg: ConsumeMessage, ack, retry) => {
          try {
            const messageContent = JSON.parse(msg.content.toString());
            const result = await config.handler(messageContent);
            
            // Handle result codes for different acknowledgment behaviors
            if (result === 0) {
              // Explicit NACK
              retry();
            } else {
              // Default behavior is ACK
              ack();
            }
          } catch (error) {
            this.emit('error', error);
            // On error, we can retry or potentially send to DLQ based on configuration
            await retry();
          }
        },
        consumerOptions
      );
      
      // Return a function to stop the consumer
      resolve(async () => {
        await this.rabbitConsumer.stop(config.queue);
      });
    });
  }

  async close(): Promise<void> {
    if (this.stopFunction) {
      await this.stopFunction();
    }
  }
}

// Publisher class that extends EventEmitter
export class Publisher extends EventEmitter {
  private rabbitProducer: RabbitMQProducer;
  private queueManager: QueueManager;
  private options: EnhancedPublisherOptions;
  private manager: RabbitMQManager;

  constructor(queueManager: QueueManager, options: EnhancedPublisherOptions = {}) {
    super();
    this.queueManager = queueManager;
    this.rabbitProducer = new RabbitMQProducer(queueManager);
    this.options = options;
    this.manager = new RabbitMQManager(queueManager);
  }

  async init(): Promise<void> {
    // Declare exchanges if provided
    if (this.options.exchanges) {
      for (const exchange of this.options.exchanges) {
        await this.manager.declareExchange(exchange.exchange, {
          type: exchange.type,
          durable: exchange.durable,
          internal: exchange.internal,
          autoDelete: exchange.autoDelete,
          alternateExchange: exchange.alternateExchange,
          arguments: exchange.arguments
        });
      }
    }
  }

  async send(destination: string | MessageMetadata, message: any): Promise<void> {
    if (typeof destination === 'string') {
      // Send directly to queue
      await this.rabbitProducer.send(destination, message, this.options.producerOptions);
    } else {
      // Send to exchange with routing key
      if (destination.exchange && destination.routingKey) {
        await this.rabbitProducer.sendToExchange(
          destination.exchange,
          destination.routingKey,
          message,
          this.options.producerOptions
        );
      } else if (destination.queue) {
        await this.rabbitProducer.send(destination.queue, message, this.options.producerOptions);
      }
    }
  }

  async close(): Promise<void> {
    // Wait for pending operations if needed
    // For now, just return since we don't have pending confirmations
  }
}

export class Connection extends EventEmitter {
  private queueManager: QueueManager;

  constructor(connectionString: string, options?: Partial<RabbitMqConfig>) {
    super();
    
    const config: RabbitMqConfig = {
      url: connectionString,
      maxRetries: 5,
      retryDelay: 5000,
      heartbeat: 30,
      ...options
    };

    this.queueManager = new QueueManager(config);

    // Set up event forwarding for connection events
    this.setupEventForwarding();
  }

  private setupEventForwarding(): void {
    // Forward connection events from QueueManager
    this.queueManager.on('error', (err) => {
      this.emit('error', err);
    });
    
    this.queueManager.on('close', (info) => {
      this.emit('close', info);
    });
    
    // Emit connection event after initialization
    setImmediate(() => {
      this.emit('connection');
    });
  }

  async createConsumer(config: EnhancedConsumerOptionsBase, handler: (msg: any) => Promise<void | number>): Promise<Consumer> {
    const fullConfig: EnhancedConsumerOptions = { ...config, handler };
    const consumer = new Consumer(this.queueManager, fullConfig);
    await consumer.init(fullConfig);
    return consumer;
  }

  async createPublisher(options: EnhancedPublisherOptions = {}): Promise<Publisher> {
    const publisher = new Publisher(this.queueManager, options);
    await publisher.init();
    return publisher;
  }

  async close(): Promise<void> {
    await this.queueManager.closeAll();
  }
}