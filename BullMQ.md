
# Notes for BullMQ

Internal notes about how BullMQ works, for debugging purposes.


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
