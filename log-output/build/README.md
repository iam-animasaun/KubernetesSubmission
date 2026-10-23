# Build and Import Images

docker build -t log-writer:1.0 .
docker build -t log-reader:1.0 .

k3d image import log-writer:1.0 -c <cluster-name>
k3d image import log-reader:1.0 -c <cluster-name>
