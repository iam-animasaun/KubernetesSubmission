# Build and Deploy

docker build -t pingpong:1.0 .

k3d image import pingpong:1.0 -c k3s-default

kubectl apply -f `manifests/`
