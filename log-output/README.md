# Log output app
	
	docker build -t log-output:1.6 .
	k3d image import log-output:1.5 -c k3s-default
	Deploy with `kubectl apply -f manifests`
