# Correction runner

This is the main component of the correction system. It is in charge of running the docker containers that will execute the corrections, and returning the results to the caller.

It has three main components:
- **Correction starter**: It will take works from the `pending_corrections` queue and start the corresponding containers. Once the container is started, it will move the work to the `running_corrections` queue.
- **Correction completer**: It will check for jobs in the `running_corrections` queue and, once the container has finished, it will get the output and generate a correction in the `finished_corrections` queue.
- **Correction notifier**: It will take works from the `finished_corrections` queue and call the callback URL with the results.

The correction starter expects a message in the `pending_corrections` queue with the following fields:
- `work_id`: optional, caller's id of the exercise
- `image`: name of the image to run
- `file`: path of the file with the exercise
- `callback`: URL to call with the results

There is an implementation of a web service that will receive a file and the image to run, and puts the message in the queue. It's in this repository: https://github.com/correctomatic/correction-API

Once the correction has finished, the correction completer will make a POST request to the `callback` URL with the results. The results will be in the body of the request, and the `Content-Type` will be `application/json`. If the correction has finished correctly, the body will be like this:

```json
{
  "success": true,
  "work_id": "123456",
  "grade": 7.98,
  "comments": [
    "If priests would eat",
    "pebbles from the riveeeer"
  ]
}
```

If there was an error in the correction, the body will be:

```json
{
  "success": false,
  "work_id": "123456",
  "error": "The dog ate my correction"
}
```

You have the schema of the response in the `correctomatic_response.json` file.


## Creating a container for a correction

TO-DO
- Explain how it will receive the exercies
- Explain what should be the output of the container

You have the schema of the required response in the `src\schemas\container_response_schema.json` file.

## Security

Take in account that there is no security implemented in this system. Anyone can send a message to the `pending_corrections` queue and it will be processed. You should implement some kind of security in the API that sends the messages to the queue.

**The system can run arbitrary containers in the docker server**, so it can be a security risk. Please take that into account when deploying the system: the Redis server should be accessible only from a trusted network.


## Scaling the system

The three components are independent, so you can (almost) run them in different hosts if you want to scale the system. They communicate through a Redis MQ server, using the `bullmq` library. In theory, you can run as many instances of each component as you want, but it has not been tested.

The docker containers are created and started in the host where the correction starter is running. They must be accessed
by the correction completer, so by now the must reside in the same host.

Anyway, you should be able to change that easily by modifying the two calls to `initializeDocker()` in the correction started and the correction completer to connect to a different docker server. It's using the `dockerode` library, so you can check the documentation for more information. You will probably need to provide some kind of authentication to the docker server.

### Rate limiting

TO-DO

(Explanation of the currently implemented rate limiting system and how to change it)

Rate limiting:
https://docs.bullmq.io/guide/rate-limiting


## Installation

TO-DO

## Configuration

TO-DO

## Development

TO-DO

- The correctomatic server
- How to launch the different components

### Generate a pair of keys

TO-DO

You can generate a pair of keys to sign the JWT tokens with the script `utils\generate_keys.js`. It will generate the files `privateKey.pem` and `publicKey.pem` in the root directory. The private key will be encripted with the password `PRIVATE_KEY_PASSWORD` defined in the `.env` file.



### Reseting the queues

You can delete the queues running the script `utils\reset_queues.js`:

The code won't work unless you comment the `throw` at the start of the file. It's implemented this way to avoid deleting the queues by mistake.

### Remove dangling correction containers

You can remove the correction container generated during the tests with the script `utils\remove_containers.sh`:


### Testing the correction completer

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

- **pending_corrections**:
  - `work_id`: optional, caller's id of the exercise
  - `image`: name of the image to run
  - `file`: file with the exercise
  - `callback`: URL to call with the results

- **running_corrections**:
  - `work_id`: optional, caller's id of the exercise
  - `id`: ID of the container running the correction
  - `callback`: URL to call with the results

- **finished_corrections**:
  - `work_id`: optional, caller's id of the exercise
  - `error`: false means that the correction has finished with an error (the container failed or returned an error in the correction)
  - `correction_data`: correction or error in case the error field is true
  - `callback`: URL to call with the results



### Notes for BullMQ





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
