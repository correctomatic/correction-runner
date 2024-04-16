import amqp from 'amqplib'
import dotenv from 'dotenv'

dotenv.config()

const RMQ_HOST = process.env.RABBITMQ_HOST
const RMQ_USER = process.env.RABBITMQ_USER
const RMQ_PASSWORD = process.env.RABBITMQ_PASSWORD
const RABBITMQ_URL=`amqp://${RMQ_USER}:${RMQ_PASSWORD}@${RMQ_HOST}`

// We share a connection between all the modules
const connection = null

function connectionURL() {
  return RABBITMQ_URL
}

async function connect() {
  return await amqp.connect(connectionURL())
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

