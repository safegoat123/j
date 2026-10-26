ARG VITE_API_URL=http://127.0.0.1:8000

# build environment
FROM node:22-alpine AS builder
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn run build

# production environment (static files only; the API runs separately on the user's machine)
FROM nginx:1.30-alpine
RUN apk upgrade --no-cache \
  && rm -rf /etc/nginx/conf.d
COPY ./docker/nginx/default.conf /etc/nginx/conf.d/
COPY --from=builder /usr/src/app/build /usr/share/nginx/html
RUN chmod +r /usr/share/nginx/html/*
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
