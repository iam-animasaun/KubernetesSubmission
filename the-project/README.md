# The Project

## Build and load into k3d, then deploy:

    docker build -t todo-app:4.1 .
    docker build -t todo-backend:1.0 ./backend
    k3d image import todo-app:4.1 todo-backend:1.0 -c <your-cluster-name>
    kubectl apply -f manifests/deployment.yaml

## The Ingress sends /todos to todo-backend and everything else to todo-app.

