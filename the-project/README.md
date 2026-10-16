# The Project

## Build and load into k3d, then deploy:

    docker build -t todo-app:2.0 .
    k3d image import todo-app:2.0 -c k3s-default
    kubectl apply -f manifests/deployment.yaml
curl `http://localhost:8081`

