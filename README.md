Needs a Rabbit MQ server. You can launch a server with docker compose, see the configuration in this repository: https://github.com/correctomatic/rabbitmq-server
Then you can access the queues at: http://localhost:15672/#/queues

The queues are:
- pending_corrections: The system has received a request for the correction, but it hasn't started
- running_corrections: There is a docker container executing the correction
- finished_corrections: The correction is ready, but the callback hasn't been called

## Testing the correction completer

Testing the completer can be tricky, because you must test the case when the job arrives first to the queue and then the container finishes (the most common one) but also the case when the container has already finished when we receive the message from the queue.

This is the process for testing it:

1) Launch the correction starter. It will take works from `pending_corrections` queue and start the corresponding containers:
```sh
yarn starter
```
You can prevent the starter to start the containers (it will just create them) assigning `DONT_START_CONTAINER=S` in the `.env` file. This way you will be able to start the containers by hand and check the different cases in the correction completer.

2) In another console, launch the correction completer. It will check for containers finishing in this hosts, and if it is a running correction it will get the output and generate a correction in the `finished_corrections` queue:
```sh
yarn completer
```


## Data in each queue:

pending_corrections:
  - work_id: optional, caller's id of the exercise
  - image: name of the image to run
  - file: file with the exercise
  - callback: URL to call with the results


running_corrections:
  - work_id: optional, caller's id of the exercise
  - id: ID of the container running the correction
  - callback: URL to call with the results

finished_corrections:
- work_id: optional, caller's id of the exercise
- error: false means that the correction has been completed.
- correction_data: correction or error in case the error field is true
- callback: URL to call with the results


Example work for pending queue (for testing correction_launcher):
{
  work_id: 555,
  image: 'correction-test-1',
  file: '/tmp/example_exercise.txt',
  callback: 'http://localhost:999'
}

{"work_id":555,"image":"correction-test-1","file":"/tmp/example_exercise.txt","callback":"http://localhost:999"}

Send a correction:
curl --request POST \
  --url http://localhost:3000/grade \
  --header 'Content-Type: multipart/form-data' \
  --header 'User-Agent: insomnium/0.2.3-a' \
  --form file=@/home/alvaro/Software/correctomatic/correction-api/tmp/example_exercise.txt \
  --form work_id=my-id-for-exercise \
  --form assignment_id=correction-test-1 \
  --form callback=http://localhost:9000


### Reseting the queues

You can delete the queues running the script `reset_queues.js`:

The code wont work unless you comment the throw at the start of the file. This is done to avoid deleting the queues by mistake.



### Notes for BullMQ

Guide:
https://www.dragonflydb.io/guides/bullmq

https://github.com/igrek8/bullmq-dashboard

https://hub.docker.com/r/igrek8/bullmq-dashboard

docker run -p 3000:3000 -it igrek8/bullmq-dashboard --bullmq-prefix bull --redis-host host.docker.internal



Rate limiting:
https://docs.bullmq.io/guide/rate-limiting


Error: Error: getaddrinfo EAI_AGAIN undefined
  at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:118:26) {
errno: -3001,
code: 'EAI_AGAIN',
syscall: 'getaddrinfo',
hostname: 'undefined'
  }

docker run --rm -ti --env-file .env --network correctomatic-server_default correctomatic-server-starter /bin/sh



## bullMQ information


Redis keys:


### `bull:<queueName>:meta` - hash
Queue configuration?
Keys I've seen:
- opts.maxLenEvents

### `bull:<queueName>:marker` - sorted set
- ¿?

### `bull:<queueName>:id` - string
"autoincrement" id for the jobs

### `bull:<queueName>:wait` - list
ids of the jobs that are waiting to be processed (in reverse order?)

### `bull:<queueName>:stalled` - list
stalled jobs - jobs that have been in the active list for too long
It seems that `worker.startStalledCheckTimer()` is the call that moves the jobs to this list

### `bull:<queueName>:active` - list
ids of active jobs
When a job is being processed, it is moved from the wait list to the active list

### `bull:<queueName>:completed` - list
ids and timestamp of completed jobs

### `bull:<queueName>:stalled-check` - string
timestamp of the last time the stalled jobs were checked?

### `bull:<queueName>:<job id>` - hash
Information for a job in the queue.
It's not deleted when the job is finished. How do we clean this?

- name
- data
- opts
- timestamp
- delay
- priority
- processedOn (timestamp)
- ats ¿?
- atm?
- returnvalue
- finishedOn (timestamp)

### `bull:<queueName>:<jobid>:lock` - string
The token of the worker that is processing the job

### `bull:<queueName>:events` - stream
Events happening in the queue. Seen so far:
- added
- waiting
- active: when a worker takes the job
- completed
- stalled
- drained ¿?
