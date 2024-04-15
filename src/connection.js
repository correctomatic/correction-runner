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
