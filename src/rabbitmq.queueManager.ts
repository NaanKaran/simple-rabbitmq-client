import amqplib, { Channel, Options, ChannelModel } from "amqplib";
import { RabbitMqConfig } from "./rabbitmq.config";

export class QueueManager {
  private readonly connections: Map<
    string,
    { model: ChannelModel; channel: Channel }
  > = new Map();
  private readonly reconnecting: Set<string> = new Set();
  private readonly config: Required<RabbitMqConfig>;
  constructor(config: RabbitMqConfig) {
    if (!config.url) throw new Error("RabbitMQ URL is required.");
    
    // Set default configuration
    this.config = {
      url: config.url,
      options: config.options || {},
      connectionTimeout: config.connectionTimeout || 10000,
      maxRetries: config.maxRetries || 5,
      retryDelay: config.retryDelay || 30000,
      heartbeat: config.heartbeat || 30,
      tls: config.tls || { enabled: false },
      authentication: config.authentication || {}
    };
    
    this.setupGracefulShutdown();
  }

  private async createConnection(
    queueName: string
  ): Promise<{ model: ChannelModel; channel: Channel }> {
    // Build connection options from config
    let connectOptions: any = {
      heartbeat: this.config.heartbeat,
      ...this.config.options,
    };

    // Add authentication if provided
    if (this.config.authentication.username && this.config.authentication.password) {
      connectOptions.username = this.config.authentication.username;
      connectOptions.password = this.config.authentication.password;
    }

    // Add TLS configuration if enabled
    if (this.config.tls.enabled) {
      connectOptions.tls = {
        cert: this.config.tls.certPath ? require('fs').readFileSync(this.config.tls.certPath) : undefined,
        key: this.config.tls.keyPath ? require('fs').readFileSync(this.config.tls.keyPath) : undefined,
        ca: this.config.tls.caPath ? require('fs').readFileSync(this.config.tls.caPath) : undefined,
        passphrase: this.config.tls.passphrase,
        rejectUnauthorized: false, // You may want to make this configurable
        ...connectOptions.tls
      };
    }

    const model = await amqplib.connect(this.config.url, connectOptions);

    const connection = model.connection;
    const channel = await model.createChannel();

    await channel.assertQueue(queueName, { durable: true });

    // Listen for connection close
    connection.on("close", () => {
      console.error(`🔌 Connection closed for queue: ${queueName}`);
      this.handleReconnect(queueName);
    });

    connection.on("error", (err: Error) => {
      console.error(`❌ Connection error on queue: ${queueName}`, err);
    });

    // Listen for channel close
    channel.on("close", () => {
      console.warn(`📴 Channel closed for queue: ${queueName}`);
      this.handleReconnect(queueName);
    });

    channel.on("error", (err: Error) => {
      console.warn(`⚠️ Channel error for queue: ${queueName}`, err);
    });

    return { model, channel };
  }

  private connectionAttempts = new Map<string, number>();

  private handleReconnect(queueName: string): void {
    if (this.reconnecting.has(queueName)) return;

    const attempts = (this.connectionAttempts.get(queueName) || 0) + 1;
    this.connectionAttempts.set(queueName, attempts);

    if (attempts > this.config.maxRetries) {
      console.error(`❌ Maximum retry attempts (${this.config.maxRetries}) exceeded for queue: ${queueName}`);
      this.connectionAttempts.delete(queueName);
      return;
    }

    this.reconnecting.add(queueName);
    this.connections.delete(queueName);

    console.log(`🔄 Attempt ${attempts}/${this.config.maxRetries} - Reconnecting to queue: ${queueName}...`);

    setTimeout(async () => {
      try {
        const { model, channel } = await this.createConnection(queueName);
        this.connections.set(queueName, { model, channel });
        this.connectionAttempts.delete(queueName); // Reset attempts on success
        console.log(`✅ Reconnected to queue: ${queueName}`);
      } catch (err) {
        console.error(`❌ Failed to reconnect to queue: ${queueName}`, err);
      } finally {
        this.reconnecting.delete(queueName);
      }
    }, this.config.retryDelay);
  }

  async getOrCreateQueue(queueName: string): Promise<Channel> {
    const existing = this.connections.get(queueName);

    if (existing) {
      try {
        await existing.channel.checkQueue(queueName);
        return existing.channel;
      } catch (err) {
        console.warn(`⚠️ Channel stale for ${queueName}, reconnecting...`, err);
        this.handleReconnect(queueName);
        await this.delay(this.config.retryDelay);
        throw err;
      }
    }

    const { model, channel } = await this.createConnection(queueName);
    this.connections.set(queueName, { model, channel });
    return channel;
  }

  async closeQueue(queueName: string): Promise<void> {
    const entry = this.connections.get(queueName);
    if (entry) {
      try {
        await entry.channel.close();
        await entry.model.close();
      } catch (err) {
        console.error(`❌ Error closing queue: ${queueName}`, err);
      } finally {
        this.connections.delete(queueName);
      }
    }
  }

  async closeAll(): Promise<void> {
    for (const [queueName, { model, channel }] of this.connections) {
      try {
        await channel.close();
        await model.close();
      } catch (err) {
        console.error(`❌ Error closing queue: ${queueName}`, err);
      }
    }
    this.connections.clear();
    console.log("✅ All RabbitMQ connections closed.");
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`⚠️ Received ${signal}. Closing RabbitMQ connections...`);
      await this.closeAll();
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get connection status and resource usage
   */
  getConnectionStatus(): { 
    totalConnections: number; 
    activeQueues: string[]; 
    connectionAttempts: Map<string, number> 
  } {
    return {
      totalConnections: this.connections.size,
      activeQueues: Array.from(this.connections.keys()),
      connectionAttempts: new Map(this.connectionAttempts)
    };
  }

  /**
   * Get the number of active connections
   */
  getActiveConnectionCount(): number {
    return this.connections.size;
  }
}
