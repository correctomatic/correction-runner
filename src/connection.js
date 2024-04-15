import dotenv from 'dotenv'

dotenv.config()

const RMQ_HOST = process.env.RABBITMQ_HOST
const RMQ_USER = process.env.RABBITMQ_USER
const RMQ_PASSWORD = process.env.RABBITMQ_PASSWORD
const RABBITMQ_URL=`amqp://${RMQ_USER}:${RMQ_PASSWORD}@${RMQ_HOST}`

function connectionURL() {
  return RABBITMQ_URL
}

export default connectionURL
export const PENDING_QUEUE = 'pending_corrections'
export const RUNNING_QUEUE = 'running_corrections'
