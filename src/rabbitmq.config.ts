import { Options } from "amqplib";

export interface RabbitMqConfig {
  url: string; // RabbitMQ connection URL
  options?: Options.Connect; // Optional connection options
  connectionTimeout?: number; // Connection timeout in milliseconds
  maxRetries?: number; // Maximum number of reconnection attempts
  retryDelay?: number; // Delay between reconnection attempts in milliseconds
  heartbeat?: number; // Heartbeat interval in seconds
  tls?: {
    enabled: boolean;
    certPath?: string;
    keyPath?: string;
    caPath?: string;
    passphrase?: string;
  };
  authentication?: {
    username?: string;
    password?: string;
  };
}
