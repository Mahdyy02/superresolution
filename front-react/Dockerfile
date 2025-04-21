# Build stage
FROM node:20-slim AS build
WORKDIR /app
COPY . .
RUN npm install --verbose
RUN npm run build --verbose

# Serve with Nginx
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
