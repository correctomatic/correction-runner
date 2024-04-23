import dotenv from 'dotenv'
dotenv.config()

import initializeDocker from './servers/docker_connection.js'
import { getDocker, getContainerLogs } from "./lib/docker.js"
import { RUNNING_QUEUE, FINISHED_QUEUE, getMessageChannel } from './servers/rabbitmq_connection.js'

/*
We should take in consideration the following scenarios:
1) The works arrives first to running queue and then the container finishes
2) The container finishes and then the work arrives to running queue

So for the messages in the running queue, we should:
- Check if the container has already finished, querying docker
- If the container has finished, we should:
  - Get the container logs
  - Remove the container
  - Remove from the running_works array
  - Send the message to the finished_works queue
- If the container has not finished:
  - Put the container in the running_works array, it will be completed
    when we receive an event from Docker

And for the finishing events in Docker:
- Check if the work is in the running_works array.
  If not, it will be processed when we receive the message in the running queue
- If it is, we should:
  - Get the container logs
  - Remove the container
  - Remove from the running_works array
  - Send the message to the finished_works queue
*/


// Works in running queue that are not yet finished
const running_tasks = []

// Channel MUST be shared between the two loops
const channel = await getMessageChannel()

// destroy and kill should remove the running task an return an error. The only acceptable
// event is die, which means the container has finished

function isAbnormalTerminationEvent(event) {
  return event.Type === 'container' && ( event.Action === 'kill' || event.Action === 'destroy')
}

function isADieEvent(event) {
  return event.Type === 'container' && event.Action === 'die'
}

async function sendToFinishedQueue(channel, work, logs, {error}={error:false}) {
  const message = {
    work_id: work.id,
    error,
    correction_data: logs,
    callback: work.callback
  }
  return channel.sendToQueue(FINISHED_QUEUE, Buffer.from(JSON.stringify(message)), { persistent: true })
}

// Listen for the running queue
async function listenForRunningQueue() {
  try {
    let runningWork
    channel.consume(RUNNING_QUEUE, async (message) => {
      try {
        if (message === null) return
        console.log('Received message:', message.content.toString())
        runningWork = JSON.parse(message.content.toString())

        const container = await getDocker().getContainer(runningWork.id)
        const inspect = await container.inspect()

        if (inspect.State.Status === 'exited') {
          console.log('Container already finished, getting output')
          // The container finished before we received the message
          const logs = await getContainerLogs(container)
          await container.remove()
          await sendToFinishedQueue(channel, runningWork, logs)
          channel.ack(message)
        } else {
          // The container is still running
          console.log('Container still running, adding to running tasks')
          running_tasks.push({work: runningWork, message})
        }
      } catch (error) {
        console.error('Error:', error)
        // We will notify that the correction failed
        await sendToFinishedQueue(channel, runningWork, 'Error getting container results', { error: true })
        channel.ack(message)
      }
    })
  }catch (error) {
    console.error('Error:', error)
  }
}

function getRunningTask(id) {
  return running_tasks.find(task =>task.work.id === id)
}

function removeRunningWork(id) {
  const index = running_tasks.findIndex(task => task.work.id === id)
  if (index !== -1) {
    running_tasks.splice(index, 1)
  }
}

function abnormalTermination(event){
  if(isAbnormalTerminationEvent(event)) {
    const id = event.Actor.ID
    const task = getRunningTask(id)
    if(task) {
      // TO-DO: create error in the finished queue
      console.log(`Container ${id} was killed or destroyed`)
    }
    return true
  }
  return false
}

async function listenForContainerCompletion() {
  // Filter for the event stream, but doesn't seem to work
  const eventFilter = { event: 'die' }
  const eventStream = await getDocker().getEvents(eventFilter)

  eventStream.on('data', async function(chunk) {
    console.log('Event received:', chunk.toString()) // debug
    const event = JSON.parse(chunk.toString())

    if(abnormalTermination(event)) return

    if (isADieEvent(event)) {
      const id = event.Actor.ID
      console.log(`Container ${id} finished`)

      const task = getRunningTask(id)
      if (!task) {
        console.log(`Container ${id} not found in running works, ignoring event`)
        return
      }

      try {
        console.log('Container found in running works, processing')

        const container = await getDocker().getContainer(id)
        const logs = await getContainerLogs(container)
        //TO-DO: validate response format (ajv?)

        container.remove()
        removeRunningWork(id)
        await sendToFinishedQueue(channel, task.work, logs)
        console.log('Message sent to finished queue')
        // We must confirm that the message was processed
        channel.ack(task.message)
        console.log('Running work acknowledged')
      } catch (error) {
        console.error('Error:', error)
        // We will notify that the correction failed
        await sendToFinishedQueue(channel, task.work, 'Error getting container results', { error: true })
      }
    }
  })

  eventStream.on('error', function(err) {
    console.error('Error listening to Docker events:', err)
  })
}

console.log('Starting correction completer...')
initializeDocker()
listenForRunningQueue()
listenForContainerCompletion()
