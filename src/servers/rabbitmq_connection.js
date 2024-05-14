import amqp from 'amqplib'
import env from './env.js'

// We share a connection between all the modules
const connection = null

async function connect() {
  return await amqp.connect(env.rabbit.RABBITMQ_URL)
}

async function getConnection() {
  return connection || connect()
}

async function getMessageChannel() {
  const connection = await getConnection()
  return connection.createChannel()
}

export const PENDING_QUEUE = 'pending_corrections'
export const RUNNING_QUEUE = 'running_corrections'
export const FINISHED_QUEUE = 'finished_corrections'
export {
  getMessageChannel
}

