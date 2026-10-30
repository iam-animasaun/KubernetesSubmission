# Build and Import Images
cd writer
  docker build -t log-writer:1.0 .
  k3d image import log-writer:1.0 -c <cluster-name>

cd reader
  docker build -t log-reader:1.0 .
  k3d image import log-reader:1.0 -c <cluster-name>
