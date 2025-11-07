import { Options } from "amqplib";

export interface RabbitMqConfig {
  url: string; // RabbitMQ connection URL
  options?: Options.Connect; // Optional connection options
}
