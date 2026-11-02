# The Project

## Build and load into k3d, then deploy:

    docker build -t todo-app:4.2 .
    docker build -t todo-backend:1.1 ./backend
    k3d image import todo-app:4.2 todo-backend:1.1 -c <your-cluster-name>
    kubectl apply -f manifests/deployment.yaml

### The Ingress sends /todos to todo-backend and everything else to todo-app.

### All configuration lives in manifests/00-configmaps.yaml and is passed to the pods as environment variables. After changing a ConfigMap, restart the deployment so the pods pick it up.
