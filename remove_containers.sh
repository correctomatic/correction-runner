#!/bin/bash

# Use this script to remove all test containers

# Prefix for containers you want to remove
prefix_to_remove="correction-" # Should match src/lib/container_names.js

# Get IDs of containers starting with the prefix
container_ids=$(docker ps -a --filter "name=${prefix_to_remove}*" --format "{{.ID}}")

# Loop through each container ID and remove it
for container_id in $container_ids; do
    echo "Removing container $container_id..."
    docker rm -f "$container_id"
done

echo "Containers with prefix $prefix_to_remove removed successfully."
