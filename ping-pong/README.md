# Build and Deploy

docker build -t pingpong:1.2 .

k3d image import pingpong:1.2 -c k3s-default

kubectl apply -f `manifests/`
