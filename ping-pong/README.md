# Build and Deploy

docker build -t pingpong:1.1 .

k3d image import pingpong:1.1 -c k3s-default

kubectl apply -f `manifests/`
