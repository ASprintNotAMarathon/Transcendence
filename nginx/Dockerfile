# nginx with a self-signed certificate for https://localhost

FROM nginx:alpine

COPY nginx/nginx.conf /etc/nginx/nginx.conf

RUN apk add --no-cache openssl \
	&& mkdir -p /etc/nginx/certs \
	&& openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
		-keyout /etc/nginx/certs/localhost.key \
		-out /etc/nginx/certs/localhost.crt \
		-subj "/CN=localhost" \
		-addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
	&& cp /etc/nginx/certs/localhost.crt /usr/local/share/ca-certificates/localhost.crt \
	&& update-ca-certificates \
	&& apk del openssl
