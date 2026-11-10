# The Project (todo app + todo-backend + Postgres + hourly CronJob)

## Build and load into k3d, then deploy:

    docker build -t todo-app:4.2 .
    docker build -t todo-backend:1.3 ./backend
    docker build -t todo-cron:1.0 ./job
    k3d image import todo-app:4.2 todo-backend:1.3 todo-cron:1.0 -c <your-cluster-name>
    kubectl apply -f manifests/

If the cluster can't pull the database image, load it the same way:

    docker pull postgres:17-alpine
    k3d image import postgres:17-alpine -c <your-cluster-name>

Set a real password in `backend/manifests/pg-secret.yaml`, then:

    kubectl apply -f backend/manifests/

Edit the cronJob schedule `job/manifests/cronJob.yaml`, then:

    kubectl apply -f job/manifests/

- The Ingress sends /todos to todo-backend and everything else to todo-app.
- Todos are stored in Postgres, which runs as a StatefulSet with one replica and its own persistent volume.
- All configuration lives in manifests/00-configmaps.yaml and the Secret, and reaches the pods as environment variables.
- After changing a ConfigMap or Secret, restart the Deployment so the pods pick it up.
- The CronJob (job/maniests/cronJob.yaml) adds a "Read <random Wikipedia URL>" todo at the start of every hour.
- Apply everything into the same namespace, so the short Service names like todo-backend-svc resolve.
