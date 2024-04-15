Needs a Rabbit MQ server. You can launch a server with docker compose, see the configuration in this repository: https://github.com/correctomatic/rabbitmq-server
Then you can access the queues at: http://localhost:15672/#/queues

The queues are:
- pending_corrections: The system has received a request for the correction, but it hasn't started
- running_corrections: There is a docker container executing the correction
- finished_corrections: The correction is ready, but the callback hasn't been called

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
- correction_data: correction
- callback: URL to call with the results
