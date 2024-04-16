import amqp from 'amqplib'

import connectionURL, {PENDING_QUEUE, RUNNING_QUEUE}  from './rabbitmq_connection.js'
import initializeDocker from './docker_connection.js'
import { launchCorrectionContainer} from './lib/docker.js'


function checkServerLoad() {
  // TO-DO: Implement server load checking
  return true
}

async function getMessageChannel() {
  const connection = await amqp.connect(connectionURL())
  return connection.createChannel()
}

function putInRunningQueue(channel, work_id, containerId, callback) {
  const runningTask = {
    work_id: work_id,
    id: containerId,
    callback: callback
  }
  const message = Buffer.from(JSON.stringify(runningTask))
  channel.sendToQueue(RUNNING_QUEUE, message, { persistent: true })
  console.log('Message sent to running queue')
}

async function mainLoop() {
  try {
    const channel = await getMessageChannel()

    console.log('Waiting for messages...')
    channel.consume(PENDING_QUEUE, async (message) => {
      try {
        if (message === null) return
        console.log('Received message:', message.content.toString())
        const pendingTask = JSON.parse(message.content.toString())

        if (!checkServerLoad()) {
          console.log('Server is overloaded, waiting...')
          return
        }

        const containerId = await launchCorrectionContainer(pendingTask.image, pendingTask.file)
        putInRunningQueue(channel, pendingTask.work_id, containerId, pendingTask.callback)

        channel.ack(message)
      } catch (error) {
        console.error('Error:', error)
      }
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

initializeDocker()
mainLoop()
