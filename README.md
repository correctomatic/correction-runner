Needs a Rabbit MQ server. You can launch a server with docker compose, see the configuration in this repository: https://github.com/correctomatic/rabbitmq-server
Then you can access the queues at: http://localhost:15672/#/queues

The queues are:
- pending_corrections: The system has received a request for the correction, but it hasn't started
- running_corrections: There is a docker container executing the correction
- finished_corrections: The correction is ready, but the callback hasn't been called

## Testing

1) Launch the correction starter. It will take works from `pending_corrections` queue and start the corresponding containers:
```sh
yarn starter
```
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
- correction_data: correction
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
