# The Project

## Build and load into k3d, then deploy:

    docker build -t todo-app:2.0 .
    k3d image import todo-app:2.0 -c k3s-default
    kubectl apply -f manifests/deployment.yaml

## Open the app through the Ingress (the host port mapped to the k3d load balancer's port 80).

## Test the image cache surviving a crash:

   `curl -X POST http://localhost:<port>/shutdown`
    kubectl get pods        # RESTARTS goes up, the picture stays the same

curl `http://localhost:8081`

