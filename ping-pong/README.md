# Build and Deploy

npm init -y

npm install pg

docker build -t pingpong:1.3 .

k3d image import pingpong:1.3 -c k3s-default

kubectl apply -f `manifests/`
