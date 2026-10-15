# The Project

Build and load into k3d, then deploy:

    docker build -t todo-app:2.0 .
    k3d image import todo-app:2.0 -c k3s-default
    kubectl apply -f manifests/deployment.yaml`
    kubectl port-forward svc/todo-app 8080:80

